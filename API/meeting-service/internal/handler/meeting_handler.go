package handler

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"vaultke-meeting-service/config"
	"vaultke-meeting-service/internal/models"
	"vaultke-meeting-service/internal/room"
	"vaultke-meeting-service/internal/signaling"
	"vaultke-meeting-service/internal/webrtc"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// MeetingHandler handles HTTP and WebSocket requests for meetings.
type MeetingHandler struct {
	config        *config.Config
	roomManager   *room.RoomManager
	sfuManager    *webrtc.SFUManager
	signalingHub  *signaling.SignalingHub
	upgrader      websocket.Upgrader
	// activeScreenSharers tracks which connection id is currently sharing its
	// screen per room. This prevents two participants from sharing at once.
	activeScreenSharers map[string]string // roomID -> connID
	ssMu                sync.Mutex
}

// NewMeetingHandler creates a new meeting handler.
func NewMeetingHandler(cfg *config.Config, rm *room.RoomManager, sfu *webrtc.SFUManager, hub *signaling.SignalingHub) *MeetingHandler {
	return &MeetingHandler{
		config:              cfg,
		roomManager:         rm,
		sfuManager:          sfu,
		signalingHub:        hub,
		activeScreenSharers: make(map[string]string),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				origin := r.Header.Get("Origin")
				for _, allowed := range cfg.AllowedOrigins {
					if allowed == "*" || allowed == origin {
						return true
					}
				}
				return false
			},
		},
	}
}

// CreateRoom creates a new meeting room.
func (h *MeetingHandler) CreateRoom(c *gin.Context) {
	userID := getUserID(c)

	var req struct {
		ChamaID          string                 `json:"chamaId"`
		Name             string                 `json:"name"`
		Type             string                 `json:"type"`
		MaxParticipants  int                    `json:"maxParticipants,omitempty"`
		RecordingEnabled bool                   `json:"recordingEnabled,omitempty"`
		Metadata         map[string]interface{} `json:"metadata,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	roomType := models.RoomTypeVirtual
	if req.Type == "physical" {
		roomType = models.RoomTypePhysical
	}

	newRoom := &models.Room{
		ChamaID:          req.ChamaID,
		Name:             req.Name,
		Type:             roomType,
		MaxParticipants:   req.MaxParticipants,
		CreatedBy:        userID,
		RecordingEnabled: req.RecordingEnabled,
		Metadata:         req.Metadata,
	}

	if newRoom.MaxParticipants <= 0 {
		newRoom.MaxParticipants = h.config.MaxRoomCapacity
	}

	if err := h.roomManager.CreateRoom(newRoom); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create room: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"roomId":          newRoom.ID,
		"name":            newRoom.Name,
		"type":            newRoom.Type,
		"status":          newRoom.Status,
		"maxParticipants": newRoom.MaxParticipants,
		"turn":            h.config.TURNServers,
		"turnCredentials": h.config.TURNCredentials,
		"stun":            []string{h.config.STUNServer1, h.config.STUNServer2},
	})
}

// GetRoom retrieves room details.
func (h *MeetingHandler) GetRoom(c *gin.Context) {
	roomID := c.Param("roomID")

	room, err := h.roomManager.GetRoom(roomID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	participants, _ := h.roomManager.GetParticipants(roomID)

	c.JSON(http.StatusOK, gin.H{
		"room":         room,
		"participants": participants,
	})
}

// EndRoom ends a meeting room.
func (h *MeetingHandler) EndRoom(c *gin.Context) {
	roomID := c.Param("roomID")

	if err := h.roomManager.EndRoom(roomID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Notify all participants in the room
	h.signalingHub.BroadcastToRoom(roomID, &signaling.SignalingMessage{
		Type:   "room-ended",
		RoomID: roomID,
		Payload: map[string]interface{}{
			"message": "The room has been ended by the host",
		},
	})

	c.JSON(http.StatusOK, gin.H{"status": "room ended"})
}

// JoinRoom adds a participant to a room.
func (h *MeetingHandler) JoinRoom(c *gin.Context) {
	roomID := c.Param("roomID")
	userID := getUserID(c)
	userRole := getUserRole(c)

	var req struct {
		DisplayName string `json:"displayName"`
		Role        string `json:"role"`
		UserID      string `json:"userId"` // Allow passing userId for debug/unauthenticated joins
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Use userID from request body if not available from JWT (debug endpoint)
	if userID == "" && req.UserID != "" {
		userID = req.UserID
	}

	if req.DisplayName == "" {
		if userID != "" {
			req.DisplayName = fmt.Sprintf("User %s", userID[:8])
		} else {
			req.DisplayName = "User"
		}
	}

	// Sanitize strings to prevent PostgreSQL UTF-8 encoding errors
	req.DisplayName = strings.ToValidUTF8(req.DisplayName, "")
	userRole = strings.ToValidUTF8(userRole, "")
	fmt.Printf("[JoinRoom] Sanitized displayName=%q role=%q\n", req.DisplayName, userRole)

	// Check room capacity
	if h.roomManager.IsRoomFull(roomID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "room is full"})
		return
	}

	participant, err := h.roomManager.JoinRoom(roomID, userID, req.DisplayName, userRole)
	if err != nil {
		if errors.Is(err, room.ErrRoomFull) {
			c.JSON(http.StatusForbidden, gin.H{"error": "room is full"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to join room: " + err.Error()})
		}
		return
	}

	// Notify other participants
	h.signalingHub.BroadcastToRoom(roomID, &signaling.SignalingMessage{
		Type:   "participant-joined",
		RoomID: roomID,
		UserID: userID,
		Payload: map[string]interface{}{
			"participantId": participant.ID,
			"displayName":   participant.DisplayName,
			"role":          participant.Role,
		},
	})

	c.JSON(http.StatusOK, gin.H{
		"participantId": participant.ID,
		"roomId":        participant.RoomID,
		"displayName":   participant.DisplayName,
		"role":          participant.Role,
		"stun":          []string{h.config.STUNServer1, h.config.STUNServer2},
		"turn":          h.config.TURNServers,
		"turnCredentials": h.config.TURNCredentials,
	})
}

// LeaveRoom removes a participant from a room.
func (h *MeetingHandler) LeaveRoom(c *gin.Context) {
	roomID := c.Param("roomID")
	userID := getUserID(c)

	if err := h.roomManager.LeaveRoom(roomID, userID); err != nil {
		if errors.Is(err, room.ErrRoomNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		} else if errors.Is(err, room.ErrUserNotInRoom) {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not in room"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	h.signalingHub.BroadcastToRoom(roomID, &signaling.SignalingMessage{
		Type:   "participant-left",
		RoomID: roomID,
		UserID: userID,
	})

	c.JSON(http.StatusOK, gin.H{"status": "left room"})
}

// GetParticipants returns all participants in a room.
func (h *MeetingHandler) GetParticipants(c *gin.Context) {
	roomID := c.Param("roomID")

	participants, err := h.roomManager.GetParticipants(roomID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"participants": participants})
}

// UpdateParticipant updates participant state (muted, video, screen share).
func (h *MeetingHandler) UpdateParticipant(c *gin.Context) {
	roomID := c.Param("roomID")
	userID := getUserID(c)

	var req struct {
		IsMuted         *bool `json:"isMuted,omitempty"`
		IsVideoOn       *bool `json:"isVideoOn,omitempty"`
		IsScreenSharing *bool `json:"isScreenSharing,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := make(map[string]interface{})
	if req.IsMuted != nil {
		updates["is_muted"] = *req.IsMuted
	}
	if req.IsVideoOn != nil {
		updates["is_video_on"] = *req.IsVideoOn
	}
	if req.IsScreenSharing != nil {
		updates["is_screen_sharing"] = *req.IsScreenSharing
	}

 	if err := h.roomManager.UpdateParticipant(roomID, userID, updates); err != nil {
		if errors.Is(err, room.ErrUserNotInRoom) {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not in room"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	// Broadcast state change
	h.signalingHub.BroadcastToRoom(roomID, &signaling.SignalingMessage{
		Type:   "participant-updated",
		RoomID: roomID,
		UserID: userID,
		Payload: map[string]interface{}{
			"isMuted":         req.IsMuted,
			"isVideoOn":       req.IsVideoOn,
			"isScreenSharing": req.IsScreenSharing,
		},
	})

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// WebRTCSignal handles WebSocket signaling for WebRTC.
func (h *MeetingHandler) WebRTCSignal(c *gin.Context) {
	roomID := c.Param("roomID")
	userID := getUserID(c)
	userRole := getUserRole(c)

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to upgrade to websocket"})
		return
	}

	// Generate a unique connection ID
	connID := fmt.Sprintf("%s-%d", userID, time.Now().UnixNano())

	// Create signaling client
	client := &signaling.SignalingClient{
		Conn:   conn,
		RoomID: roomID,
		UserID: userID,
		ConnID: connID,
		Send:   make(chan []byte, 256),
		Hub:    h.signalingHub,
	}

	// Register client
	h.signalingHub.RegisterClient(client)

	// Handle signaling messages
	client.ReadPump(func(msg *signaling.SignalingMessage) error {
		switch msg.Type {
		case "offer", "answer", "ice-candidate":
			// Route WebRTC negotiation messages to the intended target only.
			// The client sets `target` to the remote connection id. Broadcasting
			// these to the whole room caused every participant to receive offers
			// they never initiated, which broke peer-connection negotiation and
			// let senders receive their own offers back (self-loops).
			if msg.Target != "" {
				h.signalingHub.SendToConnection(msg.Target, msg)
			} else {
				h.signalingHub.BroadcastToRoom(roomID, msg)
			}

		case "screen-share-started":
			// Only one participant may share its screen at a time per room.
			h.ssMu.Lock()
			existing, sharing := h.activeScreenSharers[roomID]
			if sharing && existing != connID {
				h.ssMu.Unlock()
				// Reject: another peer is already sharing. Tell the requester to stop.
				h.signalingHub.SendToConnection(connID, &signaling.SignalingMessage{
					Type:   "screen-share-rejected",
					RoomID: roomID,
					ConnID: connID,
					Payload: map[string]interface{}{
						"reason": "another-participant-already-sharing",
					},
				})
				return nil
			}
			h.activeScreenSharers[roomID] = connID
			h.ssMu.Unlock()

			msg.ConnID = connID
			h.signalingHub.BroadcastToRoomExcept(roomID, connID, msg)

		case "screen-share-stopped":
			h.ssMu.Lock()
			delete(h.activeScreenSharers, roomID)
			h.ssMu.Unlock()
			msg.ConnID = connID
			h.signalingHub.BroadcastToRoomExcept(roomID, connID, msg)

		case "join":
			// Participant is joining the signaling channel
			h.signalingHub.BroadcastToRoom(roomID, &signaling.SignalingMessage{
				Type:   "participant-joined",
				RoomID: roomID,
				UserID: msg.UserID,
				ConnID: connID,
				Payload: map[string]interface{}{
					"connId": connID,
					"role":   userRole,
				},
			})

		case "leave":
			// Participant is leaving the signaling channel
			h.clearScreenSharer(roomID, connID)
			h.signalingHub.BroadcastToRoom(roomID, &signaling.SignalingMessage{
				Type:   "participant-left",
				RoomID: roomID,
				UserID: msg.UserID,
				ConnID: connID,
			})
			h.signalingHub.UnregisterClient(client)

		default:
			// Forward unknown messages to room
			h.signalingHub.BroadcastToRoom(roomID, msg)
		}
		return nil
	})

	// Start write pump
	go client.WritePump()

	// Wait for connection to close
	<-client.Send

	// Cleanup: ensure any active screen share from this connection is cleared.
	h.clearScreenSharer(roomID, connID)

	// Cleanup
	h.signalingHub.UnregisterClient(client)
}

// clearScreenSharer removes a connection from the active screen-sharer registry
// (if it was the one sharing) and is safe to call when there is none.
func (h *MeetingHandler) clearScreenSharer(roomID, connID string) {
	h.ssMu.Lock()
	defer h.ssMu.Unlock()
	if existing, ok := h.activeScreenSharers[roomID]; ok && existing == connID {
		delete(h.activeScreenSharers, roomID)
	}
}

// GetStats returns meeting service statistics.
func (h *MeetingHandler) GetStats(c *gin.Context) {
	roomStats := h.roomManager.GetStats()
	sfuStats := h.sfuManager.GetGlobalStats()

	stats := map[string]interface{}{
		"rooms":     roomStats,
		"sfu":       sfuStats,
		"signaling": map[string]interface{}{
			"connectedClients": h.signalingHub.GetClientCount(),
		},
	}

	c.JSON(http.StatusOK, stats)
}

// Health returns service health status.
func (h *MeetingHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":           "healthy",
		"timestamp":        time.Now().Unix(),
		"activeRooms":      h.roomManager.GetActiveRoomsCount(),
		"maxConcurrentRooms": h.config.MaxConcurrentRooms,
	})
}

// RoomChatMessage represents a chat message in a room.
type RoomChatMessage struct {
	ID          string    `json:"id"`
	RoomID      string    `json:"roomId"`
	UserID      string    `json:"userId"`
	Content     string    `json:"content"`
	MessageType string    `json:"messageType"`
	CreatedAt   time.Time `json:"createdAt"`
}

// SendRoomChatMessage sends a chat message to a room.
func (h *MeetingHandler) SendRoomChatMessage(c *gin.Context) {
	roomID := c.Param("roomID")
	userID := getUserID(c)

	var req struct {
		Content     string `json:"content"`
		MessageType string `json:"messageType"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "content is required"})
		return
	}

	msg := &models.RoomChatMessage{
		ID:          room.GenerateID(),
		RoomID:      roomID,
		UserID:      userID,
		Content:     req.Content,
		MessageType: req.MessageType,
		CreatedAt:   time.Now(),
	}

	_, err := h.roomManager.DB().Exec(`
		INSERT INTO room_chat_messages (id, room_id, user_id, content, message_type, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, msg.ID, msg.RoomID, msg.UserID, msg.Content, msg.MessageType, msg.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save message"})
		return
	}

	// Broadcast to room
	h.signalingHub.BroadcastToRoom(roomID, &signaling.SignalingMessage{
		Type:   "chat-message",
		RoomID: roomID,
		UserID: userID,
		Payload: map[string]interface{}{
			"id":          msg.ID,
			"userId":      userID,
			"content":     msg.Content,
			"messageType": msg.MessageType,
			"createdAt":   msg.CreatedAt,
		},
	})

	c.JSON(http.StatusCreated, msg)
}

// GetRoomChatMessages retrieves chat messages for a room.
func (h *MeetingHandler) GetRoomChatMessages(c *gin.Context) {
	roomID := c.Param("roomID")
	limit := 50
	offset := 0

	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}
	if o := c.Query("offset"); o != "" {
		fmt.Sscanf(o, "%d", &offset)
	}

	rows, err := h.roomManager.DB().Query(`
		SELECT id, room_id, user_id, content, message_type, created_at
		FROM room_chat_messages
		WHERE room_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, roomID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var messages []*models.RoomChatMessage
	for rows.Next() {
		var msg models.RoomChatMessage
		err := rows.Scan(&msg.ID, &msg.RoomID, &msg.UserID, &msg.Content, &msg.MessageType, &msg.CreatedAt)
		if err != nil {
			continue
		}
		messages = append(messages, &msg)
	}

	c.JSON(http.StatusOK, gin.H{"messages": messages})
}

// getUserID safely extracts a string userID from the Gin context.
func getUserID(c *gin.Context) string {
	userID, _ := c.Get("userID")
	if userID != nil {
		if s, ok := userID.(string); ok {
			return s
		}
	}
	return ""
}

// getUserRole safely extracts a string role from the Gin context.
func getUserRole(c *gin.Context) string {
	role, _ := c.Get("role")
	if role != nil {
		if s, ok := role.(string); ok && s != "" {
			return s
		}
	}
	return "participant"
}
