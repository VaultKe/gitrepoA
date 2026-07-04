package database

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"
)

// MigrationManager handles database migrations
type MigrationManager struct {
	db *sql.DB
}

// NewMigrationManager creates a new migration manager
func NewMigrationManager(db *sql.DB) *MigrationManager {
	return &MigrationManager{db: db}
}

// RunMigrations executes all pending migrations
func (m *MigrationManager) RunMigrations() error {
	log.Println("Starting database migrations...")

	if err := m.createMigrationsTable(); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	if err := m.runMigration("create_notification_system_tables", m.createNotificationSystemTables); err != nil {
		return fmt.Errorf("failed to run notification system migration: %w", err)
	}

	if err := m.runMigration("insert_default_notification_data", m.insertDefaultNotificationData); err != nil {
		return fmt.Errorf("failed to insert default notification data: %w", err)
	}

	if err := m.runMigration("insert_vibrate_sound", m.insertVibrateSound); err != nil {
		return fmt.Errorf("failed to insert vibrate sound: %w", err)
	}

	log.Println("All migrations completed successfully!")
	return nil
}

// insertVibrateSound inserts the 'Vibrate' notification sound if it doesn't exist.
func (m *MigrationManager) insertVibrateSound() error {
	var count int
	err := m.db.QueryRow("SELECT COUNT(*) FROM notification_sounds WHERE name = $1", "Vibrate").Scan(&count)
	if err != nil {
		return err
	}

	if count > 0 {
		log.Println("'Vibrate' notification sound already exists, skipping insertion.")
		return nil
	}

	log.Println("Inserting 'Vibrate' notification sound...")
	stmt, err := m.db.Prepare(`
		INSERT INTO notification_sounds (name, file_path, is_default, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	now := time.Now()
	_, err = stmt.Exec("Vibrate", "/notification_sound/vibrate.mp3", false, true, now, now)
	if err != nil {
		return err
	}

	log.Println("'Vibrate' notification sound inserted successfully!")
	return nil
}

// createMigrationsTable creates the migrations tracking table
func (m *MigrationManager) createMigrationsTable() error {
	query := `
		CREATE TABLE IF NOT EXISTS migrations (
			id SERIAL PRIMARY KEY,
			migration VARCHAR(255) NOT NULL UNIQUE,
			executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`
	_, err := m.db.Exec(query)
	return err
}

// runMigration executes a migration if it hasn't been run before
func (m *MigrationManager) runMigration(name string, migrationFunc func() error) error {
	var count int
	err := m.db.QueryRow("SELECT COUNT(*) FROM migrations WHERE migration = $1", name).Scan(&count)
	if err != nil {
		return err
	}

	if count > 0 {
		log.Printf("Migration '%s' already executed, skipping...", name)
		return nil
	}

	log.Printf("Running migration: %s", name)

	tx, err := m.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := migrationFunc(); err != nil {
		return fmt.Errorf("migration failed: %w", err)
	}

	_, err = tx.Exec("INSERT INTO migrations (migration) VALUES ($1)", name)
	if err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	log.Printf("Migration '%s' completed successfully!", name)
	return nil
}

// createNotificationSystemTables creates all notification system tables
func (m *MigrationManager) createNotificationSystemTables() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS notification_sounds (
			id SERIAL PRIMARY KEY,
			name VARCHAR(100) NOT NULL,
			file_path VARCHAR(255) NOT NULL,
			file_size INTEGER DEFAULT 0,
			duration_seconds REAL DEFAULT 0.00,
			is_default BOOLEAN DEFAULT false,
			is_active BOOLEAN DEFAULT true,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS user_notification_preferences (
			id SERIAL PRIMARY KEY,
			user_id TEXT NOT NULL,
			notification_sound_id INTEGER DEFAULT NULL,
			sound_enabled BOOLEAN DEFAULT true,
			vibration_enabled BOOLEAN DEFAULT true,
			volume_level INTEGER DEFAULT 80 CHECK (volume_level BETWEEN 0 AND 100),
			chama_notifications BOOLEAN DEFAULT true,
			transaction_notifications BOOLEAN DEFAULT true,
			reminder_notifications BOOLEAN DEFAULT true,
			system_notifications BOOLEAN DEFAULT true,
			quiet_hours_enabled BOOLEAN DEFAULT false,
			quiet_hours_start TIME DEFAULT '22:00:00',
			quiet_hours_end TIME DEFAULT '07:00:00',
			timezone VARCHAR(50) DEFAULT 'Africa/Nairobi',
			notification_frequency VARCHAR(20) DEFAULT 'immediate' CHECK (notification_frequency IN ('immediate', 'batched_15min', 'batched_1hour', 'daily_digest')),
			priority_only_during_quiet BOOLEAN DEFAULT true,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (notification_sound_id) REFERENCES notification_sounds(id) ON DELETE SET NULL,
			UNIQUE(user_id)
		)`,
		`CREATE TABLE IF NOT EXISTS notifications_new (
			id SERIAL PRIMARY KEY,
			user_id TEXT NOT NULL,
			title VARCHAR(255) NOT NULL,
			message TEXT NOT NULL,
			type VARCHAR(20) NOT NULL CHECK (type IN ('chama', 'transaction', 'reminder', 'system', 'alert')),
			priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
			category VARCHAR(100) DEFAULT NULL,
			reference_type VARCHAR(50) DEFAULT NULL,
			reference_id INTEGER DEFAULT NULL,
			status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
			is_read BOOLEAN DEFAULT false,
			read_at TIMESTAMP NULL,
			scheduled_for TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			sent_at TIMESTAMP NULL,
			delivered_at TIMESTAMP NULL,
			data TEXT DEFAULT NULL,
			sound_played BOOLEAN DEFAULT false,
			retry_count INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS notification_templates (
			id SERIAL PRIMARY KEY,
			name VARCHAR(100) NOT NULL UNIQUE,
			type VARCHAR(20) NOT NULL CHECK (type IN ('chama', 'transaction', 'reminder', 'system', 'alert')),
			category VARCHAR(100) NOT NULL,
			title_template VARCHAR(255) NOT NULL,
			message_template TEXT NOT NULL,
			default_priority VARCHAR(10) DEFAULT 'normal' CHECK (default_priority IN ('low', 'normal', 'high', 'urgent')),
			requires_sound BOOLEAN DEFAULT true,
			requires_vibration BOOLEAN DEFAULT true,
			variables TEXT DEFAULT NULL,
			is_active BOOLEAN DEFAULT true,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS user_reminders (
			id SERIAL PRIMARY KEY,
			user_id TEXT NOT NULL,
			title VARCHAR(255) NOT NULL,
			description TEXT DEFAULT NULL,
			reminder_datetime TIMESTAMP NOT NULL,
			timezone VARCHAR(50) DEFAULT 'Africa/Nairobi',
			is_recurring BOOLEAN DEFAULT false,
			recurrence_pattern VARCHAR(20) DEFAULT NULL CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly')),
			recurrence_interval INTEGER DEFAULT 1,
			recurrence_end_date DATE DEFAULT NULL,
			sound_enabled BOOLEAN DEFAULT true,
			vibration_enabled BOOLEAN DEFAULT true,
			custom_sound_id INTEGER DEFAULT NULL,
			status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'snoozed')),
			snooze_until TIMESTAMP NULL,
			completed_at TIMESTAMP NULL,
			category VARCHAR(100) DEFAULT 'personal',
			priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (custom_sound_id) REFERENCES notification_sounds(id) ON DELETE SET NULL
		)`,
	}

	for i, migration := range migrations {
		if _, err := m.db.Exec(migration); err != nil {
			log.Printf("Failed on migration %d: %v\nSQL: %s\n", i, err, migration)
			return fmt.Errorf("failed to execute migration %d: %w", i, err)
		}
	}

	if err := m.migrateExistingNotificationsTable(); err != nil {
		return fmt.Errorf("failed to migrate existing notifications table: %w", err)
	}

	notificationDeliveryLogSQL := `CREATE TABLE IF NOT EXISTS notification_delivery_log (
		id SERIAL PRIMARY KEY,
		notification_id INTEGER NOT NULL,
		user_id TEXT NOT NULL,
		delivery_method VARCHAR(20) NOT NULL CHECK (delivery_method IN ('push', 'sms', 'email', 'in_app')),
		status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
		attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		delivered_at TIMESTAMP NULL,
		error_message TEXT NULL,
		retry_count INTEGER DEFAULT 0,
		device_info TEXT DEFAULT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	)`
	if _, err := m.db.Exec(notificationDeliveryLogSQL); err != nil {
		return fmt.Errorf("failed to create notification_delivery_log table: %w", err)
	}

	if err := m.createIndexes(); err != nil {
		return fmt.Errorf("failed to create indexes: %w", err)
	}

	return nil
}

// migrateExistingNotificationsTable handles migration of existing notifications table
func (m *MigrationManager) migrateExistingNotificationsTable() error {
	var count int
	err := m.db.QueryRow("SELECT COUNT(*) FROM information_schema.tables WHERE table_name='notifications'").Scan(&count)
	if err != nil {
		return err
	}

	if count > 0 {
		rows, err := m.db.Query(`
			SELECT column_name
			FROM information_schema.columns
			WHERE table_name = 'notifications'
			ORDER BY ordinal_position
		`)
		if err != nil {
			return err
		}
		defer rows.Close()

		existingColumns := make(map[string]bool)
		for rows.Next() {
			var name string
			if err := rows.Scan(&name); err != nil {
				return err
			}
			existingColumns[name] = true
		}

		selectParts := []string{
			"CAST(id AS INTEGER) as id",
			"user_id",
			"title",
			"message",
			"CASE WHEN type IS NULL THEN 'system' ELSE type END as type",
			"COALESCE(is_read, FALSE) as is_read",
		}

		if existingColumns["read_at"] {
			selectParts = append(selectParts, "read_at")
		} else {
			selectParts = append(selectParts, "NULL as read_at")
		}

		selectParts = append(selectParts, "created_at")

		if existingColumns["updated_at"] {
			selectParts = append(selectParts, "COALESCE(updated_at, created_at) as updated_at")
		} else {
			selectParts = append(selectParts, "created_at as updated_at")
		}

		selectQuery := strings.Join(selectParts, ", ")

		copyQuery := fmt.Sprintf(`
			INSERT INTO notifications_new
			(id, user_id, title, message, type, is_read, read_at, created_at, updated_at)
			SELECT %s FROM notifications
			ON CONFLICT (id) DO NOTHING
		`, selectQuery)

		_, err = m.db.Exec(copyQuery)
		if err != nil {
			return fmt.Errorf("failed to copy data: %w", err)
		}

		// Use CASCADE to automatically drop dependent objects (e.g., notification_delivery_log
		// foreign key constraints) when dropping the old notifications table.
		// notification_delivery_log will be recreated by the CREATE TABLE IF NOT EXISTS below.
		if _, err = m.db.Exec("DROP TABLE IF EXISTS notifications CASCADE"); err != nil {
			return fmt.Errorf("failed to drop old table: %w", err)
		}

		log.Println("Migrated existing notifications table data")
	}

	_, err = m.db.Exec("ALTER TABLE notifications_new RENAME TO notifications")
	if err != nil {
		log.Println("Note: notifications table rename failed, might already be correct")
	}

	return nil
}

// createIndexes creates database indexes for better performance
func (m *MigrationManager) createIndexes() error {
	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_notification_sounds_is_default ON notification_sounds(is_default)",
		"CREATE INDEX IF NOT EXISTS idx_notification_sounds_is_active ON notification_sounds(is_active)",
		"CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_user_id ON user_notification_preferences(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_sound_enabled ON user_notification_preferences(sound_enabled)",
		"CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status)",
		"CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type)",
		"CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority)",
		"CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_for ON notifications(scheduled_for)",
		"CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)",
		"CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read)",
		"CREATE INDEX IF NOT EXISTS idx_notification_templates_type_category ON notification_templates(type, category)",
		"CREATE INDEX IF NOT EXISTS idx_notification_templates_is_active ON notification_templates(is_active)",
		"CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_notification_id ON notification_delivery_log(notification_id)",
		"CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_user_id ON notification_delivery_log(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_status ON notification_delivery_log(status)",
		"CREATE INDEX IF NOT EXISTS idx_user_reminders_user_id ON user_reminders(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_user_reminders_reminder_datetime ON user_reminders(reminder_datetime)",
		"CREATE INDEX IF NOT EXISTS idx_user_reminders_status ON user_reminders(status)",
		"CREATE INDEX IF NOT EXISTS idx_user_reminders_user_active ON user_reminders(user_id, status, reminder_datetime)",
	}

	for _, index := range indexes {
		if _, err := m.db.Exec(index); err != nil {
			log.Printf("Warning: Failed to create index: %v", err)
		}
	}

	return nil
}

// insertDefaultNotificationData inserts default sounds and templates
func (m *MigrationManager) insertDefaultNotificationData() error {
	if err := m.insertDefaultSounds(); err != nil {
		return fmt.Errorf("failed to insert default sounds: %w", err)
	}
	if err := m.insertDefaultTemplates(); err != nil {
		return fmt.Errorf("failed to insert default templates: %w", err)
	}
	return nil
}

// insertDefaultSounds inserts or updates default notification sounds
func (m *MigrationManager) insertDefaultSounds() error {
	sounds := []struct {
		name      string
		filePath  string
		isDefault bool
		isActive  bool
	}{
		{"Default Ring", "/notification_sound/ring.mp3", true, true},
		{"Gentle Bell", "/notification_sound/bell.mp3", false, true},
		{"Alert Tone", "/notification_sound/alert.mp3", false, true},
		{"Chime", "/notification_sound/chime.mp3", false, true},
		{"Vibrate", "/notification_sound/vibrate.mp3", false, true},
		{"Silent", "", false, true},
	}

	tx, err := m.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now()

	for _, sound := range sounds {
		var id int
		err := tx.QueryRow("SELECT id FROM notification_sounds WHERE name = $1", sound.name).Scan(&id)
		if err != nil {
			if err == sql.ErrNoRows {
				_, err = tx.Exec(`
					INSERT INTO notification_sounds (name, file_path, is_default, is_active, created_at, updated_at)
					VALUES ($1, $2, $3, $4, $5, $6)
				`, sound.name, sound.filePath, sound.isDefault, sound.isActive, now, now)
				if err != nil {
					return fmt.Errorf("failed to insert sound %s: %w", sound.name, err)
				}
			} else {
				return fmt.Errorf("failed to query for sound %s: %w", sound.name, err)
			}
		} else {
			_, err = tx.Exec(`
				UPDATE notification_sounds
				SET file_path = $1, is_default = $2, is_active = $3, updated_at = $4
				WHERE id = $5
			`, sound.filePath, sound.isDefault, sound.isActive, now, id)
			if err != nil {
				return fmt.Errorf("failed to update sound %s: %w", sound.name, err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	log.Println("Default notification sounds successfully upserted!")
	return nil
}

// insertDefaultTemplates inserts default notification templates
func (m *MigrationManager) insertDefaultTemplates() error {
	var count int
	err := m.db.QueryRow("SELECT COUNT(*) FROM notification_templates").Scan(&count)
	if err != nil {
		return err
	}

	if count > 0 {
		log.Println("Notification templates already exist, skipping default template insertion.")
		return nil
	}

	templates := []struct {
		name            string
		notifType       string
		category        string
		titleTemplate   string
		messageTemplate string
		defaultPriority string
		variables       string
	}{
		{
			"chama_payment_due", "chama", "payment_due",
			"Payment Due: {chama_name}",
			"Your contribution of KSh {amount} for {chama_name} is due on {due_date}.",
			"high", `["chama_name", "amount", "due_date"]`,
		},
		{
			"transaction_received", "transaction", "deposit_received",
			"Payment Received",
			"You have received KSh {amount} from {sender_name}.",
			"normal", `["amount", "sender_name"]`,
		},
		{
			"meeting_reminder", "reminder", "meeting",
			"Meeting Reminder: {chama_name}",
			"Don't forget about the {chama_name} meeting scheduled for {meeting_time}.",
			"high", `["chama_name", "meeting_time"]`,
		},
		{
			"system_maintenance", "system", "maintenance",
			"System Maintenance",
			"VaultKe will undergo maintenance from {start_time} to {end_time}. Some features may be unavailable.",
			"normal", `["start_time", "end_time"]`,
		},
	}

	stmt, err := m.db.Prepare(`
		INSERT INTO notification_templates
		(name, type, category, title_template, message_template, default_priority, variables, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	now := time.Now()
	for _, template := range templates {
		_, err = stmt.Exec(
			template.name, template.notifType, template.category,
			template.titleTemplate, template.messageTemplate,
			template.defaultPriority, template.variables, now, now,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

// GetMigrationStatus returns the status of all migrations
func (m *MigrationManager) GetMigrationStatus() ([]map[string]interface{}, error) {
	rows, err := m.db.Query("SELECT migration, executed_at FROM migrations ORDER BY executed_at ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var migrations []map[string]interface{}
	for rows.Next() {
		var migration string
		var executedAt time.Time

		if err := rows.Scan(&migration, &executedAt); err != nil {
			return nil, err
		}

		migrations = append(migrations, map[string]interface{}{
			"migration":   migration,
			"executed_at": executedAt,
		})
	}

	return migrations, nil
}

// IsNotificationSystemReady checks if the notification system is properly set up
func (m *MigrationManager) IsNotificationSystemReady() (bool, error) {
	var defaultSoundCount int
	err := m.db.QueryRow("SELECT COUNT(*) FROM notification_sounds WHERE is_default = 1").Scan(&defaultSoundCount)
	if err != nil {
		return false, err
	}

	var templateCount int
	err = m.db.QueryRow("SELECT COUNT(*) FROM notification_templates").Scan(&templateCount)
	if err != nil {
		return false, err
	}

	return defaultSoundCount > 0 && templateCount > 0, nil
}
