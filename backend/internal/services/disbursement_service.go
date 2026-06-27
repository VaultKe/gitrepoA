package services

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"

	"vaultke-backend/config"
	"vaultke-backend/internal/models"
)

type DisbursementService struct {
	db             *sql.DB
	mpesaService   *MpesaService
	walletService  *WalletService
	paybillService *PaybillTrackingService
}

func NewDisbursementService(db *sql.DB, cfg *config.Config) *DisbursementService {
	return &DisbursementService{
		db:             db,
		mpesaService:   NewMpesaService(db, cfg),
		walletService:  NewWalletService(db),
		paybillService: NewPaybillTrackingService(db),
	}
}

func (s *DisbursementService) DisburseToChamaWallet(chamaID, subwalletType string, amount float64, recipientUserID string, description string) (*models.Transaction, error) {
	wallet, err := s.paybillService.GetChamaSubWallet(chamaID, models.ChamaWalletType(subwalletType))
	if err != nil {
		return nil, fmt.Errorf("failed to get chama sub-wallet: %w", err)
	}

	if !wallet.CanWithdraw(amount) {
		return nil, fmt.Errorf("insufficient balance in %s wallet", subwalletType)
	}

	var userPhone sql.NullString
	err = s.db.QueryRow(
		"SELECT phone FROM users WHERE id = $1",
		recipientUserID,
	).Scan(&userPhone)
	if err != nil {
		return nil, fmt.Errorf("failed to get recipient phone: %w", err)
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	transactionID := "TXN_" + uuid.New().String()
	now := time.Now()
	reference := fmt.Sprintf("DISB-%s-%s-%d", chamaID, subwalletType, now.Unix())

	_, err = tx.Exec(`
		INSERT INTO transactions (
			id, from_wallet_id, to_wallet_id, chama_id, member_id, type, status, amount,
			currency, description, reference, payment_method, initiated_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, 'withdrawal', 'pending', $6, 'KES', $7, $8, 'wallet_transfer', $9, $10, $11)
	`, transactionID, wallet.ID, nil, chamaID, recipientUserID, amount, description, reference, chamaID, now, now)
	if err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	_, err = tx.Exec(
		"UPDATE wallets SET balance = balance - $1 WHERE id = $2",
		amount, wallet.ID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to debit chama wallet: %w", err)
	}

	userWalletQuery := "SELECT id FROM wallets WHERE owner_id = $1 AND type = 'personal'"
	var userWalletID string
	err = tx.QueryRow(userWalletQuery, recipientUserID).Scan(&userWalletID)
	if err != nil {
		if err == sql.ErrNoRows {
			userWalletID = "wallet-" + recipientUserID
			_, err = tx.Exec(`
				INSERT INTO wallets (id, owner_id, type, balance, currency, is_active, is_locked, created_at, updated_at)
				VALUES ($1, $2, 'personal', 0, 'KES', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			`, userWalletID, recipientUserID)
			if err != nil {
				return nil, fmt.Errorf("failed to create user wallet: %w", err)
			}
		} else {
			return nil, fmt.Errorf("failed to get user wallet: %w", err)
		}
	}

	_, err = tx.Exec(
		"UPDATE wallets SET balance = balance + $1 WHERE id = $2",
		amount, userWalletID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to credit user wallet: %w", err)
	}

	_, err = tx.Exec(
		"UPDATE transactions SET status = 'completed', to_wallet_id = $1, updated_at = $2 WHERE id = $3",
		userWalletID, now, transactionID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update transaction status: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("Disbursed KES %.2f from chama %s %s wallet to user %s", amount, chamaID, subwalletType, recipientUserID)

	return &models.Transaction{
		ID:           transactionID,
		FromWalletID: &wallet.ID,
		ChamaID:      chamaID,
		MemberID:     recipientUserID,
		Type:         models.TransactionTypeWithdrawal,
		Status:       models.TransactionStatusCompleted,
		Amount:       amount,
		Currency:     "KES",
		Description:  &description,
		Reference:    &reference,
		CreatedAt:    now,
		UpdatedAt:    now,
	}, nil
}

func (s *DisbursementService) DisburseFromUserWallet(userWalletID string, amount float64, recipientPhone, description string) (*models.Transaction, error) {
	if userWalletID == "" || recipientPhone == "" {
		return nil, fmt.Errorf("wallet ID and recipient phone are required")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	var balance float64
	err = tx.QueryRow("SELECT balance FROM wallets WHERE id = $1", userWalletID).Scan(&balance)
	if err != nil {
		return nil, fmt.Errorf("failed to get wallet balance: %w", err)
	}

	if balance < amount {
		return nil, fmt.Errorf("insufficient balance in user wallet")
	}

	_, err = tx.Exec("UPDATE wallets SET balance = balance - $1 WHERE id = $2", amount, userWalletID)
	if err != nil {
		return nil, fmt.Errorf("failed to debit user wallet: %w", err)
	}

	transactionID := "TXN_" + uuid.New().String()
	now := time.Now()
	reference := fmt.Sprintf("B2C-%d", now.Unix())

	_, err = tx.Exec(`
		INSERT INTO transactions (
			id, from_wallet_id, type, status, amount, currency, description,
			reference, payment_method, initiated_by, created_at, updated_at
		) VALUES ($1, $2, 'withdrawal', 'pending', $3, 'KES', $4, $5, 'mpesa', $6, $7, $8)
	`, transactionID, userWalletID, amount, description, reference, userWalletID, now, now)
	if err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	b2cResp, err := s.mpesaService.InitiateB2C(recipientPhone, amount, description)
	if err != nil {
		_, _ = tx.Exec("UPDATE transactions SET status = 'failed', updated_at = $1 WHERE id = $2", now, transactionID)
		return nil, fmt.Errorf("failed to initiate B2C payment: %w", err)
	}

	_, err = tx.Exec(
		"UPDATE transactions SET status = 'processing', metadata = $1, updated_at = $2 WHERE id = $3",
		fmt.Sprintf(`{"conversation_id": "%s", "originator_conversation_id": "%s"}`, b2cResp.ConversationID, b2cResp.OriginatorConversationID),
		now, transactionID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update transaction: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("B2C disbursement initiated for KES %.2f to phone %s", amount, recipientPhone)

	return &models.Transaction{
		ID:           transactionID,
		FromWalletID: &userWalletID,
		Type:         models.TransactionTypeWithdrawal,
		Status:       models.TransactionStatusProcessing,
		Amount:       amount,
		Currency:     "KES",
		Description:  &description,
		Reference:    &reference,
		CreatedAt:    now,
		UpdatedAt:    now,
	}, nil
}

func (s *DisbursementService) DisburseLoan(loanID string) error {
	loan, err := s.getLoanByID(loanID)
	if err != nil {
		return fmt.Errorf("failed to get loan: %w", err)
	}

	if models.LoanStatus(loan.Status) != models.LoanStatusApproved {
		return fmt.Errorf("loan is not approved for disbursement")
	}

	var borrowerPhone string
	err = s.db.QueryRow("SELECT phone FROM users WHERE id = $1", loan.BorrowerID).Scan(&borrowerPhone)
	if err != nil {
		return fmt.Errorf("failed to get borrower phone: %w", err)
	}

	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	_, err = tx.Exec("UPDATE loans SET status = 'active', disbursed_at = CURRENT_TIMESTAMP WHERE id = $1", loanID)
	if err != nil {
		return fmt.Errorf("failed to update loan status: %w", err)
	}

	chamaWalletID := fmt.Sprintf("wallet-%s-contribution", loan.ChamaID)
	_, err = tx.Exec(
		"UPDATE wallets SET balance = balance - $1 WHERE owner_id = $2 AND type = 'chama' AND (subwallet_type = 'contribution' OR id = $3)",
		loan.TotalAmount, loan.ChamaID, chamaWalletID,
	)
	if err != nil {
		return fmt.Errorf("failed to debit chama wallet: %w", err)
	}

	transactionID := "TXN_" + uuid.New().String()
	now := time.Now()
	reference := fmt.Sprintf("LOAN-DISB-%s", loanID)

	_, err = tx.Exec(`
		INSERT INTO transactions (
			id, from_wallet_id, to_wallet_id, chama_id, member_id, type, status, amount,
			currency, description, reference, payment_method, initiated_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, 'loan', 'pending', $6, 'KES', $7, $8, 'mobile_money', $9, $10, $11, $12)
	`, transactionID, chamaWalletID, nil, loan.ChamaID, loan.BorrowerID, loan.TotalAmount,
		fmt.Sprintf("Loan disbursement for loan %s", loanID), reference, loan.ChamaID, loan.BorrowerID, now, now)
	if err != nil {
		return fmt.Errorf("failed to create transaction: %w", err)
	}

	b2cResp, err := s.mpesaService.InitiateB2C(borrowerPhone, loan.TotalAmount, fmt.Sprintf("Loan disbursement from chama"))
	if err != nil {
		_, _ = tx.Exec("UPDATE transactions SET status = 'failed', updated_at = $1 WHERE id = $2", now, transactionID)
		return fmt.Errorf("failed to initiate B2C payment: %w", err)
	}

	_, err = tx.Exec(
		"UPDATE transactions SET status = 'processing', metadata = $1, updated_at = $2 WHERE id = $3",
		fmt.Sprintf(`{"conversation_id": "%s", "originator_conversation_id": "%s"}`, b2cResp.ConversationID, b2cResp.OriginatorConversationID),
		now, transactionID,
	)
	if err != nil {
		return fmt.Errorf("failed to update transaction: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("Loan disbursement initiated for loan %s to borrower %s", loanID, loan.BorrowerID)

	return nil
}

func (s *DisbursementService) DisburseDividends(chamaID, dividendDeclarationID string) error {
	dividends, err := s.getPendingDividendPayments(chamaID, dividendDeclarationID)
	if err != nil {
		return fmt.Errorf("failed to get dividend payments: %w", err)
	}

	if len(dividends) == 0 {
		return fmt.Errorf("no pending dividend payments found")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	for _, d := range dividends {
		var memberPhone string
		err = tx.QueryRow("SELECT phone FROM users WHERE id = $1", d.MemberID).Scan(&memberPhone)
		if err != nil {
			log.Printf("Skipping dividend for member %s: %v", d.MemberID, err)
			continue
		}

		transactionID := "TXN_" + uuid.New().String()
		now := time.Now()
		reference := fmt.Sprintf("DIV-%s-%s", dividendDeclarationID, d.MemberID)

		_, err = tx.Exec(`
			INSERT INTO transactions (
				id, from_wallet_id, chama_id, member_id, type, status, amount,
				currency, description, reference, payment_method, initiated_by, created_at, updated_at
			) VALUES ($1, $2, $3, $4, 'transfer', 'pending', $5, 'KES', $6, $7, 'mobile_money', $8, $9, $10)
		`, transactionID, fmt.Sprintf("wallet-%s-dividends", chamaID), chamaID, d.MemberID,
			d.Amount, "Dividend payment", reference, chamaID, now, now)
		if err != nil {
			log.Printf("Failed to create transaction for dividend: %v", err)
			continue
		}

		_, err = tx.Exec(
			"UPDATE wallets SET balance = balance - $1 WHERE id = $2",
			d.Amount, fmt.Sprintf("wallet-%s-dividends", chamaID),
		)
		if err != nil {
			log.Printf("Failed to debit dividends wallet: %v", err)
			continue
		}

		_, err = tx.Exec(`
			UPDATE dividend_payments SET payment_status = 'paid', payment_date = $1, transaction_reference = $2
			WHERE id = $3
		`, now, reference, d.ID)
		if err != nil {
			log.Printf("Failed to update dividend payment: %v", err)
			continue
		}

		_, _ = tx.Exec(`
			UPDATE transactions SET status = 'processing', updated_at = $1 WHERE id = $2
		`, now, transactionID)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *DisbursementService) DisburseMerryGoRound(merryGoRoundID, recipientUserID string) error {
	mgr, err := s.getMerryGoRoundByID(merryGoRoundID)
	if err != nil {
		return fmt.Errorf("failed to get merry-go-round: %w", err)
	}

	if mgr.Status != "active" {
		return fmt.Errorf("merry-go-round is not active")
	}

	var recipientPhone string
	err = s.db.QueryRow("SELECT phone FROM users WHERE id = $1", recipientUserID).Scan(&recipientPhone)
	if err != nil {
		return fmt.Errorf("failed to get recipient phone: %w", err)
	}

	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	transactionID := "TXN_" + uuid.New().String()
	now := time.Now()
	reference := fmt.Sprintf("MGR-%s-%s", merryGoRoundID, recipientUserID)

	_, err = tx.Exec(`
		INSERT INTO transactions (
			id, from_wallet_id, chama_id, member_id, type, status, amount,
			currency, description, reference, payment_method, initiated_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, 'transfer', 'pending', $5, 'KES', $6, $7, 'mobile_money', $8, $9, $10)
	`, transactionID, fmt.Sprintf("wallet-%s-merry_go_round", mgr.ChamaID), mgr.ChamaID, recipientUserID,
		mgr.AmountPerRound, "Merry-go-round payout", reference, mgr.ChamaID, now, now)
	if err != nil {
		return fmt.Errorf("failed to create transaction: %w", err)
	}

	walletID := fmt.Sprintf("wallet-%s-merry_go_round", mgr.ChamaID)
	_, err = tx.Exec(
		"UPDATE wallets SET balance = balance - $1 WHERE id = $2",
		mgr.AmountPerRound, walletID,
	)
	if err != nil {
		return fmt.Errorf("failed to debit merry-go-round wallet: %w", err)
	}

	b2cResp, err := s.mpesaService.InitiateB2C(recipientPhone, mgr.AmountPerRound, "Merry-go-round payout")
	if err != nil {
		_, _ = tx.Exec("UPDATE transactions SET status = 'failed', updated_at = $1 WHERE id = $2", now, transactionID)
		return fmt.Errorf("failed to initiate B2C payment: %w", err)
	}

	_, err = tx.Exec(
		"UPDATE transactions SET status = 'processing', metadata = $1, updated_at = $2 WHERE id = $3",
		fmt.Sprintf(`{"conversation_id": "%s"}`, b2cResp.ConversationID),
		now, transactionID,
	)
	if err != nil {
		return fmt.Errorf("failed to update transaction: %w", err)
	}

	_, err = tx.Exec(
		"UPDATE merry_go_round_participants SET has_received = true, received_at = $1 WHERE merry_go_round_id = $2 AND user_id = $3",
		now, merryGoRoundID, recipientUserID,
	)
	if err != nil {
		log.Printf("Failed to update participant: %v", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("Merry-go-round disbursement initiated for participant %s", recipientUserID)

	return nil
}

func (s *DisbursementService) DisburseWelfare(welfareFundID, beneficiaryUserID string, amount float64) error {
	wf, err := s.getWelfareFundByID(welfareFundID)
	if err != nil {
		return fmt.Errorf("failed to get welfare fund: %w", err)
	}

	var beneficiaryPhone string
	err = s.db.QueryRow("SELECT phone FROM users WHERE id = $1", beneficiaryUserID).Scan(&beneficiaryPhone)
	if err != nil {
		return fmt.Errorf("failed to get beneficiary phone: %w", err)
	}

	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	walletID := fmt.Sprintf("wallet-%s-welfare", wf.ChamaID)
	_, err = tx.Exec(
		"UPDATE wallets SET balance = balance - $1 WHERE id = $2",
		amount, walletID,
	)
	if err != nil {
		return fmt.Errorf("failed to debit welfare wallet: %w", err)
	}

	transactionID := "TXN_" + uuid.New().String()
	now := time.Now()
	reference := fmt.Sprintf("WEL-%s-%s", welfareFundID, beneficiaryUserID)

	_, err = tx.Exec(`
		INSERT INTO transactions (
			id, from_wallet_id, chama_id, member_id, type, status, amount,
			currency, description, reference, payment_method, initiated_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, 'transfer', 'pending', $5, 'KES', $6, $7, 'mobile_money', $8, $9, $10)
	`, transactionID, walletID, wf.ChamaID, beneficiaryUserID,
		amount, "Welfare fund disbursement", reference, wf.ChamaID, now, now)
	if err != nil {
		return fmt.Errorf("failed to create transaction: %w", err)
	}

	b2cResp, err := s.mpesaService.InitiateB2C(beneficiaryPhone, amount, "Welfare fund payout")
	if err != nil {
		_, _ = tx.Exec("UPDATE transaction SET status = 'failed', updated_at = $1 WHERE id = $2", now, transactionID)
		return fmt.Errorf("failed to initiate B2C payment: %w", err)
	}

	_, err = tx.Exec(
		"UPDATE transactions SET status = 'processing', metadata = $1, updated_at = $2 WHERE id = $3",
		fmt.Sprintf(`{"conversation_id": "%s"}`, b2cResp.ConversationID),
		now, transactionID,
	)
	if err != nil {
		return fmt.Errorf("failed to update transaction: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("Welfare disbursement initiated for beneficiary %s", beneficiaryUserID)

	return nil
}

func (s *DisbursementService) ProcessDisbursementBatch(batchID string) error {
	batch, err := s.getDisbursementBatch(batchID)
	if err != nil {
		return fmt.Errorf("failed to get disbursement batch: %w", err)
	}

	if batch.Status != "pending" {
		return fmt.Errorf("batch is not pending")
	}

	disbursements, err := s.getPendingDisbursements(batchID)
	if err != nil {
		return fmt.Errorf("failed to get disbursements: %w", err)
	}

	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	for _, d := range disbursements {
		var recipientPhone string
		err = tx.QueryRow("SELECT phone FROM users WHERE id = $1", d.RecipientID).Scan(&recipientPhone)
		if err != nil {
			log.Printf("Skipping disbursement for recipient %s: %v", d.RecipientID, err)
			continue
		}

		_, err = s.mpesaService.InitiateB2C(recipientPhone, d.Amount, d.Purpose)
		if err != nil {
			log.Printf("Failed to process disbursement %s: %v", d.ID, err)
			continue
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

type loan struct {
	ID          string
	BorrowerID  string
	ChamaID     string
	Amount      float64
	TotalAmount float64
	Status      string
}

type dividendPayment struct {
	ID       string
	MemberID string
	Amount   float64
	Status   string
}

type merryGoRound struct {
	ID             string
	ChamaID        string
	AmountPerRound float64
	Status         string
}

type welfareFund struct {
	ID      string
	ChamaID string
}

type disbursementBatch struct {
	ID      string
	ChamaID string
	Status  string
}

type disbursementItem struct {
	ID          string
	RecipientID string
	Amount      float64
	Purpose     string
}

func (s *DisbursementService) getLoanByID(loanID string) (*loan, error) {
	var l loan
	err := s.db.QueryRow(
		"SELECT id, borrower_id, chama_id, amount, total_amount, status FROM loans WHERE id = $1",
		loanID,
	).Scan(&l.ID, &l.BorrowerID, &l.ChamaID, &l.Amount, &l.TotalAmount, &l.Status)
	if err != nil {
		return nil, fmt.Errorf("failed to get loan: %w", err)
	}
	return &l, nil
}

func (s *DisbursementService) getPendingDividendPayments(chamaID, dividendDeclarationID string) ([]dividendPayment, error) {
	rows, err := s.db.Query(
		"SELECT id, member_id, dividend_amount, payment_status FROM dividend_payments WHERE chama_id = $1 AND dividend_declaration_id = $2 AND payment_status = 'pending'",
		chamaID, dividendDeclarationID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get dividend payments: %w", err)
	}
	defer rows.Close()

	var dividends []dividendPayment
	for rows.Next() {
		var d dividendPayment
		err := rows.Scan(&d.ID, &d.MemberID, &d.Amount, &d.Status)
		if err != nil {
			return nil, fmt.Errorf("failed to scan dividend payment: %w", err)
		}
		dividends = append(dividends, d)
	}
	return dividends, nil
}

func (s *DisbursementService) getMerryGoRoundByID(merryGoRoundID string) (*merryGoRound, error) {
	var m merryGoRound
	err := s.db.QueryRow(
		"SELECT id, chama_id, amount_per_round, status FROM merry_go_rounds WHERE id = $1",
		merryGoRoundID,
	).Scan(&m.ID, &m.ChamaID, &m.AmountPerRound, &m.Status)
	if err != nil {
		return nil, fmt.Errorf("failed to get merry-go-round: %w", err)
	}
	return &m, nil
}

func (s *DisbursementService) getWelfareFundByID(welfareFundID string) (*welfareFund, error) {
	var w welfareFund
	err := s.db.QueryRow(
		"SELECT id, chama_id FROM welfare_funds WHERE id = $1",
		welfareFundID,
	).Scan(&w.ID, &w.ChamaID)
	if err != nil {
		return nil, fmt.Errorf("failed to get welfare fund: %w", err)
	}
	return &w, nil
}

func (s *DisbursementService) getDisbursementBatch(batchID string) (*disbursementBatch, error) {
	var b disbursementBatch
	err := s.db.QueryRow(
		"SELECT id, chama_id, status FROM disbursement_batches WHERE id = $1",
		batchID,
	).Scan(&b.ID, &b.ChamaID, &b.Status)
	if err != nil {
		return nil, fmt.Errorf("failed to get disbursement batch: %w", err)
	}
	return &b, nil
}

func (s *DisbursementService) getPendingDisbursements(batchID string) ([]disbursementItem, error) {
	rows, err := s.db.Query(
		"SELECT id, recipient_id, amount, purpose FROM disbursements WHERE batch_id = $1 AND status = 'pending'",
		batchID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get disbursements: %w", err)
	}
	defer rows.Close()

	var items []disbursementItem
	for rows.Next() {
		var d disbursementItem
		err := rows.Scan(&d.ID, &d.RecipientID, &d.Amount, &d.Purpose)
		if err != nil {
			return nil, fmt.Errorf("failed to scan disbursement: %w", err)
		}
		items = append(items, d)
	}
	return items, nil
}
