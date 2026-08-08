package api

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"vaultke-backend/config"
	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// GetChamaSubscriptionPayments returns (and lazily creates) the subscription
// payments for a chama.
func GetChamaSubscriptionPayments(c *gin.Context) {
	chamaID, ok := requireParam(c, "id", "Chama ID is required")
	if !ok {
		return
	}

	database := dbFromContext(c)
	if database == nil {
		return
	}

	query := `
		SELECT id, chama_id, amount, status, due_date, paid_at, payment_method, transaction_id, month_year, created_at, updated_at
		FROM subscription_payments
		WHERE chama_id = $1
		ORDER BY due_date ASC
	`
	rows, err := database.Query(query, chamaID)
	if err != nil {
		log.Printf("[DEBUG BACKEND] Query error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get subscription payments",
		})
		return
	}
	defer rows.Close()

	payments := []map[string]interface{}{}
	for rows.Next() {
		var rowID, rowChamaID, status, monthYear string
		var amount float64
		var dueDate, createdAt, updatedAt time.Time
		var paidAt *time.Time
		var paymentMethod, transactionID *string

		if err := rows.Scan(&rowID, &rowChamaID, &amount, &status, &dueDate, &paidAt, &paymentMethod, &transactionID, &monthYear, &createdAt, &updatedAt); err != nil {
			log.Printf("[DEBUG BACKEND] Scan error for subscription payment: %v", err)
			continue
		}

		payments = append(payments, map[string]interface{}{
			"id":            rowID,
			"chamaId":       rowChamaID,
			"amount":        amount,
			"status":        status,
			"dueDate":       dueDate,
			"paidAt":        paidAt,
			"paymentMethod": paymentMethod,
			"transactionId": transactionID,
			"monthYear":     monthYear,
			"createdAt":     createdAt,
			"updatedAt":     updatedAt,
		})
	}
	if err := rows.Err(); err != nil {
		log.Printf("[DEBUG BACKEND] Rows error for subscription payments: %v", err)
	}
	log.Printf("[DEBUG BACKEND] Found %d subscription payments for chama %s", len(payments), chamaID)

	// If no payments exist, create a pending payment for the current/next month
	if len(payments) == 0 {
		var chamaAmount float64
		var monthlyFee *float64
		if err := database.QueryRow("SELECT monthly_subscription_fee FROM chamas WHERE id = $1", chamaID).Scan(&monthlyFee); err == nil && monthlyFee != nil && *monthlyFee > 0 {
			chamaAmount = *monthlyFee
		} else {
			chamaAmount = 1000
		}

		now := time.Now()
		dueDate := time.Date(now.Year(), now.Month()+1, 2, 0, 0, 0, 0, now.Location())
		if now.Day() > 2 {
			dueDate = time.Date(now.Year(), now.Month()+2, 2, 0, 0, 0, 0, now.Location())
		}
		monthYear := dueDate.Format("2006-01")
		paymentID := fmt.Sprintf("SUB_%d", time.Now().UnixNano())

		if _, err := database.Exec(
			"INSERT INTO subscription_payments (id, chama_id, amount, status, due_date, month_year, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
			paymentID, chamaID, chamaAmount, "pending", dueDate, monthYear, now, now,
		); err == nil {
			payments = append(payments, map[string]interface{}{
				"id":            paymentID,
				"chamaId":       chamaID,
				"amount":        chamaAmount,
				"status":        "pending",
				"dueDate":       dueDate,
				"paidAt":        nil,
				"paymentMethod": "",
				"transactionId": "",
				"monthYear":     monthYear,
				"createdAt":     now,
				"updatedAt":     now,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    payments,
	})
		c.Abort()
}

// PaySubscriptionPayment initiates an STK push payment for a subscription.
func PaySubscriptionPayment(c *gin.Context) {
	chamaID, ok := requireParam(c, "id", "Chama ID is required")
	if !ok {
		return
	}

	paymentID, ok := requireParam(c, "paymentId", "Payment ID is required")
	if !ok {
		return
	}

	database := dbFromContext(c)
	if database == nil {
		return
	}

	// Check user permissions - only Admin or chama members with chairperson/treasurer role can pay
	userID := c.GetString("userID")
	userRole := c.GetString("userRole")

	var memberRole string
	if err := database.QueryRow(
		"SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true",
		chamaID, userID,
	).Scan(&memberRole); err != nil {
		log.Printf("[DEBUG PaySubscriptionPayment] member role lookup err: %v", err)
	}

	canPay := false
	if strings.EqualFold(userRole, "admin") {
		canPay = true
	}
	if memberRole == "chairperson" || memberRole == "treasurer" {
		canPay = true
	}

	if !canPay {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied - only chairperson or treasurer can initiate subscription payments",
		})
		return
	}

	var payment struct {
		Amount float64
		Status string
	}

	if err := database.QueryRow(
		"SELECT amount, status FROM subscription_payments WHERE id = $1 AND chama_id = $2",
		paymentID, chamaID,
	).Scan(&payment.Amount, &payment.Status); err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Payment not found",
		})
		return
	}

	if payment.Status != "pending" && payment.Status != "overdue" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Payment is not in payable status",
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

	mpesaService := services.NewMpesaService(database, cfg.(*config.Config))

	// Get chama creator/owner phone for STK push
	var creatorPhone string
	if err := database.QueryRow("SELECT created_by FROM chamas WHERE id = $1", chamaID).Scan(&creatorPhone); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama creator not found",
		})
		return
	}

	var userPhone string
	if err := database.QueryRow("SELECT phone FROM users WHERE id = $1", creatorPhone).Scan(&userPhone); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "User phone number not found",
		})
		return
	}

	phoneNumber := normalizeMpesaPhone(userPhone)

	// Get or create chama wallet for subscription payment
	walletService := services.NewWalletService(database)
	chamaWallet, err := walletService.GetWalletByOwnerAndType(chamaID, models.WalletTypeChama)
	if err != nil {
		chamaWallet, err = walletService.CreateWallet(chamaID, models.WalletTypeChama)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create chama wallet",
			})
			return
		}
	}

	reference := fmt.Sprintf("SUB-%s-%s", chamaID[:8], time.Now().Format("20060102150405"))
	transactionID, err := createPendingMpesaTransaction(database, payment.Amount, reference, chamaWallet.ID, chamaID, "subscription", "subscription", userID)
	if err != nil {
		log.Printf("[DEBUG PaySubscriptionPayment] Failed to create pending transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create transaction record",
		})
		return
	}

	mpesaReq := models.MpesaTransaction{
		PhoneNumber:      phoneNumber,
		Amount:           payment.Amount,
		AccountReference: fmt.Sprintf("SUB-%s", chamaID[:8]),
		TransactionDesc:  "Chama Monthly Subscription",
	}

	stkResponse, err := mpesaService.InitiateSTKPush(&mpesaReq)
	if err != nil {
		log.Printf("[DEBUG PaySubscriptionPayment] STK Push failed: payment=%s amount=%.2f phone=%s err=%v", paymentID, payment.Amount, phoneNumber, err)
		_ = updateTransactionStatus(database, transactionID, models.TransactionStatusFailed)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to initiate STK push: " + err.Error(),
		})
		return
	}
	log.Printf("[DEBUG PaySubscriptionPayment] STK Push success: payment=%s transaction=%s checkout=%s phone=%s amount=%.2f", paymentID, transactionID, stkResponse.CheckoutRequestID, phoneNumber, payment.Amount)

	// Update transaction with checkout request ID
	_ = updateTransactionCheckoutRequestID(database, transactionID, stkResponse.CheckoutRequestID)

	now := time.Now()
	if _, err := database.Exec(
		"UPDATE subscription_payments SET transaction_id = $1, updated_at = $2 WHERE id = $3",
		stkResponse.CheckoutRequestID, now, paymentID,
	); err != nil {
		log.Printf("[DEBUG PaySubscriptionPayment] Error updating subscription payment checkout request id: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "STK push initiated successfully",
		"data": gin.H{
			"checkoutRequestId": stkResponse.CheckoutRequestID,
			"customerMessage":   stkResponse.CustomerMessage,
		},
	})
		c.Abort()
}
