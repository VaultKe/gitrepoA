package websocket

import (
	"encoding/json"
	"fmt"
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
	roomSubscribe chan *RoomSubscription
	mu            sync.RWMutex
}

type RoomSubscription struct {
	Client *Client
	RoomID string
}

func NewHub() *Hub {
	return &Hub{
		clients:       make(map[*Client]bool),
		rooms:         make(map[string]map[*Client]bool),
		broadcast:     make(chan *Message, 256),
		register:      make(chan *Client, 256),
		unregister:    make(chan *Client, 256),
		roomMessages:  make(chan *RoomMessage, 256),
		roomSubscribe: make(chan *RoomSubscription, 256),
	}
}

func (h *Hub) Run() {
	for {
		defer func() {
			if r := recover(); r != nil {
				fmt.Printf("WS HUB PANIC RECOVERED: %v\n", r)
			}
		}()
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			if h.rooms[client.roomID] == nil {
				h.rooms[client.roomID] = make(map[*Client]bool)
			}
			h.rooms[client.roomID][client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				if h.rooms[client.roomID] != nil {
					delete(h.rooms[client.roomID], client)
					if len(h.rooms[client.roomID]) == 0 {
						delete(h.rooms, client.roomID)
					}
				}
				close(client.send)
			}
			h.mu.Unlock()

		case sub := <-h.roomSubscribe:
			h.mu.Lock()
			if h.rooms[sub.RoomID] == nil {
				h.rooms[sub.RoomID] = make(map[*Client]bool)
			}
			h.rooms[sub.RoomID][sub.Client] = true
			h.mu.Unlock()

		case msg := <-h.broadcast:
			h.mu.RLock()
			data := encodeMessage(msg)
			for client := range h.clients {
				select {
				case client.send <- data:
				default:
					// Client buffer full; skip and let ping/pong clean up dead connections
				}
			}
			h.mu.RUnlock()

		case rm := <-h.roomMessages:
			h.mu.RLock()
			data := rm.Content
			for client := range h.rooms[rm.RoomID] {
				select {
				case client.send <- data:
				default:
					// Client buffer full; skip
				}
			}
			h.mu.RUnlock()
		}
	}
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

func (h *Hub) RegisterToRoom(userID, roomID string, client *Client) {
	h.roomSubscribe <- &RoomSubscription{
		Client: client,
		RoomID: roomID,
	}
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
	defer h.mu.RUnlock()

	for client := range h.clients {
		if client.userID == userID {
			select {
			case client.send <- message:
			default:
				// Buffer full; skip
			}
		}
	}
}

func (h *Hub) HandlePingPong() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		h.mu.RLock()
		for client := range h.clients {
			if err := client.conn.WriteControl(websocket.PingMessage, []byte{}, time.Time{}); err != nil {
				h.mu.RUnlock()
				h.Unregister(client)
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
	defer c.hub.Unregister(c)
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
