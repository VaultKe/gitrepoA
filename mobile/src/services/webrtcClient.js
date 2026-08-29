import { Platform } from 'react-native';
import { getMeetingWsUrl } from '../services/meetingConfig';
import { getMeetingAuthToken } from '../services/meetingApi';

// WebRTC configuration for the meeting client
export const WEBRTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceTransportPolicy: 'all',
  iceCandidatePoolSize: 2,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

export const MEDIA_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 2,
  },
  video: {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 60 },
    facingMode: 'user',
  },
};

export const SIGNALING_MESSAGE_TYPES = {
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE_CANDIDATE: 'ice-candidate',
  JOIN: 'join',
  LEAVE: 'leave',
  PARTICIPANT_JOINED: 'participant-joined',
  PARTICIPANT_LEFT: 'participant-left',
  PARTICIPANT_UPDATED: 'participant-updated',
  ROOM_ENDED: 'room-ended',
  CHAT_MESSAGE: 'chat-message',
};

// Lazy native module loader to avoid bundling react-native-webrtc on web
const loadNativeWebRTC = () => {
  if (Platform.OS === 'web') return null;
  try {
    return require('react-native-webrtc');
  } catch (e) {
    console.warn('react-native-webrtc is not available:', e?.message || e);
    return null;
  }
};

const getPlatformClasses = () => {
  if (Platform.OS === 'web') {
    return {
      RTCPeerConnection: window.RTCPeerConnection,
      MediaStream: window.MediaStream,
      MediaStreamTrack: window.MediaStreamTrack,
      RTCSessionDescription: window.RTCSessionDescription,
      RTCIceCandidate: window.RTCIceCandidate,
    };
  }

  const native = loadNativeWebRTC();
  if (!native) {
    throw new Error('react-native-webrtc is required on native platforms');
  }

  return {
    RTCPeerConnection: native.RTCPeerConnection,
    MediaStream: native.MediaStream,
    MediaStreamTrack: native.MediaStreamTrack,
    RTCSessionDescription: native.RTCSessionDescription,
    RTCIceCandidate: native.RTCIceCandidate,
  };
};

class WebRTCClient {
  constructor() {
    this.peerConnections = new Map();
    this.localStream = null;
    this.screenStream = null;
    this.remoteStreams = new Map();
    this.ws = null;
    this.roomId = null;
    this.userId = null;
    this.participantId = null;
    this.connId = null;
    this.eventHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.platformClasses = null;
  }

  ensurePlatformClasses() {
    if (!this.platformClasses) {
      this.platformClasses = getPlatformClasses();
    }
    return this.platformClasses;
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  off(event, handler) {
    if (!this.eventHandlers.has(event)) return;
    const handlers = this.eventHandlers.get(event);
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.eventHandlers.has(event)) return;
    this.eventHandlers.get(event).forEach(handler => {
      try {
        handler(data);
      } catch (e) {
        console.error(`Error in event handler for ${event}:`, e);
      }
    });
  }

  once(event, handler) {
    const wrapper = (data) => {
      handler(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  async initLocalMedia(constraints = MEDIA_CONSTRAINTS) {
    try {
      const { MediaStream } = this.ensurePlatformClasses();

      if (Platform.OS === 'web') {
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      } else {
        const native = loadNativeWebRTC();
        if (!native) throw new Error('react-native-webrtc not available');
        const stream = await native.mediaDevices.getUserMedia(constraints);
        this.localStream = new MediaStream(stream);
      }

      this.emit('localStream', this.localStream);
      return this.localStream;
    } catch (error) {
      console.error('Failed to get local media:', error);
      this.emit('error', { type: 'media', error });
      throw error;
    }
  }

  async initScreenShare() {
    try {
      if (Platform.OS === 'web') {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true,
        });
      } else {
        throw new Error('Screen sharing not implemented for mobile yet');
      }
      this.emit('screenStream', this.screenStream);
      return this.screenStream;
    } catch (error) {
      console.error('Failed to get screen share:', error);
      this.emit('error', { type: 'screen', error });
      throw error;
    }
  }

  async connectSignaling(roomId, userId, participantId) {
    this.roomId = roomId;
    this.userId = userId;
    this.participantId = participantId;
    this.connId = `${userId}-${Date.now()}`;

    // Retrieve the JWT token for WebSocket authentication
    let token = null;
    try {
      token = await getMeetingAuthToken();
    } catch (e) {
      console.warn('Failed to retrieve meeting auth token:', e?.message || e);
    }

    const wsUrl = getMeetingWsUrl(roomId, token);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('Signaling connected');
      this.reconnectAttempts = 0;
      this.emit('connected');

      this.sendSignalingMessage({
        type: SIGNALING_MESSAGE_TYPES.JOIN,
        roomId: this.roomId,
        userId: this.userId,
        connId: this.connId,
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleSignalingMessage(message);
      } catch (error) {
        console.error('Failed to parse signaling message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', { type: 'websocket', error });
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      this.emit('disconnected');
      this.handleReconnect();
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      this.once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.once('error', (e) => {
        clearTimeout(timeout);
        reject(e.error);
      });
    });
  }

  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', { type: 'reconnect', error: new Error('Max reconnect attempts reached') });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(async () => {
      try {
        await this.connectSignaling(this.roomId, this.userId, this.participantId);
      } catch (error) {
        console.error('Reconnect failed:', error);
      }
    }, delay);
  }

  handleSignalingMessage(message) {
    switch (message.type) {
      case SIGNALING_MESSAGE_TYPES.PARTICIPANT_JOINED:
        this.emit('participantJoined', message);
        if (message.userId !== this.userId) {
          this.createPeerConnection(message.connId, message.userId, true);
        }
        break;

      case SIGNALING_MESSAGE_TYPES.PARTICIPANT_LEFT:
        this.emit('participantLeft', message);
        this.removePeerConnection(message.connId);
        break;

      case SIGNALING_MESSAGE_TYPES.OFFER:
        this.handleOffer(message);
        break;

      case SIGNALING_MESSAGE_TYPES.ANSWER:
        this.handleAnswer(message);
        break;

      case SIGNALING_MESSAGE_TYPES.ICE_CANDIDATE:
        this.handleIceCandidate(message);
        break;

      case SIGNALING_MESSAGE_TYPES.PARTICIPANT_UPDATED:
        this.emit('participantUpdated', message);
        break;

      case SIGNALING_MESSAGE_TYPES.ROOM_ENDED:
        this.emit('roomEnded', message);
        this.disconnect();
        break;

      case SIGNALING_MESSAGE_TYPES.CHAT_MESSAGE:
        this.emit('chatMessage', { ...message.payload, senderId: message.userId });
        break;

      default:
        console.log('Unknown signaling message:', message.type);
    }
  }

  sendSignalingMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  async createPeerConnection(remoteConnId, remoteUserId, isInitiator = false) {
    if (this.peerConnections.has(remoteConnId)) {
      return this.peerConnections.get(remoteConnId);
    }

    const { RTCPeerConnection, MediaStream } = this.ensurePlatformClasses();
    const pc = new RTCPeerConnection(WEBRTC_CONFIG);

    if (this.localStream) {
      if (Platform.OS === 'web') {
        this.localStream.getTracks().forEach(track => {
          pc.addTrack(track, this.localStream);
        });
      } else {
        this.localStream.getTracks().forEach(track => {
          pc.addTrack(track, this.localStream);
        });
      }
    }

    pc.ontrack = (event) => {
      this.handleRemoteTrack(remoteConnId, remoteUserId, event);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: SIGNALING_MESSAGE_TYPES.ICE_CANDIDATE,
          roomId: this.roomId,
          target: remoteConnId,
          payload: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`Connection state with ${remoteUserId}: ${state}`);
      this.emit('connectionStateChange', { connId: remoteConnId, state });

      if (state === 'failed' || state === 'closed') {
        this.removePeerConnection(remoteConnId);
      }
    };

    this.peerConnections.set(remoteConnId, pc);

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.sendSignalingMessage({
        type: SIGNALING_MESSAGE_TYPES.OFFER,
        roomId: this.roomId,
        target: remoteConnId,
        payload: offer,
      });
    }

    return pc;
  }

  async handleOffer(message) {
    const pc = await this.createPeerConnection(message.connId, message.userId, false);
    const { RTCSessionDescription } = this.ensurePlatformClasses();
    await pc.setRemoteDescription(new RTCSessionDescription(message.payload));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignalingMessage({
      type: SIGNALING_MESSAGE_TYPES.ANSWER,
      roomId: this.roomId,
      target: message.connId,
      payload: answer,
    });
  }

  async handleAnswer(message) {
    const pc = this.peerConnections.get(message.connId);
    if (pc) {
      const { RTCSessionDescription } = this.ensurePlatformClasses();
      await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
    }
  }

  async handleIceCandidate(message) {
    const pc = this.peerConnections.get(message.connId);
    if (pc && message.payload) {
      const { RTCIceCandidate } = this.ensurePlatformClasses();
      await pc.addIceCandidate(new RTCIceCandidate(message.payload));
    }
  }

  handleRemoteTrack(connId, userId, event) {
    const { MediaStream } = this.ensurePlatformClasses();

    if (!this.remoteStreams.has(connId)) {
      this.remoteStreams.set(connId, new MediaStream());
    }

    const stream = this.remoteStreams.get(connId);

    if (Platform.OS === 'web' && event.streams[0]) {
      event.streams[0].getTracks().forEach(track => {
        stream.addTrack(track);
      });
    } else if (event.track) {
      stream.addTrack(event.track);
    }

    this.emit('remoteStream', { connId, userId, stream });
  }

  removePeerConnection(connId) {
    const pc = this.peerConnections.get(connId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(connId);
    }
    this.remoteStreams.delete(connId);
    this.emit('peerConnectionRemoved', { connId });
  }

  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  async switchCamera() {
    if (this.localStream && Platform.OS !== 'web') {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack && videoTrack._switchCamera) {
        await videoTrack._switchCamera();
      }
    }
  }

  async replaceVideoTrack(newStream) {
    const videoTrack = newStream.getVideoTracks()[0];
    if (!videoTrack) return;

    for (const [, pc] of this.peerConnections) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(videoTrack);
      }
    }
  }

  async getStats() {
    const stats = {};
    for (const [connId, pc] of this.peerConnections) {
      try {
        const report = await pc.getStats();
        stats[connId] = report;
      } catch (e) {
        stats[connId] = { error: e.message };
      }
    }
    return stats;
  }

  disconnect() {
    this.peerConnections.forEach((pc) => {
      pc.close();
    });
    this.peerConnections.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }

    this.remoteStreams.clear();
    this.reconnectAttempts = 0;
    this.emit('disconnected');
  }

  getActiveConnectionCount() {
    return this.peerConnections.size;
  }

  getLocalStream() {
    return this.localStream;
  }

  getRemoteStreams() {
    return Array.from(this.remoteStreams.entries()).map(([connId, stream]) => ({
      connId,
      stream,
    }));
  }
}

let webrtcClient = null;

export const getWebRTCClient = () => {
  if (!webrtcClient) {
    webrtcClient = new WebRTCClient();
  }
  return webrtcClient;
};

export const createWebRTCClient = () => {
  if (webrtcClient) {
    webrtcClient.disconnect();
  }
  webrtcClient = new WebRTCClient();
  return webrtcClient;
};
