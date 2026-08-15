package wa

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"vaultke-backend/config"
)

// OpenWAClient is a thin HTTP client for OpenWA's REST API.
type OpenWAClient struct {
	BaseURL    string
	APIKey     string
	HTTPClient *http.Client
}

// NewOpenWAClient creates a new OpenWA client from config.
func NewOpenWAClient(cfg *config.Config) *OpenWAClient {
	return &OpenWAClient{
		BaseURL: strings.TrimRight(cfg.OpenWAAPIURL, "/"),
		APIKey:  cfg.OpenWAAPIKey,
		HTTPClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// OpenWAMessage represents a message as stored/returned by OpenWA.
type OpenWAMessage struct {
	ID          string                 `json:"id"`
	SessionID   string                 `json:"sessionId"`
	WAMessageID string                 `json:"waMessageId"`
	ChatID      string                 `json:"chatId"`
	ChatName    string                 `json:"chatName,omitempty"`
	Author      string                 `json:"author,omitempty"`
	From        string                 `json:"from"`
	To          string                 `json:"to"`
	Body        string                 `json:"body"`
	Type        string                 `json:"type"`
	Direction   string                 `json:"direction"`
	Timestamp   int64                  `json:"timestamp"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	MediaPath   string                 `json:"mediaPath,omitempty"`
	MediaMime   string                 `json:"mediaMimetype,omitempty"`
	Status      string                 `json:"status"`
	CreatedAt   time.Time              `json:"createdAt"`
}

// OpenWAChatSummary represents a chat summary from OpenWA.
type OpenWAChatSummary struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	IsGroup     bool   `json:"isGroup"`
	Kind        string `json:"kind"`
	UnreadCount int    `json:"unreadCount"`
	Timestamp   int64  `json:"timestamp"`
	LastMessage string `json:"lastMessage,omitempty"`
}

// OpenWASendResult is the response from OpenWA send endpoints.
type OpenWASendResult struct {
	MessageID string `json:"messageId"`
	Timestamp int64  `json:"timestamp"`
}

// OpenWAGroup represents a WhatsApp group from OpenWA.
type OpenWAGroup struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	LinkedParentJID *string  `json:"linkedParentJID,omitempty"`
}

// requestDo performs an HTTP request to OpenWA with API key auth.
func (c *OpenWAClient) requestDo(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	var reqBody io.Reader
	if body != nil {
		if b, ok := body.(*bytes.Buffer); ok {
			reqBody = b
		} else {
			buf := &bytes.Buffer{}
			if _, err := io.Copy(buf, body); err != nil {
				return nil, fmt.Errorf("copy request body: %w", err)
			}
			reqBody = buf
		}
	}

	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, reqBody)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("X-API-Key", c.APIKey)
	req.Header.Set("Accept", "application/json")
	if reqBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.HTTPClient.Do(req)
}

// GetChats fetches the active chats for a session.
func (c *OpenWAClient) GetChats(ctx context.Context, sessionID string, limit, offset int) ([]OpenWAChatSummary, error) {
	path := fmt.Sprintf("/api/sessions/%s/chats?limit=%d&offset=%d", sessionID, limit, offset)
	resp, err := c.requestDo(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("openwa get chats failed: %d %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}

	var chats []OpenWAChatSummary
	if err := json.NewDecoder(resp.Body).Decode(&chats); err != nil {
		return nil, fmt.Errorf("decode chats: %w", err)
	}
	return chats, nil
}

// OpenWAMessageListResponse is the envelope returned by OpenWA's local-DB messages endpoint.
type OpenWAMessageListResponse struct {
	Messages []OpenWAMessage `json:"messages"`
	Total    int             `json:"total"`
}

// GetMessages fetches messages for a chat from OpenWA's local DB.
func (c *OpenWAClient) GetMessages(ctx context.Context, sessionID, chatID string, limit int, offset int) ([]OpenWAMessage, error) {
	path := fmt.Sprintf("/api/sessions/%s/messages?chatId=%s&limit=%d&offset=%d", sessionID, url.QueryEscape(chatID), limit, offset)
	resp, err := c.requestDo(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("openwa get messages failed: %d %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}

	var envelope OpenWAMessageListResponse
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return nil, fmt.Errorf("decode messages: %w", err)
	}
	return envelope.Messages, nil
}

// SendText sends a text message.
func (c *OpenWAClient) SendText(ctx context.Context, sessionID, chatID, text string) (*OpenWASendResult, error) {
	payload := map[string]interface{}{
		"chatId": chatID,
		"text":   text,
	}
	return c.send(ctx, sessionID, "/api/sessions/"+sessionID+"/messages/send-text", payload)
}

// SendImage sends an image message.
func (c *OpenWAClient) SendImage(ctx context.Context, sessionID, chatID, url, base64, mimetype, caption string) (*OpenWASendResult, error) {
	payload := map[string]interface{}{
		"chatId":  chatID,
		"url":     url,
		"base64":  base64,
		"mimetype": mimetype,
		"caption": caption,
	}
	return c.send(ctx, sessionID, "/api/sessions/"+sessionID+"/messages/send-image", payload)
}

// SendDocument sends a document/file message.
func (c *OpenWAClient) SendDocument(ctx context.Context, sessionID, chatID, url, base64, mimetype, filename, caption string) (*OpenWASendResult, error) {
	payload := map[string]interface{}{
		"chatId":   chatID,
		"url":      url,
		"base64":   base64,
		"mimetype": mimetype,
		"filename": filename,
		"caption":  caption,
	}
	return c.send(ctx, sessionID, "/api/sessions/"+sessionID+"/messages/send-document", payload)
}

// MarkRead marks a chat as read.
func (c *OpenWAClient) MarkRead(ctx context.Context, sessionID, chatID string) error {
	payload := map[string]interface{}{"chatId": chatID}
	path := "/api/sessions/" + sessionID + "/chats/read"
	resp, err := c.requestDo(ctx, http.MethodPost, path, strings.NewReader(MustJSON(payload)))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("openwa mark read failed: %d %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	return nil
}

// SendChatState sends typing/recording presence.
func (c *OpenWAClient) SendChatState(ctx context.Context, sessionID, chatID, state string) error {
	payload := map[string]interface{}{
		"chatId": chatID,
		"state":  state,
	}
	path := "/api/sessions/" + sessionID + "/chats/typing"
	resp, err := c.requestDo(ctx, http.MethodPost, path, strings.NewReader(MustJSON(payload)))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("openwa chat state failed: %d %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	return nil
}

// GetGroups fetches groups for a session.
func (c *OpenWAClient) GetGroups(ctx context.Context, sessionID string, limit, offset int) ([]OpenWAGroup, error) {
	path := fmt.Sprintf("/api/sessions/%s/groups?limit=%d&offset=%d", sessionID, limit, offset)
	resp, err := c.requestDo(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("openwa get groups failed: %d %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}

	var groups []OpenWAGroup
	if err := json.NewDecoder(resp.Body).Decode(&groups); err != nil {
		return nil, fmt.Errorf("decode groups: %w", err)
	}
	return groups, nil
}

// CreateGroup creates a WhatsApp group.
func (c *OpenWAClient) CreateGroup(ctx context.Context, sessionID, name string, participants []string) (*OpenWAGroup, error) {
	payload := map[string]interface{}{
		"name":         name,
		"participants": participants,
	}
	path := "/api/sessions/" + sessionID + "/groups"
	resp, err := c.requestDo(ctx, http.MethodPost, path, strings.NewReader(MustJSON(payload)))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("openwa create group failed: %d %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}

	var group OpenWAGroup
	if err := json.NewDecoder(resp.Body).Decode(&group); err != nil {
		return nil, fmt.Errorf("decode group: %w", err)
	}
	return &group, nil
}

// AddGroupParticipants adds participants to a group.
func (c *OpenWAClient) AddGroupParticipants(ctx context.Context, sessionID, groupID string, participants []string) error {
	payload := map[string]interface{}{"participants": participants}
	path := "/api/sessions/" + sessionID + "/groups/" + groupID + "/participants"
	resp, err := c.requestDo(ctx, http.MethodPost, path, strings.NewReader(MustJSON(payload)))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("openwa add participants failed: %d %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	return nil
}

// RemoveGroupParticipant removes a participant from a group.
func (c *OpenWAClient) RemoveGroupParticipant(ctx context.Context, sessionID, groupID, participantID string) error {
	path := "/api/sessions/" + sessionID + "/groups/" + groupID + "/participants/" + participantID
	resp, err := c.requestDo(ctx, http.MethodDelete, path, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("openwa remove participant failed: %d %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	return nil
}

// ValidateWebhook validates an OpenWA webhook signature.
func (c *OpenWAClient) ValidateWebhook(secret, signature string, body []byte) bool {
	if secret == "" {
		return true
	}
	if signature == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

// send is a helper for send endpoints that return {messageId, timestamp}.
func (c *OpenWAClient) send(ctx context.Context, sessionID, path string, payload map[string]interface{}) (*OpenWASendResult, error) {
	resp, err := c.requestDo(ctx, http.MethodPost, path, strings.NewReader(MustJSON(payload)))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("openwa send failed: %d %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}

	var result OpenWASendResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode send result: %w", err)
	}
	return &result, nil
}

func MustJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}
