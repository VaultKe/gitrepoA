package database

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	migrations "vaultke-backend/database/migrations"

	_ "github.com/lib/pq"
)

// Database holds primary and replica PostgreSQL connections.
type Database struct {
	Primary *sql.DB
	Replica *sql.DB
}

// Initialize creates and returns a Database containing primary and optional replica connections.
func Initialize(primaryDatabaseURL, replicaDatabaseURL string) (*Database, error) {
	if strings.TrimSpace(primaryDatabaseURL) == "" {
		return nil, fmt.Errorf("primary database URL is required")
	}

	primaryDB, err := openDatabase(primaryDatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize primary database: %w", err)
	}

	var replicaDB *sql.DB
	if strings.TrimSpace(replicaDatabaseURL) != "" && replicaDatabaseURL != primaryDatabaseURL {
		replicaDB, err = openDatabase(replicaDatabaseURL)
		if err != nil {
			_ = primaryDB.Close()
			return nil, fmt.Errorf("failed to initialize replica database: %w", err)
		}
		log.Println("Replica database connection established successfully")
	} else {
		replicaDB = primaryDB
	}

	return &Database{
		Primary: primaryDB,
		Replica: replicaDB,
	}, nil
}

func openDatabase(databaseURL string) (*sql.DB, error) {
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

	return db, nil
}

// Close closes primary and replica connections.
func (d *Database) Close() error {
	var firstErr error
	if d.Replica != nil && d.Replica != d.Primary {
		if err := d.Replica.Close(); err != nil {
			firstErr = fmt.Errorf("failed to close replica database: %w", err)
		}
	}
	if d.Primary != nil {
		if err := d.Primary.Close(); err != nil {
			if firstErr != nil {
				return fmt.Errorf("%v; failed to close primary database: %w", firstErr, err)
			}
			return fmt.Errorf("failed to close primary database: %w", err)
		}
	}
	return firstErr
}

// ReadDB returns the replica database for read-only operations, falling back to primary when no replica is configured.
func (d *Database) ReadDB() *sql.DB {
	if d == nil || d.Replica == nil {
		return d.Primary
	}
	return d.Replica
}

// WriteDB returns the primary database for write operations.
func (d *Database) WriteDB() *sql.DB {
	if d == nil {
		return nil
	}
	return d.Primary
}

// Migrate runs all database migrations
func Migrate(db *sql.DB) error {
	return migrations.MigrateAll(db)
}

// EnsureLoanTypesTable ensures the loan_types table exists
func EnsureLoanTypesTable(db *sql.DB) error {
	return migrations.EnsureLoanTypesTable(db)
}
