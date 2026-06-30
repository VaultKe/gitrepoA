package services

import (
	"database/sql"
	"fmt"
	"time"

	"vaultke-backend/internal/models"
)

// MeetingService handles physical meeting operations
type MeetingService struct {
	db *sql.DB
}

// NewMeetingService creates a new meeting service
func NewMeetingService(db *sql.DB, _ *CalendarService) *MeetingService {
	return &MeetingService{db: db}
}

// GetMeeting retrieves a meeting by ID
func (s *MeetingService) GetMeeting(meetingID string) (*models.Meeting, error) {
	query := `
		SELECT id, chama_id, title, description, type, location, meeting_link,
			   scheduled_at, duration, status, created_by, created_at, updated_at
		FROM meetings
		WHERE id = $1
	`
	row := s.db.QueryRow(query, meetingID)

	var meeting models.Meeting

	err := row.Scan(
		&meeting.ID, &meeting.ChamaID, &meeting.Title, &meeting.Description,
		&meeting.Type, &meeting.Location, &meeting.MeetingLink,
		&meeting.ScheduledAt, &meeting.Duration, &meeting.Status,
		&meeting.CreatedBy, &meeting.CreatedAt, &meeting.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("meeting not found")
		}
		return nil, fmt.Errorf("failed to get meeting: %w", err)
	}

	return &meeting, nil
}

// MarkAttendance marks a user's attendance for a meeting
func (s *MeetingService) MarkAttendance(meetingID, userID, attendanceType string, isPresent bool) error {
	query := `
		INSERT INTO meeting_attendance (id, meeting_id, user_id, attendance_type, is_present, notes, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (meeting_id, user_id)
		DO UPDATE SET is_present = EXCLUDED.is_present, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at
	`

	notes := ""
	if !isPresent {
		notes = "Absent"
	}

	_, err := s.db.Exec(query, fmt.Sprintf("att_%s_%s", meetingID, userID), meetingID, userID, attendanceType, isPresent, notes, time.Now(), time.Now())
	if err != nil {
		return fmt.Errorf("failed to mark attendance: %w", err)
	}

	return nil
}

// GetMeetingAttendance retrieves attendance records for a meeting
func (s *MeetingService) GetMeetingAttendance(meetingID string) ([]*models.MeetingAttendance, error) {
	query := `
		SELECT ma.id, ma.meeting_id, ma.user_id, ma.attendance_type, ma.is_present, ma.notes, ma.joined_at, ma.left_at, ma.duration_minutes, ma.created_at, ma.updated_at
		FROM meeting_attendance ma
		WHERE ma.meeting_id = $1
		ORDER BY ma.created_at DESC
	`

	rows, err := s.db.Query(query, meetingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get attendance: %w", err)
	}
	defer rows.Close()

	var attendances []*models.MeetingAttendance
	for rows.Next() {
		att := &models.MeetingAttendance{}
		err := rows.Scan(
			&att.ID, &att.MeetingID, &att.UserID, &att.AttendanceType, &att.IsPresent, &att.Notes, &att.JoinedAt, &att.LeftAt, &att.DurationMinutes, &att.CreatedAt, &att.UpdatedAt,
		)
		if err != nil {
			continue
		}
		attendances = append(attendances, att)
	}

	return attendances, nil
}
