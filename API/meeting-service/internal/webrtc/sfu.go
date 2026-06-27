package webrtc

import (
	"encoding/json"
	"sync"

	"vaultke-meeting-service/config"

	"github.com/pion/webrtc/v3"
)

type SFUManager struct {
	config *config.Config
	peers  map[string]*webrtc.PeerConnection
	mu     sync.RWMutex
}

func NewSFUManager(cfg *config.Config) *SFUManager {
	return &SFUManager{
		config: cfg,
		peers:  make(map[string]*webrtc.PeerConnection),
	}
}

func (s *SFUManager) CreatePeerConnection(userID string, roomID string) (*webrtc.PeerConnection, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	pc, err := createPeerConnection(s.config, roomID)
	if err != nil {
		return nil, err
	}

	s.peers[userID] = pc
	return pc, nil
}

func (s *SFUManager) HandleOffer(userID, roomID, sdp string) (string, error) {
	s.mu.RLock()
	pc, exists := s.peers[userID]
	s.mu.RUnlock()

	if !exists {
		return "", nil
	}

	offer := webrtc.SessionDescription{
		Type: webrtc.SDPTypeOffer,
		SDP:  sdp,
	}

	if err := pc.SetRemoteDescription(offer); err != nil {
		return "", err
	}

	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		return "", err
	}

	if err := pc.SetLocalDescription(answer); err != nil {
		return "", err
	}

	return answer.SDP, nil
}

func (s *SFUManager) HandleAnswer(userID, sdp string) error {
	s.mu.RLock()
	pc, exists := s.peers[userID]
	s.mu.RUnlock()

	if !exists {
		return nil
	}

	answer := webrtc.SessionDescription{
		Type: webrtc.SDPTypeAnswer,
		SDP:  sdp,
	}

	return pc.SetRemoteDescription(answer)
}

func (s *SFUManager) AddICECandidate(userID, candidate string) error {
	s.mu.RLock()
	pc, exists := s.peers[userID]
	s.mu.RUnlock()

	if !exists {
		return nil
	}

	var ice webrtc.ICECandidateInit
	if err := json.Unmarshal([]byte(candidate), &ice); err != nil {
		return err
	}

	return pc.AddICECandidate(ice)
}

func (s *SFUManager) ClosePeerConnection(userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	pc, exists := s.peers[userID]
	if !exists {
		return nil
	}

	delete(s.peers, userID)
	return pc.Close()
}

func (s *SFUManager) GetPeerConnectionStats(userID string) map[string]interface{} {
	s.mu.RLock()
	pc, exists := s.peers[userID]
	s.mu.RUnlock()

	if !exists {
		return nil
	}

	stats := pc.GetStats()
	result := make(map[string]interface{})
	for id, stat := range stats {
		result[id] = stat
	}

	return result
}

func (s *SFUManager) CloseAll() {
	s.mu.Lock()
	defer s.mu.Unlock()

	for userID, pc := range s.peers {
		pc.Close()
		delete(s.peers, userID)
	}
}

func createPeerConnection(cfg *config.Config, roomID string) (*webrtc.PeerConnection, error) {
	settingEngine := webrtc.SettingEngine{}

	iceServerList := []webrtc.ICEServer{}
	if cfg.STUNServer1 != "" {
		iceServerList = append(iceServerList, webrtc.ICEServer{
			URLs: []string{cfg.STUNServer1},
		})
	}
	if cfg.STUNServer2 != "" {
		iceServerList = append(iceServerList, webrtc.ICEServer{
			URLs: []string{cfg.STUNServer2},
		})
	}
	for _, turn := range cfg.TURNServers {
		iceServerList = append(iceServerList, webrtc.ICEServer{
			URLs: []string{turn},
		})
	}

	mediaEngine := &webrtc.MediaEngine{}
	for _, codec := range videoCodecs() {
		if err := mediaEngine.RegisterCodec(codec, webrtc.RTPCodecTypeVideo); err != nil {
			return nil, err
		}
	}
	for _, codec := range audioCodecs() {
		if err := mediaEngine.RegisterCodec(codec, webrtc.RTPCodecTypeAudio); err != nil {
			return nil, err
		}
	}

	api := webrtc.NewAPI(
		webrtc.WithMediaEngine(mediaEngine),
		webrtc.WithSettingEngine(settingEngine),
	)

	webRTCConfig := webrtc.Configuration{
		ICEServers: iceServerList,
	}

	pc, err := api.NewPeerConnection(webRTCConfig)
	if err != nil {
		return nil, err
	}

	pc.OnTrack(func(t *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
	})

	pc.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
	})

	pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
	})

	return pc, nil
}

func videoCodecs() []webrtc.RTPCodecParameters {
	return []webrtc.RTPCodecParameters{
		{RTPCodecCapability: webrtc.RTPCodecCapability{MimeType: "video/VP8", ClockRate: 90000}},
		{RTPCodecCapability: webrtc.RTPCodecCapability{MimeType: "video/VP9", ClockRate: 90000}},
		{RTPCodecCapability: webrtc.RTPCodecCapability{MimeType: "video/H264", ClockRate: 90000}},
	}
}

func audioCodecs() []webrtc.RTPCodecParameters {
	return []webrtc.RTPCodecParameters{
		{RTPCodecCapability: webrtc.RTPCodecCapability{MimeType: "audio/opus", ClockRate: 48000, Channels: 2}},
	}
}