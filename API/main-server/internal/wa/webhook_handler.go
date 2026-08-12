package wa

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

// WebhookHandler handles incoming webhooks from OpenWA.
type WebhookHandler struct {
	client    *OpenWAClient
	wsHandler *WSHandler
	secret    string
	db        *sql.DB
}

// NewWebhookHandler creates a new webhook handler.
func NewWebhookHandler(client *OpenWAClient, wsHandler *WSHandler, db *sql.DB, secret string) *WebhookHandler {
	return &WebhookHandler{
		client:    client,
		wsHandler: wsHandler,
		db:        db,
		secret:    secret,
	}
}

// HandleWebhook receives and processes an OpenWA webhook.
func (h *WebhookHandler) HandleWebhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	signature := c.GetHeader("X-OpenWA-Signature")
	if !h.client.ValidateWebhook(h.secret, signature, body) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		return
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload: " + err.Error()})
		return
	}

	userID := h.resolveUserID(payload)

	if h.wsHandler != nil {
		h.wsHandler.BroadcastFromWebhook(payload, userID)
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *WebhookHandler) resolveUserID(payload map[string]interface{}) string {
	if h.db == nil {
		return ""
	}
	sessionID := ""
	if v, ok := payload["sessionId"].(string); ok && v != "" {
		sessionID = v
	} else if data, ok := payload["data"].(map[string]interface{}); ok {
		if v, ok := data["sessionId"].(string); ok && v != "" {
			sessionID = v
		}
	}
	if sessionID == "" {
		return ""
	}
	owner, err := GetSessionOwner(h.db, sessionID)
	if err != nil {
		return ""
	}
	return owner
}

// ValidateWebhook validates an OpenWA webhook signature using HMAC-SHA256.
func ValidateWebhook(secret, signature string, body []byte) bool {
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

func parseWebhookPayload(body []byte) (map[string]interface{}, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	return payload, nil
}
