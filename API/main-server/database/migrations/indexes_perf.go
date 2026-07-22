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
		"CREATE INDEX IF NOT EXISTS idx_transactions_chama_type_status_created ON transactions(chama_id, type, status, created_at DESC)",
		// transactions: filtered by initiated_by + chama_id (per-user stats)
		"CREATE INDEX IF NOT EXISTS idx_transactions_initiated_chama ON transactions(initiated_by, chama_id)",
		"CREATE INDEX IF NOT EXISTS idx_transactions_initiated_type_status ON transactions(initiated_by, type, status, created_at DESC)",
		// meetings: filtered by chama_id (activity stats)
		"CREATE INDEX IF NOT EXISTS idx_meetings_chama_id ON meetings(chama_id)",
		"CREATE INDEX IF NOT EXISTS idx_meetings_chama_status_scheduled ON meetings(chama_id, status, scheduled_at)",
		// loans: filtered by chama_id (activity stats)
		"CREATE INDEX IF NOT EXISTS idx_loans_chama_id ON loans(chama_id)",
		// chama_members: lookup by (chama_id, user_id) for role checks
		"CREATE INDEX IF NOT EXISTS idx_chama_members_user_chama ON chama_members(user_id, chama_id)",
		// chama_invitations: filtered by email for notification lookups
		"CREATE INDEX IF NOT EXISTS idx_chama_invitations_email_status ON chama_invitations(email, status, expires_at)",
		// notifications: already covered by notifications migration, but ensure user_id exists
		"CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)",
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("statistics indexes migration failed: %w", err)
		}
	}

	log.Println("Statistics performance indexes created successfully")
	return nil
}
