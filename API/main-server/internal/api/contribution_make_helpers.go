package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// MakeContributionRequest is the request body for recording a contribution.
type MakeContributionRequest struct {
	ChamaID        string  `json:"chamaId" binding:"required" validate:"required,uuid"`
	Amount         float64 `json:"amount" binding:"required" validate:"required,amount"`
	Description    string  `json:"description" validate:"max=200,safe_text,no_sql_injection,no_xss"`
	Type           string  `json:"type" validate:"alphanumeric"`
	PaymentMethod  string  `json:"paymentMethod" validate:"alphanumeric,max=50"`
	MpesaReference string  `json:"mpesaReference,omitempty"`
	Status         string  `json:"status,omitempty"`
	IsAnonymous    bool    `json:"isAnonymous,omitempty"`
	ContributorID  string  `json:"contributorId,omitempty"`
	CashType       string  `json:"cashType,omitempty"`
}

// execer is satisfied by both *sql.DB and *sql.Tx.
type execer interface {
	Exec(query string, args ...interface{}) (sql.Result, error)
}

// chamaMerryGoRoundWalletID is a chama's dedicated merry-go-round sub-wallet.
// Merry-go-round money is kept here, independent of the main chama wallet, and
// merry-go-round payouts are drawn only from it.
func chamaMerryGoRoundWalletID(chamaID string) string {
	return fmt.Sprintf("wallet-%s-merry_go_round", chamaID)
}

// ensureChamaMerryGoRoundWallet creates the merry-go-round sub-wallet row if it
// is missing and returns its id.
func ensureChamaMerryGoRoundWallet(ex execer, chamaID string) string {
	id := chamaMerryGoRoundWalletID(chamaID)
	_, _ = ex.Exec(`
		INSERT INTO wallets (id, type, owner_id, subwallet_type, chama_id, balance, currency, is_active, is_locked, created_at, updated_at)
		VALUES ($1, 'chama', $2, 'merry_go_round', $2, 0, 'KES', true, false, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, id, chamaID)
	return id
}

// resolveMerryGoRound validates a merry-go-round contribution: it confirms an
// active round exists, the amount matches, the recipient is resolvable, and the
// contributor has not already paid this round. When abort is true the response
// has already been written and the caller must return.
func resolveMerryGoRound(c *gin.Context, db *sql.DB, userID string, req *MakeContributionRequest) (merryGoRoundID string, currentRound int, currentRecipientID string, abort bool) {
	if req.Type != "merry-go-round" {
		return "", 0, "", false
	}

	var expectedAmount float64
	if err := db.QueryRow(`
        SELECT mgr.id, mgr.amount_per_round, mgr.current_round
        FROM merry_go_rounds mgr
        WHERE mgr.chama_id = $1 AND mgr.status = 'active'
        ORDER BY mgr.created_at DESC
        LIMIT 1
    `, req.ChamaID).Scan(&merryGoRoundID, &expectedAmount, &currentRound); err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "No active merry-go-round found for this chama. Please ensure you have an active merry-go-round before making contributions.",
			})
			return "", 0, "", true
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to validate merry-go-round contribution amount",
		})
		return "", 0, "", true
	}

	if req.Amount != expectedAmount {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   fmt.Sprintf("Invalid merry-go-round contribution amount. Expected: %.2f KES, Received: %.2f KES", expectedAmount, req.Amount),
		})
		return "", 0, "", true
	}

	if err := db.QueryRow(`
		SELECT mgrp.user_id
		FROM merry_go_round_participants mgrp
		WHERE mgrp.merry_go_round_id = $1 AND mgrp.position = $2
	`, merryGoRoundID, currentRound).Scan(&currentRecipientID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to determine current merry-go-round recipient",
		})
		return "", 0, "", true
	}

	// PREVENT DUPLICATE CONTRIBUTIONS: check if the contributor already paid this round
	contributionCheckerUserID := userID
	if req.PaymentMethod == "pay_for" && req.ContributorID != "" {
		contributionCheckerUserID = req.ContributorID
	}

	var hasContributed bool
	if err := db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM transactions t
			WHERE t.type = 'contribution'
				AND (t.metadata::jsonb)->>'contributionType' = 'merry-go-round'
				AND (t.metadata::jsonb)->>'chamaId' = $1
				AND (t.metadata::jsonb)->>'merryGoRoundId' = $2
				AND (t.metadata::jsonb)->>'roundNumber' = $3
				AND t.initiated_by = $4
				AND t.status = 'completed'
		)
	`, req.ChamaID, merryGoRoundID, currentRound, contributionCheckerUserID).Scan(&hasContributed); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to check contribution history",
		})
		return "", 0, "", true
	}

	if hasContributed {
		message := "You have already contributed to this merry-go-round round. Each member can only contribute once per round."
		if req.PaymentMethod == "pay_for" && req.ContributorID != "" {
			message = "The selected member has already contributed to this merry-go-round round. Each member can only contribute once per round."
		}
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   message,
		})
		return "", 0, "", true
	}

	if req.IsAnonymous {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Anonymous contributions are not allowed for merry-go-round. All contributions must be traceable to maintain fairness.",
		})
		return "", 0, "", true
	}

	return merryGoRoundID, currentRound, currentRecipientID, false
}

// validateCashPayment verifies that cash / pay_for contributions are initiated
// by a treasurer/chairperson for a valid chama member. abort=true means the
// response was written and the caller must return.
func validateCashPayment(c *gin.Context, db *sql.DB, userID string, req *MakeContributionRequest) (abort bool) {
	var userRole string
	if err := db.QueryRow(`
		SELECT role FROM chama_members
		WHERE chama_id = $1 AND user_id = $2
	`, req.ChamaID, userID).Scan(&userRole); err != nil {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Unable to verify user role in chama",
		})
		return true
	}

	if userRole != "treasurer" && userRole != "chairperson" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only treasurers and chairpersons can use this payment method",
		})
		return true
	}

	if req.ContributorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Contributor ID is required for this payment method",
		})
		return true
	}

	var contributorExists bool
	if err := db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM chama_members WHERE chama_id = $1 AND user_id = $2)
	`, req.ChamaID, req.ContributorID).Scan(&contributorExists); err != nil || !contributorExists {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Contributor is not a member of this chama",
		})
		return true
	}

	return false
}

// contributionMetadata builds the transaction metadata for a contribution.
func contributionMetadata(req *MakeContributionRequest, merryGoRoundID string, currentRound int, currentRecipientID string) map[string]interface{} {
	m := map[string]interface{}{
		"contributionType":    req.Type,
		"chamaId":             req.ChamaID,
		"savingsContribution": req.Type == "savings",
	}
	if req.Type == "merry-go-round" && merryGoRoundID != "" {
		m["merryGoRoundId"] = merryGoRoundID
		m["roundNumber"] = currentRound
		m["recipientId"] = currentRecipientID
	}
	return m
}

// insertMerryGoRoundPayment records a merry-go-round payment in the
// merry_go_round_payments table for audit/tracking.
func insertMerryGoRoundPayment(ex execer, req *MakeContributionRequest, payerUserID, contributorUserID, merryGoRoundID string, currentRound int, currentRecipientID, status, transactionID, description string) {
	metadata, _ := json.Marshal(contributionMetadata(req, merryGoRoundID, currentRound, currentRecipientID))

	if _, err := ex.Exec(`
		INSERT INTO merry_go_round_payments (
			id, merry_go_round_id, chama_id, payer_user_id, payee_user_id,
			contributor_user_id, amount, round_number, position, payment_method,
			status, transaction_id, description, metadata, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, uuid.New().String(), merryGoRoundID, req.ChamaID, payerUserID, currentRecipientID,
		contributorUserID, req.Amount, currentRound, 0, req.PaymentMethod,
		status, transactionID, description, string(metadata)); err != nil {
		fmt.Printf("❌ Error inserting into merry_go_round_payments: %v\n", err)
	}
}

// updateMemberContribution increments a member's total_contributions.
func updateMemberContribution(tx *sql.Tx, chamaID, userID string, amount float64) {
	if _, err := tx.Exec(`
		UPDATE chama_members
		SET total_contributions = total_contributions + $1,
		    last_contribution = CURRENT_TIMESTAMP
		WHERE chama_id = $2 AND user_id = $3
	`, amount, chamaID, userID); err != nil {
		fmt.Printf("❌ Error updating member contributions: %v\n", err)
	}
}
