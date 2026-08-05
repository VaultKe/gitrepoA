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
	"vaultke-backend/internal/utils"

	"github.com/gin-gonic/gin"
)

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
	phoneNumber := regexp.MustCompile(`\D`).ReplaceAllString(req.PhoneNumber, "")
	if strings.HasPrefix(phoneNumber, "07") || strings.HasPrefix(phoneNumber, "01") {
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
