package api

import (
	"database/sql"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

var ensureDeletedNotificationsTableOnce sync.Once

func ensureDeletedNotificationsTable(db *sql.DB) {
	ensureDeletedNotificationsTableOnce.Do(func() {
		createTableQuery := `
			CREATE TABLE IF NOT EXISTS deleted_virtual_notifications (
				id SERIAL PRIMARY KEY,
				user_id TEXT NOT NULL,
				notification_id TEXT NOT NULL,
				notification_type TEXT NOT NULL,
				deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(user_id, notification_id)
			)
		`
		_, _ = db.Exec(createTableQuery)
	})
}

var ensureReadNotificationsTableOnce sync.Once

func ensureReadNotificationsTable(db *sql.DB) {
	ensureReadNotificationsTableOnce.Do(func() {
		_, _ = db.Exec(`
			CREATE TABLE IF NOT EXISTS read_virtual_notifications (
				id SERIAL PRIMARY KEY,
				user_id TEXT NOT NULL,
				notification_id TEXT NOT NULL,
				notification_type TEXT NOT NULL DEFAULT '',
				read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(user_id, notification_id)
			)
		`)
	})
}

// storeVirtualNotificationRead records that a virtual (aggregated, non-row)
// notification has been read by a user, so it stays read across reloads.
// Virtual notifications are regenerated on every GetNotifications call with
// isRead=false hardcoded; without this record they flip back to unread.
func storeVirtualNotificationRead(db *sql.DB, userID, notificationID, notificationType string) bool {
	ensureReadNotificationsTable(db)
	_, err := db.Exec(`
		INSERT INTO read_virtual_notifications (user_id, notification_id, notification_type)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, notification_id) DO UPDATE
		SET notification_type = EXCLUDED.notification_type, read_at = CURRENT_TIMESTAMP
	`, userID, notificationID, notificationType)
	if err != nil {
		fmt.Printf("storeVirtualNotificationRead failed for %s/%s: %v\n", userID, notificationID, err)
	}
	// Return success regardless — a failed bookkeeping write must not surface
	// as a failed "mark as read" to the client.
	return true
}

// getReadVirtualNotificationIDs returns the set of virtual notification IDs a
// user has marked as read.
func getReadVirtualNotificationIDs(db *sql.DB, userID string) map[string]bool {
	readIDs := make(map[string]bool)
	ensureReadNotificationsTable(db)

	rows, err := db.Query(`SELECT notification_id FROM read_virtual_notifications WHERE user_id = $1`, userID)
	if err != nil {
		return readIDs
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			readIDs[id] = true
		}
	}
	return readIDs
}

// applyReadVirtualNotifications overlays persisted read state onto the freshly
// aggregated notification list.
func applyReadVirtualNotifications(notifications []map[string]interface{}, readIDs map[string]bool) {
	if len(readIDs) == 0 {
		return
	}
	for _, n := range notifications {
		id, ok := n["id"].(string)
		if !ok || id == "" {
			continue
		}
		if readIDs[id] {
			n["isRead"] = true
			n["is_read"] = true
		}
	}
}

// markAllVirtualNotificationsRead persists a read marker for every virtual
// (non-DB-row) notification currently visible to the user. Real rows in the
// notifications table are handled by a direct UPDATE elsewhere.
func markAllVirtualNotificationsRead(db *sql.DB, userID string) {
	var (
		wg  sync.WaitGroup
		mu  sync.Mutex
		all []map[string]interface{}
	)
	collect := func(list []map[string]interface{}) {
		mu.Lock()
		all = append(all, list...)
		mu.Unlock()
	}

	wg.Add(5)
	go func() { defer wg.Done(); l, _ := getChamaInvitationNotifications(db, userID); collect(l) }()
	go func() { defer wg.Done(); l, _ := getMeetingNotifications(db, userID); collect(l) }()
	go func() { defer wg.Done(); l, _ := getFinancialNotifications(db, userID); collect(l) }()
	go func() { defer wg.Done(); l, _ := getChamaActivityNotifications(db, userID); collect(l) }()
	go func() { defer wg.Done(); l, _ := getSupportRequestNotifications(db, userID); collect(l) }()
	wg.Wait()

	for _, n := range all {
		id, ok := n["id"].(string)
		if !ok || id == "" {
			continue
		}
		if src, _ := n["source"].(string); src == "system" {
			continue // real notifications table row — handled by UPDATE
		}
		storeVirtualNotificationRead(db, userID, id, "")
	}
}

// sortNotificationsByDate sorts notifications by created_at in descending order (most recent first)
func sortNotificationsByDate(notifications []map[string]interface{}) {
	sort.Slice(notifications, func(i, j int) bool {
		date1, ok1 := notifications[i]["createdAt"].(string)
		date2, ok2 := notifications[j]["createdAt"].(string)
		if !ok1 || !ok2 {
			return false
		}
		time1, err1 := time.Parse("2006-01-02 15:04:05", date1)
		time2, err2 := time.Parse("2006-01-02 15:04:05", date2)
		if err1 != nil || err2 != nil {
			return false
		}
		return time1.After(time2)
	})
}

// handleSpecialNotificationRead handles marking special notification types as read
func handleSpecialNotificationRead(db *sql.DB, notificationID, userID string) bool {
	// Handle prefixed notification IDs from aggregated notifications

	// Guarantor / referee requests clear themselves when the underlying row's
	// status changes (accept/decline), so a "mark read" is just a no-op success.
	if strings.HasPrefix(notificationID, "guarantor_req_") || strings.HasPrefix(notificationID, "referee_req_") {
		return true
	}

	// Virtual notifications are regenerated on every fetch, so their read state
	// must be persisted separately or they revert to unread on the next reload.
	virtualPrefixes := []string{
		"chama_activity_", "meeting_", "loan_", "welfare_", "transaction_",
		"support_update_", "support_new_",
	}
	for _, prefix := range virtualPrefixes {
		if strings.HasPrefix(notificationID, prefix) {
			return storeVirtualNotificationRead(db, userID, notificationID, prefix)
		}
	}

	// Check if this is a chama invitation notification
	if len(notificationID) > 0 {
		// Chama invitations are handled by accept/reject, so we consider them "read" when accessed
		var count int
		err := db.QueryRow("SELECT COUNT(*) FROM chama_invitations WHERE id = $1", notificationID).Scan(&count)
		if err == nil && count > 0 {
			// This is a chama invitation, consider it handled
			return true
		}
	}

	return false
}

// handleSpecialNotificationDelete handles deleting special notification types
func handleSpecialNotificationDelete(db *sql.DB, notificationID, userID string) bool {

	// First, check if this notification actually exists in the database
	// If it exists, we should delete it normally, not treat it as virtual
	var count int
	checkQuery := "SELECT COUNT(*) FROM notifications WHERE id = $1 AND user_id = $2"
	err := db.QueryRow(checkQuery, notificationID, userID).Scan(&count)
	if err == nil && count > 0 {
		return false // Let normal deletion process handle it
	} else {
	}

	// A pending guarantor / referee request is actionable — swiping it away must
	// not make it impossible to accept/decline. Report success (so the UI is
	// responsive) but persist nothing: it reappears until the user responds,
	// at which point it clears itself.
	if strings.HasPrefix(notificationID, "guarantor_req_") || strings.HasPrefix(notificationID, "referee_req_") {
		return true
	}

	// Handle prefixed notification IDs from aggregated notifications
	// These are virtual notifications that don't exist in the main notifications table
	// We'll mark them as "deleted" by creating a deletion record or just return success

	// Check for chama activity notifications
	if strings.HasPrefix(notificationID, "chama_activity_") {
		return storeVirtualNotificationDeletion(db, userID, notificationID, "chama_activity")
	}

	// Check for meeting notifications (only if they don't exist in database)
	if strings.HasPrefix(notificationID, "meeting_") {
		return storeVirtualNotificationDeletion(db, userID, notificationID, "meeting")
	}

	// Check for loan notifications (only if they don't exist in database)
	if strings.HasPrefix(notificationID, "loan_") {
		return storeVirtualNotificationDeletion(db, userID, notificationID, "loan")
	}

	// Check for welfare notifications (only if they don't exist in database)
	if strings.HasPrefix(notificationID, "welfare_") {
		return storeVirtualNotificationDeletion(db, userID, notificationID, "welfare")
	}

	// Check for transaction notifications (only if they don't exist in database)
	if strings.HasPrefix(notificationID, "transaction_") {
		return storeVirtualNotificationDeletion(db, userID, notificationID, "transaction")
	}

	// Check for support request notifications
	if strings.HasPrefix(notificationID, "support_update_") {
		return storeVirtualNotificationDeletion(db, userID, notificationID, "support_update")
	}

	// Check for new support request notifications (for admins)
	if strings.HasPrefix(notificationID, "support_new_") {
		return storeVirtualNotificationDeletion(db, userID, notificationID, "support_new")
	}

	// Check for timestamp-based notification IDs (format: YYYYMMDDHHMMSS or YYYYMMDDHHMMSS-XXXXX)
	// These are often generated notifications that might not be in the main notifications table
	if matched, _ := regexp.MatchString(`^\d{14}(-[a-zA-Z0-9]+)?$`, notificationID); matched {
		return storeVirtualNotificationDeletion(db, userID, notificationID, "timestamp_based")
	}

	// Check if this is a chama invitation notification
	if len(notificationID) > 0 {
		// For chama invitations, try to delete from chama_invitations table
		var count int
		err := db.QueryRow("SELECT COUNT(*) FROM chama_invitations WHERE id = $1", notificationID).Scan(&count)
		if err == nil && count > 0 {

			// Actually delete the chama invitation
			deleteQuery := "DELETE FROM chama_invitations WHERE id = $1 AND invited_email = (SELECT email FROM users WHERE id = $2)"
			result, err := db.Exec(deleteQuery, notificationID, userID)
			if err != nil {
				return false
			}

			rowsAffected, _ := result.RowsAffected()
			return rowsAffected > 0
		}
	}

	// If we reach here, the notification doesn't exist in the database and doesn't match known patterns
	// This could be a stale/cached notification that was already deleted or a virtual notification
	// we don't recognize. For better UX, we'll treat it as successfully deleted.
	return storeVirtualNotificationDeletion(db, userID, notificationID, "unknown")
}

// storeVirtualNotificationDeletion stores a record that a virtual notification was deleted
func storeVirtualNotificationDeletion(db *sql.DB, userID, notificationID, notificationType string) bool {
	ensureDeletedNotificationsTable(db)

	insertQuery := `
		INSERT INTO deleted_virtual_notifications
		(user_id, notification_id, notification_type)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, notification_id) DO UPDATE
		SET notification_type = EXCLUDED.notification_type, deleted_at = CURRENT_TIMESTAMP
	`

	_, err := db.Exec(insertQuery, userID, notificationID, notificationType)
	if err != nil {
		// Even if storage fails, we can still return success for virtual notifications
		return true
	}

	return true
}

// getDeletedVirtualNotificationIDs retrieves the IDs of deleted virtual notifications for a user
func getDeletedVirtualNotificationIDs(db *sql.DB, userID string) map[string]bool {
	deletedIDs := make(map[string]bool)

	ensureDeletedNotificationsTable(db)

	query := `
		SELECT notification_id
		FROM deleted_virtual_notifications
		WHERE user_id = $1
	`

	rows, err := db.Query(query, userID)
	if err != nil {
		return deletedIDs
	}
	defer rows.Close()

	for rows.Next() {
		var notificationID string
		if err := rows.Scan(&notificationID); err == nil {
			deletedIDs[notificationID] = true
		}
	}

	return deletedIDs
}

// getStatusDisplayText converts status to user-friendly text
func getStatusDisplayText(status string) string {
	switch status {
	case "in_progress":
		return "being reviewed"
	case "resolved":
		return "resolved"
	case "closed":
		return "closed"
	case "rejected":
		return "declined"
	default:
		return "updated"
	}
}

// filterDeletedNotifications filters out notifications that have been deleted
func filterDeletedNotifications(notifications []map[string]interface{}, deletedIDs map[string]bool) []map[string]interface{} {
	filtered := []map[string]interface{}{}

	for _, notification := range notifications {
		if id, ok := notification["id"].(string); ok {
			if !deletedIDs[id] {
				filtered = append(filtered, notification)
			}
		} else {
			// If ID is not a string or doesn't exist, include the notification
			filtered = append(filtered, notification)
		}
	}

	return filtered
}

// AcceptChamaInvitation handles accepting a chama invitation
func AcceptChamaInvitation(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	invitationID := c.Param("id")
	if invitationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invitation ID is required",
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

	// Get user's email
	var userEmail string
	err := db.(*sql.DB).QueryRow("SELECT email FROM users WHERE id = $1", userID).Scan(&userEmail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get user email",
		})
		return
	}

	// Verify invitation exists and belongs to user
	var invitation struct {
		ID        string `json:"id"`
		ChamaID   string `json:"chamaId"`
		Email     string `json:"email"`
		Status    string `json:"status"`
		ExpiresAt string `json:"expiresAt"`
	}

	query := `
		SELECT id, chama_id, email, status, expires_at
		FROM chama_invitations
		WHERE id = $1 AND email = $2 AND status = 'pending'
	`

	err = db.(*sql.DB).QueryRow(query, invitationID, userEmail).Scan(
		&invitation.ID, &invitation.ChamaID, &invitation.Email,
		&invitation.Status, &invitation.ExpiresAt,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Invitation not found or already processed",
		})
		return
	}

	// Check if invitation has expired
	expiresAt, err := time.Parse("2006-01-02 15:04:05", invitation.ExpiresAt)
	if err != nil || time.Now().After(expiresAt) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invitation has expired",
		})
		return
	}

	// Start transaction
	tx, err := db.(*sql.DB).Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start transaction",
		})
		return
	}
	defer tx.Rollback()

	// Update invitation status
	_, err = tx.Exec("UPDATE chama_invitations SET status = 'accepted', responded_at = $2 WHERE id = $1",
		invitationID, time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update invitation",
		})
		return
	}

	// Add user to chama
	_, err = tx.Exec(`
		INSERT INTO chama_members (id, chama_id, user_id, role, joined_at, is_active)
		VALUES ($1, $2, $3, 'member', $4, true)
	`, fmt.Sprintf("cm_%d", time.Now().UnixNano()), invitation.ChamaID, userID, time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to add user to chama",
		})
		return
	}

	// Update chama member count
	_, err = tx.Exec("UPDATE chamas SET current_members = current_members + 1, updated_at = $2 WHERE id = $1",
		invitation.ChamaID, time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update chama member count",
		})
		return
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to commit transaction",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Invitation accepted successfully",
	})
	c.Abort()
}

// RejectChamaInvitation handles rejecting a chama invitation
func RejectChamaInvitation(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	invitationID := c.Param("id")
	if invitationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invitation ID is required",
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

	// Get user's email
	var userEmail string
	err := db.(*sql.DB).QueryRow("SELECT email FROM users WHERE id = $1", userID).Scan(&userEmail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get user email",
		})
		return
	}

	// Update invitation status
	result, err := db.(*sql.DB).Exec(`
		UPDATE chama_invitations
		SET status = 'rejected', responded_at = $3
		WHERE id = $1 AND email = $2 AND status = 'pending'
	`, invitationID, userEmail, time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to reject invitation",
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Invitation not found or already processed",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Invitation rejected successfully",
	})
	c.Abort()
}
