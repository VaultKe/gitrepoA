package api

import (
	"database/sql"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"time"

	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
)

var meetingService *services.MeetingService

func InitializeMeetingService(db *sql.DB, notificationService *services.NotificationService) {
	meetingService = services.NewMeetingService(db, nil)
}

func GetGoogleCalendarAddEventURL(c *gin.Context) {
	meetingID := c.Param("id")
	if meetingID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Meeting ID is required",
		})
		return
	}

	// Get meeting details
	meeting, err := meetingService.GetMeeting(meetingID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Failed to get meeting: " + err.Error(),
		})
		return
	}

	// Build a summary and description (include chama name)
	// Fetch chama name for better labeling
	db, dbExists := c.Get("db")
	var chamaName string
	if dbExists {
		_ = db.(*sql.DB).QueryRow("SELECT name FROM chamas WHERE id = $1", meeting.ChamaID).Scan(&chamaName)
	}
	if chamaName == "" {
		chamaName = "Chama"
	}

	summary := meeting.Title
	if summary == "" {
		summary = "Chama Meeting"
	}
	summary = fmt.Sprintf("%s — %s", summary, chamaName)

	description := fmt.Sprintf("%s\n\nLocation: %s.", "Chama meeting.", *meeting.Location)
	if meeting.MeetingLink != nil && *meeting.MeetingLink != "" {
		description += "\\nJoin: " + *meeting.MeetingLink
	}

	// Compute start/end using scheduled time and duration in EAT
	eat, _ := time.LoadLocation("Africa/Nairobi")
	start := meeting.ScheduledAt.In(eat)
	end := meeting.ScheduledAt.In(eat).Add(time.Duration(max(1, meeting.Duration)) * time.Minute)

	// Google Calendar template URL
	const template = "https://calendar.google.com/calendar/render"
	params := url.Values{}
	params.Set("action", "TEMPLATE")
	params.Set("text", summary)
	params.Set("details", description)
	if meeting.Location != nil && *meeting.Location != "" {
		params.Set("location", *meeting.Location)
	}

	// Provide local datetime without Z and set ctz to Africa/Nairobi for accurate display
	toLocal := func(t time.Time) string { return t.Format("20060102T150405") }
	params.Set("dates", fmt.Sprintf("%s/%s", toLocal(start), toLocal(end)))
	params.Set("ctz", "Africa/Nairobi")

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"url": template + "?" + params.Encode(),
		},
	})
}

// CreateGoogleCalendarEvent creates the event in the user's Google Calendar with 30/10/0 minute reminders
func CreateGoogleCalendarEvent(c *gin.Context) {
	meetingID := c.Param("id")
	if meetingID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Meeting ID is required"})
		return
	}

	// Auth user
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
		return
	}

	// Get DB and services
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Database connection not available"})
		return
	}

	// Load meeting and chama name
	meeting, err := meetingService.GetMeeting(meetingID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Failed to get meeting: " + err.Error()})
		return
	}

	// Fetch chama name
	var chamaName string
	err = db.(*sql.DB).QueryRow("SELECT name FROM chamas WHERE id = $1", meeting.ChamaID).Scan(&chamaName)
	if err != nil {
		chamaName = "Chama"
	}

	// Get the user's stored Google tokens via GoogleDriveService storage (shared token store)
	driveService := services.NewGoogleDriveService(db.(*sql.DB))
	token, err := driveService.GetUserTokens(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Google account not connected for this user"})
		return
	}

	// Initialize CalendarService with credentials from env JSON
	creds := os.Getenv("GOOGLE_CALENDAR_CREDENTIALS_JSON")
	if creds == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Calendar credentials not configured"})
		return
	}
	calService, err := services.NewCalendarService([]byte(creds))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to init calendar service: " + err.Error()})
		return
	}
	if err := calService.InitializeWithToken(token); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to authorize calendar: " + err.Error()})
		return
	}

	// Build event with accurate start/end and chama name in title
	title := fmt.Sprintf("%s — %s", meeting.Title, chamaName)
	desc := ""
	if meeting.Description != nil {
		desc = *meeting.Description
	}
	if meeting.MeetingLink != nil && *meeting.MeetingLink != "" {
		desc = fmt.Sprintf("%s\n\nJoin: %s", desc, *meeting.MeetingLink)
	}

	ev := &services.CalendarEvent{
		Title:       title,
		Description: desc,
		StartTime:   meeting.ScheduledAt,
		EndTime:     meeting.ScheduledAt.Add(time.Duration(max(1, meeting.Duration)) * time.Minute),
		Location:    *meeting.Location,
		MeetingURL:  *meeting.MeetingLink,
	}

	// Use primary calendar and reminders 30,10,0 minutes
	created, err := calService.CreateEventWithReminders("primary", ev, []int{30, 10, 0})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to create calendar event: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"eventId": created.Id, "htmlLink": created.HtmlLink}})
}
