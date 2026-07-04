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

func getDisbursementSourceWalletID(db *sql.DB, chamaID, category string) (string, error) {
	var subwalletType models.ChamaWalletType
	if category == "welfare" {
		subwalletType = models.ChamaWalletTypeWelfare
	} else if category == "merry_go_round" {
		subwalletType = models.ChamaWalletTypeMerryGo
	} else {
		return "", fmt.Errorf("unsupported disbursement category: %s", category)
	}

	sourceWalletID := fmt.Sprintf("wallet-%s-%s", chamaID, subwalletType)
	paybillService := services.NewPaybillTrackingService(db)
	_, err := paybillService.ValidateDisbursementSource(sourceWalletID, chamaID)
	if err != nil {
		return "", err
	}

	return sourceWalletID, nil
}

func normalizePhoneNumber(phone string) (string, error) {
	if strings.HasPrefix(phone, "07") {
		return "254" + phone[1:], nil
	}
	if strings.HasPrefix(phone, "+254") {
		return phone[1:], nil
	}
	if strings.HasPrefix(phone, "254") {
		return phone, nil
	}
	return "", fmt.Errorf("invalid phone number format. must start with 254 or 07")
}

// CreateIndividualDisbursement creates an individual disbursement (welfare)
// Sends funds directly to member's MPesa number via B2C
func CreateIndividualDisbursement(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
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

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}
	database := db.(*sql.DB)

	if req.Category != "welfare" && req.Category != "merry_go_round" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Unsupported disbursement category for approval gating",
		})
		return
	}

	sourceWalletID, err := getDisbursementSourceWalletID(database, chamaID, req.Category)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid source wallet: " + err.Error(),
		})
		return
	}

	var recipientPhone string
	err = database.QueryRow("SELECT phone FROM users WHERE id = $1", req.RecipientID).Scan(&recipientPhone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Recipient not found or phone number not available",
		})
		return
	}

	phoneNumber, err := normalizePhoneNumber(recipientPhone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	now := time.Now()
	transactionID := req.TransactionID
	if transactionID == "" {
		transactionID = fmt.Sprintf("TXN_%d", now.UnixNano())
	}

	var timestamp time.Time
	if req.Timestamp != "" {
		timestamp, err = time.Parse(time.RFC3339, req.Timestamp)
		if err != nil {
			timestamp = now
		}
	} else {
		timestamp = now
	}

	tx, err := database.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start transaction: " + err.Error(),
		})
		return
	}
	defer tx.Rollback()

	batchID := fmt.Sprintf("BATCH_%d", now.UnixNano())
	batchTitle := strings.Title(strings.ReplaceAll(req.Category, "_", " ")) + " disbursement"
	_, err = tx.Exec(`
		INSERT INTO disbursement_batches (
			id, chama_id, batch_type, title, description, total_amount,
			total_recipients, initiated_by, status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10)
	`, batchID, chamaID, req.Category, batchTitle, req.Purpose, req.Amount, 1, userID, now, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create disbursement batch: " + err.Error(),
		})
		return
	}

	_, err = tx.Exec(`
		INSERT INTO transactions (
			id, from_wallet_id, chama_id, recipient_id, member_id, type,
			status, amount, currency, description, reference, payment_method,
			initiated_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, 'KES', $8, $9, 'mobile_money', $10, $11, $12)
	`, transactionID, sourceWalletID, chamaID, req.RecipientID, req.MemberID, req.Type, req.Amount, req.Purpose, fmt.Sprintf("PENDING-%s-%s", batchID, req.RecipientID), userID, now, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create transaction record: " + err.Error(),
		})
		return
	}

	disburseID := fmt.Sprintf("DISB_%d", now.UnixNano())
	_, err = tx.Exec(`
		INSERT INTO disbursements (
			id, batch_id, chama_id, type, category, recipient_id,
			member_id, member_name, amount, purpose, private_note,
			from_account, to_account, initiated_by, initiated_by_id,
			timestamp, status, transaction_id, security_hash,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15, $16, 'pending', $17, $18, $19, $20)
	`, disburseID, batchID, chamaID, req.Type, req.Category, req.RecipientID,
		req.MemberID, req.MemberName, req.Amount, req.Purpose, req.PrivateNote,
		sourceWalletID, fmt.Sprintf("mpesa-%s", phoneNumber), req.InitiatedBy, req.InitiatedByID,
		timestamp, transactionID, req.SecurityHash, now, now)
	if err != nil {
		log.Printf("Failed to create disbursement record: %v", err)
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to commit transaction: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Individual disbursement created and pending approval",
		"data": gin.H{
			"batchId":        batchID,
			"disbursementId": disburseID,
			"recipientId":    req.RecipientID,
			"recipientPhone": utils.MaskPhone(phoneNumber),
			"amount":         req.Amount,
			"transactionId":  transactionID,
		},
	})
}

// CreateBulkDisbursement creates a bulk disbursement (welfare bulk, dividends, etc.)
// For welfare/mgr categories - sends funds directly to members' MPesa numbers via B2C
// For dividends - just creates records (dividend disbursement handled separately)
func CreateBulkDisbursement(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

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
		DividendPerShare float64                  `json:"dividendPerShare"`
		TotalAmount      float64                  `json:"totalAmount" binding:"required"`
		Description      string                   `json:"description"`
		EligibleMembers  []map[string]interface{} `json:"eligibleMembers" binding:"required"`
		FromAccount      string                   `json:"fromAccount" binding:"required"`
		InitiatedBy      string                   `json:"initiatedBy" binding:"required"`
		InitiatedByID    string                   `json:"initiatedById" binding:"required"`
		Timestamp        string                   `json:"timestamp"`
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

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}
	database := db.(*sql.DB)

	var timestamp time.Time
	if req.Timestamp != "" {
		parsedTime, err := time.Parse(time.RFC3339, req.Timestamp)
		if err != nil {
			timestamp = time.Now()
		} else {
			timestamp = parsedTime
		}
	} else {
		timestamp = time.Now()
	}

	now := time.Now()

	// Start transaction
	tx, err := database.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start transaction",
		})
		return
	}
	defer tx.Rollback()

	// Insert bulk disbursement record
	bulkID := fmt.Sprintf("BULK_%d", now.UnixNano())
	bulkStatus := req.Status
	if req.Category == "welfare" || req.Category == "merry_go_round" {
		bulkStatus = "pending"
	}

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
		timestamp, bulkStatus, req.TransactionID, req.SecurityHash, now, now,
	)

	if err != nil {
		log.Printf("Failed to create bulk disbursement: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create bulk disbursement: " + err.Error(),
		})
		return
	}

	// For welfare/mgr categories, we create a pending approval batch and disbursement records.
	// For dividends, we continue with existing dividend record creation flow.
	isWelfareOrMGR := req.Category == "welfare" || req.Category == "merry_go_round"

	var successfulDisbursements int
	var failedDisbursements int
	var batchID string

	if isWelfareOrMGR {
		sourceWalletID, err := getDisbursementSourceWalletID(database, chamaID, req.Category)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Invalid source wallet: " + err.Error(),
			})
			return
		}

		batchID = fmt.Sprintf("BATCH_%d", now.UnixNano())
		batchTitle := strings.Title(strings.ReplaceAll(req.Category, "_", " ")) + " bulk disbursement"
		_, err = tx.Exec(`
			INSERT INTO disbursement_batches (
				id, chama_id, batch_type, title, description, total_amount,
				total_recipients, initiated_by, status, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10)
		`, batchID, chamaID, req.Category, batchTitle, req.Description, req.TotalAmount, len(req.EligibleMembers), userID, now, now)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create disbursement batch: " + err.Error(),
			})
			return
		}

		for _, member := range req.EligibleMembers {
			memberID, ok := member["id"].(string)
			if !ok {
				failedDisbursements++
				continue
			}
			memberName, _ := member["name"].(string)
			var memberAmount float64
			if amt, ok := member["amount"].(float64); ok {
				memberAmount = amt
			} else {
				failedDisbursements++
				continue
			}

			var memberPhone string
			err = tx.QueryRow("SELECT phone FROM users WHERE id = $1", memberID).Scan(&memberPhone)
			if err != nil {
				log.Printf("Skipping member %s - phone not found: %v", memberID, err)
				failedDisbursements++
				continue
			}

			phoneNumber, err := normalizePhoneNumber(memberPhone)
			if err != nil {
				log.Printf("Skipping member %s - invalid phone format: %s", memberID, memberPhone)
				failedDisbursements++
				continue
			}

			transactionID := fmt.Sprintf("TXN_%d", now.UnixNano())
			description := "Bulk " + req.Category + " disbursement"

			_, err = tx.Exec(`
				INSERT INTO transactions (
					id, from_wallet_id, chama_id, recipient_id, member_id, type, status, amount,
					currency, description, reference, payment_method, initiated_by, created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, 'KES', $8, $9, 'mobile_money', $10, $11, $12)
			`, transactionID, sourceWalletID, chamaID, memberID, memberID, req.Type, memberAmount, description, fmt.Sprintf("PENDING-%s-%s", batchID, memberID), userID, now, now)
			if err != nil {
				log.Printf("Failed to create transaction for member %s: %v", memberID, err)
				failedDisbursements++
				continue
			}

			disburseID := fmt.Sprintf("DISB_%d", now.UnixNano())
			_, err = tx.Exec(`
				INSERT INTO disbursements (
					id, batch_id, chama_id, type, category, recipient_id,
					member_id, member_name, amount, purpose, private_note,
					from_account, to_account, initiated_by, initiated_by_id,
					timestamp, status, transaction_id, security_hash,
					created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
					$11, $12, $13, $14, $15, $16, 'pending', $17, $18, $19, $20)
			`, disburseID, batchID, chamaID, req.Type, req.Category, memberID,
				memberID, memberName, memberAmount, req.Description, "",
				sourceWalletID, fmt.Sprintf("mpesa-%s", phoneNumber), req.InitiatedBy, req.InitiatedByID,
				timestamp, transactionID, req.SecurityHash, now, now)
			if err != nil {
				log.Printf("Failed to create disbursement record for member %s: %v", memberID, err)
			}

			successfulDisbursements++
		}
	} else {
		// For dividends - just create dividend records
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

			// Calculate amount from shares if not provided
			var memberAmount float64
			if amt, ok := member["amount"].(float64); ok {
				memberAmount = amt
			} else {
				memberAmount = sharesOwned * req.DividendPerShare
			}

			dividendID := fmt.Sprintf("DIV_%d_%s", now.UnixNano(), memberID)

			_, err = tx.Exec(
				dividendQuery,
				dividendID, bulkID, chamaID, memberID, memberName, int(sharesOwned),
				req.DividendPerShare, memberAmount, "pending", now, now,
			)

			if err != nil {
				log.Printf("Failed to create dividend record for member %s: %v", memberID, err)
				continue
			}
			successfulDisbursements++
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
		"message": "Bulk disbursement processed successfully",
		"data": gin.H{
			"id":                      bulkID,
			"successfulDisbursements": successfulDisbursements,
			"failedDisbursements":     failedDisbursements,
			"totalAmount":             req.TotalAmount,
			"batchStatus":             bulkStatus,
		},
	})
}

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
		var rowID, rowChamaID, status, monthYear string
		var amount float64
		var dueDate, createdAt, updatedAt time.Time
		var paidAt *time.Time
		var paymentMethod, transactionID *string

		err := rows.Scan(&rowID, &rowChamaID, &amount, &status, &dueDate, &paidAt, &paymentMethod, &transactionID, &monthYear, &createdAt, &updatedAt)
		if err != nil {
			log.Printf("[DEBUG BACKEND] Scan error for subscription payment: %v", err)
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
	if err := rows.Err(); err != nil {
		log.Printf("[DEBUG BACKEND] Rows error for subscription payments: %v", err)
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
	_, err = database.Exec(
		"UPDATE subscription_payments SET transaction_id = $1, updated_at = $2 WHERE id = $3",
		stkResponse.CheckoutRequestID, now, paymentID,
	)
	if err != nil {
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
		var id, chamaID, userID, firstName, lastName, phone, status string
		var amount float64
		var dueDate, createdAt, updatedAt time.Time
		var paidAt *time.Time
		var paymentMethod, transactionID *string
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
		var id, chamaID, userID, firstName, lastName, phone, status string
		var amount float64
		var dueDate, createdAt, updatedAt time.Time
		var paidAt *time.Time
		var paymentMethod, transactionID *string
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

	var memberPhone string
	err = database.QueryRow("SELECT phone FROM users WHERE id = $1", payment.UserID).Scan(&memberPhone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Member phone number not found",
		})
		return
	}

	phoneNumber := memberPhone
	if strings.HasPrefix(phoneNumber, "07") {
		phoneNumber = "254" + phoneNumber[1:]
	} else if strings.HasPrefix(phoneNumber, "+254") {
		phoneNumber = phoneNumber[1:]
	}

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
	_, err = database.Exec(
		"UPDATE service_fee_payments SET transaction_id = $1, updated_at = $2 WHERE id = $3",
		transactionID, now, paymentID,
	)
	if err != nil {
		log.Printf("Error updating service fee payment: %v", err)
	}

	_, err = database.Exec(
		"UPDATE chama_members SET service_fee_paid = false, service_fee_paid_at = NULL, service_fee_status = 'pending' WHERE chama_id = $1 AND user_id = $2",
		chamaID, payment.UserID,
	)
	if err != nil {
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

// PayMemberServiceFee creates a service fee record and initiates STK push for a member
func PayMemberServiceFee(c *gin.Context) {
	chamaID := c.Param("id")
	memberID := c.Param("memberId")
	log.Printf("[DEBUG PayMemberServiceFee] called chama=%s member=%s", chamaID, memberID)
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

	// Update transaction with checkout request ID
	updateTransactionCheckoutRequestID(database, transactionID, stkResponse.CheckoutRequestID)

	now := time.Now()

	// Create service fee payment record with pending status
	_, err = database.Exec(
		"INSERT INTO service_fee_payments (id, chama_id, user_id, amount, status, due_date, transaction_id, created_at, updated_at) VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8)",
		paymentID, chamaID, memberID, 50, now, transactionID, now, now,
	)
	if err != nil {
		log.Printf("Error creating service fee payment: %v", err)
	}

	// Update member status as pending - will be confirmed by callback
	_, err = database.Exec(
		"UPDATE chama_members SET service_fee_paid = false, service_fee_paid_at = NULL, service_fee_status = 'pending' WHERE chama_id = $1 AND user_id = $2",
		chamaID, memberID,
	)
	if err != nil {
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

// CreateChamaShares creates a new share offering for a chama
func CreateChamaShares(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	var req struct {
		Name          string  `json:"name" binding:"required"`
		TotalShares   int     `json:"totalShares" binding:"required"`
		PricePerShare float64 `json:"pricePerShare" binding:"required"`
		OpenDate      string  `json:"openDate"`
		CloseDate     string  `json:"closeDate"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
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

	now := time.Now()

	offeringID := fmt.Sprintf("SHARE_OFFER_%d", time.Now().UnixNano())

	userID, _ := c.Get("userID")
	if userID == "" || userID == nil {
		userID = "system"
	}
	userIDStr := fmt.Sprintf("%v", userID)

	transactionID := fmt.Sprintf("TXN_%d", time.Now().UnixNano())
	securityHash := fmt.Sprintf("SHA256_%d", time.Now().UnixNano())

	_, err := database.Exec(
		"INSERT INTO share_offerings (id, chama_id, name, share_type, total_shares, price_per_share, minimum_purchase, description, eligibility_criteria, approval_required, total_value, created_by, created_by_id, timestamp, status, transaction_id, security_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)",
		offeringID, chamaID, req.Name, "ordinary", req.TotalShares, req.PricePerShare, 1, "", "", false, float64(req.TotalShares)*req.PricePerShare, userIDStr, userIDStr, now, "active", transactionID, securityHash, now, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create share offering: " + err.Error(),
		})
		return
	}

	_, _ = database.Exec(
		"INSERT INTO wallets (id, type, owner_id, subwallet_type, chama_id, balance, currency, is_active, is_locked, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING",
		fmt.Sprintf("wallet-%s-shares", chamaID), "chama", chamaID, "shares", chamaID, 0, "KES", true, false, now, now,
	)

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Share offering created successfully",
		"data": gin.H{
			"id":            offeringID,
			"name":          req.Name,
			"totalShares":   req.TotalShares,
			"pricePerShare": req.PricePerShare,
		},
	})
}

// GetChamaShareOfferingsList retrieves all share offerings for a chama
func GetChamaShareOfferingsList(c *gin.Context) {
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

	query := `
		SELECT id, chama_id, name, share_type, total_shares, price_per_share, minimum_purchase, description, eligibility_criteria, approval_required, total_value, status, created_by, created_by_id, timestamp, transaction_id, security_hash, created_at, updated_at
		FROM share_offerings
		WHERE chama_id = $1
		ORDER BY created_at DESC
	`

	rows, err := db.(*sql.DB).Query(query, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch share offerings: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var offerings []map[string]interface{}
	for rows.Next() {
		var id, chamaIDCol, name, shareType, createdBy, createdByID, transactionID, securityHash, status, description, eligibilityCriteria string
		var totalShares, minimumPurchase int
		var pricePerShare, totalValue float64
		var approvalRequired bool
		var timestamp, createdAt, updatedAt interface{}

		err := rows.Scan(&id, &chamaIDCol, &name, &shareType, &totalShares, &pricePerShare, &minimumPurchase, &description, &eligibilityCriteria, &approvalRequired, &totalValue, &status, &createdBy, &createdByID, &timestamp, &transactionID, &securityHash, &createdAt, &updatedAt)
		if err != nil {
			continue
		}

		offering := map[string]interface{}{
			"id":                  id,
			"chamaId":             chamaIDCol,
			"name":                name,
			"shareType":           shareType,
			"totalShares":         totalShares,
			"pricePerShare":       pricePerShare,
			"minimumPurchase":     minimumPurchase,
			"description":         description,
			"eligibilityCriteria": eligibilityCriteria,
			"approvalRequired":    approvalRequired,
			"totalValue":          totalValue,
			"status":              status,
			"createdBy":           createdBy,
			"createdById":         createdByID,
			"timestamp":           timestamp,
			"transactionId":       transactionID,
			"securityHash":        securityHash,
			"createdAt":           createdAt,
			"updatedAt":           updatedAt,
		}
		offerings = append(offerings, offering)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    offerings,
	})
}

// DeclareChamaDividends creates a dividend declaration for a chama
func DeclareChamaDividends(c *gin.Context) {
	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	var req struct {
		Type             string                   `json:"type" binding:"required"`
		Category         string                   `json:"category" binding:"required"`
		DividendPerShare float64                  `json:"dividendPerShare" binding:"required"`
		TotalAmount      float64                  `json:"totalAmount" binding:"required"`
		Description      string                   `json:"description"`
		EligibleMembers  []map[string]interface{} `json:"eligibleMembers" binding:"required"`
		FromAccount      string                   `json:"fromAccount"`
		InitiatedBy      string                   `json:"initiatedBy" binding:"required"`
		InitiatedByID    string                   `json:"initiatedById" binding:"required"`
		Timestamp        string                   `json:"timestamp"`
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

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}
	database := db.(*sql.DB)

	userID, _ := c.Get("userID")
	if userID == "" || userID == nil {
		userID = "system"
	}
	userIDStr := fmt.Sprintf("%v", userID)

	now := time.Now()
	timestamp := now
	if req.Timestamp != "" {
		if parsed, err := time.Parse(time.RFC3339, req.Timestamp); err == nil {
			timestamp = parsed
		}
	}

	declarationID := fmt.Sprintf("DIV_DEC_%d", time.Now().UnixNano())
	fromAccount := req.FromAccount
	if fromAccount == "" {
		fromAccount = fmt.Sprintf("wallet-%s-dividends", chamaID)
	}

	_, err := database.Exec(
		"INSERT INTO dividend_declarations (id, chama_id, dividend_per_share, total_amount, status, description, created_by, created_by_id, timestamp, transaction_id, security_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
		declarationID, chamaID, req.DividendPerShare, req.TotalAmount, "declared", req.Description, req.InitiatedBy, userIDStr, timestamp, req.TransactionID, req.SecurityHash, now, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create dividend declaration: " + err.Error(),
		})
		return
	}

	// Ensure dividends subwallet exists
	_, _ = database.Exec(
		"INSERT INTO wallets (id, type, owner_id, subwallet_type, chama_id, balance, currency, is_active, is_locked, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING",
		fromAccount, "chama", chamaID, "dividends", chamaID, 0, "KES", true, false, now, now,
	)

	// Create individual dividend records using dividends table
	dividendQuery := "INSERT INTO dividends (id, bulk_disbursement_id, chama_id, member_id, member_name, shares_owned, dividend_per_share, amount, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)"

	for _, member := range req.EligibleMembers {
		memberID, _ := member["id"].(string)
		memberName, _ := member["name"].(string)
		sharesOwned, _ := member["sharesOwned"].(float64)

		dividendID := fmt.Sprintf("DIV_%d_%s", time.Now().UnixNano(), memberID)
		amount := sharesOwned * req.DividendPerShare

		_, err = database.Exec(
			dividendQuery,
			dividendID, declarationID, chamaID, memberID, memberName, int(sharesOwned), req.DividendPerShare, amount, "pending", now, now,
		)
		if err != nil {
			log.Printf("Failed to create dividend record for member %s: %v", memberID, err)
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Dividend declaration created successfully",
		"data": gin.H{
			"id": declarationID,
		},
	})
}

// GetChamaDividendDeclarations retrieves dividend declarations for a chama
func GetChamaDividendDeclarations(c *gin.Context) {
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
		SELECT id, chama_id, dividend_per_share, total_amount, status, description, 
			   created_by, created_by_id, timestamp, created_at, updated_at
		FROM dividend_declarations 
		WHERE chama_id = $1 
		ORDER BY created_at DESC
	`

	rows, err := database.Query(query, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve dividend declarations: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var declarations []map[string]interface{}
	for rows.Next() {
		var id, chamaId, status, description, createdBy, createdByID string
		var dividendPerShare, totalAmount float64
		var timestamp, createdAt, updatedAt time.Time

		err := rows.Scan(&id, &chamaId, &dividendPerShare, &totalAmount, &status, &description, &createdBy, &createdByID, &timestamp, &createdAt, &updatedAt)
		if err != nil {
			log.Printf("Failed to scan dividend declaration: %v", err)
			continue
		}

		declaration := map[string]interface{}{
			"id":               id,
			"chamaId":          chamaId,
			"dividendPerShare": dividendPerShare,
			"totalAmount":      totalAmount,
			"status":           status,
			"description":      description,
			"createdBy":        createdBy,
			"createdAt":        createdAt,
			"updatedAt":        updatedAt,
		}
		declarations = append(declarations, declaration)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    declarations,
	})
}

// DisburseMerryGoRoundCycle handles individual MGR disbursement
// Sends funds directly to recipient's MPesa number via B2C
func DisburseMerryGoRoundCycle(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	chamaID := c.Param("id")
	cycleID := c.Param("cycleId")
	if chamaID == "" || cycleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID and Cycle ID are required",
		})
		return
	}

	var req struct {
		CycleId       string  `json:"cycleId" binding:"required"`
		RecipientId   string  `json:"recipientId" binding:"required"`
		RecipientName string  `json:"recipientName" binding:"required"`
		CycleNumber   int     `json:"cycleNumber"`
		Amount        float64 `json:"amount" binding:"required"`
		Description   string  `json:"description" binding:"required"`
		PrivateNote   string  `json:"privateNote"`
		DisbursedBy   string  `json:"disbursedBy" binding:"required"`
		DisbursedById string  `json:"disbursedById" binding:"required"`
		Timestamp     string  `json:"timestamp"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
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

	var recipientPhone string
	err := database.QueryRow("SELECT phone FROM users WHERE id = $1", req.RecipientId).Scan(&recipientPhone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Recipient not found or phone number not available",
		})
		return
	}

	phoneNumber, err := normalizePhoneNumber(recipientPhone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	now := time.Now()
	transactionID := fmt.Sprintf("TXN_%d", now.UnixNano())

	tx, err := database.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start transaction",
		})
		return
	}
	defer tx.Rollback()

	sourceWalletID, err := getDisbursementSourceWalletID(database, chamaID, "merry_go_round")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid source wallet: " + err.Error(),
		})
		return
	}

	batchID := fmt.Sprintf("BATCH_%d", now.UnixNano())
	batchTitle := "Merry go round disbursement"
	_, err = tx.Exec(`
		INSERT INTO disbursement_batches (
			id, chama_id, batch_type, title, description, total_amount,
			total_recipients, initiated_by, status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10)
	`, batchID, chamaID, "merry_go_round", batchTitle, req.Description, req.Amount, 1, userID, now, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create disbursement batch: " + err.Error(),
		})
		return
	}

	_, err = tx.Exec(`
		INSERT INTO transactions (
			id, from_wallet_id, chama_id, recipient_id, member_id, type, status, amount,
			currency, description, reference, payment_method, initiated_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, 'mgr_disbursement', 'pending', $6, 'KES', $7, $8, 'mobile_money', $9, $10, $11)
	`, transactionID, sourceWalletID, chamaID, req.RecipientId, req.RecipientId, req.Amount, req.Description, fmt.Sprintf("PENDING-%s-%s", batchID, req.RecipientId), req.DisbursedBy, now, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create transaction record: " + err.Error(),
		})
		return
	}

	disburseID := fmt.Sprintf("DISB_%d", now.UnixNano())
	_, err = tx.Exec(`
		INSERT INTO disbursements (
			id, batch_id, chama_id, type, category, member_id, member_name, amount, purpose,
			from_account, to_account, initiated_by, initiated_by_id, timestamp, status, transaction_id, security_hash,
			created_at, updated_at
		) VALUES ($1, $2, $3, 'merry_go_round', 'merry_go_round', $4, $5, $6, $7,
			$8, $9, $10, $11, $12, 'pending', $13, $14, $15, $16)
	`, disburseID, batchID, chamaID, req.RecipientId, req.RecipientName, req.Amount, req.Description,
		sourceWalletID, fmt.Sprintf("mpesa-%s", phoneNumber), req.DisbursedBy, req.DisbursedById,
		now, transactionID, "", now, now)
	if err != nil {
		log.Printf("Failed to create disbursement record: %v", err)
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to commit transaction: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "MGR disbursement created and pending approval",
		"data": gin.H{
			"batchId":        batchID,
			"disbursementId": disburseID,
			"recipientId":    req.RecipientId,
			"recipientPhone": utils.MaskPhone(phoneNumber),
			"amount":         req.Amount,
			"transactionId":  transactionID,
		},
	})
}

// DisburseMerryGoRoundCyclesBulk handles bulk MGR disbursement
// Sends funds directly to each recipient's MPesa number via B2C
func DisburseMerryGoRoundCyclesBulk(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	chamaID := c.Param("id")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
		})
		return
	}

	var req struct {
		Disbursements []struct {
			CycleId       string  `json:"cycleId"`
			RecipientId   string  `json:"recipientId" binding:"required"`
			RecipientName string  `json:"recipientName" binding:"required"`
			CycleNumber   int     `json:"cycleNumber"`
			Amount        float64 `json:"amount" binding:"required"`
		} `json:"disbursements" binding:"required"`
		Description   string `json:"description" binding:"required"`
		DisbursedBy   string `json:"disbursedBy" binding:"required"`
		DisbursedById string `json:"disbursedById" binding:"required"`
		Timestamp     string `json:"timestamp"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
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

	now := time.Now()
	var successfulDisbursements int
	var failedDisbursements int

	batchID := fmt.Sprintf("BATCH_%d", now.UnixNano())
	batchTitle := "Merry go round bulk disbursement"

	sourceWalletID, err := getDisbursementSourceWalletID(database, chamaID, "merry_go_round")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid source wallet: " + err.Error(),
		})
		return
	}

	_, err = database.Exec(`
		INSERT INTO disbursement_batches (
			id, chama_id, batch_type, title, description, total_amount,
			total_recipients, initiated_by, status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10)
	`, batchID, chamaID, "merry_go_round", batchTitle, req.Description, 0.0, len(req.Disbursements), userID, now, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create disbursement batch: " + err.Error(),
		})
		return
	}

	var totalAmount float64
	for _, disb := range req.Disbursements {
		var recipientPhone string
		err := database.QueryRow("SELECT phone FROM users WHERE id = $1", disb.RecipientId).Scan(&recipientPhone)
		if err != nil {
			log.Printf("Skipping MGR disbursement for member %s - phone not found: %v", disb.RecipientId, err)
			failedDisbursements++
			continue
		}

		phoneNumber, err := normalizePhoneNumber(recipientPhone)
		if err != nil {
			log.Printf("Skipping MGR disbursement for member %s - invalid phone format: %s", disb.RecipientId, recipientPhone)
			failedDisbursements++
			continue
		}

		transactionID := fmt.Sprintf("TXN_%d", now.UnixNano())
		_, err = database.Exec(`
			INSERT INTO transactions (
				id, from_wallet_id, chama_id, recipient_id, member_id, type, status, amount,
				currency, description, reference, payment_method, initiated_by, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, 'mgr_disbursement', 'pending', $6, 'KES', $7, $8, 'mobile_money', $9, $10, $11)
		`, transactionID, sourceWalletID, chamaID, disb.RecipientId, disb.RecipientId, disb.Amount, req.Description, fmt.Sprintf("PENDING-%s-%s", batchID, disb.RecipientId), req.DisbursedBy, now, now)
		if err != nil {
			log.Printf("Failed to create transaction for MGR disbursement: %v", err)
			failedDisbursements++
			continue
		}

		disburseID := fmt.Sprintf("DISB_%d", now.UnixNano())
		_, err = database.Exec(`
			INSERT INTO disbursements (
				id, batch_id, chama_id, type, category, member_id, member_name, amount, purpose,
				from_account, to_account, initiated_by, initiated_by_id, timestamp, status, transaction_id, security_hash,
				created_at, updated_at
			) VALUES ($1, $2, $3, 'merry_go_round', 'merry_go_round', $4, $5, $6, $7,
				$8, $9, $10, $11, $12, 'pending', $13, $14, $15, $16)
		`, disburseID, batchID, chamaID, disb.RecipientId, disb.RecipientName, disb.Amount, req.Description,
			sourceWalletID, fmt.Sprintf("mpesa-%s", phoneNumber), req.DisbursedBy, req.DisbursedById,
			now, transactionID, "", now, now)
		if err != nil {
			log.Printf("Failed to create disbursement record: %v", err)
		}

		totalAmount += disb.Amount
		successfulDisbursements++
	}

	_, err = database.Exec(
		"UPDATE disbursement_batches SET total_amount = $1 WHERE id = $2",
		totalAmount, batchID,
	)
	if err != nil {
		log.Printf("Failed to update batch total amount: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Bulk MGR disbursement created and pending approval",
		"data": gin.H{
			"batchId":                 batchID,
			"successfulDisbursements": successfulDisbursements,
			"failedDisbursements":     failedDisbursements,
			"totalAmount":             totalAmount,
		},
	})
}
