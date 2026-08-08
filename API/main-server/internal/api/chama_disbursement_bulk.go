package api

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// CreateBulkDisbursement creates a bulk disbursement (welfare bulk, dividends, etc.).
// For welfare/mgr categories it sends funds directly to members' MPesa numbers via B2C;
// for dividends it only creates records (handled separately).
func CreateBulkDisbursement(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	chamaID, ok := requireParam(c, "id", "Chama ID is required")
	if !ok {
		return
	}

	var req struct {
		Type             string                   `json:"type" binding:"required"`
		Category         string                   `json:"category" binding:"required"`
		DividendPerShare float64                  `json:"dividendPerShare"`
		TotalAmount      float64                  `json:"totalAmount" binding:"required"`
		Description      string                   `json:"description"`
		EligibleMembers  []map[string]interface{} `json:"eligibleMembers" binding:"required"`
		FromAccount      string                   `json:"fromAccount" binding:"required"`
		InitiatedBy      string                   `json:"initiatedBy" binding:"required"`
		InitiatedByID    string                   `json:"initiatedById" binding:"required"`
		Timestamp        string                   `json:"timestamp"`
		Status           string                   `json:"status" binding:"required"`
		TransactionID    string                   `json:"transactionId" binding:"required"`
		SecurityHash     string                   `json:"securityHash" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	database := dbFromContext(c)
	if database == nil {
		return
	}

	var timestamp time.Time
	if req.Timestamp != "" {
		if parsedTime, err := time.Parse(time.RFC3339, req.Timestamp); err != nil {
			timestamp = time.Now()
		} else {
			timestamp = parsedTime
		}
	} else {
		timestamp = time.Now()
	}

	now := time.Now()

	tx, err := database.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start transaction",
		})
		return
	}
	defer tx.Rollback()

	bulkID := fmt.Sprintf("BULK_%d", now.UnixNano())
	bulkStatus := req.Status
	if req.Category == "welfare" || req.Category == "merry_go_round" {
		bulkStatus = "pending"
	}

	bulkQuery := `
		INSERT INTO bulk_disbursements (
			id, chama_id, type, category, dividend_per_share, total_amount, description,
			from_account, initiated_by, initiated_by_id, timestamp, status,
			transaction_id, security_hash, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`

	if _, err = tx.Exec(
		bulkQuery,
		bulkID, chamaID, req.Type, req.Category, req.DividendPerShare, req.TotalAmount,
		req.Description, req.FromAccount, req.InitiatedBy, req.InitiatedByID,
		timestamp, bulkStatus, req.TransactionID, req.SecurityHash, now, now,
	); err != nil {
		log.Printf("Failed to create bulk disbursement: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create bulk disbursement: " + err.Error(),
		})
		return
	}

	isWelfareOrMGR := req.Category == "welfare" || req.Category == "merry_go_round"

	var successfulDisbursements int
	var failedDisbursements int
	var batchID string

	if isWelfareOrMGR {
		sourceWalletID, err := getDisbursementSourceWalletID(database, chamaID, req.Category)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Invalid source wallet: " + err.Error(),
			})
			return
		}

		batchID = fmt.Sprintf("BATCH_%d", now.UnixNano())
		batchTitle := strings.Title(strings.ReplaceAll(req.Category, "_", " ")) + " bulk disbursement"
		if _, err = tx.Exec(`
			INSERT INTO disbursement_batches (
				id, chama_id, batch_type, title, description, total_amount,
				total_recipients, initiated_by, status, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10)
		`, batchID, chamaID, req.Category, batchTitle, req.Description, req.TotalAmount, len(req.EligibleMembers), userID, now, now); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create disbursement batch: " + err.Error(),
			})
			return
		}

		for _, member := range req.EligibleMembers {
			memberID, ok := member["id"].(string)
			if !ok {
				failedDisbursements++
				continue
			}
			memberName, _ := member["name"].(string)
			var memberAmount float64
			if amt, ok := member["amount"].(float64); ok {
				memberAmount = amt
			} else {
				failedDisbursements++
				continue
			}

			var memberPhone string
			if err = tx.QueryRow("SELECT phone FROM users WHERE id = $1", memberID).Scan(&memberPhone); err != nil {
				log.Printf("Skipping member %s - phone not found: %v", memberID, err)
				failedDisbursements++
				continue
			}

			phoneNumber, err := normalizePhoneNumber(memberPhone)
			if err != nil {
				log.Printf("Skipping member %s - invalid phone format: %s", memberID, memberPhone)
				failedDisbursements++
				continue
			}

			transactionID := fmt.Sprintf("TXN_%d", now.UnixNano())
			description := "Bulk " + req.Category + " disbursement"

			if _, err = tx.Exec(`
				INSERT INTO transactions (
					id, from_wallet_id, chama_id, recipient_id, member_id, type, status, amount,
					currency, description, reference, payment_method, initiated_by, created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, 'KES', $8, $9, 'mobile_money', $10, $11, $12)
			`, transactionID, sourceWalletID, chamaID, memberID, memberID, req.Type, memberAmount, description, fmt.Sprintf("PENDING-%s-%s", batchID, memberID), userID, now, now); err != nil {
				log.Printf("Failed to create transaction for member %s: %v", memberID, err)
				failedDisbursements++
				continue
			}

			disburseID := fmt.Sprintf("DISB_%d", now.UnixNano())
			if _, err = tx.Exec(`
				INSERT INTO disbursements (
					id, batch_id, chama_id, type, category, recipient_id,
					member_id, member_name, amount, purpose, private_note,
					from_account, to_account, initiated_by, initiated_by_id,
					timestamp, status, transaction_id, security_hash,
					created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
					$11, $12, $13, $14, $15, 'pending', $16, $17, $18, $19, $20)
			`, disburseID, batchID, chamaID, req.Type, req.Category, memberID,
				memberID, memberName, memberAmount, req.Description, "",
				sourceWalletID, fmt.Sprintf("mpesa-%s", phoneNumber), req.InitiatedBy, req.InitiatedByID,
				timestamp, transactionID, req.SecurityHash, now, now); err != nil {
				log.Printf("Failed to create disbursement record for member %s: %v", memberID, err)
			}

			successfulDisbursements++
		}
	} else {
		// For dividends - just create dividend records
		dividendQuery := `
			INSERT INTO dividends (
				id, bulk_disbursement_id, chama_id, member_id, member_name, shares_owned,
				dividend_per_share, amount, status, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		`

		for _, member := range req.EligibleMembers {
			memberID, ok := member["id"].(string)
			if !ok {
				continue
			}
			memberName, _ := member["name"].(string)
			sharesOwned, _ := member["sharesOwned"].(float64)

			// Calculate amount from shares if not provided
			var memberAmount float64
			if amt, ok := member["amount"].(float64); ok {
				memberAmount = amt
			} else {
				memberAmount = sharesOwned * req.DividendPerShare
			}

			dividendID := fmt.Sprintf("DIV_%d_%s", now.UnixNano(), memberID)

			if _, err = tx.Exec(
				dividendQuery,
				dividendID, bulkID, chamaID, memberID, memberName, int(sharesOwned),
				req.DividendPerShare, memberAmount, "pending", now, now,
			); err != nil {
				log.Printf("Failed to create dividend record for member %s: %v", memberID, err)
				continue
			}
			successfulDisbursements++
		}
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to commit transaction",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Bulk disbursement processed successfully",
		"data": gin.H{
			"id":                      bulkID,
			"successfulDisbursements": successfulDisbursements,
			"failedDisbursements":     failedDisbursements,
			"totalAmount":             req.TotalAmount,
			"batchStatus":             bulkStatus,
		},
	})
}

// DisburseMerryGoRoundCyclesBulk handles bulk MGR disbursement that sends funds
// directly to each recipient's MPesa number via B2C.
func DisburseMerryGoRoundCyclesBulk(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	chamaID, ok := requireParam(c, "id", "Chama ID is required")
	if !ok {
		return
	}

	var req struct {
		Disbursements []struct {
			CycleId       string  `json:"cycleId"`
			RecipientId   string  `json:"recipientId" binding:"required"`
			RecipientName string  `json:"recipientName" binding:"required"`
			CycleNumber   int     `json:"cycleNumber"`
			Amount        float64 `json:"amount" binding:"required"`
		} `json:"disbursements" binding:"required"`
		Description   string `json:"description" binding:"required"`
		DisbursedBy   string `json:"disbursedBy" binding:"required"`
		DisbursedById string `json:"disbursedById" binding:"required"`
		Timestamp     string `json:"timestamp"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	database := dbFromContext(c)
	if database == nil {
		return
	}

	now := time.Now()
	var successfulDisbursements int
	var failedDisbursements int

	batchID := fmt.Sprintf("BATCH_%d", now.UnixNano())
	batchTitle := "Merry go round bulk disbursement"

	sourceWalletID, err := getDisbursementSourceWalletID(database, chamaID, "merry_go_round")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid source wallet: " + err.Error(),
		})
		return
	}

	if _, err = database.Exec(`
		INSERT INTO disbursement_batches (
			id, chama_id, batch_type, title, description, total_amount,
			total_recipients, initiated_by, status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10)
	`, batchID, chamaID, "merry_go_round", batchTitle, req.Description, 0.0, len(req.Disbursements), userID, now, now); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create disbursement batch: " + err.Error(),
		})
		return
	}

	var totalAmount float64
	for _, disb := range req.Disbursements {
		var recipientPhone string
		if err := database.QueryRow("SELECT phone FROM users WHERE id = $1", disb.RecipientId).Scan(&recipientPhone); err != nil {
			log.Printf("Skipping MGR disbursement for member %s - phone not found: %v", disb.RecipientId, err)
			failedDisbursements++
			continue
		}

		phoneNumber, err := normalizePhoneNumber(recipientPhone)
		if err != nil {
			log.Printf("Skipping MGR disbursement for member %s - invalid phone format: %s", disb.RecipientId, recipientPhone)
			failedDisbursements++
			continue
		}

		transactionID := fmt.Sprintf("TXN_%d", now.UnixNano())
		if _, err = database.Exec(`
			INSERT INTO transactions (
				id, from_wallet_id, chama_id, recipient_id, member_id, type, status, amount,
				currency, description, reference, payment_method, initiated_by, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, 'mgr_disbursement', 'pending', $6, 'KES', $7, $8, 'mobile_money', $9, $10, $11)
		`, transactionID, sourceWalletID, chamaID, disb.RecipientId, disb.RecipientId, disb.Amount, req.Description, fmt.Sprintf("PENDING-%s-%s", batchID, disb.RecipientId), req.DisbursedBy, now, now); err != nil {
			log.Printf("Failed to create transaction for MGR disbursement: %v", err)
			failedDisbursements++
			continue
		}

		disburseID := fmt.Sprintf("DISB_%d", now.UnixNano())
		if _, err = database.Exec(`
			INSERT INTO disbursements (
				id, batch_id, chama_id, type, category, member_id, member_name, amount, purpose,
				from_account, to_account, initiated_by, initiated_by_id, timestamp, status, transaction_id, security_hash,
				created_at, updated_at
			) VALUES ($1, $2, $3, 'merry_go_round', 'merry_go_round', $4, $5, $6, $7,
				$8, $9, $10, $11, $12, 'pending', $13, $14, $15, $16)
		`, disburseID, batchID, chamaID, disb.RecipientId, disb.RecipientName, disb.Amount, req.Description,
			sourceWalletID, fmt.Sprintf("mpesa-%s", phoneNumber), req.DisbursedBy, req.DisbursedById,
			now, transactionID, "", now, now); err != nil {
			log.Printf("Failed to create disbursement record: %v", err)
		}

		totalAmount += disb.Amount
		successfulDisbursements++
	}

	if _, err = database.Exec(
		"UPDATE disbursement_batches SET total_amount = $1 WHERE id = $2",
		totalAmount, batchID,
	); err != nil {
		log.Printf("Failed to update batch total amount: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Bulk MGR disbursement created and pending approval",
		"data": gin.H{
			"batchId":                 batchID,
			"successfulDisbursements": successfulDisbursements,
			"failedDisbursements":     failedDisbursements,
			"totalAmount":             totalAmount,
		},
	})
		c.Abort()
}
