package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"vaultke-backend/internal/services"
	"vaultke-backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Two-signature merry-go-round payout:
//
//  1. The treasurer calls .../initiate. The server resolves the current
//     recipient, computes the amount ACTUALLY collected for the round so far
//     (never the theoretical full pot), caps it at the chama wallet balance,
//     stores it with a one-time code and e-mails that code to the chairperson.
//  2. The chairperson calls .../confirm with the code. The server re-checks the
//     collected amount at that instant, then fires the B2C payout to the
//     recipient's M-Pesa immediately. Safaricom's transaction code is recorded
//     on the transaction once the B2C result callback lands.

const mgrDisbursementOTPTTL = 15 * time.Minute

// mgrRoundCollected returns the total contributions received for a given
// merry-go-round round, from the dedicated payments table with a fallback to
// contribution transaction metadata.
func mgrRoundCollected(db *sql.DB, mgrID, chamaID string, round int) float64 {
	var collected float64
	err := db.QueryRow(`
		SELECT COALESCE(SUM(amount), 0)
		FROM merry_go_round_payments
		WHERE merry_go_round_id = $1 AND round_number = $2 AND chama_id = $3
		  AND status = 'completed'
	`, mgrID, round, chamaID).Scan(&collected)
	if err == nil && collected > 0 {
		return collected
	}

	_ = db.QueryRow(`
		SELECT COALESCE(SUM(t.amount), 0)
		FROM transactions t
		WHERE t.type = 'contribution'
		  AND (t.metadata::jsonb)->>'contributionType' = 'merry-go-round'
		  AND (t.metadata::jsonb)->>'merryGoRoundId' = $1
		  AND (t.metadata::jsonb)->>'roundNumber' = $2
		  AND (t.metadata::jsonb)->>'chamaId' = $3
		  AND t.status = 'completed'
	`, mgrID, fmt.Sprintf("%d", round), chamaID).Scan(&collected)
	return collected
}

// chamaRoleHolder returns the active holder of a chama role (lower-case match).
func chamaRoleHolder(db *sql.DB, chamaID, role string) (userID, email, firstName string, err error) {
	err = db.QueryRow(`
		SELECT cm.user_id, COALESCE(u.email, ''), COALESCE(u.first_name, '')
		FROM chama_members cm
		JOIN users u ON u.id = cm.user_id
		WHERE cm.chama_id = $1 AND lower(cm.role) = $2 AND COALESCE(cm.is_active, true)
		ORDER BY cm.joined_at
		LIMIT 1
	`, chamaID, strings.ToLower(role)).Scan(&userID, &email, &firstName)
	return
}

// InitiateMerryGoRoundDisbursement — POST /chamas/:id/mgr-disbursements/:cycleId/initiate
// Treasurer only. Snapshots the collected amount and e-mails a code to the chairperson.
func (h *DisbursementHandlers) InitiateMerryGoRoundDisbursement(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
		return
	}
	chamaID := c.Param("id")
	cycleID := c.Param("cycleId")
	if chamaID == "" || cycleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Chama ID and cycle ID are required"})
		return
	}

	var body struct {
		RecipientId string `json:"recipientId"`
		Description string `json:"description"`
	}
	_ = c.ShouldBindJSON(&body)

	// Caller must be the active treasurer.
	var callerRole string
	if err := h.db.QueryRow(
		"SELECT lower(role) FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND COALESCE(is_active, true)",
		chamaID, userID,
	).Scan(&callerRole); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "You are not an active member of this chama"})
		return
	}
	if callerRole != "treasurer" {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Only the treasurer can initiate a merry-go-round disbursement"})
		return
	}

	// Load the merry-go-round.
	var mgrChamaID, mgrName, mgrStatus string
	var currentRound int
	if err := h.db.QueryRow(
		"SELECT chama_id, COALESCE(name,''), COALESCE(status,''), COALESCE(current_round,1) FROM merry_go_rounds WHERE id = $1",
		cycleID,
	).Scan(&mgrChamaID, &mgrName, &mgrStatus, &currentRound); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Merry-go-round not found"})
		return
	}
	if mgrChamaID != chamaID {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "This merry-go-round does not belong to this chama"})
		return
	}
	if mgrStatus != "active" {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "error": "This merry-go-round is not active"})
		return
	}

	// Resolve the current recipient: the participant whose position is the
	// current round. Fall back to an explicit recipientId from the body.
	var recipientID, recipientName string
	var alreadyReceived bool
	err := h.db.QueryRow(`
		SELECT p.user_id, COALESCE(p.has_received, false),
		       TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,''))
		FROM merry_go_round_participants p
		JOIN users u ON u.id = p.user_id
		WHERE p.merry_go_round_id = $1 AND p.position = $2
	`, cycleID, currentRound).Scan(&recipientID, &alreadyReceived, &recipientName)
	if err != nil {
		if body.RecipientId == "" {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "error": "Could not determine the current recipient for this round"})
			return
		}
		recipientID = body.RecipientId
		_ = h.db.QueryRow(
			"SELECT TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')) FROM users WHERE id = $1", recipientID,
		).Scan(&recipientName)
	}
	if alreadyReceived {
		c.JSON(http.StatusConflict, gin.H{"success": false, "error": fmt.Sprintf("%s has already received their merry-go-round payout for this round", strings.TrimSpace(recipientName))})
		return
	}

	// Deterministic id: if this recipient already has a payout transaction for
	// this round, do not let another one be initiated.
	txnID := fmt.Sprintf("MGRDISB_%s_%d_%s", cycleID, currentRound, recipientID)
	var txnExists bool
	_ = h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM transactions WHERE id = $1)", txnID).Scan(&txnExists)
	if txnExists {
		c.JSON(http.StatusConflict, gin.H{"success": false, "error": "A payout for this recipient and round has already been processed"})
		return
	}

	// The amount available RIGHT NOW is what has been collected for this round,
	// capped at what the chama's independent merry-go-round sub-wallet holds.
	collected := mgrRoundCollected(h.db, cycleID, chamaID, currentRound)
	walletBal, _ := walletBalance(h.db, chamaMerryGoRoundWalletID(chamaID))
	amount := collected
	if walletBal < amount {
		amount = walletBal
	}
	if amount <= 0 {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"success": false,
			"error":   "No merry-go-round contributions have been collected for this round yet, so there is nothing to disburse",
		})
		return
	}

	// Find the chairperson (the approver).
	approverID, approverEmail, approverFirst, cerr := chamaRoleHolder(h.db, chamaID, "chairperson")
	if cerr != nil || approverID == "" {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "error": "This chama has no active chairperson to approve the disbursement"})
		return
	}
	if approverEmail == "" {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "error": "The chairperson has no e-mail address on file to receive the confirmation code"})
		return
	}

	description := strings.TrimSpace(body.Description)
	if description == "" {
		description = fmt.Sprintf("Merry-go-round payout (%s) round %d to %s", mgrName, currentRound, strings.TrimSpace(recipientName))
	}

	// Replace any prior unconsumed code for this round.
	if _, derr := h.db.Exec(
		"DELETE FROM mgr_disbursement_otps WHERE merry_go_round_id = $1 AND round_number = $2 AND consumed = FALSE",
		cycleID, currentRound,
	); derr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to reset previous disbursement request"})
		return
	}

	otp := utils.GenerateOTP(6)
	otpID := "mgrotp-" + uuid.New().String()
	expiresAt := time.Now().Add(mgrDisbursementOTPTTL)
	if _, ierr := h.db.Exec(`
		INSERT INTO mgr_disbursement_otps (
			id, merry_go_round_id, chama_id, round_number, recipient_id, recipient_name,
			amount, collected, description, initiated_by, approver_id, otp, expires_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`, otpID, cycleID, chamaID, currentRound, recipientID, strings.TrimSpace(recipientName),
		amount, collected, description, userID, approverID, otp, expiresAt); ierr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to create disbursement request: " + ierr.Error()})
		return
	}

	go sendMGRDisbursementOTPEmail(approverEmail, approverFirst, otp, amount, strings.TrimSpace(recipientName), mgrName, currentRound)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Disbursement initiated. A confirmation code has been e-mailed to the chairperson.",
		"data": gin.H{
			"otpId":          otpID,
			"merryGoRoundId": cycleID,
			"roundNumber":    currentRound,
			"recipientId":    recipientID,
			"recipientName":  strings.TrimSpace(recipientName),
			"amount":         amount,
			"collected":      collected,
			"walletBalance":  walletBal,
			"approver":       gin.H{"role": "chairperson", "email": utils.MaskEmail(approverEmail)},
			"expiresAt":      expiresAt.Format(time.RFC3339),
		},
	})
	c.Abort()
}

// ConfirmMerryGoRoundDisbursement — POST /chamas/:id/mgr-disbursements/:cycleId/confirm
// Chairperson only, with the code from the e-mail. Fires the B2C payout instantly.
func (h *DisbursementHandlers) ConfirmMerryGoRoundDisbursement(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
		return
	}
	chamaID := c.Param("id")
	cycleID := c.Param("cycleId")

	var body struct {
		Otp   string `json:"otp"`
		OtpID string `json:"otpId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Otp) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "The confirmation code is required"})
		return
	}
	code := strings.TrimSpace(body.Otp)

	// Caller must be the active chairperson.
	var callerRole string
	if err := h.db.QueryRow(
		"SELECT lower(role) FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND COALESCE(is_active, true)",
		chamaID, userID,
	).Scan(&callerRole); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "You are not an active member of this chama"})
		return
	}
	if callerRole != "chairperson" {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Only the chairperson can confirm a merry-go-round disbursement"})
		return
	}

	var (
		otpID, recipientID, recipientName, description, approverID string
		roundNumber                                                int
		storedAmount                                               float64
		verified, consumed                                         bool
		expiresAt                                                  time.Time
	)
	err := h.db.QueryRow(`
		SELECT id, recipient_id, COALESCE(recipient_name,''), COALESCE(description,''), approver_id,
		       round_number, amount, verified, consumed, expires_at
		FROM mgr_disbursement_otps
		WHERE merry_go_round_id = $1 AND chama_id = $2 AND otp = $3
		ORDER BY created_at DESC
		LIMIT 1
	`, cycleID, chamaID, code).Scan(
		&otpID, &recipientID, &recipientName, &description, &approverID,
		&roundNumber, &storedAmount, &verified, &consumed, &expiresAt,
	)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "error": "Invalid confirmation code"})
		return
	}
	if consumed {
		c.JSON(http.StatusConflict, gin.H{"success": false, "error": "This disbursement has already been confirmed"})
		return
	}
	if time.Now().After(expiresAt) {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "error": "The confirmation code has expired. Ask the treasurer to initiate the disbursement again."})
		return
	}
	if approverID != userID {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Only the chairperson the code was sent to can confirm this disbursement"})
		return
	}

	// Re-check what is actually collected / available at THIS instant — never
	// disburse more than is in the pot right now.
	collectedNow := mgrRoundCollected(h.db, cycleID, chamaID, roundNumber)
	walletBal, _ := walletBalance(h.db, chamaMerryGoRoundWalletID(chamaID))
	amount := storedAmount
	if collectedNow < amount {
		amount = collectedNow
	}
	if walletBal < amount {
		amount = walletBal
	}
	if amount <= 0 {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "error": "There are no merry-go-round funds available to disburse for this round right now"})
		return
	}

	// Claim the code so a concurrent confirm cannot double-pay.
	claim, cerr := h.db.Exec("UPDATE mgr_disbursement_otps SET verified = TRUE, consumed = TRUE WHERE id = $1 AND consumed = FALSE", otpID)
	if cerr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to lock disbursement for processing"})
		return
	}
	if n, _ := claim.RowsAffected(); n != 1 {
		c.JSON(http.StatusConflict, gin.H{"success": false, "error": "This disbursement has already been confirmed"})
		return
	}

	txnID, conversationID, derr := h.disbursementService.DisburseMerryGoRoundAmount(
		cycleID, recipientID, roundNumber, amount, description, userID,
	)
	if derr != nil {
		// Release the code so the treasurer can retry.
		_, _ = h.db.Exec("UPDATE mgr_disbursement_otps SET verified = FALSE, consumed = FALSE WHERE id = $1", otpID)
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": "The M-Pesa payout could not be started: " + derr.Error()})
		return
	}

	_, _ = h.db.Exec("UPDATE mgr_disbursement_otps SET transaction_id = $1 WHERE id = $2", txnID, otpID)

	// Advance the round if everyone has now been served (best-effort).
	go func() {
		defer func() { recover() }()
		_ = checkAndAdvanceMerryGoRound(h.db, cycleID, chamaID, userID)
	}()

	// Notify the recipient.
	go func() {
		defer func() { recover() }()
		nid := fmt.Sprintf("notif-%d", time.Now().UnixNano())
		_ = createNotification(h.db, nid, recipientID, "merry_go_round",
			"Merry-go-round payout on the way",
			fmt.Sprintf("KES %.2f is being sent to your M-Pesa (%s).", amount, strings.TrimSpace(recipientName)),
			fmt.Sprintf(`{"merry_go_round_id":"%s","transaction_id":"%s","amount":%.2f}`, cycleID, txnID, amount),
			"merry_go_round", nil)
	}()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Confirmed. KES %.2f is being sent to %s's M-Pesa now. The M-Pesa code is recorded once Safaricom confirms the payment.", amount, strings.TrimSpace(recipientName)),
		"data": gin.H{
			"transactionId":  txnID,
			"conversationId": conversationID,
			"amount":         amount,
			"recipientId":    recipientID,
			"recipientName":  strings.TrimSpace(recipientName),
			"roundNumber":    roundNumber,
			"status":         "processing",
		},
	})
	c.Abort()
}

// mgrDisbRecord is one round of one merry-go-round in the disbursement ledger.
type mgrDisbRecord struct {
	MerryGoRoundID   string  `json:"merryGoRoundId"`
	MerryGoRoundName string  `json:"merryGoRoundName"`
	RoundNumber      int     `json:"roundNumber"`
	RecipientID      string  `json:"recipientId"`
	RecipientName    string  `json:"recipientName"`
	ExpectedAmount   float64 `json:"expectedAmount"`
	Collected        float64 `json:"collected"`
	// state: disbursed | processing | failed | awaiting_confirmation | ready | collecting | upcoming
	State             string  `json:"state"`
	DisbursedAmount   float64 `json:"disbursedAmount,omitempty"`
	DisbursedAt       string  `json:"disbursedAt,omitempty"`
	MpesaCode         string  `json:"mpesaCode,omitempty"`
	TransactionID     string  `json:"transactionId,omitempty"`
	TransactionStatus string  `json:"transactionStatus,omitempty"`
	OtpExpiresAt      string  `json:"otpExpiresAt,omitempty"`
	IsCurrentRound    bool    `json:"isCurrentRound"`
}

func mgrExtractReceipt(metadata string) string {
	if metadata == "" {
		return ""
	}
	var m map[string]interface{}
	if json.Unmarshal([]byte(metadata), &m) != nil {
		return ""
	}
	for _, k := range []string{"mpesa_receipt_number", "b2c_transaction_receipt"} {
		if v, ok := m[k].(string); ok && v != "" {
			return v
		}
	}
	return ""
}

// ListMerryGoRoundDisbursements — GET /chamas/:id/mgr-disbursements
// A round-by-round ledger across every merry-go-round of the chama: which rounds
// have been collected and still need disbursing, which are awaiting the
// chairperson's confirmation, and the records of those already paid out
// (amount, date, M-Pesa code).
func (h *DisbursementHandlers) ListMerryGoRoundDisbursements(c *gin.Context) {
	userID := c.GetString("userID")
	chamaID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "User not authenticated"})
		return
	}
	var isMember bool
	if err := h.db.QueryRow(
		"SELECT EXISTS(SELECT 1 FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND COALESCE(is_active, true))",
		chamaID, userID,
	).Scan(&isMember); err != nil || !isMember {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "You are not a member of this chama"})
		return
	}

	mgrRows, err := h.db.Query(`
		SELECT id, COALESCE(name,''), COALESCE(amount_per_round,0), COALESCE(total_participants,0),
		       COALESCE(current_round,1), COALESCE(status,'')
		FROM merry_go_rounds
		WHERE chama_id = $1
		ORDER BY created_at DESC
	`, chamaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to load merry-go-rounds"})
		return
	}
	defer mgrRows.Close()

	type mgrHdr struct {
		id, name, status         string
		amountPerRound           float64
		totalParticipants, round int
	}
	var mgrs []mgrHdr
	for mgrRows.Next() {
		var m mgrHdr
		if mgrRows.Scan(&m.id, &m.name, &m.amountPerRound, &m.totalParticipants, &m.round, &m.status) == nil {
			mgrs = append(mgrs, m)
		}
	}

	records := []mgrDisbRecord{}
	for _, m := range mgrs {
		// Participants -> one round each (position == round number).
		pRows, perr := h.db.Query(`
			SELECT p.position, p.user_id, COALESCE(p.has_received,false), p.received_at,
			       TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,''))
			FROM merry_go_round_participants p
			JOIN users u ON u.id = p.user_id
			WHERE p.merry_go_round_id = $1
			ORDER BY p.position
		`, m.id)
		if perr != nil {
			continue
		}
		type part struct {
			pos        int
			uid, name  string
			received   bool
			receivedAt sql.NullTime
		}
		var parts []part
		for pRows.Next() {
			var p part
			if pRows.Scan(&p.pos, &p.uid, &p.received, &p.receivedAt, &p.name) == nil {
				parts = append(parts, p)
			}
		}
		pRows.Close()

		// Collected per round.
		collectedByRound := map[int]float64{}
		if cRows, cerr := h.db.Query(`
			SELECT round_number, COALESCE(SUM(amount),0)
			FROM merry_go_round_payments
			WHERE merry_go_round_id = $1 AND status = 'completed'
			GROUP BY round_number
		`, m.id); cerr == nil {
			for cRows.Next() {
				var rn int
				var amt float64
				if cRows.Scan(&rn, &amt) == nil {
					collectedByRound[rn] = amt
				}
			}
			cRows.Close()
		}

		// Payout transactions for this merry-go-round, keyed by round.
		type txnRec struct {
			id, status, code string
			amount           float64
			at               time.Time
		}
		txnByRound := map[int]txnRec{}
		prefix := "MGRDISB_" + m.id + "_"
		if tRows, terr := h.db.Query(`
			SELECT id, COALESCE(amount,0), COALESCE(status,''), COALESCE(metadata::text,''), updated_at
			FROM transactions
			WHERE id LIKE $1
		`, prefix+"%"); terr == nil {
			for tRows.Next() {
				var id, st, meta string
				var amt float64
				var at time.Time
				if tRows.Scan(&id, &amt, &st, &meta, &at) != nil {
					continue
				}
				rest := strings.TrimPrefix(id, prefix)
				bits := strings.SplitN(rest, "_", 2)
				if len(bits) == 0 {
					continue
				}
				rn, convErr := strconv.Atoi(bits[0])
				if convErr != nil {
					continue
				}
				txnByRound[rn] = txnRec{id: id, status: st, code: mgrExtractReceipt(meta), amount: amt, at: at}
			}
			tRows.Close()
		}

		// In-flight confirmation codes, keyed by round.
		otpByRound := map[int]time.Time{}
		if oRows, oerr := h.db.Query(`
			SELECT round_number, expires_at
			FROM mgr_disbursement_otps
			WHERE merry_go_round_id = $1 AND consumed = FALSE AND expires_at > NOW()
		`, m.id); oerr == nil {
			for oRows.Next() {
				var rn int
				var exp time.Time
				if oRows.Scan(&rn, &exp) == nil {
					otpByRound[rn] = exp
				}
			}
			oRows.Close()
		}

		for _, p := range parts {
			rec := mgrDisbRecord{
				MerryGoRoundID:   m.id,
				MerryGoRoundName: m.name,
				RoundNumber:      p.pos,
				RecipientID:      p.uid,
				RecipientName:    strings.TrimSpace(p.name),
				ExpectedAmount:   m.amountPerRound * float64(m.totalParticipants),
				Collected:        collectedByRound[p.pos],
				IsCurrentRound:   p.pos == m.round && m.status == "active",
			}

			if txn, ok := txnByRound[p.pos]; ok {
				rec.TransactionID = txn.id
				rec.TransactionStatus = txn.status
				rec.DisbursedAmount = txn.amount
				rec.MpesaCode = txn.code
				if !txn.at.IsZero() {
					rec.DisbursedAt = txn.at.Format(time.RFC3339)
				}
				switch txn.status {
				case "failed":
					rec.State = "failed"
				case "completed":
					rec.State = "disbursed"
				default:
					rec.State = "processing"
				}
			} else if p.received {
				rec.State = "disbursed"
				if p.receivedAt.Valid {
					rec.DisbursedAt = p.receivedAt.Time.Format(time.RFC3339)
				}
			} else if exp, ok := otpByRound[p.pos]; ok {
				rec.State = "awaiting_confirmation"
				rec.OtpExpiresAt = exp.Format(time.RFC3339)
			} else if m.status != "active" {
				rec.State = "upcoming"
			} else if p.pos < m.round || (p.pos == m.round && rec.Collected > 0) {
				rec.State = "ready"
			} else if p.pos == m.round {
				rec.State = "collecting"
			} else {
				rec.State = "upcoming"
			}

			records = append(records, rec)
		}
	}

	// Most actionable / most recent first: awaiting_confirmation, ready,
	// processing, collecting, disbursed (newest), failed, upcoming.
	statePriority := map[string]int{
		"awaiting_confirmation": 0, "ready": 1, "processing": 2, "failed": 3,
		"collecting": 4, "disbursed": 5, "upcoming": 6,
	}
	sort.SliceStable(records, func(i, j int) bool {
		pi, pj := statePriority[records[i].State], statePriority[records[j].State]
		if pi != pj {
			return pi < pj
		}
		if records[i].State == "disbursed" {
			return records[i].DisbursedAt > records[j].DisbursedAt
		}
		return records[i].RoundNumber < records[j].RoundNumber
	})

	// Summary counts for the management view.
	var pendingCount, disbursedCount int
	var disbursedTotal float64
	for _, r := range records {
		switch r.State {
		case "disbursed", "processing":
			disbursedCount++
			if r.DisbursedAmount > 0 {
				disbursedTotal += r.DisbursedAmount
			} else {
				disbursedTotal += r.Collected
			}
		case "ready", "awaiting_confirmation":
			pendingCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    records,
		"summary": gin.H{
			"pendingDisbursement": pendingCount,
			"disbursed":           disbursedCount,
			"disbursedTotal":      disbursedTotal,
		},
	})
	c.Abort()
}

// sendMGRDisbursementOTPEmail e-mails the 6-digit confirmation code to the chairperson.
func sendMGRDisbursementOTPEmail(email, firstName, otp string, amount float64, recipientName, mgrName string, round int) {
	if email == "" {
		return
	}
	if firstName == "" {
		firstName = "there"
	}
	subject := fmt.Sprintf("VaultKe - Merry-go-round payout code: %s", otp)
	body := fmt.Sprintf(`<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#111827;background:#f3f4f6;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#0f172a;color:#fff;padding:18px 24px">
      <div style="font-size:18px;font-weight:bold">VaultKe</div>
      <div style="font-size:12px;color:#c7d2e3">Merry-go-round disbursement confirmation</div>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 12px">Hi %s,</p>
      <p style="margin:0 0 12px">The treasurer has initiated a merry-go-round payout of <strong>KES %.2f</strong> to <strong>%s</strong> (%s, round %d). This is the amount collected for the round so far.</p>
      <p style="margin:0 0 12px">Enter this code in the app to release the payment to their M-Pesa:</p>
      <div style="font-size:30px;letter-spacing:8px;font-weight:bold;text-align:center;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:16px 0;margin:16px 0">%s</div>
      <p style="margin:0 0 6px;color:#6b7280;font-size:13px">This code expires in 15 minutes and can be used once.</p>
      <p style="margin:12px 0 0;color:#6b7280;font-size:13px">If you were not expecting this, do not enter the code and contact the treasurer.</p>
    </div>
  </div>
</body></html>`, firstName, amount, recipientName, mgrName, round, otp)

	if err := services.NewEmailService().SendHTMLEmail(email, subject, body); err != nil {
		fmt.Printf("MGR disbursement OTP e-mail to %s failed: %v (code %s)\n", email, err, otp)
	}
}
