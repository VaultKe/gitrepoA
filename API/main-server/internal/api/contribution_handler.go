package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"vaultke-backend/config"
	"vaultke-backend/internal/models"
	"vaultke-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Contribution handlers
func GetContributions(c *gin.Context) {
	chamaID := c.Query("chamaId")
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

	// Get contributions from transactions table
	rows, err := db.(*sql.DB).Query(`
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

func MakeContribution(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req struct {
		ChamaID        string  `json:"chamaId" binding:"required" validate:"required,uuid"`
		Amount         float64 `json:"amount" binding:"required" validate:"required,amount"`
		Description    string  `json:"description" validate:"max=200,safe_text,no_sql_injection,no_xss"`
		Type           string  `json:"type" validate:"alphanumeric"`                 // "regular", "penalty", "special"
		PaymentMethod  string  `json:"paymentMethod" validate:"alphanumeric,max=50"` // "wallet", "mpesa", "cash""
		MpesaReference string  `json:"mpesaReference,omitempty"`                     // For M-Pesa payments
		Status         string  `json:"status,omitempty"`                             // For pending M-Pesa payments
		IsAnonymous    bool    `json:"isAnonymous,omitempty"`                        // For anonymous contributions in contribution groups
		ContributorID  string  `json:"contributorId,omitempty"`                      // For cash contributions - who actually contributed
		CashType       string  `json:"cashType,omitempty"`                           // Always "cash" for cash contributions
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	if req.Amount <= 0 || req.Amount > 10000000 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Amount must be between 1 and 10,000,000 KES",
		})
		return
	}

	// Validate contribution type
	validTypes := map[string]bool{
		"regular":        true,
		"penalty":        true,
		"special":        true,
		"merry-go-round": true,
		"savings":        true, // Savings contributions to chama savings subwallet
		"":               true, // Allow empty (defaults to regular)
	}
	if !validTypes[req.Type] {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid contribution type. Must be 'regular', 'penalty', 'special', or 'merry-go-round'",
		})
		return
	}

	// Sanitize inputs
	req.ChamaID = sanitizeInput(req.ChamaID)
	req.Description = sanitizeInput(req.Description)
	req.Type = sanitizeInput(req.Type)
	req.PaymentMethod = sanitizeInput(req.PaymentMethod)

	// Get database connection
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	var currentRecipientID string
	var merryGoRoundID string
	var currentRound int
	if req.Type == "merry-go-round" {
		var expectedAmount float64
		err := db.(*sql.DB).QueryRow(`
	        SELECT mgr.id, mgr.amount_per_round, mgr.current_round
	        FROM merry_go_rounds mgr
	        WHERE mgr.chama_id = $1 AND mgr.status = 'active'
	        ORDER BY mgr.created_at DESC
	        LIMIT 1
	    `, req.ChamaID).Scan(&merryGoRoundID, &expectedAmount, &currentRound)

		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusBadRequest, gin.H{
					"success": false,
					"error":   "No active merry-go-round found for this chama. Please ensure you have an active merry-go-round before making contributions.",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to validate merry-go-round contribution amount",
			})
			return
		}

		// Check if the contribution amount matches the expected amount
		if req.Amount != expectedAmount {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   fmt.Sprintf("Invalid merry-go-round contribution amount. Expected: %.2f KES, Received: %.2f KES", expectedAmount, req.Amount),
			})
			return
		}

		// Get the current recipient (the member at the current round position)
		err = db.(*sql.DB).QueryRow(`
			SELECT mgrp.user_id
			FROM merry_go_round_participants mgrp
			WHERE mgrp.merry_go_round_id = $1 AND mgrp.position = $2
		`, merryGoRoundID, currentRound).Scan(&currentRecipientID)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to determine current merry-go-round recipient",
			})
			return
		}

		// PREVENT DUPLICATE CONTRIBUTIONS: Check if user has already contributed to this round
		var hasContributed bool
		contributionCheckerUserID := userID.(string)

		// For pay_for payments, check if the CONTRIBUTOR (not the initiator/payer) has already contributed
		if req.PaymentMethod == "pay_for" && req.ContributorID != "" {
			contributionCheckerUserID = req.ContributorID
		}

		err = db.(*sql.DB).QueryRow(`
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
		`, req.ChamaID, merryGoRoundID, currentRound, contributionCheckerUserID).Scan(&hasContributed)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to check contribution history",
			})
			return
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
			return
		}

		// PAYMENT METHOD RESTRICTIONS: No anonymous  payments for merry-go-round
		if req.IsAnonymous {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Anonymous contributions are not allowed for merry-go-round. All contributions must be traceable to maintain fairness.",
			})
			return
		}
	}

	// Set default payment method if not provided
	if req.PaymentMethod == "" {
		req.PaymentMethod = "wallet"
	}

	// Validate payment method
	validPaymentMethods := map[string]bool{
		"wallet":  true,
		"mpesa":   true,
		"cash":    true,
		"pay_for": true, // Pay for another member (treasurer records contribution on behalf of another member)
	}
	if !validPaymentMethods[req.PaymentMethod] {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid payment method. Must be 'wallet', 'mpesa', 'cash', or 'pay_for'",
		})
		return
	}

	// For cash and pay_for contributions, validate treasurer role and additional fields
	if req.PaymentMethod == "cash" || req.PaymentMethod == "pay_for" {
		// Get database connection
		db, exists := c.Get("db")
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Database connection not available",
			})
			return
		}

		// Check if the current user is a treasurer or chairperson
		var userRole string
		err := db.(*sql.DB).QueryRow(`
			SELECT role FROM chama_members
			WHERE chama_id = $1 AND user_id = $2
		`, req.ChamaID, userID).Scan(&userRole)
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "Unable to verify user role in chama",
			})
			return
		}

		if userRole != "treasurer" && userRole != "chairperson" {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "Only treasurers and chairpersons can use this payment method",
			})
			return
		}

		// Validate required fields for cash/pay_for contributions
		if req.ContributorID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Contributor ID is required for this payment method",
			})
			return
		}

		// Verify that the contributor is a member of the chama
		var contributorExists bool
		err = db.(*sql.DB).QueryRow(`
			SELECT EXISTS(SELECT 1 FROM chama_members WHERE chama_id = $1 AND user_id = $2)
		`, req.ChamaID, req.ContributorID).Scan(&contributorExists)
		if err != nil || !contributorExists {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Contributor is not a member of this chama",
			})
			return
		}
	}

	// Start transaction
	tx, err := db.(*sql.DB).Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start transaction",
		})
		return
	}
	defer tx.Rollback()

	var transactionID string

	// Handle different payment methods
	if req.PaymentMethod == "wallet" || req.PaymentMethod == "pay_for" {
		walletService := services.NewWalletService(db.(*sql.DB))

		// Get or create user's personal wallet
		senderWallet, err := walletService.GetWalletByOwnerAndType(userID.(string), models.WalletTypePersonal)
		if err != nil {
			senderWallet, err = walletService.CreateWallet(userID.(string), models.WalletTypePersonal)
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

		// For savings contributions, send to the savings subwallet
		if req.Type == "savings" {
			recipientWalletID = fmt.Sprintf("wallet-%s-savings", req.ChamaID)
			recipientWallet, err = walletService.GetWalletByID(recipientWalletID)
			if err != nil {
				// Create the savings subwallet if it doesn't exist
				_, createErr := db.(*sql.DB).Exec(
					"INSERT INTO wallets (id, type, owner_id, subwallet_type, chama_id, balance, currency, is_active, is_locked, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) ON CONFLICT (id) DO NOTHING",
					recipientWalletID, "chama", req.ChamaID, "savings", req.ChamaID, 0, "KES", true, false,
				)
				if createErr != nil {
					log.Printf("Failed to ensure savings wallet exists: %v", createErr)
				}
				// Fetch the wallet again
				recipientWallet, err = walletService.GetWalletByID(recipientWalletID)
			}
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error":   "Failed to ensure savings subwallet exists",
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
			Type:          models.TransactionTypeTransfer,
			Amount:        req.Amount,
			Description:   &description,
			PaymentMethod: models.PaymentMethodWalletTransfer,
			Metadata: map[string]interface{}{
				"contributionType":    req.Type,
				"chamaId":             req.ChamaID,
				"savingsContribution": req.Type == "savings",
			},
		}

		// Add merry-go-round specific metadata
		if req.Type == "merry-go-round" {
			transferTx.Metadata["merryGoRoundId"] = merryGoRoundID
			transferTx.Metadata["roundNumber"] = currentRound
			transferTx.Metadata["recipientId"] = currentRecipientID
		}

		processedTx, err := walletService.CreateTransaction(transferTx, userID.(string))
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

		transactionID = processedTx.ID

		// Skip the duplicate transaction insert below for wallet payments
		// Update member contributions and chama stats within the outer transaction
		contributorUserID := userID
		if req.PaymentMethod == "cash" || req.PaymentMethod == "pay_for" {
			contributorUserID = req.ContributorID
		} else {
			contributorUserID = userID
		}

		fmt.Printf("✅ Updating member contributions for user %s in chama %s\n", contributorUserID, req.ChamaID)

		_, err = tx.Exec(`
			UPDATE chama_members
			SET total_contributions = total_contributions + $1,
			    last_contribution = CURRENT_TIMESTAMP
			WHERE chama_id = $2 AND user_id = $3
		`, req.Amount, req.ChamaID, contributorUserID)
		if err != nil {
			fmt.Printf("❌ Error updating member contributions: %v\n", err)
		}

		fmt.Printf("✅ Successfully updated contributions for user %s\n", contributorUserID)

		// Insert into merry_go_round_payments table for merry-go-round contributions
		if req.Type == "merry-go-round" && merryGoRoundID != "" {
			// Get contributor's position in the merry-go-round
			var contributorPosition int
			err = tx.QueryRow(`
				SELECT position FROM merry_go_round_participants
				WHERE merry_go_round_id = $1 AND user_id = $2
			`, merryGoRoundID, contributorUserID).Scan(&contributorPosition)
			if err != nil {
				// If position not found, default to 0
				contributorPosition = 0
			}

			metadataJSON, _ := json.Marshal(map[string]interface{}{
				"contributionType": req.Type,
				"chamaId":          req.ChamaID,
				"merryGoRoundId":   merryGoRoundID,
				"roundNumber":      currentRound,
				"recipientId":      currentRecipientID,
			})

			paymentID := uuid.New().String()
			_, err = tx.Exec(`
				INSERT INTO merry_go_round_payments (
					id, merry_go_round_id, chama_id, payer_user_id, payee_user_id,
					contributor_user_id, amount, round_number, position, payment_method,
					status, transaction_id, description, metadata, created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			`, paymentID, merryGoRoundID, req.ChamaID, userID.(string), currentRecipientID,
				contributorUserID, req.Amount, currentRound, contributorPosition, req.PaymentMethod,
				"completed", transactionID, req.Description, string(metadataJSON))
			if err != nil {
				fmt.Printf("❌ Error inserting into merry_go_round_payments: %v\n", err)
			} else {
				fmt.Printf("✅ Successfully recorded payment in merry_go_round_payments: %s\n", paymentID)
			}
		}

		// Commit the outer transaction
		if err = tx.Commit(); err != nil {
			fmt.Printf("❌ Failed to commit transaction: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to commit transaction: " + err.Error(),
			})
			return
		}

		fmt.Printf("✅ Transaction committed successfully\n")

		// Return success response
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
		return
	} else if req.PaymentMethod == "mpesa" {
		targetWalletID := fmt.Sprintf("wallet-%s", req.ChamaID)
		_, err := db.(*sql.DB).Exec(`
			INSERT INTO wallets (id, owner_id, type, balance, created_at, updated_at)
			VALUES ($1, $2, 'chama', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			ON CONFLICT (id) DO NOTHING
		`, targetWalletID, req.ChamaID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to ensure chama wallet exists",
			})
			return
		}

		userPhone := userID.(string)
		var phone string
		err = db.(*sql.DB).QueryRow("SELECT phone FROM users WHERE id = $1", userID).Scan(&phone)
		if err == nil {
			userPhone = phone
		}

		mpesaPhone := userPhone
		if strings.HasPrefix(mpesaPhone, "0") {
			mpesaPhone = "254" + mpesaPhone[1:]
		} else if strings.HasPrefix(mpesaPhone, "+254") {
			mpesaPhone = mpesaPhone[1:]
		}

		reference := req.MpesaReference
		if reference == "" {
			reference = fmt.Sprintf("CONTRIB-%s-%d", req.ChamaID[:8], time.Now().UnixNano())
		}

		transactionID, err := createPendingMpesaTransaction(db.(*sql.DB), req.Amount, reference, targetWalletID, req.ChamaID, "contribution", "chama", userID.(string))
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
			mgrMetadata := map[string]interface{}{
				"contributionType": req.Type,
				"chamaId":          req.ChamaID,
				"merryGoRoundId":   merryGoRoundID,
				"roundNumber":      currentRound,
				"recipientId":      currentRecipientID,
			}
			mgrMetadataJSON, _ := json.Marshal(mgrMetadata)
			db.(*sql.DB).Exec("UPDATE transactions SET metadata = $1 WHERE id = $2", string(mgrMetadataJSON), transactionID)
		}

		cfg, exists := c.Get("config")
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Configuration not available",
			})
			return
		}

		mpesaService := services.NewMpesaService(db.(*sql.DB), cfg.(*config.Config))
		mpesaReq := &models.MpesaTransaction{
			PhoneNumber:      mpesaPhone,
			Amount:           req.Amount,
			AccountReference: reference,
			TransactionDesc:  req.Description,
		}

		stkResponse, err := mpesaService.InitiateSTKPush(mpesaReq)
		if err != nil {
			log.Printf("STK Push failed for contribution: %v", err)
			updateTransactionStatus(db.(*sql.DB), transactionID, models.TransactionStatusFailed)
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

		updateTransactionCheckoutRequestID(db.(*sql.DB), transactionID, stkResponse.CheckoutRequestID)

		// Insert into merry_go_round_payments table for merry-go-round mpesa contributions
		if req.Type == "merry-go-round" && merryGoRoundID != "" {
			// Get contributor's position in the merry-go-round
			var contributorPosition int
			err = db.(*sql.DB).QueryRow(`
				SELECT position FROM merry_go_round_participants
				WHERE merry_go_round_id = $1 AND user_id = $2
			`, merryGoRoundID, userID).Scan(&contributorPosition)
			if err != nil {
				contributorPosition = 0
			}

			metadataJSON, _ := json.Marshal(map[string]interface{}{
				"contributionType": req.Type,
				"chamaId":          req.ChamaID,
				"merryGoRoundId":   merryGoRoundID,
				"roundNumber":      currentRound,
				"recipientId":      currentRecipientID,
			})

			paymentID := uuid.New().String()
			_, err = db.(*sql.DB).Exec(`
				INSERT INTO merry_go_round_payments (
					id, merry_go_round_id, chama_id, payer_user_id, payee_user_id,
					contributor_user_id, amount, round_number, position, payment_method,
					status, transaction_id, description, metadata, created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			`, paymentID, merryGoRoundID, req.ChamaID, userID.(string), currentRecipientID,
				userID.(string), req.Amount, currentRound, contributorPosition, req.PaymentMethod,
				"pending", transactionID, req.Description, string(metadataJSON))
			if err != nil {
				fmt.Printf("❌ Error inserting into merry_go_round_payments (mpesa): %v\n", err)
			} else {
				fmt.Printf("✅ Successfully recorded payment in merry_go_round_payments (mpesa): %s\n", paymentID)
			}
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
		return
	} else if req.PaymentMethod == "cash" {
		walletService := services.NewWalletService(db.(*sql.DB))

		// Get payer's personal wallet (treasurer/chairperson paying on behalf)
		payerWallet, err := walletService.GetWalletByOwnerAndType(userID.(string), models.WalletTypePersonal)
		if err != nil {
			payerWallet, err = walletService.CreateWallet(userID.(string), models.WalletTypePersonal)
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

		transferTx := &models.TransactionCreation{
			FromWalletID:  &payerWallet.ID,
			ToWalletID:    &recipientWallet.ID,
			Type:          models.TransactionTypeTransfer,
			Amount:        req.Amount,
			Description:   &description,
			PaymentMethod: models.PaymentMethodWalletTransfer,
			Metadata: map[string]interface{}{
				"contributionType":         req.Type,
				"chamaId":                  req.ChamaID,
				"cashContributionOnBehalf": true,
				"payerId":                  userID.(string),
				"beneficiaryId":            req.ContributorID,
			},
		}

		// Add merry-go-round specific metadata for cash contributions to merry-go-round
		if req.Type == "merry-go-round" {
			transferTx.Metadata["merryGoRoundId"] = merryGoRoundID
			transferTx.Metadata["roundNumber"] = currentRound
			transferTx.Metadata["recipientId"] = currentRecipientID
		}

		processedTx, err := walletService.CreateTransaction(transferTx, userID.(string))
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

		transactionID = processedTx.ID

		// Update chama's total_funds
		_, err = db.(*sql.DB).Exec(`
			UPDATE chamas
			SET total_funds = (
				SELECT 		COALESCE(balance, 0)
				FROM wallets
				WHERE owner_id = $1 AND type = 'chama'
			), updated_at = CURRENT_TIMESTAMP
			WHERE id = $2
		`, req.ChamaID, req.ChamaID)
		if err != nil {
			fmt.Printf("Warning: Failed to update chama total_funds for cash: %v\n", err)
		}

		// Update member contributions for the beneficiary
		_, err = db.(*sql.DB).Exec(`
			UPDATE chama_members
			SET total_contributions = total_contributions + $1,
			    last_contribution = CURRENT_TIMESTAMP
			WHERE chama_id = $2 AND user_id = $3
		`, req.Amount, req.ChamaID, req.ContributorID)
		if err != nil {
			fmt.Printf("❌ Error updating member contributions for cash: %v\n", err)
		}

		// Insert into merry_go_round_payments table for merry-go-round cash contributions
		if req.Type == "merry-go-round" && merryGoRoundID != "" {
			// Get contributor's position in the merry-go-round
			var contributorPosition int
			err = tx.QueryRow(`
				SELECT position FROM merry_go_round_participants
				WHERE merry_go_round_id = $1 AND user_id = $2
			`, merryGoRoundID, req.ContributorID).Scan(&contributorPosition)
			if err != nil {
				contributorPosition = 0
			}

			metadataJSON, _ := json.Marshal(map[string]interface{}{
				"contributionType": req.Type,
				"chamaId":          req.ChamaID,
				"merryGoRoundId":   merryGoRoundID,
				"roundNumber":      currentRound,
				"recipientId":      currentRecipientID,
			})

			paymentID := uuid.New().String()
			_, err = tx.Exec(`
				INSERT INTO merry_go_round_payments (
					id, merry_go_round_id, chama_id, payer_user_id, payee_user_id,
					contributor_user_id, amount, round_number, position, payment_method,
					status, transaction_id, description, metadata, created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			`, paymentID, merryGoRoundID, req.ChamaID, userID.(string), currentRecipientID,
				req.ContributorID, req.Amount, currentRound, contributorPosition, req.PaymentMethod,
				"completed", transactionID, req.Description, string(metadataJSON))
			if err != nil {
				fmt.Printf("❌ Error inserting into merry_go_round_payments (cash): %v\n", err)
			} else {
				fmt.Printf("✅ Successfully recorded payment in merry_go_round_payments (cash): %s\n", paymentID)
			}
		}

		// Commit the outer transaction
		if err = tx.Commit(); err != nil {
			fmt.Printf("❌ Failed to commit transaction: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to commit transaction: " + err.Error(),
			})
			return
		}

		// Return success response
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
		return
	}

	// Update chama's total_funds field when wallet payment succeeds
	if req.PaymentMethod == "wallet" {
		_, err = db.(*sql.DB).Exec(`
			UPDATE chamas
			SET total_funds = (
				SELECT COALESCE(balance, 0)
				FROM wallets
				WHERE owner_id = $1 AND type = 'chama'
			), updated_at = CURRENT_TIMESTAMP
			WHERE id = $2
		`, req.ChamaID, req.ChamaID)
		if err != nil {
			fmt.Printf("Warning: Failed to update chama total_funds: %v\n", err)
		}
	}

	// Prepare transaction record
	if req.PaymentMethod != "wallet" {
		transactionID = fmt.Sprintf("txn-%d", time.Now().UnixNano())
	}
	contributionType := req.Type
	if contributionType == "" {
		contributionType = "regular"
	}

	// Set transaction status based on payment method
	transactionStatus := "completed"
	if req.PaymentMethod == "mpesa" {
		transactionStatus = "pending" // M-Pesa payments start as pending
	}

	// Create metadata to store contribution details
	metadata := make(map[string]interface{})
	metadata["contributionType"] = contributionType
	metadata["chamaId"] = req.ChamaID

	// Add merry-go-round specific metadata for better tracking
	if req.Type == "merry-go-round" && merryGoRoundID != "" {
		metadata["merryGoRoundId"] = merryGoRoundID
		metadata["roundNumber"] = currentRound
		metadata["recipientId"] = currentRecipientID
	}

	if req.IsAnonymous {
		metadata["isAnonymous"] = true
		metadata["displayName"] = "Anonymous"
	}

	if req.PaymentMethod == "cash" {
		metadata["contributorId"] = req.ContributorID
		metadata["cashType"] = req.CashType
		metadata["recordedBy"] = userID // The treasurer who recorded this
	}

	metadataJSON, _ := json.Marshal(metadata)
	transactionInitiator := userID
	if req.PaymentMethod == "cash" {
		transactionInitiator = req.ContributorID
	}
	transactionRecipient := req.ChamaID
	if req.Type == "merry-go-round" && currentRecipientID != "" {
		transactionRecipient = currentRecipientID
	}

	// Prepare transaction insert query with optional M-Pesa reference and anonymous support
	var insertQuery string
	var insertArgs []interface{}

	// Note: Wallet balance updates are handled above, transaction record is for audit purposes

	if req.PaymentMethod == "mpesa" && req.MpesaReference != "" {
		insertQuery = `
			INSERT INTO transactions (
				id, type, amount, currency, description, status, payment_method,
				chama_id, reference, initiated_by, recipient_id, metadata, created_at, updated_at
			) VALUES ($1, 'contribution', $2, 'KES', $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`
		insertArgs = []interface{}{transactionID, req.Amount, req.Description, transactionStatus, req.PaymentMethod, req.ChamaID, req.MpesaReference, transactionInitiator, transactionRecipient, string(metadataJSON)}
	} else {
		insertQuery = `
			INSERT INTO transactions (
				id, type, amount, currency, description, status, payment_method,
				chama_id, initiated_by, recipient_id, metadata, created_at, updated_at
			) VALUES ($1, 'contribution', $2, 'KES', $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`
		insertArgs = []interface{}{transactionID, req.Amount, req.Description, transactionStatus, req.PaymentMethod, req.ChamaID, transactionInitiator, transactionRecipient, string(metadataJSON)}
	}

	_, err = tx.Exec(insertQuery, insertArgs...)
	if err != nil {
		fmt.Printf("❌ Transaction insert failed: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to record transaction: " + err.Error(),
		})
		return
	}

	fmt.Printf("✅ Transaction recorded successfully: %s\n", transactionID)

	// Update member's total contributions only for completed transactions
	if transactionStatus == "completed" {
		// For other methods, update the current user's record
		contributorUserID := userID
		if req.PaymentMethod == "cash" {
			contributorUserID = req.ContributorID
		}

		fmt.Printf("✅ Updating member contributions for user %s in chama %s\n", contributorUserID, req.ChamaID)

		_, err = tx.Exec(`
			UPDATE chama_members
			SET total_contributions = total_contributions + $1,
			    last_contribution = CURRENT_TIMESTAMP
			WHERE chama_id = $2 AND user_id = $3
		`, req.Amount, req.ChamaID, contributorUserID)
		if err != nil {
			fmt.Printf("❌ Error updating member contributions: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to update member contributions",
			})
			return
		}

		fmt.Printf("✅ Successfully updated contributions for user %s\n", contributorUserID)
	}

	// Log final wallet balances before committing
	if req.PaymentMethod == "wallet" {
		var finalUserBalance, finalChamaBalance float64
		tx.QueryRow("SELECT COALESCE(balance, 0) FROM wallets WHERE owner_id = $1 AND type = 'personal'", userID).Scan(&finalUserBalance)
		tx.QueryRow("SELECT COALESCE(balance, 0) FROM wallets WHERE owner_id = $2 AND type = 'chama'", req.ChamaID).Scan(&finalChamaBalance)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		fmt.Printf("❌ Failed to commit transaction: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to commit transaction: " + err.Error(),
		})
		return
	}

	fmt.Printf("✅ Transaction committed successfully\n")

	// For merry-go-round contributions, automatically check and advance the round
	if req.Type == "merry-go-round" && transactionStatus == "completed" {

		// Get the merry-go-round ID for this chama
		var merryGoRoundID string
		err = db.(*sql.DB).QueryRow(`
			SELECT id FROM merry_go_rounds
			WHERE chama_id = $1 AND status = 'active'
			ORDER BY created_at DESC LIMIT 1
		`, req.ChamaID).Scan(&merryGoRoundID)

		if err == nil && merryGoRoundID != "" {

			// Call the round advancement logic directly with proper type assertions
			err = checkAndAdvanceMerryGoRound(db.(*sql.DB), merryGoRoundID, req.ChamaID, userID.(string))
			if err != nil {
				fmt.Printf("⚠️ Round advancement check failed: %v\n", err)
			} else {
			}
		} else {
			fmt.Printf("⚠️ No active merry-go-round found for chama %s\n", req.ChamaID)
		}
	}

	// Return success response with appropriate message
	var message string
	if req.PaymentMethod == "mpesa" {
		message = "M-Pesa contribution initiated successfully"
	} else if req.PaymentMethod == "cash" {
		message = "Cash contribution recorded successfully"
	} else {
		message = "Contribution made successfully"
	}

	responseData := map[string]interface{}{
		"id":            transactionID,
		"chamaId":       req.ChamaID,
		"amount":        req.Amount,
		"type":          contributionType,
		"description":   req.Description,
		"paymentMethod": req.PaymentMethod,
		"status":        transactionStatus,
		"contributedBy": transactionInitiator,
		"recipientId":   transactionRecipient,
		"createdAt":     time.Now().Format(time.RFC3339),
	}

	// Add cash specific fields to response
	if req.PaymentMethod == "cash" {
		responseData["contributorId"] = req.ContributorID
		responseData["cashType"] = req.CashType
		responseData["recordedBy"] = userID
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": message,
		"data":    responseData,
	})
}

// GetChamaMembersForContributions returns list of chama members for cash contribution selection
func GetChamaMembersForContributions(c *gin.Context) {
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

	// Check if the current user is a treasurer of this chama
	var userRole string
	err := db.(*sql.DB).QueryRow(`
		SELECT role FROM chama_members
		WHERE chama_id = $1 AND user_id = $2
	`, chamaID, userID).Scan(&userRole)
	if err != nil {
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

	// Get all members of the chama
	rows, err := db.(*sql.DB).Query(`
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

		err := rows.Scan(&userID, &firstName, &lastName, &email, &phone, &avatar, &role, &totalContributions)
		if err != nil {
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

		// Add avatar if it exists
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

// GetMerryGoRoundContributionAmount returns the expected contribution amount for merry-go-round
func GetMerryGoRoundContributionAmount(c *gin.Context) {
	// Get user ID from context (set by auth middleware) - not needed for this endpoint
	_, exists := c.Get("userID")
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

	// Get the expected merry-go-round contribution amount
	var expectedAmount float64
	var mgrName string
	err := db.(*sql.DB).QueryRow(`
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

func GetContribution(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Get contribution endpoint - coming soon",
	})
}
