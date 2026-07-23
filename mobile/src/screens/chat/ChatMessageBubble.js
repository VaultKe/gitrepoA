import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { getThemeColors, spacing, typography, borderRadius, getShadowStyle } from '../../utils/theme';
import { formatTime } from '../../utils/dateUtils';

const ChatMessageBubble = React.memo(({
  message,
  user,
  colors,
  replyTo,
  openActionId,
  swipeableRefs,
  onReply,
  onDelete,
  onCopy,
  onActionPress,
  onOpenActions,
  onCloseActions,
  onSwipeableOpen,
  onSwipeableClose,
  getShadowStyle,
  formatTime,
  spacing,
  typography,
  borderRadius,
  MAX_BUBBLE_WIDTH,
}) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const isOwn = message.senderId === user?.id;
  const status = message.status || 'sent';

  // Validate image URI. Some server responses include a base64 data-URI
  // with missing or corrupt payload; passing it to <Image> on web causes
  // `ERR_INVALID_URL`. Detection relies on strict data-URI shape checks:
  const rawImage = message.imageUrl || message.metadata?.imageUri || message.metadata?.imageUrl;
  const hasValidImage = Boolean(
    rawImage &&
    rawImage.startsWith('data:') &&
    rawImage.includes(';base64,') &&
    rawImage.length > 40 // naive: ensure real base64 payload
  );
  const isReply = !!message.replyTo?.id;

  const renderReplyInBubble = () => {
    const repliedMessage = message.replyTo?.id
      ? null // Parent resolves this via messages prop; here we use embedded replyTo
      : null;

    const replyData = message.replyTo;
    if (!replyData?.id) return null;

    const replyIsOwn = replyData.senderId === user?.id;
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

  const renderActions = () => {
    if (openActionId !== message.id && openActionId !== message.tempId) return null;

    return (
      <View style={[styles.actionOverlayContainer, { backgroundColor: colors.backgroundSecondary }, getShadowStyle('md')]}>
        <TouchableOpacity style={styles.actionItem} onPress={() => onActionPress(message, 'reply')}>
          <View style={[styles.actionIconWrapper, { backgroundColor: colors.primary }]}>
            <Ionicons name="reply" size={18} color="white" />
          </View>
          <Text style={[styles.actionLabel, { color: colors.text }]}>Reply</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionItem} onPress={() => onActionPress(message, 'delete')}>
          <View style={[styles.actionIconWrapper, { backgroundColor: colors.error }]}>
            <Ionicons name="trash" size={18} color="white" />
          </View>
          <Text style={[styles.actionLabel, { color: colors.text }]}>Delete</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionItem} onPress={() => onActionPress(message, 'copy')}>
          <View style={[styles.actionIconWrapper, { backgroundColor: colors.border }]}>
            <Ionicons name="copy" size={18} color="white" />
          </View>
          <Text style={[styles.actionLabel, { color: colors.text }]}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionItem} onPress={() => onActionPress(message, 'report')}>
          <View style={[styles.actionIconWrapper, { backgroundColor: colors.warning || '#ffc107' }]}>
            <Ionicons name="alert-circle" size={18} color="white" />
          </View>
          <Text style={[styles.actionLabel, { color: colors.text }]}>Report</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionItem} onPress={() => onActionPress(message, 'close')}>
          <View style={[styles.actionIconWrapper, { backgroundColor: colors.textSecondary }]}>
            <Ionicons name="close" size={18} color="white" />
          </View>
          <Text style={[styles.actionLabel, { color: colors.text }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  };

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
        onSwipeableOpen={() => onSwipeableOpen(message)}
        onSwipeableClose={onSwipeableClose}
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
          {renderReplyInBubble()}

          {hasValidImage && (
             <Image
               source={{ uri: rawImage }}
               style={[
                 styles.messageImage,
                 { width: MAX_BUBBLE_WIDTH - spacing.md * 2, height: Math.min(280, (MAX_BUBBLE_WIDTH - spacing.md * 2) * 0.75) },
               ]}
               resizeMode="cover"
             />
           )}

           {!!message.content && (
             <Text
               style={[
                 styles.messageText,
                 { color: isOwn ? 'white' : colors.text, marginTop: hasValidImage || isReply ? spacing.xs : 0 },
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
      {renderActions()}
    </View>
  );
});

const styles = StyleSheet.create({
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
  messageBubble: {
    maxWidth: '78%',
    flexShrink: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  messageText: {
    fontSize: typography.fontSize.md,
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
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  actionLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default ChatMessageBubble;
