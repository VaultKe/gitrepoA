package webrtc

import (
	"encoding/json"

	"vaultke-meeting-service/config"

	"github.com/pion/webrtc/v3"
)

type Peer struct {
	pc     *webrtc.PeerConnection
	userID string
	roomID string
}

func NewPeer(userID, roomID string, cfg *config.Config) (*Peer, error) {
	pc, err := createPeerConnection(cfg, roomID)
	if err != nil {
		return nil, err
	}

	return &Peer{
		pc:     pc,
		userID: userID,
		roomID: roomID,
	}, nil
}

func (p *Peer) CreateDataChannel(label string) (*webrtc.DataChannel, error) {
	return p.pc.CreateDataChannel(label, nil)
}

func (p *Peer) AddTransceiverFromKind(kind webrtc.RTPCodecType) error {
	_, err := p.pc.AddTransceiverFromKind(kind)
	return err
}

func (p *Peer) SetLocalDescription(sdp webrtc.SessionDescription) error {
	return p.pc.SetLocalDescription(sdp)
}

func (p *Peer) SetRemoteDescription(sdp webrtc.SessionDescription) error {
	return p.pc.SetRemoteDescription(sdp)
}

func (p *Peer) AddICECandidate(candidate webrtc.ICECandidateInit) error {
	return p.pc.AddICECandidate(candidate)
}

func (p *Peer) GetStats() map[string]interface{} {
	stats := p.pc.GetStats()
	result := make(map[string]interface{})
	for id, stat := range stats {
		result[id] = stat
	}
	return result
}

func (p *Peer) Close() error {
	return p.pc.Close()
}

func (p *Peer) GetPeerConnection() *webrtc.PeerConnection {
	return p.pc
}

func ParseICECandidate(data string) (webrtc.ICECandidateInit, error) {
	var ice webrtc.ICECandidateInit
	if err := json.Unmarshal([]byte(data), &ice); err != nil {
		return webrtc.ICECandidateInit{}, err
	}
	return ice, nil
}