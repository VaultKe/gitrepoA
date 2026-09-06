import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Alert, BackHandler, Linking, PermissionsAndroid, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import { meetingApi, setMeetingAuthToken, clearMeetingAuthToken } from '../services/meetingApi';
import { getWebRTCClient, createWebRTCClient, MEDIA_CONSTRAINTS, SIGNALING_MESSAGE_TYPES, isWebRTCAvailable } from '../services/webrtcClient';
import { getAuthToken as getMainAuthToken } from '../services/api/auth';

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

// Above this audio level someone counts as talking rather than as background
// noise. WebRTC reports the level as 0..1.
const SPEAKING_LEVEL_THRESHOLD = 0.02;
// Once someone is marked as speaking they stay marked for this long after
// they go quiet. Ordinary speech has pauses between words and sentences
// noticeably longer than a second, and 1200ms was short enough that the
// indicator kept blinking off mid-conversation instead of staying on the
// way it does in Google Meet -- the whole point of the hold. 2.5s comfortably
// covers a normal breath or thinking pause without making the indicator feel
// slow to turn off once someone has actually stopped.
const SPEAKING_HOLD_MS = 2500;

// How long a socket-reported departure keeps overriding the REST roster,
// which takes a moment to catch up.
const RECENT_LEAVE_GRACE_MS = 15000;
// Consecutive participant polls someone must be missing from the roster
// before their tile is dropped. One miss could just be a hiccup; a run of
// them means they are gone and we never got the socket notice.
const ROSTER_MISSES_BEFORE_DROP = 2;

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
  // connIds currently talking, plus 'local' for ourselves. Drives the green
  // indicator and floats active speakers to the front of the grid.
  const [speakingConnIds, setSpeakingConnIds] = useState(() => new Set());
  // Identity of the participant currently sharing their screen, as announced by
  // the signaling server: { connId, userId }. Kept separately from the stream
  // list so the flag survives tiles being re-created or re-keyed.
  const [remoteScreenSharer, setRemoteScreenSharer] = useState(null);
  const [meetingData, setMeetingData] = useState(null);
  // Set when the host ends the room while we're still in it, so chat locks
  // immediately rather than waiting on navigation.
  const [hasRoomEnded, setHasRoomEnded] = useState(false);
  // Set once the server warns this room is ~2 minutes from its scheduled
  // end (see MEETING_ENDING_SOON in webrtcClient). Purely informational --
  // dismissing it just hides the card; the room still ends at the server-
  // enforced time regardless, so there is nothing else for "OK" to do.
  const [endingSoonWarning, setEndingSoonWarning] = useState(false);
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
  // Set the instant leaveMeeting() starts running, before any awaited call.
  // handleBackPress/handleEndCall read this to tell a genuine "I want to
  // leave now" press apart from a second back-gesture/button press that
  // lands on this same still-mounted screen after the first leave already
  // tore everything down -- without it, that second press re-asked "Leave
  // Meeting?" for a meeting the user was no longer in, and re-ran the whole
  // leave sequence a second time.
  const hasLeftMeetingRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const screenShareRejectedRef = useRef(false);
  // Mirrors isScreenSharing for the connectionStateChange listener, which is
  // registered once in initializeWebRTC and would otherwise close over a
  // stale value.
  const isScreenSharingRef = useRef(false);
  // Mirrors remoteScreenSharer for the screenTrackMuted/Unmuted listeners,
  // which are registered once in initializeWebRTC and would otherwise close
  // over a stale value.
  const remoteScreenSharerRef = useRef(null);
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
  // userId -> timestamp of a departure we were told about over the socket.
  // The REST roster lags behind that by a moment, and the participant poll
  // reads straight from it, so without this the poll kept resurrecting the
  // tile of someone who had already left.
  const recentlyLeftRef = useRef(new Map());
  // userId -> consecutive polls they've been absent from the server roster.
  const rosterMissesRef = useRef(new Map());
  // Mirror of remoteStreams for the poll, which runs on an interval and would
  // otherwise close over a stale copy.
  const remoteStreamsRef = useRef([]);
  // Timestamp we last measured our own mic above SPEAKING_LEVEL_THRESHOLD,
  // used to apply SPEAKING_HOLD_MS before dropping our own indicator (and
  // before announcing to the room that we've stopped -- see the audioLevels
  // handler). Remote participants' speaking state isn't measured locally at
  // all; it arrives ready-made over signaling, already debounced by the
  // sender's own copy of this same logic.
  const lastSpokeAtRef = useRef(0);
  // Whether the audioLevels handler last told the room we were speaking, so
  // it only sends on an actual transition rather than every 500ms tick.
  const wasLocalSpeakingRef = useRef(false);


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
    setEndingSoonWarning(false);
    setIsChatOpen(false);
    setConnectionError(meetingId ? null : 'Missing meeting ID. Please reopen this meeting from the meeting details.');

    hasJoinedRef.current = false;
    hasLeftMeetingRef.current = false;
    isScreenSharingRef.current = false;
    screenShareRejectedRef.current = false;
    screenShareViewerConnIdsRef.current = new Set();
    participantIdRef.current = null;
    initialLoadDoneRef.current = false;
    participantsRef.current = [];
    knownParticipantIdsRef.current = new Set();
    recentlyLeftRef.current = new Map();
    rosterMissesRef.current = new Map();
    remoteStreamsRef.current = [];
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

      // Ask for camera/mic and join the room over the network at the same
      // time -- neither depends on the other's result (the join call only
      // needs an auth token, not a granted device), so there is no reason to
      // sit through however long the user takes to answer the OS permission
      // dialog before even starting the network request. Only initializeWebRTC
      // below actually needs both to have finished, so that's the only place
      // permissionsPromise is awaited. A denied camera or mic still never
      // blocks joining -- it just means joining without that device.
      const permissionsPromise = requestPermissions().catch((permError) => {
        console.warn('Media permissions not granted, joining without camera/mic:', permError);
        return { camera: false, microphone: false };
      });

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
        // Always the properly authenticated join -- this used to try an
        // unauthenticated "/debug/rooms/:id/join" endpoint first (explicitly
        // marked "REMOVE AFTER DEBUGGING" server-side) and only fall back to
        // this authenticated call if that failed. That meant every real join
        // paid for a whole extra network round trip before the one that
        // actually mattered, and depended on a route that would let anyone
        // who knew a meeting id join as any userId/role with no auth at all.
        const response = await meetingApi.joinRoom(meetingId, {
          displayName: `${user?.firstName || 'User'} ${user?.lastName || ''}`.trim(),
          role: userRole,
          userId: user?.id,
          chamaId, // lets the service enforce one live online meeting per chama
          // The scheduled duration, so the room can close itself on time
          // instead of running until someone remembers to end it -- the
          // service clamps this to its own hard cap regardless of what's
          // sent, so a longer value here can never buy more room lifetime
          // than that.
          durationMinutes: Number(routeMeetingData?.duration) > 0 ? Number(routeMeetingData.duration) : 60,
        });
        if (!response) {
          throw new Error('Failed to join meeting');
        }
        connectionData = response;
      }

      mediaPermissionsRef.current = await permissionsPromise;

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

      // Participants and chat history are independent REST calls -- fetch
      // them together instead of one after the other. Roster-synced still
      // flips as soon as the participants call itself resolves (not once
      // chat has also finished), same as before, so a join that arrives
      // while chat history is still loading is still toasted.
      const participantsLoaded = updateParticipantsList().then(() => {
        initialLoadDoneRef.current = true;
      });
      await Promise.all([participantsLoaded, loadChatHistory()]);

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

  // Fallback defaults to empty rather than "Guest": a blank result lets the
  // caller fall through to another source for the person's real name, whereas
  // a placeholder would be mistaken for one and stick to their tile.
  const getHumanName = (value, fallback = '') => {
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
    const name = getHumanName(value, '');
    if (!name) return '';
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

      // Prefer whatever name came with this event, then the roster. Never
      // overwrite a name we already have with nothing.
      const resolvedName = truncateName(displayName) || truncateName(getParticipantName(userId, connId));

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
                name: resolvedName || s.name,
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

    // Our own speaking state, measured locally and then announced to the
    // room -- see SPEAKING_STATE in webrtcClient for why remote speaking
    // can't be measured this same way from received audio.
    client.on('audioLevels', ({ local: level = 0 } = {}) => {
      const now = Date.now();
      if (level >= SPEAKING_LEVEL_THRESHOLD) lastSpokeAtRef.current = now;

      const isLocalSpeakingNow = now - lastSpokeAtRef.current <= SPEAKING_HOLD_MS;

      if (isLocalSpeakingNow !== wasLocalSpeakingRef.current) {
        wasLocalSpeakingRef.current = isLocalSpeakingNow;
        client.sendSpeakingState(isLocalSpeakingNow);
      }

      setSpeakingConnIds((prev) => {
        if (prev.has('local') === isLocalSpeakingNow) return prev;
        const next = new Set(prev);
        if (isLocalSpeakingNow) next.add('local');
        else next.delete('local');
        return next;
      });
    });

    // A remote participant's own speaking transition, straight from their
    // device. Applied directly (no local threshold/hold) since the sender
    // already debounced it with the same logic before sending.
    client.on('remoteSpeakingChanged', ({ connId, isSpeaking }) => {
      if (!connId) return;
      setSpeakingConnIds((prev) => {
        if (prev.has(connId) === isSpeaking) return prev;
        const next = new Set(prev);
        if (isSpeaking) next.add(connId);
        else next.delete(connId);
        return next;
      });
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
            // Look the person up in the roster. This used to pass an object
            // whose only field was hard-coded undefined, so the expression
            // could only ever produce the "Guest" fallback -- every tile born
            // from a media track was labelled Guest no matter who it was.
            name: truncateName(getParticipantName(userId, connId)),
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

    // Fast, independent confirmation off the WebRTC track itself (see
    // webrtcClient's watchScreenTrackLifecycle) rather than the signaling
    // message above -- a safety net for exactly the case where that message
    // never arrives. Only acts when it disagrees with what we currently
    // believe, so the normal signaling-driven path stays untouched.
    client.on('screenTrackMuted', ({ userId: mutedUserId }) => {
      if (!mutedUserId || mutedUserId === user?.id) return;
      if (remoteScreenSharerRef.current?.userId !== mutedUserId) return;
      console.log('[ScreenShare] Track muted for the current sharer -- verifying with the server:', mutedUserId);
      verifyRemoteScreenSharer(mutedUserId);
    });

    client.on('screenTrackUnmuted', ({ userId: unmutedUserId }) => {
      if (!unmutedUserId || unmutedUserId === user?.id) return;
      if (remoteScreenSharerRef.current?.userId === unmutedUserId) return;
      console.log('[ScreenShare] Track unmuted for someone not marked as sharing -- verifying with the server:', unmutedUserId);
      verifyRemoteScreenSharer(unmutedUserId);
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
    // their end (see webrtcClient's watchScreenTrackLifecycle).
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
          message.displayName || message.payload?.displayName || message.name || ''
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
      // Resolve who this was *before* dropping them from the roster, so the
      // notice can name them.
      const departedName =
        truncateName(message.displayName || message.payload?.displayName) ||
        truncateName(getParticipantName(message.userId, message.connId));

      // The REST roster can still list someone for a moment after the socket
      // says they left, and the participant poll would then put their tile
      // straight back. Remember the departure briefly so the poll ignores
      // them until the server catches up.
      if (message.userId) {
        recentlyLeftRef.current.set(message.userId, Date.now());
      }

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

      // Someone who left mid-sentence never gets to send a final "stopped"
      // speaking-state message, which would otherwise leave their tile
      // marked as speaking forever.
      if (message.connId) {
        setSpeakingConnIds(prev => {
          if (!prev.has(message.connId)) return prev;
          const next = new Set(prev);
          next.delete(message.connId);
          return next;
        });
      }

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
        Toast.show({
          type: 'info',
          text1: departedName
            ? `${departedName} left the meeting`
            : 'A participant left the meeting',
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
      // Same full teardown as pressing the leave button: release the camera
      // and mic and close every connection, not just navigate away. This
      // used to skip straight to navigation.goBack() with no cleanup at
      // all, which on the host's end was fine (their own leave flow does
      // the teardown) but left a listener's local media running and their
      // signaling socket open until whatever unmounted the screen next.
      leaveMeeting();
    });

    // Purely a heads-up -- the room's actual end is enforced server-side on
    // its own schedule regardless of whether anyone sees or dismisses this.
    client.on('meetingEndingSoon', () => {
      setEndingSoonWarning(true);
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

    // Watch who is talking, for the speaking indicator and the ordering that
    // keeps active speakers on the first page of tiles.
    client.startAudioLevelMonitoring();
  };

  const participantUserIdOf = (entry) =>
    entry?.userId || entry?.payload?.userId || entry?.memberId || null;

  // Immediately re-checks the server's record for one participant's
  // screen-share flag and reconciles remoteScreenSharer to match, instead of
  // waiting for the next scheduled roster poll (see startParticipantPolling).
  //
  // This is the fast path triggered by the WebRTC track's own mute/unmute
  // transitions (see webrtcClient's watchScreenTrackLifecycle) rather than by
  // the signaling `screen-share-started`/`stopped` messages. Those media-plane
  // transitions alone aren't trustworthy enough to act on blindly -- a track
  // can go quiet just because someone is sharing a static, unchanging screen,
  // not because they stopped -- so every trigger is confirmed against the
  // server before anything actually changes.
  const verifyRemoteScreenSharer = async (candidateUserId) => {
    if (!candidateUserId) return;
    try {
      const response = await meetingApi.getParticipants(meetingId);
      const record = (response?.participants || []).find(p => participantUserIdOf(p) === candidateUserId);
      const stillSharing = !!record && (record.isScreenSharing === true || record.payload?.isScreenSharing === true);

      setRemoteScreenSharer((prev) => {
        if (stillSharing) {
          if (prev?.userId === candidateUserId) return prev;
          return { connId: prev?.userId === candidateUserId ? prev.connId : null, userId: candidateUserId };
        }
        return prev?.userId === candidateUserId ? null : prev;
      });
    } catch (error) {
      console.warn('[ScreenShare] Fast verification failed:', error?.message || error);
    }
  };

  const updateParticipantsList = async () => {
    try {
      const response = await meetingApi.getParticipants(meetingId);
      if (!response || !response.participants) return;

      // Expire departures we were told about a while ago: past that point the
      // server roster has caught up and is the better source of truth again.
      const now = Date.now();
      recentlyLeftRef.current.forEach((leftAt, leftUserId) => {
        if (now - leftAt > RECENT_LEAVE_GRACE_MS) recentlyLeftRef.current.delete(leftUserId);
      });

      const nextParticipants = response.participants.filter((participant) => {
        const id = participantUserIdOf(participant);
        return !(id && recentlyLeftRef.current.has(id));
      });

      const liveUserIds = new Set(nextParticipants.map(participantUserIdOf).filter(Boolean));

      // Count how many consecutive polls each known person has been missing
      // from the roster. Acting on a single miss would make tiles flicker on
      // a hiccup, but a sustained absence means they are gone -- this is the
      // safety net for a departure whose socket notice never arrived.
      const misses = rosterMissesRef.current;
      const knownIds = new Set([
        ...remoteStreamsRef.current.map(s => s.userId),
        ...participantsRef.current.map(participantUserIdOf),
      ].filter(id => id && id !== user?.id));

      knownIds.forEach((id) => {
        if (liveUserIds.has(id)) misses.delete(id);
        else misses.set(id, (misses.get(id) || 0) + 1);
      });
      liveUserIds.forEach(id => misses.delete(id));

      const isGone = (userId) =>
        !!userId && (recentlyLeftRef.current.has(userId) || (misses.get(userId) || 0) >= ROSTER_MISSES_BEFORE_DROP);

      setParticipants((prev) => {
        const merged = nextParticipants.reduce(
          (acc, participant) => mergeParticipantEntry(acc, participant),
          prev
        );
        // The roster is authoritative about who is still here. The merge on
        // its own could only ever grow the list, so anyone whose departure
        // wasn't caught over the socket stayed listed forever.
        return merged.filter((entry) => {
          const entryUserId = participantUserIdOf(entry);
          if (!entryUserId) return true;
          if (entryUserId === user?.id) return true;
          return !isGone(entryUserId);
        });
      });

      setRemoteStreams(prev => prev.filter(s => !isGone(s.userId)));

      knownParticipantIdsRef.current = new Set(liveUserIds);

      nextParticipants.forEach((participant) => {
        const participantUserId = participantUserIdOf(participant);
        if (participantUserId && participantUserId !== user?.id) {
          upsertRemoteStreamPlaceholder(
            participantUserId,
            participant.connId || participant.payload?.connId || participant.userId,
            participant.displayName || participant.name || participant.payload?.displayName || participant.payload?.name || ''
          );
        }
      });

      // Self-heal a missed screen-share-stopped notice. That signal is a
      // single best-effort WebSocket message; if it's ever lost (a reconnect
      // at exactly the wrong moment, a dropped packet) nothing else would
      // tell a viewer the share had ended, and the last frame would stay on
      // screen indefinitely. Stopping a share always also persists
      // isScreenSharing:false on this same participant record, so this
      // roster poll is a second, independent source of truth to fall back
      // on. Deliberately one-directional -- it only clears a stale "sharing"
      // flag, never sets a new one -- so it can't race the WS-driven state
      // right as someone starts sharing, which the REST record lags by one
      // request.
      setRemoteScreenSharer((prev) => {
        if (!prev) return prev;
        const sharerRecord = nextParticipants.find(p => participantUserIdOf(p) === prev.userId);
        const stillSharing = !!sharerRecord && (sharerRecord.isScreenSharing === true || sharerRecord.payload?.isScreenSharing === true);
        return stillSharing ? prev : null;
      });

      console.log('[Meeting] Participants synced:', nextParticipants.length);
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
        name: getHumanName(entry.displayName || entry.name || entry, ''),
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
    // Already left (leaveMeeting ran once already): this is a second back
    // gesture/press landing on the same screen instance before its
    // navigation away has actually unmounted it. There is nothing left to
    // confirm leaving -- re-asking "Leave Meeting?" for a room this device
    // already tore down is the exact loop reported. Just retry getting off
    // this screen, silently.
    if (hasLeftMeetingRef.current) {
      leaveMeeting();
      return;
    }

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
    // Teardown already ran once (see handleEndCall) -- the only thing left
    // to do is retry actually navigating off this screen.
    if (hasLeftMeetingRef.current) {
      exitMeetingScreen();
      return;
    }
    hasLeftMeetingRef.current = true;
    hasJoinedRef.current = false;

    // Tell the room first, over the socket that is still open, so everyone
    // else drops this tile immediately.
    if (webrtcClientRef.current) {
      webrtcClientRef.current.sendSignalingMessage({
        type: SIGNALING_MESSAGE_TYPES.LEAVE,
        roomId: meetingId,
        userId: user?.id,
        connId: webrtcClientRef.current.connId,
        displayName: getSelfDisplayName(),
      });

      // Then hand the camera and microphone straight back to the OS, before
      // the REST call below. Leaving has to be instant on this device: the
      // meeting carries on without us, so there is nothing left to capture,
      // and waiting on a request that can take seconds would keep the camera
      // light on well after the user thinks they're out.
      webrtcClientRef.current.stopLocalMedia();
    }

    // Nothing is being captured or received any more, so drop it from the UI
    // as well rather than leaving dead tiles on screen for the last frame.
    setLocalStream(null);
    setScreenStream(null);
    setRemoteStreams([]);
    setIsScreenSharing(false);
    isScreenSharingRef.current = false;

    try {
      await meetingApi.leaveRoom(meetingId);
    } catch (error) {
      // Losing the REST call is not a reason to stay in the meeting.
      console.error('Failed to notify the server we left:', error);
    } finally {
      // Always tear down, whatever the server said. This used to sit inside
      // the try *after* the await, so a failed leaveRoom call skipped it
      // entirely: the camera and microphone stayed live and every peer
      // connection stayed open, so someone who had "left" was still being
      // heard and could still hear the room.
      cleanup();
      exitMeetingScreen();
    }
  };

  // Navigates off this screen the same way SmartBackButton/useSmartNavigation
  // do elsewhere in the app: goBack() when there's history, otherwise
  // delegate to the parent navigator. Without the parent fallback,
  // navigation.goBack() on a meeting opened as the root of its own stack
  // (e.g. from a push notification or deep link, with nothing to pop back
  // to) was a silent no-op -- the screen stayed mounted, so its hardware
  // back-gesture listener stayed live too, and the next back press re-ran
  // this whole flow, which is what looked like "Leave Meeting?" popping up
  // again after the user had already left.
  const exitMeetingScreen = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    const parent = navigation?.getParent?.();
    if (parent && typeof parent.canGoBack === 'function' && parent.canGoBack()) {
      parent.goBack();
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

        const apiParticipants = response.participants.filter((p) => {
          const id = participantUserIdOf(p);
          return !(id && recentlyLeftRef.current.has(id));
        });
        const currentIds = new Set(apiParticipants.map(participantUserIdOf).filter(Boolean));
        const previousIds = new Set(knownParticipantIdsRef.current);

        const newJoins = apiParticipants.filter((p) => {
          const id = participantUserIdOf(p);
          return id && !previousIds.has(id) && id !== user?.id;
        });
        const leftIds = [...previousIds].filter(id => !currentIds.has(id) && id !== user?.id);

        // Announce first, using names resolved while the roster still holds
        // the people involved. All the actual list reconciliation (including
        // dropping anyone the server no longer lists, and closing their peer
        // connection) is left to updateParticipantsList below, so the two
        // paths can't disagree about who is in the room.
        for (const joined of newJoins) {
          const joinedName =
            truncateName(joined.displayName || joined.name || joined.payload?.displayName) ||
            truncateName(getParticipantName(participantUserIdOf(joined)));
          console.log('[Meeting] Poll: participant joined:', participantUserIdOf(joined));
          if (initialLoadDoneRef.current && joinedName) {
            setTimeout(() => {
              Toast.show({ type: 'info', text1: `${joinedName} joined the meeting`, position: 'top' });
            }, 120);
          }
        }

        for (const leftId of leftIds) {
          const leftName = truncateName(getParticipantName(leftId));
          console.log('[Meeting] Poll: participant left:', leftId);
          // Close the connection to them as well, so their audio stops
          // straight away rather than lingering on a tile that's about to go.
          webrtcClientRef.current?.removePeerConnectionsForUser?.(leftId);
          if (initialLoadDoneRef.current) {
            Toast.show({
              type: 'info',
              text1: leftName ? `${leftName} left the meeting` : 'A participant left the meeting',
              position: 'top',
            });
          }
        }

        await updateParticipantsList();
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

  // Build a userId -> displayName lookup from the participants list (API +
  // signaling). Returns '' when the roster genuinely has nothing yet, so
  // callers can keep whatever better name they already had instead of
  // replacing a real person's name with a placeholder.
  const getParticipantName = (userId, connId = null) => {
    if (!userId && !connId) return '';

    const roster = participantsRef.current?.length ? participantsRef.current : participants;
    const entry = roster.find((part) => {
      const partUserId = part.userId || part.payload?.userId || part.memberId;
      const partConnId = part.connId || part.payload?.connId;
      return (
        (userId && partUserId && partUserId === userId) ||
        (connId && partConnId && partConnId === connId)
      );
    });
    if (!entry) return '';

    // The same person arrives shaped differently depending on whether they
    // came from the REST roster or the signaling channel, so check every
    // spelling before giving up.
    const candidate =
      entry.displayName ||
      entry.payload?.displayName ||
      entry.name ||
      entry.payload?.name ||
      entry.fullName ||
      entry.user?.displayName ||
      entry.user?.name ||
      ([entry.firstName, entry.lastName].filter(Boolean).join(' ').trim() || null) ||
      ([entry.user?.firstName, entry.user?.lastName].filter(Boolean).join(' ').trim() || null);

    return typeof candidate === 'string' ? candidate.trim() : '';
  };

  // Our own name, in the same shape everyone else's arrives in, so the room
  // is told who left rather than just that "someone" did.
  const getSelfDisplayName = () =>
    getHumanName(
      {
        displayName: user?.displayName,
        name: user?.name,
        fullName: user?.fullName,
        firstName: user?.firstName,
        lastName: user?.lastName,
      },
      ''
    ) || '';

  // Keep a live mirror of the participants list for event handlers that close
  // over stale state (so join/leave toasts can read the latest roster).
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    isScreenSharingRef.current = isScreenSharing;
  }, [isScreenSharing]);

  useEffect(() => {
    remoteScreenSharerRef.current = remoteScreenSharer;
  }, [remoteScreenSharer]);

  useEffect(() => {
    remoteStreamsRef.current = remoteStreams;
  }, [remoteStreams]);

  // Keep display names synced onto remote stream entries so the UI can label
  // each tile even when the name arrives after the first media track.
  //
  // This only ever upgrades a tile to a better name. It used to overwrite
  // unconditionally with a lookup that returned "Guest" on a miss, so a tile
  // that already knew the person's name from the signaling payload got
  // relabelled "Guest" the moment the REST roster lagged behind -- which is
  // why named participants kept showing up as guests. It also keyed off
  // participants.length alone, so a name that filled in later (same roster
  // size) never reached the tile at all.
  useEffect(() => {
    setRemoteStreams(prev => {
      let changed = false;
      const next = prev.map((s) => {
        const resolved = truncateName(getParticipantName(s.userId, s.connId));
        if (!resolved || resolved === s.name) return s;
        changed = true;
        return { ...s, name: resolved };
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants]);

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

  // Tag who is talking and float them to the front, so an active speaker is
  // always among the first tiles rather than buried behind a "+N more" card.
  // Ordering is otherwise left alone, so tiles don't shuffle around while
  // nobody is speaking.
  const orderedRemoteStreams = useMemo(() => {
    const withSpeaking = decoratedRemoteStreams.map(s => ({
      ...s,
      isSpeaking: speakingConnIds.has(s.connId),
    }));

    if (!withSpeaking.some(s => s.isSpeaking)) return withSpeaking;

    return withSpeaking
      .map((stream, index) => ({ stream, index }))
      .sort((a, b) => {
        if (a.stream.isSpeaking !== b.stream.isSpeaking) return a.stream.isSpeaking ? -1 : 1;
        return a.index - b.index;
      })
      .map(entry => entry.stream);
  }, [decoratedRemoteStreams, speakingConnIds]);

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
    remoteStreams: orderedRemoteStreams,
    // True while our own microphone is picking up speech, for the local tile's
    // indicator.
    isSelfSpeaking: speakingConnIds.has('local') && isMicrophoneEnabled,
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
    // "This meeting ends in ~2 minutes" -- server-driven, informational only.
    endingSoonWarning,
    dismissEndingSoonWarning: () => setEndingSoonWarning(false),
  };
};

export default useOnlineMeetingScreen;
