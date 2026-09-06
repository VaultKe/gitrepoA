package api

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// RegisterPushToken stores (or refreshes) an Expo/device push token for the
// authenticated user so the backend can deliver notifications to the OS tray.
func RegisterPushToken(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
		return
	}

	var req struct {
		Token      string `json:"token"`
		Platform   string `json:"platform"`
		DeviceName string `json:"deviceName"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request"})
		return
	}
	req.Token = strings.TrimSpace(req.Token)
	if req.Token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "token is required"})
		return
	}

	db := dbFromContext(c)
	if db == nil {
		return
	}

	// A token is globally unique to a device; if it moves to another account,
	// reassign it rather than duplicating.
	_, err := db.Exec(`
		INSERT INTO push_tokens (user_id, token, platform, device_name, created_at, updated_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (token) DO UPDATE
		SET user_id = EXCLUDED.user_id,
		    platform = EXCLUDED.platform,
		    device_name = EXCLUDED.device_name,
		    updated_at = CURRENT_TIMESTAMP
	`, userID, req.Token, req.Platform, req.DeviceName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to save push token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Push token registered"})
}

// UnregisterPushToken removes a push token (called on logout / when permissions
// are revoked).
func UnregisterPushToken(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
		return
	}

	var req struct {
		Token string `json:"token"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request"})
		return
	}
	req.Token = strings.TrimSpace(req.Token)
	if req.Token == "" {
		c.JSON(http.StatusOK, gin.H{"success": true})
		return
	}

	db := dbFromContext(c)
	if db == nil {
		return
	}

	if _, err := db.Exec(`DELETE FROM push_tokens WHERE token = $1 AND user_id = $2`, req.Token, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to remove push token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Push token removed"})
}
