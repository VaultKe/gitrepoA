package api

import (
	"database/sql"
	"log"
	"net/http"
	"time"
	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var (
	meetingService      *services.MeetingService
	schedulerService    *services.SchedulerService
	notificationService *services.NotificationService
)

// InitializeMeetingService initializes the meeting service
func InitializeMeetingService(db *sql.DB, notifService *services.NotificationService) {
	// Set the notification service
	notificationService = notifService

	// Initialize calendar service (optional)
	var calendarService *services.CalendarService
	// TODO: Initialize calendar service with credentials when available

	// Initialize meeting service
	meetingService = services.NewMeetingService(db, calendarService)

	// Initialize and start scheduler service
	schedulerService = services.NewSchedulerService(db, meetingService)
	schedulerService.Start(time.Minute) // Check every minute

	// Fix existing meetings without room names
	// log.Println("Ensuring all virtual meetings have room names...")
	err := meetingService.EnsureVirtualMeetingsHaveRoomNames()
	if err != nil {
		log.Printf("Warning: Failed to ensure room names for existing meetings: %v", err)
	}

	log.Println("Meeting service and scheduler initialized successfully")
}

// CreateMeetingWithLiveKit creates a new meeting with LiveKit integration
func CreateMeetingWithLiveKit(c *gin.Context) {
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
		ChamaID          string `json:"chamaId" binding:"required"`
		Title            string `json:"title" binding:"required"`
		Description      string `json:"description"`
		ScheduledAt      string `json:"scheduledAt" binding:"required"`
		Duration         int    `json:"duration"`
		Location         string `json:"location"`
		MeetingURL       string `json:"meetingUrl"`
		MeetingType      string `json:"meetingType" binding:"required"` // 'physical', 'virtual', 'hybrid'
		RecordingEnabled bool   `json:"recordingEnabled"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Validate meeting type
	if req.MeetingType != "physical" && req.MeetingType != "virtual" && req.MeetingType != "hybrid" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid meeting type. Must be 'physical', 'virtual', or 'hybrid'",
		})
		return
	}

	// Parse scheduled time
	meetingTime, err := time.Parse(time.RFC3339, req.ScheduledAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid scheduled time format. Use RFC3339 format",
		})
		return
	}

	// Check if meeting is in the future
	if meetingTime.Before(time.Now()) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting cannot be scheduled in the past",
		})
		return
	}

	// Set default duration if not provided
	duration := req.Duration
	if duration <= 0 {
		duration = 60 // Default 1 hour
	}

	// Create meeting object
	meetingID := uuid.New().String()
	meeting := &services.Meeting{
		ID:               meetingID,
		ChamaID:          req.ChamaID,
		Title:            req.Title,
		Description:      req.Description,
		ScheduledAt:      meetingTime,
		Duration:         duration,
		Location:         req.Location,
		MeetingURL:       req.MeetingURL,
		MeetingType:      req.MeetingType,
		Status:           "scheduled",
		RecordingEnabled: req.RecordingEnabled,
		CreatedBy:        userID.(string),
	}

	// Create meeting with LiveKit integration
	err = meetingService.CreateVirtualMeeting(meeting)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create meeting: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Meeting created successfully with LiveKit integration!",
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

// StartMeeting starts a meeting
func StartMeeting(c *gin.Context) {
	meetingID := c.Param("id")
	if meetingID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting ID is required",
		})
		return
	}

	err := meetingService.StartMeeting(meetingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start meeting: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Meeting started successfully",
	})
}

// EndMeeting ends a meeting
func EndMeeting(c *gin.Context) {
	meetingID := c.Param("id")
	if meetingID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting ID is required",
		})
		return
	}

	// Get user ID from context
	userID, userExists := c.Get("userID")
	if !userExists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Get DB
	db, dbExists := c.Get("db")
	if !dbExists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Load meeting to get chamaId and current status
	meeting, getErr := meetingService.GetMeeting(meetingID)
	if getErr != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Failed to get meeting: " + getErr.Error(),
		})
		return
	}

	// Strict role check: only chairperson or secretary can end meetings
	var role string
	roleErr := db.(*sql.DB).QueryRow(`
		SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = TRUE
	`, meeting.ChamaID, userID.(string)).Scan(&role)
	if roleErr != nil {
		if roleErr == sql.ErrNoRows {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "Only chairperson or secretary can end meetings",
				"code":    "FORBIDDEN",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to verify user role: " + roleErr.Error(),
		})
		return
	}

	if role != "chairperson" && role != "secretary" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only chairperson or secretary can end meetings",
			"code":    "FORBIDDEN",
		})
		return
	}

	// Minutes approval check removed per updated rule: if minutes were approved earlier, great;
	// otherwise, only attendance requirement is enforced before ending.

	// Prereq 2: At least one attendance record exists
	var attendanceCount int
	attErr := db.(*sql.DB).QueryRow(`
		SELECT COUNT(*) FROM meeting_attendance WHERE meeting_id = $1
	`, meetingID).Scan(&attendanceCount)
	if attErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to verify attendance: " + attErr.Error(),
		})
		return
	}
	if attendanceCount == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Attendance must be marked before ending the meeting",
			"code":    "ATTENDANCE_REQUIRED",
		})
		return
	}

	err := meetingService.EndMeeting(meetingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to end meeting: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Meeting ended successfully",
	})
}

// JoinMeetingWithLiveKit generates a LiveKit access token for joining a meeting
func JoinMeetingWithLiveKit(c *gin.Context) {
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
		UserRole string `json:"userRole"` // 'chairperson', 'secretary', 'treasurer', 'member'
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		// Default to member role if not specified
		req.UserRole = "member"
	}

	// Generate LiveKit access token
	token, err := meetingService.GenerateJoinToken(meetingID, userID.(string), req.UserRole)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to generate join token: " + err.Error(),
		})
		return
	}

	// Get meeting details
	meeting, err := meetingService.GetMeeting(meetingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get meeting details: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Join token generated successfully",
		"data": gin.H{
			"token":            token,
			"roomName":         meeting.RoomName,
			"meetingId":        meetingID,
			"userRole":         req.UserRole,
			"meetingTitle":     meeting.Title,
			"meetingType":      meeting.MeetingType,
			"recordingEnabled": meeting.RecordingEnabled,
		},
	})
}
