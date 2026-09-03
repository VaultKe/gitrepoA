import { useState, useEffect, useRef, useCallback } from 'react';
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
                connId: candidateConnId,
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

    client.on('localStream', (stream) => {
      setLocalStream(stream);
    });

    client.on('remoteStream', ({ connId, userId, stream, isScreenSharing = false }) => {
      setRemoteStreams(prev => {
        const existingIndex = prev.findIndex(s =>
          (s.connId && connId && s.connId === connId) || (s.userId && userId && s.userId === userId)
        );

        if (existingIndex < 0) {
          return [...prev, {
            connId: connId || userId,
            userId,
            stream,
            isScreenSharing,
            name: truncateName(getHumanName({ displayName: userId ? undefined : undefined }, 'Guest')),
          }];
        }

        return prev.map((s, index) =>
          index === existingIndex
            ? { ...s, connId: connId || s.connId, userId: userId || s.userId, stream, isScreenSharing }
            : s
        );
      });
    });

    client.on('screenShareStarted', (data) => {
      console.log('[Meeting] screenShareStarted event received:', data);
      if (data && (data.connId || data.userId)) {
        setRemoteStreams(prev =>
          prev.map(s =>
            (s.connId === data.connId || s.userId === data.userId)
              ? { ...s, connId: data.connId || s.connId, userId: data.userId || s.userId, isScreenSharing: true }
              : s
          )
        );
      }
    });

    client.on('screenShareStopped', (data) => {
      console.log('[Meeting] screenShareStopped event received:', data);
      // When local user stops sharing, no data is passed
      // When remote user stops sharing, data contains { connId, userId }
      if (data && (data.connId || data.userId)) {
        setRemoteStreams(prev =>
          prev.map(s =>
            (s.connId === data.connId || s.userId === data.userId)
              ? { ...s, connId: data.connId || s.connId, userId: data.userId || s.userId, isScreenSharing: false }
              : s
          )
        );
      }
    });

    client.on('screenShareRejected', (payload) => {
      // Server rejected our screen share (someone else is already sharing).
      screenShareRejectedRef.current = true;
      if (webrtcClientRef.current?.screenStream) {
        webrtcClientRef.current?.stopScreenShare();
      }
      setScreenStream(null);
      setIsScreenSharing(false);
      Toast.show({
        type: 'warning',
        text1: 'Screen share declined',
        text2: payload?.reason === 'another-participant-already-sharing'
          ? 'Another participant is already sharing their screen'
          : 'Unable to start screen sharing',
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

  const handleToggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        screenShareRejectedRef.current = false;
        // Ask the server to coordinate: only one sharer per room. The server
        // either broadcasts `screenShareStarted` to peers or, if someone else
        // is already sharing, emits `screenShareRejected` (handled above).
        webrtcClientRef.current?.sendScreenShareStarted();

        // Optimistically start. If the server rejects (screenShareRejected fires
        // during the await below), we abort before replacing the outgoing track.
        const screenStream = await webrtcClientRef.current?.initScreenShare();
        if (screenShareRejectedRef.current) {
          return;
        }
        if (screenStream) {
          await webrtcClientRef.current?.replaceVideoTrack(screenStream);
          if (screenShareRejectedRef.current) {
            // Rejected while capturing; roll back.
            await webrtcClientRef.current?.stopScreenShare();
            setScreenStream(null);
            return;
          }
          setScreenStream(screenStream);
          setIsScreenSharing(true);
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
        }
      } else {
        await webrtcClientRef.current?.stopScreenShare();
        setScreenStream(null);
        setIsScreenSharing(false);
        webrtcClientRef.current?.sendScreenShareStopped();
        try {
          await meetingApi.updateParticipant(meetingId, { isScreenSharing: false });
        } catch (e) {
          console.warn('Failed to sync screen-share state to server:', e?.message);
        }
        Toast.show({
          type: 'success',
          text1: 'Screen sharing stopped',
          text2: 'You are no longer sharing your screen',
        });
      }
    } catch (error) {
      setIsScreenSharing(false);
      setScreenStream(null);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to toggle screen sharing',
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

  const handleEndCall = () => {
    Alert.alert(
      'End Meeting',
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

  return {
    isConnecting,
    isConnected,
    participants,
    isCameraEnabled,
    isMicrophoneEnabled,
    isScreenSharing,
    screenStream,
    meetingTitle,
    userRole,
    meetingData,
    connectionError,
    localStream,
    remoteStreams,
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
