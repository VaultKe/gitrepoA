import React, { useRef, useEffect } from 'react';
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

const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';

const OnlineMeetingScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const { isReadOnly = false } = route.params || {};
  const screen = useOnlineMeetingScreen({ route, navigation });
  const chatScrollRef = useRef(null);

  const {
    isConnecting,
    connectionError,
    isCameraEnabled,
    isMicrophoneEnabled,
    isScreenSharing,
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
    localVideoRef,
    remoteVideoRefs,
  } = screen;

  // Set up local video element for web
  useEffect(() => {
    if (isWeb && localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.log('Local video play error:', e));
    }
  }, [localStream]);

  // Auto-scroll to bottom when new chat messages arrive
  useEffect(() => {
    if (isChatOpen && chatScrollRef.current) {
      chatScrollRef.current.scrollToEnd({ animated: true });
    }
  }, [chatMessages, isChatOpen]);

  // Set up remote video elements for web
  useEffect(() => {
    if (isWeb) {
      remoteStreams.forEach(({ connId, stream }) => {
        const ref = remoteVideoRefs.current?.get(connId);
        if (ref && ref.current) {
          ref.current.srcObject = stream;
          ref.current.play().catch(e => console.log('Remote video play error:', e));
        }
      });
    }
  }, [remoteStreams]);

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
    if (isWeb) {
      return (
        <video
          ref={isLocal ? localVideoRef : (el => {
            if (!remoteVideoRefs.current) {
              remoteVideoRefs.current = new Map();
            }
            if (connId) {
              remoteVideoRefs.current.set(connId, { current: el });
            }
          })}
          srcObject={stream || undefined}
          style={styles.video}
          muted={isLocal}
          playsInline
          autoPlay
          disablePictureInPicture
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
      {/* Video Grid */}
      <View style={styles.videoContainer}>
        {/* Local Video */}
        <View style={styles.videoWrapper}>
          {localStream ? renderVideoElement(localStream, true) : renderVideoElement(null, true)}
          <View style={[styles.videoLabel, { backgroundColor: colors.primary + '40' }]}>
            <Text style={styles.videoLabelText}>You</Text>
          </View>
        </View>

        {/* Remote Videos */}
        {remoteStreams.map(({ connId, userId, stream }) => (
          <View key={connId} style={styles.videoWrapper}>
            {renderVideoElement(stream, false, connId)}
            <View style={[styles.videoLabel, { backgroundColor: colors.textSecondary + '40' }]}>
              <Text style={styles.videoLabelText}>Participant</Text>
            </View>
          </View>
        ))}
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
  videoContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.sm,
  },
   videoWrapper: {
    width: '50%',
    aspectRatio: 16 / 9,
    minHeight: 120,
    margin: spacing.xs,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
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
  },
  videoLabelText: {
    color: '#fff',
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
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
