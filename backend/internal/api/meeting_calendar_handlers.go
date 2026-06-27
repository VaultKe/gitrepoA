package api

import (
	"log"
	"net/http"
	"time"

	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

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