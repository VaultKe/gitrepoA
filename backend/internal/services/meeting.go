package services

import (
	"database/sql"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

// MeetingService handles meeting-related operations
type MeetingService struct {
	db              *sql.DB
	calendarService *CalendarService
	roomGenerator   *RoomNameGenerator
}

// RoomNameGenerator provides methods for generating consistent room names
type RoomNameGenerator struct{}

// NewRoomNameGenerator creates a new room name generator
func NewRoomNameGenerator() *RoomNameGenerator {
	return &RoomNameGenerator{}
}

// GenerateRoomName generates a consistent room name for a meeting
func (g *RoomNameGenerator) GenerateRoomName(chamaID, meetingID string) string {
	// Clean the IDs to ensure they're safe for room names
	cleanChamaID := g.cleanID(chamaID)
	cleanMeetingID := g.cleanID(meetingID)

	roomName := fmt.Sprintf("chama_%s_meeting_%s", cleanChamaID, cleanMeetingID)

	// Ensure the room name is valid (alphanumeric, hyphens, underscores only)
	return g.sanitizeRoomName(roomName)
}

// cleanID removes special characters and keeps only alphanumeric and safe characters
func (g *RoomNameGenerator) cleanID(id string) string {
	// Remove common prefixes
	id = strings.TrimPrefix(id, "meeting-")
	id = strings.TrimPrefix(id, "chama-")

	// Keep only alphanumeric characters and hyphens
	reg := regexp.MustCompile(`[^a-zA-Z0-9\-]`)
	cleaned := reg.ReplaceAllString(id, "")

	// Remove consecutive hyphens
	reg = regexp.MustCompile(`-+`)
	cleaned = reg.ReplaceAllString(cleaned, "-")

	// Trim hyphens from start and end
	cleaned = strings.Trim(cleaned, "-")

	return cleaned
}

// sanitizeRoomName ensures the room name meets standard requirements for video conferencing
func (g *RoomNameGenerator) sanitizeRoomName(roomName string) string {
	// Room names should be alphanumeric with underscores and hyphens
	reg := regexp.MustCompile(`[^a-zA-Z0-9_\-]`)
	sanitized := reg.ReplaceAllString(roomName, "_")

	// Remove consecutive underscores
	reg = regexp.MustCompile(`_+`)
	sanitized = reg.ReplaceAllString(sanitized, "_")

	// Trim underscores from start and end
	sanitized = strings.Trim(sanitized, "_-")

	// Ensure minimum length
	if len(sanitized) < 3 {
		sanitized = sanitized + "_room"
	}

	// Ensure maximum length
	if len(sanitized) > 63 {
		sanitized = sanitized[:63]
	}

	return sanitized
}

// NewMeetingService creates a new meeting service instance
func NewMeetingService(db *sql.DB, calendarService *CalendarService) *MeetingService {
	return &MeetingService{
		db:              db,
		calendarService: calendarService,
		roomGenerator:   NewRoomNameGenerator(),
	}
}

// Meeting represents a meeting
type Meeting struct {
	ID               string     `json:"id"`
	ChamaID          string     `json:"chamaId"`
	Title            string     `json:"title"`
	Description      string     `json:"description"`
	ScheduledAt      time.Time  `json:"scheduledAt"`
	Duration         int        `json:"duration"`
	Location         string     `json:"location"`
	MeetingURL       string     `json:"meetingUrl"`
	MeetingType      string     `json:"meetingType"`
	RoomName         string     `json:"roomName"`
	Status           string     `json:"status"`
	StartedAt        *time.Time `json:"startedAt"`
	EndedAt          *time.Time `json:"endedAt"`
	RecordingEnabled bool       `json:"recordingEnabled"`
	RecordingURL     *string    `json:"recordingUrl"`
	TranscriptURL    *string    `json:"transcriptUrl"`
	CreatedBy        string     `json:"createdBy"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

// MeetingAttendance represents attendance tracking
type MeetingAttendance struct {
	ID              string         `json:"id"`
	MeetingID       string         `json:"meetingId"`
	UserID          string         `json:"userId"`
	AttendanceType  string         `json:"attendanceType"`
	JoinedAt        *time.Time     `json:"joinedAt"`
	LeftAt          *time.Time     `json:"leftAt"`
	DurationMinutes int            `json:"durationMinutes"`
	IsPresent       bool           `json:"isPresent"`
	Notes           sql.NullString `json:"-"`     // Exclude from JSON, use custom marshaling
	NotesString     string         `json:"notes"` // For JSON serialization
	CreatedAt       time.Time      `json:"createdAt"`
	UpdatedAt       time.Time      `json:"updatedAt"`
}

// GetNotes returns the notes as a string (empty if NULL)
func (ma *MeetingAttendance) GetNotes() string {
	if ma.Notes.Valid {
		return ma.Notes.String
	}
	return ""
}

// SetNotes sets the notes field properly
func (ma *MeetingAttendance) SetNotes(notes string) {
	if notes == "" {
		ma.Notes = sql.NullString{Valid: false}
	} else {
		ma.Notes = sql.NullString{String: notes, Valid: true}
	}
	ma.NotesString = notes
}

// CreateVirtualMeeting creates a new virtual meeting
func (s *MeetingService) CreateVirtualMeeting(meeting *Meeting) error {
	// Generate unique room name using the room generator
	roomName := s.roomGenerator.GenerateRoomName(meeting.ChamaID, meeting.ID)
	meeting.RoomName = roomName

	log.Printf("Generated room name for meeting %s: %s", meeting.ID, roomName)

	// Save meeting to database
	query := `
		INSERT INTO meetings (
			id, chama_id, title, description, scheduled_at, duration, location,
			meeting_url, meeting_type, room_name,
			status, recording_enabled, created_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`

	_, err := s.db.Exec(query,
		meeting.ID, meeting.ChamaID, meeting.Title, meeting.Description,
		meeting.ScheduledAt, meeting.Duration, meeting.Location,
		meeting.MeetingURL, meeting.MeetingType, meeting.RoomName,
		meeting.Status, meeting.RecordingEnabled,
		meeting.CreatedBy,
	)
	if err != nil {
		return fmt.Errorf("failed to save meeting: %w", err)
	}

	log.Printf("Created meeting: %s with room: %s", meeting.ID, meeting.RoomName)
	return nil
}

// CreateMeetingWithCalendar creates a new meeting with Google Calendar integration
func (s *MeetingService) CreateMeetingWithCalendar(meeting *Meeting, attendeeEmails []string, calendarID string) error {
	// First create the virtual meeting
	err := s.CreateVirtualMeeting(meeting)
	if err != nil {
		return err
	}

	// Create Google Calendar event if calendar service is available
	if s.calendarService != nil && calendarID != "" && len(attendeeEmails) > 0 {
		calendarEvent, err := s.calendarService.CreateMeetingEvent(calendarID, meeting, attendeeEmails)
		if err != nil {
			// Log error but don't fail the meeting creation
			log.Printf("Failed to create calendar event: %v", err)
		} else {
			log.Printf("Created calendar event: %s for meeting: %s", calendarEvent.Id, meeting.ID)
		}
	}

	return nil
}

// StartMeeting starts a meeting and updates its status
func (s *MeetingService) StartMeeting(meetingID string) error {
	now := time.Now()

	// Get current status first
	meeting, err := s.GetMeeting(meetingID)
	if err != nil {
		return fmt.Errorf("failed to get meeting: %w", err)
	}

	status := strings.ToLower(meeting.Status)
	if status == "ended" || status == "completed" {
		// Treat as idempotent success: starting an already ended meeting is a no-op
		log.Printf("Meeting %s already ended; start request treated as no-op", meetingID)
		return nil
	}
	if status == "active" || status == "in_progress" {
		log.Printf("Meeting %s already active", meetingID)
		return nil
	}

	query := `
		UPDATE meetings 
		SET status = 'active', started_at = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`

	result, err := s.db.Exec(query, now, meetingID)
	if err != nil {
		return fmt.Errorf("failed to start meeting: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("meeting not found")
	}

	log.Printf("Started meeting: %s", meetingID)
	return nil
}

// EndMeeting ends a meeting and updates its status
func (s *MeetingService) EndMeeting(meetingID string) error {
	now := time.Now()

	// Get meeting details first
	meeting, err := s.GetMeeting(meetingID)
	if err != nil {
		return fmt.Errorf("failed to get meeting: %w", err)
	}

	// If already ended, treat as success
	if strings.ToLower(meeting.Status) == "ended" || strings.ToLower(meeting.Status) == "completed" {
		return nil
	}

	// Update meeting status regardless of current (as long as it exists)
	query := `
		UPDATE meetings 
		SET status = 'ended', ended_at = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`

	result, err := s.db.Exec(query, now, meetingID)
	if err != nil {
		return fmt.Errorf("failed to end meeting: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("meeting not found")
	}

	// No LiveKit room to delete

	log.Printf("Ended meeting: %s", meetingID)
	return nil
}

// GetMeeting retrieves a meeting by ID
func (s *MeetingService) GetMeeting(meetingID string) (*Meeting, error) {
	log.Printf("Attempting to get meeting with ID: %s", meetingID)

	query := `
		SELECT id, chama_id, title, description, scheduled_at, duration, location,
			   meeting_url, meeting_type, room_name,
			   status, started_at, ended_at, recording_enabled, recording_url,
			   transcript_url, created_by, created_at, updated_at
		FROM meetings
		WHERE id = $1
	`

	row := s.db.QueryRow(query, meetingID)

	meeting := &Meeting{}
	var startedAt, endedAt sql.NullTime
	var recordingURL, transcriptURL, roomName sql.NullString

	err := row.Scan(
		&meeting.ID, &meeting.ChamaID, &meeting.Title, &meeting.Description,
		&meeting.ScheduledAt, &meeting.Duration, &meeting.Location,
		&meeting.MeetingURL, &meeting.MeetingType, &roomName,
		&meeting.Status, &startedAt, &endedAt,
		&meeting.RecordingEnabled, &recordingURL, &transcriptURL,
		&meeting.CreatedBy, &meeting.CreatedAt, &meeting.UpdatedAt,
	)
	if err != nil {
		log.Printf("Error scanning meeting %s: %v", meetingID, err)
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("meeting not found")
		}
		return nil, fmt.Errorf("failed to get meeting: %w", err)
	}

	log.Printf("Successfully retrieved meeting %s: type=%s, title=%s", meetingID, meeting.MeetingType, meeting.Title)

	if startedAt.Valid {
		meeting.StartedAt = &startedAt.Time
	}
	if endedAt.Valid {
		meeting.EndedAt = &endedAt.Time
	}

	// Handle nullable string fields
	if recordingURL.Valid {
		meeting.RecordingURL = &recordingURL.String
	}
	if transcriptURL.Valid {
		meeting.TranscriptURL = &transcriptURL.String
	}
	if roomName.Valid {
		meeting.RoomName = roomName.String
	}

	return meeting, nil
}

// GenerateJoinToken generates an access token for a user to join a meeting
func (s *MeetingService) GenerateJoinToken(meetingID, userID, userRole string) (string, error) {
	meeting, err := s.GetMeeting(meetingID)
	if err != nil {
		return "", err
	}

	if meeting.RoomName == "" {
		return "", fmt.Errorf("meeting does not have a room")
	}

	// Generate participant name (you might want to get actual user name from database)
	participantName := fmt.Sprintf("user_%s", userID)
	_ = participantName // Mark as used to avoid compiler warning

	// For now, return a simple token - this can be replaced with JWT or other auth mechanism
	token := fmt.Sprintf("token_%s_%s_%s", meetingID, userID, userRole)

	return token, nil
}

// GeneratePreviewToken generates a special preview token for chairpersons and secretaries
func (s *MeetingService) GeneratePreviewToken(meetingID, userID, userRole string) (string, error) {
	meeting, err := s.GetMeeting(meetingID)
	if err != nil {
		return "", err
	}

	// Only allow chairpersons and secretaries to preview
	if userRole != "chairperson" && userRole != "secretary" {
		return "", fmt.Errorf("only chairpersons and secretaries can preview meetings")
	}

	// For physical meetings, we don't need tokens
	if meeting.MeetingType == "physical" {
		return "", fmt.Errorf("physical meetings do not require tokens")
	}

	if meeting.RoomName == "" {
		return "", fmt.Errorf("meeting does not have a room")
	}

	// Generate preview token with admin privileges
	token := fmt.Sprintf("preview_token_%s_%s_%s", meetingID, userID, userRole)

	log.Printf("Generated preview token for user %s (role: %s) in meeting %s", userID, userRole, meetingID)
	return token, nil
}

// GetMeetingPreviewInfo returns information needed for meeting preview
func (s *MeetingService) GetMeetingPreviewInfo(meetingID, userID, userRole string) (map[string]interface{}, error) {
	// Only allow chairpersons, secretaries, and treasurers to preview
	if userRole != "chairperson" && userRole != "secretary" && userRole != "treasurer" {
		return nil, fmt.Errorf("only chairpersons, secretaries, and treasurers can preview meetings")
	}

	meeting, err := s.GetMeeting(meetingID)
	if err != nil {
		return nil, err
	}

	previewInfo := map[string]interface{}{
		"meeting":   meeting,
		"isPreview": true,
		"userRole":  userRole,
		"canRecord": userRole == "chairperson",
		"canMute":   true,
		"canKick":   userRole == "chairperson",
	}

	// Handle different meeting types
	switch meeting.MeetingType {
	case "virtual", "hybrid":
		// For virtual/hybrid meetings, check if room exists
		if meeting.RoomName == "" {
			// Create room on-demand for preview using room generator
			roomName := s.roomGenerator.GenerateRoomName(meeting.ChamaID, meeting.ID)
			log.Printf("Generating room name for preview: %s", roomName)

			// Update meeting with room info
			meeting.RoomName = roomName

			// Update database with room info
			updateQuery := `
				UPDATE meetings
				SET room_name = $1, updated_at = CURRENT_TIMESTAMP
				WHERE id = $2
			`
			_, err = s.db.Exec(updateQuery, roomName, meeting.ID)
			if err != nil {
				log.Printf("Warning: Failed to update meeting with room info: %v", err)
			}

			// Generate preview token using the room name directly
			token := fmt.Sprintf("preview_token_%s_%s_%s", meeting.ID, userID, userRole)

			previewInfo["accessToken"] = token
			previewInfo["roomName"] = meeting.RoomName
			previewInfo["meetingType"] = "virtual"
		} else {
			// Room already exists
			// Generate preview token using the existing room name
			token := fmt.Sprintf("preview_token_%s_%s_%s", meeting.ID, userID, userRole)

			previewInfo["accessToken"] = token
			previewInfo["roomName"] = meeting.RoomName
			previewInfo["meetingType"] = "virtual"
		}

	case "physical":
		// For physical meetings, provide location and setup info
		previewInfo["meetingType"] = "physical"
		previewInfo["location"] = meeting.Location
		previewInfo["previewMessage"] = "This is a physical meeting. Use this preview to review meeting details and prepare for the session."
		previewInfo["setupInstructions"] = []string{
			"Ensure the meeting venue is properly set up",
			"Check that all necessary materials are available",
			"Verify attendance tracking is ready",
			"Prepare meeting agenda and documents",
		}

	default:
		return nil, fmt.Errorf("unsupported meeting type: %s", meeting.MeetingType)
	}

	return previewInfo, nil
}

// MarkAttendance marks a user's attendance for a meeting
func (s *MeetingService) MarkAttendance(meetingID, userID, attendanceType string, isPresent bool) error {
	now := time.Now()

	// Try to get existing attendance to preserve ID if it exists
	var existingID string
	err := s.db.QueryRow("SELECT id FROM meeting_attendance WHERE meeting_id = $1 AND user_id = $2", meetingID, userID).Scan(&existingID)
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("failed to check existing attendance: %w", err)
	}

	attendanceID := existingID
	if attendanceID == "" {
		attendanceID = uuid.New().String()
	}

	query := `
		INSERT INTO meeting_attendance (
			id, meeting_id, user_id, attendance_type, joined_at, is_present,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (meeting_id, user_id) DO UPDATE SET
			attendance_type = $4,
			joined_at = $5,
			is_present = $6,
			updated_at = CURRENT_TIMESTAMP
	`

	_, err = s.db.Exec(query, attendanceID, meetingID, userID, attendanceType, now, isPresent)
	if err != nil {
		return fmt.Errorf("failed to mark attendance: %w", err)
	}

	log.Printf("Marked attendance for user %s in meeting %s", userID, meetingID)
	return nil
}

// GetMeetingAttendance retrieves attendance records for a meeting
func (s *MeetingService) GetMeetingAttendance(meetingID string) ([]*MeetingAttendance, error) {
	query := `
		SELECT id, meeting_id, user_id, attendance_type, joined_at, left_at,
			   duration_minutes, is_present, notes, created_at, updated_at
		FROM meeting_attendance
		WHERE meeting_id = $1
		ORDER BY joined_at DESC
	`

	rows, err := s.db.Query(query, meetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get meeting attendance: %w", err)
	}
	defer rows.Close()

	var attendances []*MeetingAttendance

	for rows.Next() {
		attendance := &MeetingAttendance{}
		var joinedAt, leftAt sql.NullTime

		err := rows.Scan(
			&attendance.ID, &attendance.MeetingID, &attendance.UserID,
			&attendance.AttendanceType, &joinedAt, &leftAt,
			&attendance.DurationMinutes, &attendance.IsPresent, &attendance.Notes,
			&attendance.CreatedAt, &attendance.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan attendance: %w", err)
		}

		if joinedAt.Valid {
			attendance.JoinedAt = &joinedAt.Time
		}
		if leftAt.Valid {
			attendance.LeftAt = &leftAt.Time
		}

		// Set the NotesString field for JSON serialization
		attendance.NotesString = attendance.GetNotes()

		attendances = append(attendances, attendance)
	}

	return attendances, nil
}

// EnsureVirtualMeetingsHaveRoomNames ensures all virtual meetings have proper room names
func (s *MeetingService) EnsureVirtualMeetingsHaveRoomNames() error {
	log.Printf("Ensuring all virtual meetings have room names...")

	// Find all virtual/hybrid meetings without room names
	query := `
		SELECT id, chama_id, title, meeting_type
		FROM meetings
		WHERE (meeting_type = 'virtual' OR meeting_type = 'hybrid')
		AND (room_name IS NULL OR room_name = '')
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return fmt.Errorf("failed to query meetings without room names: %w", err)
	}
	defer rows.Close()

	updateCount := 0
	for rows.Next() {
		var meetingID, chamaID, title, meetingType string
		err := rows.Scan(&meetingID, &chamaID, &title, &meetingType)
		if err != nil {
			log.Printf("Error scanning meeting: %v", err)
			continue
		}

		// Generate room name
		roomName := s.roomGenerator.GenerateRoomName(chamaID, meetingID)

		// Update the meeting with the room name
		updateQuery := `
			UPDATE meetings
			SET room_name = $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2
		`

		_, err = s.db.Exec(updateQuery, roomName, meetingID)
		if err != nil {
			log.Printf("Failed to update room name for meeting %s: %v", meetingID, err)
			continue
		}

		log.Printf("Updated meeting %s (%s) with room name: %s", meetingID, title, roomName)
		updateCount++
	}

	log.Printf("Updated %d meetings with room names", updateCount)
	return nil
}
