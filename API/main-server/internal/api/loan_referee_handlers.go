package api

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"vaultke-backend/internal/services"
)

// GetLoanReferees returns the referees attached to a loan (character backers, no
// financial liability).
func GetLoanReferees(c *gin.Context) {
	loanID := c.Param("id")
	if loanID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Loan ID is required"})
		return
	}

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Database connection not available"})
		return
	}

	referees, err := services.NewLoanService(db.(*sql.DB)).GetLoanReferees(loanID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to get referees: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": referees})
	c.Abort()
}

// RespondToRefereeRequest lets a listed referee accept or decline. Referees
// consent like guarantors but never have an amount tied to them.
func RespondToRefereeRequest(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
		return
	}

	var req struct {
		RefereeID string `json:"refereeId"`
		Action    string `json:"action" binding:"required"` // "accept" | "decline"
		Reason    string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request data: " + err.Error()})
		return
	}

	refereeID := req.RefereeID
	if refereeID == "" {
		refereeID = c.Param("refereeId")
	}
	if refereeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "refereeId is required"})
		return
	}

	if req.Action != "accept" && req.Action != "decline" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Action must be 'accept' or 'decline'"})
		return
	}

	dbVal, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Database connection not available"})
		return
	}
	db := dbVal.(*sql.DB)

	// Insurance for older loans whose loan_referees row was never written.
	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS loan_referees (
		id TEXT PRIMARY KEY, loan_id TEXT NOT NULL, user_id TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending', message TEXT, responded_at TIMESTAMP,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(loan_id, user_id))`)

	var loanID, currentStatus, borrowerID string
	lookup := func() error {
		return db.QueryRow(`
			SELECT r.loan_id, r.status, l.borrower_id
			FROM loan_referees r
			JOIN loans l ON r.loan_id = l.id
			WHERE r.id = $1 AND r.user_id = $2
		`, refereeID, userID).Scan(&loanID, &currentStatus, &borrowerID)
	}
	err := lookup()
	if err == sql.ErrNoRows {
		// Rebuild the row from the stored request notification, if one exists,
		// then retry. This makes accept/decline work for loans applied before
		// the loan_referees row was reliably created.
		if uid, ok := userID.(string); ok && reconstructBackerRow(db, "referee", refereeID, uid) {
			err = lookup()
		}
	}
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Referee request not found or not authorized"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to fetch referee request: " + err.Error()})
		return
	}

	// Guard against a loan-scoped path param that points at a different loan.
	if pathLoanID := c.Param("id"); pathLoanID != "" && pathLoanID != loanID {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Referee request does not belong to the specified loan"})
		return
	}

	if currentStatus != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "You have already responded to this referee request"})
		return
	}

	newStatus := "declined"
	if req.Action == "accept" {
		newStatus = "accepted"
	}

	if _, err = db.Exec(`
		UPDATE loan_referees SET status = $1, message = $2, responded_at = CURRENT_TIMESTAMP WHERE id = $3
	`, newStatus, req.Reason, refereeID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to update referee response: " + err.Error()})
		return
	}

	// Notify the borrower.
	notificationID := fmt.Sprintf("notif-%d", time.Now().UnixNano())
	msg := fmt.Sprintf("A referee has %s your loan request", newStatus)
	if req.Reason != "" {
		msg += ". Reason: " + req.Reason
	}
	_ = createNotification(db, notificationID, borrowerID, "chama", "Referee Response", msg,
		fmt.Sprintf(`{"loan_id": "%s", "referee_id": "%s", "action": "%s"}`, loanID, refereeID, req.Action),
		"loan", nil)

	// Re-evaluate whether all backers have now responded.
	checkAndUpdateLoanStatus(db, loanID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Referee request %s successfully", newStatus),
		"data":    map[string]interface{}{"referee_id": refereeID, "status": newStatus, "action": req.Action},
	})
	c.Abort()
}

// GetRefereeRequests lists the pending/answered referee requests addressed to the
// authenticated user.
func GetRefereeRequests(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
		return
	}

	dbVal, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Database connection not available"})
		return
	}

	rows, err := dbVal.(*sql.DB).Query(`
		SELECT r.id, r.loan_id, r.status, r.created_at,
			   l.amount, l.purpose, l.duration, l.interest_rate,
			   u.first_name, u.last_name, u.email,
			   c.name
		FROM loan_referees r
		JOIN loans l ON r.loan_id = l.id
		JOIN users u ON l.borrower_id = u.id
		JOIN chamas c ON l.chama_id = c.id
		WHERE r.user_id = $1
		ORDER BY r.created_at DESC
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to fetch referee requests: " + err.Error()})
		return
	}
	defer rows.Close()

	var out []map[string]interface{}
	for rows.Next() {
		var id, loanID, status, purpose, firstName, lastName, email, chamaName string
		var createdAt time.Time
		var amount, interestRate float64
		var duration int
		if err := rows.Scan(&id, &loanID, &status, &createdAt, &amount, &purpose, &duration, &interestRate,
			&firstName, &lastName, &email, &chamaName); err != nil {
			continue
		}
		out = append(out, map[string]interface{}{
			"id":              id,
			"loanId":          loanID,
			"status":          status,
			"createdAt":       createdAt.Format(time.RFC3339),
			"loanAmount":      amount,
			"purpose":         purpose,
			"repaymentPeriod": duration,
			"interestRate":    interestRate,
			"chamaName":       chamaName,
			"role":            "referee",
			"requester": map[string]interface{}{
				"firstName": firstName,
				"lastName":  lastName,
				"email":     email,
				"fullName":  firstName + " " + lastName,
			},
		})
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": out, "count": len(out)})
	c.Abort()
}
