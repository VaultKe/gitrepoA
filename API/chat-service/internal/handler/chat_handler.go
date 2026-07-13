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
	// would show up twice in the chat list ("sent" vs "received"):
	//   - chama rooms are keyed by their chamaId
	//   - private 1:1 rooms use a deterministic ID derived from both users
	var room *models.ChatRoom

	if req.Type == models.RoomTypeChama && req.ChamaID != "" {
		var rid string
		if err := h.db.QueryRow(
			`SELECT id FROM chat_rooms WHERE chama_id = $1 AND is_active = TRUE LIMIT 1`,
			req.ChamaID,
		).Scan(&rid); err == nil && rid != "" {
			if existing, e := h.roomMgr.GetRoom(rid); e == nil {
				room = existing
			}
		}
	} else if req.Type == models.RoomTypePrivate && len(req.MemberIDs) == 1 {
		if existing, err := h.roomMgr.FindPrivateRoom(userID, req.MemberIDs[0]); err == nil && existing != nil {
			room = existing
		}
	}

	if room == nil {
		if req.Type == models.RoomTypePrivate && len(req.MemberIDs) == 1 {
			room = models.NewPrivateRoom(userID, req.MemberIDs[0], req.Name, userID)
		} else {
			room = models.NewChatRoom(req.ChamaID, req.Name, req.Type, userID)
		}
	}

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

	var rows *sql.Rows
	var err error

	if before != "" {
		rows, err = h.db.Query(`SELECT id, room_id as "roomId", sender_id as "senderId", content, type, metadata, image_url as "imageUrl",
			reply_to_id as "replyToId", created_at as "createdAt", updated_at as "editedAt"
			FROM chat_messages WHERE room_id = $1 AND created_at < (SELECT created_at FROM chat_messages WHERE id = $2) 
			AND is_deleted = false ORDER BY created_at DESC LIMIT $3 OFFSET $4`, roomID, before, limit, offset)
	} else {
		rows, err = h.db.Query(`SELECT id, room_id as "roomId", sender_id as "senderId", content, type, metadata, image_url as "imageUrl",
			reply_to_id as "replyToId", created_at as "createdAt", updated_at as "editedAt"
			FROM chat_messages WHERE room_id = $1 AND is_deleted = false ORDER BY created_at ASC LIMIT $2 OFFSET $3`, roomID, limit, offset)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch messages"})
		return
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

	msg := models.NewChatMessage(roomID, userID, req.Content, req.Type)
	if req.ReplyTo != "" {
		msg.ReplyToID = sql.NullString{String: req.ReplyTo, Valid: true}
	}
	msg.Metadata = req.Metadata

	metadataJSON, _ := json.Marshal(msg.Metadata)
	_, err := h.db.Exec(`INSERT INTO chat_messages (id, room_id, sender_id, content, type, metadata, is_deleted, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		msg.ID, msg.RoomID, msg.SenderID, msg.Content, msg.Type, metadataJSON, msg.IsDeleted, msg.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save message"})
		return
	}

	h.roomMgr.UpdateLastMessage(roomID, req.Content)

	data, _ := json.Marshal(msg)
	h.hub.BroadcastToRoom(roomID, data)

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": msg})
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

	roomID := c.Param("roomId")
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := h.hub.Register(conn, userID, roomID)
	go client.WritePump()
	client.ReadPump(func(cl *ws.Client, msg []byte) {
		var wsMsg struct {
			Type        string                 `json:"type"`
			RoomID      string                 `json:"roomId,omitempty"`
			Content     string                 `json:"content,omitempty"`
			MessageType string                 `json:"messageType,omitempty"`
			Metadata    map[string]interface{} `json:"metadata,omitempty"`
			ClientMsgID string                 `json:"clientMessageId,omitempty"`
			RequestID   string                 `json:"requestId,omitempty"`
			MessageID   string                 `json:"messageId,omitempty"`
		}
		if err := json.Unmarshal(msg, &wsMsg); err != nil {
			fmt.Printf("WS ERROR: Failed to unmarshal message: %v\n", err)
			return
		}
		fmt.Printf("WS DEBUG: Received type=%s roomId=%s userId=%s\n", wsMsg.Type, wsMsg.RoomID, userID)

		switch wsMsg.Type {
		case "join_room":
			// Handle dynamic room joining for the shared WebSocket connection
			if wsMsg.RoomID != "" {
				h.hub.RegisterToRoom(userID, wsMsg.RoomID, cl)
			}
		case "mark_read":
			// Handle read receipts via WebSocket
			if wsMsg.RoomID != "" && wsMsg.MessageID != "" {
				h.roomMgr.MarkAsRead(wsMsg.RoomID, userID)
				readResp := gin.H{
					"type":   "message_read",
					"roomId": wsMsg.RoomID,
					"data": gin.H{
						"messageId": wsMsg.MessageID,
						"userId":    userID,
					},
				}
				readData, _ := json.Marshal(readResp)
				h.hub.BroadcastToRoom(wsMsg.RoomID, readData)
			}
		case "message", "send_message":
			roomIDToUse := roomID
			if wsMsg.RoomID != "" {
				roomIDToUse = wsMsg.RoomID
			}
			chatMsg := models.NewChatMessage(roomIDToUse, userID, wsMsg.Content, models.MessageTypeText)
			if wsMsg.MessageType != "" {
				chatMsg.Type = models.MessageType(wsMsg.MessageType)
			}
			chatMsg.Metadata = wsMsg.Metadata

			// Extract image URLs from metadata for dedicated storage
			if wsMsg.Metadata != nil {
				if imageUrl, ok := wsMsg.Metadata["imageUrl"].(string); ok && imageUrl != "" {
					chatMsg.ImageUrl = imageUrl
				}
				if imageUri, ok := wsMsg.Metadata["imageUri"].(string); ok && imageUri != "" {
					chatMsg.ImageUrl = imageUri
				}
				if imageUrls, ok := wsMsg.Metadata["imageUrls"]; ok {
					chatMsg.ImageUrls = imageUrls
				}
			}

			metadataJSON, _ := json.Marshal(chatMsg.Metadata)
			_, dbErr := h.db.Exec(`INSERT INTO chat_messages (id, room_id, sender_id, content, type, metadata, image_url, is_deleted, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
				chatMsg.ID, chatMsg.RoomID, chatMsg.SenderID, chatMsg.Content, chatMsg.Type, metadataJSON, chatMsg.ImageUrl, chatMsg.IsDeleted, chatMsg.CreatedAt)
			if dbErr != nil {
				fmt.Printf("WS INSERT ERROR room=%s user=%s err=%v\n", roomIDToUse, userID, dbErr)
				return
			}
			fmt.Printf("WS MESSAGE SAVED id=%s room=%s user=%s content=%s type=%s\n", chatMsg.ID, roomIDToUse, userID, chatMsg.Content, chatMsg.Type)

			// Send acknowledgment back to sender with clientMessageId FIRST so the
			// sender's message ticks "delivered" with minimal latency.
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

			// Broadcast to other room members immediately.
			broadcastResp := gin.H{
				"type":   "new_message",
				"roomId": roomIDToUse,
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
			}
			broadcastData, _ := json.Marshal(broadcastResp)
			h.hub.BroadcastToRoom(roomIDToUse, broadcastData)

			// Update the room's "last message" preview asynchronously so the extra
			// DB write never sits on the critical path of message delivery.
			go h.roomMgr.UpdateLastMessage(roomIDToUse, chatMsg.Content)

			fmt.Printf("WS ACK sent to userId=%s for msgId=%s\n", userID, chatMsg.ID)
		}
	})
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
