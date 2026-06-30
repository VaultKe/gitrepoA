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
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EmojiSelector from 'react-native-emoji-selector';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { getThemeColors, spacing, typography, borderRadius, shadows, getShadowStyle } from '../../utils/theme';
import { formatTime } from '../../utils/dateUtils';
import { useApp } from '../../context/AppContext';
import chatService from '../../services/chat/ChatService';

const SCREEN_WIDTH = Dimensions.get('window').width;
// WhatsApp-style: bubble never wider than ~78% of screen, image never wider than the bubble cap
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.78;
const MAX_IMAGE_WIDTH = MAX_BUBBLE_WIDTH - spacing.md * 2;

const ChatRoomScreen = ({ route, navigation }) => {
  const { roomId, roomName } = route.params || {};
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [inputHeight, setInputHeight] = useState(40);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [openActionId, setOpenActionId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactingToMessage, setReactingToMessage] = useState(null);
  const flatListRef = useRef(null);
  const messageUnsubscribeRef = useRef(null);
  const typingUnsubscribeRef = useRef(null);
  const typingDebounceRef = useRef(null);
  const swipeableRefs = useRef(new Map());

  useEffect(() => {
    if (!roomId) {
      console.error('ChatRoomScreen: roomId is required');
      navigation.goBack();
    }
  }, [roomId, navigation]);

  const loadData = useCallback(async () => {
    if (!roomId) return;

    try {
      setLoading(true);
      await chatService.joinRoom(roomId);
      const roomMessages = await chatService.getMessages(roomId, 100, 0);
      setMessages(roomMessages);
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
      if (messageUnsubscribeRef.current) {
        messageUnsubscribeRef.current();
      }
      if (typingUnsubscribeRef.current) {
        typingUnsubscribeRef.current();
      }
      chatService.leaveRoom(roomId);
    };
  }, [roomId, loadData]);

  useEffect(() => {
    if (!roomId) return;

    messageUnsubscribeRef.current = chatService.subscribeToMessages(roomId, (message) => {
      setMessages(prev => {
        if (message.type === 'remove') {
          return prev.filter(m => m.id !== message.id);
        }
        if (prev.some(m => m.id === message.id || m.tempId === message.id)) {
          return prev.map(m => m.id === message.id || m.tempId === message.id ? { ...m, ...message } : m);
        }
        const filtered = prev.filter(m => m.tempId !== message.tempId && m.id !== message.id);
        return [...filtered, message].sort((a, b) => a.createdAt - b.createdAt);
      });
    });

    typingUnsubscribeRef.current = chatService.subscribeToRoom(roomId, (room) => {});

    return () => {
      if (messageUnsubscribeRef.current) {
        messageUnsubscribeRef.current();
      }
      if (typingUnsubscribeRef.current) {
        typingUnsubscribeRef.current();
      }
    };
  }, [roomId]);

  const handleSend = useCallback(async () => {
    if (!messageText.trim() && selectedImages.length === 0) return;

    const content = messageText.trim();
    const replyToId = replyTo?.id || null;
    const replyToData = replyTo ? { id: replyTo.id, senderName: replyTo.senderName, content: replyTo.content, type: replyTo.type } : null;
    setMessageText('');
    setReplyTo(null);

    try {
      if (selectedImages.length > 0) {
        for (const image of selectedImages) {
          await chatService.sendMessage(roomId, content, 'image', { imageUri: image.uri, replyToId, replyToData });
        }
        setSelectedImages([]);
      } else {
        await chatService.sendMessage(roomId, content, 'text', { replyToId, replyToData });
      }
    } catch (err) {
      console.error('Send error:', err);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      setMessageText(content);
      setReplyTo({ ...replyTo, ...replyToData });
    }
  }, [messageText, roomId, selectedImages, replyTo]);

  const handleImagePicker = useCallback(async () => {
    try {
      const ImagePicker = (await import('expo-image-picker')).default;
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
        setSelectedImages(result.assets.map(asset => ({ uri: asset.uri })));
      }
    } catch (error) {
      console.error('Image picker error:', error);
    }
  }, []);

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

  const handleEmojiSelect = useCallback((emoji) => {
    setMessageText(prev => prev + emoji);
    setShowEmojiPicker(false);
  }, []);

  const handleReactionSelect = useCallback((emoji) => {
    if (reactingToMessage) {
      // TODO: Send reaction to backend
      console.log('Reacting to message:', reactingToMessage.id, 'with emoji:', emoji);
    }
    setShowReactionPicker(false);
    setReactingToMessage(null);
  }, [reactingToMessage]);

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

  const handleCopy = useCallback((message) => {
    if (message.content) {
      navigator.clipboard?.writeText(message.content);
    }
  }, []);

  const closeSwipeable = useCallback((messageId) => {
    const ref = swipeableRefs.current.get(messageId);
    if (ref) {
      ref.close();
    }
    if (openActionId === messageId || openActionId === message.tempId) {
      setOpenActionId(null);
    }
  }, [openActionId]);

  const handleOpenActions = useCallback((message) => {
    setOpenActionId(message.id || message.tempId);
    Object.values(swipeableRefs.current).forEach(ref => ref.close?.());
  }, []);

  const handleCloseActions = useCallback(() => {
    setOpenActionId(null);
  }, []);

  const handleActionPress = useCallback((message, action) => {
    if (action === 'reply') handleReply(message);
    else if (action === 'delete') handleDelete(message);
    else if (action === 'copy') handleCopy(message);
    else if (action === 'react') {
      setReactingToMessage(message);
      setShowReactionPicker(true);
    }
    else if (action === 'report') {/* TODO: Report */}
    closeSwipeable(message.id || message.tempId);
    handleCloseActions();
  }, [handleReply, handleDelete, handleCopy, closeSwipeable, handleCloseActions]);

  const renderReplyPreview = () => {
    if (!replyTo) return null;
    
    return (
      <View style={[styles.replyPreview, { backgroundColor: colors.background, borderLeftColor: colors.primary }]}>
        <View style={styles.replyPreviewContent}>
          <Text style={[styles.replyPreviewLabel, { color: colors.primary }]}>
            Replying to
          </Text>
          <Text style={[styles.replyPreviewText, { color: colors.text }]} numberOfLines={1}>
            {replyTo.content || (replyTo.type === 'image' ? 'Photo' : 'Message')}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setReplyTo(null)}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderReplyInBubble = ({ item: message }) => {
    const repliedMessage = message.replyTo?.id 
      ? messages.find(m => m.id === message.replyTo?.id || m.tempId === message.replyTo?.id)
      : null;
    
    const replyData = repliedMessage || message.replyTo;
    
    if (!replyData?.id) return null;
    
    const replyIsOwn = repliedMessage && repliedMessage.senderId === user?.id;
    const replyBubbleBg = replyIsOwn ? colors.primary : '#e5e7eb';
    const replyTextClr = replyIsOwn ? 'white' : colors.text;
    
    return (
      <View style={styles.replyInBubbleContainer}>
        <View style={[styles.replyInBubbleLine, { backgroundColor: colors.primary }]} />
        <View style={[styles.replyInBubbleContent, { backgroundColor: replyBubbleBg, borderRadius: borderRadius.sm }]}>
          <Text style={[styles.replyInBubbleSender, { color: replyIsOwn ? '#fff' : colors.primary }]}>
            {replyData.senderName || 'Sender'}
          </Text>
          <Text style={[styles.replyInBubbleText, { color: replyTextClr }]} numberOfLines={1}>
            {replyData.content || (replyData.type === 'image' ? 'Photo' : 'Message')}
          </Text>
        </View>
      </View>
    );
  };

  const renderMessage = ({ item: message }) => {
    const isOwn = message.senderId === user?.id;
    const status = message.status || 'sent';
    const hasImage = message.type === 'image' && message.metadata?.imageUri;
    const isReply = !!message.replyTo?.id;

    const imgWidth = message.metadata?.imageWidth;
    const imgHeight = message.metadata?.imageHeight;
    const aspectRatio = imgWidth && imgHeight ? imgWidth / imgHeight : 1;

    return (
      <View style={[styles.messageRow, isOwn ? styles.ownRow : styles.otherRow]}>
        {!isOwn && (
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {message.senderName?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
          </View>
        )}
        <Swipeable
          ref={ref => {
            if (ref) swipeableRefs.current.set(message.id || message.tempId, ref);
          }}
          renderRightActions={() => <View style={{ width: 220 }} />}
          onSwipeableOpen={() => handleOpenActions(message)}
          onSwipeableClose={handleCloseActions}
          rightThreshold={40}
        >
          <View style={[
            styles.messageBubble,
            {
              backgroundColor: isOwn
                ? (isReply ? colors.primaryDark : colors.primary)
                : (isReply ? colors.backgroundSecondary : colors.card),
              borderBottomLeftRadius: isOwn ? borderRadius.lg : 4,
              borderBottomRightRadius: isOwn ? 4 : borderRadius.lg,
            },
          ]}>
            {renderReplyInBubble({ item: message })}
            
            {hasImage && (
              <Image
                source={{ uri: message.metadata.imageUri }}
                style={[
                  styles.messageImage,
                  { width: MAX_IMAGE_WIDTH, height: MAX_IMAGE_WIDTH / aspectRatio },
                ]}
                resizeMode="cover"
              />
            )}

            {!!message.content && (
              <Text
                style={[
                  styles.messageText,
                  { color: isOwn ? 'white' : colors.text, marginTop: hasImage || message.replyTo?.id ? spacing.xs : 0 },
                ]}
              >
                {message.content}
              </Text>
            )}

            <View style={styles.messageMeta}>
              <Text
                style={[
                  styles.timestamp,
                  { color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textSecondary },
                ]}
              >
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
                  style={{ marginLeft: 2 }}
                />
              )}
            </View>
          </View>
        </Swipeable>
        {openActionId === message.id || openActionId === message.tempId ? (
          <View style={[styles.actionOverlayContainer, { backgroundColor: colors.backgroundSecondary }, getShadowStyle('md')]}>
            <TouchableOpacity style={styles.actionItem} onPress={() => handleActionPress(message, 'reply')}>
              <View style={[styles.actionIconWrapper, { backgroundColor: colors.primary }]}>
                <Ionicons name="reply" size={18} color="white" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={() => handleActionPress(message, 'delete')}>
              <View style={[styles.actionIconWrapper, { backgroundColor: colors.error }]}>
                <Ionicons name="trash" size={18} color="white" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={() => handleActionPress(message, 'copy')}>
              <View style={[styles.actionIconWrapper, { backgroundColor: colors.border }]}>
                <Ionicons name="copy" size={18} color="white" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={() => handleActionPress(message, 'react')}>
              <View style={[styles.actionIconWrapper, { backgroundColor: colors.info || '#17a2b8' }]}>
                <Ionicons name="heart" size={18} color="white" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>React</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={() => handleActionPress(message, 'report')}>
              <View style={[styles.actionIconWrapper, { backgroundColor: colors.warning || '#ffc107' }]}>
                <Ionicons name="alert-circle" size={18} color="white" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={() => handleActionPress(message, 'close')}>
              <View style={[styles.actionIconWrapper, { backgroundColor: colors.textSecondary }]}>
                <Ionicons name="close" size={18} color="white" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !roomId || messages.length < 50) return;

    try {
      setLoadingMore(true);
      const offset = messages.length;
      const olderMessages = await chatService.getMessages(roomId, 50, offset);
      if (olderMessages.length > 0) {
        setMessages(prev => [...prev, ...olderMessages]);
      }
    } catch (err) {
      console.error('Load more messages error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [roomId, loadingMore, messages.length]);

  if (loading && messages.length === 0) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

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
        maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 10 }}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={false}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 10 }} /> : null}
        showsVerticalScrollIndicator={false}
      />

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.divider }]}>
          {renderReplyPreview()}
          {/* Image Preview */}
          {selectedImages.length > 0 && (
            <View style={styles.imagePreview}>
              {selectedImages.map((image, index) => (
                <View key={index} style={styles.imageThumb}>
                  <Image source={{ uri: image.uri }} style={styles.thumbnail} />
                  <TouchableOpacity
                    onPress={() => setSelectedImages(selectedImages.filter((_, i) => i !== index))}
                    style={styles.removeImage}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.inputRow}>
            <TouchableOpacity onPress={() => setShowEmojiPicker(true)} style={styles.emojiButton}>
              <Ionicons name="happy" size={24} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleImagePicker} style={styles.attachButton}>
              <Ionicons name="attach" size={24} color={colors.primary} />
            </TouchableOpacity>

            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.background,
                  borderRadius: 20,
                  borderColor: colors.border,
                  height: Math.max(40, Math.min(inputHeight, 100)),
                },
              ]}
              placeholder="Type a message..."
              placeholderTextColor={colors.textSecondary}
              value={messageText}
              onChangeText={handleTyping}
              multiline
              onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height)}
              maxLength={5000}
            />

            <TouchableOpacity
              onPress={handleSend}
              style={[styles.sendButton, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="send" size={20} color="white" />
            </TouchableOpacity>
          </View>

          <Modal
            visible={showEmojiPicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowEmojiPicker(false)}
          >
            <View style={styles.emojiModalContainer}>
              <View style={[styles.emojiModalContent, { backgroundColor: colors.card, paddingBottom: Math.max(70, insets.bottom + 20) }]}>
                <View style={[styles.emojiHeader, { borderBottomColor: colors.divider }]}>
                  <Text style={[styles.emojiHeaderTitle, { color: colors.text }]}>
                    Select Emoji
                  </Text>
                  <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <EmojiSelector
                  onEmojiSelected={handleEmojiSelect}
                  columns={8}
                />
              </View>
            </View>
          </Modal>

          <Modal
            visible={showReactionPicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowReactionPicker(false)}
          >
            <View style={styles.emojiModalContainer}>
              <View style={[styles.emojiModalContent, { backgroundColor: colors.card, paddingBottom: Math.max(70, insets.bottom + 20) }]}>
                <View style={[styles.emojiHeader, { borderBottomColor: colors.divider }]}>
                  <Text style={[styles.emojiHeaderTitle, { color: colors.text }]}>
                    React with Emoji
                  </Text>
                  <TouchableOpacity onPress={() => setShowReactionPicker(false)}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <EmojiSelector
                  onEmojiSelected={handleReactionSelect}
                  columns={8}
                />
              </View>
            </View>
          </Modal>
        </View>
      </KeyboardAvoidingView>
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
  // Row must span full width so percentage/flex rules inside have something
  // real to measure against, and so flexShrink can actually take effect.
  messageRow: {
    width: '100%',
    marginBottom: spacing.xs,
    position: 'relative',
    overflow: 'visible',
  },
  ownRow: {
    alignItems: 'flex-end',
  },
  otherRow: {
    alignItems: 'flex-start',
  },
  avatarContainer: {
    marginRight: spacing.xs,
    marginBottom: 2,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  // This is the key fix: flexShrink + maxWidth together let the bubble
  // grow to fit short text, wrap long text, and grow downward for images,
  // without ever overflowing past ~78% of the screen (WhatsApp behavior).
  messageBubble: {
    maxWidth: MAX_BUBBLE_WIDTH,
    flexShrink: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  messageText: {
    fontSize: typography.fontSize.md,
    // Line height locked to a safe multiple of font size so wrapped lines
    // stack below each other instead of overlapping.
    lineHeight: typography.fontSize.md * 1.3,
    flexWrap: 'wrap',
  },
  messageImage: {
    borderRadius: borderRadius.md,
    backgroundColor: '#00000010',
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  timestamp: {
    fontSize: typography.fontSize.xs,
    lineHeight: typography.fontSize.xs * 1.3,
    marginRight: 2,
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
  attachButton: {
    padding: spacing.xs,
  },
  emojiButton: {
    padding: spacing.xs,
    paddingLeft: 0,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.sm,
    borderWidth: 1,
    fontSize: typography.fontSize.md,
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
  actionOverlayContainer: {
    position: 'absolute',
    right: 8,
    bottom: '100%',
    marginBottom: 8,
    flexDirection: 'column',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minWidth: 72,
    maxWidth: 220,
    zIndex: 999,
  },
  actionItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xxs,
  },
  actionIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  actionLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderLeftWidth: 3,
    marginBottom: spacing.xs,
  },
  replyPreviewContent: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  replyPreviewLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  replyPreviewText: {
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  replyInBubbleContainer: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
    alignItems: 'flex-start',
  },
  replyInBubbleLine: {
    width: 2,
    height: 24,
    borderRadius: 1,
    marginRight: spacing.xs,
  },
  replyInBubbleContent: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  replyInBubbleSender: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  replyInBubbleText: {
    fontSize: typography.fontSize.sm,
  },
  emojiModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  emojiModalContent: {
    height: '50%',
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
  },
  emojiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  emojiHeaderTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
  },
});

export default ChatRoomScreen;