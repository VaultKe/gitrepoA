package api

import (
	"database/sql"
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
				u.first_name, u.last_name, u.email
			FROM merry_go_round_participants mgrp
			JOIN users u ON mgrp.user_id = u.id
			WHERE mgrp.merry_go_round_id = $1
			ORDER BY mgrp.position ASC
		`, mgr.ID)

		var participants []map[string]interface{}
		if err == nil {
			defer participantRows.Close()
			for participantRows.Next() {
				var p struct {
					UserID      string `json:"userId"`
					Position    int    `json:"position"`
					HasReceived bool   `json:"hasReceived"`
					FirstName   string `json:"firstName"`
					LastName    string `json:"lastName"`
					Email       string `json:"email"`
				}

				err := participantRows.Scan(&p.UserID, &p.Position, &p.HasReceived, &p.FirstName, &p.LastName, &p.Email)
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
						"id":                       fmt.Sprintf("%s-%d", mgr.ID, p.Position), // Unique participant ID
						"user_id":                  p.UserID,
						"position":                 p.Position,
						"status":                   status,
						"has_received":             p.HasReceived,
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
}

func CreateMerryGoRound(c *gin.Context) {
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
		ChamaID           string  `json:"chamaId" binding:"required"`
		Name              string  `json:"name" binding:"required"`
		Description       string  `json:"description"`
		AmountPerRound    float64 `json:"amountPerRound" binding:"required"`
		Frequency         string  `json:"frequency" binding:"required"`
		TotalParticipants int     `json:"totalParticipants" binding:"required"`
		StartDate         string  `json:"startDate" binding:"required"`
		Participants      []struct {
			UserID   string `json:"userId"`
			Position int    `json:"position"`
			Name     string `json:"name"`
			Email    string `json:"email"`
		} `json:"participants"`
		ParticipantOrder string `json:"participantOrder"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	// Validate amount
	if req.AmountPerRound <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Amount per round must be greater than 0",
		})
		return
	}

	// Validate total participants
	if req.TotalParticipants < 2 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "At least 2 participants are required",
		})
		return
	}

	// Validate frequency
	validFrequencies := map[string]bool{"weekly": true, "monthly": true}
	if !validFrequencies[req.Frequency] {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Frequency must be 'weekly' or 'monthly'",
		})
		return
	}

	// Parse start date
	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid start date format. Use YYYY-MM-DD",
		})
		return
	}

	// Check if start date is not too far in the past (allow today and future dates)
	today := time.Now().Truncate(24 * time.Hour)
	if startDate.Before(today) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Start date cannot be in the past. Please select today or a future date.",
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
	err = db.(*sql.DB).QueryRow(`
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

	// Generate merry-go-round ID
	mgrID := fmt.Sprintf("mgr-%d", time.Now().UnixNano())

	// Calculate next payout date
	var nextPayoutDate time.Time
	if req.Frequency == "weekly" {
		nextPayoutDate = startDate.AddDate(0, 0, 7)
	} else { // monthly
		nextPayoutDate = startDate.AddDate(0, 1, 0)
	}

	// Insert merry-go-round into database
	_, err = db.(*sql.DB).Exec(`
		INSERT INTO merry_go_rounds (
			id, chama_id, name, description, amount_per_round, frequency,
			total_participants, current_round, status, start_date, next_payout_date,
			created_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 'active', $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, mgrID, req.ChamaID, req.Name, req.Description, req.AmountPerRound, req.Frequency, req.TotalParticipants, startDate, nextPayoutDate, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create merry-go-round: " + err.Error(),
		})
		return
	}

	// Insert participants into merry_go_round_participants table
	if len(req.Participants) > 0 {
		for i, participant := range req.Participants {
			participantID := fmt.Sprintf("mgrp-%d-%d", time.Now().UnixNano(), i)

			_, err = db.(*sql.DB).Exec(`
				INSERT INTO merry_go_round_participants (
					id, merry_go_round_id, user_id, position, has_received, received_at,
					total_contributed, joined_at
				) VALUES ($1, $2, $3, $4, FALSE, NULL, 0, CURRENT_TIMESTAMP)
			`, participantID, mgrID, participant.UserID, participant.Position)

			if err != nil {
				// Continue with other participants instead of failing completely
			} else {
			}
		}

		// Verify participants were inserted
		var participantCount int
		err = db.(*sql.DB).QueryRow(`
			SELECT COUNT(*) FROM merry_go_round_participants
			WHERE merry_go_round_id = $1
		`, mgrID).Scan(&participantCount)

		if err == nil {
		}
	} else {
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Merry-go-round created successfully! Members can now join.",
		"data": map[string]interface{}{
			"id":                mgrID,
			"chamaId":           req.ChamaID,
			"name":              req.Name,
			"description":       req.Description,
			"amountPerRound":    req.AmountPerRound,
			"frequency":         req.Frequency,
			"totalParticipants": req.TotalParticipants,
			"currentRound":      1,
			"status":            "active",
			"startDate":         req.StartDate,
			"nextPayoutDate":    nextPayoutDate.Format("2006-01-02"),
			"createdBy":         userID,
			"createdAt":         time.Now().Format(time.RFC3339),
		},
	})
}

func GetMerryGoRound(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Get merry-go-round endpoint - coming soon",
	})
}

func UpdateMerryGoRound(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Update merry-go-round endpoint - coming soon",
	})
}

func DeleteMerryGoRound(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Delete merry-go-round endpoint - coming soon",
	})
}
