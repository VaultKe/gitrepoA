package wa

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
)

// RoomMapper maps VaultKe room IDs to OpenWA chat IDs.
type RoomMapper struct {
	db *sql.DB
	mu sync.RWMutex
	// cache for fast lookups
	cache map[string]string // roomID -> chatID
}

// NewRoomMapper creates a new RoomMapper.
func NewRoomMapper(db *sql.DB) *RoomMapper {
	return &RoomMapper{
		db:    db,
		cache: make(map[string]string),
	}
}

// EnsureMapping ensures a mapping exists between a VaultKe room and an OpenWA chat.
// For new rooms, it creates the corresponding WhatsApp chat/group.
func (m *RoomMapper) EnsureMapping(ctx context.Context, roomID, roomType, chamaID, userPhone, sessionID string, client *OpenWAClient) (string, error) {
	m.mu.RLock()
	chatID, ok := m.cache[roomID]
	m.mu.RUnlock()
	if ok {
		return chatID, nil
	}

	var storedChatID string
	err := m.db.QueryRowContext(ctx,
		`SELECT chat_id FROM wa_room_mappings WHERE room_id = $1`,
		roomID,
	).Scan(&storedChatID)

	if err == nil {
		m.mu.Lock()
		m.cache[roomID] = storedChatID
		m.mu.Unlock()
		return storedChatID, nil
	}
	if err != sql.ErrNoRows {
		return "", fmt.Errorf("lookup room mapping: %w", err)
	}

	// No mapping exists yet — create one based on room type.
	var newChatID string
	switch roomType {
	case "private":
		newChatID, err = m.createPrivateChat(ctx, roomID, userPhone, sessionID, client)
	case "group", "chama":
		newChatID, err = m.createGroupChat(ctx, roomID, chamaID, sessionID, client)
	default:
		newChatID, err = m.createPrivateChat(ctx, roomID, userPhone, sessionID, client)
	}
	if err != nil {
		return "", err
	}

	_, err = m.db.ExecContext(ctx,
		`INSERT INTO wa_room_mappings (room_id, chat_id, chat_type, chama_id, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, NOW(), NOW())
		 ON CONFLICT (room_id) DO UPDATE SET chat_id = $2, updated_at = NOW()`,
		roomID, newChatID, roomType, chamaID,
	)
	if err != nil {
		return "", fmt.Errorf("insert room mapping: %w", err)
	}

	m.mu.Lock()
	m.cache[roomID] = newChatID
	m.mu.Unlock()
	return newChatID, nil
}

// Lookup returns the OpenWA chat ID for a VaultKe room ID.
func (m *RoomMapper) Lookup(roomID string) (string, bool) {
	m.mu.RLock()
	chatID, ok := m.cache[roomID]
	m.mu.RUnlock()
	if ok {
		return chatID, true
	}

	var storedChatID string
	err := m.db.QueryRow(`SELECT chat_id FROM wa_room_mappings WHERE room_id = $1`, roomID).Scan(&storedChatID)
	if err != nil {
		return "", false
	}

	m.mu.Lock()
	m.cache[roomID] = storedChatID
	m.mu.Unlock()
	return storedChatID, true
}

// ReverseLookup returns the VaultKe room ID for an OpenWA chat ID.
func (m *RoomMapper) ReverseLookup(chatID string) (string, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for room, cid := range m.cache {
		if cid == chatID {
			return room, true
		}
	}

	var roomID string
	err := m.db.QueryRow(`SELECT room_id FROM wa_room_mappings WHERE chat_id = $1`, chatID).Scan(&roomID)
	if err != nil {
		return "", false
	}
	return roomID, true
}

// createPrivateChat ensures a 1:1 chat exists.
// OpenWA does not need to "create" a 1:1 chat — it materializes on first message.
// We return the deterministic JID for the pair.
func (m *RoomMapper) createPrivateChat(ctx context.Context, roomID, userPhone, sessionID string, client *OpenWAClient) (string, error) {
	// The chatID for a 1:1 chat is simply the other party's JID.
	// The roomID in VaultKe is deterministic for the pair, so we need to look up
	// the other user's phone. For now we use the roomID hash as a placeholder
	// and rely on the caller to provide the actual remote JID via the message flow.
	_ = sessionID
	_ = client
	return roomID, nil
}

// createGroupChat creates a WhatsApp group and returns its JID.
func (m *RoomMapper) createGroupChat(ctx context.Context, roomID, chamaID, sessionID string, client *OpenWAClient) (string, error) {
	if chamaID == "" || sessionID == "" {
		return roomID, nil
	}

	groupName := "VaultKe-" + chamaID
	_ = client
	_ = groupName

	// The actual group creation should be triggered from the chama creation flow,
	// not here, because we need member phone numbers. This method is a fallback.
	return roomID, nil
}

// RemoveMapping removes a room mapping (e.g. when a chama is deleted).
func (m *RoomMapper) RemoveMapping(roomID string) {
	m.mu.Lock()
	delete(m.cache, roomID)
	m.mu.Unlock()
	_, _ = m.db.Exec(`DELETE FROM wa_room_mappings WHERE room_id = $1`, roomID)
}

// SessionAssignment tracks which OpenWA session owns which chat.
type SessionAssignment struct {
	db *sql.DB
}

// NewSessionAssignment creates a new assignment tracker.
func NewSessionAssignment(db *sql.DB) *SessionAssignment {
	return &SessionAssignment{db: db}
}

// GetSessionForChat returns the OpenWA session ID for a given chat/chama.
func (s *SessionAssignment) GetSessionForChat(roomID string) (string, error) {
	var sessionID string
	err := s.db.QueryRow(
		`SELECT wa.session_id FROM wa_chama_mappings wa
		 JOIN wa_room_mappings rm ON rm.chat_id = wa.group_jid
		 WHERE rm.room_id = $1 LIMIT 1`,
		roomID,
	).Scan(&sessionID)
	if err == nil {
		return sessionID, nil
	}
	if err != sql.ErrNoRows {
		return "", err
	}

	// Fallback: return the default session from config or the first available session.
	var defaultSession string
	err = s.db.QueryRow(
		`SELECT session_id FROM wa_sessions WHERE is_default = true AND status = 'ready' LIMIT 1`,
	).Scan(&defaultSession)
	if err == nil {
		return defaultSession, nil
	}
	if err != sql.ErrNoRows {
		return "", err
	}

	// Last fallback: any ready session
	err = s.db.QueryRow(
		`SELECT session_id FROM wa_sessions WHERE status = 'ready' LIMIT 1`,
	).Scan(&defaultSession)
	if err == nil {
		return defaultSession, nil
	}
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("no openwa session available")
	}
	return "", err
}

// EnsureChamaGroup ensures a WhatsApp group exists for a chama and returns the mapping.
func (s *SessionAssignment) EnsureChamaGroup(ctx context.Context, chamaID, chamaName, sessionID string, memberPhones []string, client *OpenWAClient) (*ChamaGroupMapping, error) {
	if sessionID == "" {
		return nil, fmt.Errorf("openwa session_id is empty for chama %s", chamaID)
	}

	var mapping ChamaGroupMapping
	err := s.db.QueryRowContext(ctx,
		`SELECT chama_id, group_jid, group_name, invite_code, session_id
		 FROM wa_chama_mappings WHERE chama_id = $1`,
		chamaID,
	).Scan(&mapping.ChamaID, &mapping.GroupJID, &mapping.GroupName, &mapping.InviteCode, &mapping.SessionID)

	if err == nil && mapping.GroupJID != "" {
		return &mapping, nil
	}
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("lookup chama mapping: %w", err)
	}

	// Create WhatsApp group
	group, err := client.CreateGroup(ctx, sessionID, chamaName, memberPhones)
	if err != nil {
		return nil, fmt.Errorf("create whatsapp group for chama %s: %w", chamaID, err)
	}

	mapping = ChamaGroupMapping{
		ChamaID:   chamaID,
		GroupJID:  group.ID,
		GroupName: group.Name,
		SessionID: sessionID,
	}
	if group.LinkedParentJID != nil && *group.LinkedParentJID != "" {
		mapping.InviteCode = *group.LinkedParentJID
	} else {
		mapping.InviteCode = group.ID
	}

	_, err = s.db.ExecContext(ctx,
		`INSERT INTO wa_chama_mappings (chama_id, group_jid, group_name, invite_code, session_id, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		 ON CONFLICT (chama_id) DO UPDATE SET group_jid = $2, group_name = $3, invite_code = $4, session_id = $5, updated_at = NOW()`,
		mapping.ChamaID, mapping.GroupJID, mapping.GroupName, mapping.InviteCode, mapping.SessionID,
	)
	if err != nil {
		return nil, fmt.Errorf("insert chama mapping: %w", err)
	}

	return &mapping, nil
}

// ChamaGroupMapping represents a chama-to-WhatsApp-group mapping.
type ChamaGroupMapping struct {
	ChamaID   string
	GroupJID  string
	GroupName string
	InviteCode string
	SessionID string
}

// ToJSON serializes the mapping for caching or API responses.
func (m *ChamaGroupMapping) ToJSON() map[string]interface{} {
	return map[string]interface{}{
		"chamaId":    m.ChamaID,
		"groupJid":   m.GroupJID,
		"groupName":  m.GroupName,
		"inviteCode": m.InviteCode,
		"sessionId":  m.SessionID,
	}
}

// FromJSON deserializes a mapping.
func FromJSON(data map[string]interface{}) *ChamaGroupMapping {
	m := &ChamaGroupMapping{}
	if v, ok := data["chamaId"].(string); ok {
		m.ChamaID = v
	}
	if v, ok := data["groupJid"].(string); ok {
		m.GroupJID = v
	}
	if v, ok := data["groupName"].(string); ok {
		m.GroupName = v
	}
	if v, ok := data["inviteCode"].(string); ok {
		m.InviteCode = v
	}
	if v, ok := data["sessionId"].(string); ok {
		m.SessionID = v
	}
	return m
}

// Marshal serializes to JSON string.
func (m *ChamaGroupMapping) Marshal() (string, error) {
	b, err := json.Marshal(m.ToJSON())
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// Unmarshal deserializes from JSON string.
func (m *ChamaGroupMapping) Unmarshal(s string) error {
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(s), &data); err != nil {
		return err
	}
	parsed := FromJSON(data)
	if parsed == nil {
		return fmt.Errorf("invalid chama mapping json")
	}
	*m = *parsed
	return nil
}

// GetDefaultSessionID returns the default OpenWA session ID from database.
func (s *SessionAssignment) GetDefaultSessionID() (string, error) {
	var sessionID string
	err := s.db.QueryRow(
		`SELECT session_id FROM wa_sessions WHERE is_default = true AND status = 'ready' LIMIT 1`,
	).Scan(&sessionID)
	if err == nil {
		return sessionID, nil
	}
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("no default openwa session configured")
	}
	return "", err
}

// EnsureDefaultSession ensures a default session exists and returns its ID.
func (s *SessionAssignment) EnsureDefaultSession(ctx context.Context, client *OpenWAClient) (string, error) {
	sessionID, err := s.GetDefaultSessionID()
	if err == nil {
		return sessionID, nil
	}
	if err != sql.ErrNoRows {
		return "", err
	}

	// Create a default session via OpenWA
	// This requires the OpenWA admin API key to have session creation permissions
	path := "/api/sessions"
	payload := map[string]interface{}{
		"name": "vaultke-default",
	}
	reqBody := strings.NewReader(MustJSON(payload))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, client.BaseURL+path, reqBody)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", client.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("create default openwa session: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("openwa create session failed: %d %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}

	var session struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
		return "", fmt.Errorf("decode session: %w", err)
	}

	_, err = s.db.ExecContext(ctx,
		`INSERT INTO wa_sessions (session_id, name, status, is_default, created_at, updated_at)
		 VALUES ($1, $2, 'created', true, NOW(), NOW())
		 ON CONFLICT (session_id) DO UPDATE SET is_default = true, updated_at = NOW()`,
		session.ID, "vaultke-default",
	)
	if err != nil {
		return "", fmt.Errorf("store default session: %w", err)
	}

	return session.ID, nil
}
