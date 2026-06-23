package services

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// WebSocketMessage represents a message sent over WebSocket
type WebSocketMessage struct {
	Type      string      `json:"type"`
	RoomID    string      `json:"roomId,omitempty"`
	UserID    string      `json:"userId,omitempty"`
	RequestID string      `json:"requestId,omitempty"` // For request-response correlation
	Data      interface{} `json:"data,omitempty"`
	Message   string      `json:"message,omitempty"`
}

// Client represents a WebSocket client
type Client struct {
	ID               string
	UserID           string
	Conn             *websocket.Conn
	Send             chan WebSocketMessage
	Hub              *Hub
	WebSocketService *WebSocketService
	rooms            map[string]bool // Track rooms this client is in for cleanup
	mutex            sync.RWMutex
}

// Hub maintains the set of active clients and broadcasts messages to the clients
type Hub struct {
	// Registered clients
	clients map[*Client]bool

	// Inbound messages from the clients
	broadcast chan WebSocketMessage

	// Register requests from the clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Room subscriptions - maps roomID to clients
	rooms map[string]map[*Client]bool

	// User connections - maps userID to clients
	users map[string]*Client

	mutex sync.RWMutex

	// Memory monitoring
	clientCount int
	roomCount   int
}

// WebSocketService handles WebSocket connections and real-time messaging
type WebSocketService struct {
	hub         *Hub
	upgrader    websocket.Upgrader
	chatService *ChatService
}

// NewWebSocketService creates a new WebSocket service
func NewWebSocketService(db *sql.DB) *WebSocketService {
	hub := &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan WebSocketMessage),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		rooms:      make(map[string]map[*Client]bool),
		users:      make(map[string]*Client),
	}

	service := &WebSocketService{
		hub: hub,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				// Allow connections from any origin in development
				// In production, you should check the origin properly
				return true
			},
		},
		chatService: NewChatService(db),
	}

	// Start the hub
	go hub.run()

	return service
}

// HandleWebSocket handles WebSocket connections
func (s *WebSocketService) HandleWebSocket(c *gin.Context) {
	// Try to get user ID from context first (set by auth middleware)
	userID, exists := c.Get("userID")

	// If not in context, try to get from query parameter
	if !exists {
		token := c.Query("token")
		if token == "" {
			log.Printf("WebSocket connection rejected: no token provided")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized - no token"})
			return
		}

		// Here you would validate the token and extract userID
		// For now, we'll use a simple approach - in production, use proper JWT validation
		tokenPreview := token
		if len(token) > 20 {
			tokenPreview = token[:20] + "..."
		}
		log.Printf("WebSocket token received: %s", tokenPreview)

		// Set a placeholder userID - in production, extract from validated JWT
		userID = "temp_user_from_token"
		c.Set("userID", userID)
	}

	// Upgrade HTTP connection to WebSocket
	conn, err := s.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Create client
	client := &Client{
		ID:               generateClientID(),
		UserID:           userID.(string),
		Conn:             conn,
		Send:             make(chan WebSocketMessage, 256),
		Hub:              s.hub,
		WebSocketService: s,
	}

	// Register client
	s.hub.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

// BroadcastToRoom sends a message to all clients in a specific room
func (s *WebSocketService) BroadcastToRoom(roomID string, message WebSocketMessage) {
	message.RoomID = roomID
	s.hub.broadcast <- message
}

// SendToUser sends a message to a specific user
func (s *WebSocketService) SendToUser(userID string, message WebSocketMessage) {
	s.hub.mutex.RLock()
	client, exists := s.hub.users[userID]
	s.hub.mutex.RUnlock()

	if exists {
		select {
		case client.Send <- message:
		default:
			close(client.Send)
			delete(s.hub.users, userID)
		}
	}
}

// Hub methods
func (h *Hub) run() {
	// Periodic memory monitoring
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			h.mutex.RLock()
			clientCount := len(h.clients)
			roomCount := len(h.rooms)
			userCount := len(h.users)
			h.mutex.RUnlock()

			log.Printf("📊 WebSocket Hub Stats: %d clients, %d rooms, %d users", clientCount, roomCount, userCount)

			// Alert if too many connections
			if clientCount > 1000 {
				log.Printf("🚨 WARNING: High client count (%d) - potential memory issue", clientCount)
			}
		}
	}()

	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client] = true
			h.users[client.UserID] = client
			h.clientCount++
			h.mutex.Unlock()

			log.Printf("🔌 WebSocket client registered: %s (total: %d)", client.ID, h.clientCount)

			// Send connection confirmation
			select {
			case client.Send <- WebSocketMessage{Type: "connected", Message: "Connected to chat server"}:
			default:
				close(client.Send)
				delete(h.clients, client)
				delete(h.users, client.UserID)
			}

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				delete(h.users, client.UserID)
				close(client.Send)
				h.clientCount--

				log.Printf("🔌 WebSocket client unregistered: %s (remaining: %d)", client.ID, h.clientCount)

				// Remove from all rooms
				for roomID, roomClients := range h.rooms {
					if _, inRoom := roomClients[client]; inRoom {
						delete(roomClients, client)
						if len(roomClients) == 0 {
							delete(h.rooms, roomID)
							h.roomCount--
						}
					}
				}
			}
			h.mutex.Unlock()

		case message := <-h.broadcast:
			h.mutex.RLock()
			if message.RoomID != "" {
				// Broadcast to specific room
				if roomClients, exists := h.rooms[message.RoomID]; exists {
					for client := range roomClients {
						select {
						case client.Send <- message:
						default:
							close(client.Send)
							delete(h.clients, client)
							delete(h.users, client.UserID)
							delete(roomClients, client)
						}
					}
				}
			} else {
				// Broadcast to all clients
				for client := range h.clients {
					select {
					case client.Send <- message:
					default:
						close(client.Send)
						delete(h.clients, client)
						delete(h.users, client.UserID)
					}
				}
			}
			h.mutex.RUnlock()
		}
	}
}

// JoinRoom adds a client to a room
func (h *Hub) JoinRoom(client *Client, roomID string) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	if h.rooms[roomID] == nil {
		h.rooms[roomID] = make(map[*Client]bool)
		h.roomCount++
		log.Printf("🏠 New WebSocket room created: %s (total rooms: %d)", roomID, h.roomCount)
	}
	h.rooms[roomID][client] = true

	roomSize := len(h.rooms[roomID])
	log.Printf("👥 Client %s joined room %s (room size: %d)", client.ID, roomID, roomSize)
}

// LeaveRoom removes a client from a room
func (h *Hub) LeaveRoom(client *Client, roomID string) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	if roomClients, exists := h.rooms[roomID]; exists {
		delete(roomClients, client)
		if len(roomClients) == 0 {
			delete(h.rooms, roomID)
		}
	}
}

// Client methods
func (c *Client) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	for {
		var message WebSocketMessage
		err := c.Conn.ReadJSON(&message)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Handle different message types
		switch message.Type {
		case "join_room":
			if message.RoomID != "" {
				c.Hub.JoinRoom(c, message.RoomID)
			}
		case "leave_room":
			if message.RoomID != "" {
				c.Hub.LeaveRoom(c, message.RoomID)
			}
		case "send_message":
			// Handle message sending - process and save to database
			c.handleSendMessage(c.WebSocketService, message)
		case "ping":
			// Send pong response
			select {
			case c.Send <- WebSocketMessage{Type: "pong"}:
			default:
				return
			}
		// Chat-specific requests (request-response pattern)
		case "get_rooms":
			c.handleGetRooms(c.WebSocketService, message)
		case "get_room":
			c.handleGetRoom(c.WebSocketService, message)
		case "create_room":
			c.handleCreateRoom(c.WebSocketService, message)
		case "get_messages":
			c.handleGetMessages(c.WebSocketService, message)
		case "mark_read":
			c.handleMarkRead(c.WebSocketService, message)
		case "typing_start", "typing_stop":
			c.handleTyping(c.WebSocketService, message)
		}
	}
}

func (c *Client) writePump() {
	defer c.Conn.Close()

	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteJSON(message); err != nil {
				log.Printf("WebSocket write error: %v", err)
				return
			}
		}
	}
}

// handleSendMessage processes a message sent via WebSocket and saves it to the database
func (c *Client) handleSendMessage(wsService *WebSocketService, message WebSocketMessage) {
	// Extract message data
	messageData, ok := message.Data.(map[string]interface{})
	if !ok {
		log.Printf("Invalid message data format for send_message")
		return
	}

	// Extract required fields
	roomID, ok := messageData["roomId"].(string)
	if !ok || roomID == "" {
		log.Printf("Missing or invalid roomId in send_message")
		return
	}

	senderID, ok := messageData["senderId"].(string)
	if !ok || senderID == "" {
		// Use authenticated user ID from WebSocket client
		senderID = c.UserID
		if senderID == "" {
			log.Printf("Missing senderId and no authenticated user")
			return
		}
	}

	messageType, ok := messageData["type"].(string)
	if !ok {
		messageType = string(MessageTypeText) // Default to plain text
	}

	content, ok := messageData["content"].(string)
	if !ok {
		log.Printf("Missing or invalid content in send_message")
		return
	}

	// Extract metadata
	metadata := make(map[string]interface{})
	if meta, exists := messageData["metadata"]; exists {
		if metaMap, ok := meta.(map[string]interface{}); ok {
			metadata = metaMap
		}
	}

	// Extract client message ID for acknowledgment
	clientMessageID := ""
	if val, ok := messageData["clientMessageId"].(string); ok {
		clientMessageID = val
	}

	// Create message payload for database using chat service SendMessage method
	messageObj, err := wsService.chatService.SendMessage(
		roomID,
		senderID,
		MessageType(messageType),
		content,
		metadata,
		nil, // replyToID
	)
	if err != nil {
		log.Printf("Failed to save message to database: %v", err)
		// Optionally send error back to client
		return
	}

	log.Printf("Message saved to database: %v", messageObj.ID)

	// Convert to map for WebSocket broadcast
	savedMessage := map[string]interface{}{
		"id":              messageObj.ID,
		"roomId":          messageObj.RoomID,
		"senderId":        messageObj.SenderID,
		"type":            messageObj.Type,
		"content":         messageObj.Content,
		"metadata":        messageObj.Metadata,
		"fileUrl":         messageObj.FileURL,
		"isEdited":        messageObj.IsEdited,
		"isDeleted":       messageObj.IsDeleted,
		"replyToId":       messageObj.ReplyToID,
		"createdAt":       messageObj.CreatedAt,
		"updatedAt":       messageObj.UpdatedAt,
		"clientMessageId": clientMessageID, // Echo back for client correlation
		"sender": map[string]interface{}{
			"id":        messageObj.Sender.ID,
			"firstName": messageObj.Sender.FirstName,
			"lastName":  messageObj.Sender.LastName,
			"avatar":    messageObj.Sender.Avatar,
		},
	}

	// Broadcast the message to all clients in the room (including sender for confirmation)
	broadcastMessage := WebSocketMessage{
		Type:   "new_message",
		RoomID: roomID,
		UserID: senderID,
		Data:   savedMessage,
	}

	c.Hub.broadcast <- broadcastMessage
}

// Helper function to generate client ID
func generateClientID() string {
	// Simple client ID generation - in production, use UUID
	return "client_" + strconv.FormatInt(time.Now().UnixNano(), 10)
}

// handleGetRooms returns chat rooms for the authenticated user
func (c *Client) handleGetRooms(wsService *WebSocketService, message WebSocketMessage) {
	userID := c.UserID
	requestId := message.RequestID

	// Parse optional parameters
	data, _ := message.Data.(map[string]interface{})
	_, _ = data["forceRefresh"]

	// Get rooms from chat service
	rooms, err := wsService.chatService.GetUserChatRooms(userID)
	if err != nil {
		c.sendResponse(requestId, "rooms_list", map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.sendResponse(requestId, "rooms_list", map[string]interface{}{
		"success": true,
		"data":    rooms,
	})
}

// handleGetRoom returns a specific chat room
func (c *Client) handleGetRoom(wsService *WebSocketService, message WebSocketMessage) {
	userID := c.UserID
	requestId := message.RequestID

	data, _ := message.Data.(map[string]interface{})
	roomID, ok := data["roomId"].(string)
	if !ok || roomID == "" {
		c.sendResponse(requestId, "room_detail", map[string]interface{}{
			"success": false,
			"error":   "roomId is required",
		})
		return
	}

	_, _ = data["forceRefresh"]

	// Check membership
	isMember, err := wsService.chatService.IsUserMemberOfRoom(roomID, userID)
	if err != nil || !isMember {
		c.sendResponse(requestId, "room_detail", map[string]interface{}{
			"success": false,
			"error":   "access denied",
		})
		return
	}

	room, err := wsService.chatService.GetChatRoomByID(roomID)
	if err != nil {
		c.sendResponse(requestId, "room_detail", map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.sendResponse(requestId, "room_detail", map[string]interface{}{
		"success": true,
		"data":    room,
	})
}

// handleCreateRoom creates a new chat room
func (c *Client) handleCreateRoom(wsService *WebSocketService, message WebSocketMessage) {
	userID := c.UserID
	requestId := message.RequestID

	data, _ := message.Data.(map[string]interface{})
	roomType, _ := data["type"].(string)

	switch roomType {
	case "private":
		recipientID, ok := data["recipientId"].(string)
		if !ok || recipientID == "" {
			c.sendResponse(requestId, "room_created", map[string]interface{}{
				"success": false,
				"error":   "recipientId required for private chat",
			})
			return
		}
		room, err := wsService.chatService.CreatePrivateChat(userID, recipientID)
		if err != nil {
			c.sendResponse(requestId, "room_created", map[string]interface{}{
				"success": false,
				"error":   err.Error(),
			})
			return
		}
		c.sendResponse(requestId, "room_created", map[string]interface{}{
			"success": true,
			"data":    room,
		})

	case "support":
		supportUserID := ""
		if val, ok := data["recipientId"].(string); ok && val != "" {
			supportUserID = val
		} else if val, ok := data["userIds"].([]string); ok && len(val) > 0 {
			supportUserID = val[0]
		} else if val, ok := data["context"].(map[string]interface{}); ok {
			if uid, ok := val["userId"].(string); ok {
				supportUserID = uid
			}
		}
		if supportUserID == "" {
			c.sendResponse(requestId, "room_created", map[string]interface{}{
				"success": false,
				"error":   "userId required for support chat",
			})
			return
		}
		ctx := make(map[string]interface{})
		if val, ok := data["context"].(map[string]interface{}); ok {
			ctx = val
		}
		room, err := wsService.chatService.CreateSupportChat(userID, supportUserID, ctx)
		if err != nil {
			c.sendResponse(requestId, "room_created", map[string]interface{}{
				"success": false,
				"error":   err.Error(),
			})
			return
		}
		c.sendResponse(requestId, "room_created", map[string]interface{}{
			"success": true,
			"data":    room,
		})

	case "chama":
		chamaID, ok := data["chamaId"].(string)
		if !ok || chamaID == "" {
			c.sendResponse(requestId, "room_created", map[string]interface{}{
				"success": false,
				"error":   "chamaId required for chama chat",
			})
			return
		}
		room, err := wsService.chatService.CreateChamaChat(chamaID, userID)
		if err != nil {
			c.sendResponse(requestId, "room_created", map[string]interface{}{
				"success": false,
				"error":   err.Error(),
			})
			return
		}
		c.sendResponse(requestId, "room_created", map[string]interface{}{
			"success": true,
			"data":    room,
		})

	default:
		c.sendResponse(requestId, "room_created", map[string]interface{}{
			"success": false,
			"error":   "invalid chat room type",
		})
	}
}

// handleGetMessages returns messages for a room
func (c *Client) handleGetMessages(wsService *WebSocketService, message WebSocketMessage) {
	userID := c.UserID
	requestId := message.RequestID

	data, _ := message.Data.(map[string]interface{})
	roomID, ok := data["roomId"].(string)
	if !ok || roomID == "" {
		c.sendResponse(requestId, "messages_list", map[string]interface{}{
			"success": false,
			"error":   "roomId is required",
		})
		return
	}

	// Check membership
	isMember, err := wsService.chatService.IsUserMemberOfRoom(roomID, userID)
	if err != nil || !isMember {
		c.sendResponse(requestId, "messages_list", map[string]interface{}{
			"success": false,
			"error":   "access denied",
		})
		return
	}

	// Parse pagination
	limit := 50
	offset := 0
	if val, ok := data["limit"]; ok {
		if f, ok := val.(float64); ok && f > 0 && f <= 100 {
			limit = int(f)
		} else if s, ok := val.(string); ok {
			if parsed, err := strconv.Atoi(s); err == nil && parsed > 0 && parsed <= 100 {
				limit = parsed
			}
		}
	}
	if val, ok := data["offset"]; ok {
		if f, ok := val.(float64); ok && f >= 0 {
			offset = int(f)
		} else if s, ok := val.(string); ok {
			if parsed, err := strconv.Atoi(s); err == nil && parsed >= 0 {
				offset = parsed
			}
		}
	}

	messages, err := wsService.chatService.GetRoomMessages(roomID, userID, limit, offset)
	if err != nil {
		c.sendResponse(requestId, "messages_list", map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.sendResponse(requestId, "messages_list", map[string]interface{}{
		"success": true,
		"data":    messages,
	})
}

// handleMarkRead marks messages as read
func (c *Client) handleMarkRead(wsService *WebSocketService, message WebSocketMessage) {
	userID := c.UserID
	data, _ := message.Data.(map[string]interface{})
	roomID, _ := data["roomId"].(string)
	messageID, _ := data["messageId"].(string)

	if roomID != "" && messageID != "" {
		// Update read status in DB
		_ = wsService.chatService.MarkMessagesAsRead(roomID, userID)
	}
}

// handleTyping handles typing indicators
func (c *Client) handleTyping(wsService *WebSocketService, message WebSocketMessage) {
	userID := c.UserID
	data, _ := message.Data.(map[string]interface{})
	roomID, _ := data["roomId"].(string)
	isTyping, _ := data["isTyping"].(bool)

	if roomID != "" {
		// Broadcast typing status to room
		typingMsg := WebSocketMessage{
			Type:   "chat_typing",
			RoomID: roomID,
			UserID: userID,
			Data: map[string]interface{}{
				"userId":   userID,
				"isTyping": isTyping,
			},
		}
		c.Hub.broadcast <- typingMsg
	}
}

// sendResponse sends a response to the client with correlation to requestId
func (c *Client) sendResponse(requestId, responseType string, data interface{}) {
	response := WebSocketMessage{
		Type:      responseType,
		RequestID: requestId,
		Data:      data,
	}
	select {
	case c.Send <- response:
	default:
		// Client not reading, drop
	}
}
