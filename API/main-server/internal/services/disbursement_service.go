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

	totalAmount := amount
	if balance < totalAmount {
		return nil, fmt.Errorf("insufficient balance in user wallet")
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
		if err := tx.Commit(); err != nil {
			log.Printf("Failed to commit failed B2C transaction %s: %v", transactionID, err)
		}
		return nil, fmt.Errorf("failed to initiate B2C payment: %w", err)
	}

	// B2C request succeeded - mark as processing. Wallet will be debited on callback/timeout confirmation.
	// The callback/timeout handler will update status to completed (and already refund if failed).
	_, err = tx.Exec(
		"UPDATE transactions SET status = 'processing', metadata = $1, updated_at = $2 WHERE id = $3",
		fmt.Sprintf(`{"conversation_id": "%s", "originator_conversation_id": "%s"}`, b2cResp.ConversationID, b2cResp.OriginatorConversationID),
		now, transactionID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update transaction: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit B2C initiation transaction: %w", err)
	}

	log.Printf("B2C disbursement initiated for KES %.2f to phone %s - awaiting callback for wallet deduction", amount, recipientPhone)

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

	// Full officer approval chain must be complete.
	var approvalStage string
	var disbursedAt sql.NullTime
	var requiredGuarantors int
	if err := s.db.QueryRow(
		"SELECT COALESCE(approval_stage,''), disbursed_at, COALESCE(required_guarantors,0) FROM loans WHERE id = $1", loanID,
	).Scan(&approvalStage, &disbursedAt, &requiredGuarantors); err != nil {
		return fmt.Errorf("failed to read loan approval state: %w", err)
	}
	requiredReferees := 0
	_ = s.db.QueryRow("SELECT COALESCE(required_referees,0) FROM loans WHERE id = $1", loanID).Scan(&requiredReferees)
	if approvalStage != "fully_approved" {
		return fmt.Errorf("loan approval chain is not complete (stage: %s)", approvalStage)
	}
	// Idempotency: never disburse a loan that has already been disbursed.
	if disbursedAt.Valid {
		return fmt.Errorf("loan has already been disbursed")
	}

	// Every required guarantor must have accepted.
	if requiredGuarantors > 0 {
		var total, accepted int
		if err := s.db.QueryRow(`
			SELECT COUNT(*), COALESCE(SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END), 0)
			FROM guarantors WHERE loan_id = $1
		`, loanID).Scan(&total, &accepted); err != nil {
			return fmt.Errorf("failed to check guarantor consent: %w", err)
		}
		if accepted < requiredGuarantors || accepted < total {
			return fmt.Errorf("not all guarantors have consented to this loan")
		}
	}

	// Every required referee must have accepted.
	if requiredReferees > 0 {
		var total, accepted int
		if err := s.db.QueryRow(`
			SELECT COUNT(*), COALESCE(SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END), 0)
			FROM loan_referees WHERE loan_id = $1
		`, loanID).Scan(&total, &accepted); err != nil {
			return fmt.Errorf("failed to check referee consent: %w", err)
		}
		if accepted < requiredReferees || accepted < total {
			return fmt.Errorf("not all referees have consented to this loan")
		}
	}

	// Atomic status guard: only flip approved -> disbursing once. If another
	// request already did, RowsAffected is 0 and we stop before sending money
	// twice.
	guard, err := s.db.Exec("UPDATE loans SET status = 'disbursing' WHERE id = $1 AND status = 'approved' AND disbursed_at IS NULL", loanID)
	if err != nil {
		return fmt.Errorf("failed to lock loan for disbursement: %w", err)
	}
	if n, _ := guard.RowsAffected(); n != 1 {
		return fmt.Errorf("loan is already being disbursed")
	}

	// Unless the disbursement reaches B2C, release the lock so it can be retried.
	disbursed := false
	defer func() {
		if !disbursed {
			_, _ = s.db.Exec("UPDATE loans SET status = 'approved', disbursed_at = NULL, due_date = NULL WHERE id = $1 AND status = 'disbursing'", loanID)
		}
	}()

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

	_, err = tx.Exec("UPDATE loans SET status = 'active', disbursed_at = CURRENT_TIMESTAMP, due_date = CURRENT_TIMESTAMP + ($2 || ' months')::interval WHERE id = $1", loanID, loan.Duration)
	if err != nil {
		return fmt.Errorf("failed to update loan status: %w", err)
	}

	chamaWalletID := fmt.Sprintf("wallet-%s-contribution", loan.ChamaID)
	transactionID := "TXN_" + uuid.New().String()
	now := time.Now()
	reference := fmt.Sprintf("LOAN-DISB-%s-%s", now.Format("200601"), loanID)

	_, err = tx.Exec(`
		INSERT INTO transactions (
			id, from_wallet_id, chama_id, member_id, type, status, amount,
			currency, description, reference, payment_method, initiated_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, 'loan', 'processing', $5, 'KES', $6, $7, 'mobile_money', $8, $9, $10, $11)
	`, transactionID, chamaWalletID, loan.ChamaID, loan.BorrowerID, loan.TotalAmount,
		fmt.Sprintf("Loan disbursement for loan %s", loanID), reference, loan.ChamaID, loan.BorrowerID, now, now)
	if err != nil {
		return fmt.Errorf("failed to create transaction: %w", err)
	}

	b2cResp, err := s.mpesaService.InitiateB2C(borrowerPhone, loan.TotalAmount, fmt.Sprintf("Loan disbursement from chama"))
	if err != nil {
		// Payout never left: roll back the loan so it can be retried (the deferred
		// guard handles the status; here we just record the failed attempt).
		_, _ = tx.Exec("UPDATE transactions SET status = 'failed', updated_at = $1 WHERE id = $2", now, transactionID)
		return fmt.Errorf("failed to initiate B2C payment: %w", err)
	}

	// Wallet will be debited by B2C callback/timeout confirmation.
	_, err = tx.Exec(
		"UPDATE transactions SET status = 'processing', metadata = $1, updated_at = $2 WHERE id = $3",
		fmt.Sprintf(`{"conversation_id": "%s", "originator_conversation_id": "%s"}`, b2cResp.ConversationID, b2cResp.OriginatorConversationID),
		now, transactionID,
	)
	if err != nil {
		return fmt.Errorf("failed to update transaction: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit loan disbursement transaction: %w", err)
	}

	disbursed = true
	log.Printf("Loan disbursement initiated for loan %s to borrower %s - awaiting callback", loanID, loan.BorrowerID)

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
			) VALUES ($1, $2, $3, $4, 'transfer', 'processing', $5, 'KES', $6, $7, 'mobile_money', $8, $9, $10)
		`, transactionID, fmt.Sprintf("wallet-%s-dividends", chamaID), chamaID, d.MemberID,
			d.Amount, "Dividend payment", reference, chamaID, now, now)
		if err != nil {
			log.Printf("Failed to create transaction for dividend: %v", err)
			continue
		}

		b2cResp, err := s.mpesaService.InitiateB2C(memberPhone, d.Amount, "Dividend payment")
		if err != nil {
			_, _ = tx.Exec("UPDATE transactions SET status = 'failed', updated_at = $1 WHERE id = $2", now, transactionID)
			log.Printf("Failed to initiate B2C for dividend %s: %v", transactionID, err)
			continue
		}

		// Wallet will be debited by B2C callback/timeout confirmation.
		_, err = tx.Exec(
			"UPDATE transactions SET status = 'processing', metadata = $1, updated_at = $2 WHERE id = $3",
			fmt.Sprintf(`{"conversation_id": "%s"}`, b2cResp.ConversationID),
			now, transactionID,
		)
		if err != nil {
			return fmt.Errorf("failed to update transaction: %w", err)
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit dividend disbursement transaction: %w", err)
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
		) VALUES ($1, $2, $3, $4, 'transfer', 'processing', $5, 'KES', $6, $7, 'mobile_money', $8, $9, $10)
	`, transactionID, fmt.Sprintf("wallet-%s-merry_go_round", mgr.ChamaID), mgr.ChamaID, recipientUserID,
		mgr.AmountPerRound, "Merry-go-round payout", reference, mgr.ChamaID, now, now)
	if err != nil {
		return fmt.Errorf("failed to create transaction: %w", err)
	}

	b2cResp, err := s.mpesaService.InitiateB2C(recipientPhone, mgr.AmountPerRound, "Merry-go-round payout")
	if err != nil {
		_, _ = tx.Exec("UPDATE transactions SET status = 'failed', updated_at = $1 WHERE id = $2", now, transactionID)
		if err := tx.Commit(); err != nil {
			log.Printf("Failed to commit failed MGR disbursement %s: %v", transactionID, err)
		}
		return fmt.Errorf("failed to initiate B2C payment: %w", err)
	}

	// Wallet will be debited by B2C callback/timeout confirmation.
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
		return fmt.Errorf("failed to commit MGR disbursement transaction: %w", err)
	}

	log.Printf("Merry-go-round disbursement initiated for participant %s - awaiting callback", recipientUserID)

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
	transactionID := "TXN_" + uuid.New().String()
	now := time.Now()
	reference := fmt.Sprintf("WEL-%s-%s", welfareFundID, beneficiaryUserID)

	_, err = tx.Exec(`
		INSERT INTO transactions (
			id, from_wallet_id, chama_id, member_id, type, status, amount,
			currency, description, reference, payment_method, initiated_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, 'transfer', 'processing', $5, 'KES', $6, $7, 'mobile_money', $8, $9, $10)
	`, transactionID, walletID, wf.ChamaID, beneficiaryUserID,
		amount, "Welfare fund disbursement", reference, wf.ChamaID, now, now)
	if err != nil {
		return fmt.Errorf("failed to create transaction: %w", err)
	}

	b2cResp, err := s.mpesaService.InitiateB2C(beneficiaryPhone, amount, "Welfare fund payout")
	if err != nil {
		_, _ = tx.Exec("UPDATE transactions SET status = 'failed', updated_at = $1 WHERE id = $2", now, transactionID)
		if err := tx.Commit(); err != nil {
			log.Printf("Failed to commit failed welfare disbursement %s: %v", transactionID, err)
		}
		return fmt.Errorf("failed to initiate B2C payment: %w", err)
	}

	// Wallet will be debited by B2C callback/timeout confirmation.
	_, err = tx.Exec(
		"UPDATE transactions SET status = 'processing', metadata = $1, updated_at = $2 WHERE id = $3",
		fmt.Sprintf(`{"conversation_id": "%s"}`, b2cResp.ConversationID),
		now, transactionID,
	)
	if err != nil {
		return fmt.Errorf("failed to update transaction: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit welfare disbursement transaction: %w", err)
	}

	log.Printf("Welfare disbursement initiated for beneficiary %s - awaiting callback", beneficiaryUserID)

	return nil
}

func (s *DisbursementService) ProcessDisbursementBatch(batchID string) error {
	// Atomically claim the batch: only a pending or approved batch can be
	// processed, and only once. A second/concurrent call gets RowsAffected 0.
	claim, err := s.db.Exec(
		"UPDATE disbursement_batches SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status IN ('pending','approved')",
		batchID,
	)
	if err != nil {
		return fmt.Errorf("failed to claim disbursement batch: %w", err)
	}
	if n, _ := claim.RowsAffected(); n != 1 {
		return fmt.Errorf("batch is not awaiting processing (already processing, completed or failed)")
	}

	disbursements, err := s.getPendingDisbursements(batchID)
	if err != nil {
		return fmt.Errorf("failed to get disbursements: %w", err)
	}

	for _, d := range disbursements {
		// Claim this disbursement row so it cannot be paid twice.
		rowClaim, cerr := s.db.Exec(
			"UPDATE disbursements SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'pending'",
			d.ID,
		)
		if cerr != nil {
			log.Printf("Failed to claim disbursement %s: %v", d.ID, cerr)
			continue
		}
		if n, _ := rowClaim.RowsAffected(); n != 1 {
			continue // already claimed/paid by someone else
		}

		var recipientPhone string
		if perr := s.db.QueryRow("SELECT phone FROM users WHERE id = $1", d.RecipientID).Scan(&recipientPhone); perr != nil {
			log.Printf("Skipping disbursement %s for recipient %s: %v", d.ID, d.RecipientID, perr)
			_, _ = s.db.Exec("UPDATE disbursements SET status = 'failed', failure_reason = 'recipient phone unavailable', updated_at = CURRENT_TIMESTAMP WHERE id = $1", d.ID)
			continue
		}

		now := time.Now()

		// Prefer the transaction row created when the batch was submitted so the
		// source wallet (from_wallet_id) is carried through to the B2C callback,
		// which is what actually debits the chama sub-wallet.
		var txnID string
		var fromWalletID sql.NullString
		findErr := s.db.QueryRow(
			"SELECT id, from_wallet_id FROM transactions WHERE id = $1 OR reference = $2 ORDER BY created_at LIMIT 1",
			d.TransactionID, fmt.Sprintf("PENDING-%s-%s", batchID, d.RecipientID),
		).Scan(&txnID, &fromWalletID)
		if findErr == sql.ErrNoRows {
			txnID = "TXN_" + uuid.New().String()
			if d.FromAccount != "" {
				fromWalletID = sql.NullString{String: d.FromAccount, Valid: true}
			}
			if _, ierr := s.db.Exec(`
				INSERT INTO transactions (
					id, from_wallet_id, chama_id, recipient_id, member_id, type, status, amount, currency,
					description, reference, payment_method, initiated_by, created_at, updated_at
				) VALUES ($1, $2, $3, $4, $4, 'withdrawal', 'processing', $5, 'KES', $6, $7, 'mpesa', $4, $8, $8)
			`, txnID, fromWalletID, d.ChamaID, d.RecipientID, d.Amount, d.Purpose, fmt.Sprintf("BATCH-%s-%s", batchID, d.ID), now); ierr != nil {
				log.Printf("Failed to create batch disbursement transaction for %s: %v", d.ID, ierr)
				_, _ = s.db.Exec("UPDATE disbursements SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = $1", d.ID)
				continue
			}
		} else if findErr != nil {
			log.Printf("Failed to locate transaction for disbursement %s: %v", d.ID, findErr)
			_, _ = s.db.Exec("UPDATE disbursements SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = $1", d.ID)
			continue
		}

		b2cResp, berr := s.mpesaService.InitiateB2C(recipientPhone, d.Amount, d.Purpose)
		if berr != nil {
			_, _ = s.db.Exec("UPDATE transactions SET status = 'failed', updated_at = $1 WHERE id = $2", now, txnID)
			_, _ = s.db.Exec("UPDATE disbursements SET status = 'failed', failure_reason = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", berr.Error(), d.ID)
			log.Printf("Failed B2C for batch disbursement %s: %v", d.ID, berr)
			continue
		}

		// payment_method must be 'mpesa' and from_wallet_id set so HandleB2CCallback
		// matches this row by conversation id and debits the source wallet.
		if _, uerr := s.db.Exec(`
			UPDATE transactions
			SET status = 'processing', payment_method = 'mpesa', from_wallet_id = COALESCE(from_wallet_id, $1),
			    metadata = $2, updated_at = $3
			WHERE id = $4
		`, fromWalletID, fmt.Sprintf(`{"conversation_id": "%s", "originator_conversation_id": "%s", "b2c_phone_number": "%s"}`, b2cResp.ConversationID, b2cResp.OriginatorConversationID, recipientPhone), now, txnID); uerr != nil {
			log.Printf("Failed to update batch disbursement transaction %s: %v", txnID, uerr)
			continue
		}
	}

	// Mark the batch complete once every row has left 'pending'/'processing'.
	var remaining int
	_ = s.db.QueryRow("SELECT COUNT(*) FROM disbursements WHERE batch_id = $1 AND status IN ('pending','processing')", batchID).Scan(&remaining)
	newStatus := "completed"
	if remaining > 0 {
		newStatus = "processing"
	}
	if _, err = s.db.Exec("UPDATE disbursement_batches SET status = $1, processed_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2", newStatus, batchID); err != nil {
		return fmt.Errorf("failed to finalise batch: %w", err)
	}

	return nil
}

type loan struct {
	ID          string
	BorrowerID  string
	ChamaID     string
	Amount      float64
	TotalAmount float64
	Duration    int
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
	ID            string
	RecipientID   string
	Amount        float64
	Purpose       string
	TransactionID string
	FromAccount   string
	ChamaID       string
}

func (s *DisbursementService) getLoanByID(loanID string) (*loan, error) {
	var l loan
	err := s.db.QueryRow(
		"SELECT id, borrower_id, chama_id, amount, total_amount, duration, status FROM loans WHERE id = $1",
		loanID,
	).Scan(&l.ID, &l.BorrowerID, &l.ChamaID, &l.Amount, &l.TotalAmount, &l.Duration, &l.Status)
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
	rows, err := s.db.Query(`
		SELECT id, COALESCE(recipient_id, member_id), amount, COALESCE(NULLIF(purpose,''), 'Disbursement'),
		       COALESCE(transaction_id, ''), COALESCE(from_account, ''), COALESCE(chama_id, '')
		FROM disbursements WHERE batch_id = $1 AND status = 'pending'
	`, batchID)
	if err != nil {
		return nil, fmt.Errorf("failed to get disbursements: %w", err)
	}
	defer rows.Close()

	var items []disbursementItem
	for rows.Next() {
		var d disbursementItem
		if err := rows.Scan(&d.ID, &d.RecipientID, &d.Amount, &d.Purpose, &d.TransactionID, &d.FromAccount, &d.ChamaID); err != nil {
			return nil, fmt.Errorf("failed to scan disbursement: %w", err)
		}
		items = append(items, d)
	}
	return items, nil
}
