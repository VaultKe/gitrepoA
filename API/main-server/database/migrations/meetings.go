package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

func MigrateMeetings(db *sql.DB) error {
	queries := []string{
		createMeetingsTable,
		createMeetingAttendanceTable,
		createMeetingDocumentsTable,
		createMeetingMinutesTable,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("meetings migration failed: %w", err)
		}
	}

	if err := addMissingMeetingDocumentFileUrl(db); err != nil {
		return err
	}

	log.Println("Meetings migrations completed successfully")
	return nil
}

const addMeetingDocumentFileUrl = `-- This is handled by addMissingMeetingDocumentFileUrl function`

const createMeetingsTable = `
CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMP NOT NULL,
    duration INTEGER, -- in minutes
    location TEXT,
    meeting_url TEXT,
    meeting_type TEXT NOT NULL DEFAULT 'physical', -- 'physical', 'virtual', 'hybrid'
    room_name TEXT, -- Room identifier
    status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'active', 'ended', 'cancelled'
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    recording_enabled BOOLEAN DEFAULT FALSE,
    recording_url TEXT,
    transcript_url TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chama_id) REFERENCES chamas(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);`

const createMeetingAttendanceTable = `
CREATE TABLE IF NOT EXISTS meeting_attendance (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    attendance_type TEXT NOT NULL, -- 'physical', 'virtual'
    joined_at TIMESTAMP,
    left_at TIMESTAMP,
    duration_minutes INTEGER DEFAULT 0,
    is_present BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(meeting_id, user_id)
);`

const createMeetingDocumentsTable = `
CREATE TABLE IF NOT EXISTS meeting_documents (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    document_type TEXT, -- 'agenda', 'minutes', 'attachment', 'recording'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);`

const createMeetingMinutesTable = `
CREATE TABLE IF NOT EXISTS meeting_minutes (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    content TEXT NOT NULL,
    taken_by TEXT NOT NULL, -- Secretary or authorized user
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'approved', 'published'
    approved_by TEXT,
    approved_at TIMESTAMP,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id),
    FOREIGN KEY (taken_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);`

func addMissingMeetingDocumentFileUrl(db *sql.DB) error {
	var hasFileUrl bool
	err := db.QueryRow("SELECT COUNT(*) > 0 FROM information_schema.columns WHERE table_name = 'meeting_documents' AND column_name = 'file_url'").Scan(&hasFileUrl)
	if err != nil {
		return fmt.Errorf("failed to check if file_url column exists: %w", err)
	}

	if !hasFileUrl {
		log.Println("Adding file_url column to meeting_documents table...")
		_, err = db.Exec("ALTER TABLE meeting_documents ADD COLUMN file_url TEXT")
		if err != nil {
			return fmt.Errorf("failed to add file_url column: %w", err)
		}
		log.Println("Successfully added file_url column to meeting_documents table")
	} else {
		log.Println("file_url column already exists in meeting_documents table")
	}

	return nil
}
