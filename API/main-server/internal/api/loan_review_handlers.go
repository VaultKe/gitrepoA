package api

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"vaultke-backend/internal/services"
)

// RespondToGuarantorRequest allows a guarantor to accept or decline a request
func RespondToGuarantorRequest(c *gin.Context) {
	// Get loan ID from URL parameter
	loanID := c.Param("id")
	if loanID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Loan ID is required",
		})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req struct {
		GuarantorID string `json:"guarantorId" binding:"required"`
		Action      string `json:"action" binding:"required"` // "accept" or "decline"
		Reason      string `json:"reason"`                    // Optional reason for decline
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	guarantorID := req.GuarantorID

	// Validate action
	if req.Action != "accept" && req.Action != "decline" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Action must be 'accept' or 'decline'",
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

	// DEBUG: Check if guarantor record exists at all
	var count int
	err := db.(*sql.DB).QueryRow("SELECT COUNT(*) FROM guarantors WHERE id = $1", guarantorID).Scan(&count)
	if err != nil {
		fmt.Printf("❌ Error checking guarantor existence: %v\n", err)
	} else {
	}

	// DEBUG: Check guarantor record details
	var dbGuarantorID, dbUserID, dbLoanID, dbStatus string
	err = db.(*sql.DB).QueryRow("SELECT id, user_id, loan_id, status FROM guarantors WHERE id = $1", guarantorID).Scan(&dbGuarantorID, &dbUserID, &dbLoanID, &dbStatus)
	if err != nil {
		fmt.Printf("❌ Error getting guarantor details: %v\n", err)
	} else {
	}

	// Find the guarantor record by ID and ensure the current user is the guarantor
	var requesterID string
	var currentStatus string
	var actualLoanID string
	guarantorLookup := func() error {
		return db.(*sql.DB).QueryRow(`
			SELECT l.borrower_id as requester_id, g.status, g.loan_id
			FROM guarantors g
			JOIN loans l ON g.loan_id = l.id
			WHERE g.id = $1 AND g.user_id = $2
		`, guarantorID, userID).Scan(&requesterID, &currentStatus, &actualLoanID)
	}
	err = guarantorLookup()
	if err == sql.ErrNoRows {
		// Older loans may never have had a guarantors row written — rebuild it
		// from the stored request notification and retry.
		if uid, ok := userID.(string); ok && reconstructBackerRow(db.(*sql.DB), "guarantor", guarantorID, uid) {
			err = guarantorLookup()
		}
	}

	if err != nil {
		if err == sql.ErrNoRows {
			fmt.Printf("Guarantor request not found: guarantorID=%s, userID=%s\n", guarantorID, userID)
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "Guarantor request not found or not authorized",
			})
			return
		}
		fmt.Printf("Database error fetching guarantor request: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch guarantor request: " + err.Error(),
		})
		return
	}

	fmt.Printf("Found guarantor request: requesterID=%s, currentStatus=%s, actualLoanID=%s\n", requesterID, currentStatus, actualLoanID)

	// If loan ID was provided in URL and doesn't match, return error
	if loanID != "" && actualLoanID != loanID {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Guarantor request does not belong to the specified loan",
		})
		return
	}

	// Use the actual loan ID for further processing
	loanID = actualLoanID

	// Check if already responded
	if currentStatus != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "You have already responded to this guarantor request",
		})
		return
	}

	// Update guarantor status
	newStatus := "declined"
	if req.Action == "accept" {
		newStatus = "accepted"
	}

	_, err = db.(*sql.DB).Exec(`
		UPDATE guarantors
		SET status = $1, message = $2, responded_at = CURRENT_TIMESTAMP
		WHERE id = $3
	`, newStatus, req.Reason, guarantorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update guarantor response: " + err.Error(),
		})
		return
	}

	// The set of accepting guarantors just changed — resplit the liability.
	_ = services.NewLoanService(db.(*sql.DB)).RecalculateGuarantorExposure(loanID)

	// Create notification for loan requester
	notificationID := fmt.Sprintf("notif-%d", time.Now().UnixNano())
	message := fmt.Sprintf("Your guarantor request has been %s", newStatus)
	if req.Reason != "" {
		message += fmt.Sprintf(". Reason: %s", req.Reason)
	}

	err = createNotification(db.(*sql.DB), notificationID, requesterID, "chama",
		"Guarantor Response",
		message,
		fmt.Sprintf(`{"loan_id": "%s", "guarantor_id": "%s", "action": "%s"}`,
			loanID, guarantorID, req.Action),
		"loan", nil)
	if err != nil {
		// Log error but don't fail the response
		fmt.Printf("Failed to create notification for loan requester %s: %v\n", requesterID, err)
	}

	// Check if all guarantors have responded and update loan status if needed
	// Use a timeout context to prevent goroutine leaks
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Recovered from panic in checkAndUpdateLoanStatus: %v", r)
			}
		}()

		select {
		case <-ctx.Done():
			log.Printf("Loan status check cancelled for loan %s: %v", loanID, ctx.Err())
			return
		default:
			checkAndUpdateLoanStatus(db.(*sql.DB), loanID)
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Guarantor request %s successfully", newStatus),
		"data": map[string]interface{}{
			"guarantor_id": guarantorID,
			"status":       newStatus,
			"action":       req.Action,
		},
	})
	c.Abort()
}

// checkAndUpdateLoanStatus advances a loan once every guarantor AND every
// referee has responded. Any single decline rejects the loan; otherwise, when
// all backers have accepted, the loan moves to the officer-approval stage.
func checkAndUpdateLoanStatus(db *sql.DB, loanID string) {
	var gTotal, gAccepted, gDeclined int
	if err := db.QueryRow(`
		SELECT COUNT(*),
			COALESCE(SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status IN ('declined','rejected') THEN 1 ELSE 0 END), 0)
		FROM guarantors WHERE loan_id = $1
	`, loanID).Scan(&gTotal, &gAccepted, &gDeclined); err != nil {
		fmt.Printf("Error checking guarantor status for loan %s: %v\n", loanID, err)
		return
	}

	// Referees are optional and the table may be absent on an un-migrated DB —
	// treat any failure here as "no referees" rather than blocking the loan.
	var rTotal, rAccepted, rDeclined int
	if err := db.QueryRow(`
		SELECT COUNT(*),
			COALESCE(SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status IN ('declined','rejected') THEN 1 ELSE 0 END), 0)
		FROM loan_referees WHERE loan_id = $1
	`, loanID).Scan(&rTotal, &rAccepted, &rDeclined); err != nil {
		rTotal, rAccepted, rDeclined = 0, 0, 0
	}

	// Keep the running acceptance counts on the loan fresh for the UI.
	_, _ = db.Exec("UPDATE loans SET approved_guarantors = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", gAccepted, loanID)
	_, _ = db.Exec("UPDATE loans SET approved_referees = $1 WHERE id = $2", rAccepted, loanID)

	var newStatus string
	switch {
	case gDeclined > 0 || rDeclined > 0:
		newStatus = "guarantors_declined"
	case (gAccepted+gDeclined) >= gTotal && (rAccepted+rDeclined) >= rTotal && (gTotal > 0 || rTotal > 0):
		newStatus = "guarantors_approved"
	default:
		// still waiting on someone
		return
	}

	// Update loan status
	_, err := db.Exec(`
		UPDATE loans
		SET status = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2 AND status IN ('pending', 'guarantors_approved')
	`, newStatus, loanID)
	if err != nil {
		fmt.Printf("Error updating loan status for loan %s: %v\n", loanID, err)
		return
	}

	// Get loan requester for notification
	var requesterID string
	err = db.QueryRow(`SELECT borrower_id FROM loans WHERE id = $1`, loanID).Scan(&requesterID)
	if err != nil {
		fmt.Printf("Error getting loan requester for loan %s: %v\n", loanID, err)
		return
	}

	// Create notification for loan requester
	notificationID := fmt.Sprintf("notif-%d", time.Now().UnixNano())
	var message string
	if newStatus == "guarantors_approved" {
		message = "All your guarantors and referees have accepted. Your application is now pending approval from chama officials."
	} else {
		message = "A guarantor or referee declined your loan request. Your application has been rejected."
	}

	err = createNotification(db, notificationID, requesterID, "chama",
		"Loan Status Update",
		message,
		fmt.Sprintf(`{"loan_id": "%s", "status": "%s"}`, loanID, newStatus),
		"loan", nil)
	if err != nil {
		fmt.Printf("Failed to create loan status notification for user %s: %v\n", requesterID, err)
	}
}

func InitiateLoanApproval(c *gin.Context) {
	loanID := c.Param("id")
	if loanID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Loan ID is required",
		})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req struct {
		Comment string `json:"comment" binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Comment is required: " + err.Error(),
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

	// Determine role from the loan's next approval stage
	var approvalStage string
	var requiredGuarantors int
	err := db.(*sql.DB).QueryRow("SELECT COALESCE(approval_stage,''), COALESCE(required_guarantors,0) FROM loans WHERE id = $1", loanID).Scan(&approvalStage, &requiredGuarantors)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Loan not found",
		})
		return
	}
	requiredReferees := 0
	_ = db.(*sql.DB).QueryRow("SELECT COALESCE(required_referees,0) FROM loans WHERE id = $1", loanID).Scan(&requiredReferees)

	// The officer approval chain may only begin once every required guarantor
	// AND every required referee has accepted. Guard the entry point (secretary).
	if approvalStage == "pending" {
		if requiredGuarantors > 0 {
			var total, accepted int
			if gerr := db.(*sql.DB).QueryRow(`
				SELECT COUNT(*), COALESCE(SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END), 0)
				FROM guarantors WHERE loan_id = $1
			`, loanID).Scan(&total, &accepted); gerr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to check guarantor consent"})
				return
			}
			if accepted < requiredGuarantors || accepted < total {
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "All guarantors must accept this loan before approval can begin"})
				return
			}
		}
		if requiredReferees > 0 {
			var total, accepted int
			if rerr := db.(*sql.DB).QueryRow(`
				SELECT COUNT(*), COALESCE(SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END), 0)
				FROM loan_referees WHERE loan_id = $1
			`, loanID).Scan(&total, &accepted); rerr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to check referee consent"})
				return
			}
			if accepted < requiredReferees || accepted < total {
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "All referees must accept this loan before approval can begin"})
				return
			}
		}
	}

	var role string
	switch approvalStage {
	case "pending":
		role = "secretary"
	case "secretary_approved":
		role = "treasurer"
	case "treasurer_approved":
		role = "chairperson"
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Loan is not in a state that requires approval",
		})
		return
	}

	otpID, err := services.NewLoanService(db.(*sql.DB)).InitiateLoanApproval(loanID, userID.(string), role, req.Comment)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("A verification code has been e-mailed to you. Enter it to finalise your approval as %s.", role),
		"data": map[string]interface{}{
			"otpId": otpID,
			"role":  role,
		},
	})
	c.Abort()
}

func ConfirmLoanApproval(c *gin.Context) {
	loanID := c.Param("id")
	if loanID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Loan ID is required",
		})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req struct {
		OTP     string `json:"otp" binding:"required,len=6"`
		Comment string `json:"comment" binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "OTP and comment are required: " + err.Error(),
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

	// Determine role from current approval stage
	var approvalStage, role string
	err := db.(*sql.DB).QueryRow("SELECT approval_stage FROM loans WHERE id = $1", loanID).Scan(&approvalStage)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Loan not found",
		})
		return
	}

	switch approvalStage {
	case "pending":
		role = "secretary"
	case "secretary_approved":
		role = "treasurer"
	case "treasurer_approved":
		role = "chairperson"
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Loan is not in a state that requires approval",
		})
		return
	}

	err = services.NewLoanService(db.(*sql.DB)).ConfirmLoanApproval(loanID, userID.(string), role, req.OTP, req.Comment)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	response := gin.H{
		"success": true,
		"message": fmt.Sprintf("Loan approved successfully as %s", role),
		"data": map[string]interface{}{
			"role": role,
		},
	}

	if role == "chairperson" {
		response["message"] = "Loan fully approved and disbursement initiated to borrower's M-Pesa"
		response["data"].(map[string]interface{})["disbursed"] = true
	}

	c.JSON(http.StatusOK, response)
	c.Abort()
}

func RejectLoan(c *gin.Context) {
	loanID := c.Param("id")
	if loanID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Loan ID is required",
		})
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
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

	// Check if loan exists and get current status
	var currentStatus, chamaID, rlBorrowerID string
	err := db.(*sql.DB).QueryRow(`
		SELECT status, chama_id, borrower_id FROM loans WHERE id = $1
	`, loanID).Scan(&currentStatus, &chamaID, &rlBorrowerID)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "Loan not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch loan: " + err.Error(),
		})
		return
	}

	// Maker-checker: the applicant may only CANCEL their own loan, never reject it.
	if uid, _ := userID.(string); uid != "" && uid == rlBorrowerID {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "You cannot reject your own loan. Use 'Cancel Loan Application' instead.",
		})
		return
	}

	// Check if user is authorized (chama chairperson or treasurer)
	var userRole string
	err = db.(*sql.DB).QueryRow(`
		SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2
	`, chamaID, userID).Scan(&userRole)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "You are not authorized to reject loans for this chama",
		})
		return
	}

	if userRole != "chairperson" && userRole != "treasurer" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only chairperson or treasurer can reject loans",
		})
		return
	}

	// Check if loan can be rejected
	if currentStatus == "approved" || currentStatus == "disbursed" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Cannot reject an approved or disbursed loan",
		})
		return
	}

	// Update loan status to rejected
	_, err = db.(*sql.DB).Exec(`
		UPDATE loans
		SET status = 'rejected', rejected_by = $1, rejected_reason = $2, rejected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		WHERE id = $3
	`, userID, req.Reason, loanID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to reject loan: " + err.Error(),
		})
		return
	}

	// Get loan details for notification
	var borrowerID string
	var amount float64
	err = db.(*sql.DB).QueryRow(`
		SELECT borrower_id, amount FROM loans WHERE id = $1
	`, loanID).Scan(&borrowerID, &amount)
	if err != nil {
		fmt.Printf("Failed to get loan details for notification: %v\n", err)
	} else {
		// Create notification for borrower
		notificationID := fmt.Sprintf("notif-%d", time.Now().UnixNano())
		message := fmt.Sprintf("Your loan application for KES %.2f has been rejected.", amount)
		if req.Reason != "" {
			message += fmt.Sprintf(" Reason: %s", req.Reason)
		}

		err = createNotification(db.(*sql.DB), notificationID, borrowerID, "chama",
			"Loan Rejected",
			message,
			fmt.Sprintf(`{"loan_id": "%s", "status": "rejected", "reason": "%s", "amount": %.2f}`, loanID, req.Reason, amount),
			"loan", nil)
		if err != nil {
			fmt.Printf("Failed to create loan rejection notification: %v\n", err)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Loan rejected successfully",
		"data": map[string]interface{}{
			"loan_id": loanID,
			"status":  "rejected",
			"reason":  req.Reason,
		},
	})
	c.Abort()
}

func DisburseLoan(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	loanID := c.Param("id")
	if loanID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Loan ID is required",
		})
		return
	}

	// Only a chama officer may release loan funds — and never the borrower,
	// even if they hold an officer role (maker-checker).
	if dbVal, ok := c.Get("db"); ok {
		if database, ok := dbVal.(*sql.DB); ok {
			var loanChamaID, dlBorrowerID string
			if err := database.QueryRow("SELECT chama_id, borrower_id FROM loans WHERE id = $1", loanID).Scan(&loanChamaID, &dlBorrowerID); err != nil {
				c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Loan not found"})
				return
			}
			if dlBorrowerID == userID {
				c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "You cannot disburse your own loan"})
				return
			}
			if _, err := requireActiveChamaOfficer(database, loanChamaID, userID); err != nil {
				c.JSON(http.StatusForbidden, gin.H{"success": false, "error": err.Error()})
				return
			}
		}
	}

	disbursementServiceVal, exists := c.Get("disbursementService")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Disbursement service not available",
		})
		return
	}

	disbursementService, ok := disbursementServiceVal.(*services.DisbursementService)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Invalid disbursement service",
		})
		return
	}

	err := disbursementService.DisburseLoan(loanID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to disburse loan: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Loan disbursed successfully",
	})
	c.Abort()
}
