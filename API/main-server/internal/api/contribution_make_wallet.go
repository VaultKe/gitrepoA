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

// makeWalletContribution processes a wallet (or pay_for) contribution by moving
// funds from the payer's personal wallet to the chama (or savings) wallet.
func makeWalletContribution(c *gin.Context, db *sql.DB, tx *sql.Tx, req *MakeContributionRequest, userID, merryGoRoundID string, currentRound int, currentRecipientID string) {
	walletService := services.NewWalletService(db)

	// Get or create user's personal wallet
	senderWallet, err := walletService.GetWalletByOwnerAndType(userID, models.WalletTypePersonal)
	if err != nil {
		senderWallet, err = walletService.CreateWallet(userID, models.WalletTypePersonal)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to ensure user wallet exists",
			})
			return
		}
	}

	if senderWallet.Balance < req.Amount {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Insufficient balance in personal wallet",
		})
		return
	}

	var recipientWalletID string
	var recipientWallet *models.Wallet

	if req.Type == "savings" {
		recipientWalletID = fmt.Sprintf("wallet-%s-savings", req.ChamaID)
		recipientWallet, err = walletService.GetWalletByID(recipientWalletID)
		if err != nil {
			if _, createErr := db.Exec(
				"INSERT INTO wallets (id, type, owner_id, subwallet_type, chama_id, balance, currency, is_active, is_locked, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) ON CONFLICT (id) DO NOTHING",
				recipientWalletID, "chama", req.ChamaID, "savings", req.ChamaID, 0, "KES", true, false,
			); createErr != nil {
				log.Printf("Failed to ensure savings wallet exists: %v", createErr)
			}
			recipientWallet, err = walletService.GetWalletByID(recipientWalletID)
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to ensure savings subwallet exists",
			})
			return
		}
	} else if req.Type == "merry-go-round" {
		// Merry-go-round money lives in its own sub-wallet, independent of the
		// main chama wallet; its payouts are drawn only from here.
		recipientWalletID = ensureChamaMerryGoRoundWallet(db, req.ChamaID)
		recipientWallet, err = walletService.GetWalletByID(recipientWalletID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to ensure merry-go-round subwallet exists",
			})
			return
		}
	} else {
		recipientWalletID = fmt.Sprintf("wallet-%s", req.ChamaID)
		recipientWallet, err = walletService.GetWalletByID(recipientWalletID)
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
	}

	if !senderWallet.IsAvailable() {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Sender wallet is not available",
		})
		return
	}

	if !recipientWallet.IsAvailable() {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Recipient wallet is not available",
		})
		return
	}

	description := req.Description
	if description == "" {
		description = fmt.Sprintf("%s contribution to %s", req.Type, req.ChamaID)
	}

	transferTx := &models.TransactionCreation{
		FromWalletID:  &senderWallet.ID,
		ToWalletID:    &recipientWallet.ID,
		ChamaID:       req.ChamaID,
		Type:          models.TransactionTypeTransfer,
		Amount:        req.Amount,
		Description:   &description,
		PaymentMethod: models.PaymentMethodWalletTransfer,
		Metadata:      contributionMetadata(req, merryGoRoundID, currentRound, currentRecipientID),
	}

	processedTx, err := walletService.CreateTransaction(transferTx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to process wallet transfer: " + err.Error(),
		})
		return
	}

	// Process the transaction to update wallet balances
	if err := walletService.ProcessTransaction(processedTx.ID); err != nil {
		log.Printf("Failed to process transaction (update balances): %v", err)
		// Continue anyway - the transaction is recorded for audit purposes
	}

	transactionID := processedTx.ID

	contributorUserID := userID
	if req.PaymentMethod == "cash" || req.PaymentMethod == "pay_for" {
		contributorUserID = req.ContributorID
	}

	updateMemberContribution(tx, req.ChamaID, contributorUserID, req.Amount)

	// Insert into merry_go_round_payments table for merry-go-round contributions
	if req.Type == "merry-go-round" && merryGoRoundID != "" {
		var contributorPosition int
		if err := tx.QueryRow(`
			SELECT position FROM merry_go_round_participants
			WHERE merry_go_round_id = $1 AND user_id = $2
		`, merryGoRoundID, contributorUserID).Scan(&contributorPosition); err != nil {
			contributorPosition = 0
		}

		insertMerryGoRoundPayment(tx, req, userID, contributorUserID, merryGoRoundID, currentRound, currentRecipientID, "completed", transactionID, req.Description)
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
		"message": "Savings contribution processed successfully",
		"data": map[string]interface{}{
			"transactionId": transactionID,
			"amount":        req.Amount,
			"type":          req.Type,
			"status":        "completed",
		},
	})
}
