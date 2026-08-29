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
	Type      string                 `json:"type"`
	RoomID    string                 `json:"roomId,omitempty"`
	UserID    string                 `json:"userId,omitempty"`
	ConnID    string                 `json:"connId,omitempty"`
	Target    string                 `json:"target,omitempty"`
	Payload   interface{}            `json:"payload,omitempty"`
	Timestamp time.Time              `json:"timestamp,omitempty"`
}

// SignalingClient represents a connected WebSocket client.
type SignalingClient struct {
	Conn      *websocket.Conn
	RoomID    string
	UserID    string
	ConnID    string
	Send      chan []byte
	Hub       *SignalingHub
	mu        sync.Mutex
	closed    bool
	lastPing  time.Time
}

// SignalingHub manages WebSocket signaling connections and Redis pub/sub.
type SignalingHub struct {
	// Local connections
	clients    map[*SignalingClient]bool
	rooms      map[string]map[*SignalingClient]bool
	broadcast  chan []byte
	register   chan *SignalingClient
	unregister chan *SignalingClient

	// Redis pub/sub for horizontal scaling
	redisClient *redis.Client
	redisPub    *redis.PubSub
	redisChannel string

	mu sync.RWMutex
}

// NewSignalingHub creates a new signaling hub.
func NewSignalingHub(redisClient *redis.Client, redisChannel string) *SignalingHub {
	hub := &SignalingHub{
		clients:     make(map[*SignalingClient]bool),
		rooms:       make(map[string]map[*SignalingClient]bool),
		broadcast:   make(chan []byte, 65536),
		register:    make(chan *SignalingClient, 1024),
		unregister:  make(chan *SignalingClient, 1024),
		redisClient: redisClient,
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
			h.removeClient(client)

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()

		case <-pingTicker.C:
			h.mu.RLock()
			for client := range h.clients {
				client.mu.Lock()
				if time.Since(client.lastPing) > 2*time.Minute {
					client.mu.Unlock()
					client.Close()
					continue
				}
				client.mu.Unlock()
			}
			h.mu.RUnlock()
		}
	}
}

// listenRedis listens for messages from Redis pub/sub.
func (h *SignalingHub) listenRedis() {
	if h.redisPub == nil {
		return
	}

	for msg := range h.redisPub.Channel() {
		if msg == nil || msg.Payload == "" {
			continue
		}
		h.broadcast <- []byte(msg.Payload)
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
				close(client.Send)
				delete(h.clients, client)
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
				close(client.Send)
				delete(h.clients, client)
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
					close(client.Send)
					delete(h.clients, client)
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
				close(client.Send)
				delete(h.clients, client)
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
func (h *SignalingHub) removeClient(client *SignalingClient) {
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

		msg.UserID = c.UserID
		msg.ConnID = c.ConnID
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
