package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
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

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    []interface{}{},
		"message": "No contributions found",
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
		`, req.ChamaID, merryGoRoundID, currentRound, userID).Scan(&hasContributed)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to check contribution history",
			})
			return
		}

		if hasContributed {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "You have already contributed to this merry-go-round round. Each member can only contribute once per round.",
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
		"wallet": true,
		"mpesa":  true,
		"cash":   true,
	}
	if !validPaymentMethods[req.PaymentMethod] {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid payment method. Must be 'wallet', 'mpesa', 'cash'",
		})
		return
	}

	// For cash contributions, validate treasurer role and additional fields
	if req.PaymentMethod == "cash" {
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
				"error":   "Only treasurers and chairpersons can record cash contributions",
			})
			return
		}

		// Validate required fields for cash contributions
		if req.ContributorID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Contributor ID is required for cash contributions",
			})
			return
		}

		// Set cash type based on payment method
		if req.CashType == "" {
			req.CashType = req.PaymentMethod // "cash""
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

	// Handle different payment methods
	if req.PaymentMethod == "wallet" {
		// Check if user has sufficient balance in personal wallet
		var personalBalance float64
		err = tx.QueryRow(`
			SELECT COALESCE(balance, 0)
			FROM wallets
			WHERE owner_id = $1 AND type = 'personal'
		`, userID).Scan(&personalBalance)
		if err != nil {
			if err == sql.ErrNoRows {
				// User doesn't have a personal wallet, create one with 0 balance
				fmt.Printf("⚠️ User %s doesn't have a personal wallet, creating one\n", userID)
				_, err = tx.Exec(`
					INSERT INTO wallets (id, owner_id, type, balance, created_at, updated_at)
					VALUES ($1, $2, 'personal', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
				`, "wallet-"+userID.(string), userID)
				if err != nil {
					fmt.Printf("❌ Error creating wallet for user %s: %v\n", userID, err)
					c.JSON(http.StatusInternalServerError, gin.H{
						"success": false,
						"error":   "Failed to create user wallet",
					})
					return
				}
				personalBalance = 0
			} else {
				fmt.Printf("❌ Error checking wallet balance for user %s: %v\n", userID, err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error":   "Failed to check wallet balance",
				})
				return
			}
		}


		if personalBalance < req.Amount {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Insufficient balance in personal wallet",
			})
			return
		}

		// Deduct from personal wallet
		result, err := tx.Exec(`
			UPDATE wallets
			SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP
			WHERE owner_id = $2 AND type = 'personal'
		`, req.Amount, userID)
		if err != nil {
			fmt.Printf("❌ Error deducting from wallet for user %s: %v\n", userID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to deduct from personal wallet",
			})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		fmt.Printf("✅ Wallet deduction: %d rows affected for user %s\n", rowsAffected, userID)
	} else if req.PaymentMethod == "mpesa" {
		// For M-Pesa payments, we don't deduct from wallet
		// The M-Pesa callback will handle the actual payment processing
		// This is just creating a contribution record
		fmt.Printf("Creating M-Pesa contribution record with reference: %s\n", req.MpesaReference)
	} else if req.PaymentMethod == "cash" {
	}

	// Add to chama wallet
	result, err := tx.Exec(`
		UPDATE wallets
		SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP
		WHERE owner_id = $2 AND type = 'chama'
	`, req.Amount, req.ChamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update chama wallet: " + err.Error(),
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		// If chama wallet doesn't exist, create it
		_, err = tx.Exec(`
			INSERT INTO wallets (id, owner_id, type, balance, created_at, updated_at)
			VALUES ($1, $2, 'chama', $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`, "wallet-"+req.ChamaID, req.ChamaID, req.Amount)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create chama wallet: " + err.Error(),
			})
			return
		}
	} else {
	}

	// Update chama's total_funds field to match wallet balance
	_, err = tx.Exec(`
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
		// Don't fail the transaction for this, just log the warning
	}

	// Record the transaction
	transactionID := fmt.Sprintf("txn-%d", time.Now().UnixNano())
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
