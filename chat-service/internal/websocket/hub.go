package websocket

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Message struct {
	Type      string `json:"type"`
	Content   string `json:"content,omitempty"`
	RoomID    string `json:"roomId,omitempty"`
	SenderID  string `json:"senderId,omitempty"`
	Timestamp int64  `json:"timestamp"`
}

type RoomMessage struct {
	RoomID   string
	Content  []byte
	SenderID string
}

type Client struct {
	conn   connWrapper
	send   chan []byte
	userID string
	roomID string
	hub    *Hub
}

type connWrapper struct {
	*websocket.Conn
}

type Hub struct {
	clients       map[*Client]bool
	rooms         map[string]map[*Client]bool
	broadcast     chan *Message
	register      chan *Client
	unregister    chan *Client
	roomMessages  chan *RoomMessage
	mu            sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:      make(map[*Client]bool),
		rooms:        make(map[string]map[*Client]bool),
		broadcast:    make(chan *Message, 256),
		register:     make(chan *Client, 256),
		unregister:   make(chan *Client, 256),
		roomMessages: make(chan *RoomMessage, 256),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.registerClient(client)
		case client := <-h.unregister:
			h.unregisterClient(client)
		case msg := <-h.broadcast:
			h.broadcastToAll(msg)
		case rm := <-h.roomMessages:
			h.broadcastToRoom(rm)
		}
	}
}

func (h *Hub) registerClient(client *Client) {
	h.mu.Lock()
	h.clients[client] = true
	if h.rooms[client.roomID] == nil {
		h.rooms[client.roomID] = make(map[*Client]bool)
	}
	h.rooms[client.roomID][client] = true
	h.mu.Unlock()
}

func (h *Hub) unregisterClient(client *Client) {
	h.mu.Lock()
	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		delete(h.rooms[client.roomID], client)
		close(client.send)
	}
	h.mu.Unlock()
}

func (h *Hub) broadcastToAll(msg *Message) {
	h.mu.RLock()
	for client := range h.clients {
		select {
		case client.send <- encodeMessage(msg):
		default:
			close(client.send)
			delete(h.clients, client)
		}
	}
	h.mu.RUnlock()
}

func (h *Hub) broadcastToRoom(rm *RoomMessage) {
	h.mu.RLock()
	clients := h.rooms[rm.RoomID]
	for client := range clients {
		select {
		case client.send <- rm.Content:
		default:
			close(client.send)
			delete(h.clients, client)
			delete(h.rooms[rm.RoomID], client)
		}
	}
	h.mu.RUnlock()
}

func (h *Hub) Register(conn *websocket.Conn, userID, roomID string) *Client {
	client := &Client{
		conn:   connWrapper{Conn: conn},
		send:   make(chan []byte, 256),
		userID: userID,
		roomID: roomID,
		hub:    h,
	}
	h.register <- client
	return client
}

func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

func (h *Hub) BroadcastToRoom(roomID string, message []byte) {
	h.roomMessages <- &RoomMessage{
		RoomID:  roomID,
		Content: message,
	}
}

func (h *Hub) SendToUser(userID string, message []byte) {
	h.mu.RLock()
	for client := range h.clients {
		if client.userID == userID {
			select {
			case client.send <- message:
			default:
				close(client.send)
				delete(h.clients, client)
			}
		}
	}
	h.mu.RUnlock()
}

func (h *Hub) HandlePingPong() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		h.mu.RLock()
		for client := range h.clients {
			if err := client.conn.WriteControl(websocket.PingMessage, []byte{}, time.Time{}); err != nil {
				h.mu.RUnlock()
				h.unregisterClient(client)
				h.mu.RLock()
			}
		}
		h.mu.RUnlock()
	}
}

func (c *Client) WritePump() {
	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		}
	}
}

func (c *Client) ReadPump(handleMessage func(*Client, []byte)) {
	defer c.hub.unregisterClient(c)
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				return
			}
			return
		}
		handleMessage(c, message)
	}
}

func encodeMessage(msg *Message) []byte {
	b, _ := json.Marshal(msg)
	return b
}