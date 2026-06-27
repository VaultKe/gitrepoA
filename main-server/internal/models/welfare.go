package models

import (
	"time"
)

type WelfareFund struct {
	ID               string  `json:"id" db:"id"`
	ChamaID          string  `json:"chamaId" db:"chama_id"`
	Name             string  `json:"name" db:"name"`
	Description      *string `json:"description,omitempty" db:"description"`
	Balance          float64 `json:"balance" db:"balance"`
	Currency         string  `json:"currency" db:"currency"`
	ContributionAmount float64 `json:"contributionAmount" db:"contribution_amount"`
	IsActive         bool    `json:"isActive" db:"is_active"`
	CreatedAt        time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt        time.Time `json:"updatedAt" db:"updated_at"`
}

type WelfareContribution struct {
	ID             string          `json:"id" db:"id"`
	WelfareFundID  string          `json:"welfareFundId" db:"welfare_fund_id"`
	UserID         string          `json:"userId" db:"user_id"`
	ChamaID        string          `json:"chamaId" db:"chama_id"`
	MemberID       string          `json:"memberId" db:"member_id"`
	Amount         float64         `json:"amount" db:"amount"`
	PaymentMethod  string          `json:"paymentMethod" db:"payment_method"`
	Reference      *string         `json:"reference,omitempty" db:"reference"`
	Status         TransactionStatus `json:"status" db:"status"`
	CreatedAt      time.Time       `json:"createdAt" db:"created_at"`
}

type WelfareRequest struct {
	ID           string     `json:"id" db:"id"`
	WelfareFundID string    `json:"welfareFundId" db:"welfare_fund_id"`
	UserID       string     `json:"userId" db:"user_id"`
	ChamaID      string     `json:"chamaId" db:"chama_id"`
	MemberID     string     `json:"memberId" db:"member_id"`
	Amount       float64    `json:"amount" db:"amount"`
	Reason       string     `json:"reason" db:"reason"`
	Status       string     `json:"status" db:"status"`
	ApprovedBy   *string    `json:"approvedBy,omitempty" db:"approved_by"`
	ApprovedAt   *time.Time `json:"approvedAt,omitempty" db:"approved_at"`
	DisbursedAt  *time.Time `json:"disbursedAt,omitempty" db:"disbursedAt"`
	CreatedAt    time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time  `json:"updatedAt" db:"updated_at"`
}