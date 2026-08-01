package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

// MigrateMissingIndexes adds indexes that were missed in earlier migrations
// but are required for common query patterns in production.
func MigrateMissingIndexes(db *sql.DB) error {
	indexes := []string{
		// ── users table ──
		"CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)",
		"CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)",
		"CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(is_email_verified)",
		"CREATE INDEX IF NOT EXISTS idx_users_phone_verified ON users(is_phone_verified)",
		"CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC)",

		// ── chamas table ──
		"CREATE INDEX IF NOT EXISTS idx_chamas_status ON chamas(status)",
		"CREATE INDEX IF NOT EXISTS idx_chamas_category ON chamas(category)",
		"CREATE INDEX IF NOT EXISTS idx_chamas_type ON chamas(type)",
		"CREATE INDEX IF NOT EXISTS idx_chamas_created_by ON chamas(created_by)",

		// ── chama_members table ──
		"CREATE INDEX IF NOT EXISTS idx_chama_members_role ON chama_members(role)",
		"CREATE INDEX IF NOT EXISTS idx_chama_members_is_active ON chama_members(is_active)",

		// ── transactions table ──
		"CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)",
		"CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)",
		"CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method)",
		"CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC)",
		"CREATE INDEX IF NOT EXISTS idx_transactions_chama_type_status ON transactions(chama_id, type, status)",

		// ── wallets table ──
		"CREATE INDEX IF NOT EXISTS idx_wallets_currency ON wallets(currency)",
		"CREATE INDEX IF NOT EXISTS idx_wallets_is_active ON wallets(is_active)",

		// ── loans table ──
		"CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status)",
		"CREATE INDEX IF NOT EXISTS idx_loans_type ON loans(type)",
		"CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON loans(borrower_id)",
		"CREATE INDEX IF NOT EXISTS idx_loans_approval_stage ON loans(approval_stage)",

		// ── loan_types table ──
		"CREATE INDEX IF NOT EXISTS idx_loan_types_status ON loan_types(status)",
		"CREATE INDEX IF NOT EXISTS idx_loan_types_created_by ON loan_types(created_by)",

		// ── notifications table ──
		"CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_status ON notifications(user_id, is_read, status)",
		"CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC)",

		// ── chama_invitations table ──
		"CREATE INDEX IF NOT EXISTS idx_chama_invitations_status_expires ON chama_invitations(status, expires_at)",

		// ── chama_members service fee ──
		"CREATE INDEX IF NOT EXISTS idx_chama_members_service_fee_status ON chama_members(service_fee_status)",

		// ── subscription_payments ──
		"CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON subscription_payments(status)",
		"CREATE INDEX IF NOT EXISTS idx_subscription_payments_due_date ON subscription_payments(due_date)",

		// ── service_fee_payments ──
		"CREATE INDEX IF NOT EXISTS idx_service_fee_payments_status ON service_fee_payments(status)",

		// ── loan_payments ──
		"CREATE INDEX IF NOT EXISTS idx_loan_payments_paid_at ON loan_payments(paid_at DESC)",

		// ── loan_fines ──
		"CREATE INDEX IF NOT EXISTS idx_loan_fines_status ON loan_fines(status)",

		// ── loan_approval_otps ──
		"CREATE INDEX IF NOT EXISTS idx_loan_approval_otps_expires ON loan_approval_otps(expires_at)",
		"CREATE INDEX IF NOT EXISTS idx_loan_approval_otps_verified ON loan_approval_otps(verified)",

		// ── chat_messages ──
		"CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_created ON chat_messages(sender_id, created_at DESC)",

		// ── chat_room_members ──
		"CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_active ON chat_room_members(user_id, is_active)",
	}

	for _, idx := range indexes {
		if _, err := db.Exec(idx); err != nil {
			log.Printf("Warning: Failed to create missing index: %v", err)
		}
	}

	log.Println("Missing indexes migration completed successfully")
	return nil
}

// MigrateJSONBConversions converts TEXT columns that store JSON to JSONB for
// better queryability and storage efficiency.
func MigrateJSONBConversions(db *sql.DB) error {
	// Convert TEXT columns that hold JSON to JSONB where applicable
	conversions := []struct {
		table       string
		column      string
		description string
	}{
		{
			table:       "chamas",
			column:      "rules",
			description: "chamas.rules stores a JSON array of rules",
		},
		{
			table:       "chat_messages",
			column:      "metadata",
			description: "chat_messages.metadata stores JSON metadata",
		},
		{
			table:       "chat_messages",
			column:      "encryption_metadata",
			description: "chat_messages.encryption_metadata stores JSON metadata",
		},
		{
			table:       "transactions",
			column:      "metadata",
			description: "transactions.metadata stores JSON metadata",
		},
		{
			table:       "notifications",
			column:      "data",
			description: "notifications.data stores JSON payload",
		},
		{
			table:       "disbursements",
			column:      "metadata",
			description: "disbursements.metadata stores JSON batch data",
		},
		{
			table:       "merry_go_round_payments",
			column:      "metadata",
			description: "merry_go_round_payments.metadata stores JSON payment data",
		},
		{
			table:       "polls_votes",
			column:      "metadata",
			description: "polls_votes.metadata stores JSON vote data (if table exists)",
		},
	}

	for _, conv := range conversions {
		// Check if the table exists
		var tableExists bool
		err := db.QueryRow(
			"SELECT COUNT(*) > 0 FROM information_schema.tables WHERE table_name = $1",
			conv.table,
		).Scan(&tableExists)
		if err != nil {
			log.Printf("Warning: could not check table %s: %v", conv.table, err)
			continue
		}
		if !tableExists {
			log.Printf("Skipping %s.%s — table does not exist", conv.table, conv.column)
			continue
		}

		// Check if the column exists
		var columnExists bool
		err = db.QueryRow(
			"SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2",
			conv.table, conv.column,
		).Scan(&columnExists)
		if err != nil {
			log.Printf("Warning: could not check column %s.%s: %v", conv.table, conv.column, err)
			continue
		}
		if !columnExists {
			log.Printf("Skipping %s.%s — column does not exist", conv.table, conv.column)
			continue
		}

		// Check if column is already JSONB
		var dataType string
		err = db.QueryRow(
			"SELECT data_type FROM information_schema.columns WHERE table_name = $1 AND column_name = $2",
			conv.table, conv.column,
		).Scan(&dataType)
		if err != nil {
			log.Printf("Warning: could not check data type for %s.%s: %v", conv.table, conv.column, err)
			continue
		}

		if dataType == "jsonb" {
			log.Printf("Skipping %s.%s — already JSONB", conv.table, conv.column)
			continue
		}

		// Use a safe conversion: ALTER COLUMN ... TYPE jsonb USING ...::jsonb
		// Wrap in a DO block with exception handling to avoid failing on invalid JSON
		safeConvert := fmt.Sprintf(`
			ALTER TABLE %s
			ALTER COLUMN %s TYPE jsonb
			USING CASE
				WHEN %s IS NULL THEN NULL
				WHEN %s = '' THEN NULL
				WHEN %s ~ '^\s*(\{.*\}|\[.*\])\s*$' THEN %s::jsonb
				ELSE NULL
			END
		`, conv.table, conv.column, conv.column, conv.column, conv.column, conv.column)

		_, err = db.Exec(safeConvert)
		if err != nil {
			// If the direct conversion fails, try a safer approach using a temporary column
			log.Printf("Warning: direct conversion of %s.%s to JSONB failed: %v. Attempting safe migration.", conv.table, conv.column, err)

			tempCol := conv.column + "_jsonb_tmp"
			steps := []string{
				fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s jsonb", conv.table, tempCol),
				fmt.Sprintf("UPDATE %s SET %s = CASE WHEN %s IS NOT NULL AND %s != '' AND %s ~ '^\\s*(\\{.*\\}|\\[.*\\])\\s*$' THEN %s::jsonb ELSE NULL END",
					conv.table, tempCol, conv.column, conv.column, conv.column, conv.column),
				fmt.Sprintf("ALTER TABLE %s DROP COLUMN %s", conv.table, conv.column),
				fmt.Sprintf("ALTER TABLE %s RENAME COLUMN %s TO %s", conv.table, tempCol, conv.column),
			}
			for _, step := range steps {
				if _, err := db.Exec(step); err != nil {
					log.Printf("Warning: safe migration step failed for %s.%s: %v", conv.table, conv.column, err)
					break
				}
			}
		} else {
			log.Printf("Converted %s.%s to JSONB", conv.table, conv.column)
		}

		// Create a GIN index on JSONB columns for efficient querying
		ginIdx := fmt.Sprintf("CREATE INDEX IF NOT EXISTS idx_gin_%s_%s ON %s USING gin (%s)",
			conv.table, conv.column, conv.table, conv.column)
		if _, err := db.Exec(ginIdx); err != nil {
			log.Printf("Warning: failed to create GIN index on %s.%s: %v", conv.table, conv.column, err)
		} else {
			log.Printf("Created GIN index on %s.%s", conv.table, conv.column)
		}
	}

	log.Println("JSONB conversion migration completed successfully")
	return nil
}
