package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

func MigrateWallets(db *sql.DB) error {
	queries := []string{
		createWalletsTable,
		createTransactionsTable,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("wallets migration failed: %w", err)
		}
	}

	if err := addRecipientIDToTransactions(db); err != nil {
		return err
	}
	if err := addMissingChamaIDColumnToTransactions(db); err != nil {
		return err
	}
	if err := addMissingRecipientIDColumnToTransactions(db); err != nil {
		return err
	}
	if err := addMissingTransactionFields(db); err != nil {
		return err
	}
	if err := addSubwalletTypeToWallets(db); err != nil {
		return err
	}
	if err := addMemberIDToTransactions(db); err != nil {
		return err
	}
	if err := addSubwalletTypeToTransactions(db); err != nil {
		return err
	}

	log.Println("Wallets migrations completed successfully")
	return nil
}

const addRecipientIDToTransactionsMigration = "SELECT 1"

const createWalletsTable = `
CREATE TABLE IF NOT EXISTS wallets (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    balance REAL DEFAULT 0,
    currency TEXT DEFAULT 'KES',
    is_active BOOLEAN DEFAULT TRUE,
    is_locked BOOLEAN DEFAULT FALSE,
    daily_limit REAL,
    monthly_limit REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`

const createTransactionsTable = `
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    from_wallet_id TEXT,
    to_wallet_id TEXT,
    chama_id TEXT,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'KES',
    description TEXT,
    reference TEXT,
    payment_method TEXT NOT NULL,
    metadata TEXT, -- JSON metadata
    fees REAL DEFAULT 0,
    initiated_by TEXT NOT NULL,
    recipient_id TEXT,
    approved_by TEXT,
    requires_approval BOOLEAN DEFAULT FALSE,
    approval_deadline TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_wallet_id) REFERENCES wallets(id),
    FOREIGN KEY (to_wallet_id) REFERENCES wallets(id),
    FOREIGN KEY (chama_id) REFERENCES chamas(id),
    FOREIGN KEY (initiated_by) REFERENCES users(id),
    FOREIGN KEY (recipient_id) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);`

func addRecipientIDToTransactions(db *sql.DB) error {
	var exists bool
	query := `SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'recipient_id'`
	err := db.QueryRow(query).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if recipient_id column exists: %w", err)
	}

	if !exists {
		alterQuery := `ALTER TABLE transactions ADD COLUMN recipient_id TEXT`
		if _, err := db.Exec(alterQuery); err != nil {
			return fmt.Errorf("failed to add recipient_id column: %w", err)
		}
		log.Printf("Added recipient_id column to transactions table")

		indexQuery := `CREATE INDEX IF NOT EXISTS idx_transactions_recipient_id ON transactions(recipient_id)`
		if _, err := db.Exec(indexQuery); err != nil {
			log.Printf("Warning: failed to create index for recipient_id: %v", err)
		} else {
			log.Printf("Created index for recipient_id on transactions table")
		}
	} else {
		log.Printf("Column recipient_id already exists in transactions table")
	}

	return nil
}

func addMissingChamaIDColumnToTransactions(db *sql.DB) error {
	var exists bool
	query := `SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'chama_id'`
	err := db.QueryRow(query).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if chama_id column exists: %w", err)
	}

	if !exists {
		alterQuery := `ALTER TABLE transactions ADD COLUMN chama_id TEXT`
		if _, err := db.Exec(alterQuery); err != nil {
			return fmt.Errorf("failed to add chama_id column: %w", err)
		}
		log.Printf("Added chama_id column to transactions table")

		indexQuery := `CREATE INDEX IF NOT EXISTS idx_transactions_chama_id ON transactions(chama_id)`
		if _, err := db.Exec(indexQuery); err != nil {
			log.Printf("Warning: failed to create index for chama_id: %v", err)
		} else {
			log.Printf("Created index for chama_id on transactions table")
		}
	} else {
		log.Printf("Column chama_id already exists in transactions table")
	}

	return nil
}

func addMissingRecipientIDColumnToTransactions(db *sql.DB) error {
	var exists bool
	query := `SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'recipient_id'`
	err := db.QueryRow(query).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if recipient_id column exists: %w", err)
	}

	if !exists {
		alterQuery := `ALTER TABLE transactions ADD COLUMN recipient_id TEXT`
		if _, err := db.Exec(alterQuery); err != nil {
			return fmt.Errorf("failed to add recipient_id column: %w", err)
		}
		log.Printf("Added recipient_id column to transactions table")

		indexQuery := `CREATE INDEX IF NOT EXISTS idx_transactions_recipient_id ON transactions(recipient_id)`
		if _, err := db.Exec(indexQuery); err != nil {
			log.Printf("Warning: failed to create index for recipient_id: %v", err)
		} else {
			log.Printf("Created index for recipient_id on transactions table")
		}
	} else {
		log.Printf("Column recipient_id already exists in transactions table")
	}

	return nil
}

func addMissingTransactionFields(db *sql.DB) error {
	columns := []struct {
		name         string
		dataType     string
		defaultValue string
	}{
		{"checkout_request_id", "TEXT", "NULL"},
	}

	for _, col := range columns {
		var exists bool
		query := `SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = $1`
		err := db.QueryRow(query, col.name).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to check if column %s exists: %w", col.name, err)
		}

		if !exists {
			alterQuery := fmt.Sprintf("ALTER TABLE transactions ADD COLUMN %s %s DEFAULT %s", col.name, col.dataType, col.defaultValue)
			if _, err := db.Exec(alterQuery); err != nil {
				return fmt.Errorf("failed to add column %s: %w", col.name, err)
			}
			log.Printf("Added column %s to transactions table", col.name)
		} else {
			log.Printf("Column %s already exists in transactions table", col.name)
		}
	}

	return nil
}

const addTransactionFields = ""

func addSubwalletTypeToWallets(db *sql.DB) error {
	queries := []string{
		`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS subwallet_type TEXT`,
		`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS chama_id TEXT`,
		`CREATE INDEX IF NOT EXISTS idx_wallets_subwallet_type ON wallets(subwallet_type)`,
		`CREATE INDEX IF NOT EXISTS idx_wallets_owner_id ON wallets(owner_id)`,
		`CREATE INDEX IF NOT EXISTS idx_wallets_chama_id ON wallets(chama_id)`,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("failed to add subwallet_type column to wallets: %w", err)
		}
	}
	log.Println("subwallet_type column added to wallets table")
	return nil
}

func addMemberIDToTransactions(db *sql.DB) error {
	queries := []string{
		`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS member_id TEXT`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_member_id ON transactions(member_id)`,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("failed to add member_id column to transactions: %w", err)
		}
	}
	log.Println("member_id column added to transactions table")
	return nil
}

func addSubwalletTypeToTransactions(db *sql.DB) error {
	queries := []string{
		`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS subwallet_type TEXT`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_subwallet_type ON transactions(subwallet_type)`,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("failed to add subwallet_type column to transactions: %w", err)
		}
	}
	log.Println("subwallet_type column added to transactions table")
	return nil
}
