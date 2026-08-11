package wa

import (
	"crypto/hmac"
	"crypto/sha256"
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
}

// NewWebhookHandler creates a new webhook handler.
func NewWebhookHandler(client *OpenWAClient, wsHandler *WSHandler, secret string) *WebhookHandler {
	return &WebhookHandler{
		client:    client,
		wsHandler: wsHandler,
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

	if h.wsHandler != nil {
		h.wsHandler.BroadcastFromWebhook(payload)
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
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
