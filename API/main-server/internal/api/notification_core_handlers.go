package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// GetNotifications retrieves all types of notifications for the authenticated user
func GetNotifications(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	// Get database from context
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Get all notifications from different sources in parallel.
	allNotifications := []map[string]interface{}{}

	// Get deleted virtual notification IDs for filtering (best-effort)
	deletedVirtualNotifications := getDeletedVirtualNotificationIDs(db.(*sql.DB), userID)

	var (
		wg sync.WaitGroup

		systemNotifs, invitationNotifs, meetingNotifs []map[string]interface{}
		financialNotifs, chamaNotifs, supportNotifs   []map[string]interface{}

		invitationErr, meetingErr, financialErr, chamaErr, supportErr error
	)

	wg.Add(6)
	go func() {
		defer wg.Done()
		systemNotifs, _ = getSystemNotifications(db.(*sql.DB), userID)
	}()
	go func() {
		defer wg.Done()
		invitationNotifs, invitationErr = getChamaInvitationNotifications(db.(*sql.DB), userID)
		if invitationErr == nil {
			invitationNotifs = filterDeletedNotifications(invitationNotifs, deletedVirtualNotifications)
		}
	}()
	go func() {
		defer wg.Done()
		meetingNotifs, meetingErr = getMeetingNotifications(db.(*sql.DB), userID)
		if meetingErr == nil {
			meetingNotifs = filterDeletedNotifications(meetingNotifs, deletedVirtualNotifications)
		}
	}()
	go func() {
		defer wg.Done()
		financialNotifs, financialErr = getFinancialNotifications(db.(*sql.DB), userID)
		if financialErr == nil {
			financialNotifs = filterDeletedNotifications(financialNotifs, deletedVirtualNotifications)
		}
	}()
	go func() {
		defer wg.Done()
		chamaNotifs, chamaErr = getChamaActivityNotifications(db.(*sql.DB), userID)
		if chamaErr == nil {
			chamaNotifs = filterDeletedNotifications(chamaNotifs, deletedVirtualNotifications)
		}
	}()
	go func() {
		defer wg.Done()
		supportNotifs, supportErr = getSupportRequestNotifications(db.(*sql.DB), userID)
		if supportErr == nil {
			supportNotifs = filterDeletedNotifications(supportNotifs, deletedVirtualNotifications)
		}
	}()
	wg.Wait()

	if len(systemNotifs) > 0 {
		allNotifications = append(allNotifications, systemNotifs...)
	}
	if len(invitationNotifs) > 0 {
		allNotifications = append(allNotifications, invitationNotifs...)
	}
	if len(meetingNotifs) > 0 {
		allNotifications = append(allNotifications, meetingNotifs...)
	}
	if len(financialNotifs) > 0 {
		allNotifications = append(allNotifications, financialNotifs...)
	}
	if len(chamaNotifs) > 0 {
		allNotifications = append(allNotifications, chamaNotifs...)
	}
	if len(supportNotifs) > 0 {
		allNotifications = append(allNotifications, supportNotifs...)
	}

	// Sort all notifications by created_at (most recent first)
	sortNotificationsByDate(allNotifications)

	// Apply pagination
	totalCount := len(allNotifications)
	start := offset
	end := offset + limit
	if start > totalCount {
		start = totalCount
	}
	if end > totalCount {
		end = totalCount
	}

	paginatedNotifications := allNotifications[start:end]

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    paginatedNotifications,
		"meta": map[string]interface{}{
			"total":  totalCount,
			"limit":  limit,
			"offset": offset,
		},
	})
}

// GetUnreadNotificationCount returns the count of unread notifications for the authenticated user
func GetUnreadNotificationCount(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Get database from context
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// For now, return a simple count from the notifications table
	// This can be enhanced later to include counts from other notification sources
	query := `
		SELECT COUNT(*)
		FROM notifications
		WHERE user_id = $1 AND is_read = false
	`

	var count int
	err := db.(*sql.DB).QueryRow(query, userID).Scan(&count)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get unread notification count",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"count": count,
		},
	})
}

// MarkNotificationAsRead marks a notification as read
func MarkNotificationAsRead(c *gin.Context) {
	userID := c.GetString("userID")
	notificationID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Get database from context
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Handle different notification sources
	if handleSpecialNotificationRead(db.(*sql.DB), notificationID, userID) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Notification marked as read",
		})
		return
	}

	// Update notification in the notifications table
	query := `
		UPDATE notifications
		SET is_read = true
		WHERE id = $1 AND user_id = $2
	`

	result, err := db.(*sql.DB).Exec(query, notificationID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to mark notification as read",
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Notification not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Notification marked as read",
	})
}

// MarkAllNotificationsAsRead marks all notifications as read for a user
func MarkAllNotificationsAsRead(c *gin.Context) {
	userID := c.GetString("userID")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Get database from context
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Update all notifications for the user in the notifications table
	query := `
		UPDATE notifications
		SET is_read = true
		WHERE user_id = $1 AND is_read = false
	`

	result, err := db.(*sql.DB).Exec(query, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to mark notifications as read",
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()

	// For virtual notifications (chama activities, meetings, etc.), we'll just return success
	// since they don't need persistent read status tracking for now
	totalMarked := rowsAffected

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("All notifications marked as read (updated %d system notifications)", totalMarked),
	})
}

// DeleteNotification deletes a notification
func DeleteNotification(c *gin.Context) {
	userID := c.GetString("userID")
	notificationID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Get database from context
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// First, check if this notification exists in the database
	var count int
	checkQuery := "SELECT COUNT(*) FROM notifications WHERE id = $1 AND user_id = $2"
	err := db.(*sql.DB).QueryRow(checkQuery, notificationID, userID).Scan(&count)
	if err != nil {
	} else {
	}

	// Handle different notification sources
	if handleSpecialNotificationDelete(db.(*sql.DB), notificationID, userID) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Notification deleted successfully",
			"data":    nil, // Include data field for consistency with frontend expectations
		})
		return
	}

	// Delete notification from the notifications table
	query := `
		DELETE FROM notifications
		WHERE id = $1 AND user_id = $2
	`
	result, err := db.(*sql.DB).Exec(query, notificationID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to delete notification from database",
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Notification not found in database",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Notification deleted successfully",
		"data":    nil, // Include data field for consistency with frontend expectations
	})
}

// SendSystemNotification creates a system notification
func SendSystemNotification(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var notificationData struct {
		Message     string                 `json:"message" binding:"required"`
		Type        string                 `json:"type"`
		Data        map[string]interface{} `json:"data"`
		ChamaID     string                 `json:"chamaId"`
		RecipientID string                 `json:"recipientId"`
	}

	if err := c.ShouldBindJSON(&notificationData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid notification data",
		})
		return
	}

	// Get database from context
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Set default type if not provided
	if notificationData.Type == "" {
		notificationData.Type = "system"
	}

	// Notifications table should already exist from migrations
	// No need to create it here

	// Create notification record
	query := `
		INSERT INTO notifications (user_id, title, message, type, priority, category, data, is_read, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'normal', 'system', $5, false, $6, $7)
	`

	// Convert data map to JSON string
	var dataStr sql.NullString
	if notificationData.Data != nil {
		dataBytes, _ := json.Marshal(notificationData.Data)
		dataStr.String = string(dataBytes)
		dataStr.Valid = true
	}

	// Determine recipient - if specific recipient provided, use that, otherwise use current user
	recipientID := userID
	if notificationData.RecipientID != "" {
		recipientID = notificationData.RecipientID
	}

	// Extract title from message or use default
	title := "System Notification"
	if len(notificationData.Message) > 50 {
		title = notificationData.Message[:47] + "..."
	} else {
		title = notificationData.Message
	}

	now := time.Now()
	result, err := db.(*sql.DB).Exec(query, recipientID, title, notificationData.Message, notificationData.Type, dataStr, now, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create system notification",
		})
		return
	}

	// Get the auto-generated ID
	notificationID, err := result.LastInsertId()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get notification ID",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "System notification sent successfully",
		"data": gin.H{
			"notificationId": fmt.Sprintf("%d", notificationID),
		},
	})
}
