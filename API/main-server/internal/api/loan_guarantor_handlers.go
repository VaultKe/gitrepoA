package api

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func GetGuarantorRequests(c *gin.Context) {
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

	// Query guarantor requests for the user
	rows, err := db.(*sql.DB).Query(`
		SELECT
			g.id, g.loan_id, g.amount, g.status, g.created_at,
			l.amount as loan_amount, l.purpose, l.repayment_period, l.interest_rate,
			u.first_name, u.last_name, u.email,
			c.name as chama_name
		FROM guarantors g
		JOIN loans l ON g.loan_id = l.id
		JOIN users u ON l.borrower_id = u.id
		JOIN chamas c ON l.chama_id = c.id
		WHERE g.user_id = $1
		ORDER BY g.created_at DESC
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch guarantor requests: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var guarantorRequests []map[string]interface{}

	for rows.Next() {
		var gr struct {
			ID                 string    `json:"id"`
			LoanID             string    `json:"loanId"`
			Amount             float64   `json:"amount"`
			Status             string    `json:"status"`
			CreatedAt          time.Time `json:"createdAt"`
			LoanAmount         float64   `json:"loanAmount"`
			Purpose            string    `json:"purpose"`
			RepaymentPeriod    int       `json:"repaymentPeriod"`
			InterestRate       float64   `json:"interestRate"`
			RequesterFirstName string    `json:"requesterFirstName"`
			RequesterLastName  string    `json:"requesterLastName"`
			RequesterEmail     string    `json:"requesterEmail"`
			ChamaName          string    `json:"chamaName"`
		}

		err := rows.Scan(
			&gr.ID, &gr.LoanID, &gr.Amount, &gr.Status, &gr.CreatedAt,
			&gr.LoanAmount, &gr.Purpose, &gr.RepaymentPeriod, &gr.InterestRate,
			&gr.RequesterFirstName, &gr.RequesterLastName, &gr.RequesterEmail,
			&gr.ChamaName,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to scan guarantor request: " + err.Error(),
			})
			return
		}

		guarantorRequest := map[string]interface{}{
			"id":              gr.ID,
			"loanId":          gr.LoanID,
			"amount":          gr.Amount,
			"status":          gr.Status,
			"createdAt":       gr.CreatedAt.Format(time.RFC3339),
			"loanAmount":      gr.LoanAmount,
			"purpose":         gr.Purpose,
			"repaymentPeriod": gr.RepaymentPeriod,
			"interestRate":    gr.InterestRate,
			"chamaName":       gr.ChamaName,
			"requester": map[string]interface{}{
				"firstName": gr.RequesterFirstName,
				"lastName":  gr.RequesterLastName,
				"email":     gr.RequesterEmail,
				"fullName":  gr.RequesterFirstName + " " + gr.RequesterLastName,
			},
		}

		guarantorRequests = append(guarantorRequests, guarantorRequest)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    guarantorRequests,
		"count":   len(guarantorRequests),
	})
		c.Abort()
}
