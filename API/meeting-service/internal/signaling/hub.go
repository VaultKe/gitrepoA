package signaling

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

type Message struct {
	Type    string          `json:"type"`
	RoomID  string          `json:"roomId,omitempty"`
	UserID  string          `json:"userId,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type Client struct {
	Conn   *websocket.Conn
	RoomID string
	UserID string
}

type Hub struct {
	clients    map[*websocket.Conn]*Client
	rooms      map[string]map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]*Client),
		rooms:      make(map[string]map[*websocket.Conn]bool),
		broadcast:  make(chan []byte, 1024),
		register:   make(chan *Client, 1024),
		unregister: make(chan *Client, 1024),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.Conn] = client
			if h.rooms[client.RoomID] == nil {
				h.rooms[client.RoomID] = make(map[*websocket.Conn]bool)
			}
			h.rooms[client.RoomID][client.Conn] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			delete(h.clients, client.Conn)
			if h.rooms[client.RoomID] != nil {
				delete(h.rooms[client.RoomID], client.Conn)
				if len(h.rooms[client.RoomID]) == 0 {
					delete(h.rooms, client.RoomID)
				}
			}
			h.mu.Unlock()
			client.Conn.Close()

		case message := <-h.broadcast:
			h.mu.RLock()
			for conn := range h.clients {
				if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
					log.Printf("WebSocket write error: %v", err)
					h.mu.RUnlock()
					h.unregister <- h.clients[conn]
					h.mu.RLock()
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) RegisterClient(conn *websocket.Conn, roomID, userID string) {
	h.register <- &Client{
		Conn:   conn,
		RoomID: roomID,
		UserID: userID,
	}
}

func (h *Hub) UnregisterClient(conn *websocket.Conn) {
	if client, exists := h.clients[conn]; exists {
		h.unregister <- client
	}
}

func (h *Hub) BroadcastToRoom(roomID string, msg *Message) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for conn := range h.rooms[roomID] {
		if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
			log.Printf("Broadcast error: %v", err)
		}
	}
}

func (h *Hub) SendToUser(userID string, msg *Message) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for conn, client := range h.clients {
		if client.UserID == userID {
			data, err := json.Marshal(msg)
			if err != nil {
				continue
			}
			conn.WriteMessage(websocket.TextMessage, data)
		}
	}
}

func (h *Hub) GetRoomClients(roomID string) map[*websocket.Conn]bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if clients, exists := h.rooms[roomID]; exists {
		return clients
	}
	return make(map[*websocket.Conn]bool)
}