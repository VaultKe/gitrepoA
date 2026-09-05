import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Alert, BackHandler, Linking, PermissionsAndroid, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import { meetingApi, setMeetingAuthToken, clearMeetingAuthToken } from '../services/meetingApi';
import { getWebRTCClient, createWebRTCClient, MEDIA_CONSTRAINTS, SIGNALING_MESSAGE_TYPES, isWebRTCAvailable } from '../services/webrtcClient';
import { getAuthToken as getMainAuthToken } from '../services/api/auth';
import { getMeetingApiUrl } from '../services/meetingConfig';

// A sent message reaches its own sender twice: once as the REST response to
// sendChatMessage, and again as the WebSocket broadcast echoed back to the
// whole room. Only the REST path used to check for that, so whichever arrived
// second was appended blindly -- which is why the sender saw two bubbles for
// every message they sent. Both paths go through here now.
const appendChatMessage = (prev, incoming) => {
  const incomingSender = incoming.senderId || incoming.userId;
  const incomingTime = new Date(incoming.createdAt || incoming.timestamp || 0).getTime();

  const isDuplicate = prev.some((existing) => {
    if (incoming.id && existing.id) return existing.id === incoming.id;
    // Nothing to match on by id (the socket payload doesn't always carry
    // one), so fall back to identity: same sender, same text, near enough in
    // time to be the same message coming back rather than a repeat someone
    // genuinely typed twice.
    if (existing.content !== incoming.content) return false;
    if ((existing.senderId || existing.userId) !== incomingSender) return false;
    const existingTime = new Date(existing.createdAt || existing.timestamp || 0).getTime();
    return Math.abs(incomingTime - existingTime) < 10000;
  });

  return isDuplicate ? prev : [...prev, incoming];
};

const useOnlineMeetingScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const {
    meetingId,
    meetingTitle,
    userRole = 'member',
    isPreview = false,
    previewData = null,
    isReadOnly = false,
    chamaId: routeChamaId,
    meetingData: routeMeetingData,
  } = route.params || {};

  // Sent with the join so the service can keep one chama to one live online
  // meeting. Virtual meetings aren't navigated to with an explicit chamaId,
  // so fall back to the meeting record we were handed.
  const chamaId = routeChamaId || routeMeetingData?.chamaId || routeMeetingData?.chama_id || '';

  // A meeting counts as over once it is marked so, or once its scheduled
  // window has elapsed -- the meetings list already treats a passed window as
  // ENDED, so a meeting can be reachable with its status still "scheduled".
  // Chat is read-only from that point on.
  const hasMeetingWindowPassed = () => {
    const status = String(routeMeetingData?.status || '').toLowerCase();
    if (status === 'completed' || status === 'ended' || status === 'cancelled') return true;

    const startedAt = routeMeetingData?.startTime || routeMeetingData?.scheduledAt || routeMeetingData?.date;
    if (!startedAt) return false;
    const start = new Date(startedAt).getTime();
    if (Number.isNaN(start)) return false;

    const durationMinutes = Number(routeMeetingData?.duration) > 0 ? Number(routeMeetingData.duration) : 60;
    return Date.now() > start + durationMinutes * 60000;
  };

  // Evaluated once per meeting rather than on every render: a meeting that
  // overruns its scheduled window must not suddenly eject the people already
  // sitting in it.
  const isEndedMeeting = useMemo(
    () => isReadOnly || hasMeetingWindowPassed(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meetingId, isReadOnly]
  );

  // Who actually attended, and which chama members never showed up. Only
  // loaded for a finished meeting, where it is the record being reviewed.
  const [attendanceRecord, setAttendanceRecord] = useState({ attendees: [], absentees: [] });

  const [isConnecting, setIsConnecting] = useState(!meetingId);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  // Meetings join muted by default -- see initializeWebRTC.
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
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
  // Set when the host ends the room while we're still in it, so chat locks
  // immediately rather than waiting on navigation.
  const [hasRoomEnded, setHasRoomEnded] = useState(false);
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
  // What the OS actually granted, so we only ask getUserMedia for devices
  // we're allowed to open -- requesting a denied one fails the whole call,
  // taking the permitted device down with it.
  const mediaPermissionsRef = useRef({ camera: true, microphone: true });
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


  // Initialize meeting.
  //
  // Keyed to meetingId, and every piece of per-meeting state is wiped first.
  // This effect used to run once with an empty dependency list, which broke as
  // soon as the navigator reused this screen for a different meeting (it
  // updates route params rather than remounting): the hook never
  // re-initialised, so the second meeting opened showing the first meeting's
  // participants, streams and chat. Resetting here fixes it whether or not the
  // component is remounted.
  useEffect(() => {
    // Tear down anything still live from the meeting we were previously in
    // before adopting the new one's identity.
    cleanup();

    setIsConnected(false);
    setParticipants([]);
    setRemoteStreams([]);
    setChatMessages([]);
    setLocalStream(null);
    setScreenStream(null);
    setIsScreenSharing(false);
    setRemoteScreenSharer(null);
    setScreenShareViewerConnIds(new Set());
    setMeetingData(null);
    setHasRoomEnded(false);
    setIsChatOpen(false);
    setConnectionError(meetingId ? null : 'Missing meeting ID. Please reopen this meeting from the meeting details.');

    hasJoinedRef.current = false;
    isScreenSharingRef.current = false;
    screenShareRejectedRef.current = false;
    screenShareViewerConnIdsRef.current = new Set();
    participantIdRef.current = null;
    initialLoadDoneRef.current = false;
    participantsRef.current = [];
    knownParticipantIdsRef.current = new Set();
    mediaPermissionsRef.current = { camera: true, microphone: true };

    // A finished meeting is reviewed, not joined: no permission prompts, no
    // camera, no microphone, no signalling. Just its record.
    if (isEndedMeeting) {
      setIsConnecting(false);
      loadEndedMeetingRecord();
      return undefined;
    }

    if (!meetingId) {
      setIsConnecting(false);
      return undefined;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, isEndedMeeting]);

  const initializeMeeting = async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);

      // Ask up front, but never block joining on the answer -- a denied
      // camera or mic just means joining without that device.
      try {
        mediaPermissionsRef.current = await requestPermissions();
      } catch (permError) {
        console.warn('Media permissions not granted, joining without camera/mic:', permError);
        mediaPermissionsRef.current = { camera: false, microphone: false };
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
            chamaId, // lets the service enforce one live online meeting per chama
          }),
        });

        if (!debugResponse.ok) {
          const response = await meetingApi.joinRoom(meetingId, {
            displayName: `${user?.firstName || 'User'} ${user?.lastName || ''}`.trim(),
            role: userRole,
            userId: user?.id, // Pass userId for unauthenticated joins
            chamaId,
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

      // Attendance is recorded server-side by joining the room (the
      // participants table), so nothing extra is needed here. This used to
      // post a "Joined meeting" system message into the room chat, which is
      // what filled the chat panel with join notices -- joins already surface
      // as toasts and in the participant list.

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
    } catch (error) {
      // Only genuine connection failures reach here now: a denied camera or
      // mic degrades to joining without that device instead of throwing, so
      // it can never block entry to the meeting.
      console.error('Failed to initialize meeting:', error);
      setConnectionError(error.message);
      setIsConnecting(false);

      Toast.show({
        type: 'error',
        text1: 'Connection failed',
        text2: error.message,
      });
    }
  };

  // Asks for camera/mic the same way the app asks for any other runtime
  // permission, and reports what was actually granted instead of throwing.
  // A denial must not keep you out of the meeting -- you just join without
  // that device, and can turn it on later from the controls (which
  // re-requests via getUserMedia).
  const requestPermissions = async () => {
    if (Platform.OS !== 'android') {
      // iOS prompts automatically on first getUserMedia, using the
      // NSCameraUsageDescription / NSMicrophoneUsageDescription strings.
      // On web the browser prompts the same way.
      return { camera: true, microphone: true };
    }

    // ONLY runtime ("dangerous") permissions may go to requestMultiple().
    // MODIFY_AUDIO_SETTINGS used to be listed here, but it is a normal
    // install-time permission, so React Native does not expose a constant for
    // it -- PermissionsAndroid.PERMISSIONS.MODIFY_AUDIO_SETTINGS is undefined.
    // That undefined was passed straight through to the native module, where
    // checkSelfPermission(null) throws IllegalArgumentException on the UI
    // thread and takes the whole process down. That is a Java crash, so the
    // try/catch around this call could never catch it: opening the meeting
    // screen just closed the installed app instantly. It is already granted
    // at install time via the manifest, so it never needed requesting.
    const permissions = [
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ].filter(Boolean);

    try {
      const granted = await PermissionsAndroid.requestMultiple(permissions);
      const isGranted = (permission) =>
        granted[permission] === PermissionsAndroid.RESULTS.GRANTED;

      return {
        camera: isGranted(PermissionsAndroid.PERMISSIONS.CAMERA),
        microphone: isGranted(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO),
      };
    } catch (error) {
      console.warn('[Meeting] Permission request failed:', error?.message || error);
      return { camera: false, microphone: false };
    }
  };

  // Re-asks Android for a single device permission before we try to open it.
  // react-native-webrtc's getUserMedia does NOT raise the Android prompt on
  // its own -- it just fails when the permission is missing -- so without
  // this, anyone who declined at join time could never turn their camera or
  // mic on again for the rest of the meeting.
  const ensureDevicePermission = async (kind) => {
    if (Platform.OS !== 'android') return true;

    const permission = kind === 'video'
      ? PermissionsAndroid.PERMISSIONS.CAMERA
      : PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
    if (!permission) return true;

    try {
      if (await PermissionsAndroid.check(permission)) return true;
      const result = await PermissionsAndroid.request(permission);
      const isGranted = result === PermissionsAndroid.RESULTS.GRANTED;

      if (!isGranted && result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(
          kind === 'video' ? 'Camera blocked' : 'Microphone blocked',
          `Permission is turned off for VaultKe. Enable ${kind === 'video' ? 'Camera' : 'Microphone'} in Settings to use it in meetings.`,
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
      return isGranted;
    } catch (error) {
      console.warn('[Meeting] Permission request failed:', error?.message || error);
      return false;
    }
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
      setChatMessages(prev => appendChatMessage(prev, {
        ...message,
        isOwn: message.senderId === user?.id,
      }));
    });

    client.on('roomEnded', () => {
      setHasRoomEnded(true);
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

    // Ask only for the devices the OS actually let us have. getUserMedia is
    // all-or-nothing, so including a denied device would fail the whole call
    // and lose the one that was granted too.
    const { camera: mayUseCamera, microphone: mayUseMic } = mediaPermissionsRef.current;
    const constraints = {};
    if (mayUseCamera) constraints.video = MEDIA_CONSTRAINTS.video;
    if (mayUseMic) constraints.audio = MEDIA_CONSTRAINTS.audio;

    let stream = null;
    if (constraints.video || constraints.audio) {
      try {
        stream = await client.initLocalMedia(constraints);
        // Meetings join muted by default -- the mic track exists (so unmuting
        // later never needs to re-request permission) but doesn't transmit
        // until the user explicitly turns it on.
        client.toggleAudio(false);
      } catch (mediaError) {
        console.warn('Could not initialize local media, continuing without it:', mediaError);
        Toast.show({
          type: 'info',
          text1: 'Joining without camera and mic',
          text2: mediaError?.message || 'You can turn them on from the meeting controls.',
          position: 'top',
        });
      }
    } else {
      console.warn('[Meeting] Camera and microphone both denied -- joining view-only');
      Toast.show({
        type: 'info',
        text1: 'Joining without camera and mic',
        text2: 'Permission was denied. You can still see and hear other participants.',
        position: 'top',
      });
    }
    setLocalStream(stream);
    // Reflect what was actually acquired, not what we hoped for: camera on
    // only if a video track exists, mic always starts muted. This used to be
    // force-set to true unconditionally after the meeting finished
    // connecting (see initializeMeeting), which left the button showing
    // "on" even when permission had been denied and no track existed --
    // pressing it then just flipped that already-wrong flag to "off"
    // (a no-op, since there was nothing to disable) instead of retrying
    // acquisition, so it looked like the button didn't work until a second
    // press finally toggled it back to "on" and triggered a real retry.
    setIsCameraEnabled(!!stream?.getVideoTracks?.().length);
    setIsMicrophoneEnabled(false);

    await client.connectSignaling(
      connectionData.roomId || meetingId,
      user?.id || 'user',
      connectionData.participantId,
      connectionData.displayName || `${user?.firstName || 'User'} ${user?.lastName || ''}`.trim()
    );
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
         setChatMessages(
           response.messages
             // Rooms used before this change still have "Joined meeting"
             // system rows stored against them; keep those out of the panel
             // so old meetings don't show join notices as chat.
             .filter(msg => (msg.messageType || msg.message_type) !== 'system')
             .map(msg => ({
               ...msg,
               isOwn: msg.userId === user?.id,
             }))
         );
       }
     } catch (error) {
       console.error('Failed to load chat history:', error);
     }
   };

  // A finished meeting is reviewed, never joined: this pulls only its record
  // -- the chat backlog plus who attended and who did not. Deliberately no
  // permission request, no getUserMedia and no signalling connection, because
  // there is nothing to capture or transmit for a meeting that is over.
  const loadEndedMeetingRecord = async () => {
    try {
      const token = await getAuthToken();
      if (token) {
        await setMeetingAuthToken(token);
      }
    } catch (e) {
      console.warn('[Meeting] Could not set auth token for review:', e?.message || e);
    }

    await loadChatHistory();

    try {
      const [attendanceResponse, membersResponse] = await Promise.all([
        meetingApi.getAttendance(meetingId),
        chamaId ? api.getChamaMembers(chamaId) : Promise.resolve(null),
      ]);

      const attendees = (attendanceResponse?.attendees || []).map((entry) => ({
        userId: entry.userId,
        name: getHumanName(entry.displayName, 'Guest'),
        joinedAt: entry.joinedAt,
      }));

      const attendedIds = new Set(attendees.map(a => a.userId).filter(Boolean));
      const members = membersResponse?.data || membersResponse?.members || [];
      const absentees = members
        // Someone who has left the chama shouldn't be recorded as having
        // missed a meeting they were no longer part of.
        .filter(member => member.is_active !== false)
        .map((member) => {
          const userId = member.user_id || member.userId || member.user?.id;
          const first = member.user?.first_name || '';
          const last = member.user?.last_name || '';
          const fullName = `${first} ${last}`.trim();
          return {
            userId,
            name: getHumanName(fullName || member.displayName || member.name, 'Member'),
          };
        })
        .filter(member => member.userId && !attendedIds.has(member.userId));

      setAttendanceRecord({ attendees, absentees });
    } catch (error) {
      console.warn('[Meeting] Could not load attendance record:', error?.message || error);
    }
  };

   const handleToggleCamera = async () => {
    const newState = !isCameraEnabled;

    // If turning on but we don't actually have a camera track yet (denied at
    // join time, or never requested), acquire just that. Requesting it
    // together with the mic -- getUserMedia({audio, video}) -- fails the
    // *entire* call if only one of the two was ever denied, even though the
    // other permission was fine, which used to make it look like neither
    // could ever be turned on again.
    const hasVideoTrack = (webrtcClientRef.current?.localStream?.getVideoTracks?.() || []).length > 0;
    if (newState && !hasVideoTrack && webrtcClientRef.current) {
      try {
        if (!(await ensureDevicePermission('video'))) {
          setIsCameraEnabled(false);
          return;
        }
        mediaPermissionsRef.current = { ...mediaPermissionsRef.current, camera: true };
        await webrtcClientRef.current.initLocalMedia({ video: MEDIA_CONSTRAINTS.video });
        // Existing peer connections were negotiated without a camera m-line
        // if we joined without one; wire the newly acquired track into them
        // so the other participants actually receive it too.
        await webrtcClientRef.current.attachLocalTrack('video');
        setLocalStream(webrtcClientRef.current.localStream);
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

    // Mirrors handleToggleCamera: only re-acquire if there's genuinely no
    // audio track yet (mic permission denied at join time), and scope the
    // request to audio alone so a camera-only failure can't take the mic
    // down with it. A fresh track also needs wiring into any peer
    // connections that were negotiated without an audio m-line.
    const hasAudioTrack = (webrtcClientRef.current?.localStream?.getAudioTracks?.() || []).length > 0;
    if (newState && !hasAudioTrack && webrtcClientRef.current) {
      try {
        if (!(await ensureDevicePermission('audio'))) {
          setIsMicrophoneEnabled(false);
          return;
        }
        mediaPermissionsRef.current = { ...mediaPermissionsRef.current, microphone: true };
        await webrtcClientRef.current.initLocalMedia({ audio: MEDIA_CONSTRAINTS.audio });
        await webrtcClientRef.current.attachLocalTrack('audio');
        setLocalStream(webrtcClientRef.current.localStream);
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

    // Announce first, tear down after. Everyone else stops showing the share
    // the moment this one small socket message lands, so cancelling is
    // instant for them. It used to be sent only after stopScreenShare()
    // finished -- and that awaits an Android foreground-service teardown plus
    // one replaceTrack per peer connection, so viewers kept watching a share
    // that had already been cancelled for as long as that took (and forever,
    // if any of it hung).
    //
    // Starting a share deliberately does the opposite (capture, then
    // announce) so peers never switch to a share that failed to start. There
    // is no such risk when stopping: the worst case is peers stop showing it
    // a moment before the last frame drains, which is exactly what we want.
    if (notify) {
      client?.sendScreenShareStopped();
    }

    setScreenStream(null);
    setIsScreenSharing(false);
    isScreenSharingRef.current = false;

    try {
      await client?.stopScreenShare();
    } catch (e) {
      console.warn('Failed to stop screen capture:', e?.message || e);
    }

    if (notify) {
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
    // Guarded here as well as in the UI, so an ended meeting stays read-only
    // no matter which path reaches this.
    if (isChatReadOnly) {
      Toast.show({
        type: 'info',
        text1: 'Meeting has ended',
        text2: 'You can read the chat, but no new messages can be sent.',
      });
      return;
    }

    try {
      const response = await meetingApi.sendChatMessage(meetingId, content);
      setChatMessages(prev => appendChatMessage(prev, { ...response, isOwn: true }));
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
  // Read-only once the meeting is over: explicitly marked read-only on entry,
  // ended by the host while we were in it, or simply past its window.
  const isChatReadOnly = isEndedMeeting || hasRoomEnded;

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
    isChatReadOnly,
    isEndedMeeting,
    attendanceRecord,
    setIsChatOpen,
    leaveMeeting,
  };
};

export default useOnlineMeetingScreen;
