import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import { formatTime } from '../../utils/dateUtils';
import { useApp } from '../../context/AppContext';
import chatService from '../../services/chat/ChatService';

const ChatRoomScreen = ({ route, navigation }) => {
  const { roomId, roomName } = route.params || {};
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const navigationRef = useNavigation();

// State
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [inputHeight, setInputHeight] = useState(40);

  // Refs
  const flatListRef = useRef(null);
  const messageUnsubscribeRef = useRef(null);
  const typingUnsubscribeRef = useRef(null);
  const roomUnsubscribeRef = useRef(null);
  const typingDebounceRef = useRef(null);

  // Safety check
  useEffect(() => {
    if (!roomId) {
      console.error('ChatRoomScreen: roomId is required');
      navigation.goBack();
    }
  }, [roomId, navigation]);

  // Load initial room and messages
  const loadData = useCallback(async () => {
    if (!roomId) return;

    try {
      setLoading(true);

      // Get room details
      await chatService.joinRoom(roomId);

      // Get messages
      const roomMessages = await chatService.getMessages(roomId, 100, 0);
      setMessages(roomMessages);

      // Mark room as read
      chatService.markRoomAsRead(roomId);

      setError(null);
    } catch (err) {
      console.error('Load room error:', err);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadData();

    return () => {
      // Cleanup subscriptions
      if (messageUnsubscribeRef.current) {
        messageUnsubscribeRef.current();
      }
      if (typingUnsubscribeRef.current) {
        typingUnsubscribeRef.current();
      }
      if (roomUnsubscribeRef.current) {
        roomUnsubscribeRef.current();
      }
      chatService.leaveRoom(roomId);
    };
  }, [roomId, loadData]);

  // Subscribe to new messages
  useEffect(() => {
    if (!roomId) return;

    messageUnsubscribeRef.current = chatService.subscribeToMessages(roomId, (message) => {
      setMessages(prev => {
        // Avoid duplicates
        if (prev.some(m => m.id === message.id || m.tempId === message.id)) {
          return prev;
        }

        const filtered = prev.filter(m => m.tempId !== message.tempId && m.id !== message.id);
        return [...filtered, message];
      });
    });

    // Subscribe to typing indicators
    typingUnsubscribeRef.current = chatService.subscribeToRoom(roomId, (room) => {
      // Could update room info if needed
    });

    return () => {
      if (messageUnsubscribeRef.current) {
        messageUnsubscribeRef.current();
      }
      if (typingUnsubscribeRef.current) {
        typingUnsubscribeRef.current();
      }
    };
  }, [roomId]);

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!messageText.trim() || !roomId || sending) return;

    const content = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      await chatService.sendMessage(roomId, content, 'text');
    } catch (err) {
      console.error('Send error:', err);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      setMessageText(content); // Restore message on failure
    } finally {
      setSending(false);
    }
  }, [messageText, roomId, sending]);

  // No image picker yet - future feature
  // Future: handleImagePicker will use dedicated upload endpoint

  // Handle typing indicator
  const handleTyping = useCallback((text) => {
    setMessageText(text);

    if (!isTyping && text.length > 0) {
      setIsTyping(true);
      chatService.setTyping(roomId, true);
    }

    clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      setIsTyping(false);
      chatService.setTyping(roomId, false);
    }, 1000);
  }, [isTyping, roomId]);

  // Render message item
  const renderMessage = ({ item: message }) => {
    const isOwn = message.senderId === chatService._getCurrentUserId();
    const status = message.status || 'sent';

    return (
      <View style={[styles.messageRow, isOwn ? styles.ownRow : styles.otherRow]}>
        <View style={[
          styles.messageBubble,
          {
            backgroundColor: isOwn ? colors.primary : colors.card,
            borderBottomLeftRadius: isOwn ? borderRadius.lg : 4,
            borderBottomRightRadius: isOwn ? 4 : borderRadius.lg,
          },
        ]}>
          <Text style={[styles.messageText, { color: isOwn ? 'white' : colors.text }]}>
            {message.content}
          </Text>

          {message.type === 'image' && message.metadata?.imageUri && (
            <Image
              source={{ uri: message.metadata.imageUri }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          )}

          <View style={styles.messageMeta}>
            <Text style={[styles.timestamp, {
              color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textSecondary,
              fontSize: typography.fontSize.xs,
            }]}>
              {formatTime(message.createdAt)}
            </Text>
            {isOwn && (
              <Ionicons
                name={
                  status === 'delivered' ? 'checkmark-done' :
                  status === 'read' ? 'checkmark-done' :
                  status === 'sending' ? 'time' : 'checkmark'
                }
                size={14}
                color={isOwn ? 'rgba(255,255,255,0.8)' : colors.textSecondary}
                style={styles.statusIcon}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  if (loading && messages.length === 0) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  // Show error screen
  if (error) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity onPress={() => { setError(null); loadData(); }} style={[styles.retryButton, { backgroundColor: colors.primary }]}>
          <Text style={{ color: 'white' }}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.divider, backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {roomName || 'Chat'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {typingUsers.size > 0 ? 'Typing...' : 'Online'}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="ellipsis-vertical" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id || item.tempId}
        contentContainerStyle={styles.messageList}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
         <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.divider }]}>
           <View style={styles.inputRow}>

            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.background,
                  borderRadius: 20,
                  borderColor: colors.border,
                  height: Math.max(40, inputHeight),
                },
              ]}
              placeholder="Type a message..."
              placeholderTextColor={colors.textSecondary}
              value={messageText}
              onChangeText={handleTyping}
              multiline
              onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height)}
              maxLength={5000}
              editable={!sending}
            />

            {messageText.trim().length > 0 ? (
              <TouchableOpacity
                onPress={handleSend}
                disabled={sending}
                style={[styles.sendButton, { opacity: sending ? 0.5 : 1 }]}
              >
                <Ionicons name="send" size={20} color="white" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: colors.divider }]}
                disabled
              >
                <Ionicons name="send" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: spacing.xs,
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
  },
  messageList: {
    padding: spacing.md,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: spacing.xs,
  },
  ownRow: {
    justifyContent: 'flex-end',
  },
  otherRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
messageText: {
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.normal,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  messageMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  timestamp: {
    marginRight: spacing.xs,
  },
  statusIcon: {
    marginLeft: 2,
  },
  inputContainer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  imagePreview: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
imageThumb: {
    width: 60,
    height: 60,
    marginRight: spacing.sm,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  removeImage: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    marginHorizontal: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    fontSize: typography.fontSize.md,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: typography.fontSize.md,
    marginBottom: spacing.md,
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
});

export default ChatRoomScreen;
