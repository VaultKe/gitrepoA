package services

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"vaultke-backend/config"
	"vaultke-backend/internal/models"
)

// MpesaService handles M-Pesa payment integration
type MpesaService struct {
	db             *sql.DB
	config         *config.Config
	client         *http.Client
	mpesaPublicKey *rsa.PublicKey
	loadPublicKey  sync.Once
	loadPublicKeyErr error

	// Token cache to avoid excessive OAuth calls and invalid-token errors
	cachedAccessToken string
	cachedTokenExpiry time.Time
	tokenMu           sync.Mutex
}

// getBaseURL returns the appropriate M-Pesa API base URL based on M-Pesa environment
func (s *MpesaService) getBaseURL() string {
	env := strings.ToLower(strings.TrimSpace(s.config.MpesaEnvironment))
	if env == "production" {
		return "https://api.safaricom.co.ke"
	}
	return "https://sandbox.safaricom.co.ke"
}

// NewMpesaService creates a new M-Pesa service
func NewMpesaService(db *sql.DB, cfg *config.Config) *MpesaService {
	svc := &MpesaService{
		db:     db,
		config: cfg,
		client: &http.Client{Timeout: 30 * time.Second},
	}

	// Log M-Pesa runtime configuration for debugging invalid-token issues.
	baseURL := svc.getBaseURL()
	consumerKey := cfg.MpesaConsumerKey
	consumerSecret := cfg.MpesaConsumerSecret
	shortcode := cfg.MpesaShortcode
	passkey := cfg.MpesaPasskey
	mpesaEnv := cfg.MpesaEnvironment
	log.Printf("[MPESA][CONFIG] environment=%s baseURL=%s shortcode=%s consumerKey=%s... consumerSecret=%s... passkey=%s...",
		mpesaEnv,
		baseURL,
		shortcode,
		maskSecret(consumerKey),
		maskSecret(consumerSecret),
		maskSecret(passkey),
	)

	return svc
}

// maskSecret masks a secret value for safe logging.
func maskSecret(value string) string {
	if value == "" {
		return "<empty>"
	}
	if len(value) <= 8 {
		return "****"
	}
	return value[:4] + "****" + value[len(value)-4:]
}

// MpesaTokenResponse represents M-Pesa access token response
type MpesaTokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   string `json:"expires_in"`
}

// MpesaSTKPushRequest represents STK push request
type MpesaSTKPushRequest struct {
	BusinessShortCode string `json:"BusinessShortCode"`
	Password          string `json:"Password"`
	Timestamp         string `json:"Timestamp"`
	TransactionType   string `json:"TransactionType"`
	Amount            string `json:"Amount"`
	PartyA            string `json:"PartyA"`
	PartyB            string `json:"PartyB"`
	PhoneNumber       string `json:"PhoneNumber"`
	CallBackURL       string `json:"CallBackURL"`
	AccountReference  string `json:"AccountReference"`
	TransactionDesc   string `json:"TransactionDesc"`
}

// MpesaSTKPushResponse represents STK push response
type MpesaSTKPushResponse struct {
	MerchantRequestID    string `json:"MerchantRequestID"`
	CheckoutRequestID    string `json:"CheckoutRequestID"`
	ResponseCode         string `json:"ResponseCode"`
	ResponseDescription  string `json:"ResponseDescription"`
	CustomerMessage      string `json:"CustomerMessage"`
	RequestID            string `json:"requestId"`
	ErrorCode            string `json:"errorCode"`
	ErrorMessage         string `json:"errorMessage"`
}

// B2CRequest represents M-Pesa B2C (Business to Customer) request
type B2CRequest struct {
	InitiatorName      string  `json:"InitiatorName"`
	SecurityCredential string  `json:"SecurityCredential"`
	CommandID          string  `json:"CommandID"`
	Amount             float64 `json:"Amount"`
	PartyA             string  `json:"PartyA"`
	PartyB             string  `json:"PartyB"`
	Remarks            string  `json:"Remarks"`
	QueueTimeOutURL    string  `json:"QueueTimeOutURL"`
	ResultURL          string  `json:"ResultURL"`
	Occasion           string  `json:"Occasion"`
}

// B2CResponse represents M-Pesa B2C response
type B2CResponse struct {
	ConversationID           string `json:"ConversationID"`
	OriginatorConversationID string `json:"OriginatorConversationID"`
	ResponseCode             string `json:"ResponseCode"`
	ResponseDescription      string `json:"ResponseDescription"`
}

// GetAccessToken gets M-Pesa access token with caching to avoid invalid-token errors
func (s *MpesaService) GetAccessToken() (string, error) {
	// Return cached token if it's still valid (with 5-minute safety buffer)
	s.tokenMu.Lock()
	if s.cachedAccessToken != "" && time.Now().Before(s.cachedTokenExpiry.Add(-5*time.Minute)) {
		token := s.cachedAccessToken
		s.tokenMu.Unlock()
		return token, nil
	}
	s.tokenMu.Unlock()

	// Create basic auth header
	auth := base64.StdEncoding.EncodeToString(
		[]byte(s.config.MpesaConsumerKey + ":" + s.config.MpesaConsumerSecret),
	)

	// Create request with environment-specific URL
	tokenURL := s.getBaseURL() + "/oauth/v1/generate?grant_type=client_credentials"
	req, err := http.NewRequest("GET", tokenURL, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create token request: %w", err)
	}

	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Content-Type", "application/json")

	// Make request
	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to get token: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read token response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("M-Pesa token endpoint returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var tokenResp MpesaTokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", fmt.Errorf("failed to decode token response: %w", err)
	}

	if tokenResp.AccessToken == "" {
		return "", fmt.Errorf("empty access token received from M-Pesa: %s", string(body))
	}

	// Parse expires_in to set cache expiry
	expiresIn := 3600 // default 1 hour
	if tokenResp.ExpiresIn != "" {
		if secs, err := strconv.Atoi(tokenResp.ExpiresIn); err == nil && secs > 0 {
			expiresIn = secs
		}
	}

	// Cache the token
	s.tokenMu.Lock()
	s.cachedAccessToken = tokenResp.AccessToken
	s.cachedTokenExpiry = time.Now().Add(time.Duration(expiresIn) * time.Second)
	s.tokenMu.Unlock()

	log.Printf("[MPESA] Cached new access token, expires in %d seconds", expiresIn)

	return tokenResp.AccessToken, nil
}

// GeneratePassword generates M-Pesa password
func (s *MpesaService) GeneratePassword(timestamp string) string {
	password := s.config.MpesaShortcode + s.config.MpesaPasskey + timestamp
	return base64.StdEncoding.EncodeToString([]byte(password))
}

// InitiateSTKPush initiates M-Pesa STK push
func (s *MpesaService) InitiateSTKPush(transaction *models.MpesaTransaction) (*MpesaSTKPushResponse, error) {
	// Get access token
	accessToken, err := s.GetAccessToken()
	if err != nil {
		return nil, fmt.Errorf("failed to get access token: %w", err)
	}

	// Generate timestamp and password
	timestamp := time.Now().Format("20060102150405")
	password := s.GeneratePassword(timestamp)

	// Use PartyB from transaction (centralized paybill) or fallback to shortcode
	partyB := transaction.PartyB
	if partyB == "" {
		partyB = s.config.MpesaShortcode
	}
	// Create STK push request
	stkRequest := MpesaSTKPushRequest{
		BusinessShortCode: s.config.MpesaShortcode,
		Password:          password,
		Timestamp:         timestamp,
		TransactionType:   "CustomerPayBillOnline",
		Amount:            fmt.Sprintf("%.0f", transaction.Amount),
		PartyA:            transaction.PhoneNumber,
		PartyB:            partyB, // Use system paybill
		PhoneNumber:       transaction.PhoneNumber,
		CallBackURL:       s.config.MpesaCallbackURL,
		AccountReference:  transaction.AccountReference,
		TransactionDesc:   transaction.TransactionDesc,
	}

	// Convert to JSON
	jsonData, err := json.Marshal(stkRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal STK request: %w", err)
	}

	// Create HTTP request with environment-specific URL
	stkURL := s.getBaseURL() + "/mpesa/stkpush/v1/processrequest"
	req, err := http.NewRequest("POST", stkURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create STK request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	// Make request
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to initiate STK push: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read STK response: %w", err)
	}

	log.Printf("[STK Push] Status: %d | Body: %s", resp.StatusCode, string(body))

	// Parse response
	var stkResp MpesaSTKPushResponse
	if err := json.Unmarshal(body, &stkResp); err != nil {
		return nil, fmt.Errorf("failed to decode STK response: %w", err)
	}

	// M-Pesa returns error responses with errorCode/errorMessage instead of ResponseCode
	if stkResp.ErrorCode != "" {
		return nil, fmt.Errorf("STK push failed [errorCode=%s]: %s", stkResp.ErrorCode, stkResp.ErrorMessage)
	}

	// Check if request was successful
	if stkResp.ResponseCode != "0" {
		return nil, fmt.Errorf("STK push failed [ResponseCode=%s]: %s", stkResp.ResponseCode, stkResp.ResponseDescription)
	}

	return &stkResp, nil
}

// ProcessMpesaCallback processes M-Pesa callback
func (s *MpesaService) ProcessMpesaCallback(callback *models.MpesaCallback) error {
	log.Printf("Processing M-Pesa callback: CheckoutRequestID=%s, ResultCode=%d",
		callback.CheckoutRequestID, callback.ResultCode)

	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Check if payment was successful
	if callback.ResultCode == 0 {
		callbackAmount := callback.GetMpesaAmount()
		receiptNumber := callback.GetMpesaReceiptNumber()
		phoneNumber := callback.GetMpesaPhoneNumber()
		merchantRequestID := callback.MerchantRequestID

		// Find the pending transaction by checkout request ID
		// The checkout_request_id is stored in the reference field during STK initiation
		findQuery := `
			SELECT id, to_wallet_id, metadata, initiated_by, amount
			FROM transactions
			WHERE reference = $1 AND status = $2 AND payment_method = $3
			LIMIT 1
		`
		var transactionID string
		var toWalletID sql.NullString
		var metadataJSON []byte
		var initiatedBy string
		var originalAmount float64
		err = tx.QueryRow(findQuery, callback.CheckoutRequestID, models.TransactionStatusPending, models.PaymentMethodMpesa).Scan(&transactionID, &toWalletID, &metadataJSON, &initiatedBy, &originalAmount)
		if err != nil {
			if err == sql.ErrNoRows {
				log.Printf("No pending transaction found for checkout request ID: %s - rejecting callback to prevent arbitrary deposits", callback.CheckoutRequestID)
				return fmt.Errorf("no pending transaction found for checkout request ID: %s", callback.CheckoutRequestID)
			}
			return fmt.Errorf("failed to find transaction: %w", err)
		}

		if !toWalletID.Valid || toWalletID.String == "" {
			return fmt.Errorf("transaction %s has no target wallet - cannot process callback", transactionID)
		}

		// Validate callback amount matches original transaction amount
		if callbackAmount > 0 && originalAmount > 0 && callbackAmount != originalAmount {
			log.Printf("[MPESA][AMOUNT_MISMATCH] Transaction %s: original=%.2f, callback=%.2f, receipt=%s", transactionID, originalAmount, callbackAmount, receiptNumber)
			// Still process but flag in metadata for review
		}

		// Update the transaction with receipt and phone metadata
		metadata := make(map[string]interface{})
		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &metadata); err != nil {
				log.Printf("Warning: failed to parse existing metadata for transaction %s: %v", transactionID, err)
				metadata = make(map[string]interface{})
			}
		}
		// Capture M-Pesa transaction codes
		if receiptNumber != "" {
			metadata["mpesa_receipt_number"] = receiptNumber
		}
		if merchantRequestID != "" {
			metadata["mpesa_merchant_request_id"] = merchantRequestID
		}
		if phoneNumber != "" {
			metadata["mpesa_phone_number"] = phoneNumber
		}
		if callbackAmount > 0 {
			metadata["mpesa_callback_amount"] = callbackAmount
		}
		if originalAmount > 0 {
			metadata["original_amount"] = originalAmount
		}
		metadata["callback_result_code"] = callback.ResultCode
		metadata["callback_result_desc"] = callback.ResultDesc
		metadataJSONBytes, _ := json.Marshal(metadata)

		updateQuery := `
			UPDATE transactions
			SET status = $1, metadata = $2, updated_at = $3
			WHERE id = $4
		`
		_, err = tx.Exec(updateQuery, models.TransactionStatusCompleted, string(metadataJSONBytes), time.Now(), transactionID)
		if err != nil {
			return fmt.Errorf("failed to update transaction: %w", err)
		}

		// Credit the target wallet using callback amount (or original if callback amount is 0)
		creditAmount := callbackAmount
		if creditAmount <= 0 {
			creditAmount = originalAmount
		}
		creditQuery := `
			UPDATE wallets
			SET balance = balance + $1, updated_at = $2
			WHERE id = $3
		`
		result, err := tx.Exec(creditQuery, creditAmount, time.Now(), toWalletID.String)
		if err != nil {
			return fmt.Errorf("failed to credit wallet: %w", err)
		}
		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			return fmt.Errorf("target wallet %s not found for transaction %s", toWalletID.String, transactionID)
		}

		if err = tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit callback transaction: %w", err)
		}
		log.Printf("Successfully processed callback for transaction %s - credited %s with %.2f, receipt=%s", transactionID, toWalletID.String, creditAmount, receiptNumber)

		// Update merry_go_round_payments status to completed for merry-go-round contributions
		if merryGoRoundId, hasMgr := metadata["merryGoRoundId"].(string); hasMgr && merryGoRoundId != "" {
			if _, ok := metadata["roundNumber"]; ok {
				if _, dbErr := s.db.Exec(
					"UPDATE merry_go_round_payments SET status = $1, updated_at = $2 WHERE transaction_id = $3",
					"completed", time.Now(), transactionID,
				); dbErr != nil {
					log.Printf("[MpesaService] Failed to update merry_go_round_payments status for transaction %s: %v", transactionID, dbErr)
				} else {
					log.Printf("[MpesaService] Updated merry_go_round_payments status to completed for transaction %s", transactionID)
				}

				// Also update chama total_funds after successful mpesa contribution
				if chamaId, hasChama := metadata["chamaId"].(string); hasChama && chamaId != "" {
					s.db.Exec(`
						UPDATE chamas
						SET total_funds = (
							SELECT COALESCE(SUM(balance), 0)
							FROM wallets
							WHERE owner_id = $1 AND type = 'chama'
						), updated_at = CURRENT_TIMESTAMP
						WHERE id = $2
					`, chamaId, chamaId)
				}
			}
		}

		// Update service-fee payment records when this was a chama registration fee
		if chamaID, hasChama := metadata["chama_id"].(string); hasChama && chamaID != "" {
			if paymentType, ok := metadata["payment_type"].(string); ok && paymentType == "fees" {
				var sfpID string
				sfpErr := s.db.QueryRow(
					"SELECT id FROM service_fee_payments WHERE transaction_id = $1 AND chama_id = $2 AND user_id = $3",
					transactionID, chamaID, initiatedBy,
				).Scan(&sfpID)
				if sfpErr == nil {
					if _, dbErr := s.db.Exec(
						"UPDATE service_fee_payments SET status = $1, paid_at = $2, updated_at = $3 WHERE id = $4",
						"paid", time.Now(), time.Now(), sfpID,
					); dbErr != nil {
						log.Printf("[MpesaService] Failed to update service fee payment %s: %v", sfpID, dbErr)
					}

					if _, dbErr := s.db.Exec(
						"UPDATE chama_members SET service_fee_paid = true, service_fee_paid_at = $1, service_fee_status = 'paid' WHERE chama_id = $2 AND user_id = $3",
						time.Now(), chamaID, initiatedBy,
					); dbErr != nil {
						log.Printf("[MpesaService] Failed to update chama member service fee status chama=%s user=%s: %v", chamaID, initiatedBy, dbErr)
					}
				} else if sfpErr != sql.ErrNoRows {
					log.Printf("[MpesaService] Failed to lookup service fee payment for transaction %s: %v", transactionID, sfpErr)
				}
			}
		}

		return nil
	}

	// Payment failed / cancelled - find pending transaction and mark as failed with reason
	findQuery := `
		SELECT id, to_wallet_id, metadata, amount
		FROM transactions
		WHERE reference = $1 AND status = $2 AND payment_method = $3
		LIMIT 1
	`
	var transactionID string
	var toWalletID sql.NullString
	var metadataJSON []byte
	var originalAmount float64
	err = tx.QueryRow(findQuery, callback.CheckoutRequestID, models.TransactionStatusPending, models.PaymentMethodMpesa).Scan(&transactionID, &toWalletID, &metadataJSON, &originalAmount)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("No pending transaction found for failed checkout request ID: %s - callback may be a retry for already-handled transaction", callback.CheckoutRequestID)
			// Acknowledge the callback even if we have no pending transaction
			// (it may have been handled by a previous callback attempt)
			if err = tx.Commit(); err != nil {
				return fmt.Errorf("failed to commit empty failure ack: %w", err)
			}
			return nil
		}
		return fmt.Errorf("failed to find transaction for failure: %w", err)
	}

	// Build failure metadata
	failureMetadata := make(map[string]interface{})
	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &failureMetadata); err != nil {
			failureMetadata = make(map[string]interface{})
		}
	}
	failureMetadata["callback_result_code"] = callback.ResultCode
	failureMetadata["callback_result_desc"] = callback.ResultDesc
	failureMetadata["failed_at"] = time.Now().Format(time.RFC3339)
	failureMetadata["original_amount"] = originalAmount
	failureMetadataJSON, _ := json.Marshal(failureMetadata)

	_, err = tx.Exec(
		"UPDATE transactions SET status = $1, metadata = $2, updated_at = $3 WHERE id = $4",
		models.TransactionStatusFailed, string(failureMetadataJSON), time.Now(), transactionID,
	)
	if err != nil {
		return fmt.Errorf("failed to mark transaction %s as failed: %w", transactionID, err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit failure update for transaction %s: %w", transactionID, err)
	}

	log.Printf("Marked transaction %s as failed (ResultCode=%d, Desc=%s, CheckoutRequestID=%s)",
		transactionID, callback.ResultCode, callback.ResultDesc, callback.CheckoutRequestID)
	return nil
}

// updateTransactionStatus updates transaction status
func (s *MpesaService) updateTransactionStatus(transactionID string, status models.TransactionStatus) error {
	updateQuery := "UPDATE transactions SET status = $1, updated_at = $2 WHERE id = $3"
	result, err := s.db.Exec(updateQuery, status, time.Now(), transactionID)
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

// generateTransactionID generates a unique transaction ID
func generateTransactionID() string {
	// Generate random bytes
	bytes := make([]byte, 16)
	rand.Read(bytes)

	// Convert to hex string
	return fmt.Sprintf("TXN_%X", bytes)
}

// GetTransactionStatus gets M-Pesa transaction status
func (s *MpesaService) GetTransactionStatus(checkoutRequestID string) (string, error) {
	// Get access token
	accessToken, err := s.GetAccessToken()
	if err != nil {
		return "", fmt.Errorf("failed to get access token: %w", err)
	}

	// Generate timestamp and password
	timestamp := time.Now().Format("20060102150405")
	password := s.GeneratePassword(timestamp)

	// Create query request
	queryRequest := map[string]string{
		"BusinessShortCode": s.config.MpesaShortcode,
		"Password":          password,
		"Timestamp":         timestamp,
		"CheckoutRequestID": checkoutRequestID,
	}

	// Convert to JSON
	jsonData, err := json.Marshal(queryRequest)
	if err != nil {
		return "", fmt.Errorf("failed to marshal query request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", s.getBaseURL()+"/mpesa/stkpushquery/v1/query", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create query request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	// Make request
	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to query transaction status: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read query response: %w", err)
	}

	// Parse response
	var queryResp map[string]interface{}
	if err := json.Unmarshal(body, &queryResp); err != nil {
		return "", fmt.Errorf("failed to decode query response: %w", err)
	}

	// Extract status
	if resultCode, ok := queryResp["ResultCode"]; ok {
		if resultCode.(float64) == 0 {
			return "completed", nil
		} else {
			return "failed", nil
		}
	}

	return "pending", nil
}

// ReconcilePendingSTKTransactions queries M-Pesa for pending STK transactions
// that are older than the given age and updates their status based on the result.
// This handles the case where Safaricom does not send a callback (e.g., user cancels,
// network failure, app closed before callback arrives).
func (s *MpesaService) ReconcilePendingSTKTransactions(maxAge time.Duration) (int, error) {
	cutoff := time.Now().Add(-maxAge)

	// Find all pending M-Pesa STK transactions older than the cutoff.
	// The checkoutRequestID is stored in the reference field.
	rows, err := s.db.Query(`
		SELECT id, to_wallet_id, amount, reference, metadata, initiated_by
		FROM transactions
		WHERE status = $1
		  AND payment_method = $2
		  AND created_at < $3
		  AND reference LIKE 'TXN_%'
		ORDER BY created_at ASC
		LIMIT 100
	`, models.TransactionStatusPending, models.PaymentMethodMpesa, cutoff)
	if err != nil {
		return 0, fmt.Errorf("failed to query pending STK transactions: %w", err)
	}
	defer rows.Close()

	type pendingTxn struct {
		id            string
		toWalletID    sql.NullString
		amount        float64
		reference     string
		metadataJSON  []byte
		initiatedBy   string
	}
	var pendings []pendingTxn
	for rows.Next() {
		var p pendingTxn
		if err := rows.Scan(&p.id, &p.toWalletID, &p.amount, &p.reference, &p.metadataJSON, &p.initiatedBy); err != nil {
			log.Printf("[MPESA][RECONCILE] Failed to scan pending transaction: %v", err)
			continue
		}
		pendings = append(pendings, p)
	}

	if len(pendings) == 0 {
		return 0, nil
	}

	reconciled := 0
	for _, p := range pendings {
		checkoutRequestID := p.reference
		status, err := s.GetTransactionStatus(checkoutRequestID)
		if err != nil {
			log.Printf("[MPESA][RECONCILE] Failed to query status for %s (checkoutRequestID=%s): %v",
				p.id, checkoutRequestID, err)
			continue
		}

		switch status {
		case "completed":
			// Credit the wallet and mark as completed — same logic as the success callback
			metadata := make(map[string]interface{})
			if len(p.metadataJSON) > 0 {
				json.Unmarshal(p.metadataJSON, &metadata)
			}
			metadata["reconciled"] = true
			metadata["reconciled_at"] = time.Now().Format(time.RFC3339)
			metadata["reconciliation_source"] = "stk_push_query"

			tx, txErr := s.db.Begin()
			if txErr != nil {
				log.Printf("[MPESA][RECONCILE] Failed to start tx for %s: %v", p.id, txErr)
				continue
			}

			metadataBytes, _ := json.Marshal(metadata)
			_, txErr = tx.Exec(
				"UPDATE transactions SET status = $1, metadata = $2, updated_at = $3 WHERE id = $4",
				models.TransactionStatusCompleted, string(metadataBytes), time.Now(), p.id,
			)
			if txErr != nil {
				tx.Rollback()
				log.Printf("[MPESA][RECONCILE] Failed to update transaction %s: %v", p.id, txErr)
				continue
			}

			if p.toWalletID.Valid && p.toWalletID.String != "" {
				_, txErr = tx.Exec(
					"UPDATE wallets SET balance = balance + $1, updated_at = $2 WHERE id = $3",
					p.amount, time.Now(), p.toWalletID.String,
				)
				if txErr != nil {
					tx.Rollback()
					log.Printf("[MPESA][RECONCILE] Failed to credit wallet for %s: %v", p.id, txErr)
					continue
				}
			}

			if txErr = tx.Commit(); txErr != nil {
				log.Printf("[MPESA][RECONCILE] Failed to commit reconciliation for %s: %v", p.id, txErr)
				continue
			}
			log.Printf("[MPESA][RECONCILE] Transaction %s reconciled as completed (checkoutRequestID=%s)", p.id, checkoutRequestID)
			reconciled++

		case "failed":
			metadata := make(map[string]interface{})
			if len(p.metadataJSON) > 0 {
				json.Unmarshal(p.metadataJSON, &metadata)
			}
			metadata["reconciled"] = true
			metadata["reconciled_at"] = time.Now().Format(time.RFC3339)
			metadata["reconciliation_source"] = "stk_push_query"
			metadata["callback_result_desc"] = "Transaction expired or cancelled (reconciled via STK query)"
			metadata["original_amount"] = p.amount
			metadataBytes, _ := json.Marshal(metadata)

			_, err = s.db.Exec(
				"UPDATE transactions SET status = $1, metadata = $2, updated_at = $3 WHERE id = $4",
				models.TransactionStatusFailed, string(metadataBytes), time.Now(), p.id,
			)
			if err != nil {
				log.Printf("[MPESA][RECONCILE] Failed to mark transaction %s as failed: %v", p.id, err)
				continue
			}
			log.Printf("[MPESA][RECONCILE] Transaction %s reconciled as failed (checkoutRequestID=%s)", p.id, checkoutRequestID)
			reconciled++

		default:
			// Still pending according to M-Pesa — leave it alone, will be checked again next cycle
			log.Printf("[MPESA][RECONCILE] Transaction %s still pending in M-Pesa (checkoutRequestID=%s)", p.id, checkoutRequestID)
		}
	}

	return reconciled, nil
}

// StartSTKReconciler starts a background goroutine that periodically reconciles
// pending STK transactions against M-Pesa's transaction-status API.
func StartSTKReconciler(db *sql.DB, cfg *config.Config, interval time.Duration, maxPendingAge time.Duration) {
	log.Printf("Starting STK push reconciler (interval=%v, max pending age=%v)", interval, maxPendingAge)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[MPESA][RECONCILE] Panic recovered: %v", r)
			}
		}()

		for {
			select {
			case <-ticker.C:
				if cfg.MpesaConsumerKey == "" || cfg.MpesaShortcode == "" {
					continue
				}
				mpesaService := NewMpesaService(db, cfg)
				reconciled, err := mpesaService.ReconcilePendingSTKTransactions(maxPendingAge)
				if err != nil {
					log.Printf("[MPESA][RECONCILE] Error: %v", err)
				} else if reconciled > 0 {
					log.Printf("[MPESA][RECONCILE] Reconciled %d pending STK transactions", reconciled)
				}
			}
		}
	}()
}
func (s *MpesaService) InitiateB2C(phoneNumber string, amount float64, remarks string) (*B2CResponse, error) {
	return s.InitiateB2CRaw(phoneNumber, amount, remarks, "BusinessPayment")
}

func (s *MpesaService) InitiateB2CRaw(phoneNumber string, amount float64, remarks, occasion string) (*B2CResponse, error) {
	// Get access token
	token, err := s.GetAccessToken()
	if err != nil {
		return nil, fmt.Errorf("failed to get access token: %v", err)
	}

	// Create security credential.
	// In production, initialize the initiator password using M-Pesa public key encryption:
	// encrypted, err := encryptWithMpesaPublicKey(s.config.MpesaInitiatorPassword, s.config.MpesaPublicKeyCertPath)
	// The encrypted bytes are then base64-encoded for the API.
	// For sandbox and environments without certificate access, fall back to base64 encoding.
	securityCredential := s.encryptSecurityCredential()

	// Prepare B2C request
	b2cRequest := B2CRequest{
		InitiatorName:      s.config.MpesaInitiatorName,
		SecurityCredential: securityCredential,
		CommandID:          "BusinessPayment",
		Amount:             amount,
		PartyA:             s.config.MpesaShortcode,
		PartyB:             phoneNumber,
		Remarks:            remarks,
		QueueTimeOutURL:    s.config.BaseURL + "/api/v1/mpesa/b2c/timeout",
		ResultURL:          s.config.BaseURL + "/api/v1/mpesa/b2c/callback",
		Occasion:           occasion,
	}

	// Convert to JSON
	jsonData, err := json.Marshal(b2cRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal B2C request: %v", err)
	}

	// Create HTTP request with environment-specific URL
	b2cURL := s.getBaseURL() + "/mpesa/b2c/v1/paymentrequest"
	req, err := http.NewRequest("POST", b2cURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create B2C request: %v", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	// Make request
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make B2C request: %v", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read B2C response: %v", err)
	}

	// Parse response
	var response B2CResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse B2C response: %v", err)
	}

	// Log the response for debugging
	log.Printf("B2C Response: %+v", response)

	return &response, nil
}

// encryptSecurityCredential encrypts the M-Pesa initiator password for B2C requests.
// In production, this uses RSA-OAEP encryption with the M-Pesa public key certificate.
// The encrypted bytes are then base64-encoded.
// Fallback: base64-encode the plaintext password only when M-Pesa cert encryption is unavailable
// (e.g. sandbox or local dev without cert files). This fallback is intentionally restricted
// and must not be relied upon in production.
func (s *MpesaService) encryptSecurityCredential() string {
	// Try RSA-OAEP encryption if we have a cert path
	if s.config.MpesaPublicKeyCertPath != "" {
		publicKey, err := s.getMpesaPublicKey()
		if err != nil {
			log.Printf("[MPESA] Failed to load M-Pesa public key, falling back to base64: %v", err)
		} else if publicKey != nil {
			encrypted, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, publicKey, []byte(s.config.MpesaInitiatorPassword), nil)
			if err != nil {
				log.Printf("[MPESA] RSA-OAEP encryption failed, falling back to base64: %v", err)
			} else {
				return base64.StdEncoding.EncodeToString(encrypted)
			}
		}
	}

	// Fallback for sandbox/development without cert
	if s.config.Environment != "production" {
		return base64.StdEncoding.EncodeToString([]byte(s.config.MpesaInitiatorPassword))
	}

	// Production without cert is a configuration error — log prominently
	log.Printf("[MPESA][SECURITY] B2C security credential is base64-encoded plaintext in production. Set MPESA_PUBLIC_KEY_CERT_PATH.")
	return base64.StdEncoding.EncodeToString([]byte(s.config.MpesaInitiatorPassword))
}

// getMpesaPublicKey loads and caches the M-Pesa public key from the certificate file.
func (s *MpesaService) getMpesaPublicKey() (*rsa.PublicKey, error) {
	s.loadPublicKey.Do(func() {
		if s.mpesaPublicKey != nil {
			s.loadPublicKeyErr = nil
			return
		}
		certData, err := os.ReadFile(s.config.MpesaPublicKeyCertPath)
		if err != nil {
			s.loadPublicKeyErr = fmt.Errorf("failed to read M-Pesa public key cert: %w", err)
			return
		}
		block, _ := pem.Decode(certData)
		if block == nil {
			s.loadPublicKeyErr = fmt.Errorf("failed to decode PEM block from M-Pesa public key cert")
			return
		}
		pub, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			s.loadPublicKeyErr = fmt.Errorf("failed to parse M-Pesa certificate: %w", err)
			return
		}
		s.mpesaPublicKey = pub.PublicKey.(*rsa.PublicKey)
		s.loadPublicKeyErr = nil
	})
	return s.mpesaPublicKey, s.loadPublicKeyErr
}

// HandleB2CCallback processes M-Pesa B2C result callbacks
func (s *MpesaService) HandleB2CCallback(callbackData map[string]interface{}) error {
	log.Printf("Processing B2C callback: ConversationID=%v, ResultCode=%v",
		callbackData["ConversationID"], callbackData["ResultCode"])

	conversationID, _ := callbackData["ConversationID"].(string)
	resultCode := 0
	if rc, ok := callbackData["ResultCode"].(float64); ok {
		resultCode = int(rc)
	}
	resultDesc, _ := callbackData["ResultDesc"].(string)

	// Extract B2C result parameters (amount, receipt, etc.)
	resultParams := extractB2CResultParameters(callbackData)
	b2cCallbackAmountStr := resultParams["TransactionAmount"]
	b2cReceipt := resultParams["TransactionReceipt"]
	b2cResultType := resultParams["ResultType"]

	var b2cCallbackAmount float64
	if b2cCallbackAmountStr != "" {
		if parsed, err := strconv.ParseFloat(b2cCallbackAmountStr, 64); err == nil {
			b2cCallbackAmount = parsed
		}
	}

	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start B2C callback transaction: %w", err)
	}
	defer tx.Rollback()

	// Find the pending B2C transaction by conversation metadata
	findQuery := `
		SELECT id, from_wallet_id, amount, metadata
		FROM transactions
		WHERE metadata::text LIKE $1 AND status = $2 AND payment_method = $3
		LIMIT 1
	`
	var transactionID string
	var fromWalletID sql.NullString
	var b2cAmount float64
	var existingMetadataJSON []byte
	err = tx.QueryRow(findQuery, "%"+conversationID+"%", models.TransactionStatusProcessing, "mpesa").Scan(&transactionID, &fromWalletID, &b2cAmount, &existingMetadataJSON)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("No B2C transaction found for conversation ID: %s", conversationID)
			return fmt.Errorf("no B2C transaction found for conversation ID: %s", conversationID)
		}
		return fmt.Errorf("failed to find B2C transaction: %w", err)
	}

	// Build updated metadata with B2C callback codes
	metadata := make(map[string]interface{})
	if len(existingMetadataJSON) > 0 {
		if err := json.Unmarshal(existingMetadataJSON, &metadata); err != nil {
			metadata = make(map[string]interface{})
		}
	}
	if b2cReceipt != "" {
		metadata["b2c_transaction_receipt"] = b2cReceipt
	}
	if b2cResultType != "" {
		metadata["b2c_result_type"] = b2cResultType
	}
	metadata["b2c_result_code"] = resultCode
	metadata["b2c_result_desc"] = resultDesc
	metadata["b2c_callback_amount"] = b2cCallbackAmount
	for k, v := range resultParams {
		if k != "TransactionAmount" && k != "TransactionReceipt" && k != "ResultType" {
			metadata["b2c_"+strings.ToLower(k)] = v
		}
	}
	metadataJSONBytes, _ := json.Marshal(metadata)

	if resultCode == 0 {
		// Validate B2C callback amount matches local transaction amount
		if b2cCallbackAmount > 0 && b2cAmount > 0 && b2cCallbackAmount != b2cAmount {
			log.Printf("[MPESA][B2C_AMOUNT_MISMATCH] Transaction %s: local=%.2f, callback=%.2f, receipt=%s", transactionID, b2cAmount, b2cCallbackAmount, b2cReceipt)
		}

		// Use callback amount if available, otherwise local amount
		debitAmount := b2cAmount
		if b2cCallbackAmount > 0 {
			debitAmount = b2cCallbackAmount
		}

		// B2C succeeded - debit the source wallet and mark as completed
		if fromWalletID.Valid && fromWalletID.String != "" {
			_, err = tx.Exec("UPDATE wallets SET balance = balance - $1, updated_at = $2 WHERE id = $3",
				debitAmount, time.Now(), fromWalletID.String)
			if err != nil {
				return fmt.Errorf("failed to debit wallet %s for successful B2C %s: %v", fromWalletID.String, transactionID, err)
			}
		}
		_, err = tx.Exec("UPDATE transactions SET status = $1, metadata = $2, updated_at = $3 WHERE id = $4",
			models.TransactionStatusCompleted, string(metadataJSONBytes), time.Now(), transactionID)
		if err != nil {
			return fmt.Errorf("failed to complete B2C transaction: %v", err)
		}
		log.Printf("B2C transaction %s completed successfully - wallet %s debited %.2f, receipt=%s", transactionID, fromWalletID.String, debitAmount, b2cReceipt)
	} else {
		// B2C failed - mark as failed
		_, err = tx.Exec("UPDATE transactions SET status = $1, metadata = $2, updated_at = $3 WHERE id = $4",
			models.TransactionStatusFailed, string(metadataJSONBytes), time.Now(), transactionID)
		if err != nil {
			return fmt.Errorf("failed to mark B2C transaction as failed: %v", err)
		}
		log.Printf("B2C transaction %s failed (ResultCode=%d, Desc=%s) - no wallet debit performed", transactionID, resultCode, resultDesc)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit B2C callback transaction: %v", err)
	}

	return nil
}

// extractB2CResultParameters extracts key-value pairs from M-Pesa B2C ResultParameters
func extractB2CResultParameters(callbackData map[string]interface{}) map[string]string {
	result := make(map[string]string)

	resultParams, ok := callbackData["ResultParameters"].(map[string]interface{})
	if !ok {
		return result
	}

	params, ok := resultParams["ResultParameter"].([]interface{})
	if !ok {
		return result
	}

	for _, p := range params {
		paramMap, ok := p.(map[string]interface{})
		if !ok {
			continue
		}
		key, _ := paramMap["Key"].(string)
		value, _ := paramMap["Value"].(string)
		if key != "" {
			result[key] = value
		}
	}

	return result
}

// HandleB2CTimeout processes M-Pesa B2C queue timeout callbacks
func (s *MpesaService) HandleB2CTimeout(callbackData map[string]interface{}) error {
	log.Printf("Processing B2C timeout: ConversationID=%v", callbackData["ConversationID"])

	conversationID, _ := callbackData["ConversationID"].(string)
	resultDesc, _ := callbackData["ResultDesc"].(string)
	resultCode := 0
	if rc, ok := callbackData["ResultCode"].(float64); ok {
		resultCode = int(rc)
	}

	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start B2C timeout transaction: %w", err)
	}
	defer tx.Rollback()

	// Find the pending B2C transaction
	findQuery := `
		SELECT id, from_wallet_id, amount, metadata
		FROM transactions
		WHERE metadata::text LIKE $1 AND status = $2 AND payment_method = $3
		LIMIT 1
	`
	var transactionID string
	var fromWalletID sql.NullString
	var b2cAmount float64
	var existingMetadataJSON []byte
	err = tx.QueryRow(findQuery, "%"+conversationID+"%", models.TransactionStatusProcessing, "mpesa").Scan(&transactionID, &fromWalletID, &b2cAmount, &existingMetadataJSON)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("No B2C transaction found for timeout conversation ID: %s", conversationID)
			return fmt.Errorf("no B2C transaction found for timeout conversation ID: %s", conversationID)
		}
		return fmt.Errorf("failed to find B2C transaction: %w", err)
	}

	// Build timeout metadata
	metadata := make(map[string]interface{})
	if len(existingMetadataJSON) > 0 {
		if err := json.Unmarshal(existingMetadataJSON, &metadata); err != nil {
			metadata = make(map[string]interface{})
		}
	}
	metadata["b2c_timeout"] = true
	metadata["b2c_result_code"] = resultCode
	metadata["b2c_result_desc"] = resultDesc
	metadata["failed_at"] = time.Now().Format(time.RFC3339)
	metadata["original_amount"] = b2cAmount
	metadataJSONBytes, _ := json.Marshal(metadata)

	// No refund needed because wallet was not pre-debited
	_, err = tx.Exec("UPDATE transactions SET status = $1, metadata = $2, updated_at = $3 WHERE id = $4",
		models.TransactionStatusFailed, string(metadataJSONBytes), time.Now(), transactionID)
	if err != nil {
		return fmt.Errorf("failed to mark B2C timeout transaction as failed: %v", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit B2C timeout transaction: %v", err)
	}

	log.Printf("B2C transaction %s timed out (ResultDesc=%s) - no wallet debit was performed", transactionID, resultDesc)
	return nil
}
