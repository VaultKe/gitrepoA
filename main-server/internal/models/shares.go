package models

import (
	"time"
)

type Share struct {
	ID           string    `json:"id" db:"id"`
	ChamaID      string    `json:"chamaId" db:"chama_id"`
	UserID       string    `json:"userId" db:"user_id"`
	MemberID     string    `json:"memberId" db:"member_id"`
	Quantity     int       `json:"quantity" db:"quantity"`
	TotalValue   float64   `json:"totalValue" db:"total_value"`
	PurchasePrice float64  `json:"purchasePrice" db:"purchase_price"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
}

type ShareTransaction struct {
	ID          string          `json:"id" db:"id"`
	ChamaID     string           `json:"chamaId" db:"chama_id"`
	UserID      string           `json:"userId" db:"user_id"`
	MemberID    string           `json:"memberId" db:"member_id"`
	Type        string           `json:"type" db:"type"`
	Quantity    int              `json:"quantity" db:"quantity"`
	UnitPrice   float64          `json:"unitPrice" db:"unit_price"`
	TotalAmount float64          `json:"totalAmount" db:"total_amount"`
	Status      TransactionStatus `json:"status" db:"status"`
	Reference   *string          `json:"reference,omitempty" db:"reference"`
	CreatedAt   time.Time        `json:"createdAt" db:"created_at"`
}

type ShareOffering struct {
	ID             string    `json:"id" db:"id"`
	ChamaID        string    `json:"chamaId" db:"chama_id"`
	Name           string    `json:"name" db:"name"`
	TotalShares    int       `json:"totalShares" db:"total_shares"`
	PricePerShare  float64   `json:"pricePerShare" db:"price_per_share"`
	AvailableShares int      `json:"availableShares" db:"available_shares"`
	OpenDate       time.Time `json:"openDate" db:"open_date"`
	CloseDate      time.Time `json:"closeDate" db:"close_date"`
	Status         string    `json:"status" db:"status"`
	CreatedAt      time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time `json:"updatedAt" db:"updated_at"`
}

type DividendDeclaration struct {
	ID             string     `json:"id" db:"id"`
	ChamaID        string     `json:"chamaId" db:"chama_id"`
	AmountPerShare float64     `json:"amountPerShare" db:"amount_per_share"`
	TotalAmount    float64     `json:"totalAmount" db:"total_amount"`
	PaymentDate    time.Time   `json:"paymentDate" db:"payment_date"`
	Status         string      `json:"status" db:"status"`
	Description    *string     `json:"description,omitempty" db:"description"`
	CreatedAt      time.Time   `json:"createdAt" db:"created_at"`
}

type DividendPayment struct {
	ID                  string          `json:"id" db:"id"`
	DividendDeclarationID string        `json:"dividendDeclarationId" db:"dividend_declaration_id"`
	UserID              string          `json:"userId" db:"user_id"`
	ChamaID             string          `json:"chamaId" db:"chama_id"`
	MemberID            string          `json:"memberId" db:"member_id"`
	Amount              float64         `json:"amount" db:"amount"`
	Status              TransactionStatus `json:"status" db:"status"`
	PaidAt              *time.Time      `json:"paidAt,omitempty" db:"paid_at"`
	CreatedAt           time.Time       `json:"createdAt" db:"created_at"`
}

type Dividend struct {
	ID          string     `json:"id" db:"id"`
	ChamaID     string     `json:"chamaId" db:"chama_id"`
	UserID      string     `json:"userId" db:"user_id"`
	MemberID    string     `json:"memberId" db:"member_id"`
	DeclarationID string    `json:"declarationId" db:"declaration_id"`
	Amount      float64    `json:"amount" db:"amount"`
	Status      string     `json:"status" db:"status"`
	PaidAt      *time.Time `json:"paidAt,omitempty" db:"paid_at"`
	CreatedAt   time.Time  `json:"createdAt" db:"created_at"`
}