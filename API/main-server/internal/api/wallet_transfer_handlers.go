package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"vaultke-backend/config"
	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"
	"vaultke-backend/internal/utils"

	"github.com/gin-gonic/gin"
)

// Helper function to get estimated processing time
func getWithdrawalEstimatedTime(method string) string {
	switch method {
	case "mpesa":
		return "1-5 minutes"
	case "bank":
		return "1-3 business days"
	default:
		return "Unknown"
	}
}

func TransferMoney(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Parse request body
	var req struct {
		RecipientID   string  `json:"recipientId" binding:"required"`
		RecipientType string  `json:"recipientType"` // "user", "phone", "email"
		Amount        float64 `json:"amount" binding:"required"`
		Description   string  `json:"description"`
		PIN           string  `json:"pin"` // For transaction verification
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Validate amount
	if req.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Amount must be greater than 0",
		})
		return
	}

	if req.Amount > 1000000 { // 1M KES limit
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Amount exceeds maximum transfer limit of KES 1,000,000",
		})
		return
	}

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Create wallet service
	walletService := services.NewWalletService(db.(*sql.DB))

	// Get sender's wallet
	senderWalletID := "wallet-personal-" + userID.(string)
	senderWallet, err := walletService.GetWalletByID(senderWalletID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Sender wallet not found",
		})
		return
	}

	// Check if sender has sufficient balance
	if senderWallet.Balance < req.Amount {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Insufficient balance",
			"data": gin.H{
				"availableBalance": senderWallet.Balance,
				"requestedAmount":  req.Amount,
			},
		})
		return
	}

	// Find recipient based on type
	var recipientUserID string
	var recipientWalletID string

	if req.RecipientType == "phone" {
		// Format phone number to canonical +254 format before lookup
		formattedPhone := utils.FormatPhoneNumber(req.RecipientID)
		err := db.(*sql.DB).QueryRow("SELECT id FROM users WHERE phone = $1", formattedPhone).Scan(&recipientUserID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "Recipient not found with phone number: " + req.RecipientID,
			})
			return
		}
	} else if req.RecipientType == "email" {
		// Find user by email
		err := db.(*sql.DB).QueryRow("SELECT id FROM users WHERE email = $1", req.RecipientID).Scan(&recipientUserID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "Recipient not found with email: " + req.RecipientID,
			})
			return
		}
	} else {
		// Direct user ID
		recipientUserID = req.RecipientID
	}

	// Get recipient's wallet
	recipientWalletID = "wallet-personal-" + recipientUserID
	recipientWallet, err := walletService.GetWalletByID(recipientWalletID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Recipient wallet not found",
		})
		return
	}

	// Check if recipient wallet is active
	if !recipientWallet.IsAvailable() {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Recipient wallet is not available for transactions",
		})
		return
	}

	// Prevent self-transfer
	if userID.(string) == recipientUserID {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Cannot transfer money to yourself",
		})
		return
	}

	// Create transfer transaction
	description := req.Description
	if description == "" {
		description = "Money transfer"
	}

	transaction := &models.TransactionCreation{
		FromWalletID:  &senderWalletID,
		ToWalletID:    &recipientWalletID,
		Type:          models.TransactionTypeTransfer,
		Amount:        req.Amount,
		Description:   &description,
		PaymentMethod: models.PaymentMethodWalletTransfer,
		Metadata:      make(map[string]interface{}),
	}

	// Add recipient info to metadata
	transaction.Metadata["recipientId"] = recipientUserID
	transaction.Metadata["recipientType"] = req.RecipientType

	// Process the transfer
	processedTransaction, err := walletService.CreateTransaction(transaction, userID.(string))
	if err != nil {
		log.Printf("Failed to process transfer: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to process transfer: " + err.Error(),
		})
		return
	}

	// Get recipient details for response
	var recipientName, recipientPhone string
	db.(*sql.DB).QueryRow("SELECT COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''), phone FROM users WHERE id = $1", recipientUserID).Scan(&recipientName, &recipientPhone)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Transfer completed successfully",
		"data": gin.H{
			"transactionId":  processedTransaction.ID,
			"amount":         req.Amount,
			"recipientName":  recipientName,
			"recipientPhone": utils.MaskPhone(recipientPhone),
			"description":    description,
			"status":         processedTransaction.Status,
			"transactionRef": processedTransaction.Reference,
			"timestamp":      processedTransaction.CreatedAt,
		},
	})
		c.Abort()
}

func WithdrawMoney(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Parse request body
	var req struct {
		Amount            float64 `json:"amount" binding:"required"`
		WithdrawMethod    string  `json:"withdrawMethod" binding:"required"` // "mpesa", "bank"
		PhoneNumber       string  `json:"phoneNumber"`                       // For M-Pesa
		BankAccountNumber string  `json:"bankAccountNumber"`                 // For bank transfer
		BankCode          string  `json:"bankCode"`                          // For bank transfer
		Description       string  `json:"description"`
		PIN               string  `json:"pin"` // For transaction verification
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Validate amount
	if req.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Amount must be greater than 0",
		})
		return
	}

	if req.Amount < 10 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Minimum withdrawal amount is KES 10",
		})
		return
	}

	if req.Amount > 300000 { // 300K KES daily limit
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Amount exceeds maximum daily withdrawal limit of KES 300,000",
		})
		return
	}

	// Validate withdrawal method
	if req.WithdrawMethod != "mpesa" && req.WithdrawMethod != "bank" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid withdrawal method. Use 'mpesa' or 'bank'",
		})
		return
	}

	// Validate method-specific fields
	if req.WithdrawMethod == "mpesa" && req.PhoneNumber == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Phone number is required for M-Pesa withdrawal",
		})
		return
	}

	if req.WithdrawMethod == "bank" && (req.BankAccountNumber == "" || req.BankCode == "") {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Bank account number and bank code are required for bank withdrawal",
		})
		return
	}

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Create wallet service
	walletService := services.NewWalletService(db.(*sql.DB))

	// Get user's wallet
	walletID := "wallet-personal-" + userID.(string)
	wallet, err := walletService.GetWalletByID(walletID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Wallet not found",
		})
		return
	}

	// Check if wallet is available
	if !wallet.IsAvailable() {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Wallet is not available for transactions",
		})
		return
	}

	// Calculate withdrawal fee (2% for M-Pesa, 1% for bank, min 10 KES)
	var fee float64
	if req.WithdrawMethod == "mpesa" {
		fee = req.Amount * 0.02 // 2%
	} else {
		fee = req.Amount * 0.01 // 1%
	}
	if fee < 10 {
		fee = 10 // Minimum fee
	}

	totalDeduction := req.Amount + fee

	// Check if user has sufficient balance
	if wallet.Balance < totalDeduction {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Insufficient balance",
			"data": gin.H{
				"availableBalance": wallet.Balance,
				"requestedAmount":  req.Amount,
				"withdrawalFee":    fee,
				"totalRequired":    totalDeduction,
			},
		})
		return
	}

	// Generate unique reference
	reference := fmt.Sprintf("WD_%d_%s", time.Now().UnixNano(), userID.(string)[:8])

	// Create withdrawal transaction
	description := req.Description
	if description == "" {
		description = fmt.Sprintf("Withdrawal via %s", req.WithdrawMethod)
	}

	// Add method-specific metadata
	metadata := make(map[string]interface{})
	metadata["withdrawalMethod"] = req.WithdrawMethod
	metadata["fees"] = fee
	metadata["reference"] = reference

	if req.WithdrawMethod == "mpesa" {
		metadata["phoneNumber"] = req.PhoneNumber
	} else {
		metadata["bankAccountNumber"] = req.BankAccountNumber
		metadata["bankCode"] = req.BankCode
	}

	transaction := &models.TransactionCreation{
		FromWalletID:  &walletID,
		Type:          models.TransactionTypeWithdrawal,
		Amount:        req.Amount,
		Description:   &description,
		PaymentMethod: models.PaymentMethod(req.WithdrawMethod),
		Metadata:      metadata,
	}

	// Process the withdrawal
	processedTransaction, err := walletService.CreateTransaction(transaction, userID.(string))
	if err != nil {
		log.Printf("Failed to process withdrawal: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to process withdrawal: " + err.Error(),
		})
		return
	}

	// For M-Pesa withdrawals, initiate B2C transaction
	if req.WithdrawMethod == "mpesa" {
		// Get configuration
		cfg, exists := c.Get("config")
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Configuration not available",
			})
			return
		}

		// Create M-Pesa service
		mpesaService := services.NewMpesaService(db.(*sql.DB), cfg.(*config.Config))

		// Format phone number
		phoneNumber := regexp.MustCompile(`\D`).ReplaceAllString(req.PhoneNumber, "")
		if strings.HasPrefix(phoneNumber, "07") || strings.HasPrefix(phoneNumber, "01") {
			phoneNumber = "254" + phoneNumber[1:]
		} else if strings.HasPrefix(phoneNumber, "+254") {
			phoneNumber = phoneNumber[1:]
		}

		// Initiate B2C transaction
		b2cResponse, err := mpesaService.InitiateB2C(phoneNumber, req.Amount, fmt.Sprintf("Withdrawal for %s", processedTransaction.ID))
		if err != nil {
			log.Printf("B2C initiation failed: %v", err)
			// Mark transaction as failed so it doesn't hang in pending
			_, _ = db.(*sql.DB).Exec("UPDATE transactions SET status = $1, updated_at = $2 WHERE id = $3",
				models.TransactionStatusFailed, time.Now(), processedTransaction.ID)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to initiate M-Pesa B2C payment: " + err.Error(),
			})
			return
		}

		// Store B2C conversation IDs in metadata and mark as processing
		// so the B2C callback/timeout can find and complete this transaction.
		metadata := make(map[string]interface{})
		if processedTransaction.Metadata != nil {
			metadata = processedTransaction.Metadata
		}
		metadata["conversation_id"] = b2cResponse.ConversationID
		metadata["originator_conversation_id"] = b2cResponse.OriginatorConversationID
		metadata["b2c_phone_number"] = phoneNumber
		metadataBytes, _ := json.Marshal(metadata)

		_, _ = db.(*sql.DB).Exec(
			"UPDATE transactions SET status = $1, metadata = $2, updated_at = $3 WHERE id = $4",
			models.TransactionStatusProcessing, string(metadataBytes), time.Now(), processedTransaction.ID,
		)
		log.Printf("M-Pesa B2C withdrawal initiated: %s, ConversationID: %s", processedTransaction.ID, b2cResponse.ConversationID)
	}

	// For bank withdrawals, create a pending request for manual processing
	if req.WithdrawMethod == "bank" {
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Withdrawal initiated successfully",
		"data": gin.H{
			"transactionId":    processedTransaction.ID,
			"amount":           req.Amount,
			"withdrawalFee":    fee,
			"totalDeducted":    totalDeduction,
			"withdrawalMethod": req.WithdrawMethod,
			"status":           processedTransaction.Status,
			"reference":        reference,
			"estimatedTime":    getWithdrawalEstimatedTime(req.WithdrawMethod),
			"timestamp":        processedTransaction.CreatedAt,
		},
	})
		c.Abort()
}
