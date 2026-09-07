package api

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"

	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// makeCashContribution records a cash contribution paid by a treasurer/chairperson
// on behalf of another member, moving funds from the payer's personal wallet.
func makeCashContribution(c *gin.Context, db *sql.DB, tx *sql.Tx, req *MakeContributionRequest, userID, merryGoRoundID string, currentRound int, currentRecipientID string) {
	walletService := services.NewWalletService(db)

	// Get payer's personal wallet (treasurer/chairperson paying on behalf)
	payerWallet, err := walletService.GetWalletByOwnerAndType(userID, models.WalletTypePersonal)
	if err != nil {
		payerWallet, err = walletService.CreateWallet(userID, models.WalletTypePersonal)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to ensure your wallet exists",
			})
			return
		}
	}

	if payerWallet.Balance < req.Amount {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   fmt.Sprintf("Insufficient balance in your wallet. You need KES %.2f to pay on behalf of this member.", req.Amount),
		})
		return
	}

	if !payerWallet.IsAvailable() {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Your wallet is not available",
		})
		return
	}

	// Get or create chama wallet
	recipientWalletID := fmt.Sprintf("wallet-%s", req.ChamaID)
	recipientWallet, err := walletService.GetWalletByID(recipientWalletID)
	if err != nil {
		recipientWallet, err = walletService.CreateWallet(req.ChamaID, models.WalletTypeChama)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to ensure chama wallet exists",
			})
			return
		}
	}

	if !recipientWallet.IsAvailable() {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Chama wallet is not available",
		})
		return
	}

	description := req.Description
	if description == "" {
		description = fmt.Sprintf("Cash contribution paid on behalf of %s to %s", req.ContributorID, req.ChamaID)
	}

	metadata := contributionMetadata(req, merryGoRoundID, currentRound, currentRecipientID)
	metadata["cashContributionOnBehalf"] = true
	metadata["payerId"] = userID
	metadata["beneficiaryId"] = req.ContributorID

	transferTx := &models.TransactionCreation{
		FromWalletID:  &payerWallet.ID,
		ToWalletID:    &recipientWallet.ID,
		ChamaID:       req.ChamaID,
		Type:          models.TransactionTypeTransfer,
		Amount:        req.Amount,
		Description:   &description,
		PaymentMethod: models.PaymentMethodWalletTransfer,
		Metadata:      metadata,
	}

	processedTx, err := walletService.CreateTransaction(transferTx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to process cash contribution payment: " + err.Error(),
		})
		return
	}

	if err := walletService.ProcessTransaction(processedTx.ID); err != nil {
		log.Printf("Failed to process cash transaction (update balances): %v", err)
	}

	transactionID := processedTx.ID

	// Update chama's total_funds
	if _, err := db.Exec(`
		UPDATE chamas
		SET total_funds = (
			SELECT COALESCE(SUM(balance), 0)
			FROM wallets
			WHERE owner_id = $1 AND type = 'chama'
			  AND COALESCE(subwallet_type, 'main') NOT IN ('welfare', 'merry_go_round', 'merry-go-round')
		), updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`, req.ChamaID, req.ChamaID); err != nil {
		fmt.Printf("Warning: Failed to update chama total_funds for cash: %v\n", err)
	}

	// Update member contributions for the beneficiary
	updateMemberContribution(tx, req.ChamaID, req.ContributorID, req.Amount)

	// Insert into merry_go_round_payments table for merry-go-round cash contributions
	if req.Type == "merry-go-round" && merryGoRoundID != "" {
		var contributorPosition int
		if err := tx.QueryRow(`
			SELECT position FROM merry_go_round_participants
			WHERE merry_go_round_id = $1 AND user_id = $2
		`, merryGoRoundID, req.ContributorID).Scan(&contributorPosition); err != nil {
			contributorPosition = 0
		}

		insertMerryGoRoundPayment(tx, req, userID, req.ContributorID, merryGoRoundID, currentRound, currentRecipientID, "completed", transactionID, req.Description)
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to commit transaction: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Cash contribution processed successfully. Your wallet has been deducted.",
		"data": map[string]interface{}{
			"transactionId": transactionID,
			"amount":        req.Amount,
			"type":          req.Type,
			"status":        "completed",
			"paymentMethod": req.PaymentMethod,
			"contributorId": req.ContributorID,
			"cashType":      req.CashType,
			"recordedBy":    userID,
		},
	})
}
