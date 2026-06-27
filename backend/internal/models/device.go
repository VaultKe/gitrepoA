package models

import (
	"time"
)

type Device struct {
	ID         string    `json:"id" db:"id"`
	UserID     string    `json:"userId" db:"user_id"`
	DeviceName string    `json:"deviceName" db:"device_name"`
	DeviceType string    `json:"deviceType" db:"device_type"`
	Token      string    `json:"token" db:"token"`
	IsActive   bool      `json:"isActive" db:"is_active"`
	LastLogin  time.Time `json:"lastLogin" db:"last_login"`
	CreatedAt  time.Time `json:"createdAt" db:"created_at"`
}