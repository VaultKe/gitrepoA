package models

import (
	"time"
)

type ChatRoom struct {
	ID           string     `json:"id" db:"id"`
	ChamaID      *string    `json:"chamaId,omitempty" db:"chama_id"`
	Name         string     `json:"name" db:"name"`
	Type         string     `json:"type" db:"type"`
	IsPrivate    bool       `json:"isPrivate" db:"is_private"`
	CreatedBy    string     `json:"createdBy" db:"created_by"`
	IsActive     bool       `json:"isActive" db:"is_active"`
	LastMessage  *string    `json:"lastMessage,omitempty" db:"last_message"`
	LastMessageAt *time.Time `json:"lastMessageAt,omitempty" db:"last_message_at"`
	CreatedAt    time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time  `json:"updatedAt" db:"updated_at"`
}

type ChatMessage struct {
	ID           string                 `json:"id" db:"id"`
	ChatRoomID   string                 `json:"chatRoomId" db:"chat_room_id"`
	SenderID     string                 `json:"senderId" db:"sender_id"`
	Content      string                 `json:"content" db:"content"`
	MessageType  string                 `json:"messageType" db:"message_type"`
	Metadata     map[string]interface{}   `json:"metadata,omitempty" db:"metadata"`
	IsDeleted    bool                   `json:"isDeleted" db:"is_deleted"`
	ReplyToID    *string                `json:"replyToId,omitempty" db:"reply_to_id"`
	CreatedAt    time.Time              `json:"createdAt" db:"created_at"`
}

type ChatRoomMember struct {
	ID         string     `json:"id" db:"id"`
	ChatRoomID string     `json:"chatRoomId" db:"chat_room_id"`
	UserID     string     `json:"userId" db:"user_id"`
	Role       string     `json:"role" db:"role"`
	JoinedAt   time.Time  `json:"joinedAt" db:"joined_at"`
	LastReadAt *time.Time `json:"lastReadAt,omitempty" db:"last_read_at"`
	IsActive   bool       `json:"isActive" db:"is_active"`
}