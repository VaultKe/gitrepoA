import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Alert, BackHandler, Linking, PermissionsAndroid, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { useApp } from '../context/AppContext';
import { meetingApi, setMeetingAuthToken, clearMeetingAuthToken } from '../services/meetingApi';
import { getWebRTCClient, createWebRTCClient, MEDIA_CONSTRAINTS, SIGNALING_MESSAGE_TYPES, isWebRTCAvailable } from '../services/webrtcClient';
import { getAuthToken as getMainAuthToken } from '../services/api/auth';
import { getMeetingApiUrl } from '../services/meetingConfig';

const useOnlineMeetingScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const {
    meetingId,
    meetingTitle,
    userRole = 'member',
    isPreview = false,
    previewData = null,
    isReadOnly = false,
  } = route.params || {};

  const [isConnecting, setIsConnecting] = useState(!meetingId);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  // connIds that have confirmed (via screen-share-ack) they are actually
  // receiving our current screen share's frames. Reset on every start/stop
  // so a stale ack from a previous share can't count toward the new one.
  const [screenShareViewerConnIds, setScreenShareViewerConnIds] = useState(() => new Set());
  // Identity of the participant currently sharing their screen, as announced by
  // the signaling server: { connId, userId }. Kept separately from the stream
  // list so the flag survives tiles being re-created or re-keyed.
  const [remoteScreenSharer, setRemoteScreenSharer] = useState(null);
  const [meetingData, setMeetingData] = useState(null);
  const [connectionError, setConnectionError] = useState(
    meetingId ? null : 'Missing meeting ID. Please reopen this meeting from the meeting details.'
  );

  // Check WebRTC availability on mount
  useEffect(() => {
    if (!isWebRTCAvailable()) {
      setConnectionError('Video calling is not available on this device. Please update the app or contact support.');
      setIsConnecting(false);
    }
  }, []);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const webrtcClientRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const screenShareRejectedRef = useRef(false);
  // Mirrors isScreenSharing for the connectionStateChange listener, which is
  // registered once in initializeWebRTC and would otherwise close over a
  // stale value.
  const isScreenSharingRef = useRef(false);
  // Timer that checks, a few seconds after starting a share, whether anyone
  // has actually acked it -- see handleToggleScreenShare.
  const screenShareWatchdogRef = useRef(null);
  // Mirrors screenShareViewerConnIds for the watchdog timer's closure.
  const screenShareViewerConnIdsRef = useRef(new Set());
  const participantIdRef = useRef(null);
  // Becomes true once the initial participant roster has loaded, so we only
  // toast for genuinely *new* arrivals and not the burst of existing members
  // the server sends right after we join.
  const initialLoadDoneRef = useRef(false);
  // Mirror of the participants list so event handlers (which close over stale
  // state) can read the latest roster without re-subscribing.
  const participantsRef = useRef([]);
  // Polling interval for reliable participant sync
  const pollIntervalRef = useRef(null);
  // Track known participant IDs for detecting joins/leaves via polling
  const knownParticipantIdsRef = useRef(new Set());


  // Initialize meeting
  useEffect(() => {
    if (isReadOnly) {
      setIsConnecting(false);
      return;
    }

    if (!meetingId) {
      setIsConnecting(false);
      return;
    }

    initializeMeeting().catch((error) => {
      console.error('Failed to initialize meeting:', error);
      setConnectionError('Failed to connect to meeting. Please try again.');
      setIsConnecting(false);
    });

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

    return () => {
      backHandler.remove();
      cleanup();
    };
  }, []);

  const initializeMeeting = async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);

      // Request permissions, but do not block joining if the user denies them
      try {
        await requestPermissions();
      } catch (permError) {
        console.warn('Media permissions not granted, joining without camera/mic:', permError);
        // Continue without local media; the user can enable later if permissions change
      }

      // Set auth token BEFORE making any meeting API calls
      const token = await getAuthToken();
      if (token) {
        await setMeetingAuthToken(token);
      }

      let connectionData;

      if (isPreview && previewData) {
        connectionData = {
          token: previewData.accessToken,
          roomName: previewData.roomName,
          wsUrl: previewData.wsURL,
          userRole: previewData.userRole,
          isPreview: true,
        };
      } else {
        // Use debug endpoint if auth fails (temporary for debugging)
        const debugUrl = `${getMeetingApiUrl()}/debug/rooms/${meetingId}/join`;
        const debugResponse = await fetch(debugUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            displayName: `${user?.firstName || 'User'} ${user?.lastName || ''}`.trim(),
            role: userRole,
            userId: user?.id, // Pass userId so backend can create participant with correct user_id
          }),
        });

        if (!debugResponse.ok) {
          const response = await meetingApi.joinRoom(meetingId, {
            displayName: `${user?.firstName || 'User'} ${user?.lastName || ''}`.trim(),
            role: userRole,
            userId: user?.id, // Pass userId for unauthenticated joins
          });
          if (!response) {
            throw new Error('Failed to join meeting');
          }
          connectionData = response;
        } else {
          connectionData = await debugResponse.json();
        }
      }

      setMeetingData(connectionData);

      // Store participantId for later API calls
      if (connectionData.participantId) {
        participantIdRef.current = connectionData.participantId;
      }

      // Initialize WebRTC
      await initializeWebRTC(connectionData);

      // Mark attendance
      if (!isPreview) {
        await markAttendance();
      }

       // Load participants
       await updateParticipantsList();
       // Roster is now synced — further joins are real arrivals worth a toast.
       initialLoadDoneRef.current = true;
       // Load existing chat history so newcomers see the backlog
       await loadChatHistory();

       setIsConnected(true);
      setIsConnecting(false);
      hasJoinedRef.current = true;

      Toast.show({
        type: 'success',
        text1: isPreview ? 'Preview mode active' : 'Connected to meeting',
        text2: isPreview ? 'You are previewing the meeting room' : 'You have successfully joined the meeting',
      });

      setIsCameraEnabled(true);
      setIsMicrophoneEnabled(true);
    } catch (error) {
      console.error('Failed to initialize meeting:', error);
      setConnectionError(error.message);
      setIsConnecting(false);

      // Check if this is a permission error and offer to open settings
      const isPermissionError = /permissions? are required|Camera and microphone access is required|NotAllowedError|Permission denied|not allowed by the user agent/i.test(error.message || '');

      if (isPermissionError && Platform.OS === 'android') {
        Alert.alert(
          'Permissions Required',
          'Camera and microphone access is required to join the meeting. Please enable them in Settings > Apps > VaultKe > Permissions.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings()
            },
          ]
        );
      } else {
        Toast.show({
          type: 'error',
          text1: 'Connection failed',
          text2: error.message,
        });
      }
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.MODIFY_AUDIO_SETTINGS,
      ];

      const granted = await PermissionsAndroid.requestMultiple(permissions);
      const denied = Object.values(granted).filter(p => p !== PermissionsAndroid.RESULTS.GRANTED);

      if (denied.length > 0) {
        // Check if user selected "Don't ask again"
        const neverAskAgain = Object.entries(granted).some(
          ([key, value]) => value === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        );
        
        if (neverAskAgain) {
          throw new Error('Camera and microphone permissions are required. Please enable them in Settings > Apps > VaultKe > Permissions.');
        }
        throw new Error('Camera and microphone permissions are required for video calls');
      }
    }
    // iOS permissions are requested automatically by the system when accessing camera/microphone
    // The NSCameraUsageDescription and NSMicrophoneUsageDescription in Info.plist provide the prompt text
  };

  const getAuthToken = async () => {
    try {
      return await getMainAuthToken();
    } catch (e) {
      return null;
    }
  };

  const getHumanName = (value, fallback = 'Guest') => {
    if (!value) return fallback;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return fallback;
      return trimmed;
    }
    if (typeof value === 'object') {
      const parts = [
        value.displayName,
        value.name,
        value.fullName,
        value.firstName && value.lastName ? `${value.firstName} ${value.lastName}` : value.firstName || value.lastName,
      ].filter(Boolean);
      const resolved = parts[0];
      return resolved || fallback;
    }
    return fallback;
  };

  const truncateName = (value, maxLength = 18) => {
    const name = getHumanName(value, 'Guest');
    if (name.length <= maxLength) return name;
    return `${name.slice(0, Math.max(1, maxLength - 1)).trim()}…`;
  };

  const upsertRemoteStreamPlaceholder = (userId, connId, displayName) => {
    if (!userId || userId === user?.id) return;

    setRemoteStreams(prev => {
      const candidateConnId = connId || userId;
      const existingIndex = prev.findIndex(s =>
        (s.userId && s.userId === userId) || (s.connId && s.connId === candidateConnId)
      );

      const resolvedName = truncateName(displayName || 'Guest');

      if (existingIndex >= 0) {
        return prev.map((s, index) =>
          index === existingIndex
            ? {
                ...s,
                // Only a real signaling connId may overwrite an existing one.
                // The REST roster has no connId, and letting its userId
                // fallback win would re-key the tile so later connId-addressed
                // events (screen share, ICE-driven stream updates) no longer
                // match it.
                connId: connId || s.connId || candidateConnId,
                userId,
                name: resolvedName,
              }
            : s
        );
      }

      return [...prev, {
        connId: candidateConnId,
        userId,
        stream: null,
        screenStream: null,
        name: resolvedName,
        isScreenSharing: false,
      }];
    });
  };

  const mergeParticipantEntry = (prev, incoming) => {
    if (!incoming) return prev;

    const incomingUserId = incoming.userId || incoming.payload?.userId || null;
    const incomingConnId = incoming.connId || incoming.payload?.connId || null;
    if (!incomingUserId && !incomingConnId) return prev;

    const identityMatches = (entry) => {
      const entryUserId = entry.userId || entry.payload?.userId || null;
      const entryConnId = entry.connId || entry.payload?.connId || null;
      return (
        (incomingUserId && entryUserId && incomingUserId === entryUserId) ||
        (incomingConnId && entryConnId && incomingConnId === entryConnId)
      );
    };

    const existingIndex = prev.findIndex(identityMatches);
    if (existingIndex >= 0) {
      const updatedEntry = {
        ...prev[existingIndex],
        ...incoming,
        ...(incoming.payload || {}),
        userId: incomingUserId || prev[existingIndex].userId || incoming.payload?.userId,
        connId: incomingConnId || prev[existingIndex].connId || incoming.payload?.connId,
      };
      return prev.map((entry, index) => index === existingIndex ? updatedEntry : entry);
    }

    return [...prev, incoming];
  };

  const initializeWebRTC = async (connectionData) => {
    const client = createWebRTCClient();
    webrtcClientRef.current = client;
    // Without this, every peer connection was STUN-only: fine on the same
    // network, but two participants on separate mobile-data NATs would never
    // find each other's media path (signaling still works since it's not
    // peer-to-peer), so their camera/screen just never showed up for the
    // other side.
    client.setIceServers(connectionData.turn, connectionData.turnCredentials);

    client.on('localStream', (stream) => {
      setLocalStream(stream);
    });

    client.on('remoteStream', ({ connId, userId, stream, screenStream, isScreenSharing = false }) => {
      setRemoteStreams(prev => {
        const existingIndex = prev.findIndex(s =>
          (s.connId && connId && s.connId === connId) || (s.userId && userId && s.userId === userId)
        );

        if (existingIndex < 0) {
          return [...prev, {
            connId: connId || userId,
            userId,
            stream,
            screenStream: screenStream || null,
            isScreenSharing,
            name: truncateName(getHumanName({ displayName: userId ? undefined : undefined }, 'Guest')),
          }];
        }

        return prev.map((s, index) =>
          index === existingIndex
            ? {
                ...s,
                connId: connId || s.connId,
                userId: userId || s.userId,
                stream,
                screenStream: screenStream || s.screenStream || null,
                isScreenSharing,
              }
            : s
        );
      });
    });

    client.on('screenShareStarted', (data) => {
      console.log('[Meeting] screenShareStarted event received:', data);
      if (!data || (!data.connId && !data.userId)) return;
      if (data.userId && data.userId === user?.id) return;

      setRemoteScreenSharer({ connId: data.connId || null, userId: data.userId || null });

      const sharerName = data.displayName || getParticipantName(data.userId);
      Toast.show({
        type: 'info',
        text1: `${truncateName(sharerName)} started sharing their screen`,
        position: 'top',
      });
    });

    client.on('screenShareStopped', (data) => {
      console.log('[Meeting] screenShareStopped event received:', data);
      // The local user stopping their own share emits no data; a remote one
      // carries { connId, userId }.
      if (!data || (!data.connId && !data.userId)) return;
      if (data.userId && data.userId === user?.id) return;

      setRemoteScreenSharer(prev => {
        if (!prev) return null;
        const sameConn = data.connId && prev.connId === data.connId;
        const sameUser = data.userId && prev.userId === data.userId;
        return sameConn || sameUser ? null : prev;
      });
    });

    // The share was ended outside the app (Android's "Stop sharing"
    // notification / the browser's sharing bar), so tear our own state down.
    client.on('screenShareEnded', () => {
      console.log('[Meeting] Local screen share ended by the system');
      stopLocalScreenShare({ notify: true });
    });

    client.on('screenShareRejected', (payload) => {
      // Server rejected our screen share (someone else is already sharing).
      screenShareRejectedRef.current = true;
      clearScreenShareWatchdog();
      if (webrtcClientRef.current?.screenStream) {
        webrtcClientRef.current?.stopScreenShare();
      }
      setScreenStream(null);
      setIsScreenSharing(false);
      isScreenSharingRef.current = false;
      Toast.show({
        type: 'warning',
        text1: 'Screen share declined',
        text2: payload?.reason === 'another-participant-already-sharing'
          ? 'Another participant is already sharing their screen'
          : 'Unable to start screen sharing',
      });
    });

    // Ground truth that our current screen share is actually visible
    // somewhere: a viewer only sends this once real frames start arriving on
    // their end (see webrtcClient's watchScreenTrackForAck).
    client.on('screenShareAck', ({ connId, userId: viewerUserId }) => {
      if (!isScreenSharingRef.current || !connId) return;
      if (screenShareViewerConnIdsRef.current.has(connId)) return;
      console.log('[ScreenShare] Viewer confirmed receiving our screen:', { connId, viewerUserId });
      screenShareViewerConnIdsRef.current = new Set(screenShareViewerConnIdsRef.current).add(connId);
      setScreenShareViewerConnIds(screenShareViewerConnIdsRef.current);
    });

    // Surface connection trouble specifically while we're sharing, since a
    // dropped/failed peer connection silently blinds that one viewer without
    // anything else in the UI changing.
    client.on('connectionStateChange', ({ connId, state }) => {
      if (!isScreenSharingRef.current) return;
      if (state !== 'failed' && state !== 'disconnected') return;
      console.warn('[ScreenShare] Peer connection went', state, 'while sharing:', connId);
      const peer = participantsRef.current.find(part => (part.connId || part.payload?.connId) === connId);
      const peerName = peer?.displayName || peer?.payload?.displayName || peer?.name || 'a participant';
      Toast.show({
        type: 'warning',
        text1: 'Screen share may be interrupted',
        text2: `Connection to ${truncateName(peerName)} is having trouble`,
        position: 'top',
      });
    });

    client.on('participantJoined', (message) => {
      const isNew = !participantsRef.current.some(p => {
        const currentUserId = p.userId || p.payload?.userId;
        const messageUserId = message.userId || message.payload?.userId;
        return currentUserId && messageUserId && currentUserId === messageUserId;
      });
      setParticipants(prev => mergeParticipantEntry(prev, message));

      // Add participant to remoteStreams as a placeholder so they appear in
      // the video grid even before they enable their camera/microphone.
      // The stream will be updated to the actual media when tracks arrive.
      if (message.userId !== user?.id) {
        upsertRemoteStreamPlaceholder(
          message.userId,
          message.connId || message.payload?.connId,
          message.displayName || message.payload?.displayName || message.name || 'Guest'
        );
      }

      // Track this participant so polling doesn't duplicate the event
      if (message.userId) {
        knownParticipantIdsRef.current.add(message.userId);
      }

      // Log participant join for debugging
      console.log('[Meeting] Participant joined:', {
        userId: message.userId,
        displayName: message.displayName || message.payload?.displayName || 'Unknown',
        connId: message.connId,
        isSelf: message.userId === user?.id,
        totalParticipants: participantsRef.current.length + (isNew ? 1 : 0),
      });

      if (isNew && initialLoadDoneRef.current && message.userId !== user?.id) {
        const name =
          message.displayName ||
          message.payload?.displayName ||
          message.name ||
          'Someone';
        setTimeout(() => {
          Toast.show({
            type: 'info',
            text1: `${name} joined the meeting`,
            position: 'top',
          });
        }, 120);
      }
    });

    client.on('participantLeft', (message) => {
      setParticipants(prev => prev.filter(p => {
        const currentUserId = p.userId || p.payload?.userId;
        const currentConnId = p.connId || p.payload?.connId;
        return !(
          (message.userId && currentUserId === message.userId) ||
          (message.connId && currentConnId === message.connId)
        );
      }));
      setRemoteStreams(prev => prev.filter(s =>
        !((message.userId && s.userId === message.userId) || (message.connId && s.connId === message.connId))
      ));

      // If the participant who left was sharing, drop the share so the main
      // stage falls back to the remaining participants.
      setRemoteScreenSharer(prev => {
        if (!prev) return null;
        const sameConn = message.connId && prev.connId === message.connId;
        const sameUser = message.userId && prev.userId === message.userId;
        return sameConn || sameUser ? null : prev;
      });

      // Remove from known IDs so polling doesn't re-add them
      if (message.userId) {
        knownParticipantIdsRef.current.delete(message.userId);
      }

      // Log participant leave for debugging
      console.log('[Meeting] Participant left:', {
        userId: message.userId,
        connId: message.connId,
        totalParticipants: participantsRef.current.length - 1,
      });

      if (initialLoadDoneRef.current && message.userId !== user?.id) {
        const left = participantsRef.current.find(p => p.userId === message.userId);
        const name =
          left?.displayName ||
          left?.payload?.displayName ||
          left?.name ||
          'Someone';
        Toast.show({
          type: 'info',
          text1: `${name} left the meeting`,
          position: 'top',
        });
      }
    });

    client.on('participantUpdated', (message) => {
      setParticipants(prev => {
        const updated = prev.map(p =>
          (p.userId || p.payload?.userId) === (message.userId || message.payload?.userId)
            ? { ...p, ...message.payload, userId: message.userId || p.userId || message.payload?.userId }
            : p
        );
        return updated.some(p => (p.userId || p.payload?.userId) === (message.userId || message.payload?.userId)) ? updated : [...updated, message];
      });
    });

    client.on('chatMessage', (message) => {
      setChatMessages(prev => [...prev, {
        ...message,
        isOwn: message.senderId === user?.id,
      }]);
    });

    client.on('roomEnded', () => {
      Toast.show({
        type: 'info',
        text1: 'Meeting Ended',
        text2: 'The meeting has been ended by the host',
      });
      navigation.goBack();
    });

    client.on('error', (error) => {
      console.error('WebRTC error:', error);
      if (error.type === 'websocket') {
        setConnectionError('Connection lost. Reconnecting...');
      }
    });

    client.on('connected', () => {
      setConnectionError(null);
      // Refresh participants list on (re)connect to catch any joins/leaves
      // that may have occurred while the client was disconnected.
      // This ensures the UI is always up-to-date.
      console.log('[Meeting] Connection established, refreshing participants...');
      updateParticipantsList();
    });

    let stream = null;
    try {
      stream = await client.initLocalMedia();
    } catch (mediaError) {
      console.warn('Could not initialize local media, continuing without it:', mediaError);
      // Keep camera/mic disabled; user can try enabling later
      setIsCameraEnabled(false);
      setIsMicrophoneEnabled(false);
    }
    setLocalStream(stream);

    await client.connectSignaling(
      connectionData.roomId || meetingId,
      user?.id || 'user',
      connectionData.participantId,
      connectionData.displayName || `${user?.firstName || 'User'} ${user?.lastName || ''}`.trim()
    );
  };

  const markAttendance = async () => {
    try {
      await meetingApi.sendChatMessage(meetingId, 'Joined meeting', 'system');
    } catch (error) {
      console.error('Failed to mark attendance:', error);
    }
  };

  const updateParticipantsList = async () => {
    try {
      const response = await meetingApi.getParticipants(meetingId);
      if (response && response.participants) {
        const nextParticipants = response.participants;
        setParticipants(prev => {
          const merged = nextParticipants.reduce((acc, participant) => mergeParticipantEntry(acc, participant), prev);
          return merged;
        });
        knownParticipantIdsRef.current = new Set(nextParticipants.map(p => p.userId || p.payload?.userId || p.memberId).filter(Boolean));

        nextParticipants.forEach((participant) => {
          const participantUserId = participant.userId || participant.payload?.userId || participant.memberId;
          if (participantUserId && participantUserId !== user?.id) {
            upsertRemoteStreamPlaceholder(
              participantUserId,
              participant.connId || participant.payload?.connId || participant.userId,
              participant.displayName || participant.name || participant.payload?.displayName || participant.payload?.name || 'Guest'
            );
          }
        });

        console.log('[Meeting] Participants synced:', nextParticipants.length);
      }
    } catch (error) {
      console.error('Failed to update participants:', error);
    }
  };

   const loadChatHistory = async () => {
     try {
       const response = await meetingApi.getChatMessages(meetingId);
       if (response && response.messages) {
         setChatMessages(response.messages.map(msg => ({
           ...msg,
           isOwn: msg.userId === user?.id,
         })));
       }
     } catch (error) {
       console.error('Failed to load chat history:', error);
     }
   };

   const handleToggleCamera = async () => {
    const newState = !isCameraEnabled;

    // If turning on but we have no local stream yet, try to re-acquire media
    if (newState && !localStream && webrtcClientRef.current) {
      try {
        await webrtcClientRef.current.initLocalMedia();
      } catch (e) {
        Toast.show({
          type: 'error',
          text1: 'Camera unavailable',
          text2: e.message || 'Could not enable camera. Please check permissions.',
        });
        setIsCameraEnabled(false);
        return;
      }
    }

    setIsCameraEnabled(newState);

    if (webrtcClientRef.current) {
      webrtcClientRef.current.toggleVideo(newState);
    }

    try {
      await meetingApi.updateParticipant(meetingId, { isVideoOn: newState });
    } catch (error) {
      console.error('Failed to update video state:', error);
      // Don't show toast for "user not in room" - it's a non-critical sync error
      if (!error.message?.includes('user not in room')) {
        Toast.show({
          type: 'warning',
          text1: 'Sync warning',
          text2: 'Camera state may not be synced to server',
        });
      }
    }

    Toast.show({
      type: 'success',
      text1: newState ? 'Camera enabled' : 'Camera disabled',
      text2: newState ? 'Your camera is now on' : 'Your camera is now off',
    });
  };

  const handleToggleMicrophone = async () => {
    const newState = !isMicrophoneEnabled;

    // If turning on but we have no local stream yet, try to re-acquire media
    if (newState && !localStream && webrtcClientRef.current) {
      try {
        await webrtcClientRef.current.initLocalMedia();
      } catch (e) {
        Toast.show({
          type: 'error',
          text1: 'Microphone unavailable',
          text2: e.message || 'Could not enable microphone. Please check permissions.',
        });
        setIsMicrophoneEnabled(false);
        return;
      }
    }

    setIsMicrophoneEnabled(newState);

    if (webrtcClientRef.current) {
      webrtcClientRef.current.toggleAudio(newState);
    }

    try {
      await meetingApi.updateParticipant(meetingId, { isMuted: !newState });
    } catch (error) {
      console.error('Failed to update mic state:', error);
      // Don't show toast for "user not in room" - it's a non-critical sync error
      if (!error.message?.includes('user not in room')) {
        Toast.show({
          type: 'warning',
          text1: 'Sync warning',
          text2: 'Microphone state may not be synced to server',
        });
      }
    }

    Toast.show({
      type: 'success',
      text1: newState ? 'Microphone enabled' : 'Microphone disabled',
      text2: newState ? 'Your microphone is now on' : 'Your microphone is now off',
    });
  };

  const handleSwitchCamera = async () => {
    try {
      if (webrtcClientRef.current) {
        await webrtcClientRef.current.switchCamera();
      }
      Toast.show({
        type: 'success',
        text1: 'Camera switched',
        text2: 'Your camera view has been switched',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to switch camera',
      });
    }
  };

  const clearScreenShareWatchdog = () => {
    if (screenShareWatchdogRef.current) {
      clearTimeout(screenShareWatchdogRef.current);
      screenShareWatchdogRef.current = null;
    }
    screenShareViewerConnIdsRef.current = new Set();
    setScreenShareViewerConnIds(new Set());
  };

  const stopLocalScreenShare = async ({ notify = true } = {}) => {
    const client = webrtcClientRef.current;

    clearScreenShareWatchdog();

    try {
      await client?.stopScreenShare();
    } catch (e) {
      console.warn('Failed to stop screen capture:', e?.message || e);
    }

    setScreenStream(null);
    setIsScreenSharing(false);
    isScreenSharingRef.current = false;

    if (notify) {
      client?.sendScreenShareStopped();
      try {
        await meetingApi.updateParticipant(meetingId, { isScreenSharing: false });
      } catch (e) {
        console.warn('Failed to sync screen-share state to server:', e?.message);
      }
    }
  };

  const handleToggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        screenShareRejectedRef.current = false;

        // Capture first, then announce. Announcing up front made peers switch
        // to a "screen" tile while it still carried the camera, and left them
        // showing a phantom share if the capture prompt was cancelled.
        const stream = await webrtcClientRef.current?.initScreenShare();
        if (!stream) return;

        // Push the screen onto every peer connection *before* telling the room,
        // so the announcement can never arrive ahead of the media.
        await webrtcClientRef.current?.replaceScreenShareTrack(stream);

        // The server enforces one sharer per room: it either relays
        // `screen-share-started` to the other peers or replies with
        // `screen-share-rejected` (handled in initializeWebRTC).
        webrtcClientRef.current?.sendScreenShareStarted();

        if (screenShareRejectedRef.current) {
          await stopLocalScreenShare({ notify: false });
          return;
        }

        setScreenStream(stream);
        setIsScreenSharing(true);
        isScreenSharingRef.current = true;
        clearScreenShareWatchdog();

        try {
          await meetingApi.updateParticipant(meetingId, { isScreenSharing: true });
        } catch (e) {
          console.warn('Failed to sync screen-share state to server:', e?.message);
        }

        Toast.show({
          type: 'success',
          text1: 'Screen sharing started',
          text2: 'You are now sharing your screen',
        });

        // Give viewers a few seconds to negotiate/unmute and ack, then check
        // whether *anyone* actually confirmed seeing it. A silent failure
        // here (e.g. the "safe" screen m-line still not reaching a peer)
        // would otherwise look identical to a share nobody just happened to
        // look at yet.
        const otherPeers = webrtcClientRef.current?.getActiveConnectionCount() || 0;
        if (otherPeers > 0) {
          screenShareWatchdogRef.current = setTimeout(() => {
            if (!isScreenSharingRef.current) return;
            if (screenShareViewerConnIdsRef.current.size > 0) {
              console.log('[ScreenShare] Confirmed visible to', screenShareViewerConnIdsRef.current.size, 'participant(s)');
              return;
            }
            console.warn('[ScreenShare] No viewer has acked the share yet', {
              otherPeers,
              elapsedMs: 8000,
            });
            Toast.show({
              type: 'warning',
              text1: 'Screen share not confirmed',
              text2: "Other participants may not be seeing your screen. Check your connection and try re-sharing if it doesn't clear up.",
              position: 'top',
              visibilityTime: 6000,
            });
          }, 8000);
        }
      } else {
        await stopLocalScreenShare();
        Toast.show({
          type: 'success',
          text1: 'Screen sharing stopped',
          text2: 'You are no longer sharing your screen',
        });
      }
    } catch (error) {
      clearScreenShareWatchdog();
      setIsScreenSharing(false);
      isScreenSharingRef.current = false;
      setScreenStream(null);
      const isCancelled = /cancel|denied|permission/i.test(error?.message || '');
      Toast.show({
        type: isCancelled ? 'info' : 'error',
        text1: isCancelled ? 'Screen sharing cancelled' : 'Error',
        text2: isCancelled ? 'You did not allow screen capture' : (error.message || 'Failed to toggle screen sharing'),
      });
    }
  };

  const handleSendChatMessage = async (content) => {
    try {
      const response = await meetingApi.sendChatMessage(meetingId, content);
      // Mark as own message; avoid duplicates since WebSocket broadcast will also deliver it
      setChatMessages(prev => {
        // Check if the WebSocket already delivered this message (same id)
        if (prev.some(m => m.id === response.id)) {
          return prev;
        }
        return [...prev, { ...response, isOwn: true }];
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to send message',
      });
    }
  };

  // Leaving only ever removes the clicking participant, the same for every
  // role — an online meeting keeps running for everyone else, same as
  // Zoom/Meet/Teams. react-native-web's Alert.alert() is a no-op stub (it
  // never shows anything and never calls a button handler), so on web the
  // button silently did nothing; window.confirm is the web-safe equivalent.
  const handleEndCall = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to leave the meeting?')) {
        leaveMeeting();
      }
      return;
    }

    Alert.alert(
      'Leave Meeting',
      'Are you sure you want to leave the meeting?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: leaveMeeting,
        },
      ]
    );
  };

  const handleBackPress = () => {
    handleEndCall();
    return true;
  };

  const leaveMeeting = async () => {
    try {
      hasJoinedRef.current = false;

      if (webrtcClientRef.current) {
        webrtcClientRef.current.sendSignalingMessage({
          type: SIGNALING_MESSAGE_TYPES.LEAVE,
          roomId: meetingId,
          userId: user?.id,
          connId: webrtcClientRef.current.connId,
        });
      }

      await meetingApi.leaveRoom(meetingId);
      cleanup();
      navigation.goBack();
    } catch (error) {
      console.error('Failed to leave meeting:', error);
      navigation.goBack();
    }
  };

  const cleanup = () => {
    if (webrtcClientRef.current) {
      webrtcClientRef.current.disconnect();
      webrtcClientRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (screenShareWatchdogRef.current) {
      clearTimeout(screenShareWatchdogRef.current);
      screenShareWatchdogRef.current = null;
    }

    // Stop the polling interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    clearMeetingAuthToken();
  };

  // Reliable participant sync: poll the API periodically to catch any
  // joins/leaves that were missed due to WebSocket disconnections.
  const startParticipantPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    updateParticipantsList();

    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await meetingApi.getParticipants(meetingId);
        if (!response || !response.participants) return;

        const apiParticipants = response.participants;
const currentIds = new Set(apiParticipants.map(p => p.userId || p.payload?.userId || p.memberId).filter(Boolean));
      const previousIds = new Set(knownParticipantIdsRef.current);

      // Detect new joins
      const newJoins = apiParticipants.filter(p => {
        const id = p.userId || p.payload?.userId || p.memberId;
        return id && !previousIds.has(id);
      });
        const leftIds = [...previousIds].filter(id => !currentIds.has(id));

        knownParticipantIdsRef.current = currentIds;

        for (const joined of newJoins) {
          if (joined.userId === user?.id) continue;
          console.log('[Meeting] Poll: participant joined:', joined.userId);
          setParticipants(prev => mergeParticipantEntry(prev, joined));
          upsertRemoteStreamPlaceholder(
            joined.userId,
            joined.connId || joined.userId,
            joined.displayName || joined.name || 'Participant'
          );
          if (initialLoadDoneRef.current) {
            setTimeout(() => {
              Toast.show({ type: 'info', text1: `${joined.displayName || 'Someone'} joined`, position: 'top' });
            }, 120);
          }
        }

        for (const leftId of leftIds) {
          console.log('[Meeting] Poll: participant left:', leftId);
          setParticipants(prev => prev.filter(p => {
            const candidateId = p.userId || p.payload?.userId || p.memberId;
            return candidateId !== leftId;
          }));
          setRemoteStreams(prev => prev.filter(s => (s.userId || s.payload?.userId) !== leftId));
          if (initialLoadDoneRef.current) {
            const left = participantsRef.current.find(p => (p.userId || p.payload?.userId || p.memberId) === leftId);
            const leftName = left?.displayName || left?.payload?.displayName || left?.name || 'Someone';
            Toast.show({ type: 'info', text1: `${leftName} left`, position: 'top' });
          }
        }
      } catch (error) {
        console.warn('[Meeting] Poll failed:', error.message);
      }
    }, 1500);
  };

  useEffect(() => {
    if (isConnected && !isReadOnly) {
      startParticipantPolling();
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isConnected, isReadOnly]);

  // Build a userId -> displayName lookup from the participants list (API + signaling).
  const getParticipantName = (userId) => {
    if (!userId) return 'Guest';
    const p = participants.find(part => part.userId === userId);
    if (p && (p.displayName || p.name)) return p.displayName || p.name;
    const joined = participants.find(part => part.payload?.userId === userId);
    if (joined && joined.payload?.displayName) return joined.payload.displayName;
    return 'Guest';
  };

  // Keep a live mirror of the participants list for event handlers that close
  // over stale state (so join/leave toasts can read the latest roster).
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    isScreenSharingRef.current = isScreenSharing;
  }, [isScreenSharing]);

  // Keep display names synced onto remote stream entries so the UI can label
  // each tile even when the name arrives after the first media track.
  useEffect(() => {
    setRemoteStreams(prev => {
      const needsUpdate = prev.some(s => s.name !== getParticipantName(s.userId));
      if (!needsUpdate) return prev;
      return prev.map(s => ({ ...s, name: getParticipantName(s.userId) }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants.length]);

  // Flag the sharer's tile from the signaling identity rather than trusting the
  // flag that happened to be attached when a stream event arrived. A tile is
  // matched on connId *or* userId because the REST roster and the signaling
  // channel identify participants differently.
  const decoratedRemoteStreams = useMemo(() => {
    if (!remoteScreenSharer) {
      return remoteStreams.some(s => s.isScreenSharing)
        ? remoteStreams.map(s => (s.isScreenSharing ? { ...s, isScreenSharing: false } : s))
        : remoteStreams;
    }

    return remoteStreams.map((s) => {
      const isSharer = Boolean(
        (remoteScreenSharer.connId && s.connId === remoteScreenSharer.connId) ||
        (remoteScreenSharer.userId && s.userId === remoteScreenSharer.userId)
      );
      return s.isScreenSharing === isSharer ? s : { ...s, isScreenSharing: isSharer };
    });
  }, [remoteStreams, remoteScreenSharer]);

  return {
    isConnecting,
    isConnected,
    participants,
    isCameraEnabled,
    isMicrophoneEnabled,
    isScreenSharing,
    screenStream,
    // How many participants have actually confirmed (via screen-share-ack)
    // that our current share is rendering real frames for them -- see
    // handleToggleScreenShare's watchdog for what happens when this stays 0.
    screenShareViewerCount: screenShareViewerConnIds.size,
    meetingTitle,
    userRole,
    meetingData,
    connectionError,
    localStream,
    remoteStreams: decoratedRemoteStreams,
    chatMessages,
    isChatOpen,
    handleToggleCamera,
    handleToggleMicrophone,
    handleSwitchCamera,
    handleToggleScreenShare,
    handleEndCall,
    handleSendChatMessage,
    setIsChatOpen,
    leaveMeeting,
  };
};

export default useOnlineMeetingScreen;
