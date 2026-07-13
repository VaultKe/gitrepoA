package api

import (
	"database/sql"
	"fmt"
	"time"
)

// ensureDevicesTable makes sure the (enriched) devices table exists. The
// startup migration already creates it, but this keeps the upsert path
// self-contained and safe if it is ever called before migrations run.
func ensureDevicesTable(db *sql.DB) {
	createQuery := `
		CREATE TABLE IF NOT EXISTS devices (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			device_id INTEGER NOT NULL,
			device_name TEXT,
			device_type TEXT,
			ip_address TEXT,
			os_version TEXT,
			app_version TEXT,
			manufacturer TEXT,
			model TEXT,
			locale TEXT,
			timezone TEXT,
			registration_id INTEGER,
			signed_pre_key_id INTEGER,
			last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			last_login_at TIMESTAMP,
			is_active BOOLEAN DEFAULT TRUE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
			UNIQUE(user_id, device_id)
		)
	`
	if _, err := db.Exec(createQuery); err != nil {
		fmt.Printf("ensureDevicesTable: failed to create devices table: %v\n", err)
	}
}

func UpsertUserDevice(
	db *sql.DB,
	userID, deviceUID, deviceName, deviceType, ipAddress,
	osVersion, appVersion, manufacturer, model, locale, timezone string,
) (bool, error) {
	if userID == "" || deviceUID == "" {
		return false, fmt.Errorf("userID and deviceUID are required")
	}

	ensureDevicesTable(db)

	now := time.Now()

	var existingDeviceID int
	err := db.QueryRow(
		"SELECT device_id FROM devices WHERE user_id = $1 AND id = $2",
		userID, deviceUID,
	).Scan(&existingDeviceID)

	if err == sql.ErrNoRows {
		// New device: assign the next free integer device_id for this user.
		var maxID int
		if err := db.QueryRow(
			"SELECT COALESCE(MAX(device_id), 0) FROM devices WHERE user_id = $1",
			userID,
		).Scan(&maxID); err != nil {
			return false, fmt.Errorf("failed to compute device_id: %w", err)
		}
		newDeviceID := maxID + 1

		insertQuery := `
			INSERT INTO devices
				(id, user_id, device_id, device_name, device_type, ip_address,
				 os_version, app_version, manufacturer, model, locale, timezone,
				 last_seen, last_login_at, is_active, created_at, updated_at)
			VALUES
				($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
				 $13, $13, TRUE, $13, $13)
		`
		if _, err := db.Exec(
			insertQuery,
			deviceUID, userID, newDeviceID, deviceName, deviceType, ipAddress,
			osVersion, appVersion, manufacturer, model, locale, timezone,
			now,
		); err != nil {
			return false, fmt.Errorf("failed to insert device: %w", err)
		}
		return true, nil
	} else if err != nil {
		return false, fmt.Errorf("failed to look up device: %w", err)
	}

	// Existing device: refresh its details / activity on every login.
	updateQuery := `
		UPDATE devices
		SET device_name = $3,
			device_type = $4,
			ip_address = $5,
			os_version = $6,
			app_version = $7,
			manufacturer = $8,
			model = $9,
			locale = $10,
			timezone = $11,
			last_seen = $12,
			last_login_at = $12,
			is_active = TRUE,
			updated_at = $12
		WHERE user_id = $1 AND id = $2
	`
	if _, err := db.Exec(
		updateQuery,
		userID, deviceUID, deviceName, deviceType, ipAddress,
		osVersion, appVersion, manufacturer, model, locale, timezone,
		now,
	); err != nil {
		return false, fmt.Errorf("failed to update device: %w", err)
	}
	return false, nil
}

// GetUserDevices returns the registered devices for a user, most recently
// active first. Used by security screens and for new-device detection.
func GetUserDevices(db *sql.DB, userID string) ([]map[string]interface{}, error) {
	rows, err := db.Query(`
		SELECT id, device_id, device_name, device_type, ip_address,
		       os_version, app_version, manufacturer, model, locale, timezone,
		       last_seen, last_login_at, is_active
		FROM devices
		WHERE user_id = $1
		ORDER BY last_login_at DESC NULLS LAST, last_seen DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	devices := []map[string]interface{}{}
	for rows.Next() {
		var (
			id, deviceName, deviceType, ip, osVer, appVer, manuf, model, locale, tz sql.NullString
			deviceID                                                               int
			lastSeen, lastLogin                                                   sql.NullTime
			isActive                                                              sql.NullBool
		)
		if err := rows.Scan(
			&id, &deviceID, &deviceName, &deviceType, &ip,
			&osVer, &appVer, &manuf, &model, &locale, &tz,
			&lastSeen, &lastLogin, &isActive,
		); err != nil {
			continue
		}
		devices = append(devices, map[string]interface{}{
			"deviceUid":    id.String,
			"deviceId":     deviceID,
			"deviceName":   deviceName.String,
			"deviceType":   deviceType.String,
			"ipAddress":    ip.String,
			"osVersion":    osVer.String,
			"appVersion":   appVer.String,
			"manufacturer": manuf.String,
			"model":        model.String,
			"locale":       locale.String,
			"timezone":     tz.String,
			"lastSeen":     lastSeen.Time,
			"lastLoginAt":  lastLogin.Time,
			"isActive":     isActive.Bool,
		})
	}
	return devices, nil
}
