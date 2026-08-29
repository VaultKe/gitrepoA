import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, BackHandler, Linking, PermissionsAndroid, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { useApp } from '../context/AppContext';
import { meetingApi, setMeetingAuthToken, clearMeetingAuthToken } from '../services/meetingApi';
import { getWebRTCClient, MEDIA_CONSTRAINTS, SIGNALING_MESSAGE_TYPES } from '../services/webrtcClient';
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
  } = route.params;

  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [meetingData, setMeetingData] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const webrtcClientRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const participantIdRef = useRef(null);

  // Initialize meeting
  useEffect(() => {
    if (isReadOnly) {
      setIsConnecting(false);
      return;
    }

    initializeMeeting();

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

  const initializeWebRTC = async (connectionData) => {
    const client = getWebRTCClient();
    webrtcClientRef.current = client;

    client.on('localStream', (stream) => {
      setLocalStream(stream);
    });

    client.on('remoteStream', ({ connId, userId, stream, isScreenSharing = false }) => {
      setRemoteStreams(prev => {
        const exists = prev.find(s => s.connId === connId);
        if (!exists) {
          return [...prev, { connId, userId, stream, isScreenSharing }];
        }
        // Update existing entry (track may have been replaced for screen share)
        return prev.map(s =>
          s.connId === connId ? { ...s, stream, isScreenSharing } : s
        );
      });
    });

    client.on('screenShareStarted', ({ connId, userId }) => {
      setRemoteStreams(prev =>
        prev.map(s => (s.connId === connId ? { ...s, isScreenSharing: true } : s))
      );
    });

    client.on('screenShareStopped', ({ connId, userId }) => {
      setRemoteStreams(prev =>
        prev.map(s => (s.connId === connId ? { ...s, isScreenSharing: false } : s))
      );
    });

    client.on('screenShareRejected', (payload) => {
      // Server rejected our screen share (someone else is already sharing).
      if (isScreenSharing) {
        setIsScreenSharing(false);
        setScreenStream(null);
      }
      Toast.show({
        type: 'warning',
        text1: 'Screen share declined',
        text2: payload?.reason === 'another-participant-already-sharing'
          ? 'Another participant is already sharing their screen'
          : 'Unable to start screen sharing',
      });
    });

    client.on('participantJoined', (message) => {
      setParticipants(prev => {
        const exists = prev.find(p => p.userId === message.userId);
        if (!exists) {
          return [...prev, message];
        }
        return prev;
      });
    });

    client.on('participantLeft', (message) => {
      setParticipants(prev => prev.filter(p => p.userId !== message.userId));
      setRemoteStreams(prev => prev.filter(s => s.connId !== message.connId));
    });

    client.on('participantUpdated', (message) => {
      setParticipants(prev =>
        prev.map(p =>
          p.userId === message.userId
            ? { ...p, ...message.payload, userId: message.userId }
            : p
        )
      );
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
      connectionData.participantId
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
        setParticipants(response.participants);
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
        // Ask the server to coordinate: only one sharer per room. The server
        // either broadcasts `screenShareStarted` to peers or, if someone else
        // is already sharing, emits `screenShareRejected` (handled above).
        webrtcClientRef.current?.sendScreenShareStarted();

        // Optimistically start. If the server rejects, the screenShareRejected
        // handler rolls us back.
        const screenStream = await webrtcClientRef.current?.initScreenShare();
        if (screenStream) {
          await webrtcClientRef.current?.replaceVideoTrack(screenStream);
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

     clearMeetingAuthToken();
   };

   // Build a userId -> displayName lookup from the participants list (API + signaling).
   const getParticipantName = (userId) => {
     if (!userId) return 'Participant';
     const p = participants.find(part => part.userId === userId);
     if (p && (p.displayName || p.name)) return p.displayName || p.name;
     // The signaling participant-joined payload nests details in .payload
     const joined = participants.find(part => part.payload?.userId === userId);
     if (joined && joined.payload?.displayName) return joined.payload.displayName;
     return 'Participant';
   };

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
