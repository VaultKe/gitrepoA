package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

// SeedUser creates a new user in the database
func seedUser(db *sql.DB, email, password, phone, firstName, lastName string) error {
	// Hash the password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Generate a UUID for the user
	userID := uuid.New().String()

	// Insert the user
	query := `
		INSERT INTO users (id, email, phone, first_name, last_name, password_hash, role, status, is_email_verified, is_phone_verified)
		VALUES ($1, $2, $3, $4, $5, $6, 'user', 'active', true, true)
	`

	_, err = db.Exec(query, userID, email, phone, firstName, lastName, string(hashedPassword))
	if err != nil {
		return fmt.Errorf("failed to insert user: %w", err)
	}

	log.Printf("✅ User created successfully!")
	log.Printf("   Email: %s", email)
	log.Printf("   ID: %s", userID)

	return nil
}

func main1() {
	// Skip if running as part of main app
	if len(os.Args) < 2 || os.Args[1] != "seed" {
		return
	}

	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Initialize database
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	// Create the user
	err = seedUser(db, "sam@gmail.com", "Password", "+254700000000", "Sam", "Admin")
	if err != nil {
		log.Fatalf("Failed to seed user: %v", err)
	}
}
