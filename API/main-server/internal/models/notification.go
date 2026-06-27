package models

import (
	"time"
)

type Notification struct {
	ID        string                 `json:"id" db:"id"`
	UserID    string                 `json:"userId" db:"user_id"`
	ChamaID   *string                `json:"chamaId,omitempty" db:"chama_id"`
	Type      string                 `json:"type" db:"type"`
	Title     string                 `json:"title" db:"title"`
	Message   string                 `json:"message" db:"message"`
	Data      map[string]interface{} `json:"data,omitempty" db:"data"`
	IsRead    bool                   `json:"isRead" db:"is_read"`
	ReadAt    *time.Time             `json:"readAt,omitempty" db:"read_at"`
	CreatedAt time.Time              `json:"createdAt" db:"created_at"`
}

type NotificationSound struct {
	ID        string    `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	FileURL   string    `json:"fileUrl" db:"file_url"`
	IsActive  bool      `json:"isActive" db:"is_active"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

type NotificationTemplate struct {
	ID        string    `json:"id" db:"id"`
	Type      string    `json:"type" db:"type"`
	Title     string    `json:"title" db:"title"`
	Message   string    `json:"message" db:"message"`
	Variables []string  `json:"variables" db:"variables"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

type NotificationDeliveryLog struct {
	ID           string     `json:"id" db:"id"`
	NotificationID string    `json:"notificationId" db:"notification_id"`
	Channel      string     `json:"channel" db:"channel"`
	Status       string     `json:"status" db:"status"`
	ErrorMessage *string    `json:"errorMessage,omitempty" db:"error_message"`
	SentAt       *time.Time `json:"sentAt,omitempty" db:"sent_at"`
	CreatedAt    time.Time  `json:"createdAt" db:"created_at"`
}

type UserNotificationPreference struct {
	ID        string    `json:"id" db:"id"`
	UserID    string    `json:"userId" db:"user_id"`
	ChamaID   *string   `json:"chamaId,omitempty" db:"chama_id"`
	Type      string    `json:"type" db:"type"`
	Channel   string    `json:"channel" db:"channel"`
	IsEnabled bool      `json:"isEnabled" db:"is_enabled"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}