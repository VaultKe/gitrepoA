package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

func MigrateWelfare(db *sql.DB) error {
	queries := []string{
		createWelfareTable,
		createWelfareContributionsTable,
		createWelfareRequestsTable,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("welfare migration failed: %w", err)
		}
	}

	if err := addMissingWelfareRequestBeneficiaryField(db); err != nil {
		return err
	}
	if err := addMissingWelfareContributionFields(db); err != nil {
		return err
	}

	log.Println("Welfare migrations completed successfully")
	return nil
}

const addWelfareRequestBeneficiaryField = "SELECT 1"

const addWelfareContributionFields = ""

const createWelfareTable = `
CREATE TABLE IF NOT EXISTS welfare_funds (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    target_amount REAL,
    current_amount REAL DEFAULT 0,
    contribution_per_member REAL,
    purpose TEXT NOT NULL, -- 'emergency', 'medical', 'funeral', 'education'
    status TEXT NOT NULL DEFAULT 'active',
    beneficiary_id TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chama_id) REFERENCES chamas(id),
    FOREIGN KEY (beneficiary_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);`

const createWelfareContributionsTable = `
CREATE TABLE IF NOT EXISTS welfare_contributions (
    id TEXT PRIMARY KEY,
    welfare_fund_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    reference TEXT,
    contributed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (welfare_fund_id) REFERENCES welfare_funds(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);`

const createWelfareRequestsTable = `
CREATE TABLE IF NOT EXISTS welfare_requests (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    requester_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    urgency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    votes_for INTEGER DEFAULT 0,
    votes_against INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chama_id) REFERENCES chamas(id),
    FOREIGN KEY (requester_id) REFERENCES users(id)
);`

func addMissingWelfareRequestBeneficiaryField(db *sql.DB) error {
	var exists bool
	query := `SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'welfare_requests' AND column_name = 'beneficiary_id'`
	err := db.QueryRow(query).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if beneficiary_id column exists: %w", err)
	}

	if !exists {
		alterQuery := `ALTER TABLE welfare_requests ADD COLUMN beneficiary_id TEXT`
		if _, err := db.Exec(alterQuery); err != nil {
			return fmt.Errorf("failed to add beneficiary_id column: %w", err)
		}
		log.Printf("Added beneficiary_id column to welfare_requests table")

		updateQuery := `UPDATE welfare_requests SET beneficiary_id = requester_id WHERE beneficiary_id IS NULL`
		if _, err := db.Exec(updateQuery); err != nil {
			log.Printf("Warning: failed to update existing records with beneficiary_id: %v", err)
		} else {
			log.Printf("Updated existing welfare requests to set beneficiary_id = requester_id")
		}
	} else {
		log.Printf("Column beneficiary_id already exists in welfare_requests table")
	}

	return nil
}

func addMissingWelfareContributionFields(db *sql.DB) error {
	columns := []struct {
		name         string
		dataType     string
		defaultValue string
	}{
		{"welfare_request_id", "TEXT", "NULL"},
		{"contributor_id", "TEXT", "NULL"},
		{"message", "TEXT", "NULL"},
		{"status", "TEXT", "'completed'"},
		{"created_at", "TIMESTAMP", "CURRENT_TIMESTAMP"},
		{"updated_at", "TIMESTAMP", "CURRENT_TIMESTAMP"},
	}

	for _, col := range columns {
		var exists bool
		query := `SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'welfare_contributions' AND column_name = $1`
		err := db.QueryRow(query, col.name).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to check if column %s exists: %w", col.name, err)
		}

		if !exists {
			alterQuery := fmt.Sprintf("ALTER TABLE welfare_contributions ADD COLUMN %s %s DEFAULT %s", col.name, col.dataType, col.defaultValue)
			if _, err := db.Exec(alterQuery); err != nil {
				return fmt.Errorf("failed to add column %s: %w", col.name, err)
			}
			log.Printf("Added column %s to welfare_contributions table", col.name)
		} else {
			log.Printf("Column %s already exists in welfare_contributions table", col.name)
		}
	}

	return nil
}
