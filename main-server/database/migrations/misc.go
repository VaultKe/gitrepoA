package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

func MigrateMisc(db *sql.DB) error {
	query := `
		CREATE TABLE IF NOT EXISTS migrations (
			id SERIAL PRIMARY KEY,
			migration VARCHAR(255) NOT NULL UNIQUE,
			executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`
	if _, err := db.Exec(query); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}
	log.Println("Migrations tracking table ready")
	return nil
}
