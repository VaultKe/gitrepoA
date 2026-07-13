package api

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// MarkAttendance marks a user's attendance for a meeting
func MarkAttendance(c *gin.Context) {
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
		AttendanceType string `json:"attendanceType" binding:"required"` // 'physical', 'virtual'
		IsPresent      bool   `json:"isPresent"`
		UserID         string `json:"userId"` // Optional: for secretary to mark attendance for others
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Determine which user's attendance to mark
	targetUserID := userID.(string) // Default to current user
	if req.UserID != "" {
		// Secretary is marking attendance for another user
		targetUserID = req.UserID

		// Verify that the current user has permission to mark attendance for others
		// This should be a secretary or chairperson
		// TODO: Add proper role verification here
		log.Printf("User %s is marking attendance for user %s", userID.(string), targetUserID)
	}

	err := meetingService.MarkAttendance(meetingID, targetUserID, req.AttendanceType, req.IsPresent)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to mark attendance: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Attendance marked successfully",
	})
}

// GetMeetingAttendance retrieves attendance records for a meeting
func GetMeetingAttendance(c *gin.Context) {
	meetingID := c.Param("id")
	if meetingID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting ID is required",
		})
		return
	}

	attendances, err := meetingService.GetMeetingAttendance(meetingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get meeting attendance: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    attendances,
	})
}
