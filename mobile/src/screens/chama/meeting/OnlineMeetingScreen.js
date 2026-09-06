import React, { useRef, useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

let RTCView = null;
if (Platform.OS !== 'web') {
  try {
    RTCView = require('react-native-webrtc').RTCView;
  } catch (error) {
    console.warn('Unable to load RTCView native component:', error?.message || error);
    RTCView = null;
  }
}
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography } from '../../../utils/theme';
import useOnlineMeetingScreen from '../../../hooks/useOnlineMeetingScreen';
import OnlineMeetingLoading from '../../../components/chama-meeting/OnlineMeetingLoading';
import OnlineMeetingErrorView from '../../../components/chama-meeting/OnlineMeetingErrorView';
import WebVideo from '../../../components/chama-meeting/WebVideo';
import MeetingMinutesCard from '../../../components/chama-meeting/MeetingMinutesCard';

const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
const CARD_CONTROL_TIMEOUT_MS = 4000;
// Used only to prefer one column count over another when several would
// divide the tiles into a reasonable number of rows -- tiles are never
// locked to this ratio. Width is handled by flex (see renderGalleryRows):
// each row's tiles get flex:1 and split whatever width the row has evenly,
// so there is no per-tile width arithmetic left to get wrong. Only the
// height needs deciding, and only once per row, which is what column count
// determines (fewer columns -> more rows -> shorter rows).
const IDEAL_TILE_ASPECT_RATIO = 16 / 9;
const MIN_TILE_HEIGHT = 60;

// Picks how many tiles go in each row. One person is always 1 (fills the
// screen); everything else searches column counts from 1 up to `count` and
// keeps whichever produces rows closest to IDEAL_TILE_ASPECT_RATIO once
// availH is divided evenly among them, stopping once rows would be shorter
// than MIN_TILE_HEIGHT.
const computeGridColumns = (count, availW, availH) => {
  if (count <= 1 || availW <= 0) return 1;

  let bestColumns = 1;
  let bestPenalty = Infinity;

  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const tileWidth = availW / columns;
    const tileHeight = availH > 0 ? availH / rows : tileWidth / IDEAL_TILE_ASPECT_RATIO;
    if (availH > 0 && tileHeight < MIN_TILE_HEIGHT && rows > 1) continue;

    const penalty = Math.abs(Math.log((tileWidth / tileHeight) / IDEAL_TILE_ASPECT_RATIO));
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestColumns = columns;
    }
  }

  return bestColumns;
};

// Splits a flat tile list into rows of `columns` each, for renderGalleryRows.
// A short last row (e.g. 7 tiles in 3 columns -> 3/3/1) is expected and fine:
// its tiles just get a bigger share of that row's width via flex:1.
const chunkIntoRows = (items, columns) => {
  const rows = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
};

const SpeakingIndicator = ({ color }) => {
  const bars = useRef([new Animated.Value(0.35), new Animated.Value(0.35), new Animated.Value(0.35)]).current;

  useEffect(() => {
    const animations = bars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 120),
          Animated.timing(bar, { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.35, duration: 260, useNativeDriver: true }),
        ])
      )
    );

    animations.forEach(animation => animation.start());
    return () => animations.forEach(animation => animation.stop());
  }, [bars]);

  return (
    <View style={styles.speakingIndicator} accessibilityLabel="Speaking">
      {bars.map((bar, index) => (
        <Animated.View
          key={index}
          style={[styles.speakingBar, { backgroundColor: color, transform: [{ scaleY: bar }] }]}
        />
      ))}
    </View>
  );
};

const getDisplayName = (value, fallback = '') => {
  if (!value) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === 'object') {
    const parts = [
      value.displayName,
      value.name,
      value.fullName,
      value.firstName && value.lastName ? `${value.firstName} ${value.lastName}` : value.firstName || value.lastName,
    ].filter(Boolean);
    return parts[0] || fallback;
  }
  return fallback;
};

const truncateDisplayName = (value, maxLength = 18) => {
  const name = getDisplayName(value, '');
  if (!name) return '';
  if (name.length <= maxLength) return name;
  return `${name.slice(0, Math.max(1, maxLength - 1)).trim()}…`;
};

const OnlineMeetingScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const screen = useOnlineMeetingScreen({ route, navigation });
  const chatScrollRef = useRef(null);
  const [isStageCollapsed, setIsStageCollapsed] = useState(false);
  const [isGalleryExpanded, setIsGalleryExpanded] = useState(false);
  // Measured size of the gallery's own container (not the window), so the
  // puzzle-fit math below sizes tiles against the space actually available
  // once the header, controls and any stage strip have taken their share.
  const [galleryAreaSize, setGalleryAreaSize] = useState({ width: 0, height: 0 });
  const onGalleryLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    setGalleryAreaSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };
  const [expandedTileKey, setExpandedTileKey] = useState(null);
  const [revealedTileKey, setRevealedTileKey] = useState(null);
  const revealTimerRef = useRef(null);

  const revealTileControls = (key) => {
    setRevealedTileKey(key);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => setRevealedTileKey(null), CARD_CONTROL_TIMEOUT_MS);
  };

  useEffect(() => () => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
  }, []);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [chatDraft, setChatDraft] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const seenChatCountRef = useRef(0);
  const chatBacklogSettledRef = useRef(false);

  const {
    isConnecting,
    connectionError,
    isCameraEnabled,
    isMicrophoneEnabled,
    isScreenSharing,
    screenStream,
    isSelfSpeaking,
    meetingTitle,
    userRole,
    participants,
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
    isChatReadOnly,
    isEndedMeeting,
    attendanceRecord,
    setIsChatOpen,
  } = screen;

  const nameForParticipant = (participant) => {
    const own = truncateDisplayName(participant?.name);
    if (own) return own;

    const entry = participants.find((part) => {
      const partUserId = part.userId || part.payload?.userId || part.memberId;
      const partConnId = part.connId || part.payload?.connId;
      return (
        (participant?.userId && partUserId && partUserId === participant.userId) ||
        (participant?.connId && partConnId && partConnId === participant.connId)
      );
    });

    return truncateDisplayName(
      entry?.displayName || entry?.payload?.displayName || entry?.name || entry?.payload?.name || entry
    );
  };

  // Auto-scroll to bottom when new chat messages arrive
  useEffect(() => {
    if (isChatOpen && chatScrollRef.current) {
      chatScrollRef.current.scrollToEnd({ animated: true });
    }
  }, [chatMessages, isChatOpen]);

  useEffect(() => {
    if (isConnecting) return;

    if (!chatBacklogSettledRef.current) {
      chatBacklogSettledRef.current = true;
      seenChatCountRef.current = chatMessages.length;
      return;
    }

    if (isChatOpen) {
      seenChatCountRef.current = chatMessages.length;
      setUnreadCount(0);
      return;
    }

    const arrived = chatMessages
      .slice(seenChatCountRef.current)
      .filter((msg) => !(msg.isOwn || msg.senderId === user?.id));
    seenChatCountRef.current = chatMessages.length;
    if (arrived.length > 0) {
      setUnreadCount((count) => count + arrived.length);
    }
  }, [chatMessages, isChatOpen, isConnecting, user?.id]);

  const submitChatMessage = () => {
    const text = chatDraft.trim();
    if (!text) return;
    handleSendChatMessage(text);
    setChatDraft('');
  };

  const hasRemoteScreenSharer = remoteStreams.some(s => s.isScreenSharing);
  const isAnyScreenShare = isScreenSharing || hasRemoteScreenSharer;

  // A screen share used to always win the stage, with no way to look closely
  // at someone else while it was up. Now an explicit tap on a tile's expand
  // control outranks it: the share doesn't stop, it just steps down into the
  // strip like any other tile (still showing its "(Screen)" thumbnail there)
  // while the person you tapped takes the big view.
  const expandedTile = expandedTileKey
    ? (expandedTileKey === 'self'
        ? { isLocal: true, participant: null }
        : (() => {
            const match = remoteStreams.find(s => s.connId === expandedTileKey);
            return match ? { isLocal: false, participant: match } : null;
          })())
    : null;

  const hasStageContent = isAnyScreenShare || !!expandedTile;
  const showExpandedView = hasStageContent && !isStageCollapsed;

  const getExpandedParticipant = () => {
    // A deliberate choice by the user outranks the automatic screen-share
    // focus.
    if (expandedTile) return expandedTile;

    const remoteScreenSharer = remoteStreams.find(s => s.isScreenSharing);
    if (remoteScreenSharer) {
      return { participant: remoteScreenSharer, isLocal: false };
    }
    if (isScreenSharing) {
      return { participant: { stream: screenStream }, isLocal: true };
    }
    return null;
  };

  const expandedData = getExpandedParticipant();
  const isStageScreenShare = !!expandedData && (
    expandedData.isLocal
      ? isScreenSharing
      : !!(expandedData.participant.isScreenSharing && expandedData.participant.screenStream)
  );

  const stageHoldsParticipant = showExpandedView && !!expandedData && !expandedData.isLocal;

  const stripRemoteParticipants = remoteStreams
    .filter(s => !stageHoldsParticipant || s.connId !== expandedData.participant.connId);

  const showSelfInStrip = isAnyScreenShare || (!!expandedTile && !expandedTile.isLocal);

  const isOneToOne = !isAnyScreenShare && !expandedTile && remoteStreams.length === 1;

 
  const showMiniStageCard = hasStageContent && isStageCollapsed;

  const galleryTiles = [
    ...(showMiniStageCard ? [{ key: 'stage-mini', isStageMini: true }] : []),
   
    { key: 'self', isSelf: true },
    ...remoteStreams
      .filter(p => !(showMiniStageCard && !expandedData?.isLocal && p.connId === expandedData?.participant?.connId))
      .map(participant => ({ key: participant.connId, isSelf: false, participant })),
  ];

  // Small screens fold into "+N more" a tile sooner (6, not 8) so cards never
  // shrink past readable -- the puzzle-fit math below would otherwise just
  // keep dividing them smaller as more people join.
  const isSmallDevice = windowWidth < 380 || windowHeight < 650;
  const maxVisibleTiles = isSmallDevice ? 6 : 8;

  const galleryOverflows = !isGalleryExpanded && galleryTiles.length > maxVisibleTiles;
  const visibleGalleryTiles = galleryOverflows
    ? galleryTiles.slice(0, maxVisibleTiles - 1)
    : galleryTiles;
  const overflowGalleryCount = galleryTiles.length - visibleGalleryTiles.length;

  // One person fills the screen, two divide it, and it keeps dividing as
  // more join -- rather than a fixed tile size that left a lone caller with
  // empty space around them. The "+N more" card counts as one of the tiles
  // being packed, so it sizes consistently with the rest. Falls back to the
  // window size until the gallery's own container has been measured (see
  // onGalleryLayout).
  const packedTileCount = visibleGalleryTiles.length + (overflowGalleryCount > 0 ? 1 : 0);
  // Sized as if only a screen's worth were showing, even once "+N more" has
  // been expanded to reveal the rest -- otherwise fitting every tile at once
  // would keep shrinking them as the list grows, when the actual intent of
  // expanding is to scroll to the rest at a normal, readable size.
  const layoutTileCount = Math.min(packedTileCount, maxVisibleTiles);
  const gridColumns = computeGridColumns(
    layoutTileCount,
    galleryAreaSize.width || windowWidth,
    galleryAreaSize.height || windowHeight
  );
  const gridRows = Math.max(1, Math.ceil(layoutTileCount / gridColumns));

  const rosterParticipants = participants
    .filter((entry) => {
      const entryUserId = entry.userId || entry.payload?.userId || entry.memberId;
      return Boolean(entryUserId) && entryUserId !== user?.id;
    })
    .map((entry) => {
      const entryUserId = entry.userId || entry.payload?.userId || entry.memberId;
      const resolvedName = getDisplayName(
        entry.displayName || entry.payload?.displayName || entry.name || entry.payload?.name || entry
      );
      return {
        id: entryUserId || entry.connId || resolvedName,
        name: truncateDisplayName(resolvedName, 18),
      };
    })
    .filter(entry => !!entry.name);

  const visibleRosterParticipants = rosterParticipants.slice(0, 6);
  const hiddenRosterCount = Math.max(0, rosterParticipants.length - visibleRosterParticipants.length);

  if (isEndedMeeting) {
    const { attendees = [], absentees = [] } = attendanceRecord || {};

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.reviewHeader, { borderBottomColor: colors.border }]}>
          <Ionicons name="calendar-outline" size={22} color={colors.textSecondary} />
          <View style={styles.reviewHeaderText}>
            <Text style={[styles.reviewTitle, { color: colors.text }]} numberOfLines={1}>
              {meetingTitle || 'Meeting'} — ended
            </Text>
            <Text style={[styles.reviewSubtitle, { color: colors.textSecondary }]}>
              Read-only record. You cannot join or send messages.
            </Text>
          </View>
        </View>

        <ScrollView style={styles.reviewBody} contentContainerStyle={styles.reviewBodyContent}>
          <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.reviewCardHeader, { borderBottomColor: colors.border }]}>
              <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.reviewCardTitle, { color: colors.text }]}>Attendance</Text>
            </View>

            {/* Counts share one row split by a vertical rule -- boxing each
                one added four more edges to a card that already has plenty. */}
            <View style={styles.reviewSummary}>
              <View style={styles.reviewStat}>
                <Text style={[styles.reviewStatValue, { color: colors.success }]}>{attendees.length}</Text>
                <Text style={[styles.reviewStatLabel, { color: colors.textSecondary }]}>Attended</Text>
              </View>
              <View style={[styles.reviewStatDivider, { backgroundColor: colors.border }]} />
              <View style={styles.reviewStat}>
                <Text style={[styles.reviewStatValue, { color: colors.textTertiary }]}>{absentees.length}</Text>
                <Text style={[styles.reviewStatLabel, { color: colors.textSecondary }]}>Absent</Text>
              </View>
            </View>

            <Text style={[styles.reviewGroupLabel, { color: colors.textSecondary }]}>
              Attended
            </Text>
            {attendees.length === 0 ? (
              <Text style={[styles.reviewEmpty, { color: colors.textSecondary }]}>
                No one joined this meeting.
              </Text>
            ) : (
              attendees.map((person, index) => (
                <View key={person.userId || `attendee-${index}`}>
                  {index > 0 && (
                    <View style={[styles.reviewSeparator, { borderBottomColor: colors.border }]} />
                  )}
                  <View style={styles.reviewRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={[styles.reviewRowText, { color: colors.text }]}>{person.name}</Text>
                  </View>
                </View>
              ))
            )}

            <Text style={[styles.reviewGroupLabel, { color: colors.textSecondary }]}>
              Absent
            </Text>
            {absentees.length === 0 ? (
              <Text style={[styles.reviewEmpty, { color: colors.textSecondary }]}>
                No absentees recorded.
              </Text>
            ) : (
              absentees.map((person, index) => (
                <View key={person.userId || `absentee-${index}`}>
                  {index > 0 && (
                    <View style={[styles.reviewSeparator, { borderBottomColor: colors.border }]} />
                  )}
                  <View style={styles.reviewRow}>
                    <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                    <Text style={[styles.reviewRowText, { color: colors.textSecondary }]}>{person.name}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.reviewCardHeader, { borderBottomColor: colors.border }]}>
              <Ionicons name="chatbubbles-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.reviewCardTitle, { color: colors.text }]}>
                Chat ({chatMessages.length})
              </Text>
            </View>
            {chatMessages.length === 0 ? (
              <Text style={[styles.reviewEmpty, { color: colors.textSecondary }]}>
                No messages were sent in this meeting.
              </Text>
            ) : (
              <View style={styles.reviewChatList}>
              {chatMessages.map((msg, index) => {
                const isOwn = msg.isOwn || msg.senderId === user?.id;
                return (
                  <View
                    key={msg.id || `msg-${index}`}
                    style={[styles.chatMessage, styles.reviewChatMessage, isOwn ? styles.chatMessageOwn : styles.chatMessageOther]}
                  >
                    <View
                      style={[
                        styles.chatBubble,
                        { backgroundColor: isOwn ? colors.primary : colors.backgroundTertiary },
                      ]}
                    >
                      <Text style={[styles.chatMessageText, { color: isOwn ? '#fff' : colors.text }]}>
                        {msg.content}
                      </Text>
                    </View>
                  </View>
                );
              })}
              </View>
            )}
          </View>

          <MeetingMinutesCard
            meetingId={route.params?.meetingId}
            meetingTitle={meetingTitle}
            chamaId={route.params?.chamaId || route.params?.meetingData?.chamaId}
            userRole={userRole}
            colors={colors}
            navigation={navigation}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isConnecting) {
    return (
      <OnlineMeetingLoading
        theme={theme}
        meetingTitle={meetingTitle}
        isPreview={false}
      />
    );
  }

  if (connectionError) {
    return <OnlineMeetingErrorView theme={theme} error={connectionError} />;
  }

  const renderVideoElement = (stream, isLocal = false, connId = null, isScreen = false, placeholderName = '') => {
    // Show placeholder when local camera is disabled
    if (isLocal && !isScreen && !isCameraEnabled) {
      return (
        <View style={[styles.videoPlaceholder, { backgroundColor: colors.surface }]}>
          <Ionicons
            name="videocam-off"
            size={48}
            color={colors.textSecondary}
          />
          <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
            Camera off
          </Text>
        </View>
      );
    }

    if (!stream && (!isLocal || isScreen)) {
      return (
        <View style={[styles.videoPlaceholder, { backgroundColor: colors.surface }]}>
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
            <Ionicons name="person" size={36} color="#fff" />
          </View>
          {!!placeholderName && (
            <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
              {truncateDisplayName(placeholderName, 18)}
            </Text>
          )}
        </View>
      );
    }

    if (isWeb) {
      // Use a dedicated WebVideo component so srcObject is attached reliably
      // (keyed to the stream itself, avoiding shared-ref / timing bugs).
      return (
        <WebVideo
          key={isLocal ? `local-${isScreen ? 'screen' : `camera-${isCameraEnabled}`}` : `remote-${connId}-${isScreen ? 'screen' : 'camera'}`}
          stream={stream}
          muted={isLocal}
          style={styles.video}
        />
      );
    }

    if (RTCView && stream && typeof stream.toURL === 'function') {
      const streamUrl = stream.toURL();
      return (
        <RTCView
          key={isLocal ? `local-${isScreen ? 'screen' : `camera-${isCameraEnabled}`}` : `remote-${connId}-${isScreen ? 'screen' : 'camera'}`}
          streamURL={streamUrl}
          style={styles.video}
          objectFit="cover"
          mirror={isLocal && !isScreen}
          zOrder={0}
        />
      );
    }

    return (
      <View style={[styles.videoPlaceholder, { backgroundColor: colors.surface }]}>
        <Ionicons
          name={isLocal ? 'person' : 'people'}
          size={48}
          color={colors.textSecondary}
        />
        <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
          {isLocal ? 'You' : truncateDisplayName(placeholderName, 18)}
        </Text>
      </View>
    );
  };

  // Width is deliberately not computed here at all: each tile gets flex: 1
  // inside its row (see the gallery render below) and flexbox splits that
  // row's width evenly among however many tiles are actually in it -- which
  // also means a short last row (say, 1 tile left over in a 3-column grid)
  // gives that tile the row's full width automatically, instead of leaving
  // empty space beside it the way a fixed per-column width would.
  //
  // Height still has to be computed: an explicit, equal share of the
  // gallery's measured height per row. gridVideoWrapper carries no default
  // width/aspectRatio of its own to fight with here (see its definition) --
  // this used to also set width: undefined / aspectRatio: undefined to try
  // to override fixed values on that base style, which isn't reliable
  // through react-native-web's style flattening.
  const galleryTileSizeStyle = () => {
    const gutter = spacing.xs * 2;
    const outerPadding = spacing.sm * 2;
    const containerHeight = galleryAreaSize.height || windowHeight;
    const availableHeight = Math.max(0, containerHeight - outerPadding);
    return {
      flex: 1,
      height: Math.max(MIN_TILE_HEIGHT, availableHeight / gridRows - gutter),
    };
  };

  const renderTileExpandControl = (tileKey) => {
    if (revealedTileKey !== tileKey) return null;
    const isExpanded = expandedTileKey === tileKey;

    return (
      <TouchableOpacity
        style={[styles.tileExpand, { backgroundColor: colors.overlay }]}
        onPress={() => {
          setExpandedTileKey(isExpanded ? null : tileKey);
          setIsStageCollapsed(false);
          setRevealedTileKey(null);
        }}
        accessibilityLabel={isExpanded ? 'Minimise this participant' : 'Expand this participant'}
      >
        <Ionicons name={isExpanded ? 'contract' : 'expand'} size={16} color="#fff" />
      </TouchableOpacity>
    );
  };

  // The compact stand-in for the stage while it's minimised -- same content
  // as the full stage (see the stage view below), just small and first in
  // the grid, so a minimised screen share is still there to glance at and
  // tap back open rather than disappearing until someone remembers the
  // toggle button.
  const renderMiniStageTile = (sizeStyle = null) => {
    if (!expandedData) return null;

    const stream = expandedData.isLocal
      ? (isScreenSharing ? screenStream : localStream)
      : (expandedData.participant.isScreenSharing && expandedData.participant.screenStream
          ? expandedData.participant.screenStream
          : expandedData.participant.stream);

    const label = expandedData.isLocal
      ? (isScreenSharing ? 'Your Screen' : 'You')
      : (expandedData.participant.isScreenSharing
          ? `${nameForParticipant(expandedData.participant)} (Screen)`
          : nameForParticipant(expandedData.participant));

    return (
      <TouchableOpacity
        key="stage-mini"
        activeOpacity={0.9}
        onPress={() => setIsStageCollapsed(false)}
        style={[
          styles.gridVideoWrapper,
          { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 2 },
          sizeStyle,
        ]}
        accessibilityLabel="Restore the shared screen"
      >
        {renderVideoElement(
          stream,
          expandedData.isLocal,
          expandedData.isLocal ? null : expandedData.participant.connId,
          isStageScreenShare,
          label
        )}
        <View style={[styles.videoLabel, { backgroundColor: colors.primary + '40' }]}>
          <Text style={styles.videoLabelText}>{label}</Text>
        </View>
        <View style={[styles.tileExpand, { backgroundColor: colors.overlay }]}>
          <Ionicons name="expand" size={16} color="#fff" />
        </View>
      </TouchableOpacity>
    );
  };

  // One tile definition shared by the horizontal strip (`compact`) and the
  // wrapped grid, so the two layouts can never drift apart.
  const renderParticipantTile = (participant, compact, sizeStyle = null) => {
    const { connId, stream, screenStream: participantScreen, isScreenSharing: sharing, isSpeaking } = participant;
    const label = nameForParticipant(participant);

    return (
      <TouchableOpacity
        key={connId}
        activeOpacity={0.9}
        onPress={() => revealTileControls(connId)}
        style={[
          styles.gridVideoWrapper,
          { backgroundColor: colors.card, borderColor: colors.border },
          compact && styles.gridVideoWrapperExpanded,
          sizeStyle,
          // A speaking participant is outlined, the way the tile itself
          // signals who has the floor before you even read the name.
          isSpeaking && { borderColor: colors.success, borderWidth: 2 },
        ]}
      >
        {renderVideoElement(
          sharing && participantScreen ? participantScreen : stream,
          false,
          connId,
          !!(sharing && participantScreen),
          label
        )}
        {!!label && (
          <View style={[styles.videoLabel, { backgroundColor: colors.textSecondary + '40' }]}>
            {sharing && (
              <Ionicons name="desktop" size={14} color={colors.primary} style={{ marginRight: 4 }} />
            )}
            {isSpeaking && <SpeakingIndicator color={colors.success} />}
            <Text style={styles.videoLabelText}>
              {sharing ? `${label} (Screen)` : label}
            </Text>
          </View>
        )}
        {renderTileExpandControl(connId)}
      </TouchableOpacity>
    );
  };

  const renderSelfTile = (compact, sizeStyle = null) => (
    <TouchableOpacity
      key="self"
      activeOpacity={0.9}
      onPress={() => revealTileControls('self')}
      style={[
        styles.gridVideoWrapper,
        { backgroundColor: colors.card, borderColor: colors.border },
        compact && styles.gridVideoWrapperExpanded,
        sizeStyle,
        isSelfSpeaking && { borderColor: colors.success, borderWidth: 2 },
      ]}
    >
      {renderVideoElement(localStream, true)}
      <View style={[styles.videoLabel, { backgroundColor: colors.primary + '40' }]}>
        {isSelfSpeaking && <SpeakingIndicator color={colors.success} />}
        <Text style={styles.videoLabelText}>{isScreenSharing ? 'You · Camera' : 'You'}</Text>
      </View>
      {renderTileExpandControl('self')}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.videoArea}>
        {showExpandedView && expandedData && (
          <View
            style={[
              styles.expandedVideoContainer,
              { backgroundColor: colors.card, borderColor: colors.border },
              isStageScreenShare && [styles.stageSharing, { borderColor: colors.primary }],
            ]}
          >
            {expandedData.isLocal ? (
              isScreenSharing
                ? renderVideoElement(screenStream, true, null, true)
                : (localStream ? renderVideoElement(localStream, true) : renderVideoElement(null, true))
            ) : (
              renderVideoElement(
                expandedData.participant.isScreenSharing && expandedData.participant.screenStream
                  ? expandedData.participant.screenStream
                  : expandedData.participant.stream,
                false,
                expandedData.participant.connId,
                !!(expandedData.participant.isScreenSharing && expandedData.participant.screenStream)
              )
            )}
            
            {isWeb
              && !expandedData.isLocal
              && expandedData.participant.isScreenSharing
              && expandedData.participant.screenStream
              && expandedData.participant.stream && (
              <WebVideo
                key={`stage-audio-${expandedData.participant.connId}`}
                stream={expandedData.participant.stream}
                muted={false}
                style={styles.audioOnlySink}
              />
            )}
            <View style={[styles.videoLabel, { backgroundColor: colors.primary + '40' }]}>
              <Text style={styles.videoLabelText}>
                {expandedData.isLocal
                  ? (isScreenSharing ? 'Your Screen' : 'You')
                  : (expandedData.participant.isScreenSharing
                      ? `${nameForParticipant(expandedData.participant)} (Screen)`
                      : nameForParticipant(expandedData.participant))}
              </Text>
            </View>
          </View>
        )}

        {/* Sits over the video area rather than inside the stage tile, so it
            is still reachable to restore the stage once it's minimised. */}
        {hasStageContent && (
          <TouchableOpacity
            style={[styles.stageToggle, { backgroundColor: colors.overlay }]}
            onPress={() => {
              // Closing a tile someone expanded hands the stage back to
              // whatever it would show automatically -- the screen share, if
              // one is running, otherwise the grid. Only when nothing is
              // manually expanded does this button minimise the share itself
              // (which is never ours to end from here).
              if (expandedTile) {
                setExpandedTileKey(null);
                setIsStageCollapsed(false);
                return;
              }
              setIsStageCollapsed(!isStageCollapsed);
            }}
            accessibilityLabel={isStageCollapsed ? 'Expand main view' : 'Minimise main view'}
          >
            <Ionicons
              name={isStageCollapsed ? 'expand' : 'contract'}
              size={18}
              color="#fff"
            />
          </TouchableOpacity>
        )}

        {showExpandedView ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.participantStrip}
            contentContainerStyle={styles.participantStripContent}
          >
            {showSelfInStrip && renderSelfTile(true)}
            {stripRemoteParticipants.map(participant => renderParticipantTile(participant, true))}
          </ScrollView>
        ) : isOneToOne ? (
          
          <View style={styles.oneToOneArea}>
            {renderParticipantTile(remoteStreams[0], false, styles.oneToOneRemote)}
            {renderSelfTile(false, styles.oneToOneSelf)}
          </View>
        ) : (
          
          <ScrollView
            style={styles.gallery}
            contentContainerStyle={styles.videoGrid}
            showsVerticalScrollIndicator={isGalleryExpanded}
            onLayout={onGalleryLayout}
          >
            {chunkIntoRows(
              [
                ...visibleGalleryTiles.map(tile => (
                  tile.isStageMini
                    ? renderMiniStageTile(galleryTileSizeStyle())
                    : tile.isSelf
                      ? renderSelfTile(false, galleryTileSizeStyle())
                      : renderParticipantTile(tile.participant, false, galleryTileSizeStyle())
                )),
                ...(overflowGalleryCount > 0 ? [
                  <TouchableOpacity
                    key="gallery-more"
                    style={[
                      styles.gridVideoWrapper,
                      galleryTileSizeStyle(),
                      styles.hiddenParticipantsBadge,
                    ]}
                    onPress={() => setIsGalleryExpanded(true)}
                    accessibilityLabel={`Show ${overflowGalleryCount} more participants`}
                  >
                    <View style={styles.hiddenParticipantsContent}>
                      <Ionicons name="people" size={28} color="#fff" />
                      <Text style={styles.hiddenParticipantsText}>+{overflowGalleryCount} more</Text>
                    </View>
                  </TouchableOpacity>,
                ] : []),
              ],
              gridColumns
            ).map((rowItems, rowIndex) => (
              <View key={`gallery-row-${rowIndex}`} style={styles.galleryRow}>
                {rowItems}
              </View>
            ))}
          </ScrollView>
        )}

        {/* Once expanded, offer the way back to the compact grid. */}
        {!showExpandedView && isGalleryExpanded && galleryTiles.length > maxVisibleTiles && (
          <TouchableOpacity
            style={[styles.galleryCollapse, { backgroundColor: colors.overlay }]}
            onPress={() => setIsGalleryExpanded(false)}
            accessibilityLabel="Show fewer participants"
          >
            <Ionicons name="contract" size={16} color="#fff" />
            <Text style={styles.galleryCollapseText}>Show less</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.controls, { backgroundColor: colors.surface + 'E6' }]}>
        <TouchableOpacity
          style={[styles.controlButton, !isMicrophoneEnabled && styles.controlButtonOff]}
          onPress={handleToggleMicrophone}
        >
          <Ionicons
            name={isMicrophoneEnabled ? 'mic' : 'mic-off'}
            size={24}
            color={isMicrophoneEnabled ? colors.text : colors.error}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !isCameraEnabled && styles.controlButtonOff]}
          onPress={handleToggleCamera}
        >
          <Ionicons
            name={isCameraEnabled ? 'videocam' : 'videocam-off'}
            size={24}
            color={isCameraEnabled ? colors.text : colors.error}
          />
        </TouchableOpacity>

        {/* Front/back camera flip. Native only -- switching a webcam this way
            isn't a thing on web, and handleSwitchCamera is a no-op there. */}
        {!isWeb && isCameraEnabled && (
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleSwitchCamera}
            accessibilityLabel="Switch camera"
          >
            <Ionicons name="camera-reverse-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.controlButton,
            isScreenSharing && { backgroundColor: 'rgba(59,130,246,0.4)' },
          ]}
          onPress={handleToggleScreenShare}
        >
          <Ionicons
            name={isScreenSharing ? 'share' : 'share-outline'}
            size={24}
            color={isScreenSharing ? colors.primary : colors.text}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={handleEndCall}
        >
          <Ionicons name="call" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isChatOpen && { backgroundColor: colors.primary + '40' }]}
          onPress={() => setIsChatOpen(!isChatOpen)}
          accessibilityLabel={unreadCount > 0 ? `Chat, ${unreadCount} unread` : 'Chat'}
        >
          <Ionicons
            name="chatbubbles"
            size={24}
            color={isChatOpen ? colors.primary : colors.text}
          />
          {unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
              <Text style={styles.unreadBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {isChatOpen && (
        <View style={[styles.chatPanel, { backgroundColor: colors.surface }]}> 
          <View style={[styles.chatHeader, { borderBottomColor: colors.border }]}> 
            <Text style={[styles.chatTitle, { color: colors.text }]}>Meeting Chat</Text>
            <TouchableOpacity onPress={() => setIsChatOpen(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.chatMessages} ref={chatScrollRef}>
            {chatMessages.map((msg, index) => {
              const isOwn = msg.isOwn || msg.senderId === user?.id;
              return (
                <View
                  key={msg.id || index}
                  style={[
                    styles.chatMessage,
                    isOwn ? styles.chatMessageOwn : styles.chatMessageOther,
                  ]}
                >
                  <View
                    style={[
                      styles.chatBubble,
                      { backgroundColor: isOwn ? colors.primary : colors.backgroundTertiary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chatMessageText,
                        { color: isOwn ? '#fff' : colors.text },
                      ]}
                    >
                      {msg.content}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          {isChatReadOnly ? (
            <View style={[styles.chatInput, { borderTopColor: colors.border }]}>
              <Text style={[styles.chatReadOnlyNote, { color: colors.textSecondary }]}>
                This meeting has ended — chat is read-only.
              </Text>
            </View>
          ) : (
          <View style={[styles.chatInput, { borderTopColor: colors.border }]}>
            <TextInput
              style={[styles.chatInputField, { color: colors.text, backgroundColor: colors.background }]}
              placeholder="Type a message..."
              placeholderTextColor={colors.textSecondary}
              value={chatDraft}
              onChangeText={setChatDraft}
              onSubmitEditing={submitChatMessage}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[
                styles.chatSendButton,
                { backgroundColor: chatDraft.trim() ? colors.primary : colors.backgroundTertiary },
              ]}
              onPress={submitChatMessage}
              disabled={!chatDraft.trim()}
              accessibilityLabel="Send message"
            >
              <Ionicons
                name="send"
                size={18}
                color={chatDraft.trim() ? '#fff' : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          )}
        </View>
      )}

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  reviewHeaderText: {
    flex: 1,
  },
  reviewTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
  },
  reviewSubtitle: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  reviewBody: {
    flex: 1,
  },
  reviewBodyContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  // Ended meetings are a record, not a live surface: flat, bordered cards,
  // deliberately no elevation/shadow.
  reviewCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: spacing.md,
    overflow: 'hidden',
    elevation: 0,
    shadowOpacity: 0,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  reviewCardTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
  },
  reviewSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  reviewStat: {
    flex: 1,
    alignItems: 'center',
  },
  // Vertical rule, so splitting the two counts costs no extra horizontal line.
  reviewStatDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: spacing.xs,
  },
  reviewStatValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
  },
  reviewStatLabel: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  reviewGroupLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  reviewChatMessage: {
    paddingHorizontal: spacing.md,
  },
  // Without this the first bubble sat flush against the card header.
  reviewChatList: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  // Dotted and inset from the card edges: enough to separate two names,
  // not enough to read as another rule across the card. borderRadius is
  // required for Android to honour a dotted border at all.
  reviewSeparator: {
    marginHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderStyle: 'dotted',
    borderRadius: 1,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 1,
  },
  reviewRowText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
  },
  reviewEmpty: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  videoArea: {
    flex: 1,
    position: 'relative',
  },
  expandedVideoContainer: {
    flex: 1,
    margin: spacing.sm,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#374151',
  },
  gallery: {
    flex: 1,
  },
  oneToOneArea: {
    flex: 1,
    position: 'relative',
    padding: spacing.sm,
  },
  // The other participant takes the whole area rather than a fixed 16:9 tile,
  // so a one-to-one call uses the screen it has.
  oneToOneRemote: {
    flex: 1,
    width: '100%',
    height: '100%',
    aspectRatio: undefined,
    margin: 0,
  },
  // Bigger than the old floating preview, and back in the top-right corner.
  oneToOneSelf: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 150,
    height: 210,
    aspectRatio: undefined,
    margin: 0,
    zIndex: 10,
  },
  // Rows are now explicit children (see renderGalleryRows/galleryRow) rather
  // than left to flexWrap, so each tile's width can be flex: 1 of its own
  // row -- a flexWrap layout has no concept of "this row only has one tile
  // left, give it the full row" the way explicit rows naturally do.
  videoGrid: {
    flexDirection: 'column',
    padding: spacing.sm,
  },
  galleryRow: {
    flexDirection: 'row',
  },
  galleryCollapse: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    zIndex: 10,
  },
  galleryCollapseText: {
    color: '#fff',
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  tileExpand: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  speakingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginRight: 5,
    height: 12,
  },
  speakingBar: {
    width: 3,
    height: 12,
    borderRadius: 2,
  },
  // Fixed height so the strip never steals room from the stage above it.
  participantStrip: {
    flexGrow: 0,
    flexShrink: 0,
  },
  participantStripContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  stageSharing: {
    borderWidth: 2,
  },
  // No default width/aspectRatio/minHeight here on purpose. This used to
  // carry width: '48%' and aspectRatio: 16/9 for the old flexWrap grid, and
  // every current caller (grid tiles, one-to-one, the strip, the mini stage
  // card) now provides its own explicit sizing on top of this base style --
  // which relied on a later `width: undefined` / `aspectRatio: undefined` in
  // that override actually clearing the earlier value. That works reliably
  // on native, but not dependably through react-native-web's style
  // flattening, so on web the old 48%/16:9 values could keep winning even
  // though the override style was applied after them -- e.g. three people
  // meant to stack as three full-width rows instead rendered as narrow,
  // fixed-ratio tiles fighting the intended layout. Leaving no default at
  // all removes the conflict outright: nothing is ever left to override.
  gridVideoWrapper: {
    margin: spacing.xs,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#374151',
  },
  gridVideoWrapperExpanded: {
    width: 120,
    minWidth: 120,
    height: 80,
    margin: spacing.xs,
  },
  // Carries a participant's audio while only their screen is on display.
  // Sized away rather than display:none, which can stop playback.
  audioOnlySink: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  stageToggle: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 11,
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    objectFit: 'cover',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  placeholderText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
  },
  videoLabel: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoLabelText: {
    color: '#fff',
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  hiddenParticipantsBadge: {
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hiddenParticipantsContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  hiddenParticipantsText: {
    color: '#fff',
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  // With up to six buttons possible (mic, camera, camera-switch,
  // screen-share, end-call, chat), the old spacing.lg gap plus spacing.lg
  // padding needed ~456px of width -- wider than most phone screens -- so
  // the row overflowed and the outer buttons ended up crowded against, or
  // past, the screen edges. Tighter gap and padding keeps everything inside
  // the screen with real space at both ends instead of buttons sitting flush
  // against them.
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonOff: {
    backgroundColor: 'rgba(255,0,0,0.2)',
  },
  endCallButton: {
    backgroundColor: '#dc2626',
  },
  chatPanel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 80,
    width: 300,
    borderLeftWidth: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  chatTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
  },
   chatMessages: {
    flex: 1,
    padding: spacing.sm,
  },
  chatMessage: {
    marginBottom: spacing.sm,
    width: '100%',
  },
  chatMessageOwn: {
    alignItems: 'flex-end',
  },
  chatMessageOther: {
    alignItems: 'flex-start',
  },
  chatBubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
  },
  chatMessageText: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * 1.3,
  },
  chatInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  chatInputField: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.sm,
  },
  chatReadOnlyNote: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    paddingVertical: spacing.sm,
  },
  chatSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default OnlineMeetingScreen;
