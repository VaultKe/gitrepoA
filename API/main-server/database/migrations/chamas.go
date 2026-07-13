package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

func MigrateChamas(db *sql.DB) error {
	queries := []string{
		createChamasTable,
		createChamaMembersTable,
		createSubscriptionPaymentsTable,
		createServiceFeePaymentsTable,
		createChamaInvitationsTable,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("chamas migration failed: %w", err)
		}
	}

	if err := addMissingChamaPermissionsColumn(db); err != nil {
		return err
	}
	if err := addCategoryColumnToChamasTable(db); err != nil {
		return err
	}
	if err := addChatRoomIdToChamasTable(db); err != nil {
		return err
	}
	if err := backfillChatRoomIds(db); err != nil {
		return err
	}
	if err := addMissingInvitationRoleColumns(db); err != nil {
		return err
	}
	if err := addSubscriptionFeeColumns(db); err != nil {
		return err
	}
	if err := addChamaRegistrationFeeColumns(db); err != nil {
		return err
	}
	if err := addChamaRulesFileColumns(db); err != nil {
		return err
	}
	if err := addChamaMemberIndexes(db); err != nil {
		return err
	}

	log.Println("Chamas migrations completed successfully")
	return nil
}

const addChamaPermissionsColumn = `
-- This will be handled by addMissingChamaPermissionsColumn function
SELECT 1;
`

const addInvitationRoleColumns = `
-- This will be handled by addMissingInvitationRoleColumns function
SELECT 1;
`

const addChamaCategoryColumn = `
-- This will be handled by addCategoryColumnToChamasTable function
SELECT 1;
`

const createChamasTable = `
CREATE TABLE IF NOT EXISTS chamas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'chama', -- 'chama' or 'contribution'
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    avatar TEXT,
    county TEXT NOT NULL,
    town TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    contribution_amount REAL NOT NULL,
    contribution_frequency TEXT NOT NULL,
    target_amount REAL, -- For contribution groups
    target_deadline TIMESTAMP, -- For contribution groups
    payment_method TEXT, -- 'till' or 'paybill'
    till_number TEXT, -- For TILL payments
    paybill_business_number TEXT, -- For PAYBILL payments
    paybill_account_number TEXT, -- For PAYBILL payments
    payment_recipient_name TEXT, -- Name user should expect on successful payment
    max_members INTEGER,
    current_members INTEGER DEFAULT 0,
    total_funds REAL DEFAULT 0,
    is_public BOOLEAN DEFAULT FALSE,
    requires_approval BOOLEAN DEFAULT TRUE,
    rules TEXT, -- JSON array of rules
    meeting_frequency TEXT,
    meeting_day_of_week INTEGER,
    meeting_day_of_month INTEGER,
    meeting_time TEXT,
    monthly_subscription_fee REAL DEFAULT 1000, -- Monthly subscription for chamas
    subscription_fee_paid BOOLEAN DEFAULT FALSE, -- Current month subscription status
    subscription_fee_due_date TIMESTAMP, -- Due date for current subscription
    registration_fee_paid BOOLEAN DEFAULT FALSE, -- One-time registration fee (for contribution groups)
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    chat_room_id TEXT,
    FOREIGN KEY (created_by) REFERENCES users(id)
);`

const createChamaMembersTable = `
CREATE TABLE IF NOT EXISTS chama_members (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    total_contributions REAL DEFAULT 0,
    last_contribution TIMESTAMP,
    rating REAL DEFAULT 0,
    total_ratings INTEGER DEFAULT 0,
    service_fee_paid BOOLEAN DEFAULT FALSE, -- One-time service fee to join chama
    service_fee_paid_at TIMESTAMP, -- When service fee was paid
    service_fee_status TEXT DEFAULT 'pending', -- pending, paid, overdue
    service_fee_warning_sent BOOLEAN DEFAULT FALSE, -- Warning sent after 2 days
    FOREIGN KEY (chama_id) REFERENCES chamas(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(chama_id, user_id)
);`

const createSubscriptionPaymentsTable = `
CREATE TABLE IF NOT EXISTS subscription_payments (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, overdue, cancelled
    due_date TIMESTAMP NOT NULL,
    paid_at TIMESTAMP,
    payment_method TEXT,
    transaction_id TEXT,
    month_year TEXT NOT NULL, -- e.g., "2025-06" for June 2025
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE,
    UNIQUE(chama_id, month_year)
);`

const createServiceFeePaymentsTable = `
CREATE TABLE IF NOT EXISTS service_fee_payments (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, overdue, cancelled
    due_date TIMESTAMP NOT NULL,
    paid_at TIMESTAMP,
    payment_method TEXT,
    transaction_id TEXT,
    warning_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(chama_id, user_id)
);`

const createChamaInvitationsTable = `
CREATE TABLE IF NOT EXISTS chama_invitations (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    inviter_id TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_number TEXT,
    message TEXT,
    invitation_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    responded_at TIMESTAMP,
    responded_by TEXT,
    FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE,
    FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chama_invitations_email ON chama_invitations(email);
CREATE INDEX IF NOT EXISTS idx_chama_invitations_chama_id ON chama_invitations(chama_id);
CREATE INDEX IF NOT EXISTS idx_chama_invitations_status ON chama_invitations(status);
CREATE INDEX IF NOT EXISTS idx_chama_invitations_token ON chama_invitations(invitation_token);
`

func addMissingChamaPermissionsColumn(db *sql.DB) error {
	_, err := db.Exec(`ALTER TABLE chamas ADD COLUMN IF NOT EXISTS permissions TEXT DEFAULT '{"allowMerryGoRound": true, "allowWelfare": true}'`)
	if err != nil {
		return fmt.Errorf("failed to add permissions column: %w", err)
	}
	return nil
}

func addCategoryColumnToChamasTable(db *sql.DB) error {
	var err error
	if _, err = db.Exec(`ALTER TABLE chamas ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'chama'`); err != nil {
		return fmt.Errorf("failed to add category column: %w", err)
	}

	var targetAmountExists bool
	checkTargetAmountQuery := `
		SELECT COUNT(*) > 0
		FROM information_schema.columns
		WHERE table_name = 'chamas'
		AND column_name = 'target_amount'
	`
	err = db.QueryRow(checkTargetAmountQuery).Scan(&targetAmountExists)
	if err != nil {
		return fmt.Errorf("failed to check if target_amount column exists: %w", err)
	}

	if !targetAmountExists {
		if _, err = db.Exec(`ALTER TABLE chamas ADD COLUMN target_amount REAL`); err != nil {
			return fmt.Errorf("failed to add target_amount column: %w", err)
		}
		log.Println("Successfully added target_amount column to chamas table")
	}

	var targetDeadlineExists bool
	checkTargetDeadlineQuery := `
		SELECT COUNT(*) > 0
		FROM information_schema.columns
		WHERE table_name = 'chamas'
		AND column_name = 'target_deadline'
	`
	err = db.QueryRow(checkTargetDeadlineQuery).Scan(&targetDeadlineExists)
	if err != nil {
		return fmt.Errorf("failed to check if target_deadline column exists: %w", err)
	}

	if !targetDeadlineExists {
		if _, err = db.Exec(`ALTER TABLE chamas ADD COLUMN target_deadline TIMESTAMP`); err != nil {
			return fmt.Errorf("failed to add target_deadline column: %w", err)
		}
		log.Println("Successfully added target_deadline column to chamas table")
	}

	paymentColumns := []struct {
		name     string
		dataType string
	}{
		{"payment_method", "TEXT"},
		{"till_number", "TEXT"},
		{"paybill_business_number", "TEXT"},
		{"paybill_account_number", "TEXT"},
		{"payment_recipient_name", "TEXT"},
	}

	for _, col := range paymentColumns {
		var exists bool
		checkQuery := `
			SELECT COUNT(*) > 0
			FROM information_schema.columns
			WHERE table_name = 'chamas'
			AND column_name = $1
		`
		err = db.QueryRow(checkQuery, col.name).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to check if %s column exists: %w", col.name, err)
		}

		if !exists {
			if _, err = db.Exec(fmt.Sprintf("ALTER TABLE chamas ADD COLUMN %s %s", col.name, col.dataType)); err != nil {
				return fmt.Errorf("failed to add %s column: %w", col.name, err)
			}
			log.Printf("Successfully added %s column to chamas table", col.name)
		}
	}

	return nil
}

func addChatRoomIdToChamasTable(db *sql.DB) error {
	var columnExists bool
	checkQuery := `
		SELECT COUNT(*) > 0
		FROM information_schema.columns
		WHERE table_name = 'chamas'
		AND column_name = 'chat_room_id'
	`
	err := db.QueryRow(checkQuery).Scan(&columnExists)
	if err != nil {
		return fmt.Errorf("failed to check if chat_room_id column exists: %w", err)
	}

	if !columnExists {
		log.Println("Adding chat_room_id column to chamas table")
		addColumnQuery := `
			ALTER TABLE chamas ADD COLUMN chat_room_id TEXT
		`
		_, err = db.Exec(addColumnQuery)
		if err != nil {
			return fmt.Errorf("failed to add chat_room_id column: %w", err)
		}
		log.Println("Successfully added chat_room_id column to chamas table")
	} else {
		log.Println("Column chat_room_id already exists in chamas table")
	}

	return nil
}

func backfillChatRoomIds(db *sql.DB) error {
	var chatRoomsTableExists bool
	err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_rooms')`).Scan(&chatRoomsTableExists)
	if err != nil {
		return fmt.Errorf("failed to check if chat_rooms table exists: %w", err)
	}

	if !chatRoomsTableExists {
		log.Println("chat_rooms table does not exist yet, skipping chat_room_id backfill")
		return nil
	}

	updateQuery := `
		UPDATE chamas c
		SET chat_room_id = cr.id, updated_at = CURRENT_TIMESTAMP
		FROM chat_rooms cr
		WHERE cr.type = 'chama'
		  AND cr.chama_id = c.id
		  AND cr.is_active = true
		  AND c.chat_room_id IS NULL
	`
	result, err := db.Exec(updateQuery)
	if err != nil {
		return fmt.Errorf("failed to backfill chat_room_id: %w", err)
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected > 0 {
		log.Printf("Backfilled chat_room_id for %d chama(s)", rowsAffected)
	}
	return nil
}

func addMissingInvitationRoleColumns(db *sql.DB) error {
	columns := []struct {
		name         string
		dataType     string
		defaultValue string
	}{
		{"role", "TEXT", ""},
		{"role_name", "TEXT", ""},
		{"role_description", "TEXT", ""},
	}

	for _, col := range columns {
		var exists bool
		err := db.QueryRow(`
			SELECT EXISTS(SELECT 1 FROM information_schema.columns
			WHERE table_name = 'chama_invitations'
			AND column_name = $1)
		`, col.name).Scan(&exists)
		if err != nil {
			log.Printf("Error checking for column %s: %v", col.name, err)
			continue
		}

		if !exists {
			query := fmt.Sprintf("ALTER TABLE chama_invitations ADD COLUMN %s %s", col.name, col.dataType)
			if col.defaultValue != "" {
				query += fmt.Sprintf(" DEFAULT '%s'", col.defaultValue)
			}

			_, err = db.Exec(query)
			if err != nil {
				log.Printf("Error adding column %s: %v", col.name, err)
				continue
			}
			log.Printf("Added column %s to chama_invitations table", col.name)
		}
	}

	return nil
}

func addSubscriptionFeeColumns(db *sql.DB) error {
	queries := []string{
		`ALTER TABLE chamas ADD COLUMN IF NOT EXISTS monthly_subscription_fee REAL DEFAULT 1000`,
		`ALTER TABLE chamas ADD COLUMN IF NOT EXISTS subscription_fee_paid BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE chamas ADD COLUMN IF NOT EXISTS subscription_fee_due_date TIMESTAMP`,
		`CREATE INDEX IF NOT EXISTS idx_chamas_subscription_fee_paid ON chamas(subscription_fee_paid)`,
		`CREATE INDEX IF NOT EXISTS idx_chamas_subscription_fee_due_date ON chamas(subscription_fee_due_date)`,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("failed to add subscription fee columns: %w", err)
		}
	}
	log.Println("subscription fee columns ready")
	return nil
}

func addServiceFeeColumns(db *sql.DB) error {
	queries := []string{
		`ALTER TABLE chama_members ADD COLUMN IF NOT EXISTS service_fee_paid BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE chama_members ADD COLUMN IF NOT EXISTS service_fee_paid_at TIMESTAMP`,
		`ALTER TABLE chama_members ADD COLUMN IF NOT EXISTS service_fee_status TEXT DEFAULT 'pending'`,
		`ALTER TABLE chama_members ADD COLUMN IF NOT EXISTS service_fee_warning_sent BOOLEAN DEFAULT FALSE`,
		`CREATE INDEX IF NOT EXISTS idx_chama_members_service_fee_status ON chama_members(service_fee_status)`,
		`CREATE INDEX IF NOT EXISTS idx_chama_members_service_fee_warning_sent ON chama_members(service_fee_warning_sent)`,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("failed to add service fee columns: %w", err)
		}
	}
	log.Println("service fee columns ready")
	return nil
}

func addChamaRegistrationFeeColumns(db *sql.DB) error {
	queries := []string{
		`ALTER TABLE chamas ADD COLUMN IF NOT EXISTS registration_fee_paid BOOLEAN DEFAULT FALSE`,
		`CREATE INDEX IF NOT EXISTS idx_chamas_registration_fee_paid ON chamas(registration_fee_paid)`,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("failed to add registration fee columns: %w", err)
		}
	}
	log.Println("registration fee columns ready")
	return nil
}

func addChamaRulesFileColumns(db *sql.DB) error {
	queries := []string{
		`ALTER TABLE chamas ADD COLUMN IF NOT EXISTS rules_file_path TEXT`,
		`ALTER TABLE chamas ADD COLUMN IF NOT EXISTS rules_file_name TEXT`,
		`CREATE INDEX IF NOT EXISTS idx_chamas_rules_file_path ON chamas(rules_file_path)`,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("failed to add rules file columns: %w", err)
		}
	}
	log.Println("rules file columns ready")
	return nil
}

func addChamaMemberIndexes(db *sql.DB) error {
	indexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_chama_members_chama_id_active ON chama_members(chama_id, is_active)`,
		`CREATE INDEX IF NOT EXISTS idx_chama_members_user_id ON chama_members(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_chama_members_chama_user ON chama_members(chama_id, user_id, is_active)`,
	}
	for _, index := range indexes {
		if _, err := db.Exec(index); err != nil {
			log.Printf("Warning: Failed to create chama member index: %v", err)
		}
	}
	log.Println("Chama member indexes created")
	return nil
}
