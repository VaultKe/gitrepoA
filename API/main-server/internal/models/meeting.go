package models

import (
	"time"
)

type Meeting struct {
	ID          string     `json:"id" db:"id"`
	ChamaID     string     `json:"chamaId" db:"chama_id"`
	Title       string     `json:"title" db:"title"`
	Description *string    `json:"description,omitempty" db:"description"`
	Type        string     `json:"meetingType" db:"meeting_type"`
	Location    *string    `json:"location,omitempty" db:"location"`
	MeetingLink *string    `json:"meetingLink,omitempty" db:"meeting_link"`
	ScheduledAt time.Time  `json:"scheduledAt" db:"scheduled_at"`
	Duration    int        `json:"duration" db:"duration"`
	Status      string     `json:"status" db:"status"`
	CreatedBy   string     `json:"createdBy" db:"created_by"`
	CreatedAt   time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time  `json:"updatedAt,omitempty" db:"updated_at"`
}

type MeetingAttendance struct {
	ID              string     `json:"id" db:"id"`
	MeetingID       string     `json:"meetingId" db:"meeting_id"`
	UserID          string     `json:"userId" db:"user_id"`
	AttendanceType  string     `json:"attendanceType" db:"attendance_type"`
	IsPresent       bool       `json:"isPresent" db:"is_present"`
	Notes           *string    `json:"notes,omitempty" db:"notes"`
	JoinedAt        *time.Time `json:"joinedAt,omitempty" db:"joined_at"`
	LeftAt          *time.Time `json:"leftAt,omitempty" db:"left_at"`
	DurationMinutes int        `json:"durationMinutes" db:"duration_minutes"`
	CreatedAt       time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time  `json:"updatedAt" db:"updated_at"`
}

type MeetingDocument struct {
	ID        string    `json:"id" db:"id"`
	MeetingID string    `json:"meetingId" db:"meeting_id"`
	ChamaID   string    `json:"chamaId" db:"chama_id"`
	Name      string    `json:"name" db:"name"`
	FileURL   string    `json:"fileUrl" db:"file_url"`
	FileType  string    `json:"fileType" db:"file_type"`
	UploadedBy string   `json:"uploadedBy" db:"uploaded_by"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

type MeetingMinute struct {
	ID        string    `json:"id" db:"id"`
	MeetingID string    `json:"meetingId" db:"meeting_id"`
	ChamaID   string    `json:"chamaId" db:"chama_id"`
	Content   string    `json:"content" db:"content"`
	Approved  bool      `json:"approved" db:"approved"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}