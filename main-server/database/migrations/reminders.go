package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

func MigrateReminders(db *sql.DB) error {
	queries := []string{
		createRemindersTable,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("reminders migration failed: %w", err)
		}
	}

	log.Println("Reminders migrations completed successfully")
	return nil
}

const createRemindersTable = `
CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    reminder_type TEXT NOT NULL DEFAULT 'once', -- 'once', 'daily', 'weekly', 'monthly'
    scheduled_at TIMESTAMP NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    is_completed BOOLEAN DEFAULT FALSE,
    notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_at ON reminders(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_reminders_type ON reminders(reminder_type);
CREATE INDEX IF NOT EXISTS idx_reminders_enabled ON reminders(is_enabled);
CREATE INDEX IF NOT EXISTS idx_reminders_completed ON reminders(is_completed);
`
