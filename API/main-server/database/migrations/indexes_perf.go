package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

// MigrateStatisticsIndexes adds the missing indexes that the chama/statistics
// endpoints rely on. Without these, every statistics request performs a full
// sequential scan of the (large) transactions/meetings/loans tables for each
// chama_id lookup, which makes GET /api/v1/chamas/:id/statistics take many
// seconds against a remote database.
func MigrateStatisticsIndexes(db *sql.DB) error {
	queries := []string{
		// transactions: filtered by chama_id (financial + user stats)
		"CREATE INDEX IF NOT EXISTS idx_transactions_chama_id ON transactions(chama_id)",
		"CREATE INDEX IF NOT EXISTS idx_transactions_chama_type_status ON transactions(chama_id, type, status)",
		// transactions: filtered by initiated_by + chama_id (per-user stats)
		"CREATE INDEX IF NOT EXISTS idx_transactions_initiated_chama ON transactions(initiated_by, chama_id)",
		// meetings: filtered by chama_id (activity stats)
		"CREATE INDEX IF NOT EXISTS idx_meetings_chama_id ON meetings(chama_id)",
		// loans: filtered by chama_id (activity stats)
		"CREATE INDEX IF NOT EXISTS idx_loans_chama_id ON loans(chama_id)",
		// chama_members: lookup by (chama_id, user_id) for role checks
		"CREATE INDEX IF NOT EXISTS idx_chama_members_user_chama ON chama_members(user_id, chama_id)",
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("statistics indexes migration failed: %w", err)
		}
	}

	log.Println("Statistics performance indexes created successfully")
	return nil
}
