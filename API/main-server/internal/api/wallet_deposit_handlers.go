package api

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"vaultke-backend/config"
	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
)

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
	var transactionID string
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
		phoneNumber := regexp.MustCompile(`\D`).ReplaceAllString(userPhone, "")
		if strings.HasPrefix(phoneNumber, "07") || strings.HasPrefix(phoneNumber, "01") {
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
		personalUserID := userID.(string)
		targetWallet, err := walletService.GetWalletByOwnerAndType(personalUserID, models.WalletTypePersonal)
		if err != nil {
			targetWallet, err = walletService.CreateWallet(personalUserID, models.WalletTypePersonal)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error":   "Failed to create personal wallet",
				})
				return
			}
		}
		targetWalletID := targetWallet.ID

		transactionID, err = createPendingMpesaTransaction(db.(*sql.DB), req.Amount, reference, targetWalletID, "", "deposit", "personal", personalUserID)
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
	transactionID = fmt.Sprintf("txn-%d", time.Now().UnixNano())
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
