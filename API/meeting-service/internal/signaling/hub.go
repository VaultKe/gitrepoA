package signaling

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

// SignalingMessage represents a WebSocket signaling message.
type SignalingMessage struct {
	Type        string      `json:"type"`
	RoomID      string      `json:"roomId,omitempty"`
	UserID      string      `json:"userId,omitempty"`
	ConnID      string      `json:"connId,omitempty"`
	Target      string      `json:"target,omitempty"`
	DisplayName string      `json:"displayName,omitempty"`
	Payload     interface{} `json:"payload,omitempty"`
	Timestamp   time.Time   `json:"timestamp,omitempty"`
}

// SignalingClient represents a connected WebSocket client.
type SignalingClient struct {
	Conn       *websocket.Conn
	RoomID     string
	UserID     string
	ConnID     string
	DisplayName string
	Role       string
	Send       chan []byte
	Hub        *SignalingHub
	mu         sync.Mutex
	closed     bool
	lastPing   time.Time
}

// ClientRemovedReason indicates why a client was removed from the hub.
type ClientRemovedReason int

const (
	ClientLeft ClientRemovedReason = iota
	ClientDisconnected
	ClientDropped
)

// ClientRemovedInfo contains information about a removed client.
type ClientRemovedInfo struct {
	RoomID      string
	UserID      string
	ConnID      string
	DisplayName string
	Role        string
	Reason      ClientRemovedReason
}

// NewSignalingClient creates a new signaling client with initialized fields.
func NewSignalingClient(conn *websocket.Conn, roomID, userID, connID string, hub *SignalingHub) *SignalingClient {
	return &SignalingClient{
		Conn:     conn,
		RoomID:   roomID,
		UserID:   userID,
		ConnID:   connID,
		Send:     make(chan []byte, 256),
		Hub:      hub,
		lastPing: time.Now(), // Initialize to current time to avoid immediate timeout
	}
}

// OnClientRemoved is called when a client is removed from the hub.
// This allows the handler to broadcast participant-left events.
type OnClientRemoved func(info ClientRemovedInfo)

// SignalingHub manages WebSocket signaling connections and Redis pub/sub.
type SignalingHub struct {
	// Local connections
	clients    map[*SignalingClient]bool
	rooms      map[string]map[*SignalingClient]bool
	broadcast  chan []byte
	register   chan *SignalingClient
	unregister chan *SignalingClient

	// Redis pub/sub for horizontal scaling
	redisClient  *redis.Client
	redisPub     *redis.PubSub
	redisChannel string

	// Callback when a client is removed
	onClientRemoved OnClientRemoved

	mu sync.RWMutex
}

// NewSignalingHub creates a new signaling hub.
func NewSignalingHub(redisClient *redis.Client, redisChannel string) *SignalingHub {
	hub := &SignalingHub{
		clients:      make(map[*SignalingClient]bool),
		rooms:        make(map[string]map[*SignalingClient]bool),
		broadcast:    make(chan []byte, 65536),
		register:     make(chan *SignalingClient, 1024),
		unregister:   make(chan *SignalingClient, 1024),
		redisClient:  redisClient,
		redisChannel: redisChannel,
	}

	// Subscribe to Redis channel for cross-instance signaling
	if redisClient != nil && redisChannel != "" {
		ctx := context.Background()
		hub.redisPub = redisClient.Subscribe(ctx, redisChannel)
		_, err := hub.redisPub.Receive(ctx)
		if err != nil {
			fmt.Printf("Warning: Redis pub/sub subscription failed: %v\n", err)
			hub.redisPub = nil
		} else {
			go hub.listenRedis()
		}
	}

	go hub.Run()
	return hub
}

// SetOnClientRemoved sets the callback for when a client is removed from the hub.
func (h *SignalingHub) SetOnClientRemoved(callback OnClientRemoved) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.onClientRemoved = callback
}

// Run is the main event loop for the signaling hub.
func (h *SignalingHub) Run() {
	pingTicker := time.NewTicker(30 * time.Second)
	defer pingTicker.Stop()

	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			if h.rooms[client.RoomID] == nil {
				h.rooms[client.RoomID] = make(map[*SignalingClient]bool)
			}
			h.rooms[client.RoomID][client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.removeClient(client, ClientLeft)

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.Send <- message:
				default:
					// Client's send buffer is full - close and clean up
					close(client.Send)
					// Need to unlock before calling removeClient to avoid deadlock
					h.mu.RUnlock()
					h.removeClient(client, ClientDropped)
					h.mu.RLock()
				}
			}
			h.mu.RUnlock()

		case <-pingTicker.C:
			h.mu.RLock()
			for client := range h.clients {
				client.mu.Lock()
				if time.Since(client.lastPing) > 2*time.Minute {
					client.mu.Unlock()
					// Need to unlock before calling removeClient to avoid deadlock
					h.mu.RUnlock()
					client.Close()
					h.removeClient(client, ClientDisconnected)
					h.mu.RLock()
					continue
				}
				client.mu.Unlock()
			}
			h.mu.RUnlock()
		}
	}
}

// listenRedis listens for messages from Redis pub/sub.
// Messages are expected to contain a RoomID field so we can filter delivery
// to only clients in the relevant room, preventing cross-room event leaks.
func (h *SignalingHub) listenRedis() {
	if h.redisPub == nil {
		return
	}

	for msg := range h.redisPub.Channel() {
		if msg == nil || msg.Payload == "" {
			continue
		}

		// Parse the message to extract RoomID for room-aware delivery
		var parsedMsg struct {
			RoomID string `json:"roomId"`
		}
		if err := json.Unmarshal([]byte(msg.Payload), &parsedMsg); err != nil {
			// If we can't parse, broadcast to all (backward compatibility)
			h.broadcast <- []byte(msg.Payload)
			continue
		}

		// Deliver only to clients in the specified room
		if parsedMsg.RoomID != "" {
			h.mu.RLock()
			if roomClients, exists := h.rooms[parsedMsg.RoomID]; exists {
				for client := range roomClients {
					select {
					case client.Send <- []byte(msg.Payload):
					default:
						// Client buffer full - will be cleaned up by ping check
					}
				}
			}
			h.mu.RUnlock()
		} else {
			// No room ID - broadcast to all (for global events like room-ended)
			h.broadcast <- []byte(msg.Payload)
		}
	}
}

// publishRedis publishes a message to Redis for cross-instance signaling.
func (h *SignalingHub) publishRedis(data []byte) {
	if h.redisClient == nil || h.redisChannel == "" {
		return
	}
	ctx := context.Background()
	_ = h.redisClient.Publish(ctx, h.redisChannel, string(data))
}

// RegisterClient registers a new WebSocket client.
func (h *SignalingHub) RegisterClient(client *SignalingClient) {
	client.Hub = h
	h.register <- client
}

// UnregisterClient unregisters a WebSocket client.
func (h *SignalingHub) UnregisterClient(client *SignalingClient) {
	if client != nil {
		h.unregister <- client
	}
}

// BroadcastToRoom broadcasts a message to all clients in a room.
func (h *SignalingHub) BroadcastToRoom(roomID string, msg *SignalingMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	// Publish to Redis for other instances
	h.publishRedis(data)

	// Local broadcast
	h.mu.RLock()
	if roomClients, exists := h.rooms[roomID]; exists {
		for client := range roomClients {
			select {
			case client.Send <- data:
			default:
				// Client's send buffer is full - clean up
				close(client.Send)
				// Need to unlock before calling removeClient to avoid deadlock
				h.mu.RUnlock()
				h.removeClient(client, ClientDropped)
				h.mu.RLock()
			}
		}
	}
	h.mu.RUnlock()
}

// BroadcastToRoomExcept broadcasts a message to all clients in a room except
// the one identified by excludeConnID. This is used for events (e.g. screen share
// start/stop) where the sender should not receive its own notification.
func (h *SignalingHub) BroadcastToRoomExcept(roomID, excludeConnID string, msg *SignalingMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	// Publish to Redis for other instances
	h.publishRedis(data)

	// Local broadcast, skipping the excluding connection
	h.mu.RLock()
	if roomClients, exists := h.rooms[roomID]; exists {
		for client := range roomClients {
			if client.ConnID == excludeConnID {
				continue
			}
			select {
			case client.Send <- data:
			default:
				// Client's send buffer is full - clean up
				close(client.Send)
				// Need to unlock before calling removeClient to avoid deadlock
				h.mu.RUnlock()
				h.removeClient(client, ClientDropped)
				h.mu.RLock()
			}
		}
	}
	h.mu.RUnlock()
}

// SendToUser sends a message to a specific user in a room.
func (h *SignalingHub) SendToUser(roomID, userID string, msg *SignalingMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	if roomClients, exists := h.rooms[roomID]; exists {
		for client := range roomClients {
			if client.UserID == userID {
				select {
				case client.Send <- data:
				default:
					// Client's send buffer is full - will be cleaned up by ping check
				}
				break
			}
		}
	}
}

// SendToConnection sends a message to a specific connection.
func (h *SignalingHub) SendToConnection(connID string, msg *SignalingMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		if client.ConnID == connID {
			select {
			case client.Send <- data:
			default:
				// Client's send buffer is full - will be cleaned up by ping check
			}
			break
		}
	}
}

// GetRoomClients returns all clients in a room.
func (h *SignalingHub) GetRoomClients(roomID string) map[*SignalingClient]bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if roomClients, exists := h.rooms[roomID]; exists {
		result := make(map[*SignalingClient]bool, len(roomClients))
		for c := range roomClients {
			result[c] = true
		}
		return result
	}
	return make(map[*SignalingClient]bool)
}

// GetClientCount returns the total number of connected clients.
func (h *SignalingHub) GetClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// GetRoomClientCount returns the number of clients in a room.
func (h *SignalingHub) GetRoomClientCount(roomID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.rooms[roomID])
}

// removeClient removes a client from all tracking structures.
// reason indicates why the client was removed so the callback can decide
// whether to broadcast a participant-left event.
func (h *SignalingHub) removeClient(client *SignalingClient, reason ClientRemovedReason) {
	if client == nil {
		return
	}

	client.mu.Lock()
	if client.closed {
		client.mu.Unlock()
		return
	}
	client.closed = true
	client.mu.Unlock()

	h.mu.Lock()
	defer h.mu.Unlock()

	if _, exists := h.clients[client]; !exists {
		return
	}

	delete(h.clients, client)

	if roomClients, exists := h.rooms[client.RoomID]; exists {
		delete(roomClients, client)
		if len(roomClients) == 0 {
			delete(h.rooms, client.RoomID)
		}
	}

	client.Conn.Close()
	close(client.Send)

	// Notify the handler so it can broadcast participant-left if needed
	if h.onClientRemoved != nil {
		info := ClientRemovedInfo{
			RoomID:      client.RoomID,
			UserID:      client.UserID,
			ConnID:      client.ConnID,
			DisplayName: client.DisplayName,
			Role:        client.Role,
			Reason:      reason,
		}
		// Call callback outside lock to avoid deadlock
		h.mu.Unlock()
		h.onClientRemoved(info)
		h.mu.Lock()
	}
}

// WritePump pumps messages from the Send channel to the WebSocket connection.
func (c *SignalingClient) WritePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				c.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
				return
			}
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ReadPump pumps messages from the WebSocket connection to the hub.
func (c *SignalingClient) ReadPump(handler func(*SignalingMessage) error) {
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		c.mu.Lock()
		c.lastPing = time.Now()
		c.mu.Unlock()
		return nil
	})

	for {
		_, raw, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				fmt.Printf("WebSocket read error: %v\n", err)
			}
			break
		}

		var msg SignalingMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			fmt.Printf("Failed to parse signaling message: %v\n", err)
			continue
		}

		// For authenticated connections the context user/conn id are
		// authoritative. For unauthenticated/debug joins the client supplies
		// its own userId in the message body, so only overwrite it when the
		// context actually has a value — otherwise we'd broadcast an empty
		// userId and break identity/room matching on the client.
		if c.UserID != "" {
			msg.UserID = c.UserID
		}
		if c.ConnID != "" {
			msg.ConnID = c.ConnID
		}
		msg.Timestamp = time.Now()

		if err := handler(&msg); err != nil {
			fmt.Printf("Error handling signaling message: %v\n", err)
		}
	}
}

// WriteMessage writes a message to the WebSocket connection.
func (c *SignalingClient) WriteMessage(messageType int, data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return fmt.Errorf("client closed")
	}

	c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	return c.Conn.WriteMessage(messageType, data)
}

// Close closes the WebSocket connection.
func (c *SignalingClient) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil
	}
	c.closed = true

	return c.Conn.WriteMessage(
		websocket.CloseMessage,
		websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""),
	)
}

// IsClosed returns whether the client is closed.
func (c *SignalingClient) IsClosed() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.closed
}
