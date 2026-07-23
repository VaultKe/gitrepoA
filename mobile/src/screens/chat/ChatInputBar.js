import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EmojiSelector from 'react-native-emoji-selector';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const ChatInputBar = React.memo(({
  roomId,
  colors,
  insets,
  onSend,
  onImagePicker,
  onTyping,
  replyTo,
  onClearReply,
  spacing,
  borderRadius,
}) => {
  const [messageText, setMessageText] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [inputHeight, setInputHeight] = useState(40);

  const handleSend = () => {
    if (!messageText.trim() && selectedImages.length === 0) return;
    onSend(messageText.trim(), 'text', {}, selectedImages);
    setMessageText('');
    setSelectedImages([]);
  };

  const handleEmojiSelect = (emoji) => {
    setMessageText(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleImageSelect = async () => {
    const assets = await onImagePicker();
    if (assets && assets.length > 0) {
      setSelectedImages(prev => [...prev, ...assets]);
    }
  };

  return (
    <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.divider }]}>
      {replyTo && (
        <View style={[styles.replyPreview, { backgroundColor: colors.background, borderLeftColor: colors.primary }]}>
          <View style={styles.replyPreviewContent}>
            <Text style={[styles.replyPreviewLabel, { color: colors.primary }]}>
              Replying to
            </Text>
            <Text style={[styles.replyPreviewText, { color: colors.text }]} numberOfLines={1}>
              {replyTo.content || (replyTo.type === 'image' ? 'Photo' : 'Message')}
            </Text>
          </View>
          <TouchableOpacity onPress={onClearReply}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

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

        <TouchableOpacity onPress={handleImageSelect} style={styles.attachButton}>
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
          onChangeText={(text) => {
            setMessageText(text);
            onTyping(text);
          }}
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
    </View>
  );
});

import { Image } from 'react-native';

const styles = StyleSheet.create({
  inputContainer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  emojiButton: {
    padding: spacing.xs,
    paddingLeft: 0,
  },
  attachButton: {
    padding: spacing.xs,
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

export default ChatInputBar;
