package models

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// WalletType represents the type of wallet
type WalletType string

const (
	WalletTypePersonal WalletType = "personal"
	WalletTypeChama    WalletType = "chama"
	WalletTypeBusiness WalletType = "business"
)

// ChamaWalletType represents different wallet types within a chama
type ChamaWalletType string

const (
	ChamaWalletTypeMain       ChamaWalletType = "main"
	ChamaWalletTypeSavings    ChamaWalletType = "savings"
	ChamaWalletTypeWelfare    ChamaWalletType = "welfare"
	ChamaWalletTypeMerryGo    ChamaWalletType = "merry_go_round"
	ChamaWalletTypeLoan       ChamaWalletType = "loan"
	ChamaWalletTypeShares     ChamaWalletType = "shares"
	ChamaWalletTypeDividends  ChamaWalletType = "dividends"
	ChamaWalletTypeContribution ChamaWalletType = "contribution"
)

// PaybillReferencePrefix defines prefixes for different payment types
const (
	PaybillRefRegistration   = "REG"   // Registration fee
	PaybillRefSubscription   = "SUB"   // Subscription fee
	PaybillRefContribution   = "CON"   // Regular contribution
	PaybillRefSavings        = "SVG"   // Savings contribution
	PaybillRefWelfare        = "WEL"   // Welfare contribution
	PaybillRefMerryGoRound   = "MGR"   // Merry-go-round contribution
	PaybillRefLoanRepayment  = "LOANR" // Loan repayment (to chama)
	PaybillRefLoanDisbursement = "LOAND" // Loan disbursement (from chama)
	PaybillRefShares         = "SHR"   // Shares contribution
	PaybillRefDividends      = "DIV"   // Dividends payout
)

// TransactionType represents the type of transaction
type TransactionType string

const (
	TransactionTypeDeposit       TransactionType = "deposit"
	TransactionTypeWithdrawal    TransactionType = "withdrawal"
	TransactionTypeTransfer      TransactionType = "transfer"
	TransactionTypeContribution  TransactionType = "contribution"
	TransactionTypeLoan          TransactionType = "loan"
	TransactionTypeLoanRepayment TransactionType = "loan_repayment"
	TransactionTypePurchase      TransactionType = "purchase"
	TransactionTypeRefund        TransactionType = "refund"
	TransactionTypeFee           TransactionType = "fee"
)

// TransactionStatus represents the status of a transaction
type TransactionStatus string

const (
	TransactionStatusPending    TransactionStatus = "pending"
	TransactionStatusCompleted  TransactionStatus = "completed"
	TransactionStatusFailed     TransactionStatus = "failed"
	TransactionStatusCancelled  TransactionStatus = "cancelled"
	TransactionStatusProcessing TransactionStatus = "processing"
)

// PaymentMethod represents the payment method used
type PaymentMethod string

const (
	PaymentMethodMpesa          PaymentMethod = "mpesa"
	PaymentMethodBankTransfer   PaymentMethod = "bank_transfer"
	PaymentMethodCash           PaymentMethod = "cash"
	PaymentMethodWalletTransfer PaymentMethod = "wallet_transfer"
)

// Wallet represents a wallet in the system
type Wallet struct {
	ID            string              `json:"id" db:"id"`
	Type          WalletType          `json:"type" db:"type"`
	OwnerID       string              `json:"ownerId" db:"owner_id"`
	SubWalletType ChamaWalletType     `json:"subWalletType,omitempty" db:"subwallet_type"`
	ChamaID       string              `json:"chamaId,omitempty" db:"chama_id"`
	Balance       float64             `json:"balance" db:"balance"`
	Currency      string              `json:"currency" db:"currency"`
	IsActive      bool                `json:"isActive" db:"is_active"`
	IsLocked      bool                `json:"isLocked" db:"is_locked"`
	DailyLimit    *float64            `json:"dailyLimit,omitempty" db:"daily_limit"`
	MonthlyLimit  *float64            `json:"monthlyLimit,omitempty" db:"monthly_limit"`
	CreatedAt     time.Time           `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time           `json:"updatedAt" db:"updated_at"`
	MemberID      string              `json:"memberId,omitempty" db:"member_id"`
}

// Transaction represents a financial transaction
type Transaction struct {
	ID            string                 `json:"id" db:"id"`
	FromWalletID  *string                `json:"fromWalletId,omitempty" db:"from_wallet_id"`
	ToWalletID    *string                `json:"toWalletId,omitempty" db:"to_wallet_id"`
	Type          TransactionType        `json:"type" db:"type"`
	Status        TransactionStatus      `json:"status" db:"status"`
	Amount        float64                `json:"amount" db:"amount"`
	Currency      string                 `json:"currency" db:"currency"`
	Description   *string                `json:"description,omitempty" db:"description"`
	Reference     *string                `json:"reference,omitempty" db:"reference"`
	PaymentMethod PaymentMethod          `json:"paymentMethod" db:"payment_method"`
	Metadata      map[string]interface{} `json:"metadata,omitempty" db:"metadata"`
	Fees          float64                `json:"fees" db:"fees"`
	InitiatedBy   string                 `json:"initiatedBy" db:"initiated_by"`
	RecipientID   *string                `json:"recipientId,omitempty" db:"recipient_id"`
	ChamaID       string                 `json:"chamaId,omitempty" db:"chama_id"`
	SubWalletType ChamaWalletType        `json:"subWalletType,omitempty" db:"subwallet_type"`
	MemberID      string                 `json:"memberId,omitempty" db:"member_id"`
	ApprovedBy    *string                `json:"approvedBy,omitempty" db:"approved_by"`
	RequiresApproval bool               `json:"requiresApproval" db:"requires_approval"`
	ApprovalDeadline *time.Time          `json:"approvalDeadline,omitempty" db:"approval_deadline"`
	CreatedAt     time.Time              `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time              `json:"updatedAt" db:"updated_at"`
	User          *User                  `json:"user,omitempty"`
}

// TransactionCreation represents data for creating a new transaction
type TransactionCreation struct {
	FromWalletID  *string                `json:"fromWalletId,omitempty"`
	ToWalletID    *string                `json:"toWalletId,omitempty"`
	ChamaID       string                 `json:"chamaId,omitempty"`
	SubWalletType ChamaWalletType        `json:"subWalletType,omitempty"`
	MemberID      string                 `json:"memberId,omitempty"`
	Type          TransactionType        `json:"type" validate:"required"`
	Amount        float64                `json:"amount" validate:"required,gt=0"`
	Description   *string                `json:"description,omitempty"`
	PaymentMethod PaymentMethod          `json:"paymentMethod" validate:"required"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// MpesaTransaction represents M-Pesa specific transaction data
type MpesaTransaction struct {
	PhoneNumber      string  `json:"phoneNumber" validate:"required"`
	Amount           float64 `json:"amount" validate:"required,gt=0"`
	AccountReference string  `json:"accountReference" validate:"required"`
	TransactionDesc  string  `json:"transactionDesc" validate:"required"`
	PartyB           string  `json:"partyB,omitempty"`
}

// MpesaCallback represents M-Pesa callback data
type MpesaCallback struct {
	MerchantRequestID string `json:"MerchantRequestID"`
	CheckoutRequestID string `json:"CheckoutRequestID"`
	ResultCode        int    `json:"ResultCode"`
	ResultDesc        string `json:"ResultDesc"`
	CallbackMetadata  *struct {
		Item []struct {
			Name  string      `json:"Name"`
			Value interface{} `json:"Value"`
		} `json:"Item"`
	} `json:"CallbackMetadata,omitempty"`
}

// WalletSummary represents a summary of wallet information
type WalletSummary struct {
	TotalBalance    float64 `json:"totalBalance"`
	PersonalBalance float64 `json:"personalBalance"`
	ChamaBalance    float64 `json:"chamaBalance"`
	BusinessBalance float64 `json:"businessBalance"`
	PendingIncoming float64 `json:"pendingIncoming"`
	PendingOutgoing float64 `json:"pendingOutgoing"`
	MonthlyIncome   float64 `json:"monthlyIncome"`
	MonthlyExpenses float64 `json:"monthlyExpenses"`
}

// IsAvailable checks if the wallet is available for transactions
func (w *Wallet) IsAvailable() bool {
	return w.IsActive && !w.IsLocked
}

// CanWithdraw checks if the wallet can withdraw the specified amount
func (w *Wallet) CanWithdraw(amount float64) bool {
	return w.IsAvailable() && w.Balance >= amount
}

// HasDailyLimit checks if the wallet has a daily limit
func (w *Wallet) HasDailyLimit() bool {
	return w.DailyLimit != nil
}

// HasMonthlyLimit checks if the wallet has a monthly limit
func (w *Wallet) HasMonthlyLimit() bool {
	return w.MonthlyLimit != nil
}

// GetDailyLimit returns the daily limit or 0 if not set
func (w *Wallet) GetDailyLimit() float64 {
	if w.DailyLimit != nil {
		return *w.DailyLimit
	}
	return 0
}

// GetMonthlyLimit returns the monthly limit or 0 if not set
func (w *Wallet) GetMonthlyLimit() float64 {
	if w.MonthlyLimit != nil {
		return *w.MonthlyLimit
	}
	return 0
}

// IsCompleted checks if the transaction is completed
func (t *Transaction) IsCompleted() bool {
	return t.Status == TransactionStatusCompleted
}

// IsPending checks if the transaction is pending
func (t *Transaction) IsPending() bool {
	return t.Status == TransactionStatusPending
}

// IsFailed checks if the transaction failed
func (t *Transaction) IsFailed() bool {
	return t.Status == TransactionStatusFailed
}

// IsApproved checks if the transaction is approved
func (t *Transaction) IsApproved() bool {
	return t.ApprovedBy != nil
}

// NeedsApproval checks if the transaction needs approval
func (t *Transaction) NeedsApproval() bool {
	return t.RequiresApproval && !t.IsApproved()
}

// IsExpired checks if the approval deadline has passed
func (t *Transaction) IsExpired() bool {
	return t.ApprovalDeadline != nil && time.Now().After(*t.ApprovalDeadline)
}

// GetTotalAmount returns the total amount including fees
func (t *Transaction) GetTotalAmount() float64 {
	return t.Amount + t.Fees
}

// GetMetadataJSON returns metadata as JSON string for database storage
func (t *Transaction) GetMetadataJSON() (string, error) {
	if len(t.Metadata) == 0 {
		return "{}", nil
	}
	data, err := json.Marshal(t.Metadata)
	return string(data), err
}

// SetMetadataFromJSON sets metadata from JSON string
func (t *Transaction) SetMetadataFromJSON(metadataJSON string) error {
	if metadataJSON == "" || metadataJSON == "{}" {
		t.Metadata = make(map[string]interface{})
		return nil
	}
	return json.Unmarshal([]byte(metadataJSON), &t.Metadata)
}

// IsDebit checks if the transaction is a debit (money going out)
func (t *Transaction) IsDebit() bool {
	return t.Type == TransactionTypeWithdrawal ||
		t.Type == TransactionTypeTransfer ||
		t.Type == TransactionTypeContribution ||
		t.Type == TransactionTypePurchase ||
		t.Type == TransactionTypeFee
}

// IsCredit checks if the transaction is a credit (money coming in)
func (t *Transaction) IsCredit() bool {
	return t.Type == TransactionTypeDeposit ||
		t.Type == TransactionTypeLoan ||
		t.Type == TransactionTypeRefund
}

// GetMpesaAmount extracts amount from M-Pesa callback metadata
func (mc *MpesaCallback) GetMpesaAmount() float64 {
	if mc.CallbackMetadata == nil {
		return 0
	}

	for _, item := range mc.CallbackMetadata.Item {
		if item.Name == "Amount" {
			if amount, ok := item.Value.(float64); ok {
				return amount
			}
		}
	}
	return 0
}

// GetMpesaReceiptNumber extracts receipt number from M-Pesa callback metadata
func (mc *MpesaCallback) GetMpesaReceiptNumber() string {
	if mc.CallbackMetadata == nil {
		return ""
	}

	for _, item := range mc.CallbackMetadata.Item {
		if item.Name == "MpesaReceiptNumber" {
			if receipt, ok := item.Value.(string); ok {
				return receipt
			}
		}
	}
	return ""
}

// GetMpesaPhoneNumber extracts phone number from M-Pesa callback metadata
func (mc *MpesaCallback) GetMpesaPhoneNumber() string {
	if mc.CallbackMetadata == nil {
		return ""
	}

	for _, item := range mc.CallbackMetadata.Item {
		if item.Name == "PhoneNumber" {
			if phone, ok := item.Value.(string); ok {
				return phone
			}
		}
	}
	return ""
}

// GeneratePaybillReference creates a unique paybill reference for a payment
// Format: PREFIX-CHAMA_ID-USER_ID-TIMESTAMP-RANDOM
func GeneratePaybillReference(prefix, chamaID, userID string) string {
	timestamp := time.Now().Unix()
	random := time.Now().Nanosecond() % 10000
	return fmt.Sprintf("%s-%s-%s-%d-%04d", prefix, chamaID, userID, timestamp, random)
}

// ParsePaybillReference parses a paybill reference and extracts payment details
// Returns: prefix, chamaID, userID, timestamp, valid
func ParsePaybillReference(reference string) (string, string, string, int64, bool) {
	parts := strings.Split(reference, "-")
	if len(parts) < 5 {
		return "", "", "", 0, false
	}

	var timestamp int64
	_, err := fmt.Sscanf(parts[3], "%d", &timestamp)
	if err != nil {
		return parts[0], parts[1], parts[2], 0, false
	}

	return parts[0], parts[1], parts[2], timestamp, true
}

// GetAccountReferenceFromPaybill formats the account reference for M-Pesa STK
// This is what the member sees and enters on their phone
func GetAccountReferenceFromPaybill(chamaID, userID, walletType string) string {
	// Format: VAULTKE-CHAMA_ID-USER_ID-WALLETTYPE (truncated to fit M-Pesa's 12 char limit)
	return fmt.Sprintf("VK%s%s%s", chamaID[:min(8, len(chamaID))], userID[:min(8, len(userID))], walletType[:min(2, len(walletType))])
}
