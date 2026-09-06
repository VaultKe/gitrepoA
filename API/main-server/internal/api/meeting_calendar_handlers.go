package api

import (
	"database/sql"

	"vaultke-backend/internal/services"
)

// meetingService is shared with meeting_attendance_handlers.go (MarkAttendance,
// GetMeetingAttendance) -- initialized here since this was originally the
// "meeting calendar" handlers file, but it now has no calendar handlers of
// its own. Google Calendar integration for meetings was removed: connecting
// a Google account was too much friction for what it bought (an optional
// reminder), and both handlers depended on a meetings.meeting_link DB column
// that never actually existed, so the feature never worked in the first
// place.
var meetingService *services.MeetingService

func InitializeMeetingService(db *sql.DB, notificationService *services.NotificationService) {
	meetingService = services.NewMeetingService(db, nil)
}
