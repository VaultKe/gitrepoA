package models

import (
	"time"
)

type RoomType string

const (
	RoomTypePhysical RoomType = "physical"
	RoomTypeVirtual  RoomType = "virtual"
)

type RoomStatus string

const (
	RoomStatusWaiting RoomStatus = "waiting"
	RoomStatusActive  RoomStatus = "active"
	RoomStatusEnded   RoomStatus = "ended"
)

type ParticipantRole string

const (
	ParticipantRoleHost       ParticipantRole = "host"
	ParticipantRoleCoHost     ParticipantRole = "co_host"
	ParticipantRoleParticipant ParticipantRole = "participant"
	ParticipantRoleGuest      ParticipantRole = "guest"
)

type Room struct {
	ID              string    `json:"id" db:"id"`
	ChamaID         string    `json:"chamaId" db:"chama_id"`
	Name            string    `json:"name" db:"name"`
	Type            RoomType  `json:"type" db:"type"`
	Status          RoomStatus `json:"status" db:"status"`
	MaxParticipants int       `json:"maxParticipants" db:"max_participants"`
	CreatedBy       string    `json:"createdBy" db:"created_by"`
	CreatedAt       time.Time `json:"createdAt" db:"created_at"`
	EndedAt         *time.Time `json:"endedAt,omitempty" db:"ended_at"`
	RecordingEnabled bool      `json:"recordingEnabled" db:"recording_enabled"`
}

type Participant struct {
	ID           string        `json:"id" db:"id"`
	RoomID       string        `json:"roomId" db:"room_id"`
	UserID       string        `json:"userId" db:"user_id"`
	DisplayName  string        `json:"displayName" db:"display_name"`
	Role         ParticipantRole `json:"role" db:"role"`
	IsMuted      bool          `json:"isMuted" db:"is_muted"`
	IsVideoOn    bool          `json:"isVideoOn" db:"is_video_on"`
	IsScreenSharing bool       `json:"isScreenSharing" db:"is_screen_sharing"`
	JoinedAt     time.Time     `json:"joinedAt" db:"joined_at"`
	LeftAt       *time.Time    `json:"leftAt,omitempty" db:"left_at"`
}

type WebRTCSession struct {
	ID           string    `json:"id" db:"id"`
	RoomID       string    `json:"roomId" db:"room_id"`
	UserID       string    `json:"userId" db:"user_id"`
	SDPOffer     string    `json:"sdpOffer" db:"sdp_offer"`
	SDPAnswer    string    `json:"sdpAnswer,omitempty" db:"sdp_answer"`
	ICECandidates []string `json:"iceCandidates" db:"ice_candidates"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
}

type RoomChatMessage struct {
	ID          string    `json:"id" db:"id"`
	RoomID      string    `json:"roomId" db:"room_id"`
	UserID      string    `json:"userId" db:"user_id"`
	Content     string    `json:"content" db:"content"`
	MessageType string    `json:"messageType" db:"message_type"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
}