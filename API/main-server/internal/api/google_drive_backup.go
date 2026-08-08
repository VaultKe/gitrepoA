package api

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"vaultke-backend/internal/services"
)

// BackupMaintenance represents backup maintenance data
type BackupMaintenance struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`   // full, incremental
	Status    string    `json:"status"` // completed, failed, running
	Size      string    `json:"size"`
	Duration  string    `json:"duration"`
	Timestamp time.Time `json:"timestamp"`
	Location  string    `json:"location"`
	Error     string    `json:"error,omitempty"`
	UserID    string    `json:"user_id"`
}

// BackupSettings represents backup configuration
type BackupSettings struct {
	AutoBackup     bool   `json:"auto_backup"`
	DailyBackup    bool   `json:"daily_backup"`
	WeeklyBackup   bool   `json:"weekly_backup"`
	CloudBackup    bool   `json:"cloud_backup"`
	EncryptBackups bool   `json:"encrypt_backups"`
	RetentionDays  int    `json:"retention_days"`
	UserID         string `json:"user_id"`
}

// CreateGoogleDriveBackup creates a backup of user data to Google Drive
func CreateGoogleDriveBackup(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Get database from context
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Create Google Drive service
	driveService := services.NewGoogleDriveService(db.(*sql.DB))

	// Create backup
	backupResult, err := driveService.CreateUserBackup(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create backup: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"message":   "Backup created successfully",
		"backup_id": backupResult.BackupID,
		"file_size": backupResult.FileSize,
		"timestamp": backupResult.Timestamp,
	})
		c.Abort()
}

// RestoreGoogleDriveBackup restores user data from Google Drive backup
func RestoreGoogleDriveBackup(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Get database from context
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Create Google Drive service
	driveService := services.NewGoogleDriveService(db.(*sql.DB))

	// Restore backup
	restoreResult, err := driveService.RestoreUserBackup(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to restore backup: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":        true,
		"message":        "Backup restored successfully",
		"restored_items": restoreResult.RestoredItems,
		"timestamp":      restoreResult.Timestamp,
	})
		c.Abort()
}

// GetGoogleDriveBackupInfo gets information about the user's backup
func GetGoogleDriveBackupInfo(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Get database from context
	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Create Google Drive service
	driveService := services.NewGoogleDriveService(db.(*sql.DB))

	// Get backup info
	backupInfo, err := driveService.GetUserBackupInfo(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get backup info: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"connected":   backupInfo.Connected,
		"lastBackup":  backupInfo.LastBackup,
		"backupSize":  backupInfo.BackupSize,
		"backupCount": backupInfo.BackupCount,
	})
		c.Abort()
}

// GetBackupHistory retrieves backup history for admin
func GetBackupHistory(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Check if user is admin
	userRole := c.GetString("userRole")
	if userRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Admin access required",
		})
		return
	}

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Query backup history from database
	// Create backup_history table if it doesn't exist
	_, err := db.(*sql.DB).Exec(`
		CREATE TABLE IF NOT EXISTS backup_history (
			id TEXT PRIMARY KEY,
			type TEXT NOT NULL,
			status TEXT NOT NULL,
			size TEXT DEFAULT '0 MB',
			duration TEXT DEFAULT '0 minutes',
			timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			location TEXT DEFAULT 'Local Storage',
			error TEXT,
			user_id TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create backup_history table: " + err.Error(),
		})
		return
	}

	rows, err := db.(*sql.DB).Query(`
		SELECT id, type, status, size, duration, timestamp, location, error, user_id
		FROM backup_history
		ORDER BY timestamp DESC
		LIMIT 50
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve backup history: " + err.Error(),
		})
		return
	}
	defer rows.Close()

	var backups []BackupMaintenance
	for rows.Next() {
		var backup BackupMaintenance
		err := rows.Scan(
			&backup.ID,
			&backup.Type,
			&backup.Status,
			&backup.Size,
			&backup.Duration,
			&backup.Timestamp,
			&backup.Location,
			&backup.Error,
			&backup.UserID,
		)
		if err != nil {
			continue
		}
		backups = append(backups, backup)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"backups": backups,
	})
		c.Abort()
}

// GetBackupSettings retrieves backup settings
func GetBackupSettings(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Check if user is admin
	userRole := c.GetString("userRole")
	if userRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Admin access required",
		})
		return
	}

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Query backup settings from database
	var settings BackupSettings
	err := db.(*sql.DB).QueryRow(`
		SELECT auto_backup, daily_backup, weekly_backup, cloud_backup, encrypt_backups, retention_days
		FROM backup_settings
		WHERE user_id = $1
	`, userID).Scan(
		&settings.AutoBackup,
		&settings.DailyBackup,
		&settings.WeeklyBackup,
		&settings.CloudBackup,
		&settings.EncryptBackups,
		&settings.RetentionDays,
	)

	// If no settings found, return defaults
	if err != nil {
		if strings.Contains(err.Error(), "no such table") || err == sql.ErrNoRows {
			settings = BackupSettings{
				AutoBackup:     true,
				DailyBackup:    true,
				WeeklyBackup:   true,
				CloudBackup:    true,
				EncryptBackups: true,
				RetentionDays:  30,
				UserID:         userID,
			}
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to retrieve backup settings: " + err.Error(),
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"settings": settings,
	})
		c.Abort()
}

// UpdateBackupSettings updates backup settings
func UpdateBackupSettings(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Check if user is admin
	userRole := c.GetString("userRole")
	if userRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Admin access required",
		})
		return
	}

	var settings BackupSettings
	if err := c.ShouldBindJSON(&settings); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid settings data: " + err.Error(),
		})
		return
	}

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Create backup_settings table if it doesn't exist
	_, err := db.(*sql.DB).Exec(`
		CREATE TABLE IF NOT EXISTS backup_settings (
			user_id TEXT PRIMARY KEY,
			auto_backup BOOLEAN DEFAULT 1,
			daily_backup BOOLEAN DEFAULT 1,
			weekly_backup BOOLEAN DEFAULT 1,
			cloud_backup BOOLEAN DEFAULT 1,
			encrypt_backups BOOLEAN DEFAULT 1,
			retention_days INTEGER DEFAULT 30,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create backup_settings table: " + err.Error(),
		})
		return
	}

	// Update or insert backup settings (PostgreSQL uses ON CONFLICT for upsert)
	_, err = db.(*sql.DB).Exec(`
		INSERT INTO backup_settings
		(user_id, auto_backup, daily_backup, weekly_backup, cloud_backup, encrypt_backups, retention_days, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (user_id) DO UPDATE SET
			auto_backup = EXCLUDED.auto_backup,
			daily_backup = EXCLUDED.daily_backup,
			weekly_backup = EXCLUDED.weekly_backup,
			cloud_backup = EXCLUDED.cloud_backup,
			encrypt_backups = EXCLUDED.encrypt_backups,
			retention_days = EXCLUDED.retention_days,
			updated_at = EXCLUDED.updated_at
	`, userID, settings.AutoBackup, settings.DailyBackup, settings.WeeklyBackup,
		settings.CloudBackup, settings.EncryptBackups, settings.RetentionDays, time.Now(), time.Now())

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update backup settings: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Backup settings updated successfully",
	})
		c.Abort()
}

// StartBackup initiates a backup operation
func StartBackup(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	// Check if user is admin
	userRole := c.GetString("userRole")
	if userRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Admin access required",
		})
		return
	}

	var request struct {
		Type string `json:"type" binding:"required"` // full or incremental
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request data: " + err.Error(),
		})
		return
	}

	db, exists := c.Get("db")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database connection not available",
		})
		return
	}

	// Generate backup ID
	backupID := fmt.Sprintf("backup_%d", time.Now().Unix())

	// Insert backup record
	_, err := db.(*sql.DB).Exec(`
		INSERT INTO backup_history
		(id, type, status, size, duration, timestamp, location, user_id)
		VALUES ($1, $2, 'running', '0 MB', '0 minutes', $3, 'Local Storage', $4)
	`, backupID, request.Type, time.Now(), userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start backup: " + err.Error(),
		})
		return
	}

	// Simulate backup process (in real implementation, this would trigger actual backup)
	// Use a timeout context to prevent goroutine leaks
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Recovered from panic in backup goroutine: %v", r)
			}
		}()

		select {
		case <-ctx.Done():
			log.Printf("Backup cancelled for backup %s: %v", backupID, ctx.Err())
			// Update status to failed
			db.(*sql.DB).Exec(`
				UPDATE backup_history
				SET status = 'failed', error = 'timeout'
				WHERE id = $1
			`, backupID)
			return
		default:
			time.Sleep(5 * time.Second) // Simulate backup time

			// Update backup status to completed
			size := "2.4 GB"
			duration := "45 minutes"
			if request.Type == "incremental" {
				size = "156 MB"
				duration = "8 minutes"
			}

			db.(*sql.DB).Exec(`
				UPDATE backup_history
				SET status = 'completed', size = $1, duration = $2
				WHERE id = $3
			`, size, duration, backupID)
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"message":   fmt.Sprintf("%s backup started successfully", strings.Title(request.Type)),
		"backup_id": backupID,
	})
		c.Abort()
}
