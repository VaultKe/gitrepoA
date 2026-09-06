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
	config       *config.Config
	roomManager  *room.RoomManager
	sfuManager   *webrtc.SFUManager
	signalingHub *signaling.SignalingHub
	upgrader     websocket.Upgrader
	// activeScreenSharers tracks which connection id is currently sharing its
	// screen per room. This prevents two participants from sharing at once.
	activeScreenSharers map[string]string // roomID -> connID
	ssMu                sync.Mutex
}

// NewMeetingHandler creates a new meeting handler.
func NewMeetingHandler(cfg *config.Config, rm *room.RoomManager, sfu *webrtc.SFUManager, hub *signaling.SignalingHub) *MeetingHandler {
	h := &MeetingHandler{
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

	// Set up callback for when clients are removed from the hub.
	// This ensures participant-left events are broadcast even when clients
	// disconnect unexpectedly (browser close, network loss, etc.)
	hub.SetOnClientRemoved(func(info signaling.ClientRemovedInfo) {
		// Only broadcast participant-left for clients that were properly joined
		// (have a userID and connID). Clients that disconnected before sending
		// a join message don't need a leave notification.
		if info.ConnID == "" || info.UserID == "" {
			return
		}

		// Mark the participant as left in the room manager too. Without this,
		// an unclean disconnect (app killed, network drop, tab closed) only
		// ever reached currently-connected sockets via the broadcast below —
		// the roster REST endpoint and the polling loop read straight from
		// roomManager, so a ghost participant who never sent an explicit
		// "leave" stayed listed as present indefinitely, showing up as
		// "already joined" to anyone who opened the meeting afterwards.
		//
		// Skip it if the same user already has another live connection in the
		// room (a reconnect can register the new socket before this stale one
		// times out via the ping deadline) — otherwise a brief network blip
		// would wrongly drop a still-present participant.
		stillConnected := false
		for other := range h.signalingHub.GetRoomClients(info.RoomID) {
			if other.UserID == info.UserID {
				stillConnected = true
				break
			}
		}
		if !stillConnected {
			roomEnded, err := h.roomManager.LeaveRoom(info.RoomID, info.UserID)
			if err != nil {
				fmt.Printf("[Signal] LeaveRoom on disconnect failed | roomID=%s userID=%s err=%v\n",
					info.RoomID, info.UserID, err)
			} else if roomEnded {
				h.handleRoomEmptiedByLeave(info.RoomID)
			}
		}

		// Broadcast participant-left to the room
		h.signalingHub.BroadcastToRoom(info.RoomID, &signaling.SignalingMessage{
			Type:        "participant-left",
			RoomID:      info.RoomID,
			UserID:      info.UserID,
			ConnID:      info.ConnID,
			DisplayName: info.DisplayName,
		})

		// Clean up screen sharing if this client was sharing, and tell the room
		// so nobody is left staring at a dead screen tile.
		if h.clearScreenSharer(info.RoomID, info.ConnID) {
			h.signalingHub.BroadcastToRoom(info.RoomID, &signaling.SignalingMessage{
				Type:        "screen-share-stopped",
				RoomID:      info.RoomID,
				UserID:      info.UserID,
				ConnID:      info.ConnID,
				DisplayName: info.DisplayName,
			})
		}

		fmt.Printf("[Signal] Client removed | roomID=%s userID=%s connID=%s reason=%d\n",
			info.RoomID, info.UserID, info.ConnID, info.Reason)
	})

	return h
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
		MaxParticipants:  req.MaxParticipants,
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

	if err := h.endRoomAndNotify(roomID, "The room has been ended by the host"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "room ended"})
}

// endRoomAndNotify tears a room down and tells everyone still in it why, in
// one place -- shared by the explicit "end meeting" endpoint, the "another
// meeting started for this chama" takeover in JoinRoom, and ExpireOverdueRooms
// below, which used to each carry their own copy of this pair of calls.
func (h *MeetingHandler) endRoomAndNotify(roomID, message string) error {
	if err := h.roomManager.EndRoom(roomID); err != nil {
		return err
	}

	h.signalingHub.BroadcastToRoom(roomID, &signaling.SignalingMessage{
		Type:   "room-ended",
		RoomID: roomID,
		Payload: map[string]interface{}{
			"message": message,
		},
	})

	return nil
}

// handleRoomEmptiedByLeave does the handler-level cleanup for a room that
// RoomManager.LeaveRoom already ended because that leave was its last
// participant. RoomManager can't do this part itself: activeScreenSharers
// lives here, not in RoomManager, and a stale entry in it (the room's last
// screen-sharer, never cleared) would otherwise wrongly block or misreport
// screen sharing the next time this same room id is used. No broadcast is
// needed -- by definition nobody is left connected to tell.
func (h *MeetingHandler) handleRoomEmptiedByLeave(roomID string) {
	h.clearScreenSharerForRoom(roomID)
	fmt.Printf("[Meeting] roomID=%s | ended (last participant left)\n", roomID)
}

// WarnRoomsNearingEnd tells everyone currently in a room that it's about to
// end. BroadcastToRoom only reaches clients actually connected to that
// room's signaling channel -- i.e. exactly the people in that online
// meeting right now -- so this never needs its own audience filtering.
// Purely informational: it doesn't touch the room's schedule, so the room
// still ends at the exact time ExpireOverdueRooms was already going to end
// it regardless of whether anyone saw or dismissed the notice.
func (h *MeetingHandler) WarnRoomsNearingEnd() {
	for _, roomID := range h.roomManager.TakeRoomsNearingEnd() {
		h.signalingHub.BroadcastToRoom(roomID, &signaling.SignalingMessage{
			Type:   "meeting-ending-soon",
			RoomID: roomID,
			Payload: map[string]interface{}{
				"message":          "This meeting will end in about 2 minutes.",
				"secondsRemaining": int(room.EndingSoonWarnWindow.Seconds()),
			},
		})
		fmt.Printf("[Expiry] roomID=%s | warned (ending soon)\n", roomID)
	}
}

// ExpireOverdueRooms ends every room whose scheduled duration has elapsed.
// Called on a ticker from main.go rather than a per-request check, since a
// room with nobody actively hitting an endpoint right now would otherwise
// never get checked at all -- resource usage (SFU sessions, peer
// connections, any recording) needs to stop on a timer of its own, not on
// the next participant action.
func (h *MeetingHandler) ExpireOverdueRooms() {
	for _, roomID := range h.roomManager.GetExpiredActiveRoomIDs() {
		h.clearScreenSharerForRoom(roomID)
		if err := h.endRoomAndNotify(roomID, "This meeting reached its scheduled time limit and has ended."); err != nil {
			fmt.Printf("[Expiry] failed to end overdue room %s: %v\n", roomID, err)
		} else {
			fmt.Printf("[Expiry] roomID=%s | ended (scheduled duration elapsed)\n", roomID)
		}
	}
}

// JoinRoom adds a participant to a room.
func (h *MeetingHandler) JoinRoom(c *gin.Context) {
	roomID := c.Param("roomID")
	userID := getUserID(c)
	userRole := getUserRole(c)

	var req struct {
		DisplayName     string `json:"displayName"`
		Role            string `json:"role"`
		UserID          string `json:"userId"` // Allow passing userId for debug/unauthenticated joins
		ChamaID         string `json:"chamaId"`
		// The scheduled meeting's duration in minutes, as the client
		// understands it. Only takes effect the first time this room becomes
		// live and is always clamped server-side (see clampRoomDuration) --
		// a client cannot make a room outlive maxRoomDurationMinutes just by
		// sending a bigger number.
		DurationMinutes int `json:"durationMinutes"`
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

	// One chama runs one online meeting at a time. Rather than refuse the
	// meeting the user just chose, close the one that is still running and let
	// them through: the person opting into this meeting is the clearest signal
	// of which one should be live, and the stale room is usually one everybody
	// has already walked away from. Everyone still in it is told it ended, so
	// nobody is left sitting in a room that no longer exists.
	// Only applies when the caller told us its chama -- without one there is
	// nothing to compare against, so joins are never disrupted by a missing
	// chamaId.
	if blockingRoomID, busy := h.roomManager.ActiveOnlineMeetingForChama(req.ChamaID, roomID); busy {
		fmt.Printf("[JoinRoom] chamaID=%s roomID=%s | ending previous live meeting %s\n", req.ChamaID, roomID, blockingRoomID)

		h.clearScreenSharerForRoom(blockingRoomID)
		if err := h.endRoomAndNotify(blockingRoomID, "This meeting was ended because another online meeting started for this chama."); err != nil {
			fmt.Printf("[JoinRoom] failed to end previous meeting %s: %v\n", blockingRoomID, err)
		}
	}

	participant, err := h.roomManager.JoinRoom(roomID, userID, req.DisplayName, userRole, req.ChamaID, req.DurationMinutes)
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
		"participantId":   participant.ID,
		"roomId":          participant.RoomID,
		"displayName":     participant.DisplayName,
		"role":            participant.Role,
		"stun":            []string{h.config.STUNServer1, h.config.STUNServer2},
		"turn":            h.config.TURNServers,
		"turnCredentials": h.config.TURNCredentials,
	})
}

// LeaveRoom removes a participant from a room.
func (h *MeetingHandler) LeaveRoom(c *gin.Context) {
	roomID := c.Param("roomID")
	userID := getUserID(c)

	roomEnded, err := h.roomManager.LeaveRoom(roomID, userID)
	if err != nil {
		if errors.Is(err, room.ErrRoomNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		} else if errors.Is(err, room.ErrUserNotInRoom) {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not in room"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	if roomEnded {
		h.handleRoomEmptiedByLeave(roomID)
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

	fmt.Printf("[Signal] WebSocket connected | roomID=%s userID=%s origin=%s\n", roomID, userID, c.Request.Header.Get("Origin"))

	// Generate a unique connection ID
	connID := fmt.Sprintf("%s-%d", userID, time.Now().UnixNano())

	// Create signaling client
	client := signaling.NewSignalingClient(conn, roomID, userID, connID, h.signalingHub)

	// Register client
	h.signalingHub.RegisterClient(client)

	// Start the write pump before the (blocking) read loop below, so
	// outgoing messages queued on client.Send -- pings, broadcasts, relayed
	// offers/answers/ICE candidates -- are actually drained for the whole
	// lifetime of the connection. Starting it after ReadPump (which only
	// returns once the connection is already dead) left nothing consuming
	// client.Send while the connection was alive: pings never went out, nothing
	// reached the client, and once the 256-message buffer filled up (trickle
	// ICE alone can do that in seconds) the hub force-closed the raw
	// connection, which is what surfaced client-side as a repeating
	// WebSocket code-1006 disconnect/reconnect loop.
	go client.WritePump()

	// Handle signaling messages. This blocks until the connection closes.
	client.ReadPump(func(msg *signaling.SignalingMessage) error {
		switch msg.Type {
		case "offer", "answer", "ice-candidate", "screen-share-ack":
			// Route WebRTC negotiation messages, and the screen-share viewer
			// ack, to the intended target only. The client sets `target` to the
			// remote connection id. Broadcasting these to the whole room caused
			// every participant to receive offers they never initiated, which
			// broke peer-connection negotiation and let senders receive their
			// own offers back (self-loops).
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
				fmt.Printf("[Signal] screen-share-started | roomID=%s connID=%s | REJECTED (already sharing: %s)\n", roomID, connID, existing)
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

			// Stamp the sharer's identity onto the broadcast. Clients match the
			// incoming flag against their own participant tiles, and a tile can
			// only be resolved by connId *or* userId, so both must be present.
			msg.ConnID = connID
			msg.UserID = firstNonEmpty(client.UserID, userID, msg.UserID)
			msg.DisplayName = firstNonEmpty(client.DisplayName, msg.DisplayName)
			fmt.Printf("[Signal] screen-share-started | roomID=%s connID=%s userID=%s | broadcasting to room\n", roomID, connID, msg.UserID)
			h.signalingHub.BroadcastToRoomExcept(roomID, connID, msg)

		case "screen-share-stopped":
			// Only the active sharer may release the slot; a stale "stopped"
			// from another peer must not free it for everyone else.
			h.clearScreenSharer(roomID, connID)
			msg.ConnID = connID
			msg.UserID = firstNonEmpty(client.UserID, userID, msg.UserID)
			msg.DisplayName = firstNonEmpty(client.DisplayName, msg.DisplayName)
			fmt.Printf("[Signal] screen-share-stopped | roomID=%s connID=%s userID=%s | broadcasting to room\n", roomID, connID, msg.UserID)
			h.signalingHub.BroadcastToRoomExcept(roomID, connID, msg)

		case "speaking-state":
			msg.ConnID = connID
			msg.UserID = firstNonEmpty(client.UserID, userID, msg.UserID)
			h.signalingHub.BroadcastToRoomExcept(roomID, connID, msg)

		case "join":
			// Participant is joining the signaling channel.
			client.DisplayName = msg.DisplayName
			client.Role = userRole
			client.UserID = msg.UserID
			client.ConnID = connID

			participantID := ""
			// The websocket join carries no chamaId; the REST join that
			// precedes it already recorded one, so pass empty to leave it be.
			// Duration is 0 here (unknown at this layer) -- harmless, since by
			// this point the REST join above has already created the room and
			// set its schedule; JoinRoom only ever uses the duration argument
			// the first time a room becomes live.
			participant, err := h.roomManager.JoinRoom(roomID, msg.UserID, msg.DisplayName, userRole, "", 0)
			if err != nil {
				fmt.Printf("[Signal] join | roomID=%s userID=%s | RoomManager join failed: %v\n", roomID, msg.UserID, err)
			} else {
				participantID = participant.ID
				fmt.Printf("[Signal] join | roomID=%s userID=%s | RoomManager participantId=%s\n", roomID, msg.UserID, participantID)
			}

			h.signalingHub.BroadcastToRoom(roomID, &signaling.SignalingMessage{
				Type:        "participant-joined",
				RoomID:      roomID,
				UserID:      msg.UserID,
				ConnID:      connID,
				DisplayName: msg.DisplayName,
				Payload: map[string]interface{}{
					"connId":        connID,
					"userId":        msg.UserID,
					"role":          userRole,
					"participantId": participantID,
				},
			})

			// Send the existing room members to the new joiner so they can open
			// peer connections immediately instead of waiting for a delayed sync.
			existing := h.signalingHub.GetRoomClients(roomID)
			fmt.Printf("[Signal] join | roomID=%s userID=%s connID=%s | clientsInRoom=%d\n", roomID, msg.UserID, connID, h.signalingHub.GetRoomClientCount(roomID))
			sharerConnID, someoneSharing := h.activeScreenSharer(roomID)
			for other := range existing {
				if other.ConnID == connID {
					continue
				}
				h.signalingHub.SendToConnection(connID, &signaling.SignalingMessage{
					Type:        "participant-joined",
					RoomID:      roomID,
					UserID:      other.UserID,
					ConnID:      other.ConnID,
					DisplayName: other.DisplayName,
					Payload: map[string]interface{}{
						"connId": other.ConnID,
						"userId": other.UserID,
						"role":   other.Role,
					},
				})

				if someoneSharing && other.ConnID == sharerConnID {
					fmt.Printf("[Signal] join | roomID=%s connID=%s | replaying screen-share-started from %s\n", roomID, connID, sharerConnID)
					h.signalingHub.SendToConnection(connID, &signaling.SignalingMessage{
						Type:        "screen-share-started",
						RoomID:      roomID,
						UserID:      other.UserID,
						ConnID:      other.ConnID,
						DisplayName: other.DisplayName,
					})
				}
			}

		case "leave":
			// Participant is leaving the signaling channel
			h.clearScreenSharer(roomID, connID)

			// Sync with RoomManager to ensure consistent participant tracking
			roomEnded, err := h.roomManager.LeaveRoom(roomID, msg.UserID)
			if err != nil {
				fmt.Printf("[Signal] leave | roomID=%s userID=%s | RoomManager leave failed: %v\n", roomID, msg.UserID, err)
			} else if roomEnded {
				h.handleRoomEmptiedByLeave(roomID)
			}

			h.signalingHub.BroadcastToRoom(roomID, &signaling.SignalingMessage{
				Type:        "participant-left",
				RoomID:      roomID,
				UserID:      msg.UserID,
				ConnID:      connID,
				DisplayName: firstNonEmpty(client.DisplayName, msg.DisplayName),
			})
			h.signalingHub.UnregisterClient(client)

		default:
			// Forward unknown messages to room
			h.signalingHub.BroadcastToRoom(roomID, msg)
		}
		return nil
	})

	h.clearScreenSharer(roomID, connID)
	h.signalingHub.UnregisterClient(client)
}

// clearScreenSharer removes a connection from the active screen-sharer registry
// (if it was the one sharing) and is safe to call when there is none. It
// reports whether the connection was in fact the active sharer.
func (h *MeetingHandler) clearScreenSharer(roomID, connID string) bool {
	h.ssMu.Lock()
	defer h.ssMu.Unlock()
	if existing, ok := h.activeScreenSharers[roomID]; ok && existing == connID {
		delete(h.activeScreenSharers, roomID)
		return true
	}
	return false
}

// clearScreenSharerForRoom drops a room's screen-share registration outright,
// whoever held it. Used when a room is ended on everyone's behalf.
func (h *MeetingHandler) clearScreenSharerForRoom(roomID string) {
	h.ssMu.Lock()
	defer h.ssMu.Unlock()
	delete(h.activeScreenSharers, roomID)
}

// activeScreenSharer returns the connection id currently sharing in a room.
func (h *MeetingHandler) activeScreenSharer(roomID string) (string, bool) {
	h.ssMu.Lock()
	defer h.ssMu.Unlock()
	connID, ok := h.activeScreenSharers[roomID]
	return connID, ok
}

// firstNonEmpty returns the first non-empty string of the given values.
func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

// GetStats returns meeting service statistics.
func (h *MeetingHandler) GetStats(c *gin.Context) {
	roomStats := h.roomManager.GetStats()
	sfuStats := h.sfuManager.GetGlobalStats()

	stats := map[string]interface{}{
		"rooms": roomStats,
		"sfu":   sfuStats,
		"signaling": map[string]interface{}{
			"connectedClients": h.signalingHub.GetClientCount(),
		},
	}

	c.JSON(http.StatusOK, stats)
}

// Health returns service health status.
func (h *MeetingHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":             "healthy",
		"timestamp":          time.Now().Unix(),
		"activeRooms":        h.roomManager.GetActiveRoomsCount(),
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
// GetRoomAttendance returns everyone who joined this room, so a finished
// meeting can show its own attendance record.
func (h *MeetingHandler) GetRoomAttendance(c *gin.Context) {
	roomID := c.Param("roomID")

	attendees, err := h.roomManager.GetAttendance(roomID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"attendees": attendees})
}

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
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
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
