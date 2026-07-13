package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"vaultke-chat-service/internal/models"
	"vaultke-chat-service/internal/room"
	ws "vaultke-chat-service/internal/websocket"
)

type ChatHandler struct {
	db       *sql.DB
	hub      *ws.Hub
	roomMgr  *room.RoomManager
	upgrader websocket.Upgrader
	sessions map[string]string // sessionID -> userID
	mu       sync.Mutex
}

func NewChatHandler(db *sql.DB, hub *ws.Hub, roomMgr *room.RoomManager) *ChatHandler {
	return &ChatHandler{
		db:      db,
		hub:     hub,
		roomMgr: roomMgr,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
		sessions: make(map[string]string),
	}
}

func (h *ChatHandler) CreateRoom(c *gin.Context) {
	userID := c.GetString("userID")
	var req struct {
		Name        string              `json:"name"`
		Type        models.ChatRoomType `json:"type" binding:"required"`
		ChamaID     string              `json:"chamaId,omitempty"`
		MemberIDs   []string            `json:"memberIds,omitempty"`
		RecipientID string              `json:"recipientId,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Normalize the other participant(s) for a private 1:1 chat. The mobile
	// client sends `recipientId`; make sure it is treated as a member.
	if req.Type == models.RoomTypePrivate {
		if req.RecipientID != "" && !contains(req.MemberIDs, req.RecipientID) {
			req.MemberIDs = append(req.MemberIDs, req.RecipientID)
		}
		if len(req.MemberIDs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "a recipient is required for private chats"})
			return
		}
		if len(req.MemberIDs) > 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "private chats are limited to two participants"})
			return
		}
	}

	// Reuse an existing conversation instead of creating a duplicate room that
	// would show up twice in the chat list ("sent" vs "received").
	room := h.resolveRoom(struct {
		Name        string
		Type        models.ChatRoomType
		ChamaID     string
		MemberIDs   []string
		RecipientID string
	}{req.Name, req.Type, req.ChamaID, req.MemberIDs, req.RecipientID}, userID)

	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	// Only create the room row when it does not already exist.
	var exists bool
	if err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM chat_rooms WHERE id = $1)`, room.ID).Scan(&exists); err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	if !exists {
		_, err = tx.Exec(`INSERT INTO chat_rooms (id, chama_id, name, type, created_by, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			room.ID, room.ChamaID, room.Name, room.Type, room.CreatedBy, room.IsActive, room.CreatedAt, room.UpdatedAt)
		if err != nil {
			// A concurrent request may have already created this chama room.
			// The database now enforces a unique constraint on chama_id for
			// active chama rooms, so fetch the existing room instead of failing.
			if req.Type == models.RoomTypeChama && req.ChamaID != "" {
				var existingID string
				if qErr := tx.QueryRow(`SELECT id FROM chat_rooms WHERE chama_id = $1 AND type = 'chama' AND is_active = TRUE LIMIT 1`, req.ChamaID).Scan(&existingID); qErr == nil && existingID != "" {
					room.ID = existingID
					if existing, e := h.roomMgr.GetRoom(existingID); e == nil {
						room = existing
					} else {
						// Fallback: reload room metadata from DB so the response
						// carries the canonical room data.
						var r models.ChatRoom
						var chamaID sql.NullString
						var name sql.NullString
						var lastMessage sql.NullString
						var lastMessageAt, createdAt, updatedAt sql.NullTime
						if scanErr := tx.QueryRow(`SELECT id, chama_id, name, type, created_by, is_active, last_message, last_message_at, created_at, updated_at FROM chat_rooms WHERE id = $1`, existingID).Scan(
							&r.ID, &chamaID, &name, &r.Type, &r.CreatedBy, &r.IsActive, &lastMessage, &lastMessageAt, &createdAt, &updatedAt); scanErr == nil {
							r.ChamaID = chamaID
							r.Name = name.String
							r.LastMessage = lastMessage.String
							r.LastMessageAt = lastMessageAt.Time
							r.CreatedAt = createdAt.Time
							r.UpdatedAt = updatedAt.Time
							room = &r
						}
					}
				} else {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve chat room conflict"})
					return
				}
			} else {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create room"})
				return
			}
		}
	}

	members := []*models.ChatRoomMember{{
		ID:       uuid.New().String(),
		RoomID:   room.ID,
		UserID:   userID,
		Role:     models.RoleAdmin,
		JoinedAt: time.Now().UTC(),
		IsActive: true,
	}}

	for _, uid := range req.MemberIDs {
		if uid != userID && !containsMember(members, uid) {
			members = append(members, models.NewChatRoomMember(room.ID, uid, models.RoleMember))
		}
	}

	// Upsert memberships so re-opening an existing room (or being added to it)
	// does not fail on the unique (room_id, user_id) constraint.
	for _, m := range members {
		_, err = tx.Exec(`
			INSERT INTO chat_room_members (id, room_id, user_id, role, joined_at, is_active)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (room_id, user_id) DO UPDATE SET is_active = TRUE`,
			m.ID, m.RoomID, m.UserID, m.Role, m.JoinedAt, m.IsActive)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add members"})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to commit chat room creation"})
		return
	}

	h.roomMgr.CreateRoom(room, members)
	c.JSON(http.StatusOK, gin.H{"success": true, "data": room})
}

func contains(list []string, value string) bool {
	for _, v := range list {
		if v == value {
			return true
		}
	}
	return false
}

func containsMember(members []*models.ChatRoomMember, userID string) bool {
	for _, m := range members {
		if m.UserID == userID {
			return true
		}
	}
	return false
}

// roomToMap normalizes a room into the JSON shape the clients expect.
func roomToMap(r *models.ChatRoom) map[string]interface{} {
	lastMessageAt := r.LastMessageAt
	if lastMessageAt.IsZero() {
		lastMessageAt = r.CreatedAt
	}
	chamaID := ""
	if r.ChamaID.Valid {
		chamaID = r.ChamaID.String
	}
	return map[string]interface{}{
		"id":            r.ID,
		"chamaId":      chamaID,
		"name":          r.Name,
		"type":          r.Type,
		"createdBy":     r.CreatedBy,
		"isActive":      r.IsActive,
		"lastMessage":   r.LastMessage,
		"lastMessageAt": lastMessageAt,
		"createdAt":     r.CreatedAt,
		"updatedAt":     r.UpdatedAt,
	}
}

// resolveRoom returns the room that a create request should target, reusing an
// existing conversation when one already exists (chama rooms keyed by chamaId,
// private 1:1 rooms by their deterministic id) instead of duplicating it.
func (h *ChatHandler) resolveRoom(req struct {
	Name        string
	Type        models.ChatRoomType
	ChamaID     string
	MemberIDs   []string
	RecipientID string
}, userID string) *models.ChatRoom {

	if req.Type == models.RoomTypeChama && req.ChamaID != "" {
		var rid string
		if err := h.db.QueryRow(
			`SELECT id FROM chat_rooms WHERE chama_id = $1 AND is_active = TRUE LIMIT 1`,
			req.ChamaID,
		).Scan(&rid); err == nil && rid != "" {
			if existing, e := h.roomMgr.GetRoom(rid); e == nil {
				return existing
			}
		}
	} else if req.Type == models.RoomTypePrivate && len(req.MemberIDs) == 1 {
		if existing, err := h.roomMgr.FindPrivateRoom(userID, req.MemberIDs[0]); err == nil && existing != nil {
			return existing
		}
	}

	if req.Type == models.RoomTypePrivate && len(req.MemberIDs) == 1 {
		return models.NewPrivateRoom(userID, req.MemberIDs[0], req.Name, userID)
	}
	return models.NewChatRoom(req.ChamaID, req.Name, req.Type, userID)
}

// fetchMessages returns a room's messages newest-first from the DB, then
// reverses to chronological order for the UI. Initial loads return the latest
// N messages; subsequent loads use the `before` message id as a cursor to
// fetch older batches without linear OFFSET scans.
func (h *ChatHandler) fetchMessages(roomID, before string, limit, offset int) ([]*models.ChatMessage, error) {
	baseQuery := `SELECT id, room_id as "roomId", sender_id as "senderId", content, type, metadata, image_url as "imageUrl",
		reply_to_id as "replyToId", created_at as "createdAt", updated_at as "editedAt"
		FROM chat_messages WHERE room_id = $1 AND is_deleted = false`

	var rows *sql.Rows
	var err error

	if before != "" {
		// Cursor-based pagination: get `limit` messages older than the reference.
		rows, err = h.db.Query(baseQuery+` AND created_at < (SELECT created_at FROM chat_messages WHERE id = $2)
			ORDER BY created_at DESC LIMIT $3`, roomID, before, limit)
	} else {
		// Initial load: newest `limit` messages so the chat opens on recent history.
		rows, err = h.db.Query(baseQuery+` ORDER BY created_at DESC LIMIT $2`, roomID, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []*models.ChatMessage
	for rows.Next() {
		var m models.ChatMessage
		var repliedTo sql.NullString
		var imageUrl sql.NullString
		if err := rows.Scan(&m.ID, &m.RoomID, &m.SenderID, &m.Content, &m.Type, &m.Metadata, &imageUrl,
			&repliedTo, &m.CreatedAt, &m.EditedAt); err != nil {
			continue
		}
		m.ReplyToID = repliedTo
		if imageUrl.Valid {
			m.ImageUrl = imageUrl.String
		}
		messages = append(messages, &m)
	}

	// Reverse so callers always receive oldest-first regardless of branch.
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}
	return messages, nil
}

func (h *ChatHandler) GetRooms(c *gin.Context) {
	userID := c.GetString("userID")
	rooms, err := h.roomMgr.GetUserRooms(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch rooms"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": rooms})
}

func (h *ChatHandler) GetRoom(c *gin.Context) {
	roomID := c.Param("roomId")
	room, err := h.roomMgr.GetRoom(roomID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	var messages struct {
		Items []models.ChatMessage `json:"items"`
	}
	err = h.db.QueryRow(`SELECT json_agg(row_to_json(m)) FROM (
		SELECT id, room_id as "roomId", sender_id as "senderId", content, type, metadata, is_deleted as "isDeleted", 
		reply_to_id as "replyToId", created_at as "createdAt", updated_at as "editedAt"
		FROM chat_messages WHERE room_id = $1 AND is_deleted = false ORDER BY created_at DESC LIMIT 50
	) m`, roomID).Scan(&messages.Items)

	if err != nil && err != sql.ErrNoRows {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch messages"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"room":     room,
		"messages": messages.Items,
	}})
}

func (h *ChatHandler) JoinRoom(c *gin.Context) {
	userID := c.GetString("userID")
	roomID := c.Param("roomId")

	err := h.roomMgr.JoinRoom(roomID, userID, string(models.RoleMember))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"status": "joined"}})
}

func (h *ChatHandler) LeaveRoom(c *gin.Context) {
	userID := c.GetString("userID")
	roomID := c.Param("roomId")

	err := h.roomMgr.LeaveRoom(roomID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"status": "left"}})
}

func (h *ChatHandler) GetMessages(c *gin.Context) {
	roomID := c.Param("roomId")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	before := c.Query("before")

	messages, err := h.fetchMessages(roomID, before, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch messages"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": messages})
}

func (h *ChatHandler) SendMessage(c *gin.Context) {
	userID := c.GetString("userID")
	roomID := c.Param("roomId")

	var req struct {
		Content  string                 `json:"content" binding:"required"`
		Type     models.MessageType     `json:"type"`
		ReplyTo  string                 `json:"replyToId,omitempty"`
		Metadata map[string]interface{} `json:"metadata,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	chatMsg := h.buildChatMessage(roomID, userID, req.Content, req.Type, req.ReplyTo, req.Metadata)
	if chatMsg == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save message"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": chatMsg})
}

// buildChatMessage persists a message and broadcasts it to the room. It
// returns the saved message (with server-assigned id/timestamp) or nil on
// failure. The DB insert is synchronous (so nothing is acked before it is
// persisted); the room "last message" preview is updated asynchronously to
// keep delivery off the critical path.
func (h *ChatHandler) buildChatMessage(roomID, userID, content string, msgType models.MessageType, replyTo string, metadata map[string]interface{}) *models.ChatMessage {
	chatMsg := models.NewChatMessage(roomID, userID, content, msgType)
	if replyTo != "" {
		chatMsg.ReplyToID = sql.NullString{String: replyTo, Valid: true}
	}
	chatMsg.Metadata = metadata

	if metadata != nil {
		if imageUrl, ok := metadata["imageUrl"].(string); ok && imageUrl != "" {
			chatMsg.ImageUrl = imageUrl
		}
		if imageUri, ok := metadata["imageUri"].(string); ok && imageUri != "" {
			chatMsg.ImageUrl = imageUri
		}
	}

	metadataJSON, _ := json.Marshal(chatMsg.Metadata)
	_, dbErr := h.db.Exec(`INSERT INTO chat_messages (id, room_id, sender_id, content, type, metadata, image_url, is_deleted, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		chatMsg.ID, chatMsg.RoomID, chatMsg.SenderID, chatMsg.Content, chatMsg.Type, metadataJSON, chatMsg.ImageUrl, chatMsg.IsDeleted, chatMsg.CreatedAt)
	if dbErr != nil {
		fmt.Printf("MESSAGE SAVE ERROR room=%s user=%s err=%v\n", roomID, userID, dbErr)
		return nil
	}

	go h.roomMgr.UpdateLastMessage(roomID, content)

	broadcastResp := gin.H{
		"type":   "new_message",
		"roomId": roomID,
		"data": gin.H{
			"id":              chatMsg.ID,
			"roomId":          chatMsg.RoomID,
			"senderId":        chatMsg.SenderID,
			"content":         chatMsg.Content,
			"type":            chatMsg.Type,
			"metadata":        chatMsg.Metadata,
			"imageUrl":        chatMsg.ImageUrl,
			"createdAt":       chatMsg.CreatedAt,
			"clientMessageId": "",
		},
	}
	if broadcastData, err := json.Marshal(broadcastResp); err == nil {
		h.hub.BroadcastToRoom(roomID, broadcastData, "")
	}

	return chatMsg
}

func (h *ChatHandler) GetWSToken(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	sessionID := uuid.New().String()
	h.mu.Lock()
	h.sessions[sessionID] = userID
	h.mu.Unlock()

	_ = time.AfterFunc(5*time.Minute, func() {
		h.mu.Lock()
		delete(h.sessions, sessionID)
		h.mu.Unlock()
	})

	c.JSON(http.StatusOK, gin.H{
		"sessionId": sessionID,
		"expiresIn": 300,
	})
}

func (h *ChatHandler) WebSocketEndpoint(c *gin.Context) {
	sessionID := c.Query("session")
	userID := ""
	if sessionID != "" {
		h.mu.Lock()
		userID, _ = h.sessions[sessionID]
		h.mu.Unlock()
	}

	if userID == "" {
		userID = c.GetHeader("X-User-ID")
	}

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := &ws.Client{
		Conn:   conn,
		Send:   make(chan []byte, 256),
		UserID: userID,
		Hub:    h.hub,
	}
	h.hub.Register(client)
	go client.WritePump()
	client.ReadPump(func(cl *ws.Client, raw []byte) {
		h.handleWSMessage(cl, userID, raw)
	})
}

// handleWSMessage is the single, WS-only entry point for every chat
// operation: join, history, create, send, read, typing, delete, leave.
// Each request that expects a response carries a `requestId`; the matching
// response is correlated on the client so many in-flight operations (e.g.
// scrolling several rooms) never collide.
func (h *ChatHandler) handleWSMessage(cl *ws.Client, userID string, raw []byte) {
	var wsMsg struct {
		Type        string                 `json:"type"`
		RoomID      string                 `json:"roomId,omitempty"`
		Content     string                 `json:"content,omitempty"`
		MessageType string                 `json:"messageType,omitempty"`
		Metadata    map[string]interface{} `json:"metadata,omitempty"`
		ClientMsgID string                 `json:"clientMessageId,omitempty"`
		RequestID   string                 `json:"requestId,omitempty"`
		MessageID   string                 `json:"messageId,omitempty"`
		Name        string                 `json:"name,omitempty"`
		ChamaID     string                 `json:"chamaId,omitempty"`
		MemberIDs   []string               `json:"memberIds,omitempty"`
		RecipientID string                 `json:"recipientId,omitempty"`
		Limit       int                   `json:"limit,omitempty"`
		Offset      int                   `json:"offset,omitempty"`
		Before      string                 `json:"before,omitempty"`
	}
	if err := json.Unmarshal(raw, &wsMsg); err != nil {
		fmt.Printf("WS ERROR: Failed to unmarshal message: %v\n", err)
		return
	}

	send := func(payload gin.H) {
		if data, err := json.Marshal(payload); err == nil {
			cl.Write(data)
		}
	}

	switch wsMsg.Type {
	case "join_room":
		if wsMsg.RoomID != "" {
			h.hub.JoinRoom(cl, wsMsg.RoomID)
		}

	case "leave_room":
		if wsMsg.RoomID != "" {
			h.hub.LeaveRoom(cl, wsMsg.RoomID)
		}

	case "get_rooms":
		rooms, err := h.roomMgr.GetUserRooms(userID)
		if err != nil {
			send(gin.H{"type": "rooms_list", "requestId": wsMsg.RequestID, "success": false, "error": "failed to load rooms"})
			return
		}
		list := make([]map[string]interface{}, 0, len(rooms))
		for _, r := range rooms {
			list = append(list, roomToMap(r))
		}
		send(gin.H{"type": "rooms_list", "requestId": wsMsg.RequestID, "success": true, "data": list})

	case "get_messages", "get_history":
		limit := wsMsg.Limit
		if limit <= 0 || limit > 100 {
			limit = 50
		}
		msgs, err := h.fetchMessages(wsMsg.RoomID, wsMsg.Before, limit, wsMsg.Offset)
		if err != nil {
			send(gin.H{"type": "messages_list", "requestId": wsMsg.RequestID, "success": false, "error": "failed to load messages"})
			return
		}
		send(gin.H{"type": "messages_list", "requestId": wsMsg.RequestID, "success": true, "data": msgs})

	case "create_room":
		room := h.resolveRoom(struct {
			Name        string
			Type        models.ChatRoomType
			ChamaID     string
			MemberIDs   []string
			RecipientID string
		}{wsMsg.Name, models.RoomTypeChama, wsMsg.ChamaID, wsMsg.MemberIDs, wsMsg.RecipientID}, userID)

		// Persist + upsert members inside a transaction so a concurrent
		// create cannot duplicate the (chama/private) room.
		tx, err := h.db.Begin()
		if err != nil {
			send(gin.H{"type": "room_created", "requestId": wsMsg.RequestID, "success": false, "error": "database error"})
			return
		}
		var exists bool
		if err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM chat_rooms WHERE id = $1)`, room.ID).Scan(&exists); err != nil {
			tx.Rollback()
			send(gin.H{"type": "room_created", "requestId": wsMsg.RequestID, "success": false, "error": "database error"})
			return
		}
		if !exists {
			_, err = tx.Exec(`INSERT INTO chat_rooms (id, chama_id, name, type, created_by, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				room.ID, room.ChamaID, room.Name, room.Type, room.CreatedBy, room.IsActive, room.CreatedAt, room.UpdatedAt)
			if err != nil {
				tx.Rollback()
				send(gin.H{"type": "room_created", "requestId": wsMsg.RequestID, "success": false, "error": "failed to create room"})
				return
			}
		}
		members := []*models.ChatRoomMember{{ID: uuid.New().String(), RoomID: room.ID, UserID: userID, Role: models.RoleAdmin, JoinedAt: time.Now().UTC(), IsActive: true}}
		for _, uid := range wsMsg.MemberIDs {
			if uid != userID && !containsMember(members, uid) {
				members = append(members, models.NewChatRoomMember(room.ID, uid, models.RoleMember))
			}
		}
		for _, m := range members {
			if _, err = tx.Exec(`
				INSERT INTO chat_room_members (id, room_id, user_id, role, joined_at, is_active)
				VALUES ($1, $2, $3, $4, $5, $6)
				ON CONFLICT (room_id, user_id) DO UPDATE SET is_active = TRUE`,
				m.ID, m.RoomID, m.UserID, m.Role, m.JoinedAt, m.IsActive); err != nil {
				tx.Rollback()
				send(gin.H{"type": "room_created", "requestId": wsMsg.RequestID, "success": false, "error": "failed to add members"})
				return
			}
		}
		if err := tx.Commit(); err != nil {
			send(gin.H{"type": "room_created", "requestId": wsMsg.RequestID, "success": false, "error": "failed to commit"})
			return
		}
		h.roomMgr.CreateRoom(room, members)
		send(gin.H{"type": "room_created", "requestId": wsMsg.RequestID, "success": true, "data": roomToMap(room)})

	case "message", "send_message":
		roomIDToUse := wsMsg.RoomID
		if roomIDToUse == "" {
			return
		}
		msgType := models.MessageTypeText
		if wsMsg.MessageType != "" {
			msgType = models.MessageType(wsMsg.MessageType)
		}
		replyTo := ""
		if raw, ok := wsMsg.Metadata["replyToId"]; ok {
			if s, ok := raw.(string); ok && s != "" {
				replyTo = s
			}
		}
		chatMsg := h.buildChatMessage(roomIDToUse, userID, wsMsg.Content, msgType, replyTo, wsMsg.Metadata)
		if chatMsg == nil {
			send(gin.H{"type": "message_sent", "requestId": wsMsg.RequestID, "success": false, "error": "failed to save message"})
			return
		}
		// Acknowledgment back to the sender (with clientMessageId) so the
		// optimistic bubble becomes "delivered" with minimal latency. The
		// broadcast to the rest of the room already happened in buildChatMessage.
		ackResp := gin.H{
			"type":      "message_sent",
			"requestId": wsMsg.RequestID,
			"data": gin.H{
				"id":              chatMsg.ID,
				"roomId":          chatMsg.RoomID,
				"senderId":        chatMsg.SenderID,
				"content":         chatMsg.Content,
				"type":            chatMsg.Type,
				"metadata":        chatMsg.Metadata,
				"imageUrl":        chatMsg.ImageUrl,
				"createdAt":       chatMsg.CreatedAt,
				"clientMessageId": wsMsg.ClientMsgID,
			},
			"success": true,
		}
		ackData, _ := json.Marshal(ackResp)
		h.hub.SendToUser(userID, ackData)

	case "mark_read":
		if wsMsg.RoomID != "" {
			h.roomMgr.MarkAsRead(wsMsg.RoomID, userID)
			readResp := gin.H{
				"type":   "message_read",
				"roomId": wsMsg.RoomID,
				"data": gin.H{
					"messageId": wsMsg.MessageID,
					"userId":    userID,
				},
			}
			if readData, err := json.Marshal(readResp); err == nil {
				h.hub.BroadcastToRoom(wsMsg.RoomID, readData, "")
			}
		}

	case "typing_start", "typing_stop":
		if wsMsg.RoomID != "" {
			typingResp := gin.H{
				"type":   "user_typing",
				"roomId": wsMsg.RoomID,
				"data": gin.H{
					"userId":   userID,
					"isTyping": wsMsg.Type == "typing_start",
				},
			}
			if typingData, err := json.Marshal(typingResp); err == nil {
				h.hub.BroadcastToRoom(wsMsg.RoomID, typingData, userID)
			}
		}

	case "delete_message":
		if wsMsg.MessageID != "" {
			var roomID string
			if err := h.db.QueryRow(`SELECT room_id FROM chat_messages WHERE id = $1 AND sender_id = $2`, wsMsg.MessageID, userID).Scan(&roomID); err == nil {
				_, _ = h.db.Exec(`UPDATE chat_messages SET is_deleted = true WHERE id = $1`, wsMsg.MessageID)
				delResp := gin.H{
					"type":   "message_deleted",
					"roomId": roomID,
					"data": gin.H{"messageId": wsMsg.MessageID, "roomId": roomID},
				}
				if delData, err := json.Marshal(delResp); err == nil {
					// Broadcast to the sender too, so all their devices update.
					h.hub.BroadcastToRoom(roomID, delData, "")
				}
			}
		}
	}
}

func (h *ChatHandler) MarkAsRead(c *gin.Context) {
	userID := c.GetString("userID")
	roomID := c.Param("roomId")

	err := h.roomMgr.MarkAsRead(roomID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room or member not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"status": "read"}})
}

func (h *ChatHandler) DeleteMessage(c *gin.Context) {
	userID := c.GetString("userID")
	msgID := c.Param("messageId")

	var roomID string
	err := h.db.QueryRow(`SELECT room_id FROM chat_messages WHERE id = $1 AND sender_id = $2`, msgID, userID).Scan(&roomID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "message not found or not sender"})
		return
	}

	_, err = h.db.Exec(`UPDATE chat_messages SET is_deleted = true WHERE id = $1`, msgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"status": "deleted"}})
}

func (h *ChatHandler) SearchMessages(c *gin.Context) {
	roomID := c.Param("roomId")
	query := c.Query("q")

	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "search query required"})
		return
	}

	rows, err := h.db.Query(`SELECT id, room_id as "roomId", sender_id as "senderId", content, type, 
		created_at as "createdAt" FROM chat_messages WHERE room_id = $1 AND content ILIKE $2 
		AND is_deleted = false ORDER BY created_at DESC LIMIT 50`, roomID, "%"+query+"%")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "search failed"})
		return
	}
	defer rows.Close()

	var messages []*models.ChatMessage
	for rows.Next() {
		var m models.ChatMessage
		if err := rows.Scan(&m.ID, &m.RoomID, &m.SenderID, &m.Content, &m.Type, &m.CreatedAt); err != nil {
			continue
		}
		messages = append(messages, &m)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": messages})
}

func (h *ChatHandler) UploadFile(c *gin.Context) {
	userID := c.GetString("userID")
	roomID := c.Param("roomId")

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file required"})
		return
	}

	msg := models.NewChatMessage(roomID, userID, file.Filename, models.MessageTypeFile)
	msg.Metadata = map[string]interface{}{"filename": file.Filename, "size": file.Size}

	_, err = h.db.Exec(`INSERT INTO chat_messages (id, room_id, sender_id, content, type, metadata, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		msg.ID, msg.RoomID, msg.SenderID, msg.Content, msg.Type, msg.Metadata, msg.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save"})
		return
	}

	c.SaveUploadedFile(file, "./uploads/"+file.Filename)
	c.JSON(http.StatusCreated, msg)
}
