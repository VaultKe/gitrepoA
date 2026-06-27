package api

import (
	"database/sql"
	"encoding/json"
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

// Payment handlers for centralized paybill system
// All payments go to a single configured paybill, identified by account reference

func InitiateMpesaSTK(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}
	userID := userIDVal.(string)

	var req struct {
		PhoneNumber      string  `json:"phoneNumber" binding:"required"`
		Amount           float64 `json:"amount" binding:"required,gt=0"`
		ChamaID          string  `json:"chamaId"`
		PaymentType      string  `json:"paymentType"`
		WalletType       string  `json:"walletType"`
		Description      string  `json:"description"`
		AccountReference string  `json:"accountReference"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request format: " + err.Error(),
		})
		return
	}

	// Validate phone number format (Kenyan format)
	phoneNumber := strings.TrimSpace(req.PhoneNumber)
	if strings.HasPrefix(phoneNumber, "0") {
		phoneNumber = "254" + phoneNumber[1:]
	} else if strings.HasPrefix(phoneNumber, "+254") {
		phoneNumber = phoneNumber[1:]
	} else if !strings.HasPrefix(phoneNumber, "254") {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid phone number format. Use format: 254XXXXXXXXX",
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

	cfg, exists := c.Get("config")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Configuration not available",
		})
		return
	}
	config := cfg.(*config.Config)

	// Generate or use provided account reference
	accountRef := req.AccountReference
	if accountRef == "" {
		if req.ChamaID != "" {
			accountRef = models.GetAccountReferenceFromPaybill(req.ChamaID, userID, req.WalletType)
		} else {
			accountRef = "VK" + userID[:min(10, len(userID))]
		}
	}

	// Generate internal reference for tracking
	prefix := getPaymentPrefix(req.PaymentType)
	reference := models.GeneratePaybillReference(prefix, req.ChamaID, userID)

	// For chama payments, determine target wallet
	var targetWalletID string
	if req.ChamaID != "" {
		targetWalletID, _ = getTargetChamaWallet(db.(*sql.DB), req.ChamaID, req.WalletType)
	} else {
		targetWalletID = fmt.Sprintf("wallet-%s", userID)
	}

	// Create pending transaction
	transactionID, err := createPendingMpesaTransaction(db.(*sql.DB), req.Amount, reference, targetWalletID, req.ChamaID, req.PaymentType, req.WalletType, userID)
	if err != nil {
		log.Printf("Failed to create pending transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create transaction record",
		})
		return
	}

	// Use system paybill if configured, otherwise fallback
	partyB := config.SystemPaybillBusinessNumber
	if partyB == "" {
		partyB = config.MpesaShortcode
	}

	// Prepare M-Pesa request with system paybill
	mpesaReq := &models.MpesaTransaction{
		PhoneNumber:      phoneNumber,
		Amount:           req.Amount,
		AccountReference: accountRef,
		TransactionDesc:  req.Description,
		PartyB:           partyB,
	}

	mpesaService := services.NewMpesaService(db.(*sql.DB), config)
	stkResponse, err := mpesaService.InitiateSTKPush(mpesaReq)
	if err != nil {
		log.Printf("STK Push failed: %v", err)
		updateTransactionStatus(db.(*sql.DB), transactionID, models.TransactionStatusFailed)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to initiate M-Pesa payment: " + err.Error(),
			"data": gin.H{
				"transactionId": transactionID,
				"status":        "failed",
			},
		})
		return
	}

	updateTransactionCheckoutRequestID(db.(*sql.DB), transactionID, stkResponse.CheckoutRequestID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "STK push initiated successfully",
		"data": gin.H{
			"transactionId":      transactionID,
			"checkoutRequestId":  stkResponse.CheckoutRequestID,
			"merchantRequestId":  stkResponse.MerchantRequestID,
			"customerMessage":    stkResponse.CustomerMessage,
			"accountReference":   accountRef,
			"businessNumber":     partyB,
		},
	})
}

func HandleMpesaCallback(c *gin.Context) {
	log.Println("M-Pesa callback received")

	var callback models.MpesaCallback
	if err := c.ShouldBindJSON(&callback); err != nil {
		log.Printf("Failed to parse callback: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid callback format",
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

	cfg, exists := c.Get("config")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Configuration not available",
		})
		return
	}

	mpesaService := services.NewMpesaService(db.(*sql.DB), cfg.(*config.Config))

	err := mpesaService.ProcessMpesaCallback(&callback)
	if err != nil {
		log.Printf("Failed to process M-Pesa callback: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to process callback",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ResultCode": 0,
		"ResultDesc": "Success",
	})
}

func GetMpesaTransactionStatus(c *gin.Context) {
	checkoutRequestID := c.Param("checkoutRequestId")
	if checkoutRequestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Checkout request ID is required",
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

	cfg, exists := c.Get("config")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Configuration not available",
		})
		return
	}

	mpesaService := services.NewMpesaService(db.(*sql.DB), cfg.(*config.Config))

	status, err := mpesaService.GetTransactionStatus(checkoutRequestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to check transaction status",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"checkoutRequestId": checkoutRequestID,
			"status":            status,
		},
	})
}

func getPaymentPrefix(paymentType string) string {
	switch paymentType {
	case "registration":
		return models.PaybillRefRegistration
	case "subscription":
		return models.PaybillRefSubscription
	case "contribution":
		return models.PaybillRefContribution
	case "savings":
		return models.PaybillRefSavings
	case "welfare":
		return models.PaybillRefWelfare
	case "merry_go_round":
		return models.PaybillRefMerryGoRound
	case "loan_repayment":
		return models.PaybillRefLoanRepayment
	case "shares":
		return models.PaybillRefShares
	case "dividends":
		return models.PaybillRefDividends
	default:
		return models.PaybillRefContribution
	}
}

func getTargetChamaWallet(db *sql.DB, chamaID, walletType string) (string, error) {
	walletID := fmt.Sprintf("wallet-%s-%s", chamaID, walletType)
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM wallets WHERE owner_id = $1 AND type = $2)", chamaID, "chama").Scan(&exists)
	if err != nil {
		return "", err
	}

	// Create chama wallet if doesn't exist
	if !exists {
		_, err = db.Exec("INSERT INTO wallets (id, owner_id, type, balance, created_at, updated_at) VALUES ($1, $2, 'chama', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", walletID, chamaID)
		if err != nil {
			return "", err
		}
	}
	return walletID, nil
}

func createPendingMpesaTransaction(db *sql.DB, amount float64, reference, targetWalletID, chamaID, paymentType, walletType, userID string) (string, error) {
	transactionID := fmt.Sprintf("TXN_%d", time.Now().UnixNano())

	metadata := map[string]interface{}{
		"payment_type": paymentType,
		"wallet_type":  walletType,
	}
	if chamaID != "" {
		metadata["chama_id"] = chamaID
	}
	metadataJSON, _ := json.Marshal(metadata)

	insertQuery := `
		INSERT INTO transactions (
			id, to_wallet_id, type, status, amount, currency, description,
			reference, payment_method, initiated_by, approved_by, requires_approval, metadata, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`

	_, err := db.Exec(insertQuery,
		transactionID, targetWalletID, models.TransactionTypeDeposit, models.TransactionStatusPending,
		amount, "KES", paymentType, reference, models.PaymentMethodMpesa,
		userID, userID, false, string(metadataJSON),
	)
	if err != nil {
		return "", fmt.Errorf("failed to create pending transaction: %w", err)
	}

	return transactionID, nil
}

func updateTransactionStatus(db *sql.DB, transactionID string, status models.TransactionStatus) error {
	_, err := db.Exec("UPDATE transactions SET status = $1, updated_at = $2 WHERE id = $3", status, utils.NowEAT(), transactionID)
	return err
}

func updateTransactionCheckoutRequestID(db *sql.DB, transactionID, checkoutRequestID string) error {
	_, err := db.Exec("UPDATE transactions SET reference = $1, updated_at = $2 WHERE id = $3", checkoutRequestID, utils.NowEAT(), transactionID)
	return err
}