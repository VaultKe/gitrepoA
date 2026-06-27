package models

import (
	"time"
)

type MerryGoRound struct {
	ID              string     `json:"id" db:"id"`
	ChamaID         string     `json:"chamaId" db:"chama_id"`
	Name            string     `json:"name" db:"name"`
	ContributionAmount float64  `json:"contributionAmount" db:"contribution_amount"`
	Frequency       string     `json:"frequency" db:"frequency"`
	StartDate       time.Time  `json:"startDate" db:"start_date"`
	EndDate         *time.Time `json:"endDate,omitempty" db:"end_date"`
	MaxParticipants int        `json:"maxParticipants" db:"max_participants"`
	CurrentRound    int        `json:"currentRound" db:"current_round"`
	CurrentWinnerID *string    `json:"currentWinnerId,omitempty" db:"current_winner_id"`
	Status          string     `json:"status" db:"status"`
	TotalCollected  float64    `json:"totalCollected" db:"total_collected"`
	CreatedAt       time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time  `json:"updatedAt" db:"updated_at"`
}

type MGRParticipant struct {
	ID          string     `json:"id" db:"id"`
	MerryGoRoundID string  `json:"merryGoRoundId" db:"merry_go_round_id"`
	UserID      string     `json:"userId" db:"user_id"`
	ChamaID     string     `json:"chamaId" db:"chama_id"`
	MemberID    string     `json:"memberId" db:"member_id"`
	Position    int        `json:"position" db:"position"`
	HasReceived bool       `json:"hasReceived" db:"has_received"`
	ReceivedAt  *time.Time `json:"receivedAt,omitempty" db:"received_at"`
	IsActive    bool       `json:"isActive" db:"is_active"`
	CreatedAt   time.Time  `json:"createdAt" db:"created_at"`
}