package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

func MigrateChatPerformanceIndexes(db *sql.DB) error {
	queries := []string{
		`CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created_active
		 ON chat_messages(room_id, created_at DESC)
		 WHERE is_deleted = false`,
		`CREATE INDEX IF NOT EXISTS idx_chat_room_members_room_active
		 ON chat_room_members(room_id, is_active)`,

		`CREATE INDEX IF NOT EXISTS idx_chat_rooms_active
		 ON chat_rooms(is_active)
		 WHERE is_active = TRUE`,

		`CREATE INDEX IF NOT EXISTS idx_transactions_initiated_type_status_created
		 ON transactions(initiated_by, type, status, created_at DESC)`,

		`CREATE INDEX IF NOT EXISTS idx_meetings_chama_id
		 ON meetings(chama_id)`,
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("chat performance index migration failed: %w", err)
		}
	}

	log.Println("Chat performance indexes created")
	return nil
}
