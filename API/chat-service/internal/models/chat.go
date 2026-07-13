package models

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"sort"
	"time"

	"github.com/google/uuid"
)

type ChatRoomType string

const (
	RoomTypeChama   ChatRoomType = "chama"
	RoomTypeGroup   ChatRoomType = "group"
	RoomTypePrivate ChatRoomType = "private"
)

type ChatRoom struct {
	ID            string         `json:"id" db:"id"`
	ChamaID       sql.NullString `json:"chamaId,omitempty" db:"chama_id"`
	Name          string         `json:"name" db:"name"`
	Type          ChatRoomType   `json:"type" db:"type"`
	IsPrivate     bool           `json:"isPrivate" db:"-"`
	CreatedBy     string         `json:"createdBy" db:"created_by"`
	IsActive      bool           `json:"isActive" db:"is_active"`
	LastMessage   string         `json:"lastMessage,omitempty" db:"last_message"`
	LastMessageAt time.Time      `json:"lastMessageAt,omitempty" db:"last_message_at"`
	CreatedAt     time.Time      `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time      `json:"updatedAt" db:"updated_at"`
}

func NewChatRoom(chamaID, name string, roomType ChatRoomType, createdBy string) *ChatRoom {
	now := time.Now().UTC()
	return &ChatRoom{
		ID:        uuid.New().String(),
		ChamaID:   sql.NullString{String: chamaID, Valid: chamaID != ""},
		Name:      name,
		Type:      roomType,
		IsPrivate: roomType == RoomTypePrivate,
		CreatedBy: createdBy,
		IsActive:  true,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// DeterministicPrivateRoomID returns a stable room ID for a 1:1 private chat
// between two users so the same pair always resolves to the same conversation.
// Without this, opening the same private chat from either side (or twice) would
// create two separate rooms that both show up in the chat list.
func DeterministicPrivateRoomID(userA, userB string) string {
	ids := []string{userA, userB}
	sort.Strings(ids)
	combined := ids[0] + ":" + ids[1]
	hash := sha256.Sum256([]byte(combined))
	return hex.EncodeToString(hash[:])[:16]
}

// NewPrivateRoom builds a 1:1 private room whose ID is derived from both
// participants, guaranteeing a single conversation per pair.
func NewPrivateRoom(userA, userB, name, createdBy string) *ChatRoom {
	now := time.Now().UTC()
	return &ChatRoom{
		ID:        DeterministicPrivateRoomID(userA, userB),
		Name:      name,
		Type:      RoomTypePrivate,
		IsPrivate: true,
		CreatedBy: createdBy,
		IsActive:  true,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

type MemberRole string

const (
	RoleAdmin     MemberRole = "admin"
	RoleModerator MemberRole = "moderator"
	RoleMember    MemberRole = "member"
)

type ChatRoomMember struct {
	ID         string     `json:"id" db:"id"`
	RoomID     string     `json:"roomId" db:"room_id"`
	UserID     string     `json:"userId" db:"user_id"`
	Role       MemberRole `json:"role" db:"role"`
	JoinedAt   time.Time  `json:"joinedAt" db:"joined_at"`
	LastReadAt time.Time  `json:"lastReadAt,omitempty" db:"last_read_at"`
	IsActive   bool       `json:"isActive" db:"is_active"`
}

func NewChatRoomMember(roomID, userID string, role MemberRole) *ChatRoomMember {
	return &ChatRoomMember{
		ID:       uuid.New().String(),
		RoomID:   roomID,
		UserID:   userID,
		Role:     role,
		JoinedAt: time.Now().UTC(),
		IsActive: true,
	}
}

type MessageType string

const (
	MessageTypeText  MessageType = "text"
	MessageTypeImage MessageType = "image"
	MessageTypeFile  MessageType = "file"
	MessageTypeAudio MessageType = "audio"
)

type ChatMessage struct {
	ID        string         `json:"id" db:"id"`
	RoomID    string         `json:"roomId" db:"room_id"`
	SenderID  string         `json:"senderId" db:"sender_id"`
	Content   string         `json:"content" db:"content"`
	Type      MessageType    `json:"type" db:"type"`
	Metadata  interface{}    `json:"metadata,omitempty" db:"metadata"`
	ImageUrl  string         `json:"imageUrl,omitempty" db:"image_url"`
	ImageUrls interface{}    `json:"imageUrls,omitempty" db:"image_urls"`
	IsDeleted bool           `json:"isDeleted" db:"is_deleted"`
	ReplyToID sql.NullString `json:"replyToId,omitempty" db:"reply_to_id"`
	CreatedAt time.Time      `json:"createdAt" db:"created_at"`
	EditedAt  sql.NullTime   `json:"editedAt,omitempty" db:"edited_at"`
}

func NewChatMessage(roomID, senderID, content string, msgType MessageType) *ChatMessage {
	return &ChatMessage{
		ID:        uuid.New().String(),
		RoomID:    roomID,
		SenderID:  senderID,
		Content:   content,
		Type:      msgType,
		IsDeleted: false,
		CreatedAt: time.Now().UTC(),
	}
}

type PresenceStatus string

const (
	StatusOnline  PresenceStatus = "online"
	StatusOffline PresenceStatus = "offline"
	StatusAway    PresenceStatus = "away"
)

type UserPresence struct {
	UserID        string         `json:"userId" db:"user_id"`
	Status        PresenceStatus `json:"status" db:"status"`
	LastSeen      time.Time      `json:"lastSeen" db:"last_seen"`
	CurrentRoomID sql.NullString `json:"currentRoomId,omitempty" db:"current_room_id"`
}
