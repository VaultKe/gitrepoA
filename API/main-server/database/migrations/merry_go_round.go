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
    position INTEGER NOT NULL,
    has_received BOOLEAN DEFAULT FALSE,
    received_at TIMESTAMP,
    total_contributed REAL DEFAULT 0,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merry_go_round_id) REFERENCES merry_go_rounds(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(merry_go_round_id, user_id),
    UNIQUE(merry_go_round_id, position)
);`
