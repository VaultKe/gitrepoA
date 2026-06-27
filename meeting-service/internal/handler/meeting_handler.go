package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"vaultke-meeting-service/config"
	"vaultke-meeting-service/internal/models"
	"vaultke-meeting-service/internal/room"
	"vaultke-meeting-service/internal/signaling"
	"vaultke-meeting-service/internal/webrtc"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type MeetingHandler struct {
	config        *config.Config
	roomManager   *room.RoomManager
	sfuManager    *webrtc.SFUManager
	signalingHub  *signaling.Hub
	upgrader      websocket.Upgrader
}

func NewMeetingHandler(cfg *config.Config, rm *room.RoomManager, sfu *webrtc.SFUManager, hub *signaling.Hub) *MeetingHandler {
	return &MeetingHandler{
		config:       cfg,
		roomManager:  rm,
		sfuManager:   sfu,
		signalingHub: hub,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
	}
}

func (h *MeetingHandler) CreateRoom(c *gin.Context) {
	userID, _ := c.Get("userID")

	var req struct {
		ChamaID          string `json:"chamaId"`
		Name             string `json:"name"`
		Type             string `json:"type"`
		MaxParticipants  int    `json:"maxParticipants,omitempty"`
		RecordingEnabled bool   `json:"recordingEnabled,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	newRoom := &models.Room{
		ChamaID:         req.ChamaID,
		Name:            req.Name,
		Type:            models.RoomType(req.Type),
		MaxParticipants:   req.MaxParticipants,
		CreatedBy:       userID.(string),
		RecordingEnabled: req.RecordingEnabled,
	}

	if err := h.roomManager.CreateRoom(newRoom); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create room"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"roomId":   newRoom.ID,
		"turn":     h.config.TURNServers,
		"stun":     []string{h.config.STUNServer1, h.config.STUNServer2},
		"maxParticipants": h.config.MaxRoomCapacity,
	})
}

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

func (h *MeetingHandler) EndRoom(c *gin.Context) {
	roomID := c.Param("roomID")

	if err := h.roomManager.EndRoom(roomID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to end room"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "room ended"})
}

func (h *MeetingHandler) JoinRoom(c *gin.Context) {
	roomID := c.Param("roomID")
	userID, _ := c.Get("userID")

	var req struct {
		DisplayName string `json:"displayName"`
		Role        string `json:"role"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	participant, err := h.roomManager.JoinRoom(roomID, userID.(string), req.DisplayName, req.Role)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"participantId": participant.ID,
		"roomId":        participant.RoomID,
	})
}

func (h *MeetingHandler) LeaveRoom(c *gin.Context) {
	roomID := c.Param("roomID")
	userID, _ := c.Get("userID")

	if err := h.roomManager.LeaveRoom(roomID, userID.(string)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "left room"})
}

func (h *MeetingHandler) GetParticipants(c *gin.Context) {
	roomID := c.Param("roomID")

	participants, err := h.roomManager.GetParticipants(roomID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get participants"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"participants": participants,
	})
}

func (h *MeetingHandler) UpdateParticipant(c *gin.Context) {
	roomID := c.Param("roomID")
	userID, _ := c.Get("userID")

	var req struct {
		IsMuted        *bool `json:"isMuted,omitempty"`
		IsVideoOn      *bool `json:"isVideoOn,omitempty"`
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

	if err := h.roomManager.UpdateParticipant(roomID, userID.(string), updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update participant"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func (h *MeetingHandler) WebRTCSignal(c *gin.Context) {
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to upgrade to websocket"})
		return
	}
	defer conn.Close()

	var msg signaling.Message
	if err := conn.ReadJSON(&msg); err != nil {
		return
	}

	switch msg.Type {
	case "offer":
		userID, _ := c.Get("userID")
		answer, err := h.sfuManager.HandleOffer(userID.(string), msg.RoomID, string(msg.Payload))
		if err != nil {
			conn.WriteJSON(signaling.Message{Type: "error", Payload: json.RawMessage(`{"error":"offer failed"}`)})
			return
		}
		conn.WriteJSON(signaling.Message{Type: "answer", Payload: json.RawMessage(`"` + answer + `"`)})

	case "answer":
		userID, _ := c.Get("userID")
		h.sfuManager.HandleAnswer(userID.(string), string(msg.Payload))

	case "ice-candidate":
		userID, _ := c.Get("userID")
		h.sfuManager.AddICECandidate(userID.(string), string(msg.Payload))
	}
}

func (h *MeetingHandler) GetStats(c *gin.Context) {
	stats := h.roomManager.GetStats()
	c.JSON(http.StatusOK, stats)
}

func (h *MeetingHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":           "healthy",
		"timestamp":        time.Now().Unix(),
		"activeRooms":      h.roomManager.GetActiveRoomsCount(),
		"maxConcurrentRooms": h.config.MaxConcurrentRooms,
	})
}