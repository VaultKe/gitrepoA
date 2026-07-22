package websocket

import (
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Hub is a scalable, in-memory pub/sub registry for chat WebSocket
// connections. Design goals for thousands of concurrent users:
//   - O(1) delivery to a single user across all their devices.
//   - Room broadcasts only iterate the (typically small) set of members
//     currently connected to that room.
//   - No global scans on the hot path; per-connection read/write pumps
//     keep socket I/O off the Hub lock.
//   - Dead connections are reclaimed by per-connection read/write
//     deadlines + control-frame ping/pong (no single ticker scanning
//     every client).
//   - Dead connections are reclaimed by per-connection read/write
//     deadlines + control-frame ping/pong.
type Hub struct {
	// userClients maps a userID to all of their live connections
	// (a user may have the app open on a phone and a tablet).
	userClients map[string]map[*Client]struct{}

	// roomClients maps a roomID to the set of currently connected clients.
	roomClients map[string]map[*Client]struct{}

	mu sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		userClients: make(map[string]map[*Client]struct{}),
		roomClients: make(map[string]map[*Client]struct{}),
	}
}

// Register adds a freshly upgraded connection to the Hub. The connection is
// not attached to any chat room until the client sends `join_room`; this
// avoids the old behaviour of dumping every connecting client into a single
// shared "main" room (which would have broadcast to everyone at scale).
func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.userClients[c.UserID] == nil {
		h.userClients[c.UserID] = make(map[*Client]struct{})
	}
	h.userClients[c.UserID][c] = struct{}{}
}

func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if users, ok := h.userClients[c.UserID]; ok {
		if _, exists := users[c]; exists {
			delete(users, c)
			if len(users) == 0 {
				delete(h.userClients, c.UserID)
			}
		}
	}
	h.leaveAllRoomsLocked(c)
}

// JoinRoom attaches a client to a room so it starts receiving that room's
// broadcasts.
func (h *Hub) JoinRoom(c *Client, roomID string) {
	if roomID == "" {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	c.addRoom(roomID)

	if h.roomClients[roomID] == nil {
		h.roomClients[roomID] = make(map[*Client]struct{})
	}
	h.roomClients[roomID][c] = struct{}{}
}

// LeaveRoom detaches a client from a single room.
func (h *Hub) LeaveRoom(c *Client, roomID string) {
	if roomID == "" {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	c.removeRoom(roomID)

	if room, ok := h.roomClients[roomID]; ok {
		if _, exists := room[c]; exists {
			delete(room, c)
			if len(room) == 0 {
				delete(h.roomClients, roomID)
			}
		}
	}
}

func (h *Hub) leaveAllRoomsLocked(c *Client) {
	c.roomsMu.Lock()
	defer c.roomsMu.Unlock()
	for roomID := range c.rooms {
		if room, ok := h.roomClients[roomID]; ok {
			if _, exists := room[c]; exists {
				delete(room, c)
				if len(room) == 0 {
					delete(h.roomClients, roomID)
				}
			}
		}
	}
	c.rooms = make(map[string]struct{})
}

// SendToUser delivers to every live connection for a user (all their
// devices). It is O(devices) for that user, not O(total clients).
func (h *Hub) SendToUser(userID string, payload []byte) {
	h.mu.RLock()
	clients := h.userClients[userID]
	// Copy the set so we can release the lock before writing to sockets.
	targets := make([]*Client, 0, len(clients))
	for c := range clients {
		targets = append(targets, c)
	}
	h.mu.RUnlock()

	for _, c := range targets {
		c.Write(payload)
	}
}

// BroadcastToRoom delivers to every currently-connected client in a room,
// excluding the supplied sender (so a user never receives their own message
// echo). Room broadcasts are O(room members online), which stays small.
func (h *Hub) BroadcastToRoom(roomID string, payload []byte, excludeUserID string) {
	h.mu.RLock()
	clients := h.roomClients[roomID]
	targets := make([]*Client, 0, len(clients))
	for c := range clients {
		if excludeUserID != "" && c.UserID == excludeUserID {
			continue
		}
		targets = append(targets, c)
	}
	h.mu.RUnlock()

	for _, c := range targets {
		c.Write(payload)
	}
}

// ConnectedUserCount returns the number of distinct users currently online.
func (h *Hub) ConnectedUserCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.userClients)
}

// Close initiates a graceful shutdown: every live connection is closed, which
// unblocks the read pump and lets the hub drain.
func (h *Hub) Close() {
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, clients := range h.userClients {
		for c := range clients {
			c.Conn.Close()
		}
	}
}

// Client is a single WebSocket connection. Each client owns its own
// read and write goroutines so socket I/O never contends on the Hub lock.
type Client struct {
	Conn    *websocket.Conn
	Send    chan []byte
	UserID  string
	Hub     *Hub
	rooms   map[string]struct{}
	roomsMu sync.RWMutex
}

func (c *Client) addRoom(roomID string) {
	c.roomsMu.Lock()
	c.rooms[roomID] = struct{}{}
	c.roomsMu.Unlock()
}

func (c *Client) removeRoom(roomID string) {
	c.roomsMu.Lock()
	delete(c.rooms, roomID)
	c.roomsMu.Unlock()
}

// Write enqueues an outbound frame. It is non-blocking: if the client's
// buffer is full (a stuck/slow consumer) the message is dropped rather than
// blocking the broadcaster, keeping the system responsive under load.
func (c *Client) Write(payload []byte) {
	select {
	case c.Send <- payload:
	default:
		// Drop on a full buffer; per-connection read/write deadlines will
		// eventually reap unresponsive connections.
	}
}

const (
	// writeWait bounds how long a single socket write may take before the
	// connection is considered dead.
	writeWait = 10 * time.Second
	// pongWait is the maximum idle time before expecting a pong.
	pongWait = 60 * time.Second
	// pingPeriod must be < pongWait so control pings arrive in time.
	pingPeriod = (pongWait * 9) / 10
	// maxMessageSize caps an inbound application frame (bytes) to protect
	// against abusive payloads.
	maxMessageSize int64 = 1 << 20 // 1 MB
)

// WritePump is the per-connection outbound goroutine.
func (c *Client) WritePump() {
	pingTicker := time.NewTicker(pingPeriod)
	defer func() {
		pingTicker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.Send:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-pingTicker.C:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ReadPump is the per-connection inbound goroutine. It owns connection
// liveness via read deadlines and control-frame pongs, then hands decoded
// application messages to handleMessage.
func (c *Client) ReadPump(handleMessage func(*Client, []byte)) {
	defer c.Hub.Unregister(c)

	c.Conn.SetReadLimit(maxMessageSize)
	_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		return c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				// Connection closed; cleanup handled by defer.
			}
			return
		}
		handleMessage(c, message)
	}
}
