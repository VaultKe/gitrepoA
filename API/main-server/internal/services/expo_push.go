package services

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"time"
)

// expoPushEndpoint is Expo's push service. It fans out to FCM (Android) / APNs
// (iOS) and shows the notification in the OS tray / lock screen even when the
// app is closed — no direct FCM credentials needed in the backend.
const expoPushEndpoint = "https://exp.host/--/api/v2/push/send"

var expoHTTPClient = &http.Client{Timeout: 15 * time.Second}

type expoPushMessage struct {
	To        string                 `json:"to"`
	Title     string                 `json:"title,omitempty"`
	Body      string                 `json:"body,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Sound     string                 `json:"sound,omitempty"`
	Priority  string                 `json:"priority,omitempty"`
	ChannelID string                 `json:"channelId,omitempty"`
}

type expoPushResponse struct {
	Data []struct {
		Status  string `json:"status"`
		ID      string `json:"id"`
		Message string `json:"message"`
		Details struct {
			Error string `json:"error"`
		} `json:"details"`
	} `json:"data"`
}

// PushToUser sends an OS push notification to every registered device of a user.
// Best-effort: never returns an error, logs and prunes dead tokens. Safe to call
// as `go PushToUser(...)`.
func PushToUser(db *sql.DB, userID, title, body string, data map[string]interface{}) {
	if db == nil || userID == "" {
		return
	}

	// Respect the user's master sound/push preference when the column exists.
	if !userWantsPush(db, userID) {
		return
	}

	tokens := userPushTokens(db, userID)
	if len(tokens) == 0 {
		return
	}

	if data == nil {
		data = map[string]interface{}{}
	}

	messages := make([]expoPushMessage, 0, len(tokens))
	for _, t := range tokens {
		messages = append(messages, expoPushMessage{
			To:        t,
			Title:     title,
			Body:      body,
			Data:      data,
			Sound:     "default",
			Priority:  "high",
			ChannelID: "default",
		})
	}

	// Expo accepts up to 100 messages per request.
	for start := 0; start < len(messages); start += 100 {
		end := start + 100
		if end > len(messages) {
			end = len(messages)
		}
		sendExpoBatch(db, messages[start:end])
	}
}

func sendExpoBatch(db *sql.DB, batch []expoPushMessage) {
	payload, err := json.Marshal(batch)
	if err != nil {
		return
	}

	req, err := http.NewRequest(http.MethodPost, expoPushEndpoint, bytes.NewReader(payload))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := expoHTTPClient.Do(req)
	if err != nil {
		log.Printf("expo push: request failed: %v", err)
		return
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		log.Printf("expo push: status %d: %s", resp.StatusCode, string(raw))
		return
	}

	var parsed expoPushResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return
	}
	for i, r := range parsed.Data {
		if r.Status == "ok" {
			continue
		}
		log.Printf("expo push: ticket error: %s / %s", r.Message, r.Details.Error)
		// A token Expo reports as unregistered will never work again — drop it.
		if r.Details.Error == "DeviceNotRegistered" && i < len(batch) {
			deletePushToken(db, batch[i].To)
		}
	}
}

func userPushTokens(db *sql.DB, userID string) []string {
	rows, err := db.Query(`SELECT token FROM push_tokens WHERE user_id = $1`, userID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var tokens []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err == nil && t != "" {
			tokens = append(tokens, t)
		}
	}
	return tokens
}

func deletePushToken(db *sql.DB, token string) {
	if _, err := db.Exec(`DELETE FROM push_tokens WHERE token = $1`, token); err != nil {
		log.Printf("expo push: could not delete dead token: %v", err)
	}
}

// userWantsPush returns false only when the user has explicitly disabled sound /
// push notifications. Missing table/column ⇒ default to true.
func userWantsPush(db *sql.DB, userID string) bool {
	var pushEnabled sql.NullBool
	err := db.QueryRow(`
		SELECT COALESCE(push_enabled, sound_enabled, true)
		FROM user_notification_preferences WHERE user_id = $1
	`, userID).Scan(&pushEnabled)
	if err != nil {
		return true
	}
	if !pushEnabled.Valid {
		return true
	}
	return pushEnabled.Bool
}
