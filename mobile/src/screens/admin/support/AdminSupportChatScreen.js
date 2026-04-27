import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography } from '../../../utils/theme';
import ApiService from '../../../services/api';
import Toast from 'react-native-toast-message';

const AdminSupportChatScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  
  const { supportRequest } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatRoom, setChatRoom] = useState(null);

  useEffect(() => {
    if (supportRequest) {
      initializeSupportChat();
    }
  }, [supportRequest]);

  const initializeSupportChat = async () => {
    try {
      setLoading(true);

      if (!supportRequest.userId) {
        throw new Error('Support request missing user ID');
      }

      // Create or get existing chat room for this support request
      const chatContext = {
        type: 'support_request',
        supportRequestId: supportRequest.id,
        subject: supportRequest.subject,
      };
      // Use createSupportChat instead of createPrivateChat to handle special support chat logic
      const response = await ApiService.createSupportChat(supportRequest.userId, chatContext);
      
      if (response.success) {
        setChatRoom(response.data);
        loadChatMessages(response.data.id);
      } else {
        throw new Error(response.error || 'Failed to initialize support chat');
      }
    } catch (error) {
      console.error('Failed to initialize support chat:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to initialize support chat',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadChatMessages = async (roomId) => {
    try {
      const response = await ApiService.getChatMessages(roomId);
      if (response.success) {
        setMessages(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load chat messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !chatRoom) return;

    try {
      const messageData = {
        content: newMessage.trim(),
        type: 'text',
      };

      const response = await ApiService.sendMessage(chatRoom.id, messageData);
      
      if (response.success) {
        setMessages(prev => [...prev, response.data]);
        setNewMessage('');
      } else {
        throw new Error(response.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to send message',
      });
    }
  };

  const updateSupportRequestStatus = async (newStatus) => {
    try {
      const updateData = {
        status: newStatus,
        adminNotes: `Status updated to ${newStatus} via chat`,
      };

      const response = await ApiService.updateSupportRequest(supportRequest.id, updateData);
      
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Updated',
          text2: `Support request marked as ${newStatus}`,
        });
        
        // Send system message about status change
        const systemMessage = {
          content: `Support request status updated to: ${newStatus.replace('_', ' ').toUpperCase()}`,
          type: 'system',
        };
        
        await ApiService.sendMessage(chatRoom.id, systemMessage);
        loadChatMessages(chatRoom.id);
      } else {
        throw new Error(response.error || 'Failed to update support request');
      }
    } catch (error) {
      console.error('Failed to update support request:', error);
      Alert.alert('Error', error.message || 'Failed to update support request');
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMessage = (message) => {
    const isAdmin = message.senderId === user?.id;
    const isSystem = message.type === 'system';

    if (isSystem) {
      return (
        <View key={message.id} style={styles.systemMessage}>
          <Text style={[styles.systemMessageText, { color: colors.textSecondary }]}>
            {message.content}
          </Text>
        </View>
      );
    }

    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isAdmin ? styles.adminMessage : styles.userMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isAdmin ? colors.primary : colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.messageText,
              { color: isAdmin ? colors.white : colors.text },
            ]}
          >
            {message.content}
          </Text>
          <Text
            style={[
              styles.messageTime,
              { color: isAdmin ? colors.white + '80' : colors.textSecondary },
            ]}
          >
            {formatTime(message.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  const renderQuickActions = () => (
    <View style={[styles.quickActions, { backgroundColor: colors.surface }]}>
      <Text style={[styles.quickActionsTitle, { color: colors.text }]}>
        Quick Actions
      </Text>
      <View style={styles.quickActionButtons}>
        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: colors.warning + '20' }]}
          onPress={() => updateSupportRequestStatus('in_progress')}
        >
          <Ionicons name="play" size={16} color={colors.warning} />
          <Text style={[styles.quickActionText, { color: colors.warning }]}>
            In Progress
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: colors.success + '20' }]}
          onPress={() => updateSupportRequestStatus('resolved')}
        >
          <Ionicons name="checkmark" size={16} color={colors.success} />
          <Text style={[styles.quickActionText, { color: colors.success }]}>
            Resolved
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: colors.error + '20' }]}
          onPress={() => updateSupportRequestStatus('closed')}
        >
          <Ionicons name="close" size={16} color={colors.error} />
          <Text style={[styles.quickActionText, { color: colors.error }]}>
            Close
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header Actions */}
        <View style={styles.headerActionsContainer}>
          <TouchableOpacity onPress={() => navigation.navigate('AdminSupport')}>
            <Ionicons name="list" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        {renderQuickActions()}

        {/* Messages */}
        <ScrollView style={styles.messagesContainer} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading chat...
              </Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Start the conversation with the user
              </Text>
            </View>
          ) : (
            messages.map(renderMessage)
          )}
        </ScrollView>

        {/* Message Input */}
        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            style={[
              styles.messageInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder="Type your response..."
            placeholderTextColor={colors.textSecondary}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor: newMessage.trim() ? colors.primary : colors.textSecondary,
              },
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim()}
          >
            <Ionicons name="send" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  keyboardAvoid: {
    flex: 1,
  },

  quickActions: {
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  quickActionsTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  quickActionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    gap: spacing.xs,
  },
  quickActionText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
    padding: spacing.md,
  },
  messageContainer: {
    marginBottom: spacing.md,
  },
  adminMessage: {
    alignItems: 'flex-end',
  },
  userMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  messageText: {
    fontSize: typography.fontSize.base,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  systemMessage: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  systemMessageText: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.fontSize.base,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AdminSupportChatScreen;
