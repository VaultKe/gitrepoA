package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

func MigrateMerryGoRoundPayments(db *sql.DB) error {
	queries := []string{
		createMerryGoRoundPaymentsTable,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("merry_go_round_payments migration failed: %w", err)
		}
	}

	log.Println("Merry go round payments migrations completed successfully")
	return nil
}

const createMerryGoRoundPaymentsTable = `
CREATE TABLE IF NOT EXISTS merry_go_round_payments (
	id TEXT PRIMARY KEY,
	merry_go_round_id TEXT NOT NULL,
	chama_id TEXT NOT NULL,
	payer_user_id TEXT NOT NULL, -- User who made the payment
	payee_user_id TEXT NOT NULL, -- User whose place is being paid (for pay_for contributions)
	contributor_user_id TEXT NOT NULL, -- User who contributed (same as payer for regular, or payee for pay_for)
	amount REAL NOT NULL,
	round_number INTEGER NOT NULL, -- Which round this payment is for
	position INTEGER NOT NULL, -- Position in the merry-go-round order
	payment_method TEXT NOT NULL, -- 'wallet', 'mpesa'
	status TEXT NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'failed'
	transaction_id TEXT, -- Reference to the transaction record
	description TEXT,
	metadata TEXT, -- JSON metadata including contributor name, amount per round, etc.
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (merry_go_round_id) REFERENCES merry_go_rounds(id) ON DELETE CASCADE,
	FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE,
	FOREIGN KEY (payer_user_id) REFERENCES users(id) ON DELETE CASCADE,
	FOREIGN KEY (payee_user_id) REFERENCES users(id) ON DELETE CASCADE,
	FOREIGN KEY (contributor_user_id) REFERENCES users(id) ON DELETE CASCADE,
	FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

-- Indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_mgr_payments_merry_go_round_id ON merry_go_round_payments(merry_go_round_id);
CREATE INDEX IF NOT EXISTS idx_mgr_payments_chama_id ON merry_go_round_payments(chama_id);
CREATE INDEX IF NOT EXISTS idx_mgr_payments_payer_user_id ON merry_go_round_payments(payer_user_id);
CREATE INDEX IF NOT EXISTS idx_mgr_payments_contributor_user_id ON merry_go_round_payments(contributor_user_id);
CREATE INDEX IF NOT EXISTS idx_mgr_payments_round_number ON merry_go_round_payments(round_number);
CREATE INDEX IF NOT EXISTS idx_mgr_payments_status ON merry_go_round_payments(status);
CREATE INDEX IF NOT EXISTS idx_mgr_payments_created_at ON merry_go_round_payments(created_at);
`

// Add merry_go_round_id column to existing contributions table for tracking
func addMerryGoRoundIdToContributions(db *sql.DB) error {
	var exists bool
	query := `SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'contributions' AND column_name = 'merry_go_round_id'`
	err := db.QueryRow(query).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if merry_go_round_id column exists: %w", err)
	}

	if !exists {
		alterQuery := `ALTER TABLE contributions ADD COLUMN merry_go_round_id TEXT`
		if _, err := db.Exec(alterQuery); err != nil {
			return fmt.Errorf("failed to add merry_go_round_id column: %w", err)
		}
		log.Printf("Added merry_go_round_id column to contributions table")

		indexQuery := `CREATE INDEX IF NOT EXISTS idx_contributions_merry_go_round_id ON contributions(merry_go_round_id)`
		if _, err := db.Exec(indexQuery); err != nil {
			log.Printf("Warning: failed to create index for merry_go_round_id: %v", err)
		} else {
			log.Printf("Created index for merry_go_round_id on contributions table")
		}
	} else {
		log.Printf("Column merry_go_round_id already exists in contributions table")
	}

	return nil
}