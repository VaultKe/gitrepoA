package room

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"sort"
	"sync"
	"time"

	"vaultke-chat-service/internal/models"
)

type RoomManager struct {
	rooms      map[string]*models.ChatRoom
	members    map[string]map[string]*models.ChatRoomMember
	userRooms  map[string]string
	mu         sync.RWMutex
	db         *sql.DB
}

func NewRoomManager(db *sql.DB) *RoomManager {
	return &RoomManager{
		rooms:     make(map[string]*models.ChatRoom),
		members:   make(map[string]map[string]*models.ChatRoomMember),
		userRooms: make(map[string]string),
		db:        db,
	}
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
	defer rm.mu.RUnlock()

	room, exists := rm.rooms[roomID]
	if !exists {
		return nil, sql.ErrNoRows
	}
	return room, nil
}

func (rm *RoomManager) GetUserRooms(userID string) ([]*models.ChatRoom, error) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	var rooms []*models.ChatRoom
	for _, room := range rm.rooms {
		if _, isMember := rm.members[room.ID]; isMember {
			if _, exists := rm.members[room.ID][userID]; exists {
				rooms = append(rooms, room)
			}
		}
	}
	return rooms, nil
}

func (rm *RoomManager) JoinRoom(roomID, userID, role string) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	room, exists := rm.rooms[roomID]
	if !exists {
		return sql.ErrNoRows
	}

	if rm.members[roomID] == nil {
		rm.members[roomID] = make(map[string]*models.ChatRoomMember)
	}

	rm.members[roomID][userID] = &models.ChatRoomMember{
		ID:      room.ID + "_" + userID,
		RoomID:  roomID,
		UserID:  userID,
		Role:    models.MemberRole(role),
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
	defer rm.mu.RUnlock()

	if rm.members[roomID] == nil {
		return nil, sql.ErrNoRows
	}

	var members []*models.ChatRoomMember
	for _, m := range rm.members[roomID] {
		members = append(members, m)
	}
	return members, nil
}

func (rm *RoomManager) IsMember(roomID, userID string) bool {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	if rm.members[roomID] == nil {
		return false
	}
	_, exists := rm.members[roomID][userID]
	return exists
}

func (rm *RoomManager) FindPrivateRoom(userA, userB string) (*models.ChatRoom, error) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	ids := []string{userA, userB}
	sort.Strings(ids)
	combined := ids[0] + ":" + ids[1]
	hash := sha256.Sum256([]byte(combined))
	roomID := hex.EncodeToString(hash[:])[:16]

	room, exists := rm.rooms[roomID]
	if !exists {
		return nil, sql.ErrNoRows
	}
	return room, nil
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