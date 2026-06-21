package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"time"
	"net/http"
	"strconv"
	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"
	"vaultke-backend/internal/utils"

	"github.com/gin-gonic/gin"
)

// safeMeta reads a string key from a metadata map, returning "" on miss
func safeMeta(meta map[string]interface{}, key string) string {
	if v, ok := meta[key]; ok {
		if s, ok2 := v.(string); ok2 {
			return s
		}
	}
	return ""
}

// safeMetaInt reads an int/number key from a metadata map, returning 0 on miss
func safeMetaInt(meta map[string]interface{}, key string) int {
	if v, ok := meta[key]; ok {
		switch n := v.(type) {
		case float64:
			return int(n)
		case int:
			return n
		}
	}
	return 0
}

func GetUserTransactions(c *gin.Context) {
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

	// Parse pagination parameters
	limit := 50
	offset := 0
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}
	if offsetStr := c.Query("offset"); offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	// Create wallet service
	walletService := services.NewWalletService(db.(*sql.DB))

	// Get user's personal wallet
	wallet, err := walletService.GetWalletByOwnerAndType(userID.(string), models.WalletTypePersonal)
	if err != nil {
		// If wallet not found, return empty transaction list (user has no wallet yet)
		if err.Error() == "wallet not found" {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"data":    []interface{}{},
				"meta": map[string]interface{}{
					"limit":  limit,
					"offset": offset,
					"count":  0,
				},
			})
			return
		}
		log.Printf("Failed to get user wallet: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve wallet",
		})
		return
	}

	// Get wallet transactions (transfers, withdrawals, deposits — wallet-to-wallet)
	// NOTE: Contribution records stored in transactions() have from_wallet_id/to_wallet_id = NULL
	// so we must also query them directly by initiated_by below.
	walletTransactions, err := walletService.GetWalletTransactions(wallet.ID, limit, offset)
	if err != nil {
		log.Printf("Failed to get wallet transactions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve transactions",
		})
		return
	}

	// Also fetch contribution-type rows that were recorded by this user from the transactions table
	// (these have no wallet_ref and would be invisible to GetWalletTransactions)
	contribTxnRows, err := db.(*sql.DB).Query(`
		SELECT id, type, status, amount, currency,
		       description, reference, payment_method, metadata,
		       fees, initiated_by, recipient_id,
		       created_at, updated_at, chama_id
		FROM transactions
		WHERE initiated_by = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, userID.(string), limit, offset)
	if err != nil {
		log.Printf("Failed to query contribution transactions: %v", err)
	}
	var contribTxns []map[string]interface{}
	if contribTxnRows != nil {
		defer contribTxnRows.Close()
		// Build chama-name cache for all chama_ids encountered in this batch
		chamaNameCache := make(map[string]string)
		// Round-info cache: mgrID → {name, round, totalRounds, amount}
		mgrCache := make(map[string]map[string]interface{})

		for contribTxnRows.Next() {
			var id, type_, status, currency, initiatedBy, recipientID sql.NullString
			var amount float64
			var description, reference, paymentMethod, metadataJSON, fees sql.NullString
			var createdAt, updatedAt sql.NullTime
			var chamaID sql.NullString

			if err := contribTxnRows.Scan(
				&id, &type_, &status, &amount, &currency,
				&description, &reference, &paymentMethod, &metadataJSON,
				&fees, &initiatedBy, &recipientID,
				&createdAt, &updatedAt, &chamaID,
			); err != nil {
				log.Printf("Failed to scan contribution transaction: %v", err)
				continue
			}

			meta := make(map[string]interface{})
			if metadataJSON.Valid && metadataJSON.String != "" {
				_ = json.Unmarshal([]byte(metadataJSON.String), &meta)
			}

			chamaId := chamaID.String
			chamaName := ""
			if chamaId != "" {
				if n, ok := chamaNameCache[chamaId]; ok {
					chamaName = n
				} else {
					errC := db.(*sql.DB).QueryRow("SELECT name FROM chamas WHERE id = $1", chamaId).Scan(&chamaName)
					if errC != nil {
						chamaName = ""
					}
					chamaNameCache[chamaId] = chamaName
				}
			}

			contribType := safeMeta(meta, "contributionType")
			detailedDesc := ""
			if description.Valid && description.String != "" {
				detailedDesc = description.String
			}

			if contribType == "merry-go-round" || contribType == "merry_go_round" {
				mgrId := safeMeta(meta, "merryGoRoundId")
				roundNum := safeMetaInt(meta, "roundNumber")

				var mgrName string
				var totalRounds int
				var mgrAmount float64

				if mgrId != "" && contribTxnRows != nil {
					if info, ok := mgrCache[mgrId]; ok {
						mgrName = info["name"].(string)
						totalRounds = info["totalRounds"].(int)
						mgrAmount = info["amount"].(float64)
					} else {
						errM := db.(*sql.DB).QueryRow(`
							SELECT name, current_round, total_rounds, amount_per_round
							FROM merry_go_rounds WHERE id = $1
						`, mgrId).Scan(&mgrName, &totalRounds, mgrId)
						if errM != nil {
							mgrName = ""
						}
						mgrCache[mgrId] = map[string]interface{}{
							"name":        mgrName,
							"totalRounds": totalRounds,
							"amount":      mgrAmount,
						}
					}
				}

				recipientId := safeMeta(meta, "recipientId")
				recipientName := ""
				if recipientId != "" {
					db.(*sql.DB).QueryRow("SELECT first_name FROM users WHERE id = $1", recipientId).Scan(&recipientName)
				}

				roundInfo := ""
				if roundNum > 0 {
					roundInfo = fmt.Sprintf("Round %d of %d", roundNum, totalRounds)
				}
				recipientLabel := ""
				if recipientName != "" {
					recipientLabel = fmt.Sprintf(" → Recipient: %s", recipientName)
				} else if recipientId != "" {
					recipientLabel = fmt.Sprintf(" → Recipient ID: %s", recipientId)
				}
				detailedDesc = fmt.Sprintf("Merry-go-round — %s%s", chamaName, recipientLabel)
				if mgrName != "" {
					detailedDesc = fmt.Sprintf("Merry-go-round (%s) — %s%s%s", mgrName, chamaName, recipientLabel, roundInfo)
				}
			} else if contribType == "welfare" || contribType == "welfare_contribution" {
				welfareRecipient := safeMeta(meta, "welfareRecipientName")
				welfareReason := safeMeta(meta, "reason")
				if welfareRecipient != "" {
					detailedDesc = fmt.Sprintf("Welfare contribution — %s (%s)", welfareRecipient, chamaName)
				} else {
					detailedDesc = fmt.Sprintf("Welfare contribution — %s", chamaName)
				}
				if welfareReason != "" {
					detailedDesc += fmt.Sprintf(" · %s", welfareReason)
				}
			} else if contribType == "penalty" {
				detailedDesc = fmt.Sprintf("Penalty — %s", chamaName)
				penaltyReason := safeMeta(meta, "reason")
				if penaltyReason != "" {
					detailedDesc += fmt.Sprintf(" (%s)", penaltyReason)
				}
			} else if contribType == "special" {
				detailedDesc = fmt.Sprintf("Special contribution — %s", chamaName)
				specialPurpose := safeMeta(meta, "purpose")
				if specialPurpose != "" {
					detailedDesc += fmt.Sprintf(" (%s)", specialPurpose)
				}
			} else if contribType == "regular" || contribType == "" {
				if chamaName != "" {
					detailedDesc = fmt.Sprintf("Regular contribution — %s", chamaName)
				}
			}

			tx := map[string]interface{}{
				"id":            id.String,
				"type":          type_.String,
				"status":        status.String,
				"amount":        amount,
				"currency":      currency.String,
				"description":   detailedDesc,
				"reference":     reference.String,
				"paymentMethod": paymentMethod.String,
				"fees":          fees.String,
				"initiatedBy":   initiatedBy.String,
				"recipientId":   recipientID.String,
				"createdAt":     createdAt.Time.Format(time.RFC3339),
				"updatedAt":     updatedAt.Time.Format(time.RFC3339),
				"chamaId":       chamaID.String,
				"metadata":      metadataJSON.String,
				"chamaName":     chamaName,
				"contributionType": contribType,
			}
			contribTxns = append(contribTxns, tx)
		}
	}

	// Merge: convert wallet transactions to maps, then de-duplicate by id
	walletTxns := make([]map[string]interface{}, 0, len(walletTransactions)+len(contribTxns))
	existingIDs := make(map[string]bool, len(walletTransactions)+len(contribTxns))
	for _, tx := range walletTransactions {
		desc := ""
		if tx.Description != nil {
			desc = *tx.Description
		}
		ref := ""
		if tx.Reference != nil {
			ref = *tx.Reference
		}
		fees := tx.Fees

		// Get user information for the transaction initiator
		var userInfo map[string]interface{}
		if tx.InitiatedBy != "" {
			var uID, firstName, lastName, email, phone string
			errRow := db.(*sql.DB).QueryRow(`
				SELECT id, first_name, last_name, email, phone FROM users WHERE id = $1
			`, tx.InitiatedBy).Scan(&uID, &firstName, &lastName, &email, &phone)
			if errRow == nil {
				userInfo = map[string]interface{}{
					"id":        uID,
					"firstName": firstName,
					"lastName":  lastName,
					"fullName":  firstName + " " + lastName,
					"email":     email,
					"phone":     phone,
				}
			}
		}

		m := map[string]interface{}{
			"id":            tx.ID,
			"type":          tx.Type,
			"status":        tx.Status,
			"amount":        tx.Amount,
			"currency":      tx.Currency,
			"description":   desc,
			"reference":     ref,
			"paymentMethod": tx.PaymentMethod,
			"fees":          fees,
			"initiatedBy":   tx.InitiatedBy,
			"recipientId":   utils.DerefString(tx.RecipientID),
			"createdAt":     tx.CreatedAt.Format(time.RFC3339),
			"updatedAt":     tx.UpdatedAt.Format(time.RFC3339),
		}
		if userInfo != nil {
			m["user"] = userInfo
		}
		if tx.Metadata != nil {
			m["metadata"] = tx.Metadata
		}
		walletTxns = append(walletTxns, m)
		existingIDs[tx.ID] = true
	}

	// Append contribution rows that are not already present
	for _, ct := range contribTxns {
		if !existingIDs[ct["id"].(string)] {
			walletTxns = append(walletTxns, ct)
		}
	}

	// Sort combined list by createdAt descending
	sort.Slice(walletTxns, func(i, j int) bool {
		return walletTxns[i]["createdAt"].(string) > walletTxns[j]["createdAt"].(string)
	})

	// Apply pagination after merge/sort
	total := len(walletTxns)
	if offset > 0 && offset < total {
		walletTxns = walletTxns[offset:]
	}
	if limit > 0 && limit < len(walletTxns) {
		walletTxns = walletTxns[:limit]
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    walletTxns,
		"meta": map[string]interface{}{
			"limit":  limit,
			"offset": offset,
			"count":  total,
		},
	})
}

// updateTransactionStatus updates transaction status
func updateTransactionStatus(db *sql.DB, transactionID string, status models.TransactionStatus) error {
	updateQuery := "UPDATE transactions SET status = $1, updated_at = $2 WHERE id = $3"
	result, err := db.Exec(updateQuery, status, utils.NowEAT(), transactionID)
	if err != nil {
		return fmt.Errorf("failed to update transaction status: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("transaction not found: %s", transactionID)
	}

	log.Printf("Successfully updated transaction %s status to %s", transactionID, status)
	return nil
}

// updateTransactionCheckoutRequestID updates transaction with checkout request ID
func updateTransactionCheckoutRequestID(db *sql.DB, transactionID string, checkoutRequestID string) {
	updateQuery := "UPDATE transactions SET checkout_request_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2"
	result, err := db.Exec(updateQuery, checkoutRequestID, transactionID)
	if err != nil {
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err == nil && rowsAffected > 0 {
	} else {
	}
}

