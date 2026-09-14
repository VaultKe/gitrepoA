package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

func MigrateApkVersions(db *sql.DB) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS apk_versions (
			id SERIAL PRIMARY KEY,
			version_code INTEGER NOT NULL,
			version_name VARCHAR(100) NOT NULL,
			file_name VARCHAR(255) NOT NULL,
			file_path VARCHAR(500) NOT NULL,
			file_size BIGINT NOT NULL,
			release_notes TEXT DEFAULT '',
			is_mandatory BOOLEAN DEFAULT FALSE,
			is_active BOOLEAN DEFAULT TRUE,
			is_latest BOOLEAN DEFAULT FALSE,
			uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			upload_ip TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(version_code)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_apk_versions_is_latest ON apk_versions(is_latest)`,
		`CREATE INDEX IF NOT EXISTS idx_apk_versions_version_code ON apk_versions(version_code DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_apk_versions_created_at ON apk_versions(created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_apk_versions_is_active ON apk_versions(is_active)`,
	}

	for i, q := range queries {
		if _, err := db.Exec(q); err != nil {
			log.Printf("Failed on apk_versions migration %d: %v", i, err)
			return fmt.Errorf("failed to execute apk_versions migration %d: %w", i, err)
		}
	}

	log.Println("APK versions migrations completed successfully")
	return nil
}

func SeedLatestApkVersion(db *sql.DB) error {
	var count int
	err := db.QueryRow(`
		SELECT COUNT(*) FROM apk_versions WHERE is_latest = TRUE AND is_active = TRUE
	`).Scan(&count)
	if err != nil {
		return err
	}

	if count == 0 {
		var maxCode int
		err = db.QueryRow(`
			SELECT COALESCE(MAX(version_code), 0) FROM apk_versions
		`).Scan(&maxCode)
		if err == nil && maxCode > 0 {
			_, _ = db.Exec(`
				UPDATE apk_versions SET is_latest = TRUE WHERE version_code = $1
			`, maxCode)
		}
	}

	return nil
}

func EnsureApkVersionsLatest(db *sql.DB) error {
	var anyLatest int
	if err := db.QueryRow(`
		SELECT COUNT(*) FROM apk_versions WHERE is_latest = TRUE AND is_active = TRUE
	`).Scan(&anyLatest); err != nil {
		return err
	}

	if anyLatest == 0 {
		var maxCode int
		if err := db.QueryRow(`
			SELECT COALESCE(MAX(version_code), 0) FROM apk_versions WHERE is_active = TRUE
		`).Scan(&maxCode); err == nil && maxCode > 0 {
			_, _ = db.Exec(`
				UPDATE apk_versions SET is_latest = TRUE WHERE version_code = $1
			`, maxCode)
		}
	}

	return nil
}
