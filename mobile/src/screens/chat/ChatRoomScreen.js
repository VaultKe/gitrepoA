import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getThemeColors, spacing, typography, borderRadius, getShadowStyle } from '../../utils/theme';
import { formatTime } from '../../utils/dateUtils';
import { useApp } from '../../context/AppContext';
import chatService from '../../services/chat/ChatService';
import ChatMessageBubble from './ChatMessageBubble';
import ChatInputBar from './ChatInputBar';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.78;

const ChatRoomScreen = ({ route, navigation }) => {
  const { roomId, roomName } = route.params || {};
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const flatListRef = useRef(null);
  const messageUnsubscribeRef = useRef(null);
  const typingUnsubscribeRef = useRef(null);
  const typingDebounceRef = useRef(null);
  const swipeableRefs = useRef(new Map());
  const [openActionId, setOpenActionId] = useState(null);
  const hasScrolledToBottomRef = useRef(false);

  useEffect(() => {
    if (!roomId) {
      console.error('ChatRoomScreen: roomId is required');
      navigation.goBack();
    }
  }, [roomId, navigation]);

  useEffect(() => {
    if (user && user.id) {
      chatService.setCurrentUser(user);
    }
  }, [user]);

  const loadData = useCallback(async () => {
    if (!roomId) return;

    try {
      await Promise.all([
        chatService.joinRoom(roomId),
        chatService.getMessages(roomId, 100, 0),
      ]);
      const roomMessages = chatService.getRoomMessages(roomId);
      setMessages(roomMessages);
      await chatService.markRoomAsRead(roomId);
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
      if (messageUnsubscribeRef.current) messageUnsubscribeRef.current();
      if (typingUnsubscribeRef.current) typingUnsubscribeRef.current();
      chatService.leaveRoom(roomId);
    };
  }, [roomId, loadData]);

  useEffect(() => {
    if (!roomId) return;

    messageUnsubscribeRef.current = chatService.subscribeToMessages(roomId, (message) => {
      if (message.type === 'typing') {
        setTypingUsers(message.users || new Set());
        return;
      }
      if (message.type === 'remove') {
        setMessages(prev => prev.filter(m => m.id !== message.id));
        return;
      }
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === message.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...message };
          return updated;
        }
        return [...prev, message].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      });
    });

    typingUnsubscribeRef.current = chatService.subscribeToRoom(roomId, () => {
      // Room metadata updates are handled via the message subscriber.
    });

    return () => {
      if (messageUnsubscribeRef.current) messageUnsubscribeRef.current();
      if (typingUnsubscribeRef.current) typingUnsubscribeRef.current();
    };
  }, [roomId]);

  useEffect(() => {
    if (messages.length > 0 && flatListRef.current && !hasScrolledToBottomRef.current) {
      hasScrolledToBottomRef.current = true;
      flatListRef.current.scrollToEnd({ animated: false });
    }
  }, [messages.length]);

  useEffect(() => {
    hasScrolledToBottomRef.current = false;
  }, [roomId]);

  const handleSend = useCallback(async (content, type, metadata, selectedImages) => {
    if (!content.trim() && selectedImages.length === 0) return;

    try {
      if (selectedImages.length > 0) {
        for (const image of selectedImages) {
          await chatService.sendMessage(roomId, content, 'image', { imageUri: image.uri });
        }
      } else {
        await chatService.sendMessage(roomId, content, type || 'text', metadata);
      }
      setReplyTo(null);
    } catch (err) {
      console.error('Send error:', err);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  }, [roomId]);

  const handleImagePicker = useCallback(async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please allow access to your photo library');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets) {
        return result.assets.map(asset => ({ uri: asset.uri }));
      }
    } catch (error) {
      console.error('Image picker error:', error);
    }
    return [];
  }, []);

  const handleTyping = useCallback((text) => {
    if (text.length > 0) {
      chatService.setTyping(roomId, true);
    }

    clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      chatService.setTyping(roomId, false);
    }, 1000);
  }, [roomId]);

  const handleReply = useCallback((message) => {
    setReplyTo(message);
  }, []);

  const handleDelete = useCallback(async (message) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatService.deleteMessage(roomId, message.id);
            } catch (err) {
              console.error('Delete error:', err);
              Alert.alert('Error', 'Failed to delete message');
            }
          },
        },
      ]
    );
  }, [roomId]);

  const handleCopy = useCallback(async (message) => {
    if (message.content) {
      try {
        const Clipboard = await import('expo-clipboard');
        await Clipboard.setStringAsync(message.content);
      } catch (error) {
        console.error('Copy error:', error);
      }
    }
  }, []);

  const handleActionPress = useCallback((message, action) => {
    if (action === 'reply') handleReply(message);
    else if (action === 'delete') handleDelete(message);
    else if (action === 'copy') handleCopy(message);
    closeSwipeable(message.id);
    setOpenActionId(null);
  }, [handleReply, handleDelete, handleCopy]);

  const closeSwipeable = useCallback((messageId) => {
    const ref = swipeableRefs.current.get(messageId);
    if (ref) ref.close();
    if (openActionId === messageId) setOpenActionId(null);
  }, [openActionId]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !roomId || messages.length === 0) return;

    try {
      setLoadingMore(true);
      const oldestMessage = messages[messages.length - 1];
      const olderMessages = await chatService.getMessages(roomId, 50, 0, oldestMessage?.id);
      if (olderMessages.length > 0) {
        setMessages(prev => [...prev, ...olderMessages]);
      }
    } catch (err) {
      console.error('Load more messages error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [roomId, loadingMore, messages]);

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

  const renderMessage = useCallback(({ item: message }) => {
    return (
      <ChatMessageBubble
        message={message}
        user={user}
        colors={colors}
        replyTo={replyTo}
        openActionId={openActionId}
        swipeableRefs={swipeableRefs}
        onReply={handleReply}
        onDelete={handleDelete}
        onCopy={handleCopy}
        onActionPress={handleActionPress}
        onOpenActions={(msg) => setOpenActionId(msg.id)}
        onCloseActions={() => setOpenActionId(null)}
        onSwipeableOpen={(msg) => setOpenActionId(msg.id)}
        onSwipeableClose={() => setOpenActionId(null)}
        getShadowStyle={getShadowStyle}
        formatTime={formatTime}
        spacing={spacing}
        typography={typography}
        borderRadius={borderRadius}
        MAX_BUBBLE_WIDTH={MAX_BUBBLE_WIDTH}
      />
    );
  }, [user, colors, replyTo, openActionId, handleReply, handleDelete, handleCopy, handleActionPress]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.divider, backgroundColor: colors.card }]}>
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
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={false}
        ListFooterComponent={
          loading && messages.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : loadingMore ? (
            <ActivityIndicator style={{ marginVertical: 10 }} />
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Input Area */}
      <ChatInputBar
        roomId={roomId}
        colors={colors}
        insets={insets}
        onSend={handleSend}
        onImagePicker={handleImagePicker}
        onTyping={handleTyping}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        spacing={spacing}
        borderRadius={borderRadius}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  center: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingBottom: 70,
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
