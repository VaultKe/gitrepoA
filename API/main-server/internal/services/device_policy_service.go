package services

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"vaultke-backend/internal/models"
)

// DevicePolicyService handles single-device enforcement and device security policies
type DevicePolicyService struct {
	db            *sql.DB
	authService   *AuthService
	emailService  *EmailService
}

// NewDevicePolicyService creates a new device policy service
func NewDevicePolicyService(db *sql.DB, authService *AuthService, emailService *EmailService) *DevicePolicyService {
	return &DevicePolicyService{
		db:           db,
		authService:  authService,
		emailService: emailService,
	}
}

// ActiveDeviceResult contains the result of single-device enforcement
type ActiveDeviceResult struct {
	PreviousDeviceLoggedOut bool
	PreviousDeviceName      string
	PreviousDeviceUID       string
	PreviousLoginTime       time.Time
	NewDeviceRegistered     bool
}

// EnforceSingleDevicePolicy enforces the single-device policy for a user.
// When a user logs in on a new device, any previously active device is logged out
// and an email notification is sent to the account owner.
func (s *DevicePolicyService) EnforceSingleDevicePolicy(userID, newDeviceUID, newDeviceName, ipAddress, userAgent string) (*ActiveDeviceResult, error) {
	if userID == "" || newDeviceUID == "" {
		return nil, fmt.Errorf("userID and deviceUID are required")
	}

	result := &ActiveDeviceResult{}

	// Get the currently active device for this user (excluding the new device)
	activeDevice, err := s.GetActiveDeviceForUser(userID, newDeviceUID)
	if err != nil {
		return nil, fmt.Errorf("failed to check active device: %w", err)
	}

	if activeDevice != nil {
		// Check if this is likely the SAME physical device re-authenticating
		// (e.g., app reload, storage cleared, same browser/device name)
		isSameDevice := s.isLikelySameDevice(activeDevice, newDeviceName, ipAddress, userAgent)

		if isSameDevice {
			// Same device re-authenticating - update the existing device record
			// instead of kicking it out. This prevents false logout loops.
			if _, err := s.db.Exec(
				"UPDATE devices SET last_seen = $1, last_login_at = $1, updated_at = $1 WHERE id = $2",
				time.Now(), activeDevice.ID,
			); err != nil {
				fmt.Printf("Failed to update active device %s for user %s: %v\n", activeDevice.ID, userID, err)
			}
			result.PreviousDeviceLoggedOut = false
			return result, nil
		}

		// Different device - enforce single device policy
		result.PreviousDeviceLoggedOut = true
		result.PreviousDeviceName = activeDevice.DeviceName
		result.PreviousDeviceUID = activeDevice.ID
		result.PreviousLoginTime = activeDevice.LastLogin

		// Increment token version to IMMEDIATELY invalidate all existing JWTs
		if _, err := s.db.Exec(
			"UPDATE users SET token_version = token_version + 1, updated_at = $1 WHERE id = $2",
			time.Now(), userID,
		); err != nil {
			fmt.Printf("Failed to increment token_version for user %s: %v\n", userID, err)
		}

		// Revoke all refresh tokens for the user
		if err := s.authService.RevokeAllUserTokens(userID); err != nil {
			fmt.Printf("Failed to revoke tokens for user %s: %v\n", userID, err)
		}

		// Mark the old device as inactive
		if _, err := s.db.Exec(
			"UPDATE devices SET is_active = FALSE, updated_at = $1 WHERE user_id = $2 AND id = $3",
			time.Now(), userID, activeDevice.ID,
		); err != nil {
			fmt.Printf("Failed to deactivate old device %s for user %s: %v\n", activeDevice.ID, userID, err)
		}

		// Also mark all login sessions as revoked except current
		if _, err := s.db.Exec(
			"UPDATE login_sessions SET status = 'revoked', last_activity = $1 WHERE user_id = $2 AND device_uid != $3",
			time.Now(), userID, newDeviceUID,
		); err != nil {
			fmt.Printf("Failed to revoke old login sessions for user %s: %v\n", userID, err)
		}

		// Send email notification to the account owner
		go s.sendNewDeviceLoginAlert(userID, activeDevice, newDeviceName, ipAddress)
	}

	return result, nil
}

// isLikelySameDevice checks if the new login appears to be from the same physical
// device as the currently active one, based on device name, IP, recency, and user agent.
// This prevents false "new device" detections when the device ID changes but the
// underlying device/browser is the same (e.g., app reload, storage cleared).
func (s *DevicePolicyService) isLikelySameDevice(activeDevice *models.Device, newDeviceName, ipAddress, userAgent string) bool {
	// If the device names match, it's very likely the same device
	if activeDevice.DeviceName != "" && newDeviceName != "" && activeDevice.DeviceName == newDeviceName {
		// Same device name - check if it was active recently (within last 30 minutes)
		if time.Since(activeDevice.LastLogin) < 30*time.Minute {
			return true
		}
	}

	// If IP addresses match and login was very recent (within 5 minutes)
	if activeDevice.IPAddress == ipAddress && time.Since(activeDevice.LastLogin) < 5*time.Minute {
		return true
	}

	// Check user agent similarity if available
	if userAgent != "" {
		// If both are from the same browser/app family, consider it the same device
		activeIsMobile := activeDevice.DeviceType == "mobile"
		newIsMobile := strings.Contains(userAgent, "Mobile") || strings.Contains(userAgent, "Android") || strings.Contains(userAgent, "iPhone")
		
		if activeIsMobile == newIsMobile && time.Since(activeDevice.LastLogin) < 10*time.Minute {
			return true
		}
	}

	return false
}

// GetActiveDeviceForUser returns the currently active device for a user,
// excluding the specified device UID. Returns nil if no active device exists.
func (s *DevicePolicyService) GetActiveDeviceForUser(userID, excludeDeviceUID string) (*models.Device, error) {
	var device models.Device
	query := `
		SELECT id, user_id, device_name, device_type, ip_address, os_version,
		       app_version, manufacturer, model, locale, timezone,
		       last_seen, last_login_at, is_active, created_at, updated_at
		FROM devices
		WHERE user_id = $1 AND is_active = TRUE AND id != $2
		ORDER BY last_login_at DESC NULLS LAST, last_seen DESC
		LIMIT 1
	`

	err := s.db.QueryRow(query, userID, excludeDeviceUID).Scan(
		&device.ID, &device.UserID, &device.DeviceName, &device.DeviceType,
		&device.IPAddress, &device.OSVersion, &device.AppVersion,
		&device.Manufacturer, &device.Model, &device.Locale, &device.Timezone,
		&device.LastSeen, &device.LastLogin, &device.IsActive,
		&device.CreatedAt, &device.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query active device: %w", err)
	}

	return &device, nil
}

// GetActiveDeviceCount returns the number of active devices for a user
func (s *DevicePolicyService) GetActiveDeviceCount(userID string) (int, error) {
	var count int
	err := s.db.QueryRow(
		"SELECT COUNT(*) FROM devices WHERE user_id = $1 AND is_active = TRUE",
		userID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count active devices: %w", err)
	}
	return count, nil
}

// RevokeAllUserTokensExcept revokes all tokens for a user except those from a specific device
func (s *DevicePolicyService) RevokeAllUserTokensExcept(userID, keepDeviceUID string) error {
	// Revoke all refresh tokens for the user
	if err := s.authService.RevokeAllUserTokens(userID); err != nil {
		return fmt.Errorf("failed to revoke tokens: %w", err)
	}

	// Deactivate all devices except the specified one
	if _, err := s.db.Exec(
		"UPDATE devices SET is_active = FALSE, updated_at = $1 WHERE user_id = $2 AND id != $3",
		time.Now(), userID, keepDeviceUID,
	); err != nil {
		return fmt.Errorf("failed to deactivate devices: %w", err)
	}

	// Mark all login sessions as revoked except current device
	if _, err := s.db.Exec(
		"UPDATE login_sessions SET status = 'revoked', last_activity = $1 WHERE user_id = $2 AND device_uid != $3",
		time.Now(), userID, keepDeviceUID,
	); err != nil {
		return fmt.Errorf("failed to revoke login sessions: %w", err)
	}

	return nil
}

// sendNewDeviceLoginAlert sends a security alert email when a user logs in on a new device
func (s *DevicePolicyService) sendNewDeviceLoginAlert(userID string, oldDevice *models.Device, newDeviceName, ipAddress string) {
	if s.emailService == nil {
		return
	}

	// Get user email
	var email, firstName, lastName string
	err := s.db.QueryRow(
		"SELECT email, first_name, last_name FROM users WHERE id = $1",
		userID,
	).Scan(&email, &firstName, &lastName)
	if err != nil {
		fmt.Printf("Failed to get user email for device alert: %v\n", err)
		return
	}

	if email == "" {
		return
	}

	userName := firstName
	if lastName != "" {
		userName += " " + lastName
	}
	if userName == "" {
		userName = email
	}

	subject := "Security Alert: New Device Login Detected - VaultKe"

	// Format times
	loginTime := time.Now().Format("January 2, 2006 at 3:04 PM MST")
	oldDeviceLastLogin := oldDevice.LastLogin.Format("January 2, 2006 at 3:04 PM MST")

	body := fmt.Sprintf(`
		<p style="font-size: 18px; color: #1e293b; margin-bottom: 24px;">Hello <span class="highlight">%s</span>,</p>

		<p><strong>SECURITY ALERT:</strong> We detected a new login to your VaultKe account from a different device.</p>

		<div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
			<h3 style="color: #dc2626; margin-top: 0;">New Login Details</h3>
			<p><strong>New Device:</strong> %s</p>
			<p><strong>IP Address:</strong> %s</p>
			<p><strong>Time:</strong> %s</p>
		</div>

		<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0;">
			<h3 style="color: #16a34a; margin-top: 0;">Previous Device Logged Out</h3>
			<p><strong>Device:</strong> %s</p>
			<p><strong>Last Active:</strong> %s</p>
		</div>

		<p><strong>What happened?</strong></p>
		<p>VaultKe allows only <strong>one active device</strong> per account at a time. When you logged in on the new device, the previous device was automatically logged out for security.</p>

		<p><strong>If this was you:</strong></p>
		<p>No action needed. Your account is secure. You can continue using VaultKe on your current device.</p>

		<p><strong>If this was NOT you:</strong></p>
		<p>Please take immediate action:</p>
		<ul>
			<li>Change your VaultKe password immediately</li>
			<li>Review your account activity</li>
			<li>Contact our support team if you need assistance</li>
		</ul>

		<div class="security-notice">
			<p style="margin: 0; font-size: 14px; color: #92400e;"><strong>Security Notice:</strong> This notification is sent automatically when a new device logs into your account.</p>
		</div>

		<p style="margin-top: 30px;">Best regards,<br><span class="highlight">The VaultKe Security Team</span></p>
	`,
		userName, newDeviceName, ipAddress, loginTime,
		oldDevice.DeviceName, oldDeviceLastLogin,
	)

	htmlBody := fmt.Sprintf(`
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>%s</title>
			<style>
				body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
				.highlight { color: #00D4AA; font-weight: bold; }
				.security-notice { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
			</style>
		</head>
		<body>
			%s
		</body>
		</html>
	`, subject, body)

	if err := s.emailService.SendHTMLEmail(email, subject, htmlBody); err != nil {
		fmt.Printf("Failed to send new device alert email to %s: %v\n", email, err)
	}
}
