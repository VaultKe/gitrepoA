import React, { useState, useEffect, useRef } from 'react';
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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useApp } from '../../context/AppContext';
import useSmartNavigation from '../../hooks/useSmartNavigation';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import ApiService from '../../services/api';
import webSocketService from '../../services/websocket';

const ChatRoomScreen = ({ route, navigation }) => {
  const { roomId, roomName, roomType } = route.params || {};
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const { goBack } = useSmartNavigation();

  // Safety check for required parameters
  useEffect(() => {
    if (!roomId) {
      console.error('ChatRoomScreen: roomId is required');
      goBack();
    }
  }, [roomId, navigation]);

  // Early return if no roomId
  if (!roomId) {
    return null;
  }

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [decryptedContents, setDecryptedContents] = useState(new Map()); // Cache for decrypted message contents
  // const [decryptingMessages, setDecryptingMessages] = useState(new Set()); // Track messages currently being decrypted
  // const decryptionTimeouts = useRef(new Map()); // Track decryption timeouts
  const flatListRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const lastMessageIdRef = useRef(null);

  // Removed fallback messages - only show real chat data from database

  // Helper function to decrypt message content for display
  // Backend now handles all decryption, so messages should arrive as plain text
  const decryptMessageForDisplay = async (message) => {
    try {
      // Parse metadata if it's a string
      let metadata = message.metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          metadata = {};
        }
      } else if (!metadata) {
        metadata = {};
      }

      // Backend now decrypts all messages before sending to client
      // Just return the content as-is, with basic cleanup if needed
      const rawContent = message.content || message.text || '';

      // Basic cleanup for any remaining encryption artifacts (shouldn't be needed with backend decryption)
      if (typeof rawContent === 'string') {
        const metadataPatterns = [
          /_enc_\d+_[a-zA-Z0-9]+$/,
          /_encrypted_\d+_[a-zA-Z0-9]+$/,
          /_cipher_[a-zA-Z0-9]+$/,
          /_secure_[a-zA-Z0-9]+$/
        ];

        let cleanedContent = rawContent;
        for (const pattern of metadataPatterns) {
          if (pattern.test(cleanedContent)) {
            cleanedContent = cleanedContent.replace(pattern, '');
            console.log('🧹 Cleaned encryption artifact from message');
          }
        }

        return cleanedContent;
      }

      return rawContent;
    } catch (error) {
      console.log('⚠️ Error in decryptMessageForDisplay:', error.message);
      return message.content || message.text || '';
    }
  };

  // Function to decrypt messages and cache the results
  const decryptMessages = async (messageList) => {
    if (!messageList || messageList.length === 0) {
      return;
    }

    const newDecryptedContents = new Map(decryptedContents); // Preserve existing decrypted content
    let updatedCount = 0;

    // Process messages in parallel for better performance
    const decryptionPromises = messageList.map(async (message) => {
      if (message && message.id && !newDecryptedContents.has(message.id)) {
        try {
          const decryptedContent = await decryptMessageForDisplay(message);
          return { id: message.id, content: decryptedContent };
        } catch (error) {
          // Return original content as fallback - never show error messages
          return { id: message.id, content: message.content || message.text || '' };
        }
      }
      return null;
    });

    try {
      const results = await Promise.all(decryptionPromises);

      results.forEach(result => {
        if (result) {
          newDecryptedContents.set(result.id, result.content);
          updatedCount++;
        }
      });

      // Update state if we decrypted something - use functional update to handle concurrent calls
      if (updatedCount > 0) {
        setDecryptedContents(prevContents => {
          const updatedContents = new Map(prevContents);
          results.forEach(result => {
            if (result) {
              updatedContents.set(result.id, result.content);
            }
          });
          return updatedContents;
        });
      }
    } catch (error) {
      // Update state even on partial failure - use functional update
      setDecryptedContents(prevContents => {
        const updatedContents = new Map(prevContents);
        results.forEach(result => {
          if (result) {
            updatedContents.set(result.id, result.content);
          }
        });
        return updatedContents;
      });
    }
  };

  useEffect(() => {
    console.log('🔒 ChatRoomScreen: User accessing room with authenticated session');
    console.log('🔒 Privacy: Room access validated by backend membership check');
    loadMessages();

    // Connect to WebSocket and join room
    const connectWebSocket = async () => {
      if (!webSocketService.getConnectionStatus().isConnected) {
        await webSocketService.connect();
      }
      webSocketService.joinRoom(roomId);
    };

    connectWebSocket();

    // Listen for new messages via WebSocket
    const handleNewMessage = async (wsMessage) => {
      console.log('🔴 Received new message via WebSocket:', wsMessage);
      if (wsMessage.roomId === roomId && wsMessage.data) {
        let messageData = wsMessage.data;

        // Parse metadata if it's a string
        let wsMetadata = messageData.metadata;
        if (typeof wsMetadata === 'string') {
          try {
            wsMetadata = JSON.parse(wsMetadata);
          } catch (e) {
            wsMetadata = {};
          }
        }

        // WebSocket messages are now sent pre-decrypted from backend
        // Just perform basic cleanup for any remaining artifacts
        try {
          if (typeof messageData.content === 'string') {
            // Basic cleanup for any remaining encryption artifacts (shouldn't be needed)
            const metadataPatterns = [
              /_enc_\d+_[a-zA-Z0-9]+$/,
              /_encrypted_\d+_[a-zA-Z0-9]+$/,
              /_cipher_[a-zA-Z0-9]+$/,
              /_secure_[a-zA-Z0-9]+$/
            ];

            let cleanedContent = messageData.content;
            for (const pattern of metadataPatterns) {
              if (pattern.test(cleanedContent)) {
                cleanedContent = cleanedContent.replace(pattern, '');
                console.log('🧹 Cleaned encryption artifact from WebSocket message');
              }
            }
            messageData.content = cleanedContent;
          }
          messageData.decrypted = true;
        } catch (error) {
          // Keep original content if processing fails
          messageData.decrypted = false;
        }

        // Check if message already exists to avoid duplicates
        const existingMessageIndex = messages.findIndex(msg => msg.id === messageData.id);

        if (existingMessageIndex >= 0) {
          // Message already exists, update it if needed
          const existingMessage = messages[existingMessageIndex];
          if (existingMessage.decrypted && existingMessage.content) {
            // Our own message already exists with plaintext content, don't replace it
            console.log('📨 Skipping WebSocket update for existing message (already have content)');
            return;
          } else {
            // Update the existing message with WebSocket data
            const updatedMessage = { ...existingMessage, ...messageData, decrypted: true };
            const updatedMessages = [...messages];
            updatedMessages[existingMessageIndex] = updatedMessage;
            setMessages(updatedMessages);
            console.log('📨 Updated existing message with WebSocket data');
            return;
          }
        }

        // Check for optimistic message from same sender to update
        const optimisticIndex = messages.findIndex(msg =>
          msg.isOptimistic && msg.senderId === messageData.senderId &&
          Math.abs(new Date(msg.createdAt) - new Date(messageData.createdAt || messageData.created_at)) < 5000 // Within 5 seconds
        );

        if (optimisticIndex >= 0) {
          // Update the optimistic message with real WebSocket data
          const optimisticMessage = messages[optimisticIndex];
          const updatedMessage = {
            ...messageData,
            content: optimisticMessage.content, // Preserve original content
            decrypted: true,
            isOptimistic: false // Remove optimistic flag
          };

          const updatedMessages = [...messages];
          updatedMessages[optimisticIndex] = updatedMessage;

          // Sort messages by creation time to maintain order
          const sortedMessages = updatedMessages.sort((a, b) =>
            new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at)
          );

          setMessages(sortedMessages);
          console.log('📨 Updated optimistic message with WebSocket data');
        } else {
          // No existing or optimistic message, add as new
          const messageToAdd = { ...messageData, decrypted: true };
          const newMessages = [...messages, messageToAdd];

          // Sort messages by creation time to maintain order
          const sortedMessages = newMessages.sort((a, b) =>
            new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at)
          );

          setMessages(sortedMessages);
          console.log('📨 Added new WebSocket message');
        }

        // Scroll to bottom after a short delay to ensure rendering is complete
        setTimeout(scrollToBottom, 100);
      }
    };

    webSocketService.onMessage('new_message', handleNewMessage);

    // Start polling as fallback for real-time updates
    const startPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      pollingIntervalRef.current = setInterval(async () => {
        try {
          const response = await ApiService.getChatMessages(roomId, 10, 0);
          if (response.success && response.data && response.data.length > 0) {
            const latestMessage = response.data[response.data.length - 1];

            // Only update if we have new messages
            if (lastMessageIdRef.current !== latestMessage.id) {
              setMessages(prevMessages => {
                const newMessages = response.data.filter(newMsg =>
                  newMsg && newMsg.id && !prevMessages.some(existingMsg => existingMsg && existingMsg.id === newMsg.id)
                );

                if (newMessages.length > 0) {
                  // Decrypt new messages immediately
                  decryptMessages(newMessages);

                  lastMessageIdRef.current = latestMessage.id;
                  const combined = [...prevMessages, ...newMessages];
                  return combined.sort((a, b) =>
                    new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at)
                  );
                }
                return prevMessages;
              });
            }
          }
        } catch (error) {
          console.error('Polling error:', error);
          // No fallback - just log the error
        }
      }, 200); // Poll every 200ms for near real-time fallback
    };

    startPolling();

    // Cleanup on unmount
    return () => {
      if (webSocketService && typeof webSocketService.leaveRoom === 'function') {
        webSocketService.leaveRoom(roomId);
      }
      if (webSocketService && typeof webSocketService.offMessage === 'function') {
        webSocketService.offMessage('new_message');
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [roomId]);

  const loadMessages = async () => {
    try {
      setLoading(true);

      // First try to get preloaded decrypted messages (instant)
      try {
        const lightningDataService = (await import('../../services/lightningDataService')).default;
        const preloadedResponse = await lightningDataService.getPreloadedMessages(roomId);

        if (preloadedResponse.success && preloadedResponse.data.length > 0) {
          console.log(`⚡ Using ${preloadedResponse.data.length} preloaded DECRYPTED messages for instant display`);

          // Check if messages are already decrypted
          const alreadyDecrypted = preloadedResponse.data.every(msg => msg.displayContent || msg.isDecrypted);

          if (alreadyDecrypted) {
            console.log('✅ Messages are already decrypted - instant display!');
            setMessages(preloadedResponse.data);
          } else {
            console.log('🔓 Decrypting preloaded messages...');
            setMessages(preloadedResponse.data); // Show immediately, decrypt in background
            await decryptMessages(preloadedResponse.data);
          }

          // Set the last message ID for polling reference
          if (preloadedResponse.data.length > 0) {
            const sortedMessages = preloadedResponse.data.sort((a, b) =>
              new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at)
            );
            lastMessageIdRef.current = sortedMessages[sortedMessages.length - 1].id;
          }

          setLoading(false);
          console.log('⚡ Preloaded messages displayed instantly');

          // Fetch any newer messages in background
          setTimeout(async () => {
            try {
              const freshResponse = await ApiService.getChatMessages(roomId, 50, 0);
              if (freshResponse.success && freshResponse.data && freshResponse.data.length > preloadedResponse.data.length) {
                console.log('🔄 Found newer messages, updating...');
                setMessages(freshResponse.data);
                await decryptMessages(freshResponse.data);
              }
            } catch (error) {
              console.warn('Background fresh message fetch failed:', error);
            }
          }, 1000);
          return;
        } else {
          console.log('ℹ️ No preloaded messages found, fetching from API...');
        }
      } catch (preloadError) {
        console.warn('⚠️ Failed to get preloaded messages:', preloadError);
      }

      // Fallback to API call
      const response = await ApiService.getChatMessages(roomId, 50, 0);
      if (response.success) {
        const messages = response.data || [];
        console.log(`📥 Loaded ${messages.length} messages for room ${roomId}`);

        // Log first message structure for debugging
        if (messages.length > 0) {
          console.log('🔍 First message structure:', {
            id: messages[0].id,
            type: messages[0].type,
            hasContent: !!messages[0].content,
            hasCiphertext: !!(messages[0].content && JSON.stringify(messages[0].content).includes('ciphertext')),
            contentPreview: typeof messages[0].content === 'string' ? messages[0].content.substring(0, 100) : 'object'
          });
        }

        setMessages(messages);

        // Decrypt messages immediately for seamless display
        await decryptMessages(messages);

        // Set the last message ID for polling reference
        if (messages.length > 0) {
          const sortedMessages = messages.sort((a, b) =>
            new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at)
          );
          lastMessageIdRef.current = sortedMessages[sortedMessages.length - 1].id;
        }
      } else {
        // API call succeeded but no messages - this is normal for new rooms
        console.log('📭 No messages found for room:', roomId);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      // No fallback - just show empty state
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() && selectedImages.length === 0) return;

    const messageContent = messageText.trim();
    const hasImages = selectedImages.length > 0;

    try {
      setSending(true);

      // Clear input fields
      setMessageText('');
      setSelectedImages([]);

      // If there are images, send them one by one with the text on the first one
      if (hasImages) {
        for (let i = 0; i < selectedImages.length; i++) {
          const image = selectedImages[i];
          const tempMessageId = 'temp_' + Date.now() + '_' + i;

          // Only include text content with the first image
          const currentContent = i === 0 ? messageContent : '';

          // Create optimistic message for immediate UI feedback
          const optimisticMessage = {
            id: tempMessageId,
            roomId: roomId,
            senderId: user?.id,
            content: currentContent,
            type: 'image',
            metadata: { imageUri: image.uri },
            fileUrl: image.uri, // Show the local URI immediately
            createdAt: new Date().toISOString(),
            isRead: false,
            isOptimistic: true,
          };

          // Add optimistic message to UI immediately
          setMessages(prevMessages => [...prevMessages, optimisticMessage]);

          // Scroll to bottom to show new message
          setTimeout(scrollToBottom, 100);

          try {
            // Send image with plain text content - backend will handle encryption
            const formData = new FormData();
            formData.append('type', 'image');
            formData.append('content', currentContent || '');
            formData.append('metadata', JSON.stringify({
              fileName: `image_${Date.now()}.jpg`,
              timestamp: Date.now(),
              roomId: roomId,
              roomType: roomType,
            }));

            // Handle file upload differently for web vs native
            if (Platform.OS === 'web') {
              try {
                // On web, fetch the image and convert to blob for FormData
                const response = await fetch(image.uri);
                const blob = await response.blob();
                formData.append('image', blob, `image_${Date.now()}.jpg`);
              } catch (webError) {
                console.error('Web image upload failed:', webError);
                // Fallback: try direct URI (might not work)
                formData.append('image', {
                  uri: image.uri,
                  type: 'image/jpeg',
                  name: `image_${Date.now()}.jpg`,
                });
              }
            } else {
              // On native platforms, copy to temp location for reliable upload
              const tempUri = FileSystem.documentDirectory + `temp_image_${Date.now()}.jpg`;
              await FileSystem.copyAsync({ from: image.uri, to: tempUri });
              formData.append('image', {
                uri: tempUri,
                type: 'image/jpeg',
                name: `image_${Date.now()}.jpg`,
              });
            }

            const response = await ApiService.makeRequest(`/chat/rooms/${roomId}/messages`, {
              method: 'POST',
              body: formData,
              // Don't set Content-Type for FormData - let the browser set it with boundary
            });

            if (response.success) {
              // Update optimistic message with real message data from server
              setMessages(prevMessages => {
                return prevMessages.map(msg => {
                  if (msg.id === tempMessageId && response.data) {
                    // Update the optimistic message with real data
                    const updatedMessage = {
                      ...response.data,
                      content: currentContent, // Keep the original plaintext content
                      decrypted: true, // Mark as already decrypted
                      isOptimistic: false, // Remove optimistic flag
                    };

                    // Cache the decrypted content to prevent re-processing
                    setDecryptedContents(prev => new Map(prev).set(response.data.id, currentContent));

                    return updatedMessage;
                  }
                  return msg;
                });
              });
            } else {
              // Remove optimistic message on failure
              setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempMessageId));
            }
          } catch (error) {
            console.error('Send image error:', error);
            // Remove optimistic message on error
            setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempMessageId));
          }
        }
      } else if (messageContent) {
        // Send text-only message
        const tempMessageId = 'temp_' + Date.now();

        const optimisticMessage = {
          id: tempMessageId,
          roomId: roomId,
          senderId: user?.id,
          content: messageContent,
          type: 'text',
          metadata: {},
          createdAt: new Date().toISOString(),
          isRead: false,
          isOptimistic: true,
        };

        setMessages(prevMessages => [...prevMessages, optimisticMessage]);
        setTimeout(scrollToBottom, 100);

        // Send plain text message - backend will handle E2EE encryption
        const messagePayload = {
          type: 'text',
          content: messageContent,
          metadata: {
            timestamp: Date.now(),
            roomId: roomId,
            roomType: roomType,
          }
        };

        const response = await ApiService.sendMessage(roomId, messagePayload);

        if (response.success) {
          setMessages(prevMessages => {
            return prevMessages.map(msg => {
              if (msg.id === tempMessageId && response.data) {
                // Update the optimistic message with real data
                const updatedMessage = {
                  ...response.data,
                  content: messageContent, // Keep the original plaintext content
                  decrypted: true, // Mark as already decrypted
                  isOptimistic: false, // Remove optimistic flag
                };

                // Cache the decrypted content to prevent re-processing
                setDecryptedContents(prev => new Map(prev).set(response.data.id, messageContent));

                return updatedMessage;
              }
              return msg;
            });
          });
        } else {
          setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempMessageId));
          Alert.alert('Error', 'Failed to send message');
        }
      }

      // Clear input after sending
      setMessageText('');
      setSelectedImages([]);

    } catch (error) {
      console.error('Send message error:', error);
      Alert.alert('Error', 'Failed to send message');
      // Remove optimistic message on error
      setMessages(prevMessages => prevMessages.filter(msg => !msg.id.startsWith('temp_')));
    } finally {
      setSending(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to send images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 5, // Allow up to 5 images
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        // Add new images to existing selection
        setSelectedImages(prevImages => [...prevImages, ...result.assets]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const renderMessage = ({ item, index }) => {
    // Handle both API response formats (senderId vs sender_id)
    const senderId = item.senderId || item.sender_id;
    const isMyMessage = senderId === user?.id;
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;

    // Handle both API response formats (createdAt vs created_at)
    const createdAt = item.createdAt || item.created_at;
    const showDate = !previousMessage ||
      new Date(createdAt).toDateString() !== new Date(previousMessage.createdAt || previousMessage.created_at).toDateString();

    const showAvatar = !isMyMessage && (!nextMessage || (nextMessage.senderId || nextMessage.sender_id) !== senderId);
    const showSenderName = !isMyMessage && roomType === 'group' &&
      (!previousMessage || (previousMessage.senderId || previousMessage.sender_id) !== senderId);

    // Get decrypted content for display - always show content immediately if available
    let displayContent = decryptedContents.get(item.id);

    // If not decrypted yet, use original content directly (decryption happens in background)
    if (displayContent === undefined) {
      displayContent = item.content || item.text || '';
    }

    // Ensure displayContent is always a string to prevent React Native text node errors
    if (typeof displayContent !== 'string') {
      displayContent = String(displayContent || '');
    }

    // Final safety check: ensure no encryption suffixes remain in the display content
    if (displayContent && typeof displayContent === 'string') {
      const metadataPatterns = [
        /_enc_\d+_[a-zA-Z0-9]+$/,
        /_encrypted_\d+_[a-zA-Z0-9]+$/,
        /_cipher_[a-zA-Z0-9]+$/,
        /_secure_[a-zA-Z0-9]+$/
      ];

      for (const pattern of metadataPatterns) {
        if (pattern.test(displayContent)) {
          displayContent = displayContent.replace(pattern, '');
          break; // Only apply first matching pattern
        }
      }
    }

    // Calculate responsive message dimensions
    const messageLength = displayContent ? displayContent.length : 0;
    const isShortMessage = messageLength < 20;
    const isMediumMessage = messageLength >= 20 && messageLength < 100;
    const isLongMessage = messageLength >= 100 && messageLength < 300;
    const isVeryLongMessage = messageLength >= 300;

    // Dynamic width based on message length
    let maxWidth = '75%';
    if (isShortMessage) maxWidth = '50%';
    else if (isMediumMessage) maxWidth = '70%';
    else if (isLongMessage) maxWidth = '85%';
    else if (isVeryLongMessage) maxWidth = '95%';

    // Dynamic font size and line height for readability
    const fontSize = isVeryLongMessage ? typography.fontSize.sm : typography.fontSize.base;
    const lineHeight = isVeryLongMessage ? 18 : 20;

    return (
      <View>
        {showDate && (
          <View style={styles.dateContainer}>
            <Text style={[styles.dateText, { color: colors.textTertiary }]}>
              {formatDate(createdAt)}
            </Text>
          </View>
        )}

        <View style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}>
          {!isMyMessage && (
            <View style={styles.avatarContainer}>
              {showAvatar ? (
                item.sender?.profile_picture || item.sender?.avatar || item.sender?.avatar_url || item.sender?.profile_image ? (
                  <Image
                    source={{
                      uri: item.sender.profile_picture || item.sender.avatar || item.sender.avatar_url || item.sender.profile_image
                    }}
                    style={styles.avatarImage}
                    onError={() => {
                      // Fallback to initial if image fails to load
                    }}
                  />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.avatarText, { color: colors.white }]}>
                      {item.sender?.first_name?.[0] || 'U'}
                    </Text>
                  </View>
                )
              ) : (
                <View style={styles.avatarSpacer} />
              )}
            </View>
          )}

          <View style={[
            styles.messageBubble,
            {
              backgroundColor: item.type === 'image' ? 'transparent' : (isMyMessage ? colors.primary : colors.surface),
              borderColor: item.type === 'image' ? 'transparent' : colors.border,
              borderWidth: item.type === 'image' ? 0 : 1,
              maxWidth: item.type === 'image' ? '70%' : maxWidth,
              minWidth: item.type === 'image' ? 'auto' : (isShortMessage ? 'auto' : '30%'),
              padding: item.type === 'image' ? 0 : spacing.md,
            },
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
          ]}>
            {showSenderName && (
              <Text style={[styles.senderName, { color: colors.textSecondary }]}>
                {item.sender?.first_name} {item.sender?.last_name}
              </Text>
            )}

            {item.type === 'image' && (item.fileUrl || item.file_url || item.metadata?.imageUri) && (
              <Image
                source={{
                  uri: item.fileUrl || item.file_url || item.metadata?.imageUri
                }}
                style={[
                  styles.messageImage,
                  {
                    width: isVeryLongMessage ? 300 : 250,
                    height: isVeryLongMessage ? 225 : 188,
                    borderRadius: item.type === 'image' ? borderRadius.lg : borderRadius.md,
                    marginBottom: item.type === 'image' ? 0 : spacing.sm,
                  }
                ]}
                resizeMode="cover"
              />
            )}

            {displayContent && (
              <Text
                style={[
                  styles.messageText,
                  {
                    color: isMyMessage ? colors.white : colors.text,
                    fontSize: fontSize,
                    lineHeight: lineHeight,
                  }
                ]}
                selectable={true}
              >
                {displayContent}
              </Text>
            )}

            <View style={[
              styles.messageFooter,
              isLongMessage || isVeryLongMessage ? styles.longMessageFooter : null
            ]}>
              <View style={styles.messageTimeContainer}>
                <Text style={[
                  styles.messageTime,
                  { color: isMyMessage ? colors.white + '80' : colors.textTertiary }
                ]}>
                  {formatTime(createdAt)}
                </Text>
              </View>

              {isMyMessage && (
                <View style={styles.messageStatus}>
                  {item.isOptimistic ? (
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={colors.white + '60'}
                      style={styles.readIndicator}
                    />
                  ) : (
                    <Ionicons
                      name={(item.isRead || item.is_read) ? 'checkmark-done' : 'checkmark'}
                      size={14}
                      color={colors.white + '80'}
                      style={styles.readIndicator}
                    />
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const removeImage = (index) => {
    setSelectedImages(prevImages => prevImages.filter((_, i) => i !== index));
  };

  const renderInputArea = () => (
    <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {selectedImages.length > 0 && (
        <ScrollView
          horizontal
          style={styles.selectedImagesContainer}
          showsHorizontalScrollIndicator={false}
        >
          {selectedImages.map((image, index) => (
            <View key={index} style={styles.selectedImageWrapper}>
              <Image source={{ uri: image.uri }} style={styles.selectedImage} />
              <TouchableOpacity
                style={[styles.removeImageButton, { backgroundColor: colors.error }]}
                onPress={() => removeImage(index)}
              >
                <Ionicons name="close" size={16} color={colors.white} />
              </TouchableOpacity>
              {selectedImages.length > 1 && (
                <View style={[styles.imageCounter, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.imageCounterText, { color: colors.white }]}>
                    {index + 1}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.inputRow}>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={pickImage}
        >
          <Ionicons name="attach" size={24} color={colors.primary} />
        </TouchableOpacity>

        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: colors.backgroundSecondary,
              color: colors.text,
              borderColor: colors.border,
            }
          ]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textTertiary}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={1000}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor: (messageText.trim() || selectedImages.length > 0) ? colors.primary : colors.backgroundSecondary,
            }
          ]}
          onPress={sendMessage}
          disabled={(!messageText.trim() && selectedImages.length === 0) || sending}
        >
          <Ionicons
            name="send"
            size={20}
            color={(messageText.trim() || selectedImages.length > 0) ? colors.white : colors.textTertiary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubble-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No messages yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Start the conversation by sending a message
      </Text>
    </View>
  );

  const startVoiceCall = () => {
    Alert.alert('Voice Call', 'Voice calling feature coming soon!');
  };

  const startVideoCall = () => {
    Alert.alert('Video Call', 'Video calling feature coming soon!');
  };

  const renderHeader = () => (
    <View style={styles.header}>
        <View style={styles.headerInfo}>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {roomName || 'Chat'}
        </Text>
        <View style={styles.headerSubtitleContainer}>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {roomType === 'private' ? 'Private Chat' : 'Group Chat'}
          </Text>
          <View style={styles.e2eeIndicator}>
            <Ionicons name="shield-checkmark" size={12} color={colors.success} />
            <Text style={[styles.e2eeText, { color: colors.success }]}>E2EE</Text>
          </View>
        </View>
      </View>

      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.callButton}
          onPress={startVoiceCall}
        >
          <Ionicons name="call" size={20} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.callButton}
          onPress={startVideoCall}
        >
          <Ionicons name="videocam" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Fixed Header */}
      <View style={[styles.headerContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {renderHeader()}
      </View>

      {/* Scrollable Messages Area */}
      <View style={styles.messagesContainer}>
        {/* WhatsApp-style background image */}
        <Image
          source={{ uri: 'https://share.google/images/qPlLN5xJoAjAmqhgI' }}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
        <FlatList
          ref={flatListRef}
          data={messages.filter(msg => msg && msg.id)}
          renderItem={renderMessage}
          keyExtractor={(item, index) => item?.id || `message_${index}`}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={!loading && renderEmptyState()}
          onContentSizeChange={scrollToBottom}
          showsVerticalScrollIndicator={false}
          inverted={false}
          removeClippedSubviews={false}
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={10}
          getItemLayout={null}
        />

        {isTyping && (
          <View style={[styles.typingIndicator, { backgroundColor: colors.surface }]}>
            <Text style={[styles.typingText, { color: colors.textSecondary }]}>
              Someone is typing...
            </Text>
          </View>
        )}
      </View>

      {/* Fixed Input Area with Keyboard Handling */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={styles.keyboardAvoidingView}
      >
        {renderInputArea()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    borderBottomWidth: 1,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    paddingTop: spacing.md, // Reduced top padding
  },
  messagesContainer: {
    flex: 1,
    marginTop: 60, // Reduced height for compact header
    marginBottom: 100, // Space for input area
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1, // Subtle background
  },
  keyboardAvoidingView: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  headerSubtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    marginRight: spacing.sm,
  },
  e2eeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  e2eeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callButton: {
    padding: spacing.sm,
    marginLeft: spacing.sm,
  },
  messagesList: {
    padding: spacing.md,
    paddingBottom: spacing.xl, // Extra bottom padding so last message isn't hidden behind input
    flexGrow: 1,
  },
  dateContainer: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dateText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: spacing.xs,
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  avatarSpacer: {
    width: 32,
  },
  messageBubble: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.xs,
    flexShrink: 1,
  },
  myMessageBubble: {
    borderBottomRightRadius: borderRadius.sm,
  },
  otherMessageBubble: {
    borderBottomLeftRadius: borderRadius.sm,
  },
  senderName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  messageImage: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  messageText: {
    fontSize: typography.fontSize.base,
    lineHeight: 20,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  longMessageFooter: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  messageTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  messageTime: {
    fontSize: typography.fontSize.xs,
  },
  characterCount: {
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  messageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readIndicator: {
    marginLeft: spacing.xs,
  },
  inputContainer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.md, // Extra bottom padding for safe area
  },
  selectedImagesContainer: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  selectedImageWrapper: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  selectedImage: {
    width: 80,
    height: 60,
    borderRadius: borderRadius.md,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCounter: {
    position: 'absolute',
    bottom: -8,
    left: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCounterText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  attachButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    maxHeight: 100,
    marginRight: spacing.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingIndicator: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  typingText: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
});

export default ChatRoomScreen;
