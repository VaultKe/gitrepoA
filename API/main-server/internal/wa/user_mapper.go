package wa

import (
	"database/sql"
	"fmt"
	"strings"
)

// UserMapper maps VaultKe user IDs to WhatsApp phone numbers and JIDs.
type UserMapper struct {
	db *sql.DB
}

// NewUserMapper creates a new UserMapper.
func NewUserMapper(db *sql.DB) *UserMapper {
	return &UserMapper{db: db}
}

// UserMapping represents the mapping between a VaultKe user and a WhatsApp identity.
type UserMapping struct {
	UserID      string
	PhoneNumber string // E.164 without @ suffix, e.g. "2547XXXXXXXXX"
	WAJID       string // Full JID, e.g. "2547XXXXXXXXX@s.us"
	SessionID   string
	Verified    bool
}

// GetMapping returns the WhatsApp mapping for a VaultKe user.
func (m *UserMapper) GetMapping(userID string) (*UserMapping, error) {
	var um UserMapping
	err := m.db.QueryRow(
		`SELECT user_id, phone_number, wa_jid, wa_session_id, verified
		 FROM wa_user_mappings WHERE user_id = $1`,
		userID,
	).Scan(&um.UserID, &um.PhoneNumber, &um.WAJID, &um.SessionID, &um.Verified)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("query user mapping: %w", err)
	}
	return &um, nil
}

// GetMappingByPhone returns the VaultKe user ID for a WhatsApp phone number.
func (m *UserMapper) GetMappingByPhone(phoneNumber string) (string, error) {
	var userID string
	err := m.db.QueryRow(
		`SELECT user_id FROM wa_user_mappings WHERE phone_number = $1 AND verified = true`,
		phoneNumber,
	).Scan(&userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", fmt.Errorf("no verified user found for phone %s", phoneNumber)
		}
		return "", fmt.Errorf("query user by phone: %w", err)
	}
	return userID, nil
}

// GetMappingByJID returns the VaultKe user ID for a WhatsApp JID.
func (m *UserMapper) GetMappingByJID(jid string) (string, error) {
	var userID string
	err := m.db.QueryRow(
		`SELECT user_id FROM wa_user_mappings WHERE wa_jid = $1 AND verified = true`,
		jid,
	).Scan(&userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", fmt.Errorf("no verified user found for JID %s", jid)
		}
		return "", fmt.Errorf("query user by JID: %w", err)
	}
	return userID, nil
}

// UpsertMapping creates or updates a user mapping.
func (m *UserMapper) UpsertMapping(um *UserMapping) error {
	_, err := m.db.Exec(
		`INSERT INTO wa_user_mappings (user_id, phone_number, wa_jid, wa_session_id, verified, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		 ON CONFLICT (user_id) DO UPDATE SET
			phone_number = EXCLUDED.phone_number,
			wa_jid = EXCLUDED.wa_jid,
			wa_session_id = EXCLUDED.wa_session_id,
			verified = EXCLUDED.verified,
			updated_at = NOW()`,
		um.UserID, um.PhoneNumber, um.WAJID, um.SessionID, um.Verified,
	)
	if err != nil {
		return fmt.Errorf("upsert user mapping: %w", err)
	}
	return nil
}

// SetVerified marks a user mapping as verified.
func (m *UserMapper) SetVerified(userID string, verified bool) error {
	_, err := m.db.Exec(
		`UPDATE wa_user_mappings SET verified = $1, updated_at = NOW() WHERE user_id = $2`,
		verified, userID,
	)
	if err != nil {
		return fmt.Errorf("update verification: %w", err)
	}
	return nil
}

// GetOrCreateJID returns the JID for a phone number, creating the mapping if needed.
func (m *UserMapper) GetOrCreateJID(userID, phoneNumber, sessionID string) (string, error) {
	um, err := m.GetMapping(userID)
	if err != nil {
		return "", err
	}
	if um != nil && um.WAJID != "" {
		return um.WAJID, nil
	}

	// Construct JID from phone number (OpenWA uses @s.us for individual chats)
	jid := phoneNumber + "@s.us"
	if um == nil {
		um = &UserMapping{
			UserID:      userID,
			PhoneNumber: phoneNumber,
			WAJID:       jid,
			SessionID:   sessionID,
			Verified:    false,
		}
	} else {
		um.WAJID = jid
		um.PhoneNumber = phoneNumber
		um.SessionID = sessionID
	}

	if err := m.UpsertMapping(um); err != nil {
		return "", err
	}
	return jid, nil
}

// ResolveJIDToUserID converts an OpenWA JID to a VaultKe user ID.
func (m *UserMapper) ResolveJIDToUserID(jid string) (string, error) {
	// Strip the @s.us or @g.us suffix for lookup
	phone := jid
	if idx := strings.Index(jid, "@"); idx != -1 {
		phone = jid[:idx]
	}

	userID, err := m.GetMappingByPhone(phone)
	if err == nil {
		return userID, nil
	}

	// Fallback: try direct JID lookup
	userID, err = m.GetMappingByJID(jid)
	if err == nil {
		return userID, nil
	}

	return "", fmt.Errorf("no user mapped for JID %s", jid)
}
