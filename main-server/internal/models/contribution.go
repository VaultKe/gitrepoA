package models

import (
	"time"
)

type Contribution struct {
	ID           string          `json:"id" db:"id"`
	ChamaID      string          `json:"chamaId" db:"chama_id"`
	UserID       string          `json:"userId" db:"user_id"`
	MemberID     string          `json:"memberId" db:"member_id"`
	Amount       float64         `json:"amount" db:"amount"`
	PaymentMethod string         `json:"paymentMethod" db:"payment_method"`
	Reference    *string         `json:"reference,omitempty" db:"reference"`
	Status       TransactionStatus `json:"status" db:"status"`
	Type         string          `json:"type" db:"type"`
	CreatedAt    time.Time       `json:"createdAt" db:"created_at"`
}