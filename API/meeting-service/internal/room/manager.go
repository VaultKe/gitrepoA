package room

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"

	"vaultke-meeting-service/internal/models"
)

type RoomManager struct {
	db           *sql.DB
	rooms        map[string]*models.Room
	participants map[string]map[string]*models.Participant
	sessions     map[string]*models.WebRTCSession
	mu           sync.RWMutex
}

func NewRoomManager(db *sql.DB) *RoomManager {
	return &RoomManager{
		db:           db,
		rooms:        make(map[string]*models.Room),
		participants: make(map[string]map[string]*models.Participant),
		sessions:     make(map[string]*models.WebRTCSession),
	}
}

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

	query := `INSERT INTO rooms (id, chama_id, name, type, status, max_participants, created_by, created_at, recording_enabled) 
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
	_, err := rm.db.Exec(query, room.ID, room.ChamaID, room.Name, room.Type, room.Status, 
		room.MaxParticipants, room.CreatedBy, room.CreatedAt, room.RecordingEnabled)
	if err != nil {
		return err
	}

	rm.rooms[room.ID] = room
	return nil
}

func (rm *RoomManager) GetRoom(roomID string) (*models.Room, error) {
	rm.mu.RLock()
	room, exists := rm.rooms[roomID]
	rm.mu.RUnlock()

	if exists {
		return room, nil
	}

	var dbRoom models.Room
	query := `SELECT id, chama_id, name, type, status, max_participants, created_by, created_at, ended_at, recording_enabled 
		FROM rooms WHERE id = $1`
	err := rm.db.QueryRow(query, roomID).Scan(&dbRoom.ID, &dbRoom.ChamaID, &dbRoom.Name, 
		&dbRoom.Type, &dbRoom.Status, &dbRoom.MaxParticipants, &dbRoom.CreatedBy, 
		&dbRoom.CreatedAt, &dbRoom.EndedAt, &dbRoom.RecordingEnabled)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("room not found")
		}
		return nil, err
	}

	rm.mu.Lock()
	rm.rooms[roomID] = &dbRoom
	rm.mu.Unlock()

	return &dbRoom, nil
}

func (rm *RoomManager) EndRoom(roomID string) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	room, exists := rm.rooms[roomID]
	if !exists {
		return errors.New("room not found")
	}

	now := time.Now()
	room.Status = models.RoomStatusEnded
	room.EndedAt = &now

	query := `UPDATE rooms SET status = $1, ended_at = $2 WHERE id = $3`
	_, err := rm.db.Exec(query, room.Status, room.EndedAt, roomID)
	if err != nil {
		return err
	}

	delete(rm.rooms, roomID)

	if participants, ok := rm.participants[roomID]; ok {
		for userID, participant := range participants {
			now := time.Now()
			participant.LeftAt = &now
			delete(rm.participants[roomID], userID)
		}
		delete(rm.participants, roomID)
	}

	return nil
}

func (rm *RoomManager) JoinRoom(roomID, userID, displayName, role string) (*models.Participant, error) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	room, exists := rm.rooms[roomID]
	if !exists {
		var dbRoom models.Room
		query := `SELECT id, max_participants FROM rooms WHERE id = $1`
		err := rm.db.QueryRow(query, roomID).Scan(&dbRoom.ID, &dbRoom.MaxParticipants)
		if err != nil {
			return nil, errors.New("room not found")
		}
		room = &dbRoom
		rm.rooms[roomID] = room
	}

	if rm.isRoomFullUnsafe(roomID) {
		return nil, errors.New("room is full")
	}

	now := time.Now()
	participant := &models.Participant{
		ID:          generateID(),
		RoomID:      roomID,
		UserID:      userID,
		DisplayName: displayName,
		Role:        models.ParticipantRole(role),
		IsMuted:     false,
		IsVideoOn:   false,
		JoinedAt:    now,
	}

	query := `INSERT INTO participants (id, room_id, user_id, display_name, role, joined_at) 
		VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := rm.db.Exec(query, participant.ID, participant.RoomID, participant.UserID,
		participant.DisplayName, participant.Role, participant.JoinedAt)
	if err != nil {
		return nil, err
	}

	if rm.participants[roomID] == nil {
		rm.participants[roomID] = make(map[string]*models.Participant)
	}
	rm.participants[roomID][userID] = participant

	return participant, nil
}

func (rm *RoomManager) LeaveRoom(roomID, userID string) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	if rm.participants[roomID] == nil {
		return errors.New("user not in room")
	}

	participant, exists := rm.participants[roomID][userID]
	if !exists {
		return errors.New("user not in room")
	}

	now := time.Now()
	participant.LeftAt = &now

	query := `UPDATE participants SET left_at = $1 WHERE id = $2`
	_, err := rm.db.Exec(query, now, participant.ID)
	if err != nil {
		return err
	}

	delete(rm.participants[roomID], userID)

	return nil
}

func (rm *RoomManager) GetParticipants(roomID string) ([]*models.Participant, error) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	var participants []*models.Participant

	if roomParticipants, ok := rm.participants[roomID]; ok {
		for _, p := range roomParticipants {
			participants = append(participants, p)
		}
	}

	if len(participants) == 0 {
		query := `SELECT id, room_id, user_id, display_name, role, is_muted, is_video_on, 
			is_screen_sharing, joined_at, left_at FROM participants WHERE room_id = $1`
		rows, err := rm.db.Query(query, roomID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		for rows.Next() {
			var p models.Participant
			err := rows.Scan(&p.ID, &p.RoomID, &p.UserID, &p.DisplayName, &p.Role,
				&p.IsMuted, &p.IsVideoOn, &p.IsScreenSharing, &p.JoinedAt, &p.LeftAt)
			if err != nil {
				continue
			}
			participants = append(participants, &p)
		}
	}

	return participants, nil
}

func (rm *RoomManager) UpdateParticipant(roomID, userID string, updates map[string]interface{}) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	if rm.participants[roomID] == nil {
		return errors.New("user not in room")
	}

	participant, exists := rm.participants[roomID][userID]
	if !exists {
		return errors.New("user not in room")
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

	return len(rm.participants[roomID]) >= room.MaxParticipants
}

func (rm *RoomManager) GetActiveRoomsCount() int {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return len(rm.rooms)
}

func (rm *RoomManager) GetStats() map[string]interface{} {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	stats := map[string]interface{}{
		"activeRooms":   rm.GetActiveRoomsCount(),
		"totalSessions": len(rm.sessions),
	}

	var totalParticipants int
	for _, participants := range rm.participants {
		totalParticipants += len(participants)
	}
	stats["totalParticipants"] = totalParticipants

	return stats
}

func (rm *RoomManager) CleanupStaleRooms(maxAge time.Duration) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	cutoff := time.Now().Add(-maxAge)
	for roomID, room := range rm.rooms {
		if room.CreatedAt.Before(cutoff) && room.Status == models.RoomStatusWaiting {
			delete(rm.rooms, roomID)
			if rm.participants[roomID] != nil {
				delete(rm.participants, roomID)
			}
		}
	}
}

func generateID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

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