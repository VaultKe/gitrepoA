package api

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
	"vaultke-backend/config"
	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"
	"vaultke-backend/internal/utils"

	"github.com/gin-gonic/gin"
)

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
		// Find user by phone number
		err := db.(*sql.DB).QueryRow("SELECT id FROM users WHERE phone = $1", req.RecipientID).Scan(&recipientUserID)
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
			"recipientPhone": recipientPhone,
			"description":    description,
			"status":         processedTransaction.Status,
			"transactionRef": processedTransaction.Reference,
			"timestamp":      processedTransaction.CreatedAt,
		},
	})
}

func DepositMoney(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Parse request body with enhanced validation
	var req struct {
		Amount        float64 `json:"amount" binding:"required" validate:"required,amount"`
		PaymentMethod string  `json:"paymentMethod" validate:"alphanumeric,max=50"`
		Reference     string  `json:"reference" validate:"max=100,no_sql_injection,no_xss"`
		Description   string  `json:"description" validate:"max=200,safe_text,no_sql_injection,no_xss"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Enhanced validation
	if req.Amount <= 0 || req.Amount > 10000000 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Amount must be between 1 and 10,000,000 KES",
		})
		return
	}

	// For M-Pesa deposits, use real M-Pesa STK push
	if req.PaymentMethod == "mpesa" {
		// Get user's phone number
		db, exists := c.Get("db")
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Database connection not available",
			})
			return
		}

		var userPhone string
		err := db.(*sql.DB).QueryRow("SELECT phone FROM users WHERE id = $1", userID).Scan(&userPhone)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "User phone number not found",
			})
			return
		}

		// Convert phone number to M-Pesa format
		phoneNumber := userPhone
		if strings.HasPrefix(phoneNumber, "07") {
			phoneNumber = "254" + phoneNumber[1:]
		} else if strings.HasPrefix(phoneNumber, "+254") {
			phoneNumber = phoneNumber[1:]
		}

		// Generate unique reference if not provided
		reference := req.Reference
		if reference == "" {
			reference = fmt.Sprintf("DEP_%d_%s", time.Now().UnixNano(), userID.(string)[:8])
		}

		// Create M-Pesa transaction request
		mpesaReq := models.MpesaTransaction{
			PhoneNumber:      phoneNumber,
			Amount:           req.Amount,
			AccountReference: reference,
			TransactionDesc:  req.Description,
		}

		if mpesaReq.TransactionDesc == "" {
			mpesaReq.TransactionDesc = "Wallet Deposit"
		}

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

		walletService := services.NewWalletService(db.(*sql.DB))
		targetWalletID := "wallet-personal-" + userID.(string)
		_, err := walletService.GetWalletByID(targetWalletID)
		if err != nil {
			_, createErr := walletService.CreateWallet(userID.(string), models.WalletTypePersonal)
			if createErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error":   "Failed to create personal wallet",
				})
				return
			}
		}

		transactionID, err := createPendingMpesaTransaction(db.(*sql.DB), req.Amount, reference, targetWalletID, "", "deposit", "personal", userID.(string))
		if err != nil {
			log.Printf("Failed to create pending transaction: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create transaction record",
			})
			return
		}

		// Initiate STK push
	stkResponse, err := mpesaService.InitiateSTKPush(&mpesaReq)
	if err != nil {
		log.Printf("STK Push failed: %v", err)

		failureReason := fmt.Sprintf("M-Pesa STK Push failed: %v", err)

		updateErr := updateTransactionStatus(db.(*sql.DB), transactionID, models.TransactionStatusFailed)
		if updateErr != nil {
			log.Printf("Failed to update transaction status to failed: %v", updateErr)
		}

		_, updateErr = db.(*sql.DB).Exec(`
			UPDATE transactions
			SET reference = $1,
			    description = COALESCE(description, '') || ' - ' || $2,
			    updated_at = CURRENT_TIMESTAMP
			WHERE id = $3
		`, fmt.Sprintf("FAILED_%d", time.Now().UnixNano()), failureReason, transactionID)

		if updateErr != nil {
			log.Printf("Failed to update transaction failure details: %v", updateErr)
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to initiate M-Pesa payment: STK push failed",
			"details": err.Error(),
			"data": map[string]interface{}{
				"transactionId": transactionID,
				"status":        "failed",
				"reason":        failureReason,
			},
		})
		return
	}

	updateTransactionCheckoutRequestID(db.(*sql.DB), transactionID, stkResponse.CheckoutRequestID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "M-Pesa STK push initiated successfully",
		"data": gin.H{
			"id":                  transactionID,
			"checkoutRequestId":   stkResponse.CheckoutRequestID,
			"customerMessage":     stkResponse.CustomerMessage,
			"merchantRequestId":   stkResponse.MerchantRequestID,
			"responseDescription": stkResponse.ResponseDescription,
			"phoneNumber":         phoneNumber,
			"amount":              req.Amount,
		},
	})
	return
}

// Validate and sanitize string inputs
	if len(req.PaymentMethod) > 50 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Payment method too long",
		})
		return
	}

	if len(req.Reference) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Reference too long",
		})
		return
	}

	if len(req.Description) > 200 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Description too long",
		})
		return
	}

	// Sanitize inputs
	req.PaymentMethod = sanitizeInput(req.PaymentMethod)
	req.Reference = sanitizeInput(req.Reference)
	req.Description = sanitizeInput(req.Description)

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Start transaction
	tx, err := db.(*sql.DB).Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start transaction",
		})
		return
	}
	defer tx.Rollback()

	// Add to personal wallet
	_, err = tx.Exec(`
		UPDATE wallets
		SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP
		WHERE owner_id = $2 AND type = 'personal'
	`, req.Amount, userID)
	if err != nil {
		// If personal wallet doesn't exist, create it
		_, err = tx.Exec(`
			INSERT INTO wallets (id, owner_id, type, balance, created_at, updated_at)
			VALUES ($1, $2, 'personal', $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`, "wallet-personal-"+userID.(string), userID, req.Amount)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to update personal wallet",
			})
			return
		}
	}

	// Record the transaction
	transactionID := fmt.Sprintf("txn-%d", time.Now().UnixNano())
	paymentMethod := req.PaymentMethod

	description := req.Description
	if description == "" {
		description = fmt.Sprintf("Deposit via %s", paymentMethod)
	}

	_, err = tx.Exec(`
		INSERT INTO transactions (
			id, to_wallet_id, type, amount, currency, description,
			reference, payment_method, status, initiated_by,
			created_at, updated_at
		) VALUES ($1, $2, 'deposit', $3, 'KES', $4, $5, $6, 'completed', $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, transactionID, "wallet-personal-"+userID.(string), req.Amount, description, req.Reference, paymentMethod, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to record transaction",
		})
		return
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to commit transaction",
		})
		return
	}

	// Return success response
	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Deposit completed successfully",
		"data": map[string]interface{}{
			"id":            transactionID,
			"amount":        req.Amount,
			"paymentMethod": paymentMethod,
			"reference":     req.Reference,
			"description":   description,
			"status":        "completed",
			"depositedBy":   userID,
			"createdAt":     time.Now().Format(time.RFC3339),
		},
	})
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
		phoneNumber := req.PhoneNumber
		if strings.HasPrefix(phoneNumber, "07") {
			phoneNumber = "254" + phoneNumber[1:]
		} else if strings.HasPrefix(phoneNumber, "+254") {
			phoneNumber = phoneNumber[1:]
		}

		// Initiate B2C transaction
		b2cResponse, err := mpesaService.InitiateB2C(phoneNumber, req.Amount, fmt.Sprintf("Withdrawal for %s", processedTransaction.ID))
		if err != nil {
			log.Printf("B2C initiation failed: %v", err)
			// Continue with pending status - can be processed manually
		} else {
			log.Printf("M-Pesa B2C withdrawal initiated: %s, ConversationID: %s", processedTransaction.ID, b2cResponse.ConversationID)
		}
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
}

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

// InitiateRegistrationPayment handles registration fee payments
func InitiateRegistrationPayment(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req struct {
		Amount      float64 `json:"amount" validate:"required,gt=0"`
		PhoneNumber string  `json:"phoneNumber" validate:"required,phone"`
		Description string  `json:"description"`
		Reference   string  `json:"reference"`
		PaymentType string  `json:"paymentType" validate:"required,oneof=member chama contribution"`
		TargetID    string  `json:"targetId" validate:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	if err := utils.ValidateStruct(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Validation error: " + err.Error(),
		})
		return
	}

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}
	database := db.(*sql.DB)

	walletService := services.NewWalletService(database)

	subscriptionWallet, err := walletService.GetWalletByOwnerAndType("subscription", models.WalletTypeBusiness)
	if err != nil {
		newWallet, createErr := walletService.CreateWallet("subscription", models.WalletTypeBusiness)
		if createErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create subscription wallet",
			})
			return
		}
		subscriptionWallet = newWallet
	}

	description := req.Description
	if description == "" {
		description = "Registration fee payment"
	}

	reference := req.Reference
	if reference == "" {
		reference = fmt.Sprintf("REG-%s-%s", req.PaymentType, time.Now().Format("20060102150405"))
	}

	transaction, err := walletService.CreateTransaction(&models.TransactionCreation{
		FromWalletID:  nil,
		ToWalletID:    &subscriptionWallet.ID,
		Type:          models.TransactionTypeDeposit,
		Amount:        req.Amount,
		Description:   &description,
		PaymentMethod: models.PaymentMethodMpesa,
		Metadata: map[string]interface{}{
			"phoneNumber":     req.PhoneNumber,
			"reference":       reference,
			"paymentType":     req.PaymentType,
			"targetId":        req.TargetID,
			"initiatedBy":     userID,
			"registrationFee": true,
		},
	}, userID)

	if err != nil {
		log.Printf("Failed to create registration payment transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to initiate payment",
		})
		return
	}

	// Initiate real M-Pesa STK push
	phoneNumber := req.PhoneNumber
	if strings.HasPrefix(phoneNumber, "07") {
		phoneNumber = "254" + phoneNumber[1:]
	} else if strings.HasPrefix(phoneNumber, "+254") {
		phoneNumber = phoneNumber[1:]
	}

	mpesaReq := models.MpesaTransaction{
		PhoneNumber:      phoneNumber,
		Amount:           req.Amount,
		AccountReference: reference,
		TransactionDesc:  description,
	}

	cfg, exists := c.Get("config")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Configuration not available",
		})
		return
	}

	mpesaService := services.NewMpesaService(database, cfg.(*config.Config))

	stkResponse, err := mpesaService.InitiateSTKPush(&mpesaReq)
	if err != nil {
		log.Printf("STK Push failed for registration payment: %v", err)
		_, _ = database.Exec(
			"UPDATE transactions SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
			transaction.ID,
		)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to initiate STK push: " + err.Error(),
		})
		return
	}

	updateTransactionCheckoutRequestID(database, transaction.ID, stkResponse.CheckoutRequestID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Registration payment initiated successfully",
		"data": gin.H{
			"transactionId":     transaction.ID,
			"amount":            req.Amount,
			"reference":         reference,
			"status":            "processing",
			"checkoutRequestId": stkResponse.CheckoutRequestID,
			"customerMessage":   stkResponse.CustomerMessage,
		},
	})
}
