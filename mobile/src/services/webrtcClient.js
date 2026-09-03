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
  SCREEN_SHARE_STARTED: 'screen-share-started',
  SCREEN_SHARE_STOPPED: 'screen-share-stopped',
  SCREEN_SHARE_REJECTED: 'screen-share-rejected',
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

  try {
    const native = loadNativeWebRTC();
    if (!native) {
      console.warn('react-native-webrtc not available, some features may not work');
      return {
        RTCPeerConnection: null,
        MediaStream: null,
        MediaStreamTrack: null,
        RTCSessionDescription: null,
        RTCIceCandidate: null,
      };
    }

    return {
      RTCPeerConnection: native.RTCPeerConnection,
      MediaStream: native.MediaStream,
      MediaStreamTrack: native.MediaStreamTrack,
      RTCSessionDescription: native.RTCSessionDescription,
      RTCIceCandidate: native.RTCIceCandidate,
    };
  } catch (e) {
    console.warn('Failed to load react-native-webrtc:', e?.message);
    return {
      RTCPeerConnection: null,
      MediaStream: null,
      MediaStreamTrack: null,
      RTCSessionDescription: null,
      RTCIceCandidate: null,
    };
  }
};

export const isWebRTCAvailable = () => {
  if (Platform.OS === 'web') return true;
  const native = loadNativeWebRTC();
  return !!native;
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
    this.reconnectDelay = 600;
    this.platformClasses = null;
    this.pendingIceCandidates = new Map();
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
      const friendly = new Error(
        'Camera and microphone access is required to join the meeting. Please allow permissions and try again.'
      );
      throw friendly;
    }
  }

   async initScreenShare() {
    try {
      const native = loadNativeWebRTC();

      if (Platform.OS === 'web') {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true,
        });
      } else if (native && native.mediaDevices && typeof native.mediaDevices.getDisplayMedia === 'function') {
        this.screenStream = await native.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
      } else {
        throw new Error('Screen sharing is not available on this build');
      }

      this.emit('screenStream', this.screenStream);
      return this.screenStream;
    } catch (error) {
      console.error('Failed to get screen share:', error);
      this.emit('error', { type: 'screen', error });
      throw error;
    }
  }

  async stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
    this.emit('screenShareStopped');

    // Restore camera track in peer connections
    if (this.localStream) {
      await this.replaceVideoTrack(this.localStream);
    }
  }

  async connectSignaling(roomId, userId, participantId, displayName = null) {
    this.roomId = roomId;
    this.userId = userId;
    this.participantId = participantId;
    this.displayName = displayName;
    // connId will be set by the server after the first participant-joined event
    // (or our own join confirmation). Until then, keep it null so we can match it.
    this.connId = null;

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
      console.log('[Meeting] Signaling connected | roomId=' + roomId + ' userId=' + this.userId);
      this.reconnectAttempts = 0;

      // Send join before emitting the connected signal so the room state is
      // updated immediately and the app refreshes the roster without waiting for
      // an additional polling cycle.
      this.sendSignalingMessage({
        type: SIGNALING_MESSAGE_TYPES.JOIN,
        roomId: this.roomId,
        userId: this.userId,
        participantId: this.participantId,
        displayName: this.displayName,
      });
      console.log('[Meeting] Sent join message:', {
        roomId: this.roomId,
        userId: this.userId,
        displayName: this.displayName,
      });

      this.emit('connected');
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

    this.ws.onclose = (event) => {
      console.log('[Meeting] WebSocket closed:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        roomId: this.roomId,
        userId: this.userId,
      });
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
        // Preserve displayName on reconnect so the server can identify us
        await this.connectSignaling(this.roomId, this.userId, this.participantId, this.displayName);
        console.log('[Meeting] Reconnected successfully | roomId=' + this.roomId + ' userId=' + this.userId);
      } catch (error) {
        console.error('[Meeting] Reconnect failed:', error);
      }
    }, delay);
  }

  handleSignalingMessage(message) {
    // Log received signaling messages for debugging presence
    if (message.type === SIGNALING_MESSAGE_TYPES.PARTICIPANT_JOINED) {
      console.log('[Meeting] Received participant-joined:', {
        userId: message.userId,
        displayName: message.displayName || message.payload?.displayName,
        connId: message.connId,
        isSelf: message.userId === this.userId,
        isInitiator: message.payload?.initiator,
      });
    } else if (message.type === SIGNALING_MESSAGE_TYPES.PARTICIPANT_LEFT) {
      console.log('[Meeting] Received participant-left:', {
        userId: message.userId,
        connId: message.connId,
      });
    }

    switch (message.type) {
      case SIGNALING_MESSAGE_TYPES.PARTICIPANT_JOINED:
        this.emit('participantJoined', message);
        if (message.userId === this.userId) {
          // This is our own join confirmation: adopt the server-issued connId.
          if (message.connId && (!this.connId || this.connId !== message.connId)) {
            this.connId = message.connId;
            console.log('[Meeting] Adopted server connId:', this.connId);
          }
          break;
        }

        // Use server-issued connId so all peers agree on one identifier.
        const remoteConnId = message.connId || message.payload?.connId;
        if (!remoteConnId) break;

        // Determine a stable initiator without relying on the server's stale
        // metadata. When two peers join nearly simultaneously, exactly one side
        // should create the offer; otherwise both sides race and negotiation
        // fails, leaving remote tiles blank.
        const currentUserId = String(this.userId || '');
        const remoteUserId = String(message.userId || '');
        const shouldInitiate = currentUserId.localeCompare(remoteUserId) < 0;

        if (!this.peerConnections.has(remoteConnId)) {
          this.createPeerConnection(remoteConnId, remoteUserId, shouldInitiate);
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

      case SIGNALING_MESSAGE_TYPES.SCREEN_SHARE_STARTED:
        console.log('[Meeting] Received screen-share-started:', { connId: message.connId, userId: message.userId });
        this.setRemoteScreenShare(message.connId, message.userId, true);
        this.emit('screenShareStarted', {
          connId: message.connId,
          userId: message.userId,
        });
        break;

      case SIGNALING_MESSAGE_TYPES.SCREEN_SHARE_STOPPED:
        console.log('[Meeting] Received screen-share-stopped:', { connId: message.connId, userId: message.userId });
        this.setRemoteScreenShare(message.connId, message.userId, false);
        this.emit('screenShareStopped', {
          connId: message.connId,
          userId: message.userId,
        });
        break;

      case SIGNALING_MESSAGE_TYPES.SCREEN_SHARE_REJECTED:
        this.emit('screenShareRejected', message.payload || {});
        break;

      default:
        console.log('Unknown signaling message:', message.type);
    }
  }

  sendScreenShareStarted() {
    console.log('[Meeting] Sending screen-share-started to server');
    this.sendSignalingMessage({
      type: SIGNALING_MESSAGE_TYPES.SCREEN_SHARE_STARTED,
      roomId: this.roomId,
    });
  }

  sendScreenShareStopped() {
    console.log('[Meeting] Sending screen-share-stopped to server');
    this.sendSignalingMessage({
      type: SIGNALING_MESSAGE_TYPES.SCREEN_SHARE_STOPPED,
      roomId: this.roomId,
    });
  }

  sendSignalingMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Always include connId if we have one, so the server can route correctly.
      const payload = { ...message };
      if (this.connId) {
        payload.connId = this.connId;
      }
      this.ws.send(JSON.stringify(payload));
    }
  }

  async createPeerConnection(remoteConnId, remoteUserId, isInitiator = false) {
    if (this.peerConnections.has(remoteConnId)) {
      return this.peerConnections.get(remoteConnId);
    }

    const { RTCPeerConnection, MediaStream } = this.ensurePlatformClasses();

    // Guard against missing WebRTC support (e.g., react-native-webrtc not linked)
    if (!RTCPeerConnection) {
      console.warn('[WebRTC] RTCPeerConnection not available, skipping peer connection creation');
      return null;
    }

    const pc = new RTCPeerConnection(WEBRTC_CONFIG);

    // Buffer ICE candidates that arrive before a remote description is set so
    // we don't drop them (and thus fail to connect) due to ordering.
    this.pendingIceCandidates.set(remoteConnId, []);

    // Choose the tracks that should go OUT to this remote peer.
    // While screen sharing, the outgoing video must be the screen (not the
    // camera), so participants who join mid-share still receive the shared
    // screen. Audio always follows the local microphone when available.
    let outgoingVideo = null;
    let outgoingAudio = null;

    if (this.screenStream) {
      outgoingVideo = this.screenStream.getVideoTracks()[0] || null;
      console.log('[ScreenShare] Using screen stream for outgoing video, connId:', remoteConnId);
    }
    if (!outgoingVideo && this.localStream) {
      outgoingVideo = this.localStream.getVideoTracks()[0] || null;
    }
    if (this.localStream) {
      outgoingAudio = this.localStream.getAudioTracks()[0] || null;
    }
    if (!outgoingAudio && this.screenStream) {
      outgoingAudio = this.screenStream.getAudioTracks()[0] || null;
    }

    if (outgoingVideo) {
      pc.addTrack(outgoingVideo, this.screenStream || this.localStream);
    }
    if (outgoingAudio && outgoingAudio !== outgoingVideo) {
      pc.addTrack(outgoingAudio, this.localStream || this.screenStream);
    }

    pc.ontrack = (event) => {
      this.handleRemoteTrack(remoteConnId, remoteUserId, event);
    };

    // Handle renegotiation needed (e.g., when adding screen share track after initial connection)
    pc.onnegotiationneeded = async () => {
      try {
        console.log('[ScreenShare] Negotiation needed for connection:', remoteConnId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.sendSignalingMessage({
          type: SIGNALING_MESSAGE_TYPES.OFFER,
          roomId: this.roomId,
          target: remoteConnId,
          payload: offer,
        });
        console.log('[ScreenShare] Renegotiation offer sent to:', remoteConnId);
      } catch (err) {
        console.error('[ScreenShare] Renegotiation failed:', err);
      }
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

    // Offer collision guard: if we already have a pending local offer on this
    // peer connection (because we also initiated), roll it back so we can
    // cleanly accept the incoming offer. This makes joining near-simultaneously
    // (both sides sending offers) safe.
    if (pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-remote-offer') {
      try {
        await pc.setLocalDescription({ type: 'rollback' });
      } catch (e) {
        console.warn('PeerConnection rollback failed:', e?.message || e);
      }
    }

    await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
    this.flushPendingIceCandidates(message.connId);

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
      this.flushPendingIceCandidates(message.connId);
    }
  }

  async handleIceCandidate(message) {
    const pc = this.peerConnections.get(message.connId);
    if (!pc || !message.payload) return;

    const hasRemoteDesc = pc.remoteDescription && pc.remoteDescription.type;
    if (!hasRemoteDesc) {
      // Remote description not set yet: buffer until setRemoteDescription runs.
      const buffer = this.pendingIceCandidates.get(message.connId) || [];
      buffer.push(message.payload);
      this.pendingIceCandidates.set(message.connId, buffer);
      return;
    }

    const { RTCIceCandidate } = this.ensurePlatformClasses();
    try {
      await pc.addIceCandidate(new RTCIceCandidate(message.payload));
    } catch (e) {
      console.warn('Failed to add ICE candidate:', e?.message || e);
    }
  }

  // Adds any buffered ICE candidates for a connection once its remote
  // description has been set.
  flushPendingIceCandidates(connId) {
    if (!this.pendingIceCandidates) return;
    const buffer = this.pendingIceCandidates.get(connId);
    if (!buffer || buffer.length === 0) {
      this.pendingIceCandidates.delete(connId);
      return;
    }
    const pc = this.peerConnections.get(connId);
    if (!pc) {
      this.pendingIceCandidates.delete(connId);
      return;
    }
    const { RTCIceCandidate } = this.ensurePlatformClasses();
    buffer.forEach(cand => {
      pc.addIceCandidate(new RTCIceCandidate(cand)).catch(e =>
        console.warn('Buffered ICE add failed:', e?.message || e)
      );
    });
    this.pendingIceCandidates.delete(connId);
  }

  handleRemoteTrack(connId, userId, event) {
    const { MediaStream } = this.ensurePlatformClasses();

    // Guard against missing WebRTC support
    if (!MediaStream) {
      console.warn('[WebRTC] MediaStream not available, cannot handle remote track');
      return;
    }

    console.log('[ScreenShare] Remote track received:', {
      connId,
      trackKind: event.track?.kind,
      trackId: event.track?.id,
      hasEntry: this.remoteStreams.has(connId),
    });

    if (!this.remoteStreams.has(connId)) {
      this.remoteStreams.set(connId, { stream: new MediaStream(), userId, isScreenSharing: false });
    }

    const entry = this.remoteStreams.get(connId);
    if (userId) {
      entry.userId = userId;
    }
    const stream = entry.stream;

    // When a track is replaced (e.g. camera -> screen share via replaceTrack),
    // the receiver fires a new ontrack for the same kind. Remove any existing
    // track of that kind first so we don't accumulate duplicate tracks in the
    // same MediaStream (which would otherwise show stale camera frames when
    // someone is screen sharing).
    const incomingTrack = event.track;
    if (incomingTrack) {
      stream.getTracks().forEach(t => {
        if (t.kind === incomingTrack.kind) {
          stream.removeTrack(t);
        }
      });
      stream.addTrack(incomingTrack);
    }

    console.log('[ScreenShare] Emitting remoteStream:', {
      connId,
      trackCount: stream.getTracks().length,
      isScreenSharing: entry.isScreenSharing,
    });

    this.emit('remoteStream', { connId, userId, stream, isScreenSharing: entry.isScreenSharing });
  }

  removePeerConnection(connId) {
    const pc = this.peerConnections.get(connId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(connId);
    }
    this.remoteStreams.delete(connId);
    if (this.pendingIceCandidates) {
      this.pendingIceCandidates.delete(connId);
    }
    this.emit('peerConnectionRemoved', { connId });
  }

  // Toggles the remote screen-share flag for a connection and re-emits the
  // remoteStream event so the UI can update its display (e.g. show "Screen"
  // label / switch the tile to the screen track).
  setRemoteScreenShare(connId, userId, isScreenSharing) {
    let entry = this.remoteStreams.get(connId);
    let stream = null;
    if (!entry) {
      // Track screen-share state even before a remoteStream has arrived so the
      // flag is correct when the first track does arrive.
      entry = { stream: null, userId, isScreenSharing };
      this.remoteStreams.set(connId, entry);
    } else {
      entry.isScreenSharing = isScreenSharing;
      if (userId) {
        entry.userId = userId;
      }
      stream = entry.stream;
    }
    this.emit('remoteStream', { connId, userId: entry.userId, stream, isScreenSharing });
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
    if (!videoTrack) {
      console.log('[ScreenShare] No video track in new stream');
      return;
    }

    console.log('[ScreenShare] Replacing video track in peer connections, count:', this.peerConnections.size);
    for (const [connId, pc] of this.peerConnections) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        console.log('[ScreenShare] Replacing track for connection:', connId);
        await sender.replaceTrack(videoTrack);
      } else {
        // No video sender exists (e.g., user had no camera), add the screen track as a new sender
        console.log('[ScreenShare] No video sender found, adding new track for connection:', connId);
        pc.addTrack(videoTrack, newStream);
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
    this.pendingIceCandidates?.clear();
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
    return Array.from(this.remoteStreams.entries()).map(([connId, entry]) => ({
      connId,
      stream: entry.stream,
      userId: entry.userId,
      isScreenSharing: entry.isScreenSharing,
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
