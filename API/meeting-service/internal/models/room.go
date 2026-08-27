package models

import "time"

type RoomType string
type RoomStatus string
type ParticipantRole string

const (
	RoomTypePhysical RoomType = "physical"
	RoomTypeVirtual  RoomType = "virtual"
)

const (
	RoomStatusWaiting RoomStatus = "waiting"
	RoomStatusActive  RoomStatus = "active"
	RoomStatusEnded   RoomStatus = "ended"
)

const (
	RoleHost      ParticipantRole = "host"
	RoleCoHost    ParticipantRole = "co_host"
	RoleParticipant ParticipantRole = "participant"
	RoleGuest     ParticipantRole = "guest"
)

type Room struct {
	ID               string        `json:"id" bun:"id,pk"`
	ChamaID          string        `json:"chamaId" bun:"chama_id,notnull"`
	Name             string        `json:"name" bun:"name,notnull"`
	Type             RoomType      `json:"type" bun:"type,notnull"`
	Status           RoomStatus    `json:"status" bun:"status,notnull"`
	MaxParticipants  int           `json:"maxParticipants" bun:"max_participants,notnull"`
	CreatedBy        string        `json:"createdBy" bun:"created_by,notnull"`
	CreatedAt        time.Time     `json:"createdAt" bun:"created_at,notnull"`
	EndedAt          *time.Time    `json:"endedAt,omitempty" bun:"ended_at"`
	RecordingEnabled bool          `json:"recordingEnabled" bun:"recording_enabled"`
	RecordingPath    *string       `json:"recordingPath,omitempty" bun:"recording_path"`
	Metadata         map[string]interface{} `json:"metadata,omitempty" bun:"metadata,type:jsonb"`
}

type Participant struct {
	ID              string            `json:"id" bun:"id,pk"`
	RoomID          string            `json:"roomId" bun:"room_id,notnull"`
	UserID          string            `json:"userId" bun:"user_id,notnull"`
	DisplayName     string            `json:"displayName" bun:"display_name,notnull"`
	Role            ParticipantRole   `json:"role" bun:"role,notnull"`
	IsMuted         bool              `json:"isMuted" bun:"is_muted"`
	IsVideoOn       bool              `json:"isVideoOn" bun:"is_video_on"`
	IsScreenSharing bool              `json:"isScreenSharing" bun:"is_screen_sharing"`
	JoinedAt        time.Time         `json:"joinedAt" bun:"joined_at,notnull"`
	LeftAt          *time.Time        `json:"leftAt,omitempty" bun:"left_at"`
	Metadata        map[string]interface{} `json:"metadata,omitempty" bun:"metadata,type:jsonb"`
}

type WebRTCSession struct {
	ID                string            `json:"id" bun:"id,pk"`
	RoomID            string            `json:"roomId" bun:"room_id,notnull"`
	UserID            string            `json:"userId" bun:"user_id,notnull"`
	ParticipantID     string            `json:"participantId" bun:"participant_id,notnull"`
	ConnectionID      string            `json:"connectionId" bun:"connection_id,notnull"`
	State             string            `json:"state" bun:"state,notnull"`
	ICEConnectionState string           `json:"iceConnectionState" bun:"ice_connection_state"`
	SignalingState    string            `json:"signalingState" bun:"signaling_state"`
	CreatedAt         time.Time         `json:"createdAt" bun:"created_at,notnull"`
	EndedAt           *time.Time        `json:"endedAt,omitempty" bun:"ended_at"`
	Metadata          map[string]interface{} `json:"metadata,omitempty" bun:"metadata,type:jsonb"`
}

type RoomChatMessage struct {
	ID          string    `json:"id" bun:"id,pk"`
	RoomID      string    `json:"roomId" bun:"room_id,notnull"`
	UserID      string    `json:"userId" bun:"user_id,notnull"`
	Content     string    `json:"content" bun:"content,notnull"`
	MessageType string    `json:"messageType" bun:"message_type"`
	CreatedAt   time.Time `json:"createdAt" bun:"created_at,notnull"`
}
