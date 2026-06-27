package api

import (
	"database/sql"
	"log"
	"net/http"
	"strings"

	"vaultke-backend/config"
	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"

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
		PhoneNumber      string  `json:"phoneNumber" binding:"required"`
		Amount           float64 `json:"amount" binding:"required,gt=0"`
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

	accountRef := req.AccountReference
	if accountRef == "" {
		accountRef = models.GetAccountReferenceFromPaybill(chamaID, userID.(string), subwalletType)
	}

	reference := h.paybillService.GetPaybillReference(chamaID, userID.(string), models.ChamaWalletType(subwalletType), subwalletType)

	mpesaReq := &models.MpesaTransaction{
		PhoneNumber:      phoneNumber,
		Amount:           req.Amount,
		AccountReference: accountRef,
		TransactionDesc:  req.Description,
	}

	stkResponse, err := h.mpesaService.InitiateSTKPush(mpesaReq)
	if err != nil {
		log.Printf("STK Push failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to initiate M-Pesa payment: " + err.Error(),
		})
		return
	}

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
			"recipientPhone": req.RecipientPhone,
			"status":         transaction.Status,
		},
	})
}
