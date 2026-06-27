package models

import (
	"time"
)

type E2EEKeyBundle struct {
	ID                string    `json:"id" db:"id"`
	UserID            string    `json:"userId" db:"user_id"`
	DeviceID          string    `json:"deviceId" db:"device_id"`
	IdentityKeyPublic string    `json:"identityKeyPublic" db:"identity_key_public"`
	SignedPreKeyID    int       `json:"signedPreKeyId" db:"signed_pre_key_id"`
	SignedPreKeyPublic string   `json:"signedPreKeyPublic" db:"signed_pre_key_public"`
	PreKeyID          *int      `json:"preKeyId,omitempty" db:"pre_key_id"`
	PreKeyPublic      *string   `json:"preKeyPublic,omitempty" db:"pre_key_public"`
	CreatedAt         time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt         time.Time `json:"updatedAt" db:"updated_at"`
}

type E2EESession struct {
	ID               string     `json:"id" db:"id"`
	UserID           string     `json:"userId" db:"user_id"`
	DeviceID         string     `json:"deviceId" db:"device_id"`
	SessionID        string     `json:"sessionId" db:"session_id"`
	Index            *int       `json:"index,omitempty" db:"index"`
	CurrentRatchetKey string    `json:"currentRatchetKey" db:"current_ratchet_key"`
	CreatedAt        time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt        time.Time  `json:"updatedAt" db:"updated_at"`
}