package room

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"vaultke-meeting-service/internal/models"

	"github.com/redis/go-redis/v9"
)

// Sentinel errors returned by RoomManager methods.
var (
	ErrRoomFull   = errors.New("room is full")
	ErrRoomNotFound = errors.New("room not found")
	ErrUserNotInRoom = errors.New("user not in room")
)

// RoomManager manages meeting rooms and participants with PostgreSQL persistence
// and Redis-backed presence for horizontal scaling.
type RoomManager struct {
	db           *sql.DB
	redisClient  *redis.Client
	rooms        map[string]*models.Room
	participants map[string]map[string]*models.Participant
	stats        *Stats
	mu           sync.RWMutex
}

// Stats holds room/participant statistics.
type Stats struct {
	ActiveRooms      int
	TotalParticipants int
	mu               sync.RWMutex
}

// NewRoomManager creates a new room manager.
func NewRoomManager(db *sql.DB, redisClient *redis.Client) *RoomManager {
	rm := &RoomManager{
		db:           db,
		redisClient:  redisClient,
		rooms:        make(map[string]*models.Room),
		participants: make(map[string]map[string]*models.Participant),
		stats:        &Stats{},
	}

	// Initialize DB schema if needed
	rm.ensureSchema()

	// Load active rooms from DB
	rm.loadActiveRooms()

	// Start cleanup goroutine
	go rm.cleanupLoop()

	return rm
}

// ensureSchema creates tables if they don't exist.
func (rm *RoomManager) ensureSchema() {
	_, err := rm.db.Exec(`
		CREATE TABLE IF NOT EXISTS rooms (
			id TEXT PRIMARY KEY,
			chama_id TEXT NOT NULL,
			name TEXT NOT NULL,
			type TEXT NOT NULL DEFAULT 'virtual',
			status TEXT NOT NULL DEFAULT 'waiting',
			max_participants INTEGER NOT NULL DEFAULT 150,
			created_by TEXT NOT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			ended_at TIMESTAMP,
			recording_enabled BOOLEAN DEFAULT FALSE,
			recording_path TEXT,
			metadata JSONB DEFAULT '{}'::jsonb
		)
	`)
	if err != nil {
		fmt.Printf("Failed to create rooms table: %v\n", err)
	}

	_, err = rm.db.Exec(`
		CREATE TABLE IF NOT EXISTS participants (
			id TEXT PRIMARY KEY,
			room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
			user_id TEXT NOT NULL,
			display_name TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'participant',
			is_muted BOOLEAN DEFAULT FALSE,
			is_video_on BOOLEAN DEFAULT FALSE,
			is_screen_sharing BOOLEAN DEFAULT FALSE,
			joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
			left_at TIMESTAMP,
			metadata JSONB DEFAULT '{}'::jsonb,
			UNIQUE(room_id, user_id)
		)
	`)
	if err != nil {
		fmt.Printf("Failed to create participants table: %v\n", err)
	}

	// Create indexes
	_, _ = rm.db.Exec(`CREATE INDEX IF NOT EXISTS idx_participants_room_id ON participants(room_id)`)
	_, _ = rm.db.Exec(`CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status)`)
}

// loadActiveRooms loads active rooms from DB into memory.
func (rm *RoomManager) loadActiveRooms() {
	rows, err := rm.db.Query(`
		SELECT id, chama_id, name, type, status, max_participants, created_by, created_at, ended_at, recording_enabled, recording_path, metadata
		FROM rooms WHERE status = 'active' OR status = 'waiting'
	`)
	if err != nil {
		fmt.Printf("Failed to load active rooms: %v\n", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var room models.Room
		var metadataJSON []byte
		var recordingPath sql.NullString
		var endedAt sql.NullTime

		err := rows.Scan(
			&room.ID, &room.ChamaID, &room.Name, &room.Type, &room.Status,
			&room.MaxParticipants, &room.CreatedBy, &room.CreatedAt,
			&endedAt, &room.RecordingEnabled, &recordingPath, &metadataJSON,
		)
		if err != nil {
			continue
		}

		if endedAt.Valid {
			room.EndedAt = &endedAt.Time
		}
		if recordingPath.Valid {
			path := recordingPath.String
			room.RecordingPath = &path
		}
		if len(metadataJSON) > 0 {
			_ = json.Unmarshal(metadataJSON, &room.Metadata)
		}

		rm.mu.Lock()
		rm.rooms[room.ID] = &room
		rm.mu.Unlock()

		// Load participants for this room
		rm.loadRoomParticipants(room.ID)
	}
}

// loadRoomParticipants loads participants for a specific room.
func (rm *RoomManager) loadRoomParticipants(roomID string) {
	rows, err := rm.db.Query(`
		SELECT id, room_id, user_id, display_name, role, is_muted, is_video_on, is_screen_sharing, joined_at, left_at, metadata
		FROM participants WHERE room_id = $1 AND left_at IS NULL
	`, roomID)
	if err != nil {
		return
	}
	defer rows.Close()

	rm.mu.Lock()
	defer rm.mu.Unlock()

	if rm.participants[roomID] == nil {
		rm.participants[roomID] = make(map[string]*models.Participant)
	}

	for rows.Next() {
		var p models.Participant
		var metadataJSON []byte
		var leftAt sql.NullTime

		err := rows.Scan(
			&p.ID, &p.RoomID, &p.UserID, &p.DisplayName, &p.Role,
			&p.IsMuted, &p.IsVideoOn, &p.IsScreenSharing, &p.JoinedAt,
			&leftAt, &metadataJSON,
		)
		if err != nil {
			continue
		}

		if leftAt.Valid {
			p.LeftAt = &leftAt.Time
		}
		if len(metadataJSON) > 0 {
			_ = json.Unmarshal(metadataJSON, &p.Metadata)
		}

		rm.participants[roomID][p.UserID] = &p
		rm.stats.mu.Lock()
		rm.stats.TotalParticipants++
		rm.stats.mu.Unlock()
	}
}

// CreateRoom creates a new meeting room.
func (rm *RoomManager) CreateRoom(room *models.Room) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	if room.ID == "" {
		room.ID = generateID()
	}
	room.Status = models.RoomStatusWaiting
	room.CreatedAt = time.Now()

	if room.MaxParticipants <= 0 {
		room.MaxParticipants = 150
	}

	metadataJSON, _ := json.Marshal(room.Metadata)
	_, err := rm.db.Exec(`
		INSERT INTO rooms (id, chama_id, name, type, status, max_participants, created_by, created_at, recording_enabled, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, room.ID, room.ChamaID, room.Name, room.Type, room.Status,
		room.MaxParticipants, room.CreatedBy, room.CreatedAt,
		room.RecordingEnabled, metadataJSON)
	if err != nil {
		return fmt.Errorf("failed to insert room: %w", err)
	}

	rm.rooms[room.ID] = room
	rm.stats.mu.Lock()
	rm.stats.ActiveRooms++
	rm.stats.mu.Unlock()

	return nil
}

// GetRoom retrieves a room by ID.
func (rm *RoomManager) GetRoom(roomID string) (*models.Room, error) {
	rm.mu.RLock()
	room, exists := rm.rooms[roomID]
	rm.mu.RUnlock()

	if exists {
		return room, nil
	}

	var dbRoom models.Room
	var metadataJSON []byte
	var recordingPath sql.NullString
	var endedAt sql.NullTime

	err := rm.db.QueryRow(`
		SELECT id, chama_id, name, type, status, max_participants, created_by, created_at, ended_at, recording_enabled, recording_path, metadata
		FROM rooms WHERE id = $1
	`, roomID).Scan(
		&dbRoom.ID, &dbRoom.ChamaID, &dbRoom.Name, &dbRoom.Type, &dbRoom.Status,
		&dbRoom.MaxParticipants, &dbRoom.CreatedBy, &dbRoom.CreatedAt,
		&endedAt, &dbRoom.RecordingEnabled, &recordingPath, &metadataJSON,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrRoomNotFound
		}
		return nil, fmt.Errorf("failed to query room: %w", err)
	}

	if endedAt.Valid {
		dbRoom.EndedAt = &endedAt.Time
	}
	if recordingPath.Valid {
		path := recordingPath.String
		dbRoom.RecordingPath = &path
	}
	if len(metadataJSON) > 0 {
		_ = json.Unmarshal(metadataJSON, &dbRoom.Metadata)
	}

	rm.mu.Lock()
	rm.rooms[roomID] = &dbRoom
	rm.mu.Unlock()

	return &dbRoom, nil
}

// EndRoom ends a meeting room.
func (rm *RoomManager) EndRoom(roomID string) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	room, exists := rm.rooms[roomID]
	if !exists {
		return ErrRoomNotFound
	}

	now := time.Now()
	room.Status = models.RoomStatusEnded
	room.EndedAt = &now

	_, err := rm.db.Exec(`
		UPDATE rooms SET status = $1, ended_at = $2 WHERE id = $3
	`, room.Status, room.EndedAt, roomID)
	if err != nil {
		return fmt.Errorf("failed to end room: %w", err)
	}

	// Update all participants as left
	if participants, ok := rm.participants[roomID]; ok {
		for _, p := range participants {
			now := time.Now()
			p.LeftAt = &now
			_, _ = rm.db.Exec(`UPDATE participants SET left_at = $1 WHERE id = $2`, now, p.ID)
		}
	}

	delete(rm.rooms, roomID)
	delete(rm.participants, roomID)

	rm.stats.mu.Lock()
	rm.stats.ActiveRooms--
	rm.stats.mu.Unlock()

	return nil
}

// JoinRoom adds a participant to a room.
func (rm *RoomManager) JoinRoom(roomID, userID, displayName, role string) (*models.Participant, error) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	room, exists := rm.rooms[roomID]
	if !exists {
		var dbRoom models.Room
		err := rm.db.QueryRow(`
			SELECT id, max_participants FROM rooms WHERE id = $1
		`, roomID).Scan(&dbRoom.ID, &dbRoom.MaxParticipants)
		if err != nil {
			// Auto-create room if it doesn't exist
			room = &models.Room{
				ID:             roomID,
				ChamaID:        "default",
				Name:           "Auto-created Room",
				Type:           models.RoomTypeVirtual,
				Status:         models.RoomStatusWaiting,
				MaxParticipants: 150,
				CreatedBy:      userID,
				CreatedAt:      time.Now(),
			}
			metadataJSON, _ := json.Marshal(room.Metadata)
			_, insertErr := rm.db.Exec(`
				INSERT INTO rooms (id, chama_id, name, type, status, max_participants, created_by, created_at, recording_enabled, metadata)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			`, room.ID, room.ChamaID, room.Name, room.Type, room.Status,
				room.MaxParticipants, room.CreatedBy, room.CreatedAt,
				room.RecordingEnabled, metadataJSON)
			if insertErr != nil {
				return nil, fmt.Errorf("failed to create room: %w", insertErr)
			}
			rm.rooms[roomID] = room
			rm.stats.mu.Lock()
			rm.stats.ActiveRooms++
			rm.stats.mu.Unlock()
		} else {
			room = &dbRoom
			rm.rooms[roomID] = room
		}
	}

	// Check capacity
	if rm.isRoomFullUnsafe(roomID) {
		return nil, ErrRoomFull
	}

	// Check if user is already in room
	if existing, ok := rm.participants[roomID][userID]; ok {
		if existing.LeftAt == nil {
			return existing, nil
		}
	}

	// Ensure no stale DB record blocks re-join (left_at set or orphaned)
	_, _ = rm.db.Exec(`DELETE FROM participants WHERE room_id = $1 AND user_id = $2`, roomID, userID)

	// Activate room if waiting
	if room.Status == models.RoomStatusWaiting {
		room.Status = models.RoomStatusActive
		_, _ = rm.db.Exec(`UPDATE rooms SET status = 'active' WHERE id = $1`, roomID)
	}

	now := time.Now()
	participant := &models.Participant{
		ID:          generateID(),
		RoomID:      roomID,
		UserID:      userID,
		DisplayName: strings.ToValidUTF8(displayName, ""),
		Role:        models.ParticipantRole(strings.ToValidUTF8(role, "")),
		JoinedAt:    now,
	}

	metadataJSON, _ := json.Marshal(participant.Metadata)
	_, err := rm.db.Exec(`
		INSERT INTO participants (id, room_id, user_id, display_name, role, joined_at, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, participant.ID, participant.RoomID, participant.UserID,
		participant.DisplayName, participant.Role, participant.JoinedAt, metadataJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to insert participant: %w", err)
	}

	if rm.participants[roomID] == nil {
		rm.participants[roomID] = make(map[string]*models.Participant)
	}
	rm.participants[roomID][userID] = participant

	// Update Redis presence
	if rm.redisClient != nil {
		key := fmt.Sprintf("room:%s:presence:%s", roomID, userID)
		ctx := context.Background()
		_ = rm.redisClient.Set(ctx, key, "online", 24*time.Hour)
	}

	rm.stats.mu.Lock()
	rm.stats.TotalParticipants++
	rm.stats.mu.Unlock()

	return participant, nil
}

// LeaveRoom removes a participant from a room.
func (rm *RoomManager) LeaveRoom(roomID, userID string) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	if rm.participants[roomID] == nil {
		return ErrUserNotInRoom
	}

	participant, exists := rm.participants[roomID][userID]
	if !exists {
		return ErrUserNotInRoom
	}

	now := time.Now()
	participant.LeftAt = &now

	_, err := rm.db.Exec(`UPDATE participants SET left_at = $1 WHERE id = $2`, now, participant.ID)
	if err != nil {
		return fmt.Errorf("failed to update participant: %w", err)
	}

	delete(rm.participants[roomID], userID)

	// Update Redis presence
	if rm.redisClient != nil {
		key := fmt.Sprintf("room:%s:presence:%s", roomID, userID)
		ctx := context.Background()
		_ = rm.redisClient.Del(ctx, key)
	}

	rm.stats.mu.Lock()
	rm.stats.TotalParticipants--
	rm.stats.mu.Unlock()

	return nil
}

// GetParticipants returns all active participants in a room.
func (rm *RoomManager) GetParticipants(roomID string) ([]*models.Participant, error) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	var participants []*models.Participant

	if roomParticipants, ok := rm.participants[roomID]; ok {
		for _, p := range roomParticipants {
			if p.LeftAt == nil {
				participants = append(participants, p)
			}
		}
	}

	// Fallback to DB if memory is empty
	if len(participants) == 0 {
		rows, err := rm.db.Query(`
			SELECT id, room_id, user_id, display_name, role, is_muted, is_video_on, is_screen_sharing, joined_at, left_at, metadata
			FROM participants WHERE room_id = $1 AND left_at IS NULL
		`, roomID)
		if err != nil {
			return nil, fmt.Errorf("failed to query participants: %w", err)
		}
		defer rows.Close()

		for rows.Next() {
			var p models.Participant
			var metadataJSON []byte
			var leftAt sql.NullTime

			err := rows.Scan(
				&p.ID, &p.RoomID, &p.UserID, &p.DisplayName, &p.Role,
				&p.IsMuted, &p.IsVideoOn, &p.IsScreenSharing, &p.JoinedAt,
				&leftAt, &metadataJSON,
			)
			if err != nil {
				continue
			}
			if leftAt.Valid {
				p.LeftAt = &leftAt.Time
			}
			if len(metadataJSON) > 0 {
				_ = json.Unmarshal(metadataJSON, &p.Metadata)
			}
			participants = append(participants, &p)
		}
	}

	return participants, nil
}

// UpdateParticipant updates participant state (muted, video, screen share).
func (rm *RoomManager) UpdateParticipant(roomID, userID string, updates map[string]interface{}) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	if rm.participants[roomID] == nil {
		return ErrUserNotInRoom
	}

	participant, exists := rm.participants[roomID][userID]
	if !exists {
		return ErrUserNotInRoom
	}

	setParts := []string{}
	args := []interface{}{}
	argIdx := 1

	for key, value := range updates {
		switch key {
		case "is_muted":
			if b, ok := value.(bool); ok {
				setParts = append(setParts, fmt.Sprintf("is_muted = $%d", argIdx))
				args = append(args, b)
				participant.IsMuted = b
				argIdx++
			}
		case "is_video_on":
			if b, ok := value.(bool); ok {
				setParts = append(setParts, fmt.Sprintf("is_video_on = $%d", argIdx))
				args = append(args, b)
				participant.IsVideoOn = b
				argIdx++
			}
		case "is_screen_sharing":
			if b, ok := value.(bool); ok {
				setParts = append(setParts, fmt.Sprintf("is_screen_sharing = $%d", argIdx))
				args = append(args, b)
				participant.IsScreenSharing = b
				argIdx++
			}
		}
	}

	if len(setParts) == 0 {
		return nil
	}

	args = append(args, participant.ID)
	query := fmt.Sprintf("UPDATE participants SET %s WHERE id = $%d", joinStrings(setParts, ", "), argIdx)
	_, err := rm.db.Exec(query, args...)
	return err
}

// IsRoomFull checks if a room has reached capacity.
func (rm *RoomManager) IsRoomFull(roomID string) bool {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return rm.isRoomFullUnsafe(roomID)
}

func (rm *RoomManager) isRoomFullUnsafe(roomID string) bool {
	room, exists := rm.rooms[roomID]
	if !exists {
		return false
	}

	if rm.participants[roomID] == nil {
		return false
	}

	count := 0
	for _, p := range rm.participants[roomID] {
		if p.LeftAt == nil {
			count++
		}
	}

	return count >= room.MaxParticipants
}

// GetActiveRoomsCount returns the number of active rooms.
func (rm *RoomManager) GetActiveRoomsCount() int {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return len(rm.rooms)
}

// GetStats returns room and participant statistics.
func (rm *RoomManager) GetStats() map[string]interface{} {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	rm.stats.mu.RLock()
	defer rm.stats.mu.RUnlock()

	return map[string]interface{}{
		"activeRooms":       rm.stats.ActiveRooms,
		"totalSessions":     rm.stats.TotalParticipants,
		"totalParticipants": rm.stats.TotalParticipants,
	}
}

// cleanupLoop periodically removes stale rooms.
func (rm *RoomManager) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	for range ticker.C {
		rm.cleanupStaleRooms()
	}
}

// cleanupStaleRooms removes old waiting rooms.
func (rm *RoomManager) cleanupStaleRooms() {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	cutoff := time.Now().Add(-24 * time.Hour)
	for roomID, room := range rm.rooms {
		if room.CreatedAt.Before(cutoff) && room.Status == models.RoomStatusWaiting {
			delete(rm.rooms, roomID)
			delete(rm.participants, roomID)
			rm.stats.mu.Lock()
			rm.stats.ActiveRooms--
			rm.stats.mu.Unlock()
		}
	}
}

// CleanupStaleRooms is the exported version for external callers.
func (rm *RoomManager) CleanupStaleRooms() {
	rm.cleanupStaleRooms()
}

// DB returns the database connection for direct queries.
func (rm *RoomManager) DB() *sql.DB {
	return rm.db
}

// GenerateID generates a random 32-character hex ID using crypto/rand.
func GenerateID() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		// Fallback: use timestamp-based pseudo-random ID (should not happen in practice)
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return fmt.Sprintf("%x", bytes)
}

// generateID generates a random hex ID (internal alias).
func generateID() string {
	return GenerateID()
}

// joinStrings joins strings with a separator.
func joinStrings(strs []string, sep string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}
