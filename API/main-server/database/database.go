package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
	migrations "vaultke-backend/database/migrations"
)

// Initialize creates and returns a database connection
func Initialize(databaseURL string) (*sql.DB, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	db.SetMaxOpenConns(100)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(10 * time.Minute)
	db.SetConnMaxIdleTime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("Database connection established successfully")

	return db, nil
}

// Migrate runs all database migrations
func Migrate(db *sql.DB) error {
	return migrations.MigrateAll(db)
}

// EnsureLoanTypesTable ensures the loan_types table exists
func EnsureLoanTypesTable(db *sql.DB) error {
	return migrations.EnsureLoanTypesTable(db)
}
