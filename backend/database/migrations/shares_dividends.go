package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

func MigrateSharesDividends(db *sql.DB) error {
	queries := []string{
		createSharesAndDividendsTables,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("shares_dividends migration failed: %w", err)
		}
	}

	if err := addDividendTypeColumn(db); err != nil {
		return err
	}

	log.Println("Shares and dividends migrations completed successfully")
	return nil
}

const addDividendTypeColumnMigration = "SELECT 1"

const createSharesAndDividendsTables = `
-- Shares ownership table
CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    name TEXT NOT NULL,
    share_type TEXT NOT NULL DEFAULT 'ordinary', -- 'ordinary', 'preferred'
    shares_owned INTEGER NOT NULL DEFAULT 0,
    share_value REAL NOT NULL DEFAULT 0,
    total_value REAL NOT NULL DEFAULT 0,
    purchase_date TIMESTAMP NOT NULL,
    certificate_number TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'transferred', 'redeemed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Dividend declarations table
CREATE TABLE IF NOT EXISTS dividend_declarations (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    declaration_date TIMESTAMP,
    dividend_per_share REAL NOT NULL,
    total_amount REAL NOT NULL,
    payment_date TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'declared', -- 'declared', 'approved', 'paid', 'cancelled'
    declared_by TEXT,
    approved_by TEXT,
    description TEXT,
    dividend_type TEXT DEFAULT 'cash',
    eligibility_criteria TEXT,
    approval_required BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    created_by_id TEXT,
    timestamp TIMESTAMP,
    transaction_id TEXT,
    security_hash TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE,
    FOREIGN KEY (declared_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    FOREIGN KEY (created_by_id) REFERENCES users(id)
);

-- Individual dividend payments table
CREATE TABLE IF NOT EXISTS dividend_payments (
    id TEXT PRIMARY KEY,
    dividend_declaration_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    shares_eligible INTEGER NOT NULL,
    dividend_amount REAL NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed'
    payment_date TIMESTAMP,
    payment_method TEXT,
    transaction_reference TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dividend_declaration_id) REFERENCES dividend_declarations(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Share transactions table (for transfers, purchases, redemptions)
CREATE TABLE IF NOT EXISTS share_transactions (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    from_member_id TEXT,
    to_member_id TEXT,
    transaction_type TEXT NOT NULL, -- 'purchase', 'transfer', 'redemption', 'split'
    shares_count INTEGER NOT NULL,
    share_value REAL NOT NULL,
    total_amount REAL NOT NULL,
    transaction_date TIMESTAMP NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
    approved_by TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE,
    FOREIGN KEY (from_member_id) REFERENCES users(id),
    FOREIGN KEY (to_member_id) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shares_chama_member ON shares(chama_id, member_id);
CREATE INDEX IF NOT EXISTS idx_shares_status ON shares(status);
CREATE INDEX IF NOT EXISTS idx_dividend_declarations_chama ON dividend_declarations(chama_id);
CREATE INDEX IF NOT EXISTS idx_dividend_declarations_status ON dividend_declarations(status);
CREATE INDEX IF NOT EXISTS idx_dividend_payments_declaration ON dividend_payments(dividend_declaration_id);
CREATE INDEX IF NOT EXISTS idx_dividend_payments_member ON dividend_payments(member_id);
CREATE INDEX IF NOT EXISTS idx_dividend_payments_status ON dividend_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_share_transactions_chama ON share_transactions(chama_id);
CREATE INDEX IF NOT EXISTS idx_share_transactions_type ON share_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_share_transactions_status ON share_transactions(status);
`

func addDividendTypeColumn(db *sql.DB) error {
	var exists bool
	query := `SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'dividend_declarations' AND column_name = 'total_dividend_amount'`
	err := db.QueryRow(query).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if total_dividend_amount column exists: %w", err)
	}

	if exists {
		renameQuery := `ALTER TABLE dividend_declarations RENAME COLUMN total_dividend_amount TO total_amount`
		if _, err := db.Exec(renameQuery); err != nil {
			return fmt.Errorf("failed to rename total_dividend_amount to total_amount: %w", err)
		}
		log.Printf("Renamed total_dividend_amount to total_amount in dividend_declarations table")
	}

	query = `SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'dividend_declarations' AND column_name = 'dividend_type'`
	err = db.QueryRow(query).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if dividend_type column exists: %w", err)
	}

	if !exists {
		alterQuery := `ALTER TABLE dividend_declarations ADD COLUMN dividend_type TEXT DEFAULT 'cash'`
		if _, err := db.Exec(alterQuery); err != nil {
			return fmt.Errorf("failed to add dividend_type column: %w", err)
		}
		log.Printf("Added dividend_type column to dividend_declarations table")
	} else {
		log.Printf("Column dividend_type already exists in dividend_declarations table")
	}

	columnsToAdd := []struct {
		name         string
		dataType     string
		defaultValue string
	}{
		{"declaration_date", "TIMESTAMP", "CURRENT_TIMESTAMP"},
		{"eligibility_criteria", "TEXT", "NULL"},
		{"approval_required", "BOOLEAN", "TRUE"},
		{"created_by", "TEXT", "NULL"},
		{"created_by_id", "TEXT", "NULL"},
		{"timestamp", "TIMESTAMP", "NULL"},
		{"transaction_id", "TEXT", "NULL"},
		{"security_hash", "TEXT", "NULL"},
	}

	for _, col := range columnsToAdd {
		var exists bool
		query = `SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'dividend_declarations' AND column_name = $1`
		err = db.QueryRow(query, col.name).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to check if %s column exists: %w", col.name, err)
		}

		if !exists {
			alterQuery := fmt.Sprintf("ALTER TABLE dividend_declarations ADD COLUMN %s %s DEFAULT %s", col.name, col.dataType, col.defaultValue)
			if _, err := db.Exec(alterQuery); err != nil {
				return fmt.Errorf("failed to add %s column: %w", col.name, err)
			}
			log.Printf("Added %s column to dividend_declarations table", col.name)
		}
	}

	return nil
}
