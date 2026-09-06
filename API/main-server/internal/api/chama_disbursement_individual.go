package api

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"vaultke-backend/internal/utils"

	"github.com/gin-gonic/gin"
)

// CreateIndividualDisbursement creates an individual disbursement (welfare)
// that sends funds directly to a member's MPesa number via B2C.
func CreateIndividualDisbursement(c *gin.Context) {
	chamaID, ok := requireParam(c, "id", "Chama ID is required")
	if !ok {
		return
	}

	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	var req struct {
		Type          string  `json:"type" binding:"required"`
		Category      string  `json:"category" binding:"required"`
		MemberID      string  `json:"memberId" binding:"required"`
		MemberName    string  `json:"memberName" binding:"required"`
		Amount        float64 `json:"amount" binding:"required"`
		Purpose       string  `json:"purpose" binding:"required"`
		PrivateNote   string  `json:"privateNote"`
		FromAccount   string  `json:"fromAccount" binding:"required"`
		ToAccount     string  `json:"toAccount" binding:"required"`
		RecipientID   string  `json:"recipientId" binding:"required"`
		InitiatedBy   string  `json:"initiatedBy" binding:"required"`
		InitiatedByID string  `json:"initiatedById" binding:"required"`
		Timestamp     string  `json:"timestamp" binding:"required"`
		Status        string  `json:"status" binding:"required"`
		TransactionID string  `json:"transactionId" binding:"required"`
		SecurityHash  string  `json:"securityHash" binding:"required"`
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

	if _, err := requireActiveChamaOfficer(database, chamaID, userID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	if req.Category != "welfare" && req.Category != "merry_go_round" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Unsupported disbursement category for approval gating",
		})
		return
	}

	// Idempotency: a retried request carrying a transaction id we have already
	// recorded must not create a second disbursement.
	if exists, err := transactionExists(database, req.TransactionID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to check transaction: " + err.Error()})
		return
	} else if exists {
		c.JSON(http.StatusConflict, gin.H{
			"success": false,
			"error":   "This disbursement has already been submitted",
		})
		return
	}

	sourceWalletID, err := getDisbursementSourceWalletID(database, chamaID, req.Category)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid source wallet: " + err.Error(),
		})
		return
	}

	if err := validateDisbursementAmount(database, sourceWalletID, req.Amount); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	var recipientPhone string
	if err := database.QueryRow("SELECT phone FROM users WHERE id = $1", req.RecipientID).Scan(&recipientPhone); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Recipient not found or phone number not available",
		})
		return
	}

	phoneNumber, err := normalizePhoneNumber(recipientPhone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	now := time.Now()
	transactionID := req.TransactionID
	if transactionID == "" {
		transactionID = fmt.Sprintf("TXN_%d", now.UnixNano())
	}

	var timestamp time.Time
	if req.Timestamp != "" {
		timestamp, err = time.Parse(time.RFC3339, req.Timestamp)
		if err != nil {
			timestamp = now
		}
	} else {
		timestamp = now
	}

	tx, err := database.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start transaction: " + err.Error(),
		})
		return
	}
	defer tx.Rollback()

	batchID := fmt.Sprintf("BATCH_%d", now.UnixNano())
	batchTitle := strings.Title(strings.ReplaceAll(req.Category, "_", " ")) + " disbursement"
	if _, err = tx.Exec(`
		INSERT INTO disbursement_batches (
			id, chama_id, batch_type, title, description, total_amount,
			total_recipients, initiated_by, status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10)
	`, batchID, chamaID, req.Category, batchTitle, req.Purpose, req.Amount, 1, userID, now, now); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create disbursement batch: " + err.Error(),
		})
		return
	}

	if _, err = tx.Exec(`
		INSERT INTO transactions (
			id, from_wallet_id, chama_id, recipient_id, member_id, type,
			status, amount, currency, description, reference, payment_method,
			initiated_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, 'KES', $8, $9, 'mobile_money', $10, $11, $12)
	`, transactionID, sourceWalletID, chamaID, req.RecipientID, req.MemberID, req.Type, req.Amount, req.Purpose, fmt.Sprintf("PENDING-%s-%s", batchID, req.RecipientID), userID, now, now); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create transaction record: " + err.Error(),
		})
		return
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
			$11, $12, $13, $14, $15, $16, 'pending', $17, $18, $19, $20)
	`, disburseID, batchID, chamaID, req.Type, req.Category, req.RecipientID,
		req.MemberID, req.MemberName, req.Amount, req.Purpose, req.PrivateNote,
		sourceWalletID, fmt.Sprintf("mpesa-%s", phoneNumber), req.InitiatedBy, req.InitiatedByID,
		timestamp, transactionID, req.SecurityHash, now, now); err != nil {
		log.Printf("Failed to create disbursement record: %v", err)
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to commit transaction: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Individual disbursement created and pending approval",
		"data": gin.H{
			"batchId":        batchID,
			"disbursementId": disburseID,
			"recipientId":    req.RecipientID,
			"recipientPhone": utils.MaskPhone(phoneNumber),
			"amount":         req.Amount,
			"transactionId":  transactionID,
		},
	})
	c.Abort()
}

// DisburseMerryGoRoundCycle handles an individual MGR disbursement that sends
// funds directly to the recipient's MPesa number via B2C.
func DisburseMerryGoRoundCycle(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	chamaID, ok := requireParam(c, "id", "Chama ID and Cycle ID are required")
	if !ok {
		return
	}
	cycleID, ok := requireParam(c, "cycleId", "Chama ID and Cycle ID are required")
	if !ok {
		return
	}
	_ = cycleID

	var req struct {
		CycleId       string  `json:"cycleId" binding:"required"`
		RecipientId   string  `json:"recipientId" binding:"required"`
		RecipientName string  `json:"recipientName" binding:"required"`
		CycleNumber   int     `json:"cycleNumber"`
		Amount        float64 `json:"amount" binding:"required"`
		Description   string  `json:"description" binding:"required"`
		PrivateNote   string  `json:"privateNote"`
		DisbursedBy   string  `json:"disbursedBy" binding:"required"`
		DisbursedById string  `json:"disbursedById" binding:"required"`
		Timestamp     string  `json:"timestamp"`
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

	if _, err := requireActiveChamaOfficer(database, chamaID, userID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": err.Error()})
		return
	}

	var recipientPhone string
	if err := database.QueryRow("SELECT phone FROM users WHERE id = $1", req.RecipientId).Scan(&recipientPhone); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Recipient not found or phone number not available",
		})
		return
	}

	phoneNumber, err := normalizePhoneNumber(recipientPhone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	sourceWalletID, err := getDisbursementSourceWalletID(database, chamaID, "merry_go_round")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid source wallet: " + err.Error(),
		})
		return
	}

	if err := validateDisbursementAmount(database, sourceWalletID, req.Amount); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	now := time.Now()
	// Deterministic id keyed on (round, cycle, recipient): the transactions PK
	// then guarantees at most one payout per recipient per cycle even under
	// duplicate or concurrent requests.
	transactionID := fmt.Sprintf("MGRDISB_%s_%d_%s", req.CycleId, req.CycleNumber, req.RecipientId)
	if exists, err := transactionExists(database, transactionID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to check transaction: " + err.Error()})
		return
	} else if exists {
		c.JSON(http.StatusConflict, gin.H{
			"success": false,
			"error":   "This recipient has already been disbursed for this merry-go-round cycle",
		})
		return
	}

	var participantRows int
	_ = database.QueryRow("SELECT COUNT(*) FROM merry_go_round_participants WHERE merry_go_round_id = $1", req.CycleId).Scan(&participantRows)

	tx, err := database.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start transaction",
		})
		return
	}
	defer tx.Rollback()

	// If this round tracks participants, mark the recipient as paid inside the
	// transaction and reject anyone who is not an unpaid participant of the round
	// ("only the person who was to get it").
	if participantRows > 0 {
		res, uerr := tx.Exec(`
			UPDATE merry_go_round_participants
			SET has_received = true, received_at = $1
			WHERE merry_go_round_id = $2 AND user_id = $3 AND COALESCE(has_received, false) = false
		`, now, req.CycleId, req.RecipientId)
		if uerr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to reserve payout: " + uerr.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n != 1 {
			c.JSON(http.StatusConflict, gin.H{
				"success": false,
				"error":   "Recipient is not a pending participant in this round, or has already received their payout",
			})
			return
		}
	}

	batchID := fmt.Sprintf("BATCH_%d", now.UnixNano())
	batchTitle := "Merry go round disbursement"
	if _, err = tx.Exec(`
		INSERT INTO disbursement_batches (
			id, chama_id, batch_type, title, description, total_amount,
			total_recipients, initiated_by, status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10)
	`, batchID, chamaID, "merry_go_round", batchTitle, req.Description, req.Amount, 1, userID, now, now); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create disbursement batch: " + err.Error(),
		})
		return
	}

	if _, err = tx.Exec(`
		INSERT INTO transactions (
			id, from_wallet_id, chama_id, recipient_id, member_id, type, status, amount,
			currency, description, reference, payment_method, initiated_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, 'mgr_disbursement', 'pending', $6, 'KES', $7, $8, 'mobile_money', $9, $10, $11)
	`, transactionID, sourceWalletID, chamaID, req.RecipientId, req.RecipientId, req.Amount, req.Description, fmt.Sprintf("PENDING-%s-%s", batchID, req.RecipientId), req.DisbursedBy, now, now); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create transaction record: " + err.Error(),
		})
		return
	}

	disburseID := fmt.Sprintf("DISB_%d", now.UnixNano())
	if _, err = tx.Exec(`
		INSERT INTO disbursements (
			id, batch_id, chama_id, type, category, member_id, member_name, amount, purpose,
			from_account, to_account, initiated_by, initiated_by_id, timestamp, status, transaction_id, security_hash,
			created_at, updated_at
		) VALUES ($1, $2, $3, 'merry_go_round', 'merry_go_round', $4, $5, $6, $7,
			$8, $9, $10, $11, $12, 'pending', $13, $14, $15, $16)
	`, disburseID, batchID, chamaID, req.RecipientId, req.RecipientName, req.Amount, req.Description,
		sourceWalletID, fmt.Sprintf("mpesa-%s", phoneNumber), req.DisbursedBy, req.DisbursedById,
		now, transactionID, "", now, now); err != nil {
		log.Printf("Failed to create disbursement record: %v", err)
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to commit transaction: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "MGR disbursement created and pending approval",
		"data": gin.H{
			"batchId":        batchID,
			"disbursementId": disburseID,
			"recipientId":    req.RecipientId,
			"recipientPhone": utils.MaskPhone(phoneNumber),
			"amount":         req.Amount,
			"transactionId":  transactionID,
		},
	})
	c.Abort()
}
