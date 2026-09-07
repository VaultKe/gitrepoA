package api

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// loanCancellableStatuses: the applicant may withdraw their own loan only while
// it is still in the application / approval pipeline and the chairperson has not
// yet signed off.
var loanCancellableStatuses = map[string]bool{
	"pending":             true,
	"pending_approval":    true,
	"guarantors_approved": true,
	"guarantors_declined": true,
	"secretary_approved":  true,
	"treasurer_approved":  true,
	"under_review":        true,
}

// CancelLoan lets the borrower withdraw their own loan application before the
// chairperson has approved it.
func CancelLoan(c *gin.Context) {
	loanID := c.Param("id")
	if loanID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Loan ID is required"})
		return
	}

	userIDv, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
		return
	}
	userID, _ := userIDv.(string)

	var reason string
	{
		var body struct {
			Reason string `json:"reason"`
		}
		_ = c.ShouldBindJSON(&body)
		reason = strings.TrimSpace(body.Reason)
	}

	dbv, ok := c.Get("db")
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Database connection not available"})
		return
	}
	db := dbv.(*sql.DB)

	var borrowerID, status, stage, chamaID string
	var chairApprovedBy sql.NullString
	var amount float64
	err := db.QueryRow(`
		SELECT borrower_id, COALESCE(status,''), COALESCE(approval_stage,''), chama_id,
		       chairperson_approved_by, COALESCE(amount,0)
		FROM loans WHERE id = $1`, loanID).
		Scan(&borrowerID, &status, &stage, &chamaID, &chairApprovedBy, &amount)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Loan not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to load loan"})
		return
	}

	if borrowerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Only the applicant can cancel this loan"})
		return
	}

	s := strings.ToLower(status)
	st := strings.ToLower(stage)
	if chairApprovedBy.Valid && chairApprovedBy.String != "" ||
		st == "fully_approved" ||
		s == "approved" || s == "disbursing" || s == "disbursed" || s == "active" ||
		s == "completed" || s == "rejected" || s == "cancelled" || s == "closed" ||
		s == "defaulted" || s == "delinquent" || s == "partial" || s == "recovery_active" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "This loan can no longer be cancelled — it has been approved by the chairperson or is already disbursed.",
		})
		return
	}
	if !loanCancellableStatuses[s] {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "This loan is not in a cancellable state"})
		return
	}

	note := "Cancelled by the applicant"
	if reason != "" {
		note += ": " + reason
	}

	if _, err := db.Exec(`
		UPDATE loans
		SET status = 'cancelled',
		    approval_stage = 'cancelled',
		    rejected_by = $1,
		    rejected_reason = $2,
		    rejected_at = CURRENT_TIMESTAMP,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $3`, userID, note, loanID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to cancel loan: " + err.Error()})
		return
	}

	// Release any pending guarantor / referee obligations.
	_, _ = db.Exec(`UPDATE guarantors SET status = 'cancelled', amount = 0 WHERE loan_id = $1 AND lower(status) = 'pending'`, loanID)
	_, _ = db.Exec(`UPDATE loan_referees SET status = 'cancelled' WHERE loan_id = $1 AND lower(status) = 'pending'`, loanID)

	// Let the chama officers know the applicant withdrew.
	if chamaID != "" {
		officerRows, oerr := db.Query(`
			SELECT user_id FROM chama_members
			WHERE chama_id = $1 AND lower(role) IN ('secretary','treasurer','chairperson') AND COALESCE(is_active, true)`, chamaID)
		if oerr == nil {
			for officerRows.Next() {
				var oid string
				if officerRows.Scan(&oid) == nil && oid != userID {
					nid := fmt.Sprintf("notif-%d", time.Now().UnixNano())
					_ = createNotification(db, nid, oid, "chama", "Loan Cancelled",
						fmt.Sprintf("A loan application for KES %.2f was withdrawn by the applicant.", amount),
						fmt.Sprintf(`{"loan_id": "%s", "status": "cancelled"}`, loanID), "loan", nil)
				}
			}
			officerRows.Close()
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Loan application cancelled.",
		"data":    map[string]interface{}{"id": loanID, "status": "cancelled"},
	})
}
