package api

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
	"vaultke-backend/internal/models"

	"github.com/gin-gonic/gin"
)

// truncateString safely truncates a string to the specified length
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen]
}

// ReceiptHandlers handles receipt-related API endpoints
type ReceiptHandlers struct {
	db *sql.DB
}

// NewReceiptHandlers creates a new receipt handlers instance
func NewReceiptHandlers(db *sql.DB) *ReceiptHandlers {
	return &ReceiptHandlers{db: db}
}

// CompanyInfo represents company information for receipts
type CompanyInfo struct {
	Name    string `json:"name"`
	Address string `json:"address"`
	Phone   string `json:"phone"`
	Email   string `json:"email"`
	Website string `json:"website"`
	Logo    string `json:"logo"`
}

// ReceiptData represents the complete receipt data
type ReceiptData struct {
	ReceiptID   string                 `json:"receiptId"`
	CompanyInfo CompanyInfo            `json:"companyInfo"`
	Transaction models.Transaction     `json:"transaction"`
	UserInfo    map[string]interface{} `json:"userInfo"`
	GeneratedAt time.Time              `json:"generatedAt"`
	Version     string                 `json:"version"`
}

// GetTransactionReceipt generates and returns a transaction receipt
func (h *ReceiptHandlers) GetTransactionReceipt(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	transactionID := c.Param("transactionId")
	if transactionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Transaction ID is required",
		})
		return
	}

	format := c.DefaultQuery("format", "json")
	if format != "json" && format != "html" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Supported formats: json, html",
		})
		return
	}

	// Get transaction details
	transaction, err := h.getTransactionByID(transactionID, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "Transaction not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve transaction",
		})
		return
	}

	// Get user information
	userInfo, err := h.getUserInfo(userID)
	if err != nil {
		// Continue without user info if not found
		userInfo = make(map[string]interface{})
	}

	// Generate receipt data
	receiptData := h.generateReceiptData(transaction, userInfo)

	switch format {
	case "json":
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    receiptData,
		})
		c.Abort()
	case "html":
		html := h.generateReceiptHTML(receiptData)
		c.Header("Content-Type", "text/html")
		c.String(http.StatusOK, html)
	}
}

// DownloadTransactionReceipt generates and serves a downloadable receipt
func (h *ReceiptHandlers) DownloadTransactionReceipt(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	transactionID := c.Param("transactionId")
	if transactionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Transaction ID is required",
		})
		return
	}

	format := c.DefaultQuery("format", "json")
	if format != "json" && format != "html" && format != "pdf" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Supported formats: json, html, pdf",
		})
		return
	}

	// Get transaction details
	transaction, err := h.getTransactionByID(transactionID, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "Transaction not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve transaction",
		})
		return
	}

	// Get user information
	userInfo, err := h.getUserInfo(userID)
	if err != nil {
		userInfo = make(map[string]interface{})
	}

	// Generate receipt data
	receiptData := h.generateReceiptData(transaction, userInfo)
	receiptID := fmt.Sprintf("RCP-%s", truncateString(transaction.ID, 8))
	fileName := fmt.Sprintf("VaultKe_Receipt_%s_%s.%s",
		receiptID,
		time.Now().Format("2006-01-02"),
		format)

	// Set CORS headers explicitly
	origin := c.GetHeader("Origin")
	if origin != "" {
		c.Header("Access-Control-Allow-Origin", origin)
	}

	switch format {
	case "json":
		jsonData, _ := json.MarshalIndent(receiptData, "", "  ")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", fileName))
		c.Header("Content-Type", "application/json")
		c.String(http.StatusOK, string(jsonData))
	case "html":
		html := h.generateReceiptHTML(receiptData)
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", fileName))
		c.Header("Content-Type", "text/html")
		c.String(http.StatusOK, html)
	case "pdf":
		pdfBytes := h.generateReceiptPDF(receiptData)
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", fileName))
		c.Header("Content-Type", "application/pdf")
		c.Header("Access-Control-Expose-Headers", "Content-Disposition, Content-Length")
		c.Header("Content-Length", fmt.Sprintf("%d", len(pdfBytes)))
		log.Printf("DEBUG: Serving PDF receipt for transaction %s, size=%d bytes", receiptData.Transaction.ID, len(pdfBytes))
		if len(pdfBytes) == 0 {
			log.Printf("ERROR: PDF bytes is empty for transaction %s", receiptData.Transaction.ID)
		}
		c.Data(http.StatusOK, "application/pdf", pdfBytes)
	}
}

// getTransactionByID retrieves a transaction by ID for a specific user
func (h *ReceiptHandlers) getTransactionByID(transactionID, userID string) (*models.Transaction, error) {
	resolvedTransactionID := transactionID
	if resolved, err := h.resolveTransactionID(transactionID); err == nil {
		resolvedTransactionID = resolved
	} else if err != sql.ErrNoRows {
		return nil, err
	}

	query := `
		SELECT id, from_wallet_id, to_wallet_id, type, status, amount, currency,
			   description, reference, payment_method, metadata, fees, initiated_by,
			   recipient_id, approved_by, requires_approval, approval_deadline, created_at, updated_at
		FROM transactions
		WHERE id = $1
	`

	var transaction models.Transaction
	var fromWalletID, toWalletID, approvedBy, recipientID sql.NullString
	var approvalDeadline sql.NullTime
	var metadataJSON []byte

	err := h.db.QueryRow(query, resolvedTransactionID).Scan(
		&transaction.ID,
		&fromWalletID,
		&toWalletID,
		&transaction.Type,
		&transaction.Status,
		&transaction.Amount,
		&transaction.Currency,
		&transaction.Description,
		&transaction.Reference,
		&transaction.PaymentMethod,
		&metadataJSON,
		&transaction.Fees,
		&transaction.InitiatedBy,
		&recipientID,
		&approvedBy,
		&transaction.RequiresApproval,
		&approvalDeadline,
		&transaction.CreatedAt,
		&transaction.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		// Not a row in `transactions`. The chama activity feed also surfaces
		// merry-go-round / welfare / loan payments that live in their own tables.
		if synth, sErr := h.synthesizeReceiptTransaction(resolvedTransactionID, userID); sErr == nil {
			return synth, nil
		}
		return nil, sql.ErrNoRows
	}
	if err != nil {
		log.Printf("DEBUG: Failed to scan transaction %s: %v", resolvedTransactionID, err)
		return nil, err
	}

	// Parse metadata FIRST - needed for authorization check
	transaction.Metadata = make(map[string]interface{})
	if len(metadataJSON) > 0 {
		json.Unmarshal(metadataJSON, &transaction.Metadata)
	}
	if recipientID.Valid && recipientID.String != "" {
		transaction.RecipientID = &recipientID.String
	}

	// Authorize: direct initiator/approver, the named recipient, OR a chama officer.
	recipientMatches := transaction.RecipientID != nil && *transaction.RecipientID == userID
	if transaction.InitiatedBy != userID && !recipientMatches &&
		(transaction.ApprovedBy == nil || *transaction.ApprovedBy != userID) {
		// The chama id may be on the column or in metadata under either casing.
		chamaID := ""
		for _, k := range []string{"chama_id", "chamaId"} {
			if v, ok := transaction.Metadata[k].(string); ok && v != "" {
				chamaID = v
				break
			}
		}
		if chamaID == "" {
			log.Printf("DEBUG: Auth denied - no chama on transaction %s, user %s", transaction.ID, userID)
			return nil, sql.ErrNoRows
		}
		var count int
		if scanErr := h.db.QueryRow(
			"SELECT COUNT(*) FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND lower(role) IN ('chairperson','treasurer','secretary','admin') AND COALESCE(is_active, true)",
			chamaID, userID,
		).Scan(&count); scanErr != nil || count == 0 {
			log.Printf("DEBUG: Auth denied - user %s not officer of chama %s for transaction %s", userID, chamaID, transaction.ID)
			return nil, sql.ErrNoRows
		}
	}

	// Handle nullable fields
	if fromWalletID.Valid {
		transaction.FromWalletID = &fromWalletID.String
	}
	if toWalletID.Valid {
		transaction.ToWalletID = &toWalletID.String
	}
	if approvedBy.Valid {
		transaction.ApprovedBy = &approvedBy.String
	}
	if approvalDeadline.Valid {
		transaction.ApprovalDeadline = &approvalDeadline.Time
	}

	// Log transaction info for debugging
	log.Printf("DEBUG: Transaction found id=%s status=%s type=%s initiatedBy=%s metadataChamaID=%v",
		transaction.ID, transaction.Status, transaction.Type, transaction.InitiatedBy, transaction.Metadata["chama_id"])

	return &transaction, nil
}

// userCanSeeChamaRecord authorizes a receipt: the record owner, or an officer of
// the record's chama.
func (h *ReceiptHandlers) userCanSeeChamaRecord(userID, ownerID, chamaID string) bool {
	if userID != "" && userID == ownerID {
		return true
	}
	if chamaID == "" {
		return false
	}
	var count int
	_ = h.db.QueryRow(
		"SELECT COUNT(*) FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND lower(role) IN ('chairperson','treasurer','secretary','admin') AND COALESCE(is_active, true)",
		chamaID, userID,
	).Scan(&count)
	return count > 0
}

// buildSyntheticTransaction assembles a models.Transaction for a payment that
// lives outside the `transactions` table (merry-go-round / welfare / loan
// payments) so the same receipt renderer can be used.
func (h *ReceiptHandlers) buildSyntheticTransaction(id, kind, status string, amount float64, method, description, reference, initiatedBy, chamaID string, at time.Time) *models.Transaction {
	desc := description
	ref := reference
	t := &models.Transaction{
		ID:            id,
		Type:          models.TransactionType(kind),
		Status:        models.TransactionStatus(status),
		Amount:        amount,
		Currency:      "KES",
		PaymentMethod: models.PaymentMethod(method),
		InitiatedBy:   initiatedBy,
		ChamaID:       chamaID,
		CreatedAt:     at,
		UpdatedAt:     at,
		Metadata:      map[string]interface{}{"chama_id": chamaID, "synthetic": true},
	}
	if desc != "" {
		t.Description = &desc
	}
	if ref != "" {
		t.Reference = &ref
	}
	return t
}

// synthesizeReceiptTransaction looks a record id up across the payment tables
// that back the chama activity feed but are not rows in `transactions`.
func (h *ReceiptHandlers) synthesizeReceiptTransaction(recordID, userID string) (*models.Transaction, error) {
	// Merry-go-round payment — reuse its linked transaction if it has one.
	{
		var linkedTxn, chamaID, payer, method, status, desc sql.NullString
		var amount sql.NullFloat64
		var round sql.NullInt64
		var createdAt sql.NullTime
		err := h.db.QueryRow(`
			SELECT transaction_id, chama_id, payer_user_id, COALESCE(payment_method,''),
			       COALESCE(status,'completed'), COALESCE(description,''),
			       COALESCE(amount,0), COALESCE(round_number,0), created_at
			FROM merry_go_round_payments WHERE id = $1
		`, recordID).Scan(&linkedTxn, &chamaID, &payer, &method, &status, &desc, &amount, &round, &createdAt)
		if err == nil {
			if linkedTxn.Valid && strings.TrimSpace(linkedTxn.String) != "" {
				if t, e := h.getTransactionByID(linkedTxn.String, userID); e == nil {
					return t, nil
				}
			}
			if !h.userCanSeeChamaRecord(userID, payer.String, chamaID.String) {
				return nil, sql.ErrNoRows
			}
			d := strings.TrimSpace(desc.String)
			if d == "" {
				d = fmt.Sprintf("Merry-go-round contribution (round %d)", round.Int64)
			}
			return h.buildSyntheticTransaction(recordID, "merry-go-round", status.String, amount.Float64,
				method.String, d, "", payer.String, chamaID.String, createdAt.Time), nil
		}
	}

	// Welfare contribution.
	{
		var user, method, ref, chamaID string
		var amount float64
		var at time.Time
		err := h.db.QueryRow(`
			SELECT wc.user_id, COALESCE(wc.payment_method,''), COALESCE(wc.reference,''),
			       COALESCE(wc.amount,0), wc.contributed_at, COALESCE(wf.chama_id,'')
			FROM welfare_contributions wc
			LEFT JOIN welfare_funds wf ON wf.id = wc.welfare_fund_id
			WHERE wc.id = $1
		`, recordID).Scan(&user, &method, &ref, &amount, &at, &chamaID)
		if err == nil {
			if !h.userCanSeeChamaRecord(userID, user, chamaID) {
				return nil, sql.ErrNoRows
			}
			return h.buildSyntheticTransaction(recordID, "welfare_contribution", "completed", amount,
				method, "Welfare contribution", ref, user, chamaID, at), nil
		}
	}

	// Loan repayment.
	{
		var method, ref, borrower, chamaID string
		var amount float64
		var at time.Time
		err := h.db.QueryRow(`
			SELECT COALESCE(lp.payment_method,''), COALESCE(lp.reference,''),
			       COALESCE(l.borrower_id,''), COALESCE(l.chama_id,''),
			       COALESCE(lp.amount,0), lp.paid_at
			FROM loan_payments lp
			LEFT JOIN loans l ON l.id = lp.loan_id
			WHERE lp.id = $1
		`, recordID).Scan(&method, &ref, &borrower, &chamaID, &amount, &at)
		if err == nil {
			if !h.userCanSeeChamaRecord(userID, borrower, chamaID) {
				return nil, sql.ErrNoRows
			}
			return h.buildSyntheticTransaction(recordID, "loan_payment", "completed", amount,
				method, "Loan repayment", ref, borrower, chamaID, at), nil
		}
	}

	return nil, sql.ErrNoRows
}

// resolveTransactionID attempts to map an external payment reference (e.g. an M-Pesa receipt number)
// to an internal transaction ID by searching transaction metadata.
func (h *ReceiptHandlers) resolveTransactionID(transactionID string) (string, error) {
	if transactionID == "" {
		return "", sql.ErrNoRows
	}

	trxLookup := strings.ReplaceAll(transactionID, " ", "")
	lowered := strings.ToLower(trxLookup)

	lookupQueries := []string{
		fmt.Sprintf(`%%"mpesa_receipt_number":"%s"%%`, lowered),
		fmt.Sprintf(`%%%s%%`, lowered),
		fmt.Sprintf(`%%%s%%`, transactionID),
	}

	var actualID string
	// metadata is JSONB — cast to text before lower()/LIKE.
	query := `
		SELECT id
		FROM transactions
		WHERE payment_method = $1
		  AND (
			lower(metadata::text) LIKE $2
			OR lower(metadata::text) LIKE $3
			OR reference LIKE $4
		  )
		LIMIT 1
	`
	err := h.db.QueryRow(query, models.PaymentMethodMpesa, lookupQueries[0], lookupQueries[1], lookupQueries[2]).Scan(&actualID)
	if err == nil {
		return actualID, nil
	}
	if err == sql.ErrNoRows {
		// Fallback: search across all payment methods in case the transaction was not marked as mpesa
		fallbackQuery := `
			SELECT id
			FROM transactions
			WHERE lower(metadata::text) LIKE $1
			   OR reference ILIKE $2
			LIMIT 1
		`
		err = h.db.QueryRow(fallbackQuery, lookupQueries[1], lookupQueries[2]).Scan(&actualID)
		if err == nil {
			return actualID, nil
		}
		if err == sql.ErrNoRows {
			// Fallback: search by reference for loan IDs (e.g. loan-1784814615645395284)
			if strings.HasPrefix(transactionID, "loan-") {
				// Verify the loan exists in the loans table first
				var loanExists bool
				loanCheckErr := h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM loans WHERE id = $1)", transactionID).Scan(&loanExists)
				if loanCheckErr == nil && loanExists {
					// Search for transactions with loan-related references (case-insensitive)
					loanRefQuery := `
						SELECT id
						FROM transactions
						WHERE reference ILIKE $1
						   OR reference ILIKE $2
						   OR reference ILIKE $3
						LIMIT 1
					`
					err = h.db.QueryRow(loanRefQuery,
						"%"+transactionID,
						"LOAN-DISB-"+transactionID,
						"LOAN-DISB-%-"+transactionID,
					).Scan(&actualID)
					if err == nil {
						return actualID, nil
					}
				}
			}
			return "", sql.ErrNoRows
		}
		return "", err
	}
	return "", err
}

// getUserInfo retrieves user information for the receipt
func (h *ReceiptHandlers) getUserInfo(userID string) (map[string]interface{}, error) {
	query := `
		SELECT first_name, last_name, email, phone, county, town
		FROM users 
		WHERE id = $1
	`

	var firstName, lastName, email, phone, county, town sql.NullString
	err := h.db.QueryRow(query, userID).Scan(
		&firstName, &lastName, &email, &phone, &county, &town,
	)

	if err != nil {
		return nil, err
	}

	userInfo := make(map[string]interface{})
	if firstName.Valid {
		userInfo["firstName"] = firstName.String
	}
	if lastName.Valid {
		userInfo["lastName"] = lastName.String
	}
	if email.Valid {
		userInfo["email"] = email.String
	}
	if phone.Valid {
		userInfo["phone"] = phone.String
	}
	if county.Valid {
		userInfo["county"] = county.String
	}
	if town.Valid {
		userInfo["town"] = town.String
	}

	return userInfo, nil
}

// generateReceiptData creates the complete receipt data structure
func (h *ReceiptHandlers) generateReceiptData(transaction *models.Transaction, userInfo map[string]interface{}) *ReceiptData {
	receiptID := fmt.Sprintf("RCP-%s", truncateString(transaction.ID, 8))

	companyInfo := CompanyInfo{
		Name:    "VaultKe",
		Address: "Kisumu, Kenya",
		Phone:   "+254 700 000 000",
		Email:   "support@vaultke.co.ke",
		Website: "www.vaultke.co.ke",
		Logo:    "https://vaultke.co.ke/logo.png",
	}

	return &ReceiptData{
		ReceiptID:   receiptID,
		CompanyInfo: companyInfo,
		Transaction: *transaction,
		UserInfo:    userInfo,
		GeneratedAt: time.Now(),
		Version:     "1.0",
	}
}

// generateReceiptHTML creates HTML receipt from receipt data
func (h *ReceiptHandlers) generateReceiptHTML(receiptData *ReceiptData) string {
	formatCurrency := func(amount float64) string {
		return fmt.Sprintf("KES %.2f", amount)
	}

	transactionDate := receiptData.Transaction.CreatedAt.Format("January 2, 2006 at 3:04:05 PM")
	amount := formatCurrency(receiptData.Transaction.Amount)
	fees := formatCurrency(receiptData.Transaction.Fees)
	totalAmount := formatCurrency(receiptData.Transaction.Amount + receiptData.Transaction.Fees)

	getTransactionTypeLabel := func(txType models.TransactionType) string {
		switch txType {
		case models.TransactionTypeDeposit:
			return "Deposit"
		case models.TransactionTypeWithdrawal:
			return "Withdrawal"
		case models.TransactionTypeTransfer:
			return "Transfer"
		case models.TransactionTypeContribution:
			return "Contribution"
		case models.TransactionTypeLoan:
			return "Loan"
		case models.TransactionTypeLoanRepayment:
			return "Loan Repayment"
		case models.TransactionTypePurchase:
			return "Purchase"
		case models.TransactionTypeRefund:
			return "Refund"
		case models.TransactionTypeFee:
			return "Fee"
		default:
			return "Transaction"
		}
	}

	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Transaction Receipt - %s</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; padding: 20px; }
        .receipt-container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden; }
        .receipt-header { background: linear-gradient(135deg, #6366F1, #8B5CF6); color: white; padding: 30px; text-align: center; }
        .company-logo { width: 60px; height: 60px; margin: 0 auto 15px; background: white; border-radius: 50%%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: #6366F1; }
        .company-name { font-size: 28px; font-weight: bold; margin-bottom: 5px; }
        .receipt-title { font-size: 18px; opacity: 0.9; }
        .receipt-body { padding: 30px; }
        .receipt-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
        .info-item { display: flex; flex-direction: column; }
        .info-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
        .info-value { font-size: 14px; font-weight: 600; color: #333; }
        .transaction-details { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 30px; }
        .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid #e5e7eb; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row.total { background: #f8f9fa; font-weight: bold; font-size: 16px; }
        .detail-label { color: #666; }
        .detail-value { font-weight: 600; color: #333; }
        .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-completed { background: #dcfce7; color: #166534; }
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-failed { background: #fee2e2; color: #991b1b; }
        .receipt-footer { background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb; }
        .company-details { font-size: 12px; color: #666; line-height: 1.5; }
        .thank-you { font-size: 14px; color: #333; margin-bottom: 10px; font-weight: 600; }
        @media print { body { background: white; padding: 0; } .receipt-container { box-shadow: none; border-radius: 0; } }
    </style>
</head>
<body>
    <div class="receipt-container">
        <div class="receipt-header">
            <div class="company-logo">VK</div>
            <div class="company-name">%s</div>
            <div class="receipt-title">Transaction Receipt</div>
        </div>

        <div class="receipt-body">
            <div class="receipt-info">
                <div class="info-item">
                    <div class="info-label">Receipt ID</div>
                    <div class="info-value">%s</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Transaction ID</div>
                    <div class="info-value">%s...</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Date & Time</div>
                    <div class="info-value">%s</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Status</div>
                    <div class="info-value">
                        <span class="status-badge status-%s">%s</span>
                    </div>
                </div>
            </div>

            <div class="transaction-details">
                <div class="detail-row">
                    <span class="detail-label">Transaction Type</span>
                    <span class="detail-value">%s</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Description</span>
                    <span class="detail-value">%s</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Amount</span>
                    <span class="detail-value">%s</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Transaction Fees</span>
                    <span class="detail-value">%s</span>
                </div>
                <div class="detail-row total">
                    <span class="detail-label">Total Amount</span>
                    <span class="detail-value">%s</span>
                </div>`,
		receiptData.ReceiptID,
		receiptData.CompanyInfo.Name,
		receiptData.ReceiptID,
		receiptData.Transaction.ID, // Use full ID instead of slicing to avoid crash
		transactionDate,
		receiptData.Transaction.Status,
		receiptData.Transaction.Status,
		getTransactionTypeLabel(receiptData.Transaction.Type),
		func() string {
			if receiptData.Transaction.Description != nil {
				return *receiptData.Transaction.Description
			}
			return "N/A"
		}(),
		amount,
		fees,
		totalAmount,
	)

	// Add optional fields
	if receiptData.Transaction.Reference != nil && *receiptData.Transaction.Reference != "" {
		html += fmt.Sprintf(`
                <div class="detail-row">
                    <span class="detail-label">Reference</span>
                    <span class="detail-value">%s</span>
                </div>`, *receiptData.Transaction.Reference)
	}

	if receiptData.Transaction.PaymentMethod != "" {
		html += fmt.Sprintf(`
                <div class="detail-row">
                    <span class="detail-label">Payment Method</span>
                    <span class="detail-value">%s</span>
                </div>`, receiptData.Transaction.PaymentMethod)
	}

	// Close the HTML
	html += fmt.Sprintf(`
            </div>
        </div>

        <div class="receipt-footer">
            <div class="thank-you">Thank you for using %s!</div>
            <div class="company-details">
                %s<br>
                Phone: %s | Email: %s<br>
                %s
            </div>
        </div>
    </div>
</body>
</html>`,
		receiptData.CompanyInfo.Name,
		receiptData.CompanyInfo.Address,
		receiptData.CompanyInfo.Phone,
		receiptData.CompanyInfo.Email,
		receiptData.CompanyInfo.Website,
	)

	return html
}

// generateReceiptPDF creates a PDF receipt from receipt data, using the same
// table-based visual language as the loan report (header band, section rules,
// key/value grid, zebra line-items table, standard footer).
func (h *ReceiptHandlers) generateReceiptPDF(receiptData *ReceiptData) []byte {
	t := receiptData.Transaction
	org := receiptData.CompanyInfo.Name
	if strings.TrimSpace(org) == "" {
		org = loanReportAppName
	}

	pdf, genAt := newStatementPDF(org, "Transaction Receipt", shortRef(receiptData.ReceiptID))

	pdf.SetFont("Helvetica", "B", 13)
	pdf.CellFormat(120, 8, "Receipt "+shortRef(receiptData.ReceiptID), "", 0, "L", false, 0, "")
	statusChip(pdf, strings.ToUpper(orDash(string(t.Status))))
	pdf.Ln(11)

	description := ""
	if t.Description != nil {
		description = *t.Description
	}
	reference := ""
	if t.Reference != nil {
		reference = *t.Reference
	}
	mpesaCode := ""
	phone := ""
	if t.Metadata != nil {
		if v, ok := t.Metadata["mpesa_receipt_number"].(string); ok {
			mpesaCode = v
		}
		if v, ok := t.Metadata["b2c_transaction_receipt"].(string); ok && mpesaCode == "" {
			mpesaCode = v
		}
		if v, ok := t.Metadata["mpesa_phone_number"].(string); ok {
			phone = v
		}
	}
	payer := ""
	if receiptData.UserInfo != nil {
		if v, ok := receiptData.UserInfo["name"].(string); ok {
			payer = v
		}
	}

	sectionTitle(pdf, "Details")
	kvGrid(pdf, [][2]string{
		{"Transaction ID", orDash(t.ID)},
		{"Type", title(string(t.Type))},
		{"Date", t.CreatedAt.Format("2 Jan 2006, 15:04")},
		{"Status", title(string(t.Status))},
		{"Payment method", title(orDash(string(t.PaymentMethod)))},
		{"Reference", orDash(reference)},
		{"Account holder", orDash(payer)},
		{"M-Pesa code", orDash(mpesaCode)},
		{"Phone", orDash(phone)},
		{"", ""},
	})
	if strings.TrimSpace(description) != "" {
		pdf.Ln(1)
		pdf.SetFont("Helvetica", "B", 7.5)
		pdf.SetTextColor(107, 114, 128)
		pdf.CellFormat(0, 4.5, "DESCRIPTION", "", 1, "L", false, 0, "")
		pdf.SetFont("Helvetica", "", 9.5)
		pdf.SetTextColor(17, 24, 39)
		pdf.MultiCell(0, 5, sanitize(description), "", "L", false)
	}
	pdf.Ln(3)

	sectionTitle(pdf, "Amount")
	w := []float64{120, 58}
	tableHeader(pdf, []string{"Item", "Amount"}, w)
	tableRow(pdf, []string{"Transaction amount", money(t.Amount)}, w, false)
	tableRow(pdf, []string{"Fees", money(t.Fees)}, w, true)
	tableRow(pdf, []string{"Total", money(t.Amount + t.Fees)}, w, false)

	pdf.Ln(6)
	pdf.SetFont("Helvetica", "I", 7.5)
	pdf.SetTextColor(107, 114, 128)
	pdf.MultiCell(0, 4,
		fmt.Sprintf("Generated %s. This is a computer-generated receipt and does not require a signature. \"%s\" and the %s wordmark are the property of the %s platform.",
			genAt.Format("2 Jan 2006 15:04 MST"), loanReportAppName, loanReportAppName, loanReportAppName),
		"", "L", false)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		log.Printf("Warning: Failed to generate PDF output: %v", err)
	}
	return buf.Bytes()
}
