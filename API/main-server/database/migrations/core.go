package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

func MigrateCore(db *sql.DB) error {
	queries := []string{
		"CREATE EXTENSION IF NOT EXISTS pgcrypto;",
		createUsersTable,
		createDevicesTable,
		createSignalIdentityKeysTable,
		createSignalPreKeysTable,
		createSignalSignedPreKeysTable,
		createSignalSessionsTable,
		createSignalMessagesTable,
		createE2EEKeyBundlesTable,
		createE2EESessionsTable,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("core migration failed: %w", err)
		}
	}

	if err := addMissingUserProfileFields(db); err != nil {
		return err
	}
	if err := addRegistrationFeeColumns(db); err != nil {
		return err
	}
	if err := createRefreshTokensTable(db); err != nil {
		return err
	}

	log.Println("Core migrations completed successfully")
	return nil
}

const addUserProfileFields = "SELECT 1"

const createUsersTable = `
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    avatar TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'pending',
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    language TEXT DEFAULT 'en',
    theme TEXT DEFAULT 'dark',
    county TEXT,
    town TEXT,
    latitude REAL,
    longitude REAL,
    business_type TEXT,
    business_description TEXT,
    rating REAL DEFAULT 0,
    total_ratings INTEGER DEFAULT 0,
    id_number TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`

const createDevicesTable = `
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_id INTEGER NOT NULL,
    device_name TEXT,
    device_type TEXT, -- 'mobile', 'desktop', 'web'
    registration_id INTEGER,
    signed_pre_key_id INTEGER,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, device_id)
);`

const createSignalIdentityKeysTable = `
CREATE TABLE IF NOT EXISTS signal_identity_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_id INTEGER NOT NULL,
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL, -- Encrypted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id, device_id) REFERENCES devices(user_id, device_id) ON DELETE CASCADE,
    UNIQUE(user_id, device_id)
);`

const createSignalPreKeysTable = `
CREATE TABLE IF NOT EXISTS signal_pre_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_id INTEGER NOT NULL,
    pre_key_id INTEGER NOT NULL,
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL, -- Encrypted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id, device_id) REFERENCES devices(user_id, device_id) ON DELETE CASCADE,
    UNIQUE(user_id, device_id, pre_key_id)
);`

const createSignalSignedPreKeysTable = `
CREATE TABLE IF NOT EXISTS signal_signed_pre_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_id INTEGER NOT NULL,
    signed_pre_key_id INTEGER NOT NULL,
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL, -- Encrypted
    signature TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id, device_id) REFERENCES devices(user_id, device_id) ON DELETE CASCADE,
    UNIQUE(user_id, device_id, signed_pre_key_id)
);`

const createSignalSessionsTable = `
CREATE TABLE IF NOT EXISTS signal_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_id INTEGER NOT NULL,
    session_id TEXT NOT NULL, -- Base64 encoded session identifier
    session_data TEXT NOT NULL, -- Encrypted session data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id, device_id) REFERENCES devices(user_id, device_id) ON DELETE CASCADE,
    UNIQUE(user_id, device_id, session_id)
);`

const createSignalMessagesTable = `
CREATE TABLE IF NOT EXISTS signal_messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    sender_device_id INTEGER NOT NULL,
    recipient_id TEXT NOT NULL,
    recipient_device_id INTEGER NOT NULL,
    message_type TEXT NOT NULL, -- 'message', 'pre_key_bundle'
    ciphertext TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_delivered BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    metadata TEXT, -- JSON metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id, sender_device_id) REFERENCES devices(user_id, device_id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id, recipient_device_id) REFERENCES devices(user_id, device_id) ON DELETE CASCADE
);`

const createE2EEKeyBundlesTable = `
CREATE TABLE IF NOT EXISTS e2ee_key_bundles (
    user_id TEXT PRIMARY KEY,
    identity_key TEXT NOT NULL,
    signed_pre_key TEXT NOT NULL,
    pre_key_signature TEXT NOT NULL,
    one_time_pre_keys TEXT NOT NULL, -- JSON array
    registration_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`

const createE2EESessionsTable = `
CREATE TABLE IF NOT EXISTS e2ee_sessions (
    id TEXT PRIMARY KEY,
    user_a_id TEXT NOT NULL,
    user_b_id TEXT NOT NULL,
    shared_secret TEXT NOT NULL,
    sending_chain TEXT NOT NULL,
    receiving_chain TEXT NOT NULL,
    message_number INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_a_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_b_id) REFERENCES users(id) ON DELETE CASCADE
);`

func createRefreshTokensTable(db *sql.DB) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS refresh_tokens (
			id SERIAL PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			token_hash TEXT NOT NULL,
			user_agent_hash TEXT,
			ip_address TEXT,
			expires_at TIMESTAMP NOT NULL,
			last_used_at TIMESTAMP,
			revoked BOOLEAN DEFAULT FALSE,
			replaced_by_token_hash TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(token_hash)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at)`,
		`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked ON refresh_tokens(revoked)`,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("failed to create refresh_tokens table/index: %w", err)
		}
	}
	log.Println("refresh_tokens schema ready")
	return nil
}

func addMissingUserProfileFields(db *sql.DB) error {
	columns := []struct {
		name     string
		dataType string
	}{
		{"bio", "TEXT"},
		{"occupation", "TEXT"},
		{"date_of_birth", "DATE"},
		{"gender", "TEXT"},
		{"id_number", "TEXT"},
	}

	for _, col := range columns {
		var exists bool
		query := `SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'users' AND column_name = $1`
		err := db.QueryRow(query, col.name).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to check if column %s exists: %w", col.name, err)
		}

		if !exists {
			alterQuery := fmt.Sprintf("ALTER TABLE users ADD COLUMN %s %s", col.name, col.dataType)
			if _, err := db.Exec(alterQuery); err != nil {
				return fmt.Errorf("failed to add column %s: %w", col.name, err)
			}
			log.Printf("Added column %s to users table", col.name)
		} else {
			log.Printf("Column %s already exists in users table", col.name)
		}
	}

	return nil
}

func addRegistrationFeeColumns(db *sql.DB) error {
	queries := []string{
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_fee_paid BOOLEAN DEFAULT FALSE`,
		`CREATE INDEX IF NOT EXISTS idx_users_registration_fee_paid ON users(registration_fee_paid)`,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("failed to add registration fee columns: %w", err)
		}
	}
	log.Println("registration fee columns ready")
	return nil
}
