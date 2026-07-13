package migrations

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"
)

func MigrateChat(db *sql.DB) error {
	queries := []string{
		createChatRoomsTable,
		createChatMessagesTable,
		createChatRoomMembersTable,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("chat migration failed: %w", err)
		}
	}

	if err := addMissingChatMessageFields(db); err != nil {
		return err
	}
	if err := addMissingChatRoomFields(db); err != nil {
		return err
	}
	if err := updateChatMessageStorage(db); err != nil {
		return err
	}
	if err := refactorChatMessageContent(db); err != nil {
		return err
	}
	if err := addChatIndexes(db); err != nil {
		return err
	}
	if err := deduplicateChamaChatRooms(db); err != nil {
		return err
	}
	if err := addChamaChatRoomUniqueIndex(db); err != nil {
		return err
	}

	log.Println("Chat migrations completed successfully")
	return nil
}

const addChatMessageFields = "SELECT 1"

const addChatRoomFields = "SELECT 1"

const createChatRoomsTable = `
CREATE TABLE IF NOT EXISTS chat_rooms (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT NOT NULL, -- 'private', 'group', 'chama'
    chama_id TEXT,
    created_by TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_message TEXT,
    last_message_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chama_id) REFERENCES chamas(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);`

const createChatMessagesTable = `
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    message TEXT,
    content TEXT,
    type TEXT DEFAULT 'text',
    message_type TEXT DEFAULT 'text', -- 'text', 'image', 'file', 'voice'
    image_url TEXT,
    image_urls JSONB,
    metadata TEXT DEFAULT '{}',
    file_url TEXT,
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    reply_to TEXT,
    reply_to_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (reply_to) REFERENCES chat_messages(id),
    FOREIGN KEY (reply_to_id) REFERENCES chat_messages(id)
);`

const createChatRoomMembersTable = `
CREATE TABLE IF NOT EXISTS chat_room_members (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    is_muted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(room_id, user_id)
);`

func addMissingChatMessageFields(db *sql.DB) error {
	columns := []struct {
		name         string
		dataType     string
		defaultValue string
	}{
		{"content", "TEXT", "''"},
		{"type", "TEXT", "'text'"},
		{"metadata", "TEXT", "'{}'"},
		{"is_deleted", "BOOLEAN", "FALSE"},
		{"reply_to_id", "TEXT", "NULL"},
	}

	for _, col := range columns {
		var exists bool
		query := `SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = $1`
		err := db.QueryRow(query, col.name).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to check if column %s exists: %w", col.name, err)
		}

		if !exists {
			alterQuery := fmt.Sprintf("ALTER TABLE chat_messages ADD COLUMN %s %s DEFAULT %s", col.name, col.dataType, col.defaultValue)
			if _, err := db.Exec(alterQuery); err != nil {
				return fmt.Errorf("failed to add column %s: %w", col.name, err)
			}
			log.Printf("Added column %s to chat_messages table", col.name)
		} else {
			log.Printf("Column %s already exists in chat_messages table", col.name)
		}
	}

	updateQuery := `UPDATE chat_messages SET content = message WHERE content = '' OR content IS NULL`
	if _, err := db.Exec(updateQuery); err != nil {
		log.Printf("Warning: failed to update content from message: %v", err)
	} else {
		log.Printf("Updated content field from message field for existing records")
	}

	updateQuery2 := `UPDATE chat_messages SET message = content WHERE message = '' OR message IS NULL`
	if _, err := db.Exec(updateQuery2); err != nil {
		log.Printf("Warning: failed to update message from content: %v", err)
	} else {
		log.Printf("Updated message field from content field for compatibility")
	}

	return nil
}

func addMissingChatRoomFields(db *sql.DB) error {
	columns := []struct {
		name         string
		dataType     string
		defaultValue string
	}{
		{"is_active", "BOOLEAN", "TRUE"},
		{"last_message", "TEXT", "NULL"},
		{"last_message_at", "TIMESTAMP", "NULL"},
		{"updated_at", "TIMESTAMP", "CURRENT_TIMESTAMP"},
	}

	for _, col := range columns {
		var exists bool
		query := `SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'chat_rooms' AND column_name = $1`
		err := db.QueryRow(query, col.name).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to check if column %s exists: %w", col.name, err)
		}

		if !exists {
			alterQuery := fmt.Sprintf("ALTER TABLE chat_rooms ADD COLUMN %s %s DEFAULT %s", col.name, col.dataType, col.defaultValue)
			if _, err := db.Exec(alterQuery); err != nil {
				return fmt.Errorf("failed to add column %s: %w", col.name, err)
			}
			log.Printf("Added column %s to chat_rooms table", col.name)
		} else {
			log.Printf("Column %s already exists in chat_rooms table", col.name)
		}
	}

	return nil
}

func updateChatMessageStorage(db *sql.DB) error {
	var exists bool
	query := `SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'encryption_metadata'`
	err := db.QueryRow(query).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if encryption_metadata column exists: %w", err)
	}

	if !exists {
		alterQuery := `ALTER TABLE chat_messages ADD COLUMN encryption_metadata TEXT DEFAULT '{}'`
		if _, err := db.Exec(alterQuery); err != nil {
			return fmt.Errorf("failed to add encryption_metadata column: %w", err)
		}
		log.Printf("Added encryption_metadata column to chat_messages table")
	}

	rows, err := db.Query(`SELECT id, message FROM chat_messages`)
	if err != nil {
		return fmt.Errorf("failed to query chat messages: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		var message string
		if err := rows.Scan(&id, &message); err != nil {
			return err
		}

		var msgData map[string]interface{}
		if err := json.Unmarshal([]byte(message), &msgData); err != nil {
			continue
		}

		if ciphertext, ok := msgData["ciphertext"]; ok {
			delete(msgData, "ciphertext")
			if _, hasContent := msgData["content"]; hasContent {
				delete(msgData, "content")
			}
			metaBytes, _ := json.Marshal(msgData)
			updateQuery := `UPDATE chat_messages SET message = $1, encryption_metadata = $2 WHERE id = $3`
			if _, err := db.Exec(updateQuery, ciphertext, string(metaBytes), id); err != nil {
				return fmt.Errorf("failed to update message %s: %w", id, err)
			}
		} else if content, ok := msgData["content"]; ok {
			updateQuery := `UPDATE chat_messages SET message = $1 WHERE id = $2`
			if _, err := db.Exec(updateQuery, content, id); err != nil {
				return fmt.Errorf("failed to update message %s: %w", id, err)
			}
		}
	}

	log.Printf("Refactored chat messages to reduce redundancy")
	return nil
}

func refactorChatMessageContent(db *sql.DB) error {
	log.Printf("Starting chat message content refactor...")

	rows, err := db.Query(`SELECT id, content FROM chat_messages WHERE content LIKE '{%'`)
	if err != nil {
		return fmt.Errorf("failed to query chat messages: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		var content string
		if err := rows.Scan(&id, &content); err != nil {
			return err
		}

		var contentData map[string]interface{}
		if err := json.Unmarshal([]byte(content), &contentData); err != nil {
			continue
		}

		if ciphertext, ok := contentData["ciphertext"]; ok {
			if cipherStr, ok := ciphertext.(string); ok {
				encryptionMeta := make(map[string]interface{})
				for k, v := range contentData {
					if k != "ciphertext" {
						encryptionMeta[k] = v
					}
				}

				metaBytes, _ := json.Marshal(encryptionMeta)
				updateQuery := `UPDATE chat_messages SET content = $1, metadata = $2 WHERE id = $3`
				if _, err := db.Exec(updateQuery, cipherStr, string(metaBytes), id); err != nil {
					return fmt.Errorf("failed to update message %s: %w", id, err)
				}
			}
		}
	}

	log.Printf("Refactored chat message content to store only ciphertext")
	return nil
}

func addChatIndexes(db *sql.DB) error {
	queries := []string{
		`CREATE INDEX IF NOT EXISTS idx_chat_rooms_type_chama ON chat_rooms(type, chama_id) WHERE type = 'chama' AND is_active = TRUE`,
		`CREATE INDEX IF NOT EXISTS idx_chat_rooms_members_user ON chat_room_members(user_id, is_active)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON chat_messages(room_id, created_at DESC)`,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("failed to create chat index: %w", err)
		}
	}
	log.Println("Chat indexes created")
	return nil
}

func deduplicateChamaChatRooms(db *sql.DB) error {
	rows, err := db.Query(`
		SELECT cr.chama_id, cr.id, cr.created_at, c.chat_room_id
		FROM chat_rooms cr
		LEFT JOIN chamas c ON c.id = cr.chama_id
		WHERE cr.type = 'chama' AND cr.is_active = TRUE
		ORDER BY cr.chama_id, cr.created_at ASC
	`)
	if err != nil {
		return fmt.Errorf("failed to query chama rooms for dedup: %w", err)
	}
	defer rows.Close()

	type chamaRoom struct {
		chamaID    string
		roomID     string
		createdAt  time.Time
		chatRoomID sql.NullString
	}

	var rooms []chamaRoom
	for rows.Next() {
		var r chamaRoom
		var chamaID sql.NullString
		var createdAt sql.NullTime
		var chatRoomID sql.NullString
		if err := rows.Scan(&chamaID, &r.roomID, &createdAt, &chatRoomID); err != nil {
			return fmt.Errorf("failed to scan chama room: %w", err)
		}
		if !chamaID.Valid {
			continue
		}
		r.chamaID = chamaID.String
		r.createdAt = createdAt.Time
		r.chatRoomID = chatRoomID
		rooms = append(rooms, r)
	}

	chamaGroups := make(map[string][]chamaRoom)
	for _, r := range rooms {
		chamaGroups[r.chamaID] = append(chamaGroups[r.chamaID], r)
	}

	for chamaID, roomList := range chamaGroups {
		if len(roomList) <= 1 {
			continue
		}

		primaryID := ""
		for _, r := range roomList {
			if r.chatRoomID.Valid && r.chatRoomID.String == r.roomID {
				primaryID = r.roomID
				break
			}
		}
		if primaryID == "" {
			primaryID = roomList[0].roomID
		}

		for _, r := range roomList {
			if r.roomID == primaryID {
				continue
			}
			_, err := db.Exec(`UPDATE chat_rooms SET is_active = FALSE WHERE id = $1`, r.roomID)
			if err != nil {
				return fmt.Errorf("failed to deactivate duplicate room %s for chama %s: %w", r.roomID, chamaID, err)
			}
			log.Printf("Deactivated duplicate chat room %s for chama %s", r.roomID, chamaID)
		}
	}

	return nil
}

func addChamaChatRoomUniqueIndex(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_rooms_chama_id_unique 
		ON chat_rooms(chama_id) 
		WHERE type = 'chama' AND is_active = TRUE
	`)
	if err != nil {
		return fmt.Errorf("failed to create chama chat room unique index: %w", err)
	}
	log.Println("Chama chat room unique index created")
	return nil
}
