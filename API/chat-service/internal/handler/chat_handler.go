package handler

import (
	"database/sql"
	"encoding/json"
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
		db:       db,
		hub:      hub,
		roomMgr:  roomMgr,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
		sessions: make(map[string]string),
	}
}

func (h *ChatHandler) CreateRoom(c *gin.Context) {
	userID := c.GetString("userID")
	var req struct {
		Name     string          `json:"name" binding:"required"`
		Type     models.ChatRoomType `json:"type" binding:"required"`
		ChamaID  string          `json:"chamaId,omitempty"`
		MemberIDs []string       `json:"memberIds,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	room := models.NewChatRoom(req.ChamaID, req.Name, req.Type, userID)
	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	_, err = tx.Exec(`INSERT INTO chat_rooms (id, chama_id, name, type, created_by, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		room.ID, room.ChamaID, room.Name, room.Type, room.CreatedBy, room.IsActive, room.CreatedAt, room.UpdatedAt)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create room"})
		return
	}

	members := []*models.ChatRoomMember{{
		ID: uuid.New().String(),
		RoomID: room.ID,
		UserID: userID,
		Role: models.RoleAdmin,
		JoinedAt: time.Now().UTC(),
		IsActive: true,
	}}

	for _, uid := range req.MemberIDs {
		if uid != userID {
			members = append(members, models.NewChatRoomMember(room.ID, uid, models.RoleMember))
		}
	}

	for _, m := range members {
		_, err = tx.Exec(`INSERT INTO chat_room_members (id, room_id, user_id, role, joined_at, is_active) VALUES ($1, $2, $3, $4, $5, $6)`,
			m.ID, m.RoomID, m.UserID, m.Role, m.JoinedAt, m.IsActive)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add members"})
			return
		}
	}

	tx.Commit()
	h.roomMgr.CreateRoom(room, members)
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": room})
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
		"room": room,
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
	before := c.Query("before")

	var rows *sql.Rows
	var err error

	if before != "" {
		rows, err = h.db.Query(`SELECT id, room_id as "roomId", sender_id as "senderId", content, type, metadata,
			reply_to_id as "replyToId", created_at as "createdAt", updated_at as "editedAt"
			FROM chat_messages WHERE room_id = $1 AND created_at < (SELECT created_at FROM chat_messages WHERE id = $2) 
			AND is_deleted = false ORDER BY created_at DESC LIMIT $3`, roomID, before, limit)
	} else {
		rows, err = h.db.Query(`SELECT id, room_id as "roomId", sender_id as "senderId", content, type, metadata,
			reply_to_id as "replyToId", created_at as "createdAt", updated_at as "editedAt"
			FROM chat_messages WHERE room_id = $1 AND is_deleted = false ORDER BY created_at DESC LIMIT $2`, roomID, limit)
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
		if err := rows.Scan(&m.ID, &m.RoomID, &m.SenderID, &m.Content, &m.Type, &m.Metadata, 
			&repliedTo, &m.CreatedAt, &m.EditedAt); err != nil {
			continue
		}
		m.ReplyToID = repliedTo
		messages = append(messages, &m)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": messages})
}

func (h *ChatHandler) SendMessage(c *gin.Context) {
	userID := c.GetString("userID")
	roomID := c.Param("roomId")

	var req struct {
		Content  string          `json:"content" binding:"required"`
		Type     models.MessageType `json:"type"`
		ReplyTo  string          `json:"replyToId,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	msg := models.NewChatMessage(roomID, userID, req.Content, req.Type)
	if req.ReplyTo != "" {
		msg.ReplyToID = sql.NullString{String: req.ReplyTo, Valid: true}
	}

	_, err := h.db.Exec(`INSERT INTO chat_messages (id, room_id, sender_id, content, type, is_deleted, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		msg.ID, msg.RoomID, msg.SenderID, msg.Content, msg.Type, msg.IsDeleted, msg.CreatedAt)
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
			Type    string `json:"type"`
			Content string `json:"content"`
		}
		if err := json.Unmarshal(msg, &wsMsg); err == nil {
			if wsMsg.Type == "message" {
				var m models.ChatMessage
				json.Unmarshal([]byte(wsMsg.Content), &m)
				h.roomMgr.UpdateLastMessage(roomID, m.Content)
				h.hub.BroadcastToRoom(roomID, msg)
			}
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