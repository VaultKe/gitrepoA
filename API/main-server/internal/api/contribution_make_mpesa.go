package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"vaultke-backend/config"
	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// makeMpesaContribution initiates an M-Pesa STK push for a contribution. The
// transaction stays "pending" until the callback confirms it.
func makeMpesaContribution(c *gin.Context, db *sql.DB, req *MakeContributionRequest, userID, merryGoRoundID string, currentRound int, currentRecipientID string) {
	targetWalletID := fmt.Sprintf("wallet-%s", req.ChamaID)
	if _, err := db.Exec(`
		INSERT INTO wallets (id, owner_id, type, balance, created_at, updated_at)
		VALUES ($1, $2, 'chama', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (id) DO NOTHING
	`, targetWalletID, req.ChamaID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to ensure chama wallet exists",
		})
		return
	}

	userPhone := userID
	var phone string
	if err := db.QueryRow("SELECT phone FROM users WHERE id = $1", userID).Scan(&phone); err == nil {
		userPhone = phone
	}
	mpesaPhone := normalizeMpesaPhone(userPhone)

	reference := req.MpesaReference
	if reference == "" {
		reference = fmt.Sprintf("CONTRIB-%s-%d", req.ChamaID[:8], time.Now().UnixNano())
	}

	transactionID, err := createPendingMpesaTransaction(db, req.Amount, reference, targetWalletID, req.ChamaID, "contribution", "chama", userID)
	if err != nil {
		log.Printf("Failed to create pending contribution transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create transaction record",
		})
		return
	}

	// Update transaction metadata with merry-go-round details if applicable
	if req.Type == "merry-go-round" && merryGoRoundID != "" {
		mgrMetadataJSON, _ := json.Marshal(contributionMetadata(req, merryGoRoundID, currentRound, currentRecipientID))
		db.Exec("UPDATE transactions SET metadata = $1 WHERE id = $2", string(mgrMetadataJSON), transactionID)
	}

	cfg, exists := c.Get("config")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Configuration not available",
		})
		return
	}

	mpesaService := services.NewMpesaService(db, cfg.(*config.Config))
	mpesaReq := &models.MpesaTransaction{
		PhoneNumber:      mpesaPhone,
		Amount:           req.Amount,
		AccountReference: reference,
		TransactionDesc:  req.Description,
	}

	stkResponse, err := mpesaService.InitiateSTKPush(mpesaReq)
	if err != nil {
		log.Printf("STK Push failed for contribution: %v", err)
		updateTransactionStatus(db, transactionID, models.TransactionStatusFailed)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to initiate M-Pesa payment: " + err.Error(),
			"data": map[string]interface{}{
				"transactionId": transactionID,
				"status":        "failed",
			},
		})
		return
	}

	updateTransactionCheckoutRequestID(db, transactionID, stkResponse.CheckoutRequestID)

	// Insert into merry_go_round_payments table for merry-go-round mpesa contributions
	if req.Type == "merry-go-round" && merryGoRoundID != "" {
		var contributorPosition int
		if err := db.QueryRow(`
			SELECT position FROM merry_go_round_participants
			WHERE merry_go_round_id = $1 AND user_id = $2
		`, merryGoRoundID, userID).Scan(&contributorPosition); err != nil {
			contributorPosition = 0
		}

		insertMerryGoRoundPayment(db, req, userID, userID, merryGoRoundID, currentRound, currentRecipientID, "pending", transactionID, req.Description)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "M-Pesa contribution initiated successfully",
		"data": map[string]interface{}{
			"transactionId":     transactionID,
			"checkoutRequestId": stkResponse.CheckoutRequestID,
			"customerMessage":   stkResponse.CustomerMessage,
			"status":            "pending",
		},
	})
}
