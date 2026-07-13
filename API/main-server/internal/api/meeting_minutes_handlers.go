package api

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// SaveMeetingMinutes saves meeting notes/minutes
func SaveMeetingMinutes(c *gin.Context) {
	meetingID := c.Param("id")
	if meetingID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting ID is required",
		})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req struct {
		Content   string `json:"content" binding:"required"`
		Status    string `json:"status"`
		MeetingID string `json:"meetingId"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Set default status
	if req.Status == "" {
		req.Status = "draft"
	}

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Check if minutes already exist for this meeting
	var existingID string
	err := db.(*sql.DB).QueryRow(`
		SELECT id FROM meeting_minutes WHERE meeting_id = $1
	`, meetingID).Scan(&existingID)

	if err == sql.ErrNoRows {
		// Create new minutes
		minutesID := uuid.New().String()
		_, err = db.(*sql.DB).Exec(`
			INSERT INTO meeting_minutes (
				id, meeting_id, content, status, taken_by, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`, minutesID, meetingID, req.Content, req.Status, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to save meeting minutes: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"success": true,
			"message": "Meeting minutes saved successfully",
			"data": map[string]interface{}{
				"id":        minutesID,
				"meetingId": meetingID,
				"content":   req.Content,
				"status":    req.Status,
				"takenBy":   userID,
				"createdAt": time.Now().Format(time.RFC3339),
			},
		})
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to check existing minutes: " + err.Error(),
		})
		return
	} else {
		// Update existing minutes
		_, err = db.(*sql.DB).Exec(`
			UPDATE meeting_minutes
			SET content = $1, status = $2, taken_by = $3, updated_at = CURRENT_TIMESTAMP
			WHERE id = $4
		`, req.Content, req.Status, userID, existingID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to update meeting minutes: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Meeting minutes updated successfully",
			"data": map[string]interface{}{
				"id":        existingID,
				"meetingId": meetingID,
				"content":   req.Content,
				"status":    req.Status,
				"takenBy":   userID,
				"updatedAt": time.Now().Format(time.RFC3339),
			},
		})
	}
}

// UpdateMeetingMinutes updates meeting minutes fields (content/status). If minutes do not exist, creates them.
func UpdateMeetingMinutes(c *gin.Context) {
	meetingID := c.Param("id")
	if meetingID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting ID is required",
		})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req struct {
		Content string `json:"content"`
		Status  string `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Default status if omitted
	if req.Status == "" {
		req.Status = "draft"
	}

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Check if minutes exist
	var existingID string
	err := db.(*sql.DB).QueryRow(`
		SELECT id FROM meeting_minutes WHERE meeting_id = $1
	`, meetingID).Scan(&existingID)

	if err == sql.ErrNoRows {
		// Create if not exists
		minutesID := uuid.New().String()
		_, err = db.(*sql.DB).Exec(`
			INSERT INTO meeting_minutes (
				id, meeting_id, content, status, taken_by, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`, minutesID, meetingID, req.Content, req.Status, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create meeting minutes: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"success": true,
			"message": "Meeting minutes created",
			"data": map[string]interface{}{
				"id":        minutesID,
				"meetingId": meetingID,
				"content":   req.Content,
				"status":    req.Status,
				"takenBy":   userID,
				"createdAt": time.Now().Format(time.RFC3339),
			},
		})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to check existing minutes: " + err.Error(),
		})
		return
	}

	// Update existing
	_, err = db.(*sql.DB).Exec(`
		UPDATE meeting_minutes
		SET content = COALESCE(NULLIF($1, ''), content),
			status = $2,
			taken_by = $3,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $4
	`, req.Content, req.Status, userID, existingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update meeting minutes: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Meeting minutes updated",
		"data": map[string]interface{}{
			"id":        existingID,
			"meetingId": meetingID,
			"content":   req.Content,
			"status":    req.Status,
			"takenBy":   userID,
			"updatedAt": time.Now().Format(time.RFC3339),
		},
	})
}

// GetMeetingMinutes retrieves meeting minutes
func GetMeetingMinutes(c *gin.Context) {
	meetingID := c.Param("id")
	if meetingID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting ID is required",
		})
		return
	}

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	var minutes struct {
		ID        string    `json:"id"`
		MeetingID string    `json:"meetingId"`
		Content   string    `json:"content"`
		Status    string    `json:"status"`
		TakenBy   string    `json:"takenBy"`
		CreatedAt time.Time `json:"createdAt"`
		UpdatedAt time.Time `json:"updatedAt"`
	}

	err := db.(*sql.DB).QueryRow(`
		SELECT id, meeting_id, content, status, taken_by, created_at, updated_at
		FROM meeting_minutes
		WHERE meeting_id = $1
	`, meetingID).Scan(&minutes.ID, &minutes.MeetingID, &minutes.Content, &minutes.Status,
		&minutes.TakenBy, &minutes.CreatedAt, &minutes.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"data":    nil,
				"message": "No minutes found for this meeting",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to fetch meeting minutes: " + err.Error(),
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": map[string]interface{}{
			"id":        minutes.ID,
			"meetingId": minutes.MeetingID,
			"content":   minutes.Content,
			"status":    minutes.Status,
			"takenBy":   minutes.TakenBy,
			"createdAt": minutes.CreatedAt.Format(time.RFC3339),
			"updatedAt": minutes.UpdatedAt.Format(time.RFC3339),
		},
	})
}
