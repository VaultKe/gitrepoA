package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// GetContributions lists a chama's contribution transactions.
func GetContributions(c *gin.Context) {
	chamaID := c.Query("chamaId")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "chamaId parameter is required",
		})
		return
	}

	db := dbFromContext(c)
	if db == nil {
		return
	}

	rows, err := db.Query(`
		SELECT
			t.id, t.type, t.amount, t.currency, t.description, t.status, t.payment_method,
			t.chama_id, t.initiated_by, t.recipient_id, t.metadata, t.created_at, t.updated_at,
			u.first_name, u.last_name, u.email
		FROM transactions t
		LEFT JOIN users u ON t.initiated_by = u.id
		WHERE t.chama_id = $1
			AND t.type = 'contribution'
		ORDER BY t.created_at DESC
		LIMIT 100
	`, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch contributions: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var contributions []map[string]interface{}
	for rows.Next() {
		var tx struct {
			ID            string
			Type          string
			Amount        float64
			Currency      string
			Description   string
			Status        string
			PaymentMethod string
			ChamaID       string
			InitiatedBy   string
			RecipientID   sql.NullString
			MetadataJSON  sql.NullString
			CreatedAt     time.Time
			UpdatedAt     time.Time
			FirstName     sql.NullString
			LastName      sql.NullString
			Email         sql.NullString
		}

		err := rows.Scan(
			&tx.ID, &tx.Type, &tx.Amount, &tx.Currency, &tx.Description, &tx.Status, &tx.PaymentMethod,
			&tx.ChamaID, &tx.InitiatedBy, &tx.RecipientID, &tx.MetadataJSON, &tx.CreatedAt, &tx.UpdatedAt,
			&tx.FirstName, &tx.LastName, &tx.Email,
		)
		if err != nil {
			continue
		}

		// Parse metadata
		metadata := map[string]interface{}{}
		if tx.MetadataJSON.Valid && tx.MetadataJSON.String != "" {
			json.Unmarshal([]byte(tx.MetadataJSON.String), &metadata)
		}

		contribution := map[string]interface{}{
			"id":            tx.ID,
			"type":          tx.Type,
			"amount":        tx.Amount,
			"currency":      tx.Currency,
			"description":   tx.Description,
			"status":        tx.Status,
			"paymentMethod": tx.PaymentMethod,
			"chamaId":       tx.ChamaID,
			"user_id":       tx.InitiatedBy,
			"initiated_by":  tx.InitiatedBy,
			"recipient_id":  tx.RecipientID.String,
			"metadata":      metadata,
			"createdAt":     tx.CreatedAt.Format(time.RFC3339),
			"updatedAt":     tx.UpdatedAt.Format(time.RFC3339),
			"user": map[string]interface{}{
				"id":         tx.InitiatedBy,
				"first_name": tx.FirstName.String,
				"last_name":  tx.LastName.String,
				"email":      tx.Email.String,
				"full_name":  tx.FirstName.String + " " + tx.LastName.String,
			},
		}

		contributions = append(contributions, contribution)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    contributions,
		"count":   len(contributions),
		"message": fmt.Sprintf("Found %d contributions", len(contributions)),
	})
}

// GetChamaMembersForContributions returns the member list used for cash contribution selection.
func GetChamaMembersForContributions(c *gin.Context) {
	userID, ok := requireUserID(c)
	if !ok {
		return
	}

	chamaID, ok := requireParam(c, "chamaId", "Chama ID is required")
	if !ok {
		return
	}

	db := dbFromContext(c)
	if db == nil {
		return
	}

	// Only treasurers and chairpersons can access the member list for cash contributions
	var userRole string
	if err := db.QueryRow(`
		SELECT role FROM chama_members
		WHERE chama_id = $1 AND user_id = $2
	`, chamaID, userID).Scan(&userRole); err != nil {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Unable to verify user role in chama",
		})
		return
	}

	if userRole != "treasurer" && userRole != "chairperson" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only treasurers and chairpersons can access member list for cash contributions",
		})
		return
	}

	rows, err := db.Query(`
		SELECT
			cm.user_id,
			u.first_name,
			u.last_name,
			u.email,
			u.phone,
			u.avatar,
			cm.role,
			cm.total_contributions
		FROM chama_members cm
		JOIN users u ON cm.user_id = u.id
		WHERE cm.chama_id = $1
		ORDER BY u.first_name, u.last_name
	`, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch chama members: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var members []map[string]interface{}
	for rows.Next() {
		var userID, firstName, lastName, email, phone, role string
		var avatar sql.NullString
		var totalContributions float64

		if err := rows.Scan(&userID, &firstName, &lastName, &email, &phone, &avatar, &role, &totalContributions); err != nil {
			continue
		}

		member := map[string]interface{}{
			"id":                 userID,
			"firstName":          firstName,
			"lastName":           lastName,
			"fullName":           firstName + " " + lastName,
			"email":              email,
			"phone":              phone,
			"role":               role,
			"totalContributions": totalContributions,
		}

		if avatar.Valid {
			member["avatar"] = avatar.String
		}

		members = append(members, member)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    members,
		"message": fmt.Sprintf("Found %d members", len(members)),
	})
}

// GetMerryGoRoundContributionAmount returns the expected contribution amount for merry-go-round.
func GetMerryGoRoundContributionAmount(c *gin.Context) {
	_, ok := requireUserID(c)
	if !ok {
		return
	}

	chamaID, ok := requireParam(c, "chamaId", "Chama ID is required")
	if !ok {
		return
	}

	db := dbFromContext(c)
	if db == nil {
		return
	}

	var expectedAmount float64
	var mgrName string
	err := db.QueryRow(`
	    SELECT mgr.amount_per_round, mgr.name
	    FROM merry_go_rounds mgr
	    WHERE mgr.chama_id = $1 AND mgr.status = 'active'
	    ORDER BY mgr.created_at DESC
	    LIMIT 1
	`, chamaID).Scan(&expectedAmount, &mgrName)

	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "No active merry-go-round found for this chama",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get merry-go-round contribution amount",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": map[string]interface{}{
			"expectedAmount":   expectedAmount,
			"merryGoRoundName": mgrName,
			"chamaId":          chamaID,
		},
		"message": fmt.Sprintf("Expected merry-go-round contribution amount: %.2f KES", expectedAmount),
	})
}

// GetContribution is a placeholder endpoint.
func GetContribution(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Get contribution endpoint - coming soon",
	})
}
