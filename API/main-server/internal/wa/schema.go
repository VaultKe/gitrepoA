package wa

import (
	"database/sql"
	"fmt"
)

// InitializeSchema creates the OpenWA mapping tables if they don't exist.
func InitializeSchema(db *sql.DB) error {
	queries := []string{
		// User ↔ WhatsApp phone mapping
		`CREATE TABLE IF NOT EXISTS wa_user_mappings (
			user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			phone_number TEXT NOT NULL,
			wa_jid TEXT NOT NULL,
			wa_session_id TEXT NOT NULL DEFAULT 'default',
			verified BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,

		// VaultKe room ↔ OpenWA chat mapping
		`CREATE TABLE IF NOT EXISTS wa_room_mappings (
			room_id TEXT PRIMARY KEY,
			chat_id TEXT NOT NULL,
			chat_type TEXT NOT NULL DEFAULT 'private',
			chama_id TEXT,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,

		// Chama ↔ WhatsApp group mapping
		`CREATE TABLE IF NOT EXISTS wa_chama_mappings (
			chama_id TEXT PRIMARY KEY REFERENCES chamas(id) ON DELETE CASCADE,
			group_jid TEXT NOT NULL,
			group_name TEXT,
			invite_code TEXT,
			session_id TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,

		// OpenWA session registry (tracks which sessions we manage)
		`CREATE TABLE IF NOT EXISTS wa_sessions (
			session_id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'created',
			phone TEXT,
			push_name TEXT,
			is_default BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,

		// Optional: local message cache for fast loading and offline support
		`CREATE TABLE IF NOT EXISTS wa_message_cache (
			id TEXT PRIMARY KEY,
			chat_id TEXT NOT NULL,
			sender_jid TEXT,
			body TEXT,
			type TEXT DEFAULT 'text',
			direction TEXT DEFAULT 'incoming',
			timestamp BIGINT NOT NULL,
			status TEXT DEFAULT 'pending',
			metadata JSONB DEFAULT '{}',
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_wa_message_cache_chat_timestamp ON wa_message_cache(chat_id, timestamp DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_wa_message_cache_sender ON wa_message_cache(sender_jid)`,
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("create wa table: %w", err)
		}
	}

	return nil
}

// InitializeDefaultSession creates a default OpenWA session record if none exists.
func InitializeDefaultSession(db *sql.DB, defaultSessionID, defaultSessionName string) error {
	if defaultSessionID == "" {
		return nil
	}

	var count int
	err := db.QueryRow(`SELECT COUNT(*) FROM wa_sessions WHERE session_id = $1`, defaultSessionID).Scan(&count)
	if err != nil {
		return fmt.Errorf("check default session: %w", err)
	}

	if count == 0 {
		_, err = db.Exec(
			`INSERT INTO wa_sessions (session_id, name, status, is_default, created_at, updated_at)
			 VALUES ($1, $2, 'created', true, NOW(), NOW())`,
			defaultSessionID, defaultSessionName,
		)
		if err != nil {
			return fmt.Errorf("insert default session: %w", err)
		}
	}

	return nil
}

// GetActiveSessionIDs returns all ready OpenWA session IDs.
func GetActiveSessionIDs(db *sql.DB) ([]string, error) {
	rows, err := db.Query(`SELECT session_id FROM wa_sessions WHERE status = 'ready'`)
	if err != nil {
		return nil, fmt.Errorf("query active sessions: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan session id: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// UpdateSessionStatus updates an OpenWA session's status in the registry.
func UpdateSessionStatus(db *sql.DB, sessionID, status, phone, pushName string) error {
	_, err := db.Exec(
		`UPDATE wa_sessions SET status = $1, phone = $2, push_name = $3, updated_at = NOW()
		 WHERE session_id = $4`,
		status, phone, pushName, sessionID,
	)
	if err != nil {
		return fmt.Errorf("update session status: %w", err)
	}
	return nil
}

// UpsertSession inserts or updates an OpenWA session record.
func UpsertSession(db *sql.DB, sessionID, name, status string) error {
	_, err := db.Exec(
		`INSERT INTO wa_sessions (session_id, name, status, created_at, updated_at)
		 VALUES ($1, $2, $3, NOW(), NOW())
		 ON CONFLICT (session_id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, updated_at = NOW()`,
		sessionID, name, status,
	)
	if err != nil {
		return fmt.Errorf("upsert session: %w", err)
	}
	return nil
}
