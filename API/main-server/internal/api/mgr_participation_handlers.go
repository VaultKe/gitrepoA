package api

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"

	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// checkAndAdvanceMerryGoRound is a utility function that can be called directly
// to check and advance a merry-go-round without requiring a Gin context
func checkAndAdvanceMerryGoRound(db *sql.DB, merryGoRoundID, chamaID, userID string) error {
	// Get current round information
	var currentRound, totalParticipants int
	var status string
	err := db.QueryRow(`
		SELECT current_round, total_participants, status
		FROM merry_go_rounds
		WHERE id = $1 AND chama_id = $2
	`, merryGoRoundID, chamaID).Scan(&currentRound, &totalParticipants, &status)
	if err != nil {
		return fmt.Errorf("failed to get merry-go-round information: %v", err)
	}

	if status != "active" {
		return fmt.Errorf("merry-go-round is not active")
	}

	// Sequential rule: the round only moves to the next person once the CURRENT
	// recipient has actually received their payout (treasurer initiated +
	// chairperson confirmed the disbursement). Contributions being complete is
	// not enough on its own.
	var currentRecipientReceived sql.NullBool
	recErr := db.QueryRow(`
		SELECT has_received
		FROM merry_go_round_participants
		WHERE merry_go_round_id = $1 AND position = $2
	`, merryGoRoundID, currentRound).Scan(&currentRecipientReceived)
	if recErr == nil && !currentRecipientReceived.Bool {
		// Current recipient has not been paid yet — do not advance.
		return nil
	}

	// Count contributions for the current round (contributions made TO the current recipient)
	// Check both transactions and merry_go_round_payments tables
	var contributionCount int
	// First try merry_go_round_payments table (our dedicated table)
	err = db.QueryRow(`
		SELECT COUNT(DISTINCT mp.contributor_user_id)
		FROM merry_go_round_payments mp
		WHERE mp.merry_go_round_id = $1
			AND mp.round_number = $2
			AND mp.chama_id = $3
			AND mp.status = 'completed'
	`, merryGoRoundID, currentRound, chamaID).Scan(&contributionCount)

	if err != nil {
		// Fallback to transactions table for backward compatibility
		err = db.QueryRow(`
			SELECT COUNT(DISTINCT t.initiated_by)
			FROM transactions t
			WHERE t.type = 'contribution'
				AND (t.metadata::jsonb)->>'contributionType' = 'merry-go-round'
				AND (t.metadata::jsonb)->>'merryGoRoundId' = $1
				AND (t.metadata::jsonb)->>'roundNumber' = $2
				AND (t.metadata::jsonb)->>'chamaId' = $3
				AND t.status = 'completed'
		`, merryGoRoundID, currentRound, chamaID).Scan(&contributionCount)

		if err != nil {
			contributionCount = 0
		}
	}

	// Advance when the current recipient has been paid (the disbursement was
	// confirmed by the chairperson). If the participant row could not be read,
	// fall back to the legacy "everyone has contributed" trigger.
	recipientPaid := recErr == nil && currentRecipientReceived.Bool
	if recipientPaid || (recErr != nil && contributionCount >= (totalParticipants-1)) {
		// Advance to next round
		nextRound := currentRound + 1

		// Check if we've completed all rounds
		if nextRound > totalParticipants {
			// Mark merry-go-round as completed
			_, err = db.Exec(`
				UPDATE merry_go_rounds
				SET status = 'completed', updated_at = CURRENT_TIMESTAMP
				WHERE id = $1
			`, merryGoRoundID)

			if err != nil {
				return fmt.Errorf("failed to complete merry-go-round: %v", err)
			}
			return nil
		}

		// Calculate next payout date
		var frequency string
		var startDate time.Time
		err = db.QueryRow(`
			SELECT frequency, start_date FROM merry_go_rounds WHERE id = $1
		`, merryGoRoundID).Scan(&frequency, &startDate)
		if err != nil {
			log.Printf("Warning: Failed to get frequency for merry-go-round %s: %v", merryGoRoundID, err)
		}

		var nextPayoutDate time.Time
		if frequency == "weekly" {
			nextPayoutDate = startDate.AddDate(0, 0, nextRound*7)
		} else { // monthly or empty
			nextPayoutDate = startDate.AddDate(0, nextRound, 0)
		}

		// Advance to next round
		_, err = db.Exec(`
			UPDATE merry_go_rounds
			SET current_round = $1, next_payout_date = $2, updated_at = CURRENT_TIMESTAMP
			WHERE id = $3
		`, nextRound, nextPayoutDate, merryGoRoundID)

		if err != nil {
			return fmt.Errorf("failed to advance merry-go-round: %v", err)
		}
		return nil
	}
	return nil
}

func JoinMerryGoRound(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Join merry-go-round endpoint - coming soon",
	})
	c.Abort()
}

// CheckUserContributionStatus checks if a user has already contributed to the current round
func CheckUserContributionStatus(c *gin.Context) {

	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	chamaID := c.Param("chamaId")
	if chamaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama ID is required",
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

	// Check if a specific roundId is provided via query parameter
	roundID := c.Query("roundId")
	var merryGoRoundID string
	var currentRound int
	var amountPerRound float64
	var status string

	if roundID != "" {
		// Use the specific merry-go-round
		err := db.(*sql.DB).QueryRow(`
			SELECT id, current_round, amount_per_round, status
			FROM merry_go_rounds
			WHERE id = $1 AND chama_id = $2
		`, roundID, chamaID).Scan(&merryGoRoundID, &currentRound, &amountPerRound, &status)
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
				"error":   "Failed to get merry-go-round information",
			})
			return
		}
	} else {
		// Get the active merry-go-round for this chama (fallback behavior)
		err := db.(*sql.DB).QueryRow(`
			SELECT id, current_round, amount_per_round, status
			FROM merry_go_rounds
			WHERE chama_id = $1 AND status = 'active'
			ORDER BY created_at DESC
			LIMIT 1
		`, chamaID).Scan(&merryGoRoundID, &currentRound, &amountPerRound, &status)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusOK, gin.H{
					"success": true,
					"data": gin.H{
						"hasActiveMerryGoRound": false,
						"hasContributed":        false,
						"canContribute":         false,
						"message":               "No active merry-go-round found",
					},
				})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to check merry-go-round status",
			})
			return
		}
	}

	// Check if user has already contributed to this round with timeout
	var hasContributed bool
	queryCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// First check merry_go_round_payments table (our dedicated table)
	err := db.(*sql.DB).QueryRowContext(queryCtx, `
		SELECT EXISTS(
			SELECT 1 FROM merry_go_round_payments mp
			WHERE mp.merry_go_round_id = $1
				AND mp.round_number = $2
				AND mp.chama_id = $3
				AND mp.contributor_user_id = $4
				AND mp.status = 'completed'
		)
	`, merryGoRoundID, currentRound, chamaID, userID).Scan(&hasContributed)

	if err != nil {
		// Fallback to transactions table
		err = db.(*sql.DB).QueryRowContext(queryCtx, `
			SELECT EXISTS(
				SELECT 1 FROM transactions t
				WHERE t.type = 'contribution'
					AND (t.metadata::jsonb)->>'contributionType' = 'merry-go-round'
					AND (t.metadata::jsonb)->>'merryGoRoundId' = $1
					AND (t.metadata::jsonb)->>'roundNumber' = $2
					AND (t.metadata::jsonb)->>'chamaId' = $3
					AND t.initiated_by = $4
					AND t.status = 'completed'
			)
		`, merryGoRoundID, currentRound, chamaID, userID).Scan(&hasContributed)

		if err != nil {
			if err == context.DeadlineExceeded {
				c.JSON(http.StatusRequestTimeout, gin.H{
					"success": false,
					"error":   "Request timed out. Please try again.",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to check contribution status",
			})
			return
		}
	}

	// Get current recipient info
	var currentRecipientID string
	var recipientName string
	err = db.(*sql.DB).QueryRow(`
		SELECT mgrp.user_id, COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.last_name, 'Member')
		FROM merry_go_round_participants mgrp
		JOIN users u ON mgrp.user_id = u.id
		WHERE mgrp.merry_go_round_id = $1 AND mgrp.position = $2
	`, merryGoRoundID, currentRound).Scan(&currentRecipientID, &recipientName)

	if err != nil {
		recipientName = "Unknown"
	}

	// Count total contributions for this round - check merry_go_round_payments first
	var totalContributions int
	err = db.(*sql.DB).QueryRow(`
		SELECT COUNT(DISTINCT mp.contributor_user_id)
		FROM merry_go_round_payments mp
		WHERE mp.merry_go_round_id = $1
			AND mp.round_number = $2
			AND mp.chama_id = $3
			AND mp.status = 'completed'
	`, merryGoRoundID, currentRound, chamaID).Scan(&totalContributions)

	if err != nil {
		// Fallback to transactions table
		err = db.(*sql.DB).QueryRow(`
			SELECT COUNT(DISTINCT t.initiated_by)
			FROM transactions t
			WHERE t.type = 'contribution'
				AND (t.metadata::jsonb)->>'contributionType' = 'merry-go-round'
				AND (t.metadata::jsonb)->>'merryGoRoundId' = $1
				AND (t.metadata::jsonb)->>'roundNumber' = $2
				AND (t.metadata::jsonb)->>'chamaId' = $3
				AND t.status = 'completed'
		`, merryGoRoundID, currentRound, chamaID).Scan(&totalContributions)

		if err != nil {
			totalContributions = 0
		}
	}

	// Get total participants
	var totalParticipants int
	err = db.(*sql.DB).QueryRow(`
		SELECT COUNT(*)
		FROM merry_go_round_participants
		WHERE merry_go_round_id = $1
	`, merryGoRoundID).Scan(&totalParticipants)

	if err != nil {
		totalParticipants = 0
	}

	// Check if user is a participant in this merry-go-round
	var isParticipant bool
	err = db.(*sql.DB).QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM merry_go_round_participants
			WHERE merry_go_round_id = $1 AND user_id = $2
		)
	`, merryGoRoundID, userID).Scan(&isParticipant)
	if err != nil {
		isParticipant = false
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"hasActiveMerryGoRound": true,
			"hasContributed":        hasContributed,
			"canContribute":         !hasContributed,
			"isParticipant":         isParticipant,
			"currentRound":          currentRound,
			"amountPerRound":        amountPerRound,
			"currentRecipient": gin.H{
				"id":   currentRecipientID,
				"name": recipientName,
			},
			"contributionStats": gin.H{
				"totalContributions": totalContributions,
				"totalParticipants":  totalParticipants,
				"progressPercentage": func() float64 {
					if totalParticipants > 0 {
						return (float64(totalContributions) * 100) / float64(totalParticipants)
					}
					return 0
				}(),
			},
			"roundComplete": totalContributions >= totalParticipants && totalParticipants > 0,
		},
	})
	c.Abort()
}

// CheckAndAdvanceRound checks if all members have contributed to the current recipient
// and automatically advances to the next member if the condition is met
func CheckAndAdvanceRound(c *gin.Context) {
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
			"error":   "Chama ID is required",
		})
		return
	}

	merryGoRoundID := c.Param("cycleId")
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

	// Get current round information for response
	var currentRound, totalParticipants int
	var status string
	err = db.(*sql.DB).QueryRow(`
		SELECT current_round, total_participants, status
		FROM merry_go_rounds
		WHERE id = $1 AND chama_id = $2
	`, merryGoRoundID, chamaID).Scan(&currentRound, &totalParticipants, &status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get merry-go-round information",
		})
		return
	}

	if status != "active" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Merry-go-round is not active",
		})
		return
	}

	// Use the utility function to check and advance
	err = checkAndAdvanceMerryGoRound(db.(*sql.DB), merryGoRoundID, chamaID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   fmt.Sprintf("Failed to check round advancement: %v", err),
		})
		return
	}

	// Get updated round information after potential advancement
	var updatedCurrentRound int
	var updatedStatus string
	err = db.(*sql.DB).QueryRow(`
		SELECT current_round, status
		FROM merry_go_rounds
		WHERE id = $1 AND chama_id = $2
	`, merryGoRoundID, chamaID).Scan(&updatedCurrentRound, &updatedStatus)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get updated merry-go-round information",
		})
		return
	}

	// Count current contributions (contributions made TO the current recipient)
	// Check merry_go_round_payments table first, then fallback to transactions
	var contributionCount int
	err = db.(*sql.DB).QueryRow(`
		SELECT COUNT(DISTINCT mp.contributor_user_id)
		FROM merry_go_round_payments mp
		WHERE mp.merry_go_round_id = $1
			AND mp.round_number = $2
			AND mp.chama_id = $3
			AND mp.status = 'completed'
	`, merryGoRoundID, currentRound, chamaID).Scan(&contributionCount)

	if err != nil {
		err = db.(*sql.DB).QueryRow(`
			SELECT COUNT(DISTINCT t.initiated_by)
			FROM transactions t
			WHERE t.type = 'contribution'
				AND (t.metadata::jsonb)->>'contributionType' = 'merry-go-round'
				AND (t.metadata::jsonb)->>'merryGoRoundId' = $1
				AND (t.metadata::jsonb)->>'roundNumber' = $2
				AND (t.metadata::jsonb)->>'chamaId' = $3
				AND t.status = 'completed'
		`, merryGoRoundID, currentRound, chamaID).Scan(&contributionCount)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to count contributions",
			})
			return
		}
	}

	// Return appropriate response based on status
	if updatedStatus == "completed" {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Merry-go-round completed successfully!",
			"data": map[string]interface{}{
				"merryGoRoundId": merryGoRoundID,
				"status":         "completed",
				"finalRound":     updatedCurrentRound,
				"totalRounds":    totalParticipants,
			},
		})
		c.Abort()
	} else if updatedCurrentRound > currentRound {
		// Round was advanced
		var nextPayoutDate time.Time
		err = db.(*sql.DB).QueryRow(`
			SELECT next_payout_date FROM merry_go_rounds WHERE id = $1
		`, merryGoRoundID).Scan(&nextPayoutDate)

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": fmt.Sprintf("Round %d completed! Advanced to round %d", currentRound, updatedCurrentRound),
			"data": map[string]interface{}{
				"merryGoRoundId": merryGoRoundID,
				"previousRound":  currentRound,
				"currentRound":   updatedCurrentRound,
				"nextPayoutDate": nextPayoutDate.Format("2006-01-02"),
				"totalRounds":    totalParticipants,
			},
		})
		c.Abort()
	} else {
		// Round not yet complete
		totalContributionsNeeded := totalParticipants - 1
		remainingContributions := totalContributionsNeeded - contributionCount
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": fmt.Sprintf("Round %d in progress: %d/%d contributions completed", updatedCurrentRound, contributionCount, totalContributionsNeeded),
			"data": map[string]interface{}{
				"merryGoRoundId":           merryGoRoundID,
				"currentRound":             updatedCurrentRound,
				"contributionsCompleted":   contributionCount,
				"totalContributionsNeeded": totalContributionsNeeded,
				"remainingContributions":   remainingContributions,
				"progressPercentage":       (contributionCount * 100) / totalContributionsNeeded,
			},
		})
		c.Abort()
	}
}

// remainingMerryGoRoundRounds and merryGoRoundRecurrenceRule together turn a
// merry-go-round's rotation into a single recurring calendar series instead
// of just its next payout date, so "add to calendar" surfaces every
// remaining date -- one per participant's turn -- not only the next one.
func remainingMerryGoRoundRounds(currentRound, totalParticipants int) int {
	remaining := totalParticipants - currentRound + 1
	if remaining < 1 {
		return 1
	}
	return remaining
}

// merryGoRoundRecurrenceRule returns an RFC5545 RRULE line for the remaining
// rounds, matching exactly how checkAndAdvanceMerryGoRound computes each
// next_payout_date (start_date + round*7 days for weekly, +round months for
// monthly) so the series lines up with the real schedule. A single
// remaining round needs no recurrence at all -- nil means "just one event".
func merryGoRoundRecurrenceRule(frequency string, remainingRounds int) []string {
	if remainingRounds <= 1 {
		return nil
	}
	freq := "MONTHLY"
	if frequency == "weekly" {
		freq = "WEEKLY"
	}
	return []string{fmt.Sprintf("RRULE:FREQ=%s;COUNT=%d", freq, remainingRounds)}
}

// GetMerryGoRoundCalendarAddEventURL returns a pre-filled Google Calendar event URL for a merry-go-round payout
func GetMerryGoRoundCalendarAddEventURL(c *gin.Context) {
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

	// Get merry-go-round details
	var mgr struct {
		ID                string    `json:"id"`
		Name              string    `json:"name"`
		Description       string    `json:"description"`
		AmountPerRound    float64   `json:"amountPerRound"`
		Frequency         string    `json:"frequency"`
		NextPayoutDate    time.Time `json:"nextPayoutDate"`
		ChamaID           string    `json:"chamaId"`
		CurrentRound      int       `json:"currentRound"`
		TotalParticipants int       `json:"totalParticipants"`
	}

	err := db.(*sql.DB).QueryRow(`
		SELECT id, name, description, amount_per_round, frequency, next_payout_date, chama_id,
			   current_round, total_participants
		FROM merry_go_rounds
		WHERE id = $1
	`, merryGoRoundID).Scan(
		&mgr.ID, &mgr.Name, &mgr.Description, &mgr.AmountPerRound, &mgr.Frequency, &mgr.NextPayoutDate, &mgr.ChamaID,
		&mgr.CurrentRound, &mgr.TotalParticipants,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "Merry-go-round not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to fetch merry-go-round details: " + err.Error(),
			})
		}
		return
	}

	// Get chama name for better labeling
	var chamaName string
	err = db.(*sql.DB).QueryRow("SELECT name FROM chamas WHERE id = $1", mgr.ChamaID).Scan(&chamaName)
	if err != nil {
		chamaName = "Chama"
	}

	remainingRounds := remainingMerryGoRoundRounds(mgr.CurrentRound, mgr.TotalParticipants)
	recurrence := merryGoRoundRecurrenceRule(mgr.Frequency, remainingRounds)

	// Build event summary and description
	summary := fmt.Sprintf("%s — %s", mgr.Name, chamaName)
	description := fmt.Sprintf("Merry-Go-Round payout reminder.\n\nAmount: %.2f KES\nFrequency: %s\n\n", mgr.AmountPerRound, mgr.Frequency)
	if len(recurrence) > 0 {
		description += fmt.Sprintf("Repeats every %s for the remaining %d payout rounds of this cycle.", mgr.Frequency, remainingRounds)
	} else {
		description += "Next payout date for the merry-go-round cycle."
	}

	// Use next payout date as the event date
	// Set time to 9:00 AM EAT for the reminder
	eat, _ := time.LoadLocation("Africa/Nairobi")
	eventDate := mgr.NextPayoutDate.In(eat)
	startTime := time.Date(eventDate.Year(), eventDate.Month(), eventDate.Day(), 9, 0, 0, 0, eat)
	endTime := startTime.Add(1 * time.Hour) // 1 hour duration

	// Google Calendar template URL
	const template = "https://calendar.google.com/calendar/render"
	params := url.Values{}
	params.Set("action", "TEMPLATE")
	params.Set("text", summary)
	params.Set("details", description)
	params.Set("location", chamaName)

	// Provide local datetime without Z and set ctz to Africa/Nairobi for accurate display
	toLocal := func(t time.Time) string { return t.Format("20060102T150405") }
	params.Set("dates", fmt.Sprintf("%s/%s", toLocal(startTime), toLocal(endTime)))
	params.Set("ctz", "Africa/Nairobi")
	// Undocumented but long-standing quick-add param: repeats the event for
	// the remaining rounds instead of adding only the next one. If Google
	// ever drops support for it, this just degrades to a single event --
	// exactly today's behaviour -- so there is no failure mode here.
	if len(recurrence) > 0 {
		params.Set("recur", recurrence[0])
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"url": template + "?" + params.Encode(),
		},
	})
	c.Abort()
}

// CreateMerryGoRoundCalendarEvent creates the event in the user's Google Calendar
func CreateMerryGoRoundCalendarEvent(c *gin.Context) {
	merryGoRoundID := c.Param("id")
	if merryGoRoundID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Merry-go-round ID is required"})
		return
	}

	// Auth user
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
		return
	}

	// Get DB and merry-go-round details
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Database connection not available"})
		return
	}

	var mgr struct {
		ID                string    `json:"id"`
		Name              string    `json:"name"`
		Description       string    `json:"description"`
		AmountPerRound    float64   `json:"amountPerRound"`
		Frequency         string    `json:"frequency"`
		NextPayoutDate    time.Time `json:"nextPayoutDate"`
		ChamaID           string    `json:"chamaId"`
		CurrentRound      int       `json:"currentRound"`
		TotalParticipants int       `json:"totalParticipants"`
	}

	err := db.(*sql.DB).QueryRow(`
		SELECT id, name, description, amount_per_round, frequency, next_payout_date, chama_id,
			   current_round, total_participants
		FROM merry_go_rounds
		WHERE id = $1
	`, merryGoRoundID).Scan(
		&mgr.ID, &mgr.Name, &mgr.Description, &mgr.AmountPerRound, &mgr.Frequency, &mgr.NextPayoutDate, &mgr.ChamaID,
		&mgr.CurrentRound, &mgr.TotalParticipants,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Merry-go-round not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to get merry-go-round: " + err.Error()})
		}
		return
	}

	// Get chama name
	var chamaName string
	err = db.(*sql.DB).QueryRow("SELECT name FROM chamas WHERE id = $1", mgr.ChamaID).Scan(&chamaName)
	if err != nil {
		chamaName = "Chama"
	}

	// Get the user's stored Google tokens
	driveService := services.NewGoogleDriveService(db.(*sql.DB))
	token, err := driveService.GetUserTokens(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Google account not connected for this user"})
		return
	}

	// Initialize CalendarService
	creds := os.Getenv("GOOGLE_CALENDAR_CREDENTIALS_JSON")
	if creds == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   "Google Calendar integration is not configured on this server. Please contact the administrator to set up Google Calendar credentials.",
			"code":    "CALENDAR_NOT_CONFIGURED",
		})
		return
	}
	calService, err := services.NewCalendarService([]byte(creds))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to initialize calendar service. The Google Calendar credentials may be invalid.",
			"details": err.Error(),
		})
		return
	}
	if err := calService.InitializeWithToken(token); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to authorize calendar: " + err.Error()})
		return
	}

	remainingRounds := remainingMerryGoRoundRounds(mgr.CurrentRound, mgr.TotalParticipants)
	recurrence := merryGoRoundRecurrenceRule(mgr.Frequency, remainingRounds)

	// Build event with accurate start/end and EAT timezone
	title := fmt.Sprintf("%s — %s", mgr.Name, chamaName)
	desc := fmt.Sprintf("%s\n\nAmount: %.2f KES\nFrequency: %s\n\n", mgr.Description, mgr.AmountPerRound, mgr.Frequency)
	if len(recurrence) > 0 {
		desc += fmt.Sprintf("Repeats every %s for the remaining %d payout rounds of this cycle.", mgr.Frequency, remainingRounds)
	} else {
		desc += "Next payout date for the merry-go-round cycle."
	}

	// Set time to 9:00 AM EAT for the reminder
	eat, _ := time.LoadLocation("Africa/Nairobi")
	eventDate := mgr.NextPayoutDate.In(eat)
	startTime := time.Date(eventDate.Year(), eventDate.Month(), eventDate.Day(), 9, 0, 0, 0, eat)
	endTime := startTime.Add(1 * time.Hour)

	ev := &services.CalendarEvent{
		Title:       title,
		Description: desc,
		StartTime:   startTime,
		EndTime:     endTime,
		Location:    chamaName,
		// One event, repeating for every remaining round -- see
		// merryGoRoundRecurrenceRule -- rather than only the next payout, so
		// this reminds the user (and, per the reminder overrides below,
		// keeps reminding them) for the whole rest of the rotation, not just
		// its first upcoming date.
		Recurrence: recurrence,
	}

	// Use primary calendar and reminders 30,10,0 minutes
	created, err := calService.CreateEventWithReminders("primary", ev, []int{30, 10, 0})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to create calendar event: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"eventId": created.Id, "htmlLink": created.HtmlLink}})
}
