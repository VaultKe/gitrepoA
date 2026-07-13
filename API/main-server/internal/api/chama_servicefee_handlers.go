package api

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"vaultke-backend/config"
	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"
	"vaultke-backend/internal/utils"

	"github.com/gin-gonic/gin"
)

// scanServiceFeeRows converts service_fee_payments rows (joined with users) into API maps.
func scanServiceFeeRows(rows *sql.Rows) []map[string]interface{} {
	var payments []map[string]interface{}
	for rows.Next() {
		var id, chamaID, userID, firstName, lastName, phone, status string
		var amount float64
		var dueDate, createdAt, updatedAt time.Time
		var paidAt *time.Time
		var paymentMethod, transactionID *string
		var warningSent bool

		if err := rows.Scan(&id, &chamaID, &userID, &firstName, &lastName, &phone,
			&amount, &status, &dueDate, &paidAt, &paymentMethod, &transactionID,
			&warningSent, &createdAt, &updatedAt); err != nil {
			continue
		}

		payments = append(payments, map[string]interface{}{
			"id":            id,
			"chamaId":       chamaID,
			"userId":        userID,
			"userName":      firstName + " " + lastName,
			"userPhone":     utils.MaskPhone(phone),
			"amount":        amount,
			"status":        status,
			"dueDate":       dueDate,
			"paidAt":        paidAt,
			"paymentMethod": paymentMethod,
			"transactionId": transactionID,
			"warningSent":   warningSent,
			"createdAt":     createdAt,
			"updatedAt":     updatedAt,
		})
	}
	return payments
}

// GetMemberServiceFeePayments gets service fee payments for a specific member.
func GetMemberServiceFeePayments(c *gin.Context) {
	chamaID, ok := requireParam(c, "id", "Chama ID and Member ID are required")
	if !ok {
		return
	}
	memberID, ok := requireParam(c, "memberId", "Chama ID and Member ID are required")
	if !ok {
		return
	}

	database := dbFromContext(c)
	if database == nil {
		return
	}

	query := `
		SELECT sfp.id, sfp.chama_id, sfp.user_id, u.first_name, u.last_name, u.phone,
			   sfp.amount, sfp.status, sfp.due_date, sfp.paid_at, sfp.payment_method,
			   sfp.transaction_id, sfp.warning_sent, sfp.created_at, sfp.updated_at
		FROM service_fee_payments sfp
		JOIN users u ON sfp.user_id = u.id
		WHERE sfp.chama_id = $1 AND sfp.user_id = $2
		ORDER BY sfp.created_at DESC
	`

	rows, err := database.Query(query, chamaID, memberID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get service fee payments",
		})
		return
	}
	defer rows.Close()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    scanServiceFeeRows(rows),
	})
}

// GetChamaServiceFeePayments gets service fee payments for members of a chama.
func GetChamaServiceFeePayments(c *gin.Context) {
	chamaID, ok := requireParam(c, "id", "Chama ID is required")
	if !ok {
		return
	}

	database := dbFromContext(c)
	if database == nil {
		return
	}

	query := `
		SELECT sfp.id, sfp.chama_id, sfp.user_id, u.first_name, u.last_name, u.phone,
			   sfp.amount, sfp.status, sfp.due_date, sfp.paid_at, sfp.payment_method,
			   sfp.transaction_id, sfp.warning_sent, sfp.created_at, sfp.updated_at
		FROM service_fee_payments sfp
		JOIN users u ON sfp.user_id = u.id
		WHERE sfp.chama_id = $1
		ORDER BY sfp.created_at DESC
	`

	rows, err := database.Query(query, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get service fee payments",
		})
		return
	}
	defer rows.Close()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    scanServiceFeeRows(rows),
	})
}

// PayServiceFeePayment initiates an STK push payment for a member's registration fee.
func PayServiceFeePayment(c *gin.Context) {
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

	var payment struct {
		Amount float64
		Status string
		UserID string
	}

	if err := database.QueryRow(
		"SELECT amount, status, user_id FROM service_fee_payments WHERE id = $1 AND chama_id = $2",
		paymentID, chamaID,
	).Scan(&payment.Amount, &payment.Status, &payment.UserID); err != nil {
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

	var memberPhone string
	if err := database.QueryRow("SELECT phone FROM users WHERE id = $1", payment.UserID).Scan(&memberPhone); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Member phone number not found",
		})
		return
	}

	phoneNumber := normalizeMpesaPhone(memberPhone)

	walletService := services.NewWalletService(database)
	registrationWallet, err := walletService.GetWalletByOwnerAndType("subscription", models.WalletTypeBusiness)
	if err != nil {
		registrationWallet, err = walletService.CreateWallet("subscription", models.WalletTypeBusiness)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create registration wallet",
			})
			return
		}
	}

	reference := fmt.Sprintf("REG-%s-%s", chamaID[:8], time.Now().Format("20060102150405"))
	transactionID, err := createPendingMpesaTransaction(database, payment.Amount, reference, registrationWallet.ID, chamaID, "fees", "registration", payment.UserID)
	if err != nil {
		log.Printf("[DEBUG PayServiceFeePayment] Failed to create pending transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create transaction record",
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

	mpesaReq := models.MpesaTransaction{
		PhoneNumber:      phoneNumber,
		Amount:           payment.Amount,
		AccountReference: fmt.Sprintf("REG-FEE-%s", chamaID[:8]),
		TransactionDesc:  "Chama Registration Fee",
	}

	stkResponse, err := mpesaService.InitiateSTKPush(&mpesaReq)
	if err != nil {
		log.Printf("[DEBUG PayServiceFeePayment] STK Push failed: payment=%s amount=%.2f phone=%s err=%v", paymentID, payment.Amount, phoneNumber, err)
		updateTransactionStatus(database, transactionID, models.TransactionStatusFailed)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to initiate STK push: " + err.Error(),
		})
		return
	}
	log.Printf("[DEBUG PayServiceFeePayment] STK Push success: payment=%s transaction=%s checkout=%s phone=%s amount=%.2f msg=%s", paymentID, transactionID, stkResponse.CheckoutRequestID, phoneNumber, payment.Amount, stkResponse.CustomerMessage)

	updateTransactionCheckoutRequestID(database, transactionID, stkResponse.CheckoutRequestID)

	now := time.Now()
	if _, err := database.Exec(
		"UPDATE service_fee_payments SET transaction_id = $1, updated_at = $2 WHERE id = $3",
		transactionID, now, paymentID,
	); err != nil {
		log.Printf("Error updating service fee payment: %v", err)
	}

	if _, err := database.Exec(
		"UPDATE chama_members SET service_fee_paid = false, service_fee_paid_at = NULL, service_fee_status = 'pending' WHERE chama_id = $1 AND user_id = $2",
		chamaID, payment.UserID,
	); err != nil {
		log.Printf("Error updating member service fee status: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "STK push initiated successfully",
		"data": gin.H{
			"checkoutRequestId": stkResponse.CheckoutRequestID,
			"transactionId":     transactionID,
			"customerMessage":   stkResponse.CustomerMessage,
		},
	})
}

// PayMemberServiceFee creates a service fee record and initiates STK push for a member.
func PayMemberServiceFee(c *gin.Context) {
	chamaID, ok := requireParam(c, "id", "Chama ID and Member ID are required")
	if !ok {
		return
	}
	memberID, ok := requireParam(c, "memberId", "Chama ID and Member ID are required")
	if !ok {
		return
	}
	log.Printf("[DEBUG PayMemberServiceFee] called chama=%s member=%s", chamaID, memberID)

	database := dbFromContext(c)
	if database == nil {
		return
	}

	// Get member's phone number and check if already paid
	var memberPhone string
	var alreadyPaid bool
	if err := database.QueryRow(
		"SELECT u.phone, cm.service_fee_paid FROM users u JOIN chama_members cm ON u.id = cm.user_id WHERE cm.user_id = $1 AND cm.chama_id = $2",
		memberID, chamaID,
	).Scan(&memberPhone, &alreadyPaid); err != nil {
		log.Printf("Member query result: phone=%s alreadyPaid=%v err=%v", memberPhone, alreadyPaid, err)
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Member not found",
		})
		return
	}

	if alreadyPaid {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Service fee already paid",
		})
		return
	}

	phoneNumber := normalizeMpesaPhone(memberPhone)

	cfg, exists := c.Get("config")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Configuration not available",
		})
		return
	}

	mpesaService := services.NewMpesaService(database, cfg.(*config.Config))

	// Get or create registration wallet
	walletService := services.NewWalletService(database)
	registrationWallet, err := walletService.GetWalletByOwnerAndType("subscription", models.WalletTypeBusiness)
	if err != nil {
		registrationWallet, err = walletService.CreateWallet("subscription", models.WalletTypeBusiness)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create registration wallet",
			})
			return
		}
	}

	paymentID := fmt.Sprintf("SFP_%d", time.Now().UnixNano())
	reference := fmt.Sprintf("REG-%s-%s", chamaID[:8], time.Now().Format("20060102150405"))
	transactionID, err := createPendingMpesaTransaction(database, 50, reference, registrationWallet.ID, chamaID, "fees", "registration", memberID)
	if err != nil {
		log.Printf("Failed to create pending transaction for service fee: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create transaction record",
		})
		return
	}

	mpesaReq := models.MpesaTransaction{
		PhoneNumber:      phoneNumber,
		Amount:           50,
		AccountReference: fmt.Sprintf("REG-FEE-%s", chamaID[:8]),
		TransactionDesc:  "Chama Registration Fee",
	}

	stkResponse, err := mpesaService.InitiateSTKPush(&mpesaReq)
	if err != nil {
		log.Printf("[DEBUG PayMemberServiceFee] STK Push failed: member=%s phone=%s amount=%.2f err=%v", memberID, phoneNumber, 50.0, err)
		updateTransactionStatus(database, transactionID, models.TransactionStatusFailed)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to initiate STK push: " + err.Error(),
		})
		return
	}
	log.Printf("[DEBUG PayMemberServiceFee] STK Push success: member=%s payment=%s transaction=%s checkout=%s phone=%s amount=%.2f msg=%s", memberID, paymentID, transactionID, stkResponse.CheckoutRequestID, phoneNumber, 50.0, stkResponse.CustomerMessage)

	updateTransactionCheckoutRequestID(database, transactionID, stkResponse.CheckoutRequestID)

	now := time.Now()

	if _, err := database.Exec(
		"INSERT INTO service_fee_payments (id, chama_id, user_id, amount, status, due_date, transaction_id, created_at, updated_at) VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8)",
		paymentID, chamaID, memberID, 50, now, transactionID, now, now,
	); err != nil {
		log.Printf("Error creating service fee payment: %v", err)
	}

	if _, err := database.Exec(
		"UPDATE chama_members SET service_fee_paid = false, service_fee_paid_at = NULL, service_fee_status = 'pending' WHERE chama_id = $1 AND user_id = $2",
		chamaID, memberID,
	); err != nil {
		log.Printf("Error updating member service fee status: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "STK push initiated successfully",
		"data": gin.H{
			"checkoutRequestId": stkResponse.CheckoutRequestID,
			"transactionId":     transactionID,
			"customerMessage":   stkResponse.CustomerMessage,
		},
	})
}
