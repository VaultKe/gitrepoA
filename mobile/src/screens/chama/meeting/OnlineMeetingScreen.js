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
const MAX_GRID_PARTICIPANTS = 3;

const getDisplayName = (value, fallback = 'Guest') => {
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
  const name = getDisplayName(value, 'Guest');
  if (name.length <= maxLength) return name;
  return `${name.slice(0, Math.max(1, maxLength - 1)).trim()}…`;
};

const OnlineMeetingScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const screen = useOnlineMeetingScreen({ route, navigation });
  const chatScrollRef = useRef(null);
  // Whether the user has minimised the big "stage" tile. This is the user's
  // own choice, kept separate from whether there is anything worth showing
  // there, so the minimise button can actually collapse it.
  const [isStageCollapsed, setIsStageCollapsed] = useState(false);
  const [pinnedParticipantId, setPinnedParticipantId] = useState(null);
  const [chatDraft, setChatDraft] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  // How many messages the user has already been shown, and whether the
  // backlog fetched on join has landed yet (that backlog isn't "unread").
  const seenChatCountRef = useRef(0);
  const chatBacklogSettledRef = useRef(false);

  const {
    isConnecting,
    connectionError,
    isCameraEnabled,
    isMicrophoneEnabled,
    isScreenSharing,
    screenStream,
    screenShareViewerCount,
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

  // Auto-scroll to bottom when new chat messages arrive
  useEffect(() => {
    if (isChatOpen && chatScrollRef.current) {
      chatScrollRef.current.scrollToEnd({ animated: true });
    }
  }, [chatMessages, isChatOpen]);

  // Unread badge for the chat button: counts messages from others that
  // arrived while the panel was closed, and clears as soon as it's opened.
  useEffect(() => {
    if (isConnecting) return;

    if (!chatBacklogSettledRef.current) {
      // History loaded on join is already "read" -- don't open the meeting
      // with a badge counting the whole conversation so far.
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

  // Determine the active participant for expanded view
  // Priority: 1. Remote screen sharer, 2. Active speaker, 3. First remote participant
  const getActiveParticipant = () => {
    const remoteScreenSharer = remoteStreams.find(s => s.isScreenSharing);
    if (remoteScreenSharer) return remoteScreenSharer;

    const remoteActiveSpeaker = remoteStreams.find(s => s.isActive || s.isSpeaking);
    if (remoteActiveSpeaker) return remoteActiveSpeaker;

    return remoteStreams.length > 0 ? remoteStreams[0] : null;
  };

  const activeParticipant = getActiveParticipant();

  // Auto-pin active participant when they change
  useEffect(() => {
    if (activeParticipant) {
      setPinnedParticipantId(activeParticipant.connId);
    }
  }, [activeParticipant?.connId]);

  // Is there anything worth putting on the big stage at all?
  const hasRemoteScreenSharer = remoteStreams.some(s => s.isScreenSharing);
  const hasStageContent = isScreenSharing || hasRemoteScreenSharer || !!activeParticipant;
  // The minimise button used to be OR'd into this alongside `activeParticipant`,
  // which is truthy whenever anyone else is in the call -- so the stage was
  // always shown and pressing minimise only ever flipped the icon.
  const showExpandedView = hasStageContent && !isStageCollapsed;
  const isAnyScreenShare = isScreenSharing || hasRemoteScreenSharer;

  // Get the participant to show in expanded view
  // Priority: 1. Remote screen sharer (always show when someone is sharing)
  //           2. User pinned participant, 3. Local screen sharing, 4. Active participant
  const getExpandedParticipant = () => {
    // Always show remote screen sharer in expanded view (highest priority)
    const remoteScreenSharer = remoteStreams.find(s => s.isScreenSharing);
    if (remoteScreenSharer) {
      return { participant: remoteScreenSharer, isLocal: false };
    }
    // Our own share outranks a pinned participant: otherwise the auto-pin
    // (which always picks a remote tile) hid the local screen preview, leaving
    // the sharer with no way to tell whether their share was actually live.
    if (isScreenSharing) {
      return { participant: { stream: screenStream }, isLocal: true };
    }
    // If user manually pinned someone, show them
    if (pinnedParticipantId) {
      const pinned = remoteStreams.find(s => s.connId === pinnedParticipantId);
      if (pinned) return { participant: pinned, isLocal: false };
    }
    // Show active participant
    if (activeParticipant) {
      return { participant: activeParticipant, isLocal: false };
    }
    return null;
  };

  const expandedData = getExpandedParticipant();
  const isStageScreenShare = !!expandedData && (
    expandedData.isLocal
      ? isScreenSharing
      : !!(expandedData.participant.isScreenSharing && expandedData.participant.screenStream)
  );

  // The stage only "uses up" a participant while it's actually on screen --
  // once minimised they belong back in the grid, otherwise minimising would
  // make that person vanish from the call entirely.
  const stageHoldsParticipant = showExpandedView && !!expandedData && !expandedData.isLocal;

  const gridRemoteParticipants = remoteStreams
    .filter(s => !stageHoldsParticipant || s.connId !== expandedData.participant.connId)
    .slice(0, MAX_GRID_PARTICIPANTS);

  const hiddenParticipantsCount = Math.max(0,
    remoteStreams.length - gridRemoteParticipants.length - (stageHoldsParticipant ? 1 : 0)
  );

  const rosterParticipants = participants
    .filter((entry) => {
      const entryUserId = entry.userId || entry.payload?.userId || entry.memberId;
      return Boolean(entryUserId) && entryUserId !== user?.id;
    })
    .map((entry) => {
      const entryUserId = entry.userId || entry.payload?.userId || entry.memberId;
      const fallbackName = getDisplayName(entry.displayName || entry.payload?.displayName || entry.name || entry.payload?.name || 'Guest');
      return {
        id: entryUserId || entry.connId || `${entry.displayName || 'guest'}-${Math.random()}`,
        name: truncateDisplayName(fallbackName, 18),
      };
    });

  const visibleRosterParticipants = rosterParticipants.slice(0, 6);
  const hiddenRosterCount = Math.max(0, rosterParticipants.length - visibleRosterParticipants.length);

  // A finished meeting is reviewed, not joined -- so no video area, no
  // controls, and (in the hook) no camera or microphone is ever requested.
  // What remains is its record: the chat that took place and who was there.
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

  // `isScreen` marks content that is a screen share rather than a camera
  // feed. It matters for the local preview: the camera-off placeholder below
  // must not swallow your own screen share, which is why the presenter saw
  // "Camera off" while everyone else was watching their screen just fine.
  const renderVideoElement = (stream, isLocal = false, connId = null, isScreen = false) => {
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

    // Show placeholder for remote participants without media streams
    // (e.g., they joined but haven't enabled camera/microphone yet)
    if (!stream && (!isLocal || isScreen)) {
      const placeholderName = 'Guest';
      return (
        <View style={[styles.videoPlaceholder, { backgroundColor: colors.surface }]}> 
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}> 
            <Ionicons name="person" size={36} color="#fff" />
          </View>
          <Text style={[styles.placeholderText, { color: colors.textSecondary }]}> 
            {truncateDisplayName(placeholderName, 18)}
          </Text>
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
          {isLocal ? 'You' : 'Guest'}
        </Text>
      </View>
    );
  };

  // One tile definition shared by the horizontal strip (`compact`) and the
  // wrapped grid, so the two layouts can never drift apart.
  const renderParticipantTile = (participant, compact) => {
    const { connId, stream, screenStream: participantScreen, name, isScreenSharing: sharing } = participant;
    return (
      <View
        key={connId}
        style={[
          styles.gridVideoWrapper,
          { backgroundColor: colors.card, borderColor: colors.border },
          compact && styles.gridVideoWrapperExpanded,
        ]}
      >
        {renderVideoElement(
          sharing && participantScreen ? participantScreen : stream,
          false,
          connId,
          !!(sharing && participantScreen)
        )}
        <View style={[styles.videoLabel, { backgroundColor: colors.textSecondary + '40' }]}>
          {sharing && (
            <Ionicons name="desktop" size={14} color={colors.primary} style={{ marginRight: 4 }} />
          )}
          <Text style={styles.videoLabelText}>
            {sharing ? `${truncateDisplayName(name || 'Guest')} (Screen)` : truncateDisplayName(name || 'Guest')}
          </Text>
        </View>
      </View>
    );
  };

  const renderSelfTile = (compact) => (
    <View
      key="self"
      style={[
        styles.gridVideoWrapper,
        { backgroundColor: colors.card, borderColor: colors.border },
        compact && styles.gridVideoWrapperExpanded,
      ]}
    >
      {renderVideoElement(localStream, true)}
      <View style={[styles.videoLabel, { backgroundColor: colors.primary + '40' }]}>
        <Text style={styles.videoLabelText}>{isScreenSharing ? 'You · Camera' : 'You'}</Text>
      </View>
    </View>
  );

  const renderOthersTile = (compact) => (
    <View
      key="others"
      style={[
        styles.gridVideoWrapper,
        compact && styles.gridVideoWrapperExpanded,
        styles.hiddenParticipantsBadge,
      ]}
    >
      <View style={styles.hiddenParticipantsContent}>
        <Ionicons name="people" size={compact ? 22 : 32} color="#fff" />
        <Text style={styles.hiddenParticipantsText}>+{hiddenParticipantsCount} others</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.videoArea}>
        {showExpandedView && expandedData && (
          <View
            style={[
              styles.expandedVideoContainer,
              { backgroundColor: colors.card, borderColor: colors.border },
              // A shared screen is the thing everyone is meant to be looking
              // at, so the stage is set apart from the participant tiles
              // rather than just being a bigger one of them.
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
            {/* Their screen travels on its own track, separate from their
                camera and mic. Showing the screen alone would leave that
                mic track with nowhere to play on web, so the sharer goes
                silent exactly while they're presenting. Keep an audio-only
                sink alive for them. Native plays remote audio without a
                view, so this is web-only -- and it is the single sink for
                this participant, since the grid excludes whoever is on the
                stage, so it cannot double up and echo. */}
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
                  ? (isScreenSharing
                      ? `Your Screen${screenShareViewerCount > 0 ? ` · Seen by ${screenShareViewerCount}` : ' · Not confirmed seen yet'}`
                      : 'You')
                  : (expandedData.participant.isScreenSharing
                      ? `${truncateDisplayName(expandedData.participant.name || 'Guest')} (Screen)`
                      : truncateDisplayName(expandedData.participant.name || 'Guest'))}
              </Text>
            </View>
          </View>
        )}

        {/* Sits over the video area rather than inside the stage tile, so it
            is still reachable to restore the stage once it's minimised. */}
        {hasStageContent && (
          <TouchableOpacity
            style={[styles.stageToggle, { backgroundColor: colors.overlay }]}
            onPress={() => setIsStageCollapsed(!isStageCollapsed)}
            accessibilityLabel={isStageCollapsed ? 'Expand main view' : 'Minimise main view'}
          >
            <Ionicons
              name={isStageCollapsed ? 'expand' : 'contract'}
              size={18}
              color="#fff"
            />
          </TouchableOpacity>
        )}

        {/* Participants sit in a row beneath the stage and scroll sideways.
            This used to be a plain View relying on `overflowX: auto`, which is
            a web CSS property React Native ignores -- so on a phone the tiles
            past the third were simply unreachable. */}
        {showExpandedView ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.participantStrip}
            contentContainerStyle={styles.participantStripContent}
          >
            {isAnyScreenShare && renderSelfTile(true)}
            {gridRemoteParticipants.map(participant => renderParticipantTile(participant, true))}
            {hiddenParticipantsCount > 0 && renderOthersTile(true)}
          </ScrollView>
        ) : (
          <View style={styles.videoGrid}>
            {isAnyScreenShare && renderSelfTile(false)}
            {gridRemoteParticipants.map(participant => renderParticipantTile(participant, false))}
            {hiddenParticipantsCount > 0 && renderOthersTile(false)}
          </View>
        )}

        {/* The floating self-view is fine over a face, but it would cover part
            of whatever is being presented -- so while any screen is shared it
            steps down into the strip and takes its turn like everyone else. */}
        {!isAnyScreenShare && (
          <View style={[styles.selfViewPiP, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {renderVideoElement(localStream, true)}
            <View style={[styles.videoLabel, { backgroundColor: colors.primary + '40' }]}>
              <Text style={styles.videoLabelText}>You</Text>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.controls, { backgroundColor: colors.surface + 'E6' }]}>
        <TouchableOpacity
          style={[styles.controlButton, !isMicrophoneEnabled && styles.controlButtonOff]}
          onPress={screen.handleToggleMicrophone}
        >
          <Ionicons
            name={isMicrophoneEnabled ? 'mic' : 'mic-off'}
            size={24}
            color={isMicrophoneEnabled ? colors.text : colors.error}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !isCameraEnabled && styles.controlButtonOff]}
          onPress={screen.handleToggleCamera}
        >
          <Ionicons
            name={isCameraEnabled ? 'videocam' : 'videocam-off'}
            size={24}
            color={isCameraEnabled ? colors.text : colors.error}
          />
        </TouchableOpacity>

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
  videoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.sm,
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
  gridVideoWrapper: {
    width: '48%',
    aspectRatio: 16 / 9,
    minHeight: 100,
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
  selfViewPiP: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 132,
    height: 184,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#374151',
    zIndex: 10,
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
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
