package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Merry-Go-Round handlers
func GetMerryGoRounds(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
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

	// Check if user is a member of the chama
	var membershipExists bool
	err := db.(*sql.DB).QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM chama_members
			WHERE chama_id = $1 AND user_id = $2 AND is_active = TRUE
		)
	`, chamaID, userID).Scan(&membershipExists)
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

	// Query merry-go-rounds for the chama
	rows, err := db.(*sql.DB).Query(`
		SELECT
			mgr.id, mgr.chama_id, mgr.name, mgr.description, mgr.amount_per_round,
			mgr.frequency, mgr.total_participants, mgr.current_round, mgr.status,
			mgr.start_date, mgr.next_payout_date, mgr.created_by, mgr.created_at,
			u.first_name, u.last_name, u.email
		FROM merry_go_rounds mgr
		JOIN users u ON mgr.created_by = u.id
		WHERE mgr.chama_id = $1
		ORDER BY mgr.created_at DESC
	`, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch merry-go-rounds: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var merryGoRounds []map[string]interface{}
	for rows.Next() {
		var mgr struct {
			ID                string     `json:"id"`
			ChamaID           string     `json:"chamaId"`
			Name              string     `json:"name"`
			Description       string     `json:"description"`
			AmountPerRound    float64    `json:"amountPerRound"`
			Frequency         string     `json:"frequency"`
			TotalParticipants int        `json:"totalParticipants"`
			CurrentRound      int        `json:"currentRound"`
			Status            string     `json:"status"`
			StartDate         time.Time  `json:"startDate"`
			NextPayoutDate    *time.Time `json:"nextPayoutDate"`
			CreatedBy         string     `json:"createdBy"`
			CreatedAt         time.Time  `json:"createdAt"`
			CreatorFirstName  string     `json:"creatorFirstName"`
			CreatorLastName   string     `json:"creatorLastName"`
			CreatorEmail      string     `json:"creatorEmail"`
		}

		err := rows.Scan(
			&mgr.ID, &mgr.ChamaID, &mgr.Name, &mgr.Description, &mgr.AmountPerRound,
			&mgr.Frequency, &mgr.TotalParticipants, &mgr.CurrentRound, &mgr.Status,
			&mgr.StartDate, &mgr.NextPayoutDate, &mgr.CreatedBy, &mgr.CreatedAt,
			&mgr.CreatorFirstName, &mgr.CreatorLastName, &mgr.CreatorEmail,
		)
		if err != nil {
			continue // Skip invalid rows
		}

		nextPayoutDateStr := ""
		if mgr.NextPayoutDate != nil {
			nextPayoutDateStr = mgr.NextPayoutDate.Format(time.RFC3339)
		}

		// For active merry-go-rounds, check contribution count and round completion
		var contributionCount int
		var totalParticipants int
		var roundComplete bool
		if mgr.Status == "active" {
			// Count all contributions for the current round (same as contribution page logic)
			err = db.(*sql.DB).QueryRow(`
				SELECT COUNT(DISTINCT t.initiated_by)
				FROM transactions t
				WHERE t.type = 'contribution'
					AND (t.metadata::jsonb)->>'contributionType' = 'merry-go-round'
					AND (t.metadata::jsonb)->>'merryGoRoundId' = $1
					AND (t.metadata::jsonb)->>'roundNumber' = $2
					AND (t.metadata::jsonb)->>'chamaId' = $3
					AND t.status = 'completed'
			`, mgr.ID, mgr.CurrentRound, mgr.ChamaID).Scan(&contributionCount)

			if err == nil {
				// Get total participants count
				err = db.(*sql.DB).QueryRow(`
					SELECT COUNT(*)
					FROM merry_go_round_participants
					WHERE merry_go_round_id = $1
				`, mgr.ID).Scan(&totalParticipants)

				if err == nil {
					roundComplete = contributionCount >= (totalParticipants - 1)
				} else {
					roundComplete = false
					totalParticipants = 0
				}
			} else {
				roundComplete = false
				contributionCount = 0
				totalParticipants = 0
			}
		} else {
			contributionCount = 0
			totalParticipants = 0
			roundComplete = false
		}

		// Get participants for this merry-go-round
		participantRows, err := db.(*sql.DB).Query(`
			SELECT
				mgrp.user_id, mgrp.position, mgrp.has_received,
				COALESCE(cm.is_active, true) as is_active,
				u.first_name, u.last_name, u.email
			FROM merry_go_round_participants mgrp
			JOIN users u ON mgrp.user_id = u.id
			LEFT JOIN chama_members cm ON cm.user_id = mgrp.user_id AND cm.chama_id = $2
			WHERE mgrp.merry_go_round_id = $1
			ORDER BY mgrp.position ASC
		`, mgr.ID, mgr.ChamaID)

		var participants []map[string]interface{}
		if err == nil {
			defer participantRows.Close()
			for participantRows.Next() {
				var p struct {
					UserID      string `json:"userId"`
					Position    int    `json:"position"`
					HasReceived bool   `json:"hasReceived"`
					IsActive    bool   `json:"is_active"`
					FirstName   string `json:"firstName"`
					LastName    string `json:"lastName"`
					Email       string `json:"email"`
				}

				err := participantRows.Scan(&p.UserID, &p.Position, &p.HasReceived, &p.IsActive, &p.FirstName, &p.LastName, &p.Email)
				if err == nil {
					// Determine status based on position, current round, and contribution count
					var status string
					if p.Position < mgr.CurrentRound {
						status = "completed"
					} else if p.Position == mgr.CurrentRound {
						if contributionCount >= (totalParticipants - 1) {
							status = "completed"
						} else {
							status = "current"
						}
					} else if p.Position == mgr.CurrentRound+1 && contributionCount >= (totalParticipants-1) {
						status = "current"
					} else {
						status = "pending"
					}

					participant := map[string]interface{}{
					"id":                         fmt.Sprintf("%s-%d", mgr.ID, p.Position), // Unique participant ID
					"user_id":                    p.UserID,
					"position":                   p.Position,
					"status":                     status,
					"has_received":               p.HasReceived,
					"is_active":                  p.IsActive,
					"user": map[string]interface{}{
							"id":         p.UserID,
							"first_name": p.FirstName,
							"last_name":  p.LastName,
							"email":      p.Email,
							"username":   p.Email, // Use email as username fallback
							"full_name":  p.FirstName + " " + p.LastName,
						},
						"has_contributed_this_cycle": false, // Mock - would need real tracking
					}
					participants = append(participants, participant)
				}
			}
		} else {
			fmt.Printf("❌ Failed to query participants for merry-go-round %s: %v\n", mgr.ID, err)
		}

		// Calculate total payout (amount per round * number of participants)
		totalPayout := mgr.AmountPerRound * float64(len(participants))

		mgrMap := map[string]interface{}{
			"id":                 mgr.ID,
			"chamaId":            mgr.ChamaID,
			"name":               mgr.Name,
			"description":        mgr.Description,
			"amountPerRound":     mgr.AmountPerRound,
			"amount_per_round":   mgr.AmountPerRound, // Alternative field name
			"frequency":          mgr.Frequency,
			"totalParticipants":  mgr.TotalParticipants,
			"total_participants": len(participants), // Use actual participant count
			"currentRound":       mgr.CurrentRound,
			"current_round":      mgr.CurrentRound,     // Alternative field name
			"current_position":   mgr.CurrentRound - 1, // Zero-based position
			"status":             mgr.Status,
			"startDate":          mgr.StartDate.Format("2006-01-02"),
			"start_date":         mgr.StartDate.Format("2006-01-02"), // Alternative field name
			"nextPayoutDate":     nextPayoutDateStr,
			"next_payout_date":   nextPayoutDateStr, // Alternative field name
			"createdBy":          mgr.CreatedBy,
			"created_by":         mgr.CreatedBy, // Alternative field name
			"createdAt":          mgr.CreatedAt.Format(time.RFC3339),
			"created_at":         mgr.CreatedAt.Format(time.RFC3339), // Alternative field name
			"total_payout":       totalPayout,
			"members":            participants,
			"participants":       participants, // Alternative field name
			"roundComplete":      roundComplete,
			"creator": map[string]interface{}{
				"id":        mgr.CreatedBy,
				"firstName": mgr.CreatorFirstName,
				"lastName":  mgr.CreatorLastName,
				"email":     mgr.CreatorEmail,
				"fullName":  mgr.CreatorFirstName + " " + mgr.CreatorLastName,
			},
		}

		merryGoRounds = append(merryGoRounds, mgrMap)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    merryGoRounds,
		"message": fmt.Sprintf("Found %d merry-go-rounds", len(merryGoRounds)),
		"meta": map[string]interface{}{
			"total":   len(merryGoRounds),
			"chamaId": chamaID,
		},
	})
		c.Abort()
}

// GetMerryGoRound returns a single merry-go-round by ID with its participants
func GetMerryGoRound(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	merryGoRoundID := c.Param("id")
	if merryGoRoundID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Merry-go-round ID is required",
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

	// First get the merry-go-round details
	var mgr struct {
		ID                string     `json:"id"`
		ChamaID           string     `json:"chamaId"`
		Name              string     `json:"name"`
		Description       string     `json:"description"`
		AmountPerRound    float64    `json:"amountPerRound"`
		Frequency         string     `json:"frequency"`
		TotalParticipants int        `json:"totalParticipants"`
		CurrentRound      int        `json:"currentRound"`
		Status            string     `json:"status"`
		StartDate         time.Time  `json:"startDate"`
		NextPayoutDate    *time.Time `json:"nextPayoutDate"`
		CreatedBy         string     `json:"createdBy"`
		CreatedAt         time.Time  `json:"createdAt"`
		CreatorFirstName  string     `json:"creatorFirstName"`
		CreatorLastName   string     `json:"creatorLastName"`
		CreatorEmail      string     `json:"creatorEmail"`
	}

	err := db.(*sql.DB).QueryRow(`
		SELECT mgr.id, mgr.chama_id, mgr.name, mgr.description, mgr.amount_per_round,
			mgr.frequency, mgr.total_participants, mgr.current_round, mgr.status,
			mgr.start_date, mgr.next_payout_date, mgr.created_by, mgr.created_at,
			u.first_name, u.last_name, u.email
		FROM merry_go_rounds mgr
		JOIN users u ON mgr.created_by = u.id
		WHERE mgr.id = $1
	`, merryGoRoundID).Scan(
		&mgr.ID, &mgr.ChamaID, &mgr.Name, &mgr.Description, &mgr.AmountPerRound,
		&mgr.Frequency, &mgr.TotalParticipants, &mgr.CurrentRound, &mgr.Status,
		&mgr.StartDate, &mgr.NextPayoutDate, &mgr.CreatedBy, &mgr.CreatedAt,
		&mgr.CreatorFirstName, &mgr.CreatorLastName, &mgr.CreatorEmail,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "Merry-go-round not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch merry-go-round: " + err.Error(),
		})
		return
	}

	// Check if user is a member of the chama
	var membershipExists bool
	err = db.(*sql.DB).QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM chama_members
			WHERE chama_id = $1 AND user_id = $2 AND is_active = TRUE
		)
	`, mgr.ChamaID, userID).Scan(&membershipExists)

	if err == nil && !membershipExists {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied. You are not a member of this chama.",
		})
		return
	}

	// Get participants for this merry-go-round
	participantRows, err := db.(*sql.DB).Query(`
		SELECT
			mgrp.user_id, mgrp.position, mgrp.has_received,
			COALESCE(cm.is_active, true) as is_active,
			u.first_name, u.last_name, u.email
		FROM merry_go_round_participants mgrp
		JOIN users u ON mgrp.user_id = u.id
		LEFT JOIN chama_members cm ON cm.user_id = mgrp.user_id AND cm.chama_id = $2
		WHERE mgrp.merry_go_round_id = $1
		ORDER BY mgrp.position ASC
	`, mgr.ID, mgr.ChamaID)

	var participants []map[string]interface{}
	if err == nil {
		defer participantRows.Close()
		for participantRows.Next() {
			var p struct {
				UserID      string `json:"userId"`
				Position    int    `json:"position"`
				HasReceived bool   `json:"hasReceived"`
				IsActive    bool   `json:"is_active"`
				FirstName   string `json:"firstName"`
				LastName    string `json:"lastName"`
				Email       string `json:"email"`
			}

			err := participantRows.Scan(&p.UserID, &p.Position, &p.HasReceived, &p.IsActive, &p.FirstName, &p.LastName, &p.Email)
			if err == nil {
			participant := map[string]interface{}{
				"id":                         fmt.Sprintf("%s-%d", mgr.ID, p.Position),
				"user_id":                    p.UserID,
				"position":                   p.Position,
				"status":                     "pending",
				"has_received":               p.HasReceived,
				"is_active":                  p.IsActive,
				"has_contributed_this_cycle": false,
					"user": map[string]interface{}{
						"id":         p.UserID,
						"first_name": p.FirstName,
						"last_name":  p.LastName,
						"email":      p.Email,
						"username":   p.Email,
						"full_name":  p.FirstName + " " + p.LastName,
					},
				}
				participants = append(participants, participant)
			}
		}
	}

	nextPayoutDateStr := ""
	if mgr.NextPayoutDate != nil {
		nextPayoutDateStr = mgr.NextPayoutDate.Format(time.RFC3339)
	}

	// Calculate total payout
	totalPayout := mgr.AmountPerRound * float64(len(participants))

	mgrMap := map[string]interface{}{
		"id":                 mgr.ID,
		"chamaId":            mgr.ChamaID,
		"name":               mgr.Name,
		"description":        mgr.Description,
		"amountPerRound":     mgr.AmountPerRound,
		"amount_per_round":   mgr.AmountPerRound,
		"frequency":          mgr.Frequency,
		"totalParticipants":  mgr.TotalParticipants,
		"total_participants": len(participants),
		"currentRound":       mgr.CurrentRound,
		"current_round":      mgr.CurrentRound,
		"current_position":   mgr.CurrentRound,
		"round_number":       mgr.CurrentRound,
		"position":           mgr.CurrentRound,
		"status":             mgr.Status,
		"startDate":          mgr.StartDate.Format("2006-01-02"),
		"start_date":         mgr.StartDate.Format("2006-01-02"),
		"nextPayoutDate":     nextPayoutDateStr,
		"next_payout_date":   nextPayoutDateStr,
		"createdBy":          mgr.CreatedBy,
		"created_by":         mgr.CreatedBy,
		"createdAt":          mgr.CreatedAt.Format(time.RFC3339),
		"created_at":         mgr.CreatedAt.Format(time.RFC3339),
		"total_payout":       totalPayout,
		"members":            participants,
		"participants":       participants,
		"roundComplete":      false,
		"creator": map[string]interface{}{
			"id":        mgr.CreatedBy,
			"firstName": mgr.CreatorFirstName,
			"lastName":  mgr.CreatorLastName,
			"email":     mgr.CreatorEmail,
			"fullName":  mgr.CreatorFirstName + " " + mgr.CreatorLastName,
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    mgrMap,
		"message": "Merry-go-round found",
	})
		c.Abort()
}

// GetMerryGoRoundPayments returns payments for a specific merry-go-round
func GetMerryGoRoundPayments(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	merryGoRoundID := c.Param("id")
	if merryGoRoundID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Merry-go-round ID is required",
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

	// First verify the merry-go-round exists and get its chama_id
	var chamaID string
	err := db.(*sql.DB).QueryRow(`
		SELECT chama_id FROM merry_go_rounds WHERE id = $1
	`, merryGoRoundID).Scan(&chamaID)

	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "Merry-go-round not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch merry-go-round: " + err.Error(),
		})
		return
	}

	// Check if user is a member of the chama
	var membershipExists bool
	err = db.(*sql.DB).QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM chama_members
			WHERE chama_id = $1 AND user_id = $2 AND is_active = TRUE
		)
	`, chamaID, userID).Scan(&membershipExists)

	if err == nil && !membershipExists {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied. You are not a member of this chama.",
		})
		return
	}

	// Query payments for this merry-go-round
	rows, err := db.(*sql.DB).Query(`
		SELECT
			mp.id, mp.merry_go_round_id, mp.chama_id, mp.payer_user_id, mp.payee_user_id,
			mp.contributor_user_id, mp.amount, mp.round_number, mp.position,
			mp.payment_method, mp.status, mp.transaction_id, mp.description,
			mp.metadata, mp.created_at, mp.updated_at,
			payer.first_name AS payer_first_name, payer.last_name AS payer_last_name, payer.email AS payer_email,
			payee.first_name AS payee_first_name, payee.last_name AS payee_last_name, payee.email AS payee_email,
			contributor.first_name AS contributor_first_name, contributor.last_name AS contributor_last_name, contributor.email AS contributor_email
		FROM merry_go_round_payments mp
		LEFT JOIN users payer ON mp.payer_user_id = payer.id
		LEFT JOIN users payee ON mp.payee_user_id = payee.id
		LEFT JOIN users contributor ON mp.contributor_user_id = contributor.id
		WHERE mp.merry_go_round_id = $1
		ORDER BY mp.created_at DESC
	`, merryGoRoundID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch payments: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var payments []map[string]interface{}
	for rows.Next() {
		var p struct {
			ID                   string
			MerryGoRoundID       string
			ChamaID              string
			PayerUserID          string
			PayeeUserID          string
			ContributorUserID    string
			Amount               float64
			RoundNumber          int
			Position             int
			PaymentMethod        string
			Status               string
			TransactionID        sql.NullString
			Description          sql.NullString
			MetadataJSON         []byte
			CreatedAt            time.Time
			UpdatedAt            time.Time
			PayerFirstName       sql.NullString
			PayerLastName        sql.NullString
			PayerEmail           sql.NullString
			PayeeFirstName       sql.NullString
			PayeeLastName        sql.NullString
			PayeeEmail           sql.NullString
			ContributorFirstName sql.NullString
			ContributorLastName  sql.NullString
			ContributorEmail     sql.NullString
		}

		err := rows.Scan(
			&p.ID, &p.MerryGoRoundID, &p.ChamaID, &p.PayerUserID, &p.PayeeUserID,
			&p.ContributorUserID, &p.Amount, &p.RoundNumber, &p.Position,
			&p.PaymentMethod, &p.Status, &p.TransactionID, &p.Description,
			&p.MetadataJSON, &p.CreatedAt, &p.UpdatedAt,
			&p.PayerFirstName, &p.PayerLastName, &p.PayerEmail,
			&p.PayeeFirstName, &p.PayeeLastName, &p.PayeeEmail,
			&p.ContributorFirstName, &p.ContributorLastName, &p.ContributorEmail,
		)
		if err != nil {
			continue
		}

		// Parse metadata
		metadata := map[string]interface{}{}
		if len(p.MetadataJSON) > 0 {
			json.Unmarshal(p.MetadataJSON, &metadata)
		}

		payment := map[string]interface{}{
			"id":                p.ID,
			"merryGoRoundId":    p.MerryGoRoundID,
			"chamaId":           p.ChamaID,
			"payerUserId":       p.PayerUserID,
			"payeeUserId":       p.PayeeUserID,
			"contributorUserId": p.ContributorUserID,
			"amount":            p.Amount,
			"roundNumber":       p.RoundNumber,
			"position":          p.Position,
			"paymentMethod":     p.PaymentMethod,
			"status":            p.Status,
			"transactionId":     p.TransactionID.String,
			"description":       p.Description.String,
			"metadata":          metadata,
			"createdAt":         p.CreatedAt.Format(time.RFC3339),
			"updatedAt":         p.UpdatedAt.Format(time.RFC3339),
			"payer": map[string]interface{}{
				"id":        p.PayerUserID,
				"firstName": p.PayerFirstName.String,
				"lastName":  p.PayerLastName.String,
				"email":     p.PayerEmail.String,
				"fullName":  p.PayerFirstName.String + " " + p.PayerLastName.String,
			},
			"payee": map[string]interface{}{
				"id":        p.PayeeUserID,
				"firstName": p.PayeeFirstName.String,
				"lastName":  p.PayeeLastName.String,
				"email":     p.PayeeEmail.String,
				"fullName":  p.PayeeFirstName.String + " " + p.PayeeLastName.String,
			},
			"contributor": map[string]interface{}{
				"id":        p.ContributorUserID,
				"firstName": p.ContributorFirstName.String,
				"lastName":  p.ContributorLastName.String,
				"email":     p.ContributorEmail.String,
				"fullName":  p.ContributorFirstName.String + " " + p.ContributorLastName.String,
			},
		}

		payments = append(payments, payment)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    payments,
		"count":   len(payments),
		"message": fmt.Sprintf("Found %d payments", len(payments)),
	})
		c.Abort()
}

func CreateMerryGoRound(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Create merry-go-round endpoint - coming soon",
	})
		c.Abort()
}

func UpdateMerryGoRound(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Update merry-go-round endpoint - coming soon",
	})
		c.Abort()
}

func DeleteMerryGoRound(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Delete merry-go-round endpoint - coming soon",
	})
		c.Abort()
}
