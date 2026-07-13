package room

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"sort"
	"strings"
	"sync"
	"time"

	"vaultke-chat-service/internal/models"
)

type RoomManager struct {
	rooms     map[string]*models.ChatRoom
	members   map[string]map[string]*models.ChatRoomMember
	userRooms map[string]string
	mu        sync.RWMutex
	db        *sql.DB
}

func NewRoomManager(db *sql.DB) *RoomManager {
	return &RoomManager{
		rooms:     make(map[string]*models.ChatRoom),
		members:   make(map[string]map[string]*models.ChatRoomMember),
		userRooms: make(map[string]string),
		db:        db,
	}
}

func (rm *RoomManager) LoadFromDB() error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	rows, err := rm.db.Query(`
		SELECT id, chama_id, name, type, created_by, is_active, last_message, last_message_at, created_at, updated_at
		FROM chat_rooms WHERE is_active = TRUE`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var room models.ChatRoom
		var chamaID, lastMessage sql.NullString
		var name sql.NullString
		var lastMessageAt, createdAt, updatedAt sql.NullTime
		if err := rows.Scan(&room.ID, &chamaID, &name, &room.Type, &room.CreatedBy, &room.IsActive,
			&lastMessage, &lastMessageAt, &createdAt, &updatedAt); err != nil {
			return err
		}
		room.ChamaID = chamaID
		room.Name = name.String
		room.LastMessage = lastMessage.String
		room.LastMessageAt = lastMessageAt.Time
		room.CreatedAt = createdAt.Time
		room.UpdatedAt = updatedAt.Time
		rm.rooms[room.ID] = &room
	}

	mRows, err := rm.db.Query(`
		SELECT id, room_id, user_id, role, joined_at, last_read_at, is_active
		FROM chat_room_members WHERE is_active = TRUE`)
	if err != nil {
		return err
	}
	defer mRows.Close()

	for mRows.Next() {
		var member models.ChatRoomMember
		var lastReadAt sql.NullTime
		if err := mRows.Scan(&member.ID, &member.RoomID, &member.UserID, &member.Role,
			&member.JoinedAt, &lastReadAt, &member.IsActive); err != nil {
			return err
		}
		member.LastReadAt = lastReadAt.Time
		if rm.members[member.RoomID] == nil {
			rm.members[member.RoomID] = make(map[string]*models.ChatRoomMember)
		}
		rm.members[member.RoomID][member.UserID] = &member
		rm.userRooms[member.UserID] = member.RoomID
	}

	return nil
}

func (rm *RoomManager) CreateRoom(room *models.ChatRoom, members []*models.ChatRoomMember) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	rm.rooms[room.ID] = room

	if _, exists := rm.members[room.ID]; !exists {
		rm.members[room.ID] = make(map[string]*models.ChatRoomMember)
	}

	for _, m := range members {
		rm.members[room.ID][m.UserID] = m
		rm.userRooms[m.UserID] = room.ID
	}

	return nil
}

func (rm *RoomManager) GetRoom(roomID string) (*models.ChatRoom, error) {
	rm.mu.RLock()
	room, exists := rm.rooms[roomID]
	rm.mu.RUnlock()
	if exists {
		return room, nil
	}

	var r models.ChatRoom
	var chamaID sql.NullString
	var name sql.NullString
	var lastMessage sql.NullString
	var lastMessageAt, createdAt, updatedAt sql.NullTime
	err := rm.db.QueryRow(`
		SELECT id, chama_id, name, type, created_by, is_active, last_message, last_message_at, created_at, updated_at
		FROM chat_rooms WHERE id = $1`, roomID).Scan(
		&r.ID, &chamaID, &name, &r.Type, &r.CreatedBy, &r.IsActive,
		&lastMessage, &lastMessageAt, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}
	r.ChamaID = chamaID
	r.Name = name.String
	r.LastMessage = lastMessage.String
	r.LastMessageAt = lastMessageAt.Time
	r.CreatedAt = createdAt.Time
	r.UpdatedAt = updatedAt.Time

	rm.mu.Lock()
	rm.rooms[roomID] = &r
	rm.mu.Unlock()
	return &r, nil
}

func (rm *RoomManager) GetUserRooms(userID string) ([]*models.ChatRoom, error) {
	rm.mu.RLock()
	var cached []*models.ChatRoom
	seen := make(map[string]bool)
	for _, room := range rm.rooms {
		cachedMembers, ok := rm.members[room.ID]
		if !ok {
			continue
		}
		if _, exists := cachedMembers[userID]; !exists {
			continue
		}

		// Collapse duplicate conversations: a 1:1 private chat is uniquely
		// identified by its participant pair, a chama chat by its chamaId.
		// Rooms created before de-duplication was enforced can otherwise
		// appear twice in the chat list ("sent" vs "received").
		var key string
		if room.Type == models.RoomTypePrivate {
			key = privatePairKey(cachedMembers)
		} else if room.Type == models.RoomTypeChama && room.ChamaID.Valid {
			key = "chama:" + room.ChamaID.String
		}
		if key != "" {
			if seen[key] {
				continue
			}
			seen[key] = true
		}

		cached = append(cached, room)
	}
	rm.mu.RUnlock()

	if len(cached) > 0 {
		return cached, nil
	}

	rows, err := rm.db.Query(`
		SELECT r.id, r.chama_id, r.name, r.type, r.created_by, r.is_active, r.last_message, r.last_message_at, r.created_at, r.updated_at
		FROM chat_rooms r
		JOIN chat_room_members m ON m.room_id = r.id AND m.user_id = $1 AND m.is_active = TRUE
		WHERE r.is_active = TRUE`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rooms []*models.ChatRoom
	for rows.Next() {
		var room models.ChatRoom
		var chamaID sql.NullString
		var name sql.NullString
		var lastMessage sql.NullString
		var lastMessageAt, createdAt, updatedAt sql.NullTime
		if err := rows.Scan(&room.ID, &chamaID, &name, &room.Type, &room.CreatedBy, &room.IsActive,
			&lastMessage, &lastMessageAt, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		room.ChamaID = chamaID
		room.Name = name.String
		room.LastMessage = lastMessage.String
		room.LastMessageAt = lastMessageAt.Time
		room.CreatedAt = createdAt.Time
		room.UpdatedAt = updatedAt.Time
		rooms = append(rooms, &room)

		rm.mu.Lock()
		rm.rooms[room.ID] = &room
		rm.mu.Unlock()
	}
	return rooms, nil
}

func (rm *RoomManager) JoinRoom(roomID, userID, role string) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	_, exists := rm.rooms[roomID]
	if !exists {
		return sql.ErrNoRows
	}

	if rm.members[roomID] == nil {
		rm.members[roomID] = make(map[string]*models.ChatRoomMember)
	}

	rm.members[roomID][userID] = &models.ChatRoomMember{
		ID:       roomID + "_" + userID,
		RoomID:   roomID,
		UserID:   userID,
		Role:     models.MemberRole(role),
		JoinedAt: time.Now().UTC(),
		IsActive: true,
	}
	rm.userRooms[userID] = roomID
	return nil
}

func (rm *RoomManager) LeaveRoom(roomID, userID string) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	if rm.members[roomID] == nil {
		return sql.ErrNoRows
	}

	delete(rm.members[roomID], userID)
	delete(rm.userRooms, userID)
	return nil
}

func (rm *RoomManager) GetMembers(roomID string) ([]*models.ChatRoomMember, error) {
	rm.mu.RLock()
	if cached, ok := rm.members[roomID]; ok && len(cached) > 0 {
		var members []*models.ChatRoomMember
		for _, m := range cached {
			members = append(members, m)
		}
		rm.mu.RUnlock()
		return members, nil
	}
	rm.mu.RUnlock()

	rows, err := rm.db.Query(`
		SELECT id, room_id, user_id, role, joined_at, last_read_at, is_active
		FROM chat_room_members WHERE room_id = $1 AND is_active = TRUE`, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []*models.ChatRoomMember
	for rows.Next() {
		var m models.ChatRoomMember
		var lastReadAt sql.NullTime
		if err := rows.Scan(&m.ID, &m.RoomID, &m.UserID, &m.Role, &m.JoinedAt, &lastReadAt, &m.IsActive); err != nil {
			return nil, err
		}
		m.LastReadAt = lastReadAt.Time
		members = append(members, &m)

		rm.mu.Lock()
		if rm.members[roomID] == nil {
			rm.members[roomID] = make(map[string]*models.ChatRoomMember)
		}
		rm.members[roomID][m.UserID] = &m
		rm.mu.Unlock()
	}
	return members, nil
}

func (rm *RoomManager) IsMember(roomID, userID string) bool {
	rm.mu.RLock()
	if cached, ok := rm.members[roomID]; ok {
		_, exists := cached[userID]
		rm.mu.RUnlock()
		return exists
	}
	rm.mu.RUnlock()

	var exists bool
	err := rm.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM chat_room_members WHERE room_id = $1 AND user_id = $2 AND is_active = TRUE)`,
		roomID, userID).Scan(&exists)
	if err != nil {
		return false
	}

	rm.mu.Lock()
	defer rm.mu.Unlock()
	if rm.members[roomID] == nil {
		rm.members[roomID] = make(map[string]*models.ChatRoomMember)
	}
	if !exists {
		delete(rm.members[roomID], userID)
	} else {
		rm.members[roomID][userID] = &models.ChatRoomMember{
			RoomID:   roomID,
			UserID:   userID,
			IsActive: true,
			JoinedAt: time.Now().UTC(),
		}
	}
	return exists
}

func (rm *RoomManager) FindPrivateRoom(userA, userB string) (*models.ChatRoom, error) {
	ids := []string{userA, userB}
	sort.Strings(ids)
	combined := ids[0] + ":" + ids[1]
	hash := sha256.Sum256([]byte(combined))
	roomID := hex.EncodeToString(hash[:])[:16]

	rm.mu.RLock()
	if room, ok := rm.rooms[roomID]; ok {
		rm.mu.RUnlock()
		return room, nil
	}
	rm.mu.RUnlock()

	var room models.ChatRoom
	var chamaID sql.NullString
	var name sql.NullString
	var lastMessage sql.NullString
	var lastMessageAt, createdAt, updatedAt sql.NullTime
	err := rm.db.QueryRow(`
		SELECT id, chama_id, name, type, created_by, is_active, last_message, last_message_at, created_at, updated_at
		FROM chat_rooms WHERE id = $1 AND type = 'private'`, roomID).Scan(
		&room.ID, &chamaID, &name, &room.Type, &room.CreatedBy, &room.IsActive,
		&lastMessage, &lastMessageAt, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}
	room.ChamaID = chamaID
	room.Name = name.String
	room.LastMessage = lastMessage.String
	room.LastMessageAt = lastMessageAt.Time
	room.CreatedAt = createdAt.Time
	room.UpdatedAt = updatedAt.Time

	rm.mu.Lock()
	rm.rooms[roomID] = &room
	rm.mu.Unlock()
	return &room, nil
}

// privatePairKey returns a stable string for the set of members in a private
// room so duplicate 1:1 conversations (same two users) can be collapsed.
func privatePairKey(members map[string]*models.ChatRoomMember) string {
	ids := make([]string, 0, len(members))
	for uid := range members {
		ids = append(ids, uid)
	}
	sort.Strings(ids)
	return strings.Join(ids, ":")
}

func (rm *RoomManager) UpdateLastMessage(roomID, content string) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	room, exists := rm.rooms[roomID]
	if !exists {
		return sql.ErrNoRows
	}

	room.LastMessage = content
	room.LastMessageAt = time.Now().UTC()
	room.UpdatedAt = time.Now().UTC()

	_, err := rm.db.Exec(`UPDATE chat_rooms SET last_message = $1, last_message_at = $2, updated_at = $3 WHERE id = $4`,
		content, room.LastMessageAt, room.UpdatedAt, roomID)
	if err != nil {
		return err
	}
	return nil
}

func (rm *RoomManager) MarkAsRead(roomID, userID string) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	if rm.members[roomID] == nil {
		return sql.ErrNoRows
	}

	member, exists := rm.members[roomID][userID]
	if !exists {
		return sql.ErrNoRows
	}

	member.LastReadAt = time.Now().UTC()
	return nil
}

func (rm *RoomManager) CleanupStaleRooms(maxAge time.Duration) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	threshold := time.Now().UTC().Add(-maxAge)
	for id, room := range rm.rooms {
		if room.UpdatedAt.Before(threshold) && !room.IsActive {
			delete(rm.rooms, id)
			delete(rm.members, id)
		}
	}
	return nil
}
