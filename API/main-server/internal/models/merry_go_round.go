package models

import (
	"time"
)

type MerryGoRound struct {
	ID              string     `json:"id" db:"id"`
	ChamaID         string     `json:"chamaId" db:"chama_id"`
	Name            string     `json:"name" db:"name"`
	Description     string     `json:"description" db:"description"`
	AmountPerRound  float64    `json:"amountPerRound" db:"amount_per_round"` // Renamed from ContributionAmount
	Frequency       string     `json:"frequency" db:"frequency"`
	StartDate       time.Time  `json:"startDate" db:"start_date"`
	EndDate         *time.Time `json:"endDate,omitempty" db:"end_date"`
	MaxParticipants int        `json:"maxParticipants" db:"max_participants"`
	CurrentRound    int        `json:"currentRound" db:"current_round"` // Renamed from CurrentWinnerID
	Status          string     `json:"status" db:"status"`
	TotalCollected  float64    `json:"totalCollected" db:"total_collected"`
	NextPayoutDate  *time.Time `json:"nextPayoutDate" db:"next_payout_date"`
	CreatedAt       time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time  `json:"updatedAt" db:"updated_at"`
}

// MGRParticipant represents a participant in a merry-go-round
type MGRParticipant struct {
	ID                    string     `json:"id" db:"id"`
	MerryGoRoundID        string     `json:"merryGoRoundId" db:"merry_go_round_id"`
	UserID                string     `json:"userId" db:"user_id"`
	MemberID              string     `json:"memberId" db:"member_id"` // Reference to chama_members table
	Position              int        `json:"position" db:"position"`
	HasReceived           bool       `json:"hasReceived" db:"has_received"`
	ReceivedAt            *time.Time `json:"receivedAt,omitempty" db:"received_at"`
	HasContributedThisCycle bool    `json:"hasContributedThisCycle" db:"has_contributed_this_cycle"`
	ContributedAt         *time.Time `json:"contributedAt,omitempty" db:"contributed_at"`
	TotalContributed      float64    `json:"totalContributed" db:"total_contributed"`
	JoinedAt              time.Time  `json:"joinedAt" db:"joined_at"`
}

// MGRPayment tracks individual merry-go-round payments
type MGRPayment struct {
	ID              string     `json:"id" db:"id"`
	MerryGoRoundID  string     `json:"merryGoRoundId" db:"merry_go_round_id"`
	ChamaID         string     `json:"chamaId" db:"chama_id"`
	PayerUserID     string     `json:"payerUserId" db:"payer_user_id"`    // User who made the payment
	PayeeUserID     string     `json:"payeeUserId" db:"payee_user_id"`    // User whose place is being paid (for pay_for)
	ContributorUserID string   `json:"contributorUserId" db:"contributor_user_id"` // User who contributed
	Amount          float64    `json:"amount" db:"amount"`
	RoundNumber     int        `json:"roundNumber" db:"round_number"` // Which round this payment is for
	Position        int        `json:"position" db:"position"`        // Position in the merry-go-round order
	PaymentMethod   string     `json:"paymentMethod" db:"payment_method"`
	Status          string     `json:"status" db:"status"`
	TransactionID   string     `json:"transactionId" db:"transaction_id"`
	Description     string     `json:"description" db:"description"`
	Metadata        string     `json:"metadata" db:"metadata"` // JSON metadata
	CreatedAt       time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time  `json:"updatedAt" db:"updated_at"`
}