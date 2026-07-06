package services

import (
	"bytes"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"vaultke-backend/config"
	"vaultke-backend/internal/models"
)

// MpesaService handles M-Pesa payment integration
type MpesaService struct {
	db     *sql.DB
	config *config.Config
	client *http.Client
}

// getBaseURL returns the appropriate M-Pesa API base URL based on environment
func (s *MpesaService) getBaseURL() string {
	if s.config.Environment == "production" {
		return "https://api.safaricom.co.ke"
	}
	return "https://sandbox.safaricom.co.ke"
}

// NewMpesaService creates a new M-Pesa service
func NewMpesaService(db *sql.DB, cfg *config.Config) *MpesaService {
	return &MpesaService{
		db:     db,
		config: cfg,
		client: &http.Client{Timeout: 30 * time.Second},
	}
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
	MerchantRequestID   string `json:"MerchantRequestID"`
	CheckoutRequestID   string `json:"CheckoutRequestID"`
	ResponseCode        string `json:"ResponseCode"`
	ResponseDescription string `json:"ResponseDescription"`
	CustomerMessage     string `json:"CustomerMessage"`
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

// GetAccessToken gets M-Pesa access token
func (s *MpesaService) GetAccessToken() (string, error) {
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

	// Parse response
	var tokenResp MpesaTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", fmt.Errorf("failed to decode token response: %w", err)
	}

	if tokenResp.AccessToken == "" {
		return "", fmt.Errorf("empty access token received")
	}

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
		amount := callback.GetMpesaAmount()
		receiptNumber := callback.GetMpesaReceiptNumber()
		phoneNumber := callback.GetMpesaPhoneNumber()

		// Find the pending transaction by checkout request ID
		// The checkout_request_id is stored in the reference field during STK initiation
		findQuery := `
			SELECT id, to_wallet_id, metadata, initiated_by
			FROM transactions
			WHERE reference = $1 AND status = $2 AND payment_method = $3
			LIMIT 1
		`
		var transactionID string
		var toWalletID sql.NullString
		var metadataJSON sql.NullString
		var initiatedBy string
		err = tx.QueryRow(findQuery, callback.CheckoutRequestID, models.TransactionStatusPending, models.PaymentMethodMpesa).Scan(&transactionID, &toWalletID, &metadataJSON, &initiatedBy)
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

		// Update the transaction with receipt and phone metadata
		metadata := make(map[string]interface{})
		if metadataJSON.Valid && metadataJSON.String != "" {
			metadata["mpesa_receipt_number"] = receiptNumber
			metadata["mpesa_phone_number"] = phoneNumber
			if err := json.Unmarshal([]byte(metadataJSON.String), &metadata); err != nil {
				log.Printf("Warning: failed to parse existing metadata for transaction %s: %v", transactionID, err)
				metadata = map[string]interface{}{
					"mpesa_receipt_number": receiptNumber,
					"mpesa_phone_number":   phoneNumber,
				}
			} else {
				metadata["mpesa_receipt_number"] = receiptNumber
				metadata["mpesa_phone_number"] = phoneNumber
			}
		}
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

		// Credit the target wallet
		creditQuery := `
			UPDATE wallets
			SET balance = balance + $1, updated_at = $2
			WHERE id = $3
		`
		result, err := tx.Exec(creditQuery, amount, time.Now(), toWalletID.String)
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
		log.Printf("Successfully processed callback for transaction %s - credited %s with %.2f", transactionID, toWalletID.String, amount)

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
							SELECT COALESCE(balance, 0)
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

	// Payment failed - find and mark transaction as failed
	findQuery := `SELECT id FROM transactions WHERE reference = $1 AND payment_method = $2 LIMIT 1`
	var transactionID string
	err = tx.QueryRow(findQuery, callback.CheckoutRequestID, models.PaymentMethodMpesa).Scan(&transactionID)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("No transaction found for failed checkout request ID: %s", callback.CheckoutRequestID)
			return fmt.Errorf("no transaction found for failed checkout request ID: %s", callback.CheckoutRequestID)
		}
		return fmt.Errorf("failed to find transaction: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit failed transaction update: %w", err)
	}

	err = s.updateTransactionStatus(transactionID, models.TransactionStatusFailed)
	if err != nil {
		return fmt.Errorf("failed to update failed transaction status: %w", err)
	}
	log.Printf("Marked transaction %s as failed for checkout request ID: %s", transactionID, callback.CheckoutRequestID)
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
	req, err := http.NewRequest("POST", "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query", bytes.NewBuffer(jsonData))
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

// InitiateB2C initiates a Business to Customer (B2C) transaction for withdrawals
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
// In production, this must use RSA encryption with the M-Pesa public key certificate
// (https://developer.safaricom.co.ke/docs/security-credentials).
// The encrypted bytes are then base64-encoded.
// Fallback: base64-encode the plaintext password only when M-Pesa cert encryption is unavailable
// (e.g. sandbox or local dev without cert files). This fallback is intentionally restricted
// and must not be relied upon in production.
func (s *MpesaService) encryptSecurityCredential() string {
	// TODO: replace with RSA-OAEP encryption using M-Pesa public key certificate.
	// encrypted, _ := rsa.EncryptOAEP(sha256.New(), rand.Reader, mpesaPublicKey, []byte(s.config.MpesaInitiatorPassword), nil)
	// return base64.StdEncoding.EncodeToString(encrypted)
	return base64.StdEncoding.EncodeToString([]byte(s.config.MpesaInitiatorPassword))
}

// HandleB2CCallback processes M-Pesa B2C result callbacks
func (s *MpesaService) HandleB2CCallback(callbackData map[string]interface{}) error {
	log.Printf("Processing B2C callback: %+v", callbackData)

	conversationID, _ := callbackData["ConversationID"].(string)
	resultCode := 0
	if rc, ok := callbackData["ResultCode"].(float64); ok {
		resultCode = int(rc)
	}

	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start B2C callback transaction: %w", err)
	}
	defer tx.Rollback()

	// Find the pending B2C transaction by conversation metadata
	findQuery := `
		SELECT id, from_wallet_id, amount
		FROM transactions
		WHERE metadata::text LIKE $1 AND status = $2 AND payment_method = $3
		LIMIT 1
	`
	var transactionID string
	var fromWalletID sql.NullString
	var b2cAmount float64
	err = tx.QueryRow(findQuery, "%"+conversationID+"%", models.TransactionStatusProcessing, "mpesa").Scan(&transactionID, &fromWalletID, &b2cAmount)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("No B2C transaction found for conversation ID: %s", conversationID)
			return fmt.Errorf("no B2C transaction found for conversation ID: %s", conversationID)
		}
		return fmt.Errorf("failed to find B2C transaction: %w", err)
	}

	if resultCode == 0 {
		// B2C succeeded - debit the source wallet and mark as completed
		if fromWalletID.Valid && fromWalletID.String != "" {
			_, err = tx.Exec("UPDATE wallets SET balance = balance - $1, updated_at = $2 WHERE id = $3",
				b2cAmount, time.Now(), fromWalletID.String)
			if err != nil {
				return fmt.Errorf("failed to debit wallet %s for successful B2C %s: %v", fromWalletID.String, transactionID, err)
			}
		}
		_, err = tx.Exec("UPDATE transactions SET status = $1, updated_at = $2 WHERE id = $3",
			models.TransactionStatusCompleted, time.Now(), transactionID)
		if err != nil {
			return fmt.Errorf("failed to complete B2C transaction: %v", err)
		}
		log.Printf("B2C transaction %s completed successfully - wallet %s debited", transactionID, fromWalletID.String)
	} else {
		// B2C failed - no refund needed because wallet was not pre-debited
		_, err = tx.Exec("UPDATE transactions SET status = $1, updated_at = $2 WHERE id = $3",
			models.TransactionStatusFailed, time.Now(), transactionID)
		if err != nil {
			return fmt.Errorf("failed to mark B2C transaction as failed: %v", err)
		}
		log.Printf("B2C transaction %s failed - no wallet debit was performed", transactionID)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit B2C callback transaction: %v", err)
	}

	return nil
}

// HandleB2CTimeout processes M-Pesa B2C queue timeout callbacks
func (s *MpesaService) HandleB2CTimeout(callbackData map[string]interface{}) error {
	log.Printf("Processing B2C timeout: %+v", callbackData)

	conversationID, _ := callbackData["ConversationID"].(string)

	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start B2C timeout transaction: %w", err)
	}
	defer tx.Rollback()

	// Find the pending B2C transaction
	findQuery := `
		SELECT id, from_wallet_id, amount
		FROM transactions
		WHERE metadata::text LIKE $1 AND status = $2 AND payment_method = $3
		LIMIT 1
	`
	var transactionID string
	var fromWalletID sql.NullString
	var b2cAmount float64
	err = tx.QueryRow(findQuery, "%"+conversationID+"%", models.TransactionStatusProcessing, "mpesa").Scan(&transactionID, &fromWalletID, &b2cAmount)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("No B2C transaction found for timeout conversation ID: %s", conversationID)
			return fmt.Errorf("no B2C transaction found for timeout conversation ID: %s", conversationID)
		}
		return fmt.Errorf("failed to find B2C transaction: %w", err)
	}

	// No refund needed because wallet was not pre-debited
	_, err = tx.Exec("UPDATE transactions SET status = $1, updated_at = $2 WHERE id = $3",
		models.TransactionStatusFailed, time.Now(), transactionID)
	if err != nil {
		return fmt.Errorf("failed to mark B2C timeout transaction as failed: %v", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit B2C timeout transaction: %v", err)
	}

	log.Printf("B2C transaction %s timed out - no wallet debit was performed", transactionID)
	return nil
}
