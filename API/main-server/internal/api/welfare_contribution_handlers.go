package api

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ContributeToWelfare handles welfare contributions
func ContributeToWelfare(c *gin.Context) {
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
		WelfareRequestID string  `json:"welfareRequestId" binding:"required"`
		Amount           float64 `json:"amount" binding:"required"`
		Message          string  `json:"message"`
		ChamaID          string  `json:"chamaId" binding:"required"`
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
			"error":   "Contribution amount must be greater than 0",
		})
		return
	}

	if req.Amount < 10 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Minimum contribution amount is KES 10",
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

	// Check if user is a member of the chama
	var membershipExists bool
	err := db.(*sql.DB).QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM chama_members
			WHERE chama_id = $1 AND user_id = $2 AND is_active = TRUE
		)
	`, req.ChamaID, userID).Scan(&membershipExists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to verify chama membership",
		})
		return
	}

	if !membershipExists {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied. You are not a member of this chama.",
		})
		return
	}

	// Check if welfare request exists and is approved
	var welfareRequest struct {
		ID            string
		ChamaID       string
		Status        string
		Amount        float64
		Title         string
		BeneficiaryID string
	}

	err = db.(*sql.DB).QueryRow(`
		SELECT id, chama_id, status, amount, title, COALESCE(beneficiary_id, requester_id) as beneficiary_id
		FROM welfare_requests
		WHERE id = $1 AND chama_id = $2
	`, req.WelfareRequestID, req.ChamaID).Scan(
		&welfareRequest.ID, &welfareRequest.ChamaID, &welfareRequest.Status, &welfareRequest.Amount,
		&welfareRequest.Title, &welfareRequest.BeneficiaryID)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "Welfare request not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch welfare request: " + err.Error(),
		})
		return
	}

	// Only allow contributions to approved welfare requests
	if welfareRequest.Status != "approved" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Can only contribute to approved welfare requests. Current status: " + welfareRequest.Status,
		})
		return
	}

	// Allow self-contributions - users can contribute to their own welfare requests
	// This enables users to partially fund their own requests or show commitment

	// Create or get welfare fund for this request
	welfareRequestFundID := fmt.Sprintf("fund-%s", req.WelfareRequestID)

	// Check if welfare fund exists for this request
	var existingFundID string
	err = db.(*sql.DB).QueryRow(`
		SELECT id FROM welfare_funds WHERE id = $1
	`, welfareRequestFundID).Scan(&existingFundID)

	// Create welfare fund if it doesn't exist
	if err == sql.ErrNoRows {
		_, err = db.(*sql.DB).Exec(`
			INSERT INTO welfare_funds (
				id, chama_id, name, description, purpose, status, beneficiary_id, created_by, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`, welfareRequestFundID, welfareRequest.ChamaID,
			"Fund for: "+welfareRequest.Title,
			"Welfare fund for welfare request: "+req.WelfareRequestID,
			"emergency", welfareRequest.BeneficiaryID, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create welfare fund: " + err.Error(),
			})
			return
		}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to check welfare fund: " + err.Error(),
		})
		return
	}

	// Generate contribution ID
	contributionID := fmt.Sprintf("contrib-%d", time.Now().UnixNano())

	// Insert contribution into database
	_, err = db.(*sql.DB).Exec(`
		INSERT INTO welfare_contributions (
			id, welfare_fund_id, user_id, amount, payment_method, message, status, welfare_request_id, contributed_at
		) VALUES ($1, $2, $3, $4, 'mobile_money', $5, 'completed', $6, CURRENT_TIMESTAMP)
	`, contributionID, welfareRequestFundID, userID, req.Amount, req.Message, req.WelfareRequestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to record contribution: " + err.Error(),
		})
		return
	}

	// Get total contributions for this welfare request
	var totalContributions float64
	err = db.(*sql.DB).QueryRow(`
		SELECT COALESCE(SUM(amount), 0)
		FROM welfare_contributions
		WHERE welfare_fund_id = $1
	`, welfareRequestFundID).Scan(&totalContributions)
	if err != nil {
		// Log error but don't fail the response
		fmt.Printf("Failed to calculate total contributions: %v\n", err)
		totalContributions = req.Amount // fallback
	}

	// Create notification for beneficiary
	notificationID := fmt.Sprintf("notif-%d", time.Now().UnixNano())
	_, err = db.(*sql.DB).Exec(`
		INSERT INTO notifications (
			id, user_id, type, title, message, data,
			is_read, created_at, updated_at
		) VALUES ($1, $2, 'welfare_contribution', $3, $4, $5, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, notificationID, welfareRequest.BeneficiaryID,
		"New Welfare Contribution",
		fmt.Sprintf("You received a contribution of KES %.2f for your welfare request", req.Amount),
		fmt.Sprintf(`{"welfare_request_id": "%s", "contribution_id": "%s", "amount": %.2f}`,
			req.WelfareRequestID, contributionID, req.Amount))
	if err != nil {
		// Log error but don't fail the response
		fmt.Printf("Failed to create contribution notification: %v\n", err)
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Contribution recorded successfully",
		"data": map[string]interface{}{
			"contributionId":     contributionID,
			"welfareRequestId":   req.WelfareRequestID,
			"amount":             req.Amount,
			"message":            req.Message,
			"totalContributions": totalContributions,
			"status":             "completed",
			"createdAt":          time.Now().Format(time.RFC3339),
		},
	})
}

// GetWelfareContributions gets all contributions for a specific welfare request
func GetWelfareContributions(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	_, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	welfareRequestID := c.Param("id")
	if welfareRequestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Welfare request ID is required",
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

	// Query contributions for the welfare request
	// Normalize IDs that were passed as a fund identifier instead of a request identifier.
	if strings.HasPrefix(welfareRequestID, "fund-") {
		welfareRequestID = strings.TrimPrefix(welfareRequestID, "fund-")
	}

	// Get welfare fund ID for this request
	welfareRequestFundID := fmt.Sprintf("fund-%s", welfareRequestID)

	rows, err := db.(*sql.DB).Query(`
		SELECT
			wc.id, wc.amount, COALESCE(wc.message, '') as message, COALESCE(wc.status, 'completed') as status, wc.contributed_at,
			u.first_name, u.last_name, u.email
		FROM welfare_contributions wc
		JOIN users u ON wc.user_id = u.id
		WHERE wc.welfare_fund_id = $1
		ORDER BY wc.contributed_at DESC
	`, welfareRequestFundID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch contributions: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var contributions []map[string]interface{}
	var totalAmount float64

	for rows.Next() {
		var contrib struct {
			ID                   string    `json:"id"`
			Amount               float64   `json:"amount"`
			Message              string    `json:"message"`
			Status               string    `json:"status"`
			CreatedAt            time.Time `json:"createdAt"`
			ContributorFirstName string    `json:"contributorFirstName"`
			ContributorLastName  string    `json:"contributorLastName"`
			ContributorEmail     string    `json:"contributorEmail"`
		}

		err := rows.Scan(
			&contrib.ID, &contrib.Amount, &contrib.Message, &contrib.Status, &contrib.CreatedAt,
			&contrib.ContributorFirstName, &contrib.ContributorLastName, &contrib.ContributorEmail,
		)
		if err != nil {
			continue // Skip invalid rows
		}

		totalAmount += contrib.Amount

		contribution := map[string]interface{}{
			"id":        contrib.ID,
			"amount":    contrib.Amount,
			"message":   contrib.Message,
			"status":    contrib.Status,
			"createdAt": contrib.CreatedAt.Format(time.RFC3339),
			"contributor": map[string]interface{}{
				"firstName": contrib.ContributorFirstName,
				"lastName":  contrib.ContributorLastName,
				"email":     contrib.ContributorEmail,
				"fullName":  contrib.ContributorFirstName + " " + contrib.ContributorLastName,
			},
		}

		contributions = append(contributions, contribution)
	}

	if len(contributions) == 0 {
		txRows, txErr := db.(*sql.DB).Query(`
			SELECT
				t.id, t.amount, COALESCE(t.description, '') as message, t.status, t.created_at,
				u.first_name, u.last_name, u.email
			FROM transactions t
			LEFT JOIN users u ON t.initiated_by = u.id
			WHERE t.type IN ('contribution', 'welfare_contribution')
			AND COALESCE(t.metadata, '') != ''
			AND (
				(t.metadata::jsonb->>'welfare_request_id' = $1)
				OR (t.metadata::jsonb->>'welfareRequestId' = $1)
			)
			ORDER BY t.created_at DESC
		`, welfareRequestID)
		if txErr == nil {
			defer txRows.Close()
			for txRows.Next() {
				var contrib struct {
					ID                   string    `json:"id"`
					Amount               float64   `json:"amount"`
					Message              string    `json:"message"`
					Status               string    `json:"status"`
					CreatedAt            time.Time `json:"createdAt"`
					ContributorFirstName string    `json:"contributorFirstName"`
					ContributorLastName  string    `json:"contributorLastName"`
					ContributorEmail     string    `json:"contributorEmail"`
				}

				err := txRows.Scan(
					&contrib.ID, &contrib.Amount, &contrib.Message, &contrib.Status, &contrib.CreatedAt,
					&contrib.ContributorFirstName, &contrib.ContributorLastName, &contrib.ContributorEmail,
				)
				if err != nil {
					continue
				}

				totalAmount += contrib.Amount
				contribution := map[string]interface{}{
					"id":        contrib.ID,
					"amount":    contrib.Amount,
					"message":   contrib.Message,
					"status":    contrib.Status,
					"createdAt": contrib.CreatedAt.Format(time.RFC3339),
					"contributor": map[string]interface{}{
						"firstName": contrib.ContributorFirstName,
						"lastName":  contrib.ContributorLastName,
						"email":     contrib.ContributorEmail,
						"fullName":  contrib.ContributorFirstName + " " + contrib.ContributorLastName,
					},
				}
				contributions = append(contributions, contribution)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    contributions,
		"meta": map[string]interface{}{
			"totalContributions": totalAmount,
			"contributionCount":  len(contributions),
			"welfareRequestId":   welfareRequestID,
		},
	})
		c.Abort()
}
