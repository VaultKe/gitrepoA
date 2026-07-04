package api

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strings"

	"vaultke-backend/config"
	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"
	"vaultke-backend/internal/utils"

	"github.com/gin-gonic/gin"
)

type SubWalletHandlers struct {
	db                  *sql.DB
	paybillService      *services.PaybillTrackingService
	mpesaService        *services.MpesaService
	walletService       *services.WalletService
	disbursementService *services.DisbursementService
}

func NewSubWalletHandlers(db *sql.DB, cfg *config.Config) *SubWalletHandlers {
	return &SubWalletHandlers{
		db:                  db,
		paybillService:      services.NewPaybillTrackingService(db),
		mpesaService:        services.NewMpesaService(db, cfg),
		walletService:       services.NewWalletService(db),
		disbursementService: services.NewDisbursementService(db, cfg),
	}
}

func (h *SubWalletHandlers) GetChamaSubWallets(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	wallets, err := h.paybillService.GetAllChamaWallets(chamaID)
	if err != nil {
		log.Printf("Failed to get chama sub-wallets: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve sub-wallets",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    wallets,
		"count":   len(wallets),
	})
}

func (h *SubWalletHandlers) GetSubWalletTransactions(c *gin.Context) {
	chamaID := c.Param("id")
	subwalletType := c.Param("type")
	if chamaID == "" || subwalletType == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID and wallet type are required",
		})
		return
	}

	wallet, err := h.paybillService.GetChamaSubWallet(chamaID, models.ChamaWalletType(subwalletType))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Sub-wallet not found",
		})
		return
	}

	transactions, err := h.walletService.GetWalletTransactions(wallet.ID, 50, 0)
	if err != nil {
		log.Printf("Failed to get sub-wallet transactions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve transactions",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    transactions,
		"count":   len(transactions),
	})
}

func (h *SubWalletHandlers) PayToSubWallet(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	chamaID := c.Param("id")
	subwalletType := c.Param("type")
	if chamaID == "" || subwalletType == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID and wallet type are required",
		})
		return
	}

	var req struct {
		PhoneNumber      string  `json:"phoneNumber"`
		Amount           float64 `json:"amount" binding:"required,gt=0"`
		Description      string  `json:"description"`
		AccountReference string  `json:"accountReference"`
		PaymentMethod    string  `json:"paymentMethod"` // "wallet" or "mpesa"
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request format: " + err.Error(),
		})
		return
	}

	// Set default payment method if not provided
	if req.PaymentMethod == "" {
		req.PaymentMethod = "mpesa" // Default to mpesa for backward compatibility
	}

	// Validate payment method
	if req.PaymentMethod != "wallet" && req.PaymentMethod != "mpesa" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid payment method. Must be 'wallet' or 'mpesa'",
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

	// Ensure savings subwallet exists for savings type
	savingsWalletID := fmt.Sprintf("wallet-%s-%s", chamaID, subwalletType)
	_, err := database.Exec(
		"INSERT INTO wallets (id, type, owner_id, subwallet_type, chama_id, balance, currency, is_active, is_locked, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) ON CONFLICT (id) DO NOTHING",
		savingsWalletID, "chama", chamaID, subwalletType, chamaID, 0, "KES", true, false,
	)
	if err != nil {
		log.Printf("Failed to create/ensure subwallet: %v", err)
	}

	// Handle wallet payment method
	if req.PaymentMethod == "wallet" {
		walletService := services.NewWalletService(database)

		// Get or create user's personal wallet
		senderWallet, err := walletService.GetWalletByOwnerAndType(userID.(string), models.WalletTypePersonal)
		if err != nil {
			senderWallet, err = walletService.CreateWallet(userID.(string), models.WalletTypePersonal)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error":   "Failed to ensure user wallet exists",
				})
				return
			}
		}

		// Check if user has sufficient balance
		if senderWallet.Balance < req.Amount {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Insufficient balance in personal wallet",
			})
			return
		}

		// Get the savings subwallet
		targetWalletID := fmt.Sprintf("wallet-%s-%s", chamaID, subwalletType)
		targetWallet, err := walletService.GetWalletByID(targetWalletID)
		if err != nil {
			// Create the savings subwallet if it doesn't exist
			targetWallet, err = walletService.CreateWallet(chamaID, models.WalletTypeChama)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error":   "Failed to ensure savings subwallet exists",
				})
				return
			}
		}

		description := req.Description
		if description == "" {
			description = fmt.Sprintf("Savings contribution to %s", chamaID)
		}

		transferTx := &models.TransactionCreation{
			FromWalletID:  &senderWallet.ID,
			ToWalletID:    &targetWallet.ID,
			Type:          models.TransactionTypeTransfer,
			Amount:        req.Amount,
			Description:   &description,
			PaymentMethod: models.PaymentMethodWalletTransfer,
			Metadata: map[string]interface{}{
				"contributionType": subwalletType, // "savings" for savings contributions
				"chamaId":          chamaID,
				"savingsContribution": true,
			},
		}

		processedTx, err := walletService.CreateTransaction(transferTx, userID.(string))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to process savings contribution: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Savings contribution processed successfully",
			"data": gin.H{
				"transactionId": processedTx.ID,
				"amount":        req.Amount,
				"status":        "completed",
			},
		})
		return
	}

	// Handle M-Pesa payment method (existing logic)
	var phoneNumber string
	if req.PhoneNumber != "" {
		phoneNumber = strings.TrimSpace(req.PhoneNumber)
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
	} else {
		// Get user's phone from database
		err := database.QueryRow("SELECT phone FROM users WHERE id = $1", userID).Scan(&phoneNumber)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "User phone number not found. Please provide phoneNumber.",
			})
			return
		}
		// Format phone number
		phoneNumber = strings.TrimSpace(phoneNumber)
		if strings.HasPrefix(phoneNumber, "0") {
			phoneNumber = "254" + phoneNumber[1:]
		} else if strings.HasPrefix(phoneNumber, "+254") {
			phoneNumber = phoneNumber[1:]
		} else if !strings.HasPrefix(phoneNumber, "254") {
			phoneNumber = "254" + phoneNumber
		}
	}

	accountRef := req.AccountReference
	if accountRef == "" {
		accountRef = models.GetAccountReferenceFromPaybill(chamaID, userID.(string), subwalletType)
	}

	reference := h.paybillService.GetPaybillReference(chamaID, userID.(string), models.ChamaWalletType(subwalletType), subwalletType)

	_, err = h.paybillService.GetChamaSubWallet(chamaID, models.ChamaWalletType(subwalletType))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Sub-wallet not found for chama",
		})
		return
	}

	targetWalletID := fmt.Sprintf("wallet-%s-%s", chamaID, subwalletType)
	transactionID, err := createPendingMpesaTransaction(database, req.Amount, reference, targetWalletID, chamaID, subwalletType, subwalletType, userID.(string))
	if err != nil {
		log.Printf("Failed to create pending subwallet transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create transaction record",
		})
		return
	}

	mpesaReq := &models.MpesaTransaction{
		PhoneNumber:      phoneNumber,
		Amount:           req.Amount,
		AccountReference: accountRef,
		TransactionDesc:  req.Description,
	}

	stkResponse, err := h.mpesaService.InitiateSTKPush(mpesaReq)
	if err != nil {
		log.Printf("STK Push failed for subwallet: %v", err)
		updateTransactionStatus(database, transactionID, models.TransactionStatusFailed)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to initiate M-Pesa payment: " + err.Error(),
		})
		return
	}

	updateTransactionCheckoutRequestID(database, transactionID, stkResponse.CheckoutRequestID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "STK push initiated successfully",
		"data": gin.H{
			"checkoutRequestId": stkResponse.CheckoutRequestID,
			"merchantRequestId": stkResponse.MerchantRequestID,
			"customerMessage":   stkResponse.CustomerMessage,
			"accountReference":  accountRef,
			"reference":         reference,
		},
	})
}

func (h *SubWalletHandlers) WithdrawFromSubWallet(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	chamaID := c.Param("id")
	subwalletType := c.Param("type")
	if chamaID == "" || subwalletType == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID and wallet type are required",
		})
		return
	}

	var req struct {
		Amount         float64 `json:"amount" binding:"required,gt=0"`
		RecipientPhone string  `json:"recipientPhone" binding:"required"`
		Description    string  `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request format: " + err.Error(),
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

	var memberRole string
	err := database.QueryRow(
		"SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true",
		chamaID, userID,
	).Scan(&memberRole)

	canWithdraw := false
	if err == nil && (memberRole == "chairperson" || memberRole == "treasurer") {
		canWithdraw = true
	}

	if !canWithdraw {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied - only chairperson or treasurer can withdraw from chama sub-wallets",
		})
		return
	}

	transaction, err := h.disbursementService.DisburseToChamaWallet(chamaID, subwalletType, req.Amount, userID.(string), req.Description)
	if err != nil {
		log.Printf("Withdrawal failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Withdrawal failed: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Withdrawal initiated successfully",
		"data": gin.H{
			"transactionId":  transaction.ID,
			"amount":         req.Amount,
			"recipientPhone": utils.MaskPhone(req.RecipientPhone),
			"status":         transaction.Status,
		},
	})
}
