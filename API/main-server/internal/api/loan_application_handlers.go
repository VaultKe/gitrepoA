package api

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// createNotificationTx inserts a notification with all required fields using a transaction
func createNotificationTx(tx *sql.Tx, _ string, userID, notificationType, title, message, data string, referenceType string, referenceID interface{}) error {
	_, err := tx.Exec(`
		INSERT INTO notifications (
			user_id, title, message, type, priority, category,
			reference_type, reference_id, status, is_read, data,
			scheduled_for, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6,
			$7, $8, 'pending', false, $9,
			CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, userID, title, message, notificationType,
		getNotificationPriority(notificationType),
		getNotificationCategory(notificationType),
		referenceType,
		referenceID,
		data)
	return err
}

// createNotification inserts a notification with all required fields using a database connection
func createNotification(db *sql.DB, _ string, userID, notificationType, title, message, data string, referenceType string, referenceID interface{}) error {
	_, err := db.Exec(`
		INSERT INTO notifications (
			user_id, title, message, type, priority, category,
			reference_type, reference_id, status, is_read, data,
			scheduled_for, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6,
			$7, $8, 'pending', false, $9,
			CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, userID, title, message, notificationType,
		getNotificationPriority(notificationType),
		getNotificationCategory(notificationType),
		referenceType,
		referenceID,
		data)
	return err
}

// Helper functions to determine notification properties based on type
func getNotificationPriority(notificationType string) string {
	switch notificationType {
	case "guarantor_request", "loan_status_update":
		return "high"
	default:
		return "normal"
	}
}

func getNotificationCategory(notificationType string) string {
	switch notificationType {
	case "guarantor_request", "loan_status_update", "guarantor_response":
		return "financial"
	case "meeting_created", "meeting_updated":
		return "meetings"
	case "member_joined", "member_left":
		return "members"
	default:
		return "system"
	}
}

func getNotificationPushEnabled(notificationType string) int {
	switch notificationType {
	case "guarantor_request", "loan_status_update", "meeting_created", "member_joined":
		return 1
	default:
		return 0
	}
}

func getNotificationEmailEnabled(notificationType string) int {
	switch notificationType {
	case "guarantor_request", "loan_status_update":
		return 1
	default:
		return 0
	}
}

func getNotificationSMSEnabled(notificationType string) int {
	switch notificationType {
	case "guarantor_request":
		return 1
	default:
		return 0
	}
}

// Loan application handlers
func GetLoanApplications(c *gin.Context) {
	startTime := time.Now()
	chamaID := c.Query("chamaId")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "chamaId parameter is required",
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

	// Check loans for this specific chama
	var chamaLoans int
	err := db.(*sql.DB).QueryRow("SELECT COUNT(*) FROM loans WHERE chama_id = $1", chamaID).Scan(&chamaLoans)
	if err != nil {
		// fmt.Printf("❌ Failed to count loans for chama: %v\n", err)
	} else {
		// fmt.Printf("🔍 Loans for chamaId %s: %d\n", chamaID, chamaLoans)
	}

	// Debug: Show all unique chama_ids in loans table
	chamaRows, err := db.(*sql.DB).Query("SELECT DISTINCT chama_id, COUNT(*) FROM loans GROUP BY chama_id")
	if err == nil {
		// fmt.Printf("🔍 All chamaIds with loans:\n")
		for chamaRows.Next() {
			var cid string
			var count int
			if chamaRows.Scan(&cid, &count) == nil {
				fmt.Printf("   - %s: %d loans\n", cid, count)
			}
		}
		chamaRows.Close()
	}

	// Query loan applications
	rows, err := db.(*sql.DB).Query(`
		SELECT
			l.id, l.borrower_id, l.chama_id, l.amount, l.interest_rate,
			l.duration, l.purpose, l.status, l.total_amount, l.remaining_amount,
			l.required_guarantors, l.approved_guarantors, l.due_date, l.created_at,
			u.first_name, u.last_name, u.email
		FROM loans l
		JOIN users u ON l.borrower_id = u.id
		WHERE l.chama_id = $1
		ORDER BY l.created_at DESC
	`, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch loan applications: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var loans []map[string]interface{}
	for rows.Next() {
		var loan struct {
			ID                 string    `json:"id"`
			BorrowerID         string    `json:"borrowerId"`
			ChamaID            string    `json:"chamaId"`
			Amount             float64   `json:"amount"`
			InterestRate       float64   `json:"interestRate"`
			Duration           int       `json:"duration"`
			Purpose            string    `json:"purpose"`
			Status             string    `json:"status"`
			TotalAmount        float64   `json:"totalAmount"`
			RemainingAmount    float64   `json:"remainingAmount"`
			RequiredGuarantors int       `json:"requiredGuarantors"`
			ApprovedGuarantors int       `json:"approvedGuarantors"`
			DueDate            time.Time `json:"dueDate"`
			CreatedAt          time.Time `json:"createdAt"`
			BorrowerFirstName  string    `json:"borrowerFirstName"`
			BorrowerLastName   string    `json:"borrowerLastName"`
			BorrowerEmail      string    `json:"borrowerEmail"`
		}

		err := rows.Scan(
			&loan.ID, &loan.BorrowerID, &loan.ChamaID, &loan.Amount, &loan.InterestRate,
			&loan.Duration, &loan.Purpose, &loan.Status, &loan.TotalAmount, &loan.RemainingAmount,
			&loan.RequiredGuarantors, &loan.ApprovedGuarantors, &loan.DueDate, &loan.CreatedAt,
			&loan.BorrowerFirstName, &loan.BorrowerLastName, &loan.BorrowerEmail,
		)
		if err != nil {
			continue // Skip invalid rows
		}

		loanMap := map[string]interface{}{
			"id":                 loan.ID,
			"borrowerId":         loan.BorrowerID,
			"chamaId":            loan.ChamaID,
			"amount":             loan.Amount,
			"interestRate":       loan.InterestRate,
			"duration":           loan.Duration,
			"purpose":            loan.Purpose,
			"status":             loan.Status,
			"totalAmount":        loan.TotalAmount,
			"remainingAmount":    loan.RemainingAmount,
			"requiredGuarantors": loan.RequiredGuarantors,
			"approvedGuarantors": loan.ApprovedGuarantors,
			"dueDate":            loan.DueDate.Format(time.RFC3339),
			"createdAt":          loan.CreatedAt.Format(time.RFC3339),
			"borrower": map[string]interface{}{
				"id":        loan.BorrowerID,
				"firstName": loan.BorrowerFirstName,
				"lastName":  loan.BorrowerLastName,
				"email":     loan.BorrowerEmail,
				"fullName":  loan.BorrowerFirstName + " " + loan.BorrowerLastName,
			},
		}

		loans = append(loans, loanMap)
	}

	duration := time.Since(startTime)
	fmt.Printf("GetLoanApplications completed in %v for chamaId: %s\n", duration, chamaID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    loans,
		"message": fmt.Sprintf("Found %d loan applications", len(loans)),
		"meta": map[string]interface{}{
			"total":   len(loans),
			"chamaId": chamaID,
		},
	})
}

func CreateLoanApplication(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req struct {
		ChamaID         string                 `json:"chamaId" binding:"required"`
		LoanTypeID      string                 `json:"loanTypeId"`
		LoanTypeName    string                 `json:"loanTypeName"`
		Amount          float64                `json:"amount" binding:"required"`
		Purpose         string                 `json:"purpose" binding:"required"`
		RepaymentPeriod int                    `json:"repaymentPeriod" binding:"required"`
		InterestRate    float64                `json:"interestRate" binding:"required"`
		Guarantors      []string               `json:"guarantors" binding:"required"`
		Security        map[string]interface{} `json:"security"`
		BusinessPlan    string                 `json:"businessPlan"`
		MonthlyIncome   float64                `json:"monthlyIncome" binding:"required"`
		OtherLoans      string                 `json:"otherLoans"`
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

	// Validate guarantors
	if len(req.Guarantors) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "At least 2 guarantors are required",
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
	sqlDB := db.(*sql.DB)

	// Start transaction
	tx, err := sqlDB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start transaction",
		})
		return
	}
	defer tx.Rollback()

	// Generate loan ID
	loanID := fmt.Sprintf("loan-%d", time.Now().UnixNano())

	// Calculate total amount with interest
	totalAmount := req.Amount * (1 + req.InterestRate/100)

	// Calculate due date (repayment period in months)
	dueDate := time.Now().AddDate(0, req.RepaymentPeriod, 0)

	// Insert loan application
	_, err = tx.Exec(`
		INSERT INTO loans (
			id, borrower_id, chama_id, loan_type_id, type, amount, interest_rate,
			duration, purpose, status, total_amount, remaining_amount,
			required_guarantors, approved_guarantors, due_date,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, COALESCE(NULLIF($5, ''), 'regular'), $6, $7, $8, $9, 'pending', $10, $10, $11, 0, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, loanID, userID, req.ChamaID, req.LoanTypeID, req.LoanTypeName, req.Amount, req.InterestRate, req.RepaymentPeriod, req.Purpose, totalAmount, len(req.Guarantors), dueDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create loan application: " + err.Error(),
		})
		return
	}

	// Insert guarantors and send notifications
	resolvedGuarantorIDs := make([]string, 0, len(req.Guarantors))
	for _, guarantorID := range req.Guarantors {
		realUserID := guarantorID
		if strings.HasPrefix(guarantorID, "cm-") {
			row := sqlDB.QueryRow(`SELECT user_id FROM chama_members WHERE id = $1 AND chama_id = $2`, guarantorID, req.ChamaID)
			if err := row.Scan(&realUserID); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"success": false,
					"error":   fmt.Sprintf("Invalid guarantor %s: %v", guarantorID, err),
				})
				return
			}
		}
		resolvedGuarantorIDs = append(resolvedGuarantorIDs, realUserID)
	}

	for _, guarantorID := range resolvedGuarantorIDs {
		guarantorAmount := req.Amount / float64(len(resolvedGuarantorIDs)) // Split equally
		guarantorRecordID := fmt.Sprintf("guarantor-%d-%s", time.Now().UnixNano(), guarantorID)

		_, err = tx.Exec(`
			INSERT INTO guarantors (
				id, loan_id, user_id, amount, status, created_at
			) VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP)
		`, guarantorRecordID, loanID, guarantorID, guarantorAmount)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to add guarantor: " + err.Error(),
			})
			return
		}

		// Create notification for guarantor
		notificationID := fmt.Sprintf("notif-%d", time.Now().UnixNano())
		err = createNotificationTx(tx, notificationID, guarantorID, "guarantor_request",
			"Guarantor Request",
			fmt.Sprintf("You have been requested to guarantee a loan of KES %.2f", req.Amount),
			fmt.Sprintf(`{"loan_id": "%s", "amount": %.2f, "purpose": "%s", "requester_id": "%s", "guarantor_id": "%s"}`,
				loanID, req.Amount, req.Purpose, userID.(string), guarantorRecordID),
			"loan", nil)
		if err != nil {
			// Log error but don't fail the transaction
			fmt.Printf("Failed to create notification for guarantor %s: %v\n", guarantorID, err)
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to commit transaction",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Loan application submitted successfully. Guarantors will be notified.",
		"data": map[string]interface{}{
			"id":                 loanID,
			"chamaId":            req.ChamaID,
			"borrowerId":         userID,
			"amount":             req.Amount,
			"purpose":            req.Purpose,
			"repaymentPeriod":    req.RepaymentPeriod,
			"interestRate":       req.InterestRate,
			"guarantors":         resolvedGuarantorIDs,
			"totalAmount":        totalAmount,
			"remainingAmount":    totalAmount,
			"status":             "pending",
			"requiredGuarantors": len(req.Guarantors),
			"approvedGuarantors": 0,
			"dueDate":            dueDate.Format(time.RFC3339),
			"createdAt":          time.Now().Format(time.RFC3339),
		},
	})
}

func GetLoanApplication(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Get loan application endpoint - coming soon",
	})
}

func UpdateLoanApplication(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Update loan application endpoint - coming soon",
	})
}

func DeleteLoanApplication(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Delete loan application endpoint - coming soon",
	})
}
