package models

import (
	"time"
)

// Device represents a registered device for a user
type Device struct {
	ID           string    `json:"id" db:"id"`
	UserID       string    `json:"userId" db:"user_id"`
	DeviceID     int       `json:"deviceId" db:"device_id"`
	DeviceName   string    `json:"deviceName" db:"device_name"`
	DeviceType   string    `json:"deviceType" db:"device_type"`
	Token        string    `json:"token" db:"token"`
	IsActive     bool      `json:"isActive" db:"is_active"`
	LastLogin    time.Time `json:"lastLogin" db:"last_login"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
	IPAddress    string    `json:"ipAddress" db:"ip_address"`
	OSVersion    string    `json:"osVersion" db:"os_version"`
	AppVersion   string    `json:"appVersion" db:"app_version"`
	Manufacturer string    `json:"manufacturer" db:"manufacturer"`
	Model        string    `json:"model" db:"model"`
	Locale       string    `json:"locale" db:"locale"`
	Timezone     string    `json:"timezone" db:"timezone"`
	LastSeen     time.Time `json:"lastSeen" db:"last_seen"`
}