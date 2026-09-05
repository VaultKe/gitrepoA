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
  const { isReadOnly = false } = route.params || {};
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

  if (isReadOnly) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.readOnlyContainer}>
          <Ionicons name="calendar-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.readOnlyTitle, { color: colors.text }]}>
            Meeting Ended
          </Text>
          <Text style={[styles.readOnlySubtitle, { color: colors.textSecondary }]}>
            This online meeting has already ended. You can view past meeting details but cannot join.
          </Text>
        </View>
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

  const renderVideoElement = (stream, isLocal = false, connId = null) => {
    // Show placeholder when local camera is disabled
    if (isLocal && !isCameraEnabled) {
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
    if (!isLocal && !stream) {
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
          key={isLocal ? `local-${isCameraEnabled}` : `remote-${connId}`}
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
          key={isLocal ? `local-${isCameraEnabled}` : `remote-${connId}`}
          streamURL={streamUrl}
          style={styles.video}
          objectFit="cover"
          mirror={isLocal}
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.videoArea}>
        {showExpandedView && expandedData && (
          <View style={[styles.expandedVideoContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {expandedData.isLocal ? (
              isScreenSharing ? renderVideoElement(screenStream, true) : (localStream ? renderVideoElement(localStream, true) : renderVideoElement(null, true))
            ) : (
              renderVideoElement(
                expandedData.participant.isScreenSharing && expandedData.participant.screenStream
                  ? expandedData.participant.screenStream
                  : expandedData.participant.stream,
                false,
                expandedData.participant.connId
              )
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

        <View style={[
          styles.videoGrid,
          showExpandedView && styles.videoGridWithExpanded
        ]}>
          {gridRemoteParticipants.map(({ connId, userId, stream, screenStream, name, isScreenSharing: sharing }) => (
            <View key={connId} style={[styles.gridVideoWrapper, { backgroundColor: colors.card, borderColor: colors.border }, showExpandedView && styles.gridVideoWrapperExpanded]}>
              {renderVideoElement(sharing && screenStream ? screenStream : stream, false, connId)}
              <View style={[styles.videoLabel, { backgroundColor: colors.textSecondary + '40' }]}>
                {sharing && (
                  <Ionicons name="desktop" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                )}
                <Text style={styles.videoLabelText}>
                  {sharing ? `${truncateDisplayName(name || 'Guest')} (Screen)` : truncateDisplayName(name || 'Guest')}
                </Text>
              </View>
            </View>
          ))}

          {hiddenParticipantsCount > 0 && (
            <View style={[styles.gridVideoWrapper, showExpandedView && styles.gridVideoWrapperExpanded, styles.hiddenParticipantsBadge]}>
              <View style={styles.hiddenParticipantsContent}>
                <Ionicons name="people" size={32} color="#fff" />
                <Text style={styles.hiddenParticipantsText}>
                  +{hiddenParticipantsCount} others
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.selfViewPiP, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {renderVideoElement(localStream, true)}
          <View style={[styles.videoLabel, { backgroundColor: colors.primary + '40' }]}>
            <Text style={styles.videoLabelText}>{isScreenSharing ? 'You · Camera' : 'You'}</Text>
          </View>
        </View>
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
        </View>
      )}

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  readOnlyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  readOnlyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  readOnlySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 22,
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
  videoGridWithExpanded: {
    flexWrap: 'nowrap',
    justifyContent: 'flex-start',
    overflowX: 'auto',
    paddingVertical: spacing.md,
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
