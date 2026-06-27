package api

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"
	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Meeting CRUD handlers

func GetMeetings(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	chamaID := c.Query("chamaId")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "chamaId parameter is required",
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

	// Check if user is a member of the chama
	var membershipExists bool
	err := db.(*sql.DB).QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM chama_members
			WHERE chama_id = $1 AND user_id = $2 AND is_active = TRUE
		)
	`, chamaID, userID).Scan(&membershipExists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to verify chama membership",
		})
		return
	}

	if !membershipExists {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied. You are not a member of this chama.",
		})
		return
	}

	// Query meetings for the chama
	rows, err := db.(*sql.DB).Query(`
		SELECT
			m.id, m.chama_id, m.title, m.description, m.scheduled_at,
			m.duration, m.location, m.meeting_url, m.meeting_type, m.status, m.created_by, m.created_at,
			u.first_name, u.last_name, u.email
		FROM meetings m
		JOIN users u ON m.created_by = u.id
		WHERE m.chama_id = $1
		ORDER BY m.scheduled_at DESC
	`, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch meetings: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var meetings []map[string]interface{}
	for rows.Next() {
		var meeting struct {
			ID               string    `json:"id"`
			ChamaID          string    `json:"chamaId"`
			Title            string    `json:"title"`
			Description      string    `json:"description"`
			ScheduledAt      time.Time `json:"scheduledAt"`
			Duration         int       `json:"duration"`
			Location         string    `json:"location"`
			MeetingURL       string    `json:"meetingUrl"`
			MeetingType      string    `json:"meetingType"`
			Status           string    `json:"status"`
			CreatedBy        string    `json:"createdBy"`
			CreatedAt        time.Time `json:"createdAt"`
			CreatorFirstName string    `json:"creatorFirstName"`
			CreatorLastName  string    `json:"creatorLastName"`
			CreatorEmail     string    `json:"creatorEmail"`
		}

		err := rows.Scan(
			&meeting.ID, &meeting.ChamaID, &meeting.Title, &meeting.Description, &meeting.ScheduledAt,
			&meeting.Duration, &meeting.Location, &meeting.MeetingURL, &meeting.MeetingType, &meeting.Status, &meeting.CreatedBy, &meeting.CreatedAt,
			&meeting.CreatorFirstName, &meeting.CreatorLastName, &meeting.CreatorEmail,
		)
		if err != nil {
			continue // Skip invalid rows
		}

		// Determine meeting status based on scheduled time and duration
		now := time.Now()
		status := meeting.Status
		meetingEndTime := meeting.ScheduledAt.Add(time.Duration(meeting.Duration) * time.Minute)

		// Only mark as completed if the meeting has actually ended (not just started)
		if meetingEndTime.Before(now) && status == "scheduled" {
			status = "completed"
		}

		meetingMap := map[string]interface{}{
			"id":          meeting.ID,
			"chamaId":     meeting.ChamaID,
			"title":       meeting.Title,
			"description": meeting.Description,
			"scheduledAt": meeting.ScheduledAt.Format(time.RFC3339),
			"duration":    meeting.Duration,
			"location":    meeting.Location,
			"meetingUrl":  meeting.MeetingURL,
			"meetingType": meeting.MeetingType,
			"type":        meeting.MeetingType, // Also include as 'type' for compatibility
			"status":      status,
			"createdBy":   meeting.CreatedBy,
			"createdAt":   meeting.CreatedAt.Format(time.RFC3339),
			"creator": map[string]interface{}{
				"id":        meeting.CreatedBy,
				"firstName": meeting.CreatorFirstName,
				"lastName":  meeting.CreatorLastName,
				"email":     meeting.CreatorEmail,
				"fullName":  meeting.CreatorFirstName + " " + meeting.CreatorLastName,
			},
		}

		meetings = append(meetings, meetingMap)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    meetings,
		"message": fmt.Sprintf("Found %d meetings", len(meetings)),
		"meta": map[string]interface{}{
			"total":   len(meetings),
			"chamaId": chamaID,
		},
	})
}

// GetUserMeetings gets all meetings for the current user across all chamas they belong to
func GetUserMeetings(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
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

	// Parse pagination parameters with reasonable defaults
	limit := 50
	offset := 0
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}
	if offsetStr := c.Query("offset"); offsetStr != "" {
		if parsedOffset, err := strconv.Atoi(offsetStr); err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	// Enforce reasonable limits to prevent memory issues
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	// Query meetings for all chamas the user belongs to
	rows, err := db.(*sql.DB).Query(`
		SELECT DISTINCT
			m.id, m.chama_id, m.title, m.description, m.scheduled_at,
			m.duration, m.location, m.meeting_url, m.meeting_type, m.status, m.created_by, m.created_at,
			u.first_name, u.last_name, u.email,
			c.name as chama_name
		FROM meetings m
		JOIN users u ON m.created_by = u.id
		JOIN chama_members cm ON m.chama_id = cm.chama_id
		JOIN chamas c ON m.chama_id = c.id
		WHERE cm.user_id = $1 AND cm.is_active = TRUE
		ORDER BY m.scheduled_at DESC
		LIMIT $2 OFFSET $3
	`, userID, limit, offset)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch user meetings: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var meetings []map[string]interface{}
	chamaCount := make(map[string]bool)

	for rows.Next() {
		var meeting struct {
			ID               string
			ChamaID          string
			Title            string
			Description      sql.NullString
			ScheduledAt      time.Time
			Duration         sql.NullInt64
			Location         sql.NullString
			MeetingURL       sql.NullString
			MeetingType      sql.NullString
			Status           string
			CreatedBy        string
			CreatedAt        time.Time
			CreatorFirstName string
			CreatorLastName  string
			CreatorEmail     string
			ChamaName        string
		}

		err := rows.Scan(
			&meeting.ID, &meeting.ChamaID, &meeting.Title, &meeting.Description,
			&meeting.ScheduledAt, &meeting.Duration, &meeting.Location,
			&meeting.MeetingURL, &meeting.MeetingType, &meeting.Status,
			&meeting.CreatedBy, &meeting.CreatedAt,
			&meeting.CreatorFirstName, &meeting.CreatorLastName, &meeting.CreatorEmail,
			&meeting.ChamaName,
		)
		if err != nil {
			continue
		}

		// Track unique chamas
		chamaCount[meeting.ChamaID] = true

		meetingData := map[string]interface{}{
			"id":          meeting.ID,
			"chamaId":     meeting.ChamaID,
			"chamaName":   meeting.ChamaName,
			"title":       meeting.Title,
			"description": "",
			"scheduledAt": meeting.ScheduledAt.Format(time.RFC3339),
			"duration":    0,
			"location":    "",
			"meetingUrl":  "",
			"meetingType": "physical",
			"status":      meeting.Status,
			"createdBy":   meeting.CreatedBy,
			"createdAt":   meeting.CreatedAt.Format(time.RFC3339),
			"creator": map[string]interface{}{
				"firstName": meeting.CreatorFirstName,
				"lastName":  meeting.CreatorLastName,
				"email":     meeting.CreatorEmail,
			},
		}

		// Handle nullable fields
		if meeting.Description.Valid {
			meetingData["description"] = meeting.Description.String
		}
		if meeting.Duration.Valid {
			meetingData["duration"] = meeting.Duration.Int64
		}
		if meeting.Location.Valid {
			meetingData["location"] = meeting.Location.String
		}
		if meeting.MeetingURL.Valid {
			meetingData["meetingUrl"] = meeting.MeetingURL.String
		}
		if meeting.MeetingType.Valid {
			meetingData["meetingType"] = meeting.MeetingType.String
		}

		meetings = append(meetings, meetingData)
	}

	// Get total count for pagination
	var totalCount int
	err = db.(*sql.DB).QueryRow(`
		SELECT COUNT(DISTINCT m.id)
		FROM meetings m
		JOIN chama_members cm ON m.chama_id = cm.chama_id
		WHERE cm.user_id = $1 AND cm.is_active = TRUE
	`, userID).Scan(&totalCount)

	if err != nil {
		totalCount = len(meetings)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    meetings,
		"message": fmt.Sprintf("Found %d meetings from %d chamas", len(meetings), len(chamaCount)),
		"meta": map[string]interface{}{
			"total":  totalCount,
			"limit":  limit,
			"offset": offset,
			"chamas": len(chamaCount),
		},
	})
}

func CreateMeeting(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req struct {
		ChamaID     string `json:"chamaId" binding:"required"`
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
		ScheduledAt string `json:"scheduledAt" binding:"required"`
		Duration    int    `json:"duration"`
		Location    string `json:"location"`
		MeetingURL  string `json:"meetingUrl"`
		Type        string `json:"type"`
		Agenda      string `json:"agenda"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Validate date time format
	meetingTime, err := time.Parse(time.RFC3339, req.ScheduledAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid date time format. Use RFC3339 format (e.g., 2024-01-01T15:30:00Z)",
		})
		return
	}

	// Check if meeting is in the future
	if meetingTime.Before(time.Now()) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting date and time must be in the future",
		})
		return
	}

	// Calculate end time based on duration
	duration := req.Duration
	if duration <= 0 {
		duration = 60 // Default to 60 minutes
	}
	endTime := meetingTime.Add(time.Duration(duration) * time.Minute)

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Check if user is a member of the chama
	var membershipExists bool
	err = db.(*sql.DB).QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM chama_members
			WHERE chama_id = $1 AND user_id = $2 AND is_active = TRUE
		)
	`, req.ChamaID, userID).Scan(&membershipExists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to verify chama membership",
		})
		return
	}

	if !membershipExists {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied. You are not a member of this chama.",
		})
		return
	}

	// Generate meeting ID
	meetingID := fmt.Sprintf("meeting-%d", time.Now().UnixNano())

	// Set default values
	meetingType := req.Type
	if meetingType == "" {
		meetingType = "regular"
	}

	location := req.Location
	if location == "" {
		location = "TBD"
	}

	// Insert meeting into database
	_, err = db.(*sql.DB).Exec(`
		INSERT INTO meetings (
			id, chama_id, title, description, scheduled_at, duration, location,
			meeting_url, status, created_by, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9, CURRENT_TIMESTAMP)
	`, meetingID, req.ChamaID, req.Title, req.Description, meetingTime, duration, location, req.MeetingURL, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create meeting: " + err.Error(),
		})
		return
	}

	// Notify all chama members about the new meeting
	if notificationService != nil {
		log.Printf("Creating notifications for meeting %s in chama %s", meetingID, req.ChamaID)
		// Use a timeout context to prevent goroutine leaks
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		go func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("Recovered from panic in meeting notification goroutine: %v", r)
				}
			}()

			select {
			case <-ctx.Done():
				log.Printf("Meeting notification cancelled for meeting %s: %v", meetingID, ctx.Err())
				return
			default:
				// Get all chama members
				rows, err := db.(*sql.DB).Query(`
					SELECT user_id FROM chama_members
					WHERE chama_id = $1 AND user_id != $2 AND is_active = TRUE
				`, req.ChamaID, userID)
				if err != nil {
					log.Printf("Failed to get chama members for notification: %v", err)
					return
				}
				defer rows.Close()

				// Get chama name for notification
				var chamaName string
				err = db.(*sql.DB).QueryRow("SELECT name FROM chamas WHERE id = $1", req.ChamaID).Scan(&chamaName)
				if err != nil {
					log.Printf("Failed to get chama name: %v, using default", err)
					chamaName = "Chama"
				}

				memberCount := 0
				// Send notification to each member
				for rows.Next() {
					var memberID string
					if err := rows.Scan(&memberID); err != nil {
						log.Printf("Failed to scan member ID: %v", err)
						continue
					}

					memberCount++
					log.Printf("Creating notification for member %s (%d/%d)", memberID, memberCount, 0) // We'll count total later

					// Create notification data
					data := map[string]interface{}{
						"meetingId":    meetingID,
						"chamaId":      req.ChamaID,
						"chamaName":    chamaName,
						"meetingTitle": req.Title,
						"description":  req.Description,
						"scheduledAt":  req.ScheduledAt,
						"duration":     duration,
						"location":     location,
						"meetingUrl":   req.MeetingURL,
						"meetingType":  meetingType,
					}

					// Send notification
					notification, err := notificationService.CreateNotification(
						memberID,
						services.NotificationTypeMeeting,
						fmt.Sprintf("New Meeting: %s", req.Title),
						fmt.Sprintf("A new meeting '%s' has been scheduled for %s in %s", req.Title, chamaName, meetingTime.Format("Jan 2, 2006 at 3:04 PM")),
						data,
						true,  // sendPush
						false, // sendEmail
						false, // sendSMS
					)
					if err != nil {
						log.Printf("Failed to send meeting notification to user %s: %v", memberID, err)
					} else {
						log.Printf("Successfully created notification %s for user %s", notification.ID, memberID)
					}
				}
				log.Printf("Finished creating notifications for %d members", memberCount)
			}
		}()
	} else {
		log.Printf("Notification service is nil, skipping meeting notifications")
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Meeting scheduled successfully! All chama members will be notified.",
		"data": map[string]interface{}{
			"id":          meetingID,
			"chamaId":     req.ChamaID,
			"title":       req.Title,
			"description": req.Description,
			"scheduledAt": req.ScheduledAt,
			"endsAt":      endTime.Format(time.RFC3339), // Calculated end time
			"duration":    duration,
			"location":    location,
			"meetingUrl":  req.MeetingURL,
			"status":      "scheduled",
			"createdBy":   userID,
			"createdAt":   time.Now().Format(time.RFC3339),
		},
	})
}

func GetMeeting(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Get meeting endpoint - coming soon",
	})
}

func UpdateMeeting(c *gin.Context) {
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

	var req struct {
		Status        string    `json:"status"`
		ConductedAt   time.Time `json:"conductedAt"`
		AttendeeCount int       `json:"attendeeCount"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Update meeting in database - only update provided fields
	query := `UPDATE meetings SET updated_at = CURRENT_TIMESTAMP`
	params := []interface{}{}
	paramCount := 1

	if req.Status != "" {
		query += `, status = $` + fmt.Sprint(paramCount)
		params = append(params, req.Status)
		paramCount++
	}

	if !req.ConductedAt.IsZero() {
		query += `, conducted_at = $` + fmt.Sprint(paramCount)
		params = append(params, req.ConductedAt)
		paramCount++
	}

	if req.AttendeeCount > 0 {
		query += `, attendee_count = $` + fmt.Sprint(paramCount)
		params = append(params, req.AttendeeCount)
		paramCount++
	}

	query += ` WHERE id = $` + fmt.Sprint(paramCount)
	params = append(params, meetingID)

	result, err := db.(*sql.DB).Exec(query, params...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update meeting: " + err.Error(),
		})
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to check update result: " + err.Error(),
		})
		return
	}

	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Meeting not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Meeting updated successfully",
	})
}

func DeleteMeeting(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Delete meeting endpoint - coming soon",
	})
}

// Join meeting endpoint - fully functional for production

func JoinMeeting(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

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

	// Get meeting details
	var meeting struct {
		ID          string    `json:"id"`
		ChamaID     string    `json:"chamaId"`
		Title       string    `json:"title"`
		Description string    `json:"description"`
		ScheduledAt time.Time `json:"scheduledAt"`
		Duration    int       `json:"duration"`
		Location    string    `json:"location"`
		MeetingURL  string    `json:"meetingUrl"`
		MeetingType string    `json:"meetingType"`
		Status      string    `json:"status"`
		CreatedBy   string    `json:"createdBy"`
	}

	err := db.(*sql.DB).QueryRow(`
		SELECT id, chama_id, title, description, scheduled_at, duration,
			   location, meeting_url, meeting_type, status, created_by
		FROM meetings
		WHERE id = $1
	`, meetingID).Scan(
		&meeting.ID, &meeting.ChamaID, &meeting.Title, &meeting.Description,
		&meeting.ScheduledAt, &meeting.Duration, &meeting.Location,
		&meeting.MeetingURL, &meeting.MeetingType, &meeting.Status, &meeting.CreatedBy,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "Meeting not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to fetch meeting details: " + err.Error(),
			})
		}
		return
	}

	// Check if user is a member of the chama
	var membershipExists bool
	err = db.(*sql.DB).QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM chama_members
			WHERE chama_id = $1 AND user_id = $2 AND is_active = TRUE
		)
	`, meeting.ChamaID, userID).Scan(&membershipExists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to verify chama membership",
		})
		return
	}

	if !membershipExists {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied. You are not a member of this chama.",
		})
		return
	}

	// Check if meeting is active or can be joined
	now := time.Now()
	meetingEndTime := meeting.ScheduledAt.Add(time.Duration(meeting.Duration) * time.Minute)
	tenMinutesBefore := meeting.ScheduledAt.Add(-10 * time.Minute) // Updated to match frontend

	// Enhanced join logic - users can join from 10 minutes before until meeting ends
	canJoin := now.After(tenMinutesBefore) && now.Before(meetingEndTime.Add(1*time.Minute)) // Add 1 minute buffer
	if !canJoin {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting cannot be joined at this time. Join window is 10 minutes before start until meeting ends.",
			"data": map[string]interface{}{
				"meetingStart":     meeting.ScheduledAt.Format(time.RFC3339),
				"meetingEnd":       meetingEndTime.Format(time.RFC3339),
				"joinWindowStart":  tenMinutesBefore.Format(time.RFC3339),
				"joinWindowEnd":    meetingEndTime.Add(1 * time.Minute).Format(time.RFC3339),
				"currentTime":      now.Format(time.RFC3339),
				"isMeetingActive":  now.After(meeting.ScheduledAt) && now.Before(meetingEndTime),
				"remainingMinutes": int(meetingEndTime.Sub(now).Minutes()),
			},
		})
		return
	}

	// Return meeting join information based on meeting type
	response := gin.H{
		"success": true,
		"message": "Meeting join information retrieved successfully",
		"data": map[string]interface{}{
			"meeting": map[string]interface{}{
				"id":          meeting.ID,
				"title":       meeting.Title,
				"description": meeting.Description,
				"scheduledAt": meeting.ScheduledAt.Format(time.RFC3339),
				"duration":    meeting.Duration,
				"location":    meeting.Location,
				"meetingUrl":  meeting.MeetingURL,
				"meetingType": meeting.MeetingType,
				"type":        meeting.MeetingType,
				"status":      meeting.Status,
			},
			"joinInfo": map[string]interface{}{
				"canJoin":          true,
				"joinWindowStart":  tenMinutesBefore.Format(time.RFC3339),
				"joinWindowEnd":    meetingEndTime.Add(1 * time.Minute).Format(time.RFC3339),
				"currentTime":      now.Format(time.RFC3339),
				"isMeetingActive":  now.After(meeting.ScheduledAt) && now.Before(meetingEndTime),
				"remainingMinutes": int(meetingEndTime.Sub(now).Minutes()),
			},
		},
	}

	// Add specific join instructions based on meeting type
	switch meeting.MeetingType {
	case "virtual":
		if meeting.MeetingURL != "" {
			response["data"].(map[string]interface{})["joinInstructions"] = map[string]interface{}{
				"type":        "virtual",
				"instruction": "Click the meeting URL to join the virtual meeting",
				"meetingUrl":  meeting.MeetingURL,
			}
		} else {
			response["data"].(map[string]interface{})["joinInstructions"] = map[string]interface{}{
				"type":        "virtual",
				"instruction": "Virtual meeting details will be provided by the meeting organizer",
			}
		}
	case "physical":
		response["data"].(map[string]interface{})["joinInstructions"] = map[string]interface{}{
			"type":        "physical",
			"instruction": "Please arrive at the specified location",
			"location":    meeting.Location,
		}
	case "hybrid":
		response["data"].(map[string]interface{})["joinInstructions"] = map[string]interface{}{
			"type":        "hybrid",
			"instruction": "You can join either virtually or physically",
			"location":    meeting.Location,
			"meetingUrl":  meeting.MeetingURL,
		}
	default:
		response["data"].(map[string]interface{})["joinInstructions"] = map[string]interface{}{
			"type":        "unknown",
			"instruction": "Please contact the meeting organizer for join instructions",
		}
	}

	c.JSON(http.StatusOK, response)
}

// TestLiveKitConnection tests the LiveKit configuration and connection
func TestLiveKitConnection(c *gin.Context) {
	// LiveKit functionality removed
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "LiveKit has been removed from the system",
		"config": gin.H{
			"wsUrl":           "",
			"hasApiKey":       false,
			"hasApiSecret":    false,
			"apiKeyLength":    0,
			"apiSecretLength": 0,
		},
		"testToken": gin.H{
			"generated":    false,
			"tokenLength":  0,
			"tokenPreview": "",
		},
	})
}

// CreateMeetingWithCalendar creates a new meeting with Google Calendar integration
func CreateMeetingWithCalendar(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req struct {
		ChamaID          string   `json:"chamaId" binding:"required"`
		Title            string   `json:"title" binding:"required"`
		Description      string   `json:"description"`
		ScheduledAt      string   `json:"scheduledAt" binding:"required"`
		Duration         int      `json:"duration" binding:"required"`
		Location         string   `json:"location"`
		MeetingURL       string   `json:"meetingUrl"`
		MeetingType      string   `json:"meetingType" binding:"required"`
		RecordingEnabled bool     `json:"recordingEnabled"`
		AttendeeEmails   []string `json:"attendeeEmails"`
		CalendarID       string   `json:"calendarId"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Parse scheduled time
	scheduledAt, err := time.Parse(time.RFC3339, req.ScheduledAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid scheduled time format. Use RFC3339 format",
		})
		return
	}

	// Create meeting object
	meeting := &services.Meeting{
		ID:               uuid.New().String(),
		ChamaID:          req.ChamaID,
		Title:            req.Title,
		Description:      req.Description,
		ScheduledAt:      scheduledAt,
		Duration:         req.Duration,
		Location:         req.Location,
		MeetingURL:       req.MeetingURL,
		MeetingType:      req.MeetingType,
		Status:           "scheduled",
		RecordingEnabled: req.RecordingEnabled,
		CreatedBy:        userID.(string),
	}

	// Create meeting with calendar integration
	err = meetingService.CreateMeetingWithCalendar(meeting, req.AttendeeEmails, req.CalendarID)
	if err != nil {
		log.Printf("Failed to create meeting with calendar: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create meeting: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Meeting created successfully with calendar integration",
		"data": gin.H{
			"id":               meeting.ID,
			"chamaId":          meeting.ChamaID,
			"title":            meeting.Title,
			"description":      meeting.Description,
			"scheduledAt":      meeting.ScheduledAt.Format(time.RFC3339),
			"duration":         meeting.Duration,
			"location":         meeting.Location,
			"meetingUrl":       meeting.MeetingURL,
			"meetingType":      meeting.MeetingType,
			"roomName":         meeting.RoomName,
			"status":           meeting.Status,
			"recordingEnabled": meeting.RecordingEnabled,
			"createdBy":        meeting.CreatedBy,
		},
	})
}

// PreviewMeeting allows chairpersons and secretaries to preview a meeting room
func PreviewMeeting(c *gin.Context) {
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

	// Get user role from query parameter or request body
	userRole := c.Query("role")
	if userRole == "" {
		var req struct {
			UserRole string `json:"userRole"`
		}
		if err := c.ShouldBindJSON(&req); err == nil {
			userRole = req.UserRole
		}
	}

	// Default to member if no role specified (will be rejected by service)
	if userRole == "" {
		userRole = "member"
	}

	// Debug logging before calling preview
	log.Printf("Attempting to preview meeting %s for user %s with role %s", meetingID, userID.(string), userRole)

	// Get meeting preview information
	previewInfo, err := meetingService.GetMeetingPreviewInfo(meetingID, userID.(string), userRole)
	if err != nil {
		log.Printf("Preview error for meeting %s: %v", meetingID, err)
		if err.Error() == "only chairpersons and secretaries can preview meetings" {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   err.Error(),
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to get meeting preview: " + err.Error(),
			})
		}
		return
	}

	// Debug logging
	log.Printf("Preview info generated for meeting %s, user %s, role %s", meetingID, userID.(string), userRole)
	log.Printf("Preview data: accessToken exists: %v, wsURL: %v, roomName: %v",
		previewInfo["accessToken"] != nil && previewInfo["accessToken"] != "",
		previewInfo["wsURL"],
		previewInfo["roomName"])

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Meeting preview information retrieved successfully",
		"data":    previewInfo,
	})
}
