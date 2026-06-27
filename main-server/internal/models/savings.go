package models

import (
	"time"
)

type SavingsAccount struct {
	ID           string  `json:"id" db:"id"`
	UserID       string  `json:"userId" db:"user_id"`
	ChamaID      string  `json:"chamaId" db:"chama_id"`
	MemberID     string  `json:"memberId" db:"member_id"`
	Balance      float64 `json:"balance" db:"balance"`
	Currency     string  `json:"currency" db:"currency"`
	InterestRate float64 `json:"interestRate" db:"interest_rate"`
	IsActive     bool    `json:"isActive" db:"is_active"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
}

type SavingsTransaction struct {
	ID             string          `json:"id" db:"id"`
	SavingsAccountID string         `json:"savingsAccountId" db:"savings_account_id"`
	Type           string          `json:"type" db:"type"`
	Amount         float64         `json:"amount" db:"amount"`
	Description    *string         `json:"description,omitempty" db:"description"`
	Reference      *string         `json:"reference,omitempty" db:"reference"`
	Status         TransactionStatus `json:"status" db:"status"`
	CreatedAt      time.Time       `json:"createdAt" db:"created_at"`
}