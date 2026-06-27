package models

import (
	"time"
)

type Disbursement struct {
	ID                   string           `json:"id" db:"id"`
	BatchID              string           `json:"batchId" db:"batch_id"`
	ChamaID              string           `json:"chamaId" db:"chama_id"`
	SourceWalletID       string           `json:"sourceWalletId" db:"source_wallet_id"`
	SourceWalletType     ChamaWalletType  `json:"sourceWalletType" db:"source_wallet_type"`
	RecipientUserID      string           `json:"recipientUserId" db:"recipient_user_id"`
	RecipientPhone       string           `json:"recipientPhone" db:"recipient_phone"`
	Amount               float64          `json:"amount" db:"amount"`
	Type                 string           `json:"type" db:"type"`
	Status               string           `json:"status" db:"status"`
	MpesaReceiptNumber   *string          `json:"mpesaReceiptNumber,omitempty" db:"mpesa_receipt_number"`
	CheckoutRequestID    *string          `json:"checkoutRequestId,omitempty" db:"checkout_request_id"`
	MerchantRequestID    *string          `json:"merchantRequestId,omitempty" db:"merchant_request_id"`
	ErrorMessage         *string          `json:"errorMessage,omitempty" db:"error_message"`
	CreatedAt            time.Time        `json:"createdAt" db:"created_at"`
	UpdatedAt            time.Time        `json:"updatedAt" db:"updated_at"`
}

type DisbursementBatch struct {
	ID                   string     `json:"id" db:"id"`
	ChamaID              string     `json:"chamaId" db:"chama_id"`
	Type                 string     `json:"type" db:"type"`
	Status               string     `json:"status" db:"status"`
	TotalAmount          float64    `json:"totalAmount" db:"total_amount"`
	TotalDisbursements   int        `json:"totalDisbursements" db:"total_disbursements"`
	SuccessfulDisbursements int    `json:"successfulDisbursements" db:"successful_disbursements"`
	FailedDisbursements   int      `json:"failedDisbursements" db:"failed_disbursements"`
	ProcessedAt          *time.Time `json:"processedAt,omitempty" db:"processed_at"`
	CreatedAt            time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt            time.Time  `json:"updatedAt" db:"updated_at"`
}

type BulkDisbursement struct {
	ID              string       `json:"id" db:"id"`
	ChamaID         string       `json:"chamaId" db:"chama_id"`
	Type            string       `json:"type" db:"type"`
	Status          string       `json:"status" db:"status"`
	TotalRecipients int          `json:"totalRecipients" db:"total_recipients"`
	TotalAmount     float64      `json:"totalAmount" db:"total_amount"`
	ProcessedAt     *time.Time   `json:"processedAt,omitempty" db:"processed_at"`
	CreatedAt       time.Time    `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time    `json:"updatedAt" db:"updated_at"`
}