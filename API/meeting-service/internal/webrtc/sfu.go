package webrtc

import (
	"fmt"
	"sync"
	"time"

	"vaultke-meeting-service/config"

	"github.com/pion/webrtc/v3"
)

// SFUManager manages WebRTC PeerConnections for all participants in a room.
// It acts as a Selective Forwarding Unit: each participant sends one upstream
// PC, and the server forwards selected tracks to every other participant.
type SFUManager struct {
	config *config.Config

	// rooms maps roomID -> room state
	rooms map[string]*RoomState

	// participantConnections maps connectionID -> participant state
	participantConnections map[string]*ParticipantConnection

	mu sync.RWMutex
}

// RoomState holds all SFU state for one meeting room.
type RoomState struct {
	RoomID       string
	Participants map[string]*ParticipantConnection // keyed by participantID
	TrackRoutes  map[string]*TrackRoute           // trackID -> route
	mu           sync.RWMutex
	createdAt    time.Time
}

// ParticipantConnection holds the PeerConnection and track info for one participant.
type ParticipantConnection struct {
	ParticipantID     string
	RoomID            string
	UserID            string
	ConnectionID      string
	PeerConnection    *webrtc.PeerConnection
	InboundTracks     map[string]*webrtc.TrackRemote // trackID -> track
	OutboundTracks    map[string]*webrtc.TrackLocalStaticRTP // trackID -> track
	mu                sync.RWMutex
	createdAt         time.Time
	lastActivity      time.Time
}

// TrackRoute describes where a track is forwarded.
type TrackRoute struct {
	TrackID    string
	FromConnID string
	ToConnIDs  map[string]bool // connectionID -> true
	TrackKind  webrtc.RTPCodecType
}

// NewSFUManager creates a new SFU manager.
func NewSFUManager(cfg *config.Config) *SFUManager {
	return &SFUManager{
		config:                cfg,
		rooms:                 make(map[string]*RoomState),
		participantConnections: make(map[string]*ParticipantConnection),
	}
}

// CreatePeerConnection creates a new PeerConnection for a participant joining a room.
func (s *SFUManager) CreatePeerConnection(roomID, participantID, userID, connectionID string) (*webrtc.PeerConnection, error) {
	s.mu.Lock()
	room, exists := s.rooms[roomID]
	if !exists {
		room = &RoomState{
			RoomID:       roomID,
			Participants: make(map[string]*ParticipantConnection),
			TrackRoutes:  make(map[string]*TrackRoute),
			createdAt:    time.Now(),
		}
		s.rooms[roomID] = room
	}
	s.mu.Unlock()

	// Build ICE servers
	iceServers := []webrtc.ICEServer{}
	if s.config.STUNServer1 != "" {
		iceServers = append(iceServers, webrtc.ICEServer{URLs: []string{s.config.STUNServer1}})
	}
	if s.config.STUNServer2 != "" {
		iceServers = append(iceServers, webrtc.ICEServer{URLs: []string{s.config.STUNServer2}})
	}
	for _, turn := range s.config.TURNServers {
		iceServers = append(iceServers, webrtc.ICEServer{URLs: []string{turn}})
	}

	// Media engine with preferred codecs
	mediaEngine := &webrtc.MediaEngine{}
	for _, codec := range videoCodecs() {
		if err := mediaEngine.RegisterCodec(codec, webrtc.RTPCodecTypeVideo); err != nil {
			return nil, fmt.Errorf("failed to register video codec: %w", err)
		}
	}
	for _, codec := range audioCodecs() {
		if err := mediaEngine.RegisterCodec(codec, webrtc.RTPCodecTypeAudio); err != nil {
			return nil, fmt.Errorf("failed to register audio codec: %w", err)
		}
	}

	api := webrtc.NewAPI(webrtc.WithMediaEngine(mediaEngine))

	pc, err := api.NewPeerConnection(webrtc.Configuration{
		ICEServers: iceServers,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create peer connection: %w", err)
	}

	// Track incoming remote tracks from this participant
	pc.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		s.handleRemoteTrack(roomID, participantID, connectionID, track, receiver)
	})

	// Monitor ICE connection state
	pc.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		s.handleICEStateChange(roomID, participantID, connectionID, state)
	})

	// Monitor connection state
	pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		s.handleConnectionStateChange(roomID, participantID, connectionID, state)
	})

	// Register the participant in room state
	participantConn := &ParticipantConnection{
		ParticipantID:     participantID,
		RoomID:            roomID,
		UserID:            userID,
		ConnectionID:      connectionID,
		PeerConnection:    pc,
		InboundTracks:     make(map[string]*webrtc.TrackRemote),
		OutboundTracks:    make(map[string]*webrtc.TrackLocalStaticRTP),
		createdAt:         time.Now(),
		lastActivity:      time.Now(),
	}

	room.mu.Lock()
	room.Participants[participantID] = participantConn
	room.mu.Unlock()

	s.mu.Lock()
	s.participantConnections[connectionID] = participantConn
	s.mu.Unlock()

	return pc, nil
}

// handleRemoteTrack is called when a remote track is received from a participant.
// It stores the track and creates a route for forwarding to other participants.
func (s *SFUManager) handleRemoteTrack(roomID, participantID, connectionID string, track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
	s.mu.RLock()
	room, roomExists := s.rooms[roomID]
	s.mu.RUnlock()

	if !roomExists {
		return
	}

	trackID := track.ID()
	kind := track.Kind()

	// Store the inbound track
	room.mu.Lock()
	participantConn, exists := room.Participants[participantID]
	if !exists {
		room.mu.Unlock()
		return
	}
	participantConn.InboundTracks[trackID] = track
	participantConn.lastActivity = time.Now()

	// Create a route for this track
	route := &TrackRoute{
		TrackID:    trackID,
		FromConnID: connectionID,
		ToConnIDs:  make(map[string]bool),
		TrackKind:  kind,
	}
	room.TrackRoutes[trackID] = route
	room.mu.Unlock()

	// Create outbound tracks for all other participants in the room
	s.mu.RLock()
	room2, _ := s.rooms[roomID]
	s.mu.RUnlock()

	if room2 != nil {
		room2.mu.RLock()
		for pid, pc := range room2.Participants {
			if pid == participantID {
				continue // don't send back to sender
			}
			s.addOutboundTrack(roomID, pid, track, kind)
			route.ToConnIDs[pc.ConnectionID] = true
		}
		room2.mu.RUnlock()
	}
}

// addOutboundTrack adds a track to a participant's PeerConnection for forwarding.
func (s *SFUManager) addOutboundTrack(roomID, targetParticipantID string, sourceTrack *webrtc.TrackRemote, kind webrtc.RTPCodecType) {
	s.mu.RLock()
	room, roomExists := s.rooms[roomID]
	s.mu.RUnlock()

	if !roomExists {
		return
	}

	room.mu.RLock()
	targetConn, exists := room.Participants[targetParticipantID]
	room.mu.RUnlock()

	if !exists || targetConn.PeerConnection == nil {
		return
	}

	// Check if we already added this track
	trackID := sourceTrack.ID()
	if _, exists := targetConn.OutboundTracks[trackID]; exists {
		return
	}

	// Create a local RTP track to forward the remote track
	outboundTrack, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: sourceTrack.Codec().MimeType},
		sourceTrack.ID(),
		sourceTrack.StreamID(),
	)
	if err != nil {
		return
	}

	// Add the track to the target's PeerConnection
	_, err = targetConn.PeerConnection.AddTrack(outboundTrack)
	if err != nil {
		return
	}

	// Start reading and forwarding RTP packets
	go s.forwardTrack(sourceTrack, outboundTrack)

	targetConn.mu.Lock()
	targetConn.OutboundTracks[trackID] = outboundTrack
	targetConn.mu.Unlock()
}

// forwardTrack reads RTP packets from a source track and writes them to a destination track.
func (s *SFUManager) forwardTrack(source *webrtc.TrackRemote, dest *webrtc.TrackLocalStaticRTP) {
	buf := make([]byte, 1500)
	for {
		pkt, _, err := source.ReadRTP()
		if err != nil {
			return
		}
		if writeErr := dest.WriteRTP(pkt); writeErr != nil {
			return
		}
		_ = buf // keep buffer alive for reuse
	}
}

// handleICEStateChange handles ICE connection state changes.
func (s *SFUManager) handleICEStateChange(roomID, participantID, connectionID string, state webrtc.ICEConnectionState) {
	s.mu.RLock()
	conn, exists := s.participantConnections[connectionID]
	s.mu.RUnlock()

	if exists {
		conn.mu.Lock()
		conn.lastActivity = time.Now()
		conn.mu.Unlock()
	}

	// If ICE fails, clean up
	if state == webrtc.ICEConnectionStateFailed ||
		state == webrtc.ICEConnectionStateDisconnected {
		// Could trigger cleanup here
	}
}

// handleConnectionStateChange handles overall connection state changes.
func (s *SFUManager) handleConnectionStateChange(roomID, participantID, connectionID string, state webrtc.PeerConnectionState) {
	if state == webrtc.PeerConnectionStateFailed ||
		state == webrtc.PeerConnectionStateClosed ||
		state == webrtc.PeerConnectionStateDisconnected {
		s.RemoveParticipant(roomID, participantID, connectionID)
	}
}

// RemoveParticipant removes a participant from the SFU and closes their PeerConnection.
func (s *SFUManager) RemoveParticipant(roomID, participantID, connectionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Remove from room state
	if room, exists := s.rooms[roomID]; exists {
		room.mu.Lock()
		if pc, ok := room.Participants[participantID]; ok {
			if pc.PeerConnection != nil {
				_ = pc.PeerConnection.Close()
			}
			delete(room.Participants, participantID)

			// Remove track routes for this participant
			for trackID, route := range room.TrackRoutes {
				if route.FromConnID == connectionID {
					delete(room.TrackRoutes, trackID)
				}
			}

			// Remove outbound tracks referencing this participant
			for _, otherPC := range room.Participants {
				for trackID := range otherPC.OutboundTracks {
					if track, ok := otherPC.InboundTracks[trackID]; ok {
						if track.ID() == trackID {
							delete(otherPC.OutboundTracks, trackID)
							break
						}
					}
				}
			}
		}
		room.mu.Unlock()

		// Clean up empty rooms
		if len(room.Participants) == 0 {
			delete(s.rooms, roomID)
		}
	}

	// Remove from global connection map
	delete(s.participantConnections, connectionID)
}

// GetRoomStats returns statistics for a room.
func (s *SFUManager) GetRoomStats(roomID string) map[string]interface{} {
	s.mu.RLock()
	room, exists := s.rooms[roomID]
	s.mu.RUnlock()

	if !exists {
		return map[string]interface{}{"error": "room not found"}
	}

	room.mu.RLock()
	defer room.mu.RUnlock()

	stats := map[string]interface{}{
		"roomId":      roomID,
		"participants": len(room.Participants),
		"trackRoutes":  len(room.TrackRoutes),
	}

	for pid, pc := range room.Participants {
		pc.mu.RLock()
		stats[pid] = map[string]interface{}{
			"userId":         pc.UserID,
			"connectionId":   pc.ConnectionID,
			"inboundTracks":  len(pc.InboundTracks),
			"outboundTracks": len(pc.OutboundTracks),
			"lastActivity":   pc.lastActivity.Unix(),
			"state":          pc.PeerConnection.ConnectionState().String(),
		}
		pc.mu.RUnlock()
	}

	return stats
}

// GetGlobalStats returns overall SFU statistics.
func (s *SFUManager) GetGlobalStats() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	totalParticipants := 0
	for _, room := range s.rooms {
		room.mu.RLock()
		totalParticipants += len(room.Participants)
		room.mu.RUnlock()
	}

	return map[string]interface{}{
		"activeRooms":      len(s.rooms),
		"totalParticipants": totalParticipants,
		"totalConnections": len(s.participantConnections),
	}
}

// CloseAll closes all PeerConnections and cleans up state.
func (s *SFUManager) CloseAll() {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, room := range s.rooms {
		room.mu.Lock()
		for _, pc := range room.Participants {
			if pc.PeerConnection != nil {
				_ = pc.PeerConnection.Close()
			}
		}
		room.mu.Unlock()
	}

	s.rooms = make(map[string]*RoomState)
	s.participantConnections = make(map[string]*ParticipantConnection)
}

// videoCodecs returns the list of supported video codecs.
func videoCodecs() []webrtc.RTPCodecParameters {
	return []webrtc.RTPCodecParameters{
		{RTPCodecCapability: webrtc.RTPCodecCapability{MimeType: "video/VP8", ClockRate: 90000}},
		{RTPCodecCapability: webrtc.RTPCodecCapability{MimeType: "video/VP9", ClockRate: 90000}},
		{RTPCodecCapability: webrtc.RTPCodecCapability{MimeType: "video/H264", ClockRate: 90000}},
	}
}

// audioCodecs returns the list of supported audio codecs.
func audioCodecs() []webrtc.RTPCodecParameters {
	return []webrtc.RTPCodecParameters{
		{RTPCodecCapability: webrtc.RTPCodecCapability{MimeType: "audio/opus", ClockRate: 48000, Channels: 2}},
		{RTPCodecCapability: webrtc.RTPCodecCapability{MimeType: "audio/PCMU", ClockRate: 8000, Channels: 1}},
		{RTPCodecCapability: webrtc.RTPCodecCapability{MimeType: "audio/PCMA", ClockRate: 8000, Channels: 1}},
	}
}
