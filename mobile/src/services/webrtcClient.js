import { Platform } from 'react-native';
import { getMeetingWsUrl } from '../services/meetingConfig';
import { getMeetingAuthToken } from '../services/meetingApi';
import { startScreenCaptureService, stopScreenCaptureService } from '../services/screenCaptureService';

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
  // Sent by a receiver back to the sharer the moment the receiver's screen
  // video track actually starts delivering frames (track 'unmute'), not just
  // when it was negotiated. This is the only ground-truth signal that a
  // screen share is actually visible somewhere -- everything else (local
  // "sharing" state, a successful replaceTrack call, a connected ICE state)
  // can be true while the other side still sees nothing.
  SCREEN_SHARE_ACK: 'screen-share-ack',
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
    // connId -> RTCRtpSender/RTCRtpTransceiver for the dedicated screen-share
    // m-line (see createPeerConnection). Screen sharing only ever touches
    // these, never the camera sender above.
    this.screenSenders = new Map();
    this.screenTransceivers = new Map();
    // connId -> { hasNegotiated, renegotiatePending }
    this.negotiationStates = new Map();
    // TURN servers handed back by the room join response (see setIceServers).
    this.extraIceServers = [];
  }

  // STUN alone can only connect two peers when at least one of them has a
  // directly reachable (or easily NAT-reflexive) address. Two peers behind a
  // symmetric or carrier-grade NAT — the common case on mobile data — can
  // never find each other's real address that way, so their media (camera,
  // screen share) silently never arrives even though the WebSocket signaling
  // path keeps working fine (it isn't peer-to-peer, so it doesn't need NAT
  // traversal). A TURN relay is the only fix for that pairing. The room join
  // response already returns TURN credentials; this just has to be plugged
  // into the peer connection config, which it previously wasn't.
  setIceServers(turnUrls = [], turnCredentials = []) {
    this.extraIceServers = (turnUrls || [])
      .filter(Boolean)
      .map((url, index) => {
        const cred = turnCredentials?.[index] || '';
        const sepIndex = cred.indexOf(':');
        if (sepIndex <= 0) return { urls: url };
        return {
          urls: url,
          username: cred.slice(0, sepIndex),
          credential: cred.slice(sepIndex + 1),
        };
      });
  }

  getIceServers() {
    return [...WEBRTC_CONFIG.iceServers, ...this.extraIceServers];
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

      let stream;
      if (Platform.OS === 'web') {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } else {
        const native = loadNativeWebRTC();
        if (!native) throw new Error('react-native-webrtc not available');
        const nativeStream = await native.mediaDevices.getUserMedia(constraints);
        stream = new MediaStream(nativeStream);
      }

      if (this.localStream) {
        // Merge into the existing local stream rather than replacing it
        // outright. getUserMedia() is atomic -- if a caller was only denied
        // the camera, say, requesting camera+mic together to recover would
        // fail the whole call again even though the mic was never a problem.
        // Callers recovering from a partial failure pass constraints for just
        // the one kind they're re-requesting, and merging here keeps whatever
        // was already working intact.
        stream.getTracks().forEach(track => {
          this.localStream.getTracks()
            .filter(t => t.kind === track.kind)
            .forEach(t => {
              t.stop();
              this.localStream.removeTrack(t);
            });
          this.localStream.addTrack(track);
        });
      } else {
        this.localStream = stream;
      }

      this.emit('localStream', this.localStream);
      return this.localStream;
    } catch (error) {
      console.error('Failed to get local media:', error);
      this.emit('error', { type: 'media', error });
      const wantsVideo = !!constraints?.video;
      const wantsAudio = !!constraints?.audio;
      const kind = wantsVideo && wantsAudio ? 'Camera and microphone' : wantsVideo ? 'Camera' : 'Microphone';
      const friendly = new Error(`${kind} access is required. Please allow permissions and try again.`);
      throw friendly;
    }
  }

  // Wires a just-(re)acquired local camera/mic track into every existing peer
  // connection. toggleVideo()/toggleAudio() alone only flip `enabled` on
  // tracks that are already attached to a connection's senders -- if the
  // track didn't exist when a connection was created (permission was denied
  // at join time and granted later, mid-call), nothing was ever sending it,
  // so the remote side stays blind/deaf to it until this runs.
  async attachLocalTrack(kind) {
    const track = kind === 'video'
      ? this.localStream?.getVideoTracks?.()[0]
      : this.localStream?.getAudioTracks?.()[0];
    if (!track) return;

    for (const [connId, pc] of this.peerConnections) {
      try {
        // Exclude the dedicated screen-share sender: it also carries 'video'
        // tracks, but must never be reused for the camera.
        const screenSender = this.screenSenders.get(connId);
        const existingSender = pc.getSenders().find(s => s !== screenSender && s.track?.kind === kind);
        if (existingSender) {
          await existingSender.replaceTrack(track);
        } else {
          pc.addTrack(track, this.localStream);
          await this.renegotiate(connId, pc);
        }
      } catch (error) {
        console.error(`[Meeting] Failed to attach local ${kind} track for connection:`, connId, error?.message || error);
      }
    }
  }

  async initScreenShare() {
    let serviceStarted = false;

    try {
      const native = loadNativeWebRTC();

      if (Platform.OS === 'web') {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true,
        });
      } else if (native && native.mediaDevices && typeof native.mediaDevices.getDisplayMedia === 'function') {
        // The mediaProjection foreground service must already be running when
        // the capturer starts (Android 14+), otherwise the capture is rejected
        // by the platform and silently yields a track with no frames.
        serviceStarted = await startScreenCaptureService();
        // react-native-webrtc's getDisplayMedia takes no constraints; it always
        // captures the whole screen (and never system audio).
        this.screenStream = await native.mediaDevices.getDisplayMedia();
      } else {
        throw new Error('Screen sharing is not available on this build');
      }

      this.watchScreenTrackEnded();
      this.emit('screenStream', this.screenStream);
      return this.screenStream;
    } catch (error) {
      console.error('Failed to get screen share:', error);
      if (serviceStarted) {
        await stopScreenCaptureService();
      }
      this.emit('error', { type: 'screen', error });
      throw error;
    }
  }

  // The share can be revoked outside the app (Android's "Stop sharing"
  // notification, the browser's "Stop sharing" bar). Surface that as an event so
  // the UI and the other participants are told the share is over.
  watchScreenTrackEnded() {
    const track = this.screenStream?.getVideoTracks?.()[0];
    if (!track) return;

    const onEnded = () => {
      console.log('[ScreenShare] Screen track ended outside the app');
      this.emit('screenShareEnded');
    };

    if (typeof track.addEventListener === 'function') {
      track.addEventListener('ended', onEnded);
    } else {
      track.onended = onEnded;
    }
  }

  async stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    await stopScreenCaptureService();

    // Clear the outgoing track on the dedicated screen m-line for every peer.
    // The camera m-line is never touched by screen sharing, so there is
    // nothing to restore there.
    await this.replaceScreenShareTrack(null);

    this.emit('screenShareStopped');
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
          displayName: message.displayName,
        });
        break;

      case SIGNALING_MESSAGE_TYPES.SCREEN_SHARE_STOPPED:
        console.log('[Meeting] Received screen-share-stopped:', { connId: message.connId, userId: message.userId });
        this.setRemoteScreenShare(message.connId, message.userId, false);
        this.emit('screenShareStopped', {
          connId: message.connId,
          userId: message.userId,
          displayName: message.displayName,
        });
        break;

      case SIGNALING_MESSAGE_TYPES.SCREEN_SHARE_REJECTED:
        this.emit('screenShareRejected', message.payload || {});
        break;

      case SIGNALING_MESSAGE_TYPES.SCREEN_SHARE_ACK:
        console.log('[ScreenShare] Received viewer ack -- frames are actually arriving there:', {
          fromConnId: message.connId,
          fromUserId: message.userId,
        });
        this.emit('screenShareAck', { connId: message.connId, userId: message.userId });
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

  // Tells the sharer at `sharerConnId` that their screen is actually
  // rendering real frames on our end. Sent once per incoming screen track,
  // from handleRemoteTrack's 'unmute' listener.
  sendScreenShareAck(sharerConnId) {
    if (!sharerConnId) return;
    console.log('[ScreenShare] Sending viewer ack to sharer:', sharerConnId);
    this.sendSignalingMessage({
      type: SIGNALING_MESSAGE_TYPES.SCREEN_SHARE_ACK,
      roomId: this.roomId,
      target: sharerConnId,
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

    const pc = new RTCPeerConnection({ ...WEBRTC_CONFIG, iceServers: this.getIceServers() });

    // Buffer ICE candidates that arrive before a remote description is set so
    // we don't drop them (and thus fail to connect) due to ordering.
    this.pendingIceCandidates.set(remoteConnId, []);

    // Dedicated, always-negotiated screen-share video slot. Added first, on
    // every connection, unconditionally — so starting/stopping a share later
    // is always a plain replaceTrack() on an m-line that's already been
    // through one full offer/answer, never a fresh mid-call renegotiation.
    // That distinction matters: react-native-webrtc's replaceTrack() silently
    // no-ops on native failure (it swallows the error instead of throwing),
    // and swapping the *camera* sender's track from a camera-sourced track to
    // a screen-capture-sourced one is exactly the case that trips it — the
    // share never reached any peer even though the "sharing" signal did.
    // Reserving this slot up front sidesteps that failure mode entirely: it's
    // negotiated once, and every later toggle just changes what's on the wire
    // for an m-line the other side is already listening on. `sendrecv` (not
    // sendonly) because either side of this pairwise connection may end up
    // being the one who shares, at different times.
    const screenTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
    this.screenSenders.set(remoteConnId, screenTransceiver.sender);
    this.screenTransceivers.set(remoteConnId, screenTransceiver);
    if (this.screenStream) {
      const screenTrack = this.screenStream.getVideoTracks()[0];
      if (screenTrack) {
        screenTransceiver.sender.replaceTrack(screenTrack).catch(() => {});
      }
    }

    // Camera/mic always go out as-is, independent of screen-share state —
    // this m-line is never touched by screen sharing any more.
    const outgoingVideo = this.localStream?.getVideoTracks()[0] || null;
    let outgoingAudio = this.localStream?.getAudioTracks()[0] || null;
    if (!outgoingAudio && this.screenStream) {
      outgoingAudio = this.screenStream.getAudioTracks()[0] || null;
    }

    if (outgoingVideo) {
      pc.addTrack(outgoingVideo, this.localStream);
    }
    if (outgoingAudio && outgoingAudio !== outgoingVideo) {
      pc.addTrack(outgoingAudio, this.localStream || this.screenStream);
    }

    this.negotiationStates.set(remoteConnId, { hasNegotiated: false, renegotiatePending: false });

    pc.ontrack = (event) => {
      // The dedicated screen m-line is the only transceiver we add explicitly
      // (addTransceiver above); every other video/audio track was added via
      // addTrack. Comparing by reference tells camera/mic tracks apart from
      // the screen-share track without relying on ordering or track ids.
      const isScreenTrack = event.transceiver === screenTransceiver;
      this.handleRemoteTrack(remoteConnId, remoteUserId, event, isScreenTrack);
    };

    // Renegotiation is driven explicitly by renegotiate() when tracks change.
    // Acting on negotiationneeded as well would make both peers offer during
    // the initial exchange (glare) and duplicate every screen-share offer.
    pc.onnegotiationneeded = () => {
      const state = this.negotiationStates.get(remoteConnId);
      if (!state?.hasNegotiated) return;
      console.log('[ScreenShare] Negotiation needed for connection:', remoteConnId);
      this.renegotiate(remoteConnId, pc);
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

    this.markNegotiated(message.connId, pc);
  }

  async handleAnswer(message) {
    const pc = this.peerConnections.get(message.connId);
    if (!pc) return;

    // Ignore answers that no longer apply, e.g. the offer they answer was
    // rolled back because of an offer collision.
    if (pc.signalingState !== 'have-local-offer') {
      console.warn('[Meeting] Ignoring answer in signalingState:', pc.signalingState);
      return;
    }

    try {
      const { RTCSessionDescription } = this.ensurePlatformClasses();
      await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
      this.flushPendingIceCandidates(message.connId);
      this.markNegotiated(message.connId, pc);
    } catch (error) {
      console.error('[Meeting] Failed to apply answer:', error?.message || error);
    }
  }

  // Marks the initial offer/answer exchange for a connection as complete and
  // runs any renegotiation (screen share) that had to wait for it.
  markNegotiated(connId, pc) {
    const state = this.negotiationStates.get(connId) || { hasNegotiated: false, renegotiatePending: false };
    state.hasNegotiated = true;

    if (state.renegotiatePending) {
      state.renegotiatePending = false;
      this.negotiationStates.set(connId, state);
      this.renegotiate(connId, pc);
      return;
    }

    this.negotiationStates.set(connId, state);
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

  handleRemoteTrack(connId, userId, event, isScreenTrack = false) {
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
      isScreenTrack,
      hasEntry: this.remoteStreams.has(connId),
    });

    if (!this.remoteStreams.has(connId)) {
      this.remoteStreams.set(connId, { stream: new MediaStream(), screenStream: null, userId, isScreenSharing: false });
    }

    const entry = this.remoteStreams.get(connId);
    if (userId) {
      entry.userId = userId;
    }

    const incomingTrack = event.track;
    if (!incomingTrack) return;

    if (isScreenTrack) {
      // The screen track lives on its own m-line, so it gets its own
      // MediaStream entirely -- it must never share one with camera/mic,
      // otherwise showing/hiding either would stomp on the other.
      if (!entry.screenStream) {
        entry.screenStream = new MediaStream();
      }
      entry.screenStream.getTracks().forEach(t => entry.screenStream.removeTrack(t));
      entry.screenStream.addTrack(incomingTrack);
      // This transceiver is negotiated for every connection up front (see
      // createPeerConnection), so getting here only means a screen m-line
      // exists -- not that anyone is actually sharing yet. Only ack once real
      // frames start arriving.
      this.watchScreenTrackForAck(connId, incomingTrack);
    } else {
      const stream = entry.stream;
      // Guard against duplicate tracks of the same kind (e.g. a camera
      // renegotiation) landing in the camera/mic stream.
      stream.getTracks().forEach(t => {
        if (t.kind === incomingTrack.kind) {
          stream.removeTrack(t);
        }
      });
      stream.addTrack(incomingTrack);
    }

    console.log('[ScreenShare] Emitting remoteStream:', {
      connId,
      isScreenTrack,
      streamTrackCount: entry.stream.getTracks().length,
      screenTrackCount: entry.screenStream?.getTracks().length || 0,
      isScreenSharing: entry.isScreenSharing,
    });

    this.emit('remoteStream', {
      connId,
      userId,
      stream: entry.stream,
      screenStream: entry.screenStream,
      isScreenSharing: entry.isScreenSharing,
    });
  }

  // Sends `screen-share-ack` back to `connId` the moment `track` actually
  // starts delivering frames. A negotiated track can sit muted indefinitely
  // (nobody sharing yet, or sharing but the frames never make it here), so
  // this is the one signal that distinguishes "negotiated" from "actually
  // visible on the other end" -- see the emitted screen-share-ack handling
  // in the hook for how the sharer surfaces the result.
  watchScreenTrackForAck(connId, track) {
    if (!track) return;

    const ack = () => {
      console.log('[ScreenShare] Local screen track unmuted -- frames are arriving:', {
        connId,
        trackId: track.id,
      });
      this.sendScreenShareAck(connId);
    };

    // react-native-webrtc marks every freshly negotiated remote track as
    // unmuted the instant `ontrack` fires (see its RTCPeerConnection source),
    // regardless of whether any real frames have arrived -- and the screen
    // m-line here is negotiated up front on every connection, long before
    // anyone may actually share. Trusting `track.muted` immediately on native
    // would therefore ack right away, every time, making this whole check a
    // no-op. Browsers get the initial muted state right (per spec), so the
    // fast path below is only trustworthy there; native always waits for a
    // real 'unmute' transition, driven by libwebrtc's own RTP-arrival signal.
    if (Platform.OS === 'web' && track.muted === false) {
      // Frames were already flowing by the time we got here (e.g. the share
      // was already live when this connection was created).
      ack();
      return;
    }

    if (typeof track.addEventListener === 'function') {
      track.addEventListener('unmute', ack, { once: true });
    } else {
      track.onunmute = ack;
    }
  }

  removePeerConnection(connId) {
    const pc = this.peerConnections.get(connId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(connId);
    }
    this.remoteStreams.delete(connId);
    this.screenSenders.delete(connId);
    this.screenTransceivers.delete(connId);
    this.negotiationStates.delete(connId);
    if (this.pendingIceCandidates) {
      this.pendingIceCandidates.delete(connId);
    }
    this.emit('peerConnectionRemoved', { connId });
  }

  // Records the remote screen-share flag for a connection. This deliberately
  // does NOT re-emit `remoteStream`: that event carries the stream, and when the
  // flag arrives before the first track it would push a null stream onto a tile
  // that already had media, turning the sharer's tile into a blank placeholder.
  // The UI learns about the flag from screenShareStarted/Stopped instead.
  setRemoteScreenShare(connId, userId, isScreenSharing) {
    if (!connId && !userId) return;

    let entry = connId ? this.remoteStreams.get(connId) : null;
    if (!entry && userId) {
      for (const candidate of this.remoteStreams.values()) {
        if (candidate.userId && candidate.userId === userId) {
          entry = candidate;
          break;
        }
      }
    }

    if (!entry) {
      // Track the state even before any media has arrived, so the flag is
      // already correct when the first track shows up.
      this.remoteStreams.set(connId || userId, { stream: null, screenStream: null, userId: userId || null, isScreenSharing });
      return;
    }

    entry.isScreenSharing = isScreenSharing;
    if (userId) {
      entry.userId = userId;
    }
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

  // Pushes (or clears, when newStream is null) the outgoing screen-share
  // video track onto every peer connection's dedicated screen m-line. This
  // never touches the camera sender: replaceTrack() on a sender that has
  // ever carried a camera-sourced track silently no-ops on native when handed
  // a screen-capture-sourced track instead (react-native-webrtc swallows the
  // native failure -- see RTCRtpSender.replaceTrack), which is how a share
  // used to reach nobody while every local signal said it had started. The
  // screen sender's track only ever transitions null <-> screen-capture, so
  // that failure mode never applies to it.
  async replaceScreenShareTrack(newStream) {
    const videoTrack = newStream?.getVideoTracks?.()[0] || null;

    console.log('[ScreenShare] Replacing outgoing screen track in peer connections:', {
      connections: this.peerConnections.size,
      hasTrack: !!videoTrack,
    });

    for (const [connId, pc] of this.peerConnections) {
      try {
        await this.setOutgoingScreenTrack(connId, pc, videoTrack);
      } catch (error) {
        console.error('[ScreenShare] Failed to set screen track for connection:', connId, error?.message || error);
      }
    }
  }

  async setOutgoingScreenTrack(connId, pc, videoTrack) {
    const sender = this.screenSenders.get(connId);
    if (!sender || !pc.getSenders().includes(sender)) {
      console.warn('[ScreenShare] No dedicated screen sender for connection:', connId);
      return;
    }

    await sender.replaceTrack(videoTrack);

    const applied = videoTrack ? sender.track?.id === videoTrack.id : !sender.track;
    if (applied) {
      console.log('[ScreenShare] Screen track replaced for connection:', connId);
    } else {
      console.warn('[ScreenShare] Screen replaceTrack did not take effect for connection:', connId);
    }
  }

  // Explicitly (re)negotiates a connection. `onnegotiationneeded` is not fired
  // reliably by react-native-webrtc, so track changes drive this directly.
  async renegotiate(connId, pc) {
    const state = this.negotiationStates.get(connId);
    if (state && !state.hasNegotiated) {
      // The initial exchange has not finished. If an offer is already in flight
      // it cannot carry the new track, so queue a renegotiation for afterwards;
      // otherwise the upcoming initial offer will include it anyway.
      if (pc.signalingState !== 'stable') {
        state.renegotiatePending = true;
      }
      return;
    }

    if (pc.signalingState !== 'stable') {
      console.log('[ScreenShare] Deferring renegotiation, signalingState:', pc.signalingState);
      if (state) state.renegotiatePending = true;
      return;
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.sendSignalingMessage({
        type: SIGNALING_MESSAGE_TYPES.OFFER,
        roomId: this.roomId,
        target: connId,
        payload: offer,
      });
      console.log('[ScreenShare] Renegotiation offer sent to:', connId);
    } catch (error) {
      console.error('[ScreenShare] Renegotiation failed for connection:', connId, error?.message || error);
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
      stopScreenCaptureService();
    }

    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }

    this.remoteStreams.clear();
    this.screenSenders.clear();
    this.screenTransceivers.clear();
    this.negotiationStates.clear();
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
      screenStream: entry.screenStream,
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
