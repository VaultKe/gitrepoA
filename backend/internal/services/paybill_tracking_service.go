package services

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"

	"vaultke-backend/internal/models"
)

type PaybillTrackingService struct {
	db *sql.DB
}

func NewPaybillTrackingService(db *sql.DB) *PaybillTrackingService {
	return &PaybillTrackingService{db: db}
}

func (s *PaybillTrackingService) ValidateChamaWalletOwnership(chamaID, subwalletType string) error {
	var count int
	err := s.db.QueryRow(
		"SELECT COUNT(*) FROM wallets WHERE owner_id = $1 AND type = $2 AND (subwallet_type = $3 OR ($3 = 'contribution' AND id LIKE $4))",
		chamaID, models.WalletTypeChama, subwalletType, chamaID+"-%",
	).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to validate chama wallet ownership: %w", err)
	}
	if count == 0 {
		return fmt.Errorf("chama %s does not own wallet of type %s", chamaID, subwalletType)
	}
	return nil
}

func (s *PaybillTrackingService) GetChamaSubWallet(chamaID string, subwalletType models.ChamaWalletType) (*models.Wallet, error) {
	walletID := fmt.Sprintf("wallet-%s-%s", chamaID, subwalletType)

	var wallet models.Wallet
	err := s.db.QueryRow(
		"SELECT id, type, owner_id, subwallet_type, chama_id, balance, currency, is_active, is_locked, daily_limit, monthly_limit, created_at, updated_at FROM wallets WHERE id = $1 OR (owner_id = $2 AND type = 'chama' AND subwallet_type = $3)",
		walletID, chamaID, subwalletType,
	).Scan(
		&wallet.ID, &wallet.Type, &wallet.OwnerID, &wallet.SubWalletType,
		&wallet.ChamaID, &wallet.Balance, &wallet.Currency,
		&wallet.IsActive, &wallet.IsLocked, &wallet.DailyLimit, &wallet.MonthlyLimit,
		&wallet.CreatedAt, &wallet.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return s.createChamaSubWallet(chamaID, subwalletType)
		}
		return nil, fmt.Errorf("failed to get chama sub-wallet: %w", err)
	}

	return &wallet, nil
}

func (s *PaybillTrackingService) createChamaSubWallet(chamaID string, subwalletType models.ChamaWalletType) (*models.Wallet, error) {
	wallet := &models.Wallet{
		ID:            fmt.Sprintf("wallet-%s-%s", chamaID, subwalletType),
		Type:          models.WalletTypeChama,
		OwnerID:       chamaID,
		SubWalletType: subwalletType,
		ChamaID:       chamaID,
		Balance:       0,
		Currency:      "KES",
		IsActive:      true,
		IsLocked:      false,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	query := `
		INSERT INTO wallets (id, type, owner_id, subwallet_type, chama_id, balance, currency, is_active, is_locked, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`
	_, err = tx.Exec(query,
		wallet.ID, wallet.Type, wallet.OwnerID, wallet.SubWalletType, wallet.ChamaID,
		wallet.Balance, wallet.Currency, wallet.IsActive, wallet.IsLocked,
		wallet.CreatedAt, wallet.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create chama sub-wallet: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return wallet, nil
}

func (s *PaybillTrackingService) ProvisionChamaSubWallets(chamaID string) error {
	subwalletTypes := []models.ChamaWalletType{
		models.ChamaWalletTypeMain,
		models.ChamaWalletTypeSavings,
		models.ChamaWalletTypeWelfare,
		models.ChamaWalletTypeMerryGo,
		models.ChamaWalletTypeLoan,
		models.ChamaWalletTypeShares,
		models.ChamaWalletTypeDividends,
		models.ChamaWalletTypeContribution,
	}

	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	for _, swt := range subwalletTypes {
		var exists bool
		err := tx.QueryRow(
			"SELECT EXISTS(SELECT 1 FROM wallets WHERE owner_id = $1 AND type = 'chama' AND subwallet_type = $2)",
			chamaID, swt,
		).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to check wallet existence: %w", err)
		}

		if !exists {
			walletID := fmt.Sprintf("wallet-%s-%s", chamaID, swt)
			_, err = tx.Exec(`
				INSERT INTO wallets (id, type, owner_id, subwallet_type, chama_id, balance, currency, is_active, is_locked, created_at, updated_at)
				VALUES ($1, 'chama', $2, $3, $4, 0, 'KES', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			`, walletID, chamaID, swt, chamaID)
			if err != nil {
				return fmt.Errorf("failed to create %s wallet: %w", swt, err)
			}
			log.Printf("Created %s sub-wallet for chama %s", swt, chamaID)
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *PaybillTrackingService) GetPaybillReference(chamaID, userID string, subwalletType models.ChamaWalletType, paymentType string) string {
	timestamp := time.Now().Unix()
	random := time.Now().Nanosecond() % 10000
	return fmt.Sprintf("%s-%s-%s-%s-%d-%04d", paymentType, chamaID, userID, subwalletType, timestamp, random)
}

func (s *PaybillTrackingService) ParsePaybillReference(reference string) (chamaID, userID string, paymentType models.ChamaWalletType, valid bool) {
	var prefix, chama, user string
	var timestamp int64

	parts := splitReference(reference)
	if len(parts) < 5 {
		return "", "", "", false
	}

	prefix = parts[0]
	chama = parts[1]
	user = parts[2]

	_, err := fmt.Sscanf(parts[3], "%d", &timestamp)
	if err != nil {
		return chama, user, models.ChamaWalletType(prefix), true
	}

	return chama, user, models.ChamaWalletType(parts[0]), true
}

func splitReference(reference string) []string {
	result := make([]string, 0)
	start := 0
	for i := 0; i < len(reference); i++ {
		if reference[i] == '-' {
			if i > start {
				result = append(result, reference[start:i])
			}
			start = i + 1
		}
	}
	if start < len(reference) {
		result = append(result, reference[start:])
	}
	return result
}

func (s *PaybillTrackingService) GetAllChamaWallets(chamaID string) ([]*models.Wallet, error) {
	query := `
		SELECT id, type, owner_id, subwallet_type, chama_id, balance, currency, is_active, is_locked, daily_limit, monthly_limit, created_at, updated_at
		FROM wallets
		WHERE owner_id = $1 AND type = 'chama'
		ORDER BY created_at ASC
	`

	rows, err := s.db.Query(query, chamaID)
	if err != nil {
		return nil, fmt.Errorf("failed to get chama wallets: %w", err)
	}
	defer rows.Close()

	var wallets []*models.Wallet
	for rows.Next() {
		wallet := &models.Wallet{}
		err := rows.Scan(
			&wallet.ID, &wallet.Type, &wallet.OwnerID, &wallet.SubWalletType,
			&wallet.ChamaID, &wallet.Balance, &wallet.Currency,
			&wallet.IsActive, &wallet.IsLocked, &wallet.DailyLimit, &wallet.MonthlyLimit,
			&wallet.CreatedAt, &wallet.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan wallet: %w", err)
		}
		wallets = append(wallets, wallet)
	}

	return wallets, nil
}

func (s *PaybillTrackingService) ValidateDisbursementSource(sourceWalletID, chamaID string) (*models.Wallet, error) {
	wallet, err := s.getWalletByID(sourceWalletID)
	if err != nil {
		return nil, err
	}

	if wallet.Type != models.WalletTypeChama {
		return nil, fmt.Errorf("source wallet is not a chama wallet")
	}

	if wallet.OwnerID != chamaID {
		return nil, fmt.Errorf("chama %s does not own wallet %s", chamaID, sourceWalletID)
	}

	if !wallet.IsAvailable() {
		return nil, fmt.Errorf("source wallet is locked or inactive")
	}

	return wallet, nil
}

func (s *PaybillTrackingService) getWalletByID(walletID string) (*models.Wallet, error) {
	query := `
		SELECT id, type, owner_id, subwallet_type, chama_id, balance, currency, is_active, is_locked, daily_limit, monthly_limit, created_at, updated_at
		FROM wallets WHERE id = $1
	`

	wallet := &models.Wallet{}
	err := s.db.QueryRow(query, walletID).Scan(
		&wallet.ID, &wallet.Type, &wallet.OwnerID, &wallet.SubWalletType,
		&wallet.ChamaID, &wallet.Balance, &wallet.Currency,
		&wallet.IsActive, &wallet.IsLocked, &wallet.DailyLimit, &wallet.MonthlyLimit,
		&wallet.CreatedAt, &wallet.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("wallet not found")
		}
		return nil, fmt.Errorf("failed to get wallet: %w", err)
	}

	return wallet, nil
}

func (s *PaybillTrackingService) CreateTransactionWithWallets(fromWalletID, toWalletID, chamaID, memberID string, amount float64, txType models.TransactionType, description, reference string) (*models.Transaction, error) {
	if fromWalletID == "" && toWalletID == "" {
		return nil, errors.New("either fromWalletID or toWalletID is required")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	transactionID := "TXN_" + uuid.New().String()
	now := time.Now()

	metadata := map[string]interface{}{
		"chama_id": chamaID,
	}
	if memberID != "" {
		metadata["member_id"] = memberID
	}

	var query string
	var args []interface{}

	if fromWalletID != "" && toWalletID != "" {
		query = `
			INSERT INTO transactions (id, from_wallet_id, to_wallet_id, chama_id, member_id, type, status, amount, currency, description, reference, initiated_by, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, 'KES', $8, $9, $10, $11, $12)
		`
		args = []interface{}{transactionID, fromWalletID, toWalletID, chamaID, memberID, txType, amount, description, reference, chamaID, now, now}
	} else if toWalletID != "" {
		query = `
			INSERT INTO transactions (id, to_wallet_id, chama_id, member_id, type, status, amount, currency, description, reference, initiated_by, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, 'pending', $6, 'KES', $7, $8, $9, $10, $11)
		`
		args = []interface{}{transactionID, toWalletID, chamaID, memberID, txType, amount, description, reference, chamaID, now, now}
		query = `
			INSERT INTO transactions (id, from_wallet_id, chama_id, member_id, type, status, amount, currency, description, reference, initiated_by, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, 'pending', $6, 'KES', $7, $8, $9, $10, $11)
		`
		args = []interface{}{transactionID, fromWalletID, chamaID, memberID, txType, amount, description, reference, chamaID, now, now}
	}

	_, err = tx.Exec(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	_, err = tx.Exec(
		"UPDATE wallets SET balance = balance - $1, updated_at = $2 WHERE id = $3",
		amount, now, fromWalletID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to debit source wallet: %w", err)
	}

	_, err = tx.Exec(
		"UPDATE wallets SET balance = balance + $1, updated_at = $2 WHERE id = $3",
		amount, now, toWalletID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to credit destination wallet: %w", err)
	}

	_, err = tx.Exec(
		"UPDATE transactions SET status = 'completed', updated_at = $1 WHERE id = $2",
		now, transactionID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update transaction status: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &models.Transaction{
		ID:           transactionID,
		FromWalletID: &fromWalletID,
		ToWalletID:   &toWalletID,
		ChamaID:      chamaID,
		MemberID:     memberID,
		Type:         txType,
		Status:       models.TransactionStatusCompleted,
		Amount:       amount,
		Currency:     "KES",
		Description:  &description,
		Reference:    &reference,
		CreatedAt:    now,
		UpdatedAt:    now,
	}, nil
}
