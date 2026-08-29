import React, { useRef, useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography } from '../../../utils/theme';
import useOnlineMeetingScreen from '../../../hooks/useOnlineMeetingScreen';
import OnlineMeetingLoading from '../../../components/chama-meeting/OnlineMeetingLoading';
import OnlineMeetingErrorView from '../../../components/chama-meeting/OnlineMeetingErrorView';
import WebVideo from '../../../components/chama-meeting/WebVideo';

const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
const MAX_GRID_PARTICIPANTS = 3;

const OnlineMeetingScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const { isReadOnly = false } = route.params || {};
  const screen = useOnlineMeetingScreen({ route, navigation });
  const chatScrollRef = useRef(null);
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);
  const [pinnedParticipantId, setPinnedParticipantId] = useState(null);

  const {
    isConnecting,
    connectionError,
    isCameraEnabled,
    isMicrophoneEnabled,
    isScreenSharing,
    screenStream,
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

  // Determine if expanded view should be shown
  // Show expanded when: user expanded, someone is screen sharing, or there's an active participant
  const showExpandedView = isVideoExpanded || isScreenSharing || !!activeParticipant;

  // Get the participant to show in expanded view
  const getExpandedParticipant = () => {
    // If user manually pinned someone, show them
    if (pinnedParticipantId) {
      const pinned = remoteStreams.find(s => s.connId === pinnedParticipantId);
      if (pinned) return { participant: pinned, isLocal: false };
    }
    // If local user is screen sharing, show local
    if (isScreenSharing) {
      return { participant: { stream: screenStream }, isLocal: true };
    }
    // Show active participant
    if (activeParticipant) {
      return { participant: activeParticipant, isLocal: false };
    }
    return null;
  };

  const expandedData = getExpandedParticipant();

  // Grid participants (excluding the expanded participant)
  const gridRemoteParticipants = remoteStreams
    .filter(s => !expandedData || expandedData.isLocal || s.connId !== expandedData.participant.connId)
    .slice(0, MAX_GRID_PARTICIPANTS);

  const hiddenParticipantsCount = Math.max(0,
    remoteStreams.length - gridRemoteParticipants.length - (expandedData && !expandedData.isLocal ? 1 : 0)
  );

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
    } else {
      // For React Native, we'd use react-native-webrtc's RTCView
      // This is a placeholder - actual implementation requires expo-dev-client
      // or bare React Native with proper linking
      return (
        <View style={[styles.videoPlaceholder, { backgroundColor: colors.surface }]}>
          <Ionicons
            name={isLocal ? 'person' : 'people'}
            size={48}
            color={colors.textSecondary}
          />
          <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
            {isLocal ? 'You' : 'Participant'}
          </Text>
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
      {/* Video Area */}
      <View style={styles.videoArea}>
        {/* Expanded View - shows active speaker / screen sharer / pinned participant */}
        {showExpandedView && expandedData && (
          <View style={styles.expandedVideoContainer}>
            {expandedData.isLocal ? (
              isScreenSharing ? renderVideoElement(screenStream, true) : (localStream ? renderVideoElement(localStream, true) : renderVideoElement(null, true))
            ) : (
              renderVideoElement(expandedData.participant.stream, false, expandedData.participant.connId)
            )}
             <View style={[styles.videoLabel, { backgroundColor: colors.primary + '40' }]}>
               <Text style={styles.videoLabelText}>
                 {expandedData.isLocal
                   ? (isScreenSharing ? 'Your Screen' : 'You')
                   : (expandedData.participant.isScreenSharing
                       ? `${expandedData.participant.name || 'Participant'} (Screen)`
                       : (expandedData.participant.name || 'Participant'))}
               </Text>
               <TouchableOpacity
                 style={styles.expandButton}
                 onPress={() => setIsVideoExpanded(!isVideoExpanded)}
               >
                 <Ionicons
                   name={isVideoExpanded ? 'contract' : 'expand'}
                   size={18}
                   color="#fff"
                 />
               </TouchableOpacity>
             </View>
          </View>
        )}

        {/* Grid View - shows limited remote participants (local self-view is a PiP overlay) */}
        <View style={[
          styles.videoGrid,
          showExpandedView && styles.videoGridWithExpanded
        ]}>
           {/* Remote Videos - limited to MAX_GRID_PARTICIPANTS */}
           {gridRemoteParticipants.map(({ connId, userId, stream, name, isScreenSharing: sharing }) => (
             <View key={connId} style={[styles.gridVideoWrapper, showExpandedView && styles.gridVideoWrapperExpanded]}>
               {renderVideoElement(stream, false, connId)}
               <View style={[styles.videoLabel, { backgroundColor: colors.textSecondary + '40' }]}>
                 {sharing && (
                   <Ionicons name="desktop" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                 )}
                 <Text style={styles.videoLabelText}>
                   {sharing ? `${name || 'Participant'} (Screen)` : (name || 'Participant')}
                 </Text>
               </View>
             </View>
           ))}

          {/* Hidden participants indicator */}
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

        {/* Self-view (always visible picture-in-picture) so the user can
            always see themselves regardless of the expanded view state. */}
        <View style={styles.selfViewPiP}>
          {renderVideoElement(localStream, true)}
          <View style={[styles.videoLabel, { backgroundColor: colors.primary + '40' }]}>
            <Text style={styles.videoLabelText}>{isScreenSharing ? 'You · Camera' : 'You'}</Text>
          </View>
        </View>
      </View>

      {/* Controls */}
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
      </View>

      {/* Chat Panel */}
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
                      isOwn ? styles.chatBubbleOwn : styles.chatBubbleOther,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chatMessageText,
                        { color: isOwn ? 'white' : colors.text },
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
              onSubmitEditing={(e) => {
                if (e.nativeEvent.text.trim()) {
                  handleSendChatMessage(e.nativeEvent.text.trim());
                }
              }}
            />
          </View>
        </View>
      )}

      {/* Chat Toggle Button */}
      <TouchableOpacity
        style={[styles.chatToggle, { backgroundColor: colors.primary }]}
        onPress={() => setIsChatOpen(!isChatOpen)}
      >
        <Ionicons name="chatbubbles" size={24} color="#fff" />
      </TouchableOpacity>
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
  expandButton: {
    marginLeft: spacing.xs,
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
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
  chatBubbleOwn: {
    backgroundColor: '#2563eb',
  },
  chatBubbleOther: {
    backgroundColor: '#e5e7eb',
  },
  chatMessageText: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * 1.3,
  },
  chatInput: {
    flexDirection: 'row',
    padding: spacing.sm,
    borderTopWidth: 1,
  },
  chatInputField: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.sm,
  },
  chatToggle: {
    position: 'absolute',
    right: spacing.md,
    bottom: 100,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default OnlineMeetingScreen;
