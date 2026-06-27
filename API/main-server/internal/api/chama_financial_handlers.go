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

	"github.com/gin-gonic/gin"
)

// CreateIndividualDisbursement creates an individual disbursement
func CreateIndividualDisbursement(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	// Parse request body
	var req struct {
		Type          string  `json:"type" binding:"required"`
		Category      string  `json:"category" binding:"required"`
		MemberID      string  `json:"memberId" binding:"required"`
		MemberName    string  `json:"memberName" binding:"required"`
		Amount        float64 `json:"amount" binding:"required"`
		Purpose       string  `json:"purpose" binding:"required"`
		PrivateNote   string  `json:"privateNote"`
		FromAccount   string  `json:"fromAccount" binding:"required"`
		ToAccount     string  `json:"toAccount" binding:"required"`
		RecipientID   string  `json:"recipientId" binding:"required"`
		InitiatedBy   string  `json:"initiatedBy" binding:"required"`
		InitiatedByID string  `json:"initiatedById" binding:"required"`
		Timestamp     string  `json:"timestamp" binding:"required"`
		Status        string  `json:"status" binding:"required"`
		TransactionID string  `json:"transactionId" binding:"required"`
		SecurityHash  string  `json:"securityHash" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
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

	// Start transaction
	tx, err := db.(*sql.DB).Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start transaction: " + err.Error(),
		})
		return
	}
	defer tx.Rollback()

	query := `
		INSERT INTO disbursements (
			id, chama_id, type, category, member_id, member_name, amount, purpose,
			private_note, from_account, to_account, initiated_by, initiated_by_id,
			timestamp, status, transaction_id, security_hash, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
	`

	disburseID := fmt.Sprintf("DISB_%d", time.Now().UnixNano())
	now := time.Now()

	recipientWalletID := fmt.Sprintf("wallet-personal-%s", req.RecipientID)

	_, err = tx.Exec(query,
		disburseID, chamaID, req.Type, req.Category, req.MemberID, req.MemberName,
		req.Amount, req.Purpose, req.PrivateNote, req.FromAccount, req.ToAccount,
		req.InitiatedBy, req.InitiatedByID, req.Timestamp, req.Status,
		req.TransactionID, req.SecurityHash, now, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create disbursement: " + err.Error(),
		})
		return
	}

	var currentBalance float64
	err = tx.QueryRow("SELECT balance FROM wallets WHERE id = $1", recipientWalletID).Scan(&currentBalance)
	if err == sql.ErrNoRows {
		_, err = tx.Exec(
			"INSERT INTO wallets (id, type, owner_id, balance, currency, is_active, is_locked, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
			recipientWalletID, models.WalletTypePersonal, req.RecipientID, req.Amount, "KES", true, false, now, now,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create recipient wallet: " + err.Error(),
			})
			return
		}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to check recipient wallet: " + err.Error(),
		})
		return
	} else {
		_, err = tx.Exec("UPDATE wallets SET balance = $1, updated_at = $2 WHERE id = $3", currentBalance+req.Amount, now, recipientWalletID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to credit recipient wallet: " + err.Error(),
			})
			return
		}
	}

	err = tx.Commit()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to commit transaction: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Individual disbursement created successfully",
		"data": gin.H{
			"id":             disburseID,
			"recipientId":    req.RecipientID,
			"creditedAmount": req.Amount,
			"walletId":       recipientWalletID,
		},
	})
}

// CreateBulkDisbursement creates a bulk disbursement (dividends)
func CreateBulkDisbursement(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	// Parse request body
	var req struct {
		Type             string                   `json:"type" binding:"required"`
		Category         string                   `json:"category" binding:"required"`
		DividendPerShare float64                  `json:"dividendPerShare" binding:"required"`
		TotalAmount      float64                  `json:"totalAmount" binding:"required"`
		Description      string                   `json:"description"`
		EligibleMembers  []map[string]interface{} `json:"eligibleMembers" binding:"required"`
		FromAccount      string                   `json:"fromAccount" binding:"required"`
		InitiatedBy      string                   `json:"initiatedBy" binding:"required"`
		InitiatedByID    string                   `json:"initiatedById" binding:"required"`
		Timestamp        string                   `json:"timestamp" binding:"required"`
		Status           string                   `json:"status" binding:"required"`
		TransactionID    string                   `json:"transactionId" binding:"required"`
		SecurityHash     string                   `json:"securityHash" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
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

	// Insert bulk disbursement record
	bulkID := fmt.Sprintf("BULK_%d", time.Now().Unix())
	now := time.Now()

	bulkQuery := `
		INSERT INTO bulk_disbursements (
			id, chama_id, type, category, dividend_per_share, total_amount, description,
			from_account, initiated_by, initiated_by_id, timestamp, status,
			transaction_id, security_hash, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`

	_, err = tx.Exec(
		bulkQuery,
		bulkID, chamaID, req.Type, req.Category, req.DividendPerShare, req.TotalAmount,
		req.Description, req.FromAccount, req.InitiatedBy, req.InitiatedByID,
		req.Timestamp, req.Status, req.TransactionID, req.SecurityHash, now, now,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create bulk disbursement: " + err.Error(),
		})
		return
	}

	// Insert individual dividend records
	dividendQuery := `
		INSERT INTO dividends (
			id, bulk_disbursement_id, chama_id, member_id, member_name, shares_owned,
			dividend_per_share, amount, status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	for _, member := range req.EligibleMembers {
		memberID, ok := member["id"].(string)
		if !ok {
			continue
		}
		memberName, _ := member["name"].(string)
		sharesOwned, _ := member["sharesOwned"].(float64)

		dividendID := fmt.Sprintf("DIV_%d_%s", time.Now().UnixNano(), memberID)
		amount := sharesOwned * req.DividendPerShare

		_, err = tx.Exec(
			dividendQuery,
			dividendID, bulkID, chamaID, memberID, memberName, int(sharesOwned),
			req.DividendPerShare, amount, "pending", now, now,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create dividend record: " + err.Error(),
			})
			return
		}
	}

	// Commit transaction
	err = tx.Commit()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to commit transaction",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Bulk disbursement created successfully",
		"data": gin.H{
			"id": bulkID,
		},
	})
}

// GetChamaSubscriptionPayments gets subscription payments for a chama
func GetChamaSubscriptionPayments(c *gin.Context) {
	chamaID := c.Param("id")
	log.Printf("[DEBUG BACKEND] GetChamaSubscriptionPayments called with chamaID: %s", chamaID)
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
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
		var rowID, rowChamaID, status, monthYear, paymentMethod, transactionID string
		var amount float64
		var dueDate, paidAt, createdAt, updatedAt time.Time

		err := rows.Scan(&rowID, &rowChamaID, &amount, &status, &dueDate, &paidAt, &paymentMethod, &transactionID, &monthYear, &createdAt, &updatedAt)
		if err != nil {
			log.Printf("[DEBUG BACKEND] Scan error: %v", err)
			continue
		}

		payment := map[string]interface{}{
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
		}
		payments = append(payments, payment)
	}
	log.Printf("[DEBUG BACKEND] Found %d subscription payments for chama %s", len(payments), chamaID)

	// If no payments exist, create a pending payment for the current/next month
	if len(payments) == 0 {
		var chamaAmount float64
		var monthlyFee *float64
		err = database.QueryRow("SELECT monthly_subscription_fee FROM chamas WHERE id = $1", chamaID).Scan(&monthlyFee)
		if err == nil && monthlyFee != nil && *monthlyFee > 0 {
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

		_, err = database.Exec(
			"INSERT INTO subscription_payments (id, chama_id, amount, status, due_date, month_year, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
			paymentID, chamaID, chamaAmount, "pending", dueDate, monthYear, now, now,
		)
		if err == nil {
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
}

// PaySubscriptionPayment initiates STK push payment for a subscription
func PaySubscriptionPayment(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	paymentID := c.Param("paymentId")
	if paymentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Payment ID is required",
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

	// Check user permissions - only Admin or chama members with chairperson/treasurer role can pay
	userID := c.GetString("userID")
	userRole := c.GetString("userRole")

	var memberRole string
	err := database.QueryRow(
		"SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true",
		chamaID, userID,
	).Scan(&memberRole)

	canPay := strings.ToLower(userRole) == "admin"
	if err == nil && (memberRole == "chairperson" || memberRole == "treasurer") {
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

	err = database.QueryRow(
		"SELECT amount, status FROM subscription_payments WHERE id = $1 AND chama_id = $2",
		paymentID, chamaID,
	).Scan(&payment.Amount, &payment.Status)

	if err != nil {
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

	// Initiate M-Pesa STK push
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
	err = database.QueryRow("SELECT created_by FROM chamas WHERE id = $1", chamaID).Scan(&creatorPhone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama creator not found",
		})
		return
	}

	// Get creator's user phone
	var userPhone string
	err = database.QueryRow("SELECT phone FROM users WHERE id = $1", creatorPhone).Scan(&userPhone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "User phone number not found",
		})
		return
	}

	phoneNumber := userPhone
	if strings.HasPrefix(phoneNumber, "07") {
		phoneNumber = "254" + phoneNumber[1:]
	} else if strings.HasPrefix(phoneNumber, "+254") {
		phoneNumber = phoneNumber[1:]
	}

	mpesaReq := models.MpesaTransaction{
		PhoneNumber:      phoneNumber,
		Amount:           payment.Amount,
		AccountReference: fmt.Sprintf("SUB-%s", chamaID[:8]),
		TransactionDesc:  "Chama Monthly Subscription",
	}

	stkResponse, err := mpesaService.InitiateSTKPush(&mpesaReq)
	if err != nil {
		log.Printf("STK Push failed for subscription: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to initiate STK push: " + err.Error(),
		})
		return
	}

	updateTransactionCheckoutRequestID(database, paymentID, stkResponse.CheckoutRequestID)

	now := time.Now()
	_, err = database.Exec(
		"UPDATE subscription_payments SET status = 'paid', paid_at = $1, updated_at = $2, transaction_id = $3 WHERE id = $4",
		now, now, stkResponse.CheckoutRequestID, paymentID,
	)
	if err != nil {
		log.Printf("Error updating subscription payment: %v", err)
	}

	_, err = database.Exec(
		"UPDATE chamas SET subscription_fee_paid = true WHERE id = $1",
		chamaID,
	)
	if err != nil {
		log.Printf("Error updating chama subscription status: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "STK push initiated successfully",
		"data": gin.H{
			"checkoutRequestId": stkResponse.CheckoutRequestID,
			"customerMessage":   stkResponse.CustomerMessage,
		},
	})
}

// GetMemberServiceFeePayments gets service fee payments for a specific member
func GetMemberServiceFeePayments(c *gin.Context) {
	chamaID := c.Param("id")
	memberID := c.Param("memberId")
	if chamaID == "" || memberID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID and Member ID are required",
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

	var payments []map[string]interface{}
	for rows.Next() {
		var id, chamaID, userID, firstName, lastName, phone, status, paymentMethod, transactionID string
		var amount float64
		var dueDate, paidAt, createdAt, updatedAt time.Time
		var warningSent bool

		err := rows.Scan(&id, &chamaID, &userID, &firstName, &lastName, &phone,
			&amount, &status, &dueDate, &paidAt, &paymentMethod, &transactionID,
			&warningSent, &createdAt, &updatedAt)
		if err != nil {
			continue
		}

		payment := map[string]interface{}{
			"id":            id,
			"chamaId":       chamaID,
			"userId":        userID,
			"userName":      firstName + " " + lastName,
			"userPhone":     phone,
			"amount":        amount,
			"status":        status,
			"dueDate":       dueDate,
			"paidAt":        paidAt,
			"paymentMethod": paymentMethod,
			"transactionId": transactionID,
			"warningSent":   warningSent,
			"createdAt":     createdAt,
			"updatedAt":     updatedAt,
		}
		payments = append(payments, payment)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    payments,
	})
}

// GetChamaServiceFeePayments gets service fee payments for members of a chama
func GetChamaServiceFeePayments(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
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

	var payments []map[string]interface{}
	for rows.Next() {
		var id, chamaID, userID, firstName, lastName, phone, status, paymentMethod, transactionID string
		var amount float64
		var dueDate, paidAt, createdAt, updatedAt time.Time
		var warningSent bool

		err := rows.Scan(&id, &chamaID, &userID, &firstName, &lastName, &phone,
			&amount, &status, &dueDate, &paidAt, &paymentMethod, &transactionID,
			&warningSent, &createdAt, &updatedAt)
		if err != nil {
			continue
		}

		payment := map[string]interface{}{
			"id":            id,
			"chamaId":       chamaID,
			"userId":        userID,
			"userName":      firstName + " " + lastName,
			"userPhone":     phone,
			"amount":        amount,
			"status":        status,
			"dueDate":       dueDate,
			"paidAt":        paidAt,
			"paymentMethod": paymentMethod,
			"transactionId": transactionID,
			"warningSent":   warningSent,
			"createdAt":     createdAt,
			"updatedAt":     updatedAt,
		}
		payments = append(payments, payment)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    payments,
	})
}

// PayServiceFeePayment initiates STK push payment for a member's registration fee
func PayServiceFeePayment(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	paymentID := c.Param("paymentId")
	if paymentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Payment ID is required",
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

	var payment struct {
		Amount float64
		Status string
		UserID string
	}

	err := database.QueryRow(
		"SELECT amount, status, user_id FROM service_fee_payments WHERE id = $1 AND chama_id = $2",
		paymentID, chamaID,
	).Scan(&payment.Amount, &payment.Status, &payment.UserID)

	if err != nil {
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

	// Get member's phone number
	var memberPhone string
	err = database.QueryRow("SELECT phone FROM users WHERE id = $1", payment.UserID).Scan(&memberPhone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Member phone number not found",
		})
		return
	}

	// Convert phone number to M-Pesa format
	phoneNumber := memberPhone
	if strings.HasPrefix(phoneNumber, "07") {
		phoneNumber = "254" + phoneNumber[1:]
	} else if strings.HasPrefix(phoneNumber, "+254") {
		phoneNumber = phoneNumber[1:]
	}

	// Initiate M-Pesa STK push
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
		log.Printf("STK Push failed for registration fee: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to initiate STK push: " + err.Error(),
		})
		return
	}

	// Update checkout request ID on payment record
	updateTransactionCheckoutRequestID(database, paymentID, stkResponse.CheckoutRequestID)

	// Mark as paid immediately (callback will confirm later)
	now := time.Now()
	_, err = database.Exec(
		"UPDATE service_fee_payments SET status = 'paid', paid_at = $1, updated_at = $2, transaction_id = $3 WHERE id = $4",
		now, now, stkResponse.CheckoutRequestID, paymentID,
	)
	if err != nil {
		log.Printf("Error updating service fee payment: %v", err)
	}

	_, err = database.Exec(
		"UPDATE chama_members SET service_fee_paid = true, service_fee_paid_at = $1, service_fee_status = 'paid' WHERE chama_id = $2 AND user_id = $3",
		now, chamaID, payment.UserID,
	)
	if err != nil {
		log.Printf("Error updating member service fee status: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "STK push initiated successfully",
		"data": gin.H{
			"checkoutRequestId": stkResponse.CheckoutRequestID,
			"customerMessage":   stkResponse.CustomerMessage,
		},
	})
}

// PayMemberServiceFee creates a service fee record and initiates STK push for a member
func PayMemberServiceFee(c *gin.Context) {
	chamaID := c.Param("id")
	memberID := c.Param("memberId")
	log.Printf("PayMemberServiceFee called: chama=%s member=%s", chamaID, memberID)
	if chamaID == "" || memberID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID and Member ID are required",
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

	// Get member's phone number and check if already paid
	var memberPhone string
	var alreadyPaid bool
	err := database.QueryRow(
		"SELECT u.phone, cm.service_fee_paid FROM users u JOIN chama_members cm ON u.id = cm.user_id WHERE cm.user_id = $1 AND cm.chama_id = $2",
		memberID, chamaID,
	).Scan(&memberPhone, &alreadyPaid)
	log.Printf("Member query result: phone=%s alreadyPaid=%v err=%v", memberPhone, alreadyPaid, err)
	if err != nil {
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

	// Convert phone number to M-Pesa format
	phoneNumber := memberPhone
	if strings.HasPrefix(phoneNumber, "07") {
		phoneNumber = "254" + phoneNumber[1:]
	} else if strings.HasPrefix(phoneNumber, "+254") {
		phoneNumber = phoneNumber[1:]
	}

	// Initiate M-Pesa STK push
	cfg, exists := c.Get("config")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Configuration not available",
		})
		return
	}

	mpesaService := services.NewMpesaService(database, cfg.(*config.Config))

	paymentID := fmt.Sprintf("SFP_%d", time.Now().UnixNano())
	mpesaReq := models.MpesaTransaction{
		PhoneNumber:      phoneNumber,
		Amount:           50,
		AccountReference: fmt.Sprintf("REG-FEE-%s", chamaID[:8]),
		TransactionDesc:  "Chama Registration Fee",
	}

	stkResponse, err := mpesaService.InitiateSTKPush(&mpesaReq)
	if err != nil {
		log.Printf("STK Push failed for registration fee: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to initiate STK push: " + err.Error(),
		})
		return
	}
	log.Printf("STK Push success: checkoutRequestId=%s customerMessage=%s", stkResponse.CheckoutRequestID, stkResponse.CustomerMessage)

	now := time.Now()

	// Create service fee payment record
	_, err = database.Exec(
		"INSERT INTO service_fee_payments (id, chama_id, user_id, amount, status, due_date, transaction_id, paid_at, created_at, updated_at) VALUES ($1, $2, $3, $4, 'paid', $5, $6, $7, $8, $9)",
		paymentID, chamaID, memberID, 50, now, stkResponse.CheckoutRequestID, now, now, now,
	)
	if err != nil {
		log.Printf("Error creating service fee payment: %v", err)
	}

	// Update member status
	_, err = database.Exec(
		"UPDATE chama_members SET service_fee_paid = true, service_fee_paid_at = $1, service_fee_status = 'paid' WHERE chama_id = $2 AND user_id = $3",
		now, chamaID, memberID,
	)
	if err != nil {
		log.Printf("Error updating member service fee status: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "STK push initiated successfully",
		"data": gin.H{
			"checkoutRequestId": stkResponse.CheckoutRequestID,
			"customerMessage":   stkResponse.CustomerMessage,
		},
	})
}
