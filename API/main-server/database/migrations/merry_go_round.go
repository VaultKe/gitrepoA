package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

func MigrateMerryGoRound(db *sql.DB) error {
	queries := []string{
		createMerryGoRoundTable,
		createMerryGoRoundParticipantsTable,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("merry_go_round migration failed: %w", err)
		}
	}

	// Add missing columns to existing merry_go_round_participants table
	if err := addMissingParticipantColumns(db); err != nil {
		return err
	}
	// Add next_payout_date and description to merry_go_rounds table
	if err := addMissingMerryGoRoundColumns(db); err != nil {
		return err
	}

	log.Println("Merry go round migrations completed successfully")
	return nil
}

const createMerryGoRoundTable = `
CREATE TABLE IF NOT EXISTS merry_go_rounds (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    amount_per_round REAL NOT NULL,
    frequency TEXT NOT NULL, -- 'weekly', 'monthly'
    total_participants INTEGER NOT NULL,
    current_round INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active',
    start_date DATE NOT NULL,
    next_payout_date DATE,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chama_id) REFERENCES chamas(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);`

const createMerryGoRoundParticipantsTable = `
CREATE TABLE IF NOT EXISTS merry_go_round_participants (
    id TEXT PRIMARY KEY,
    merry_go_round_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    member_id TEXT, -- Reference to chama_members table
    position INTEGER NOT NULL,
    has_received BOOLEAN DEFAULT FALSE,
    received_at TIMESTAMP,
    has_contributed_this_cycle BOOLEAN DEFAULT FALSE,
    contributed_at TIMESTAMP,
    total_contributed REAL DEFAULT 0,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merry_go_round_id) REFERENCES merry_go_rounds(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (member_id) REFERENCES chama_members(id),
    UNIQUE(merry_go_round_id, user_id),
    UNIQUE(merry_go_round_id, position)
);`

// addMissingParticipantColumns adds has_contributed_this_cycle and other missing columns
func addMissingParticipantColumns(db *sql.DB) error {
	columns := []struct {
		name     string
		dataType string
	}{
		{"has_contributed_this_cycle", "BOOLEAN DEFAULT FALSE"},
		{"contributed_at", "TIMESTAMP"},
		{"member_id", "TEXT"},
	}

	for _, col := range columns {
		var exists bool
		query := `SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'merry_go_round_participants' AND column_name = $1`
		err := db.QueryRow(query, col.name).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to check if column %s exists: %w", col.name, err)
		}

		if !exists {
			alterQuery := fmt.Sprintf("ALTER TABLE merry_go_round_participants ADD COLUMN %s %s", col.name, col.dataType)
			if _, err := db.Exec(alterQuery); err != nil {
				return fmt.Errorf("failed to add column %s: %w", col.name, err)
			}
			log.Printf("Added column %s to merry_go_round_participants table", col.name)

			if col.name == "has_contributed_this_cycle" {
				indexQuery := `CREATE INDEX IF NOT EXISTS idx_merry_go_round_participants_has_contributed ON merry_go_round_participants(has_contributed_this_cycle)`
				db.Exec(indexQuery)
			}
		}
	}

	return nil
}

// addMissingMerryGoRoundColumns adds next_payout_date and description to merry_go_rounds
func addMissingMerryGoRoundColumns(db *sql.DB) error {
	columns := []struct {
		name         string
		dataType     string
		defaultValue string
	}{
		{"next_payout_date", "DATE", "NULL"},
		{"description", "TEXT", "NULL"},
	}

	for _, col := range columns {
		var exists bool
		query := `SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'merry_go_rounds' AND column_name = $1`
		err := db.QueryRow(query, col.name).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to check if column %s exists: %w", col.name, err)
		}

		if !exists {
			alterQuery := fmt.Sprintf("ALTER TABLE merry_go_rounds ADD COLUMN %s %s DEFAULT %s", col.name, col.dataType, col.defaultValue)
			if _, err := db.Exec(alterQuery); err != nil {
				return fmt.Errorf("failed to add column %s: %w", col.name, err)
			}
			log.Printf("Added column %s to merry_go_rounds table", col.name)
		}
	}

	return nil
}
