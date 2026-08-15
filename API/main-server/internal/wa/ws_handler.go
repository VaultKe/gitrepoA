package wa

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// WebSocketHub is the same interface used by the existing chat-service hub.
// We reuse the existing hub from the main server's websocket package.
type WebSocketHub interface {
	BroadcastToRoom(roomID string, payload []byte, excludeUserID string)
	SendToUser(userID string, payload []byte)
}

// WSClient represents a connected UI client.
type WSClient struct {
	UserID string
	RoomID string
	Send   chan []byte
}

// WSHandler manages the WebSocket connection from the UI and translates to/from OpenWA.
type WSHandler struct {
	client      *OpenWAClient
	hub         WebSocketHub
	roomMapper  *RoomMapper
	userMapper  *UserMapper
	translator  *MessageTranslator
	sessionID   string
	db          *sql.DB
	mu          sync.Mutex
	connections map[string]*WSClient // key: userID
}

// NewWSHandler creates a new WS handler.
func NewWSHandler(client *OpenWAClient, hub WebSocketHub, db *sql.DB, defaultSessionID string) *WSHandler {
	return &WSHandler{
		client:      client,
		hub:         hub,
		roomMapper:  NewRoomMapper(db),
		userMapper:  NewUserMapper(db),
		translator:  NewMessageTranslator(db),
		sessionID:   defaultSessionID,
		db:          db,
		connections: make(map[string]*WSClient),
	}
}

func (h *WSHandler) resolveSessionID(userID string) string {
	if h.db == nil {
		return h.sessionID
	}
	sid, err := GetUserSessionID(h.db, userID)
	if err == nil && sid != "" {
		return sid
	}
	return h.sessionID
}

// HandleWebSocket upgrades the HTTP connection and handles the VaultKe chat protocol.
func (h *WSHandler) HandleWebSocket(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	roomID := c.Query("roomId")
	if roomID == "" {
		roomID = "main"
	}

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := &WSClient{
		UserID: userID,
		RoomID: roomID,
		Send:   make(chan []byte, 256),
	}
	h.mu.Lock()
	h.connections[userID] = client
	h.mu.Unlock()

	// Ensure the room has a mapping; if not, create a default chat mapping.
	chatID, err := h.roomMapper.EnsureMapping(c.Request.Context(), roomID, "private", "", "", h.resolveSessionID(userID), h.client)
	if err != nil {
		fmt.Printf("WA adapter: ensure mapping failed for room %s: %v\n", roomID, err)
	}

	_ = chatID

	// Read pump: UI → OpenWA
	go func() {
		defer func() {
			conn.Close()
			h.mu.Lock()
			delete(h.connections, userID)
			h.mu.Unlock()
		}()

		for {
			_, raw, err := conn.ReadMessage()
			if err != nil {
				break
			}

			var msg map[string]interface{}
			if err := parseJSON(raw, &msg); err != nil {
				continue
			}

			h.handleIncoming(c.Request.Context(), userID, roomID, msg)
		}
	}()

	// Write pump: OpenWA → UI
	go func() {
		defer conn.Close()
		for payload := range client.Send {
			if err := conn.WriteMessage(websocket.TextMessage, payload); err != nil {
				break
			}
		}
	}()

	// Keep-alive ping
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}()
}

// handleIncoming translates a VaultKe WS message and executes it against OpenWA.
func (h *WSHandler) handleIncoming(ctx context.Context, userID, fallbackRoomID string, msg map[string]interface{}) {
	msgType, _ := msg["type"].(string)
	roomID := fallbackRoomID
	if v, ok := msg["roomId"].(string); ok && v != "" {
		roomID = v
	}
	switch msgType {
	case "join_room":
		h.handleJoinRoom(ctx, userID, roomID)
	case "leave_room":
		h.handleLeaveRoom(ctx, userID, roomID)
	case "get_rooms":
		h.handleGetRooms(ctx, userID, msg)
	case "get_messages":
		h.handleGetMessages(ctx, userID, roomID, msg)
	case "send_message":
		h.handleSendMessage(ctx, userID, roomID, msg)
	case "mark_read":
		h.handleMarkRead(ctx, userID, roomID, msg)
	case "typing_start", "typing_stop":
		h.handleTyping(ctx, userID, roomID, msgType == "typing_start")
	case "delete_message":
		h.handleDeleteMessage(ctx, userID, roomID, msg)
	case "create_room":
		h.handleCreateRoom(ctx, userID, roomID, msg)
	default:
		// Ignore unknown message types — the UI may send other events we don't care about.
	}
}

func (h *WSHandler) handleJoinRoom(ctx context.Context, userID, roomID string) {
	// Ensure room mapping exists so future sends know where to go.
	_, _ = h.roomMapper.EnsureMapping(ctx, roomID, "private", "", "", h.resolveSessionID(userID), h.client)

	response := map[string]interface{}{
		"type":    "joined_room",
		"roomId":  roomID,
		"success": true,
	}
	h.sendToUser(userID, response)
}

func (h *WSHandler) handleLeaveRoom(ctx context.Context, userID, roomID string) {
	response := map[string]interface{}{
		"type":    "left_room",
		"roomId":  roomID,
		"success": true,
	}
	h.sendToUser(userID, response)
}

func (h *WSHandler) handleGetRooms(ctx context.Context, userID string, msg map[string]interface{}) {
	chats, err := h.client.GetChats(ctx, h.resolveSessionID(userID), 100, 0)
	if err != nil {
		h.sendError(userID, "get_rooms", fmt.Sprintf("failed to load chats: %v", err))
		return
	}

	rooms := make([]map[string]interface{}, 0, len(chats))
	for _, chat := range chats {
		roomID, _ := h.roomMapper.ReverseLookup(chat.ID)
		rooms = append(rooms, map[string]interface{}{
			"id":            roomID,
			"chatId":        chat.ID,
			"name":          chat.Name,
			"type":          MapChatKind(chat.Kind, chat.IsGroup),
			"lastMessage":   chat.LastMessage,
			"lastMessageAt": chat.Timestamp,
			"unreadCount":   chat.UnreadCount,
			"isActive":      true,
		})
	}

	response := map[string]interface{}{
		"type":      "rooms_list",
		"success":   true,
		"requestId": getString(msg, "requestId"),
		"data":      rooms,
	}
	h.sendToUser(userID, response)
}

func (h *WSHandler) handleGetMessages(ctx context.Context, userID, roomID string, msg map[string]interface{}) {
	chatID, ok := h.roomMapper.Lookup(roomID)
	if !ok {
		h.sendError(userID, "get_messages", "room not mapped to a WhatsApp chat")
		return
	}

	limit := 50
	if l, ok := msg["limit"].(float64); ok {
		limit = int(l)
	}

	messages, err := h.client.GetMessages(ctx, h.resolveSessionID(userID), chatID, limit, 0)
	if err != nil {
		h.sendError(userID, "get_messages", fmt.Sprintf("failed to load messages: %v", err))
		return
	}

	data := make([]map[string]interface{}, 0, len(messages))
	for _, m := range messages {
		data = append(data, h.translator.ToVaultKeMessage(m))
	}

	response := map[string]interface{}{
		"type":      "messages_list",
		"roomId":    roomID,
		"success":   true,
		"requestId": getString(msg, "requestId"),
		"data":      data,
	}
	h.sendToUser(userID, response)
}

func (h *WSHandler) handleSendMessage(ctx context.Context, userID, roomID string, msg map[string]interface{}) {
	content, _ := msg["content"].(string)
	msgType := "text"
	if t, ok := msg["messageType"].(string); ok && t != "" {
		msgType = t
	}
	metadata := map[string]interface{}{}
	if m, ok := msg["metadata"].(map[string]interface{}); ok {
		metadata = m
	}

	path, payload, err := h.translator.FromVaultKeSend(roomID, content, msgType, metadata)
	if err != nil {
		h.sendError(userID, "send_message", fmt.Sprintf("room not mapped: %v", err))
		return
	}

	// Replace placeholder with actual session ID
	path = strings.Replace(path, "{sessionId}", h.resolveSessionID(userID), 1)

	result, err := h.client.send(ctx, h.resolveSessionID(userID), path, payload)
	if err != nil {
		h.sendError(userID, "send_message", fmt.Sprintf("send failed: %v", err))
		return
	}

	// Build the message object the UI expects for optimistic reconciliation.
	vaultkeMsg := map[string]interface{}{
		"id":        result.MessageID,
		"roomId":    roomID,
		"senderId":  userID,
		"content":   content,
		"type":      msgType,
		"status":    "sent",
		"createdAt": result.Timestamp * 1000,
		"metadata":  metadata,
	}

	response := map[string]interface{}{
		"type":      "message_sent",
		"success":   true,
		"data":      vaultkeMsg,
	}
	if reqID, ok := msg["requestId"].(string); ok {
		response["requestId"] = reqID
	}
	h.sendToUser(userID, response)
}

func (h *WSHandler) handleMarkRead(ctx context.Context, userID, roomID string, msg map[string]interface{}) {
	chatID, ok := h.roomMapper.Lookup(roomID)
	if !ok {
		return
	}
	_ = h.client.MarkRead(ctx, h.resolveSessionID(userID), chatID)

	messageID, _ := msg["messageId"].(string)

	response := map[string]interface{}{
		"type":      "message_read",
		"roomId":    roomID,
		"success":   true,
		"requestId": getString(msg, "requestId"),
		"data": map[string]interface{}{
			"userId":    userID,
			"messageId": messageID,
			"readAt":    time.Now().UnixMilli(),
		},
	}
	h.sendToUser(userID, response)
}

func (h *WSHandler) handleTyping(ctx context.Context, userID, roomID string, isTyping bool) {
	chatID, ok := h.roomMapper.Lookup(roomID)
	if !ok {
		return
	}
	state := "paused"
	if isTyping {
		state = "composing"
	}
	_ = h.client.SendChatState(ctx, h.resolveSessionID(userID), chatID, state)
}

func (h *WSHandler) handleDeleteMessage(ctx context.Context, userID, roomID string, msg map[string]interface{}) {
	// OpenWA delete requires the WhatsApp message ID, not the VaultKe message ID.
	// For now, acknowledge the delete locally. A full implementation would map
	// VaultKe message IDs to OpenWA message IDs.
	messageID, _ := msg["messageId"].(string)
	_ = messageID

	response := map[string]interface{}{
		"type":    "message_deleted",
		"roomId":  roomID,
		"success": true,
		"data": map[string]interface{}{
			"messageId": messageID,
		},
	}
	h.broadcastToRoom(roomID, response)
}

func (h *WSHandler) handleCreateRoom(ctx context.Context, userID, roomID string, msg map[string]interface{}) {
	name, _ := msg["name"].(string)
	roomType, _ := msg["type"].(string)
	memberIds, _ := msg["memberIds"].([]interface{})
	recipientId, _ := msg["recipientId"].(string)

	if roomType == "group" || roomType == "chama" {
		participants := make([]string, 0, len(memberIds))
		for _, m := range memberIds {
			if s, ok := m.(string); ok {
				participants = append(participants, s)
			}
		}
		if recipientId != "" {
			participants = append(participants, recipientId)
		}
		group, err := h.client.CreateGroup(ctx, h.resolveSessionID(userID), name, participants)
		if err != nil {
			h.sendError(userID, "create_room", fmt.Sprintf("failed to create group: %v", err))
			return
		}
		response := map[string]interface{}{
			"type":    "room_created",
			"success": true,
			"data": map[string]interface{}{
				"id":       group.ID,
				"name":     name,
				"type":     "group",
				"isActive": true,
			},
		}
		h.sendToUser(userID, response)
		return
	}

	// Private chat: create a deterministic room mapping and return it.
	mappedRoomID := roomID
	if mappedRoomID == "" || mappedRoomID == "main" {
		mappedRoomID = recipientId
	}
	if mappedRoomID == "" && name != "" {
		mappedRoomID = name
	}

	chatID, err := h.roomMapper.EnsureMapping(ctx, mappedRoomID, "private", "", "", h.resolveSessionID(userID), h.client)
	if err != nil {
		h.sendError(userID, "create_room", fmt.Sprintf("failed to map room: %v", err))
		return
	}

	response := map[string]interface{}{
		"type":    "room_created",
		"success": true,
		"data": map[string]interface{}{
			"id":       mappedRoomID,
			"chatId":   chatID,
			"name":     name,
			"type":     "private",
			"isActive": true,
		},
	}
	h.sendToUser(userID, response)
}

func (h *WSHandler) sendToUser(userID string, payload map[string]interface{}) {
	data, err := marshalJSON(payload)
	if err != nil {
		return
	}
	h.mu.Lock()
	client, ok := h.connections[userID]
	h.mu.Unlock()
	if ok {
		select {
		case client.Send <- data:
		default:
		}
	}
}

func (h *WSHandler) broadcastToRoom(roomID string, payload map[string]interface{}) {
	data, err := marshalJSON(payload)
	if err != nil {
		return
	}
	// Broadcast to all connected users in this room.
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, client := range h.connections {
		if client.RoomID == roomID {
			select {
			case client.Send <- data:
			default:
			}
		}
	}
}

func (h *WSHandler) sendError(userID, requestType, errorMsg string) {
	response := map[string]interface{}{
		"type":    "error",
		"code":    "WA_ADAPTER_ERROR",
		"message": errorMsg,
	}
	if requestType != "" {
		response["requestType"] = requestType
	}
	h.sendToUser(userID, response)
}

// BroadcastFromWebhook is called by the webhook receiver when an OpenWA event arrives.
func (h *WSHandler) BroadcastFromWebhook(event map[string]interface{}, userID string) {
	eventType, _ := event["event"].(string)
	data, _ := event["data"].(map[string]interface{})
	if data == nil {
		return
	}

	switch eventType {
	case "message.received":
		chatID, _ := data["chatId"].(string)
		roomID, ok := h.roomMapper.ReverseLookup(chatID)
		if !ok {
			return
		}
		vaultkeMsg := h.translator.ToVaultKeMessage(OpenWAMessage{
			ID:        getString(data, "id"),
			ChatID:    chatID,
			From:      getString(data, "from"),
			Author:    getString(data, "author"),
			Body:      getString(data, "body"),
			Type:      getString(data, "type"),
			Direction: "incoming",
			Timestamp: getInt64(data, "timestamp"),
			Status:    "delivered",
		})
		response := map[string]interface{}{
			"type":    "new_message",
			"roomId":  roomID,
			"success": true,
			"data":    vaultkeMsg,
		}
		if userID != "" {
			h.sendToUser(userID, response)
		} else {
			h.broadcastToRoom(roomID, response)
		}

	case "message.ack":
		chatID, _ := data["chatId"].(string)
		roomID, ok := h.roomMapper.ReverseLookup(chatID)
		if !ok {
			return
		}
		ack := getInt(data, "ack")
		status := AckToStatus(ack)
		response := map[string]interface{}{
			"type":   "message_ack",
			"roomId": roomID,
			"data": map[string]interface{}{
				"messageId": getString(data, "messageId"),
				"status":    status,
				"ack":       ack,
			},
		}
		if userID != "" {
			h.sendToUser(userID, response)
		} else {
			h.broadcastToRoom(roomID, response)
		}

	case "message.revoked":
		chatID, _ := data["chatId"].(string)
		roomID, ok := h.roomMapper.ReverseLookup(chatID)
		if !ok {
			return
		}
		response := map[string]interface{}{
			"type":   "message_deleted",
			"roomId": roomID,
			"data": map[string]interface{}{
				"messageId": getString(data, "messageId"),
			},
		}
		if userID != "" {
			h.sendToUser(userID, response)
		} else {
			h.broadcastToRoom(roomID, response)
		}

	case "presence.update":
		chatID, _ := data["chatId"].(string)
		roomID, ok := h.roomMapper.ReverseLookup(chatID)
		if !ok {
			return
		}
		response := map[string]interface{}{
			"type":   "user_typing",
			"roomId": roomID,
			"data": map[string]interface{}{
				"userId":   getString(data, "participantId"),
				"isTyping": getString(data, "state") == "composing",
			},
		}
		if userID != "" {
			h.sendToUser(userID, response)
		} else {
			h.broadcastToRoom(roomID, response)
		}
	}
}

func MapChatKind(kind string, isGroup bool) string {
	if isGroup || kind == "group" {
		return "group"
	}
	if kind == "individual" {
		return "private"
	}
	return kind
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getInt(m map[string]interface{}, key string) int {
	if v, ok := m[key].(float64); ok {
		return int(v)
	}
	return 0
}

func getInt64(m map[string]interface{}, key string) int64 {
	if v, ok := m[key].(float64); ok {
		return int64(v)
	}
	return 0
}

func parseJSON(b []byte, v interface{}) error {
	return json.Unmarshal(b, v)
}

func marshalJSON(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}
