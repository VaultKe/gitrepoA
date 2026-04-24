import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { useLightningData } from '../../hooks/useLightningData';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import { toEAT, formatDate } from '../../utils/dateUtils';
import Button from '../../components/common/Button';
import ApiService from '../../services/api';
import webSocketService from '../../services/websocket';
import lightningDataService from '../../services/lightningDataService';

/**
 * PRIVACY & SECURITY ENFORCED:
 * 1. Backend validates user membership before returning chat rooms
 * 2. Backend validates user membership before returning messages
 * 3. Frontend only displays data from authenticated API calls
 * 4. No fallback data - only real database data with proper access control
 * 5. Message decryption handles both encrypted and plain text safely
 */

const ChatScreen = ({ navigation }) => {
  const { theme, user, chatRooms, loadLocalData, getCachedData, prefetchForPage } = useApp();
  const colors = getThemeColors(theme);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'private', 'groups'
  const [chatServiceAvailable, setChatServiceAvailable] = useState(true);
  const [chatRoomsError, setChatRoomsError] = useState(null);
  const pollingIntervalRef = useRef(null);
  const [decryptedLastMessages, setDecryptedLastMessages] = useState(new Map());

  // Lightning data hooks for REAL-TIME chat room loading
  const {
    data: lightningChatRooms,
    loading: chatRoomsLoading,
    error: lightningChatRoomsError,
    refresh: refreshChatRooms,
    isInstant: chatRoomsInstant,
    source: chatRoomsSource,
  } = useLightningData('chat-rooms', { forceRefresh: true, realTime: true }); // FORCE fresh data always

  // Debug logging for chat rooms
  useEffect(() => {
    // Log when we have empty data - this is normal if user has no chats
    if ((!lightningChatRooms || lightningChatRooms.length === 0) && !chatRoomsLoading) {
      console.log('ℹ️ No chat rooms found - user may not have any conversations yet');

      // Check for server errors from lightning data
      if (lightningChatRoomsError?.serverDown) {
        console.error('🚨 Chat server is down - showing error message to user');
        setChatRoomsError(lightningChatRoomsError);
      } else if (lightningChatRoomsError?.corsError) {
        console.error('🚨 Connection error - showing error message to user');
        setChatRoomsError(lightningChatRoomsError);
      } else if (lightningChatRoomsError) {
        console.error('🚨 Chat rooms error:', lightningChatRoomsError);
        setChatRoomsError(lightningChatRoomsError);
      } else {
        setChatRoomsError(null);
      }

      // Force refresh if we have no data but no errors (data flow issue)
      if ((!lightningChatRooms || lightningChatRooms.length === 0) &&
          !chatRoomsLoading &&
          !lightningChatRoomsError &&
          chatRoomsSource !== 'api-fresh' &&
          chatRoomsSource !== 'api-empty') {
        setTimeout(() => {
          refreshChatRooms({ forceRefresh: true });
        }, 1000);
      }

      // Trigger message preloading when chat rooms are loaded
      if (lightningChatRooms && lightningChatRooms.length > 0 && !chatRoomsLoading) {
        setTimeout(async () => {
          try {
            await lightningDataService.getData('chat-messages-preload');
          } catch (error) {
            console.warn('⚠️ Message preloading failed:', error);
          }
        }, 500);
      }

      // Start background polling for real-time updates (even when not in chat room)
      if (lightningChatRooms && lightningChatRooms.length > 0) {
        const startBackgroundPolling = async () => {
          try {
            // Poll for new messages in all rooms every 10 seconds
            const pollInterval = setInterval(async () => {
              try {
                // Get fresh room data to check for new messages
                const freshRooms = await lightningDataService.getData('chat-rooms', { forceRefresh: true });
                if (freshRooms.success && freshRooms.data) {
                }
              } catch (pollError) {
                console.warn('⚠️ Background polling error:', pollError.message);
              }
            }, 10000); // Poll every 10 seconds

            // Store interval for cleanup
            pollingIntervalRef.current = pollInterval;
          } catch (error) {
            console.warn('⚠️ Failed to start background polling:', error);
          }
        };

        startBackgroundPolling();
      }
    }
  }, [lightningChatRooms, chatRooms, chatRoomsLoading, chatRoomsSource, chatRoomsInstant, lightningChatRoomsError]);

  // Clean last messages for chat rooms
  useEffect(() => {
    const cleanLastMessages = () => {
      const roomsToUse = lightningChatRooms || chatRooms || [];
      const newCleanedMessages = new Map();

      for (const room of roomsToUse) {
        if (room && room.id) {
          const cleaned = cleanLastMessageForDisplay(room.last_message || room.lastMessage);
          newCleanedMessages.set(room.id, cleaned);
        }
      }

      setDecryptedLastMessages(newCleanedMessages);
    };

    if ((lightningChatRooms && lightningChatRooms.length > 0) || (chatRooms && chatRooms.length > 0)) {
      cleanLastMessages();
    }
  }, [lightningChatRooms, chatRooms]);

  useEffect(() => {
    // User is online instantly when they open chat
    setChatServiceAvailable(true);

    // IMMEDIATE: Force direct chat rooms load (bypasses all delays)
    console.log('⚡ IMMEDIATE: Loading chat rooms directly...');
    const loadImmediate = async () => {
      try {
        const result = await lightningDataService.getImmediateChatRooms();
        if (result.success && result.data) {
          console.log(`⚡ IMMEDIATE: Got ${result.data.length} rooms directly`);
        }
      } catch (error) {
        console.warn('⚠️ IMMEDIATE: Direct load failed:', error.message);
      }
    };
    loadImmediate();

    // Also trigger the hook refresh as backup
    refreshChatRooms({ forceRefresh: true });

    // Prefetch chat-related data
    // console.log('⚡ Prefetching chat data...');
    prefetchForPage('chat', 'high');

    // Lightning data automatically loads chat rooms
    if (chatRoomsInstant) {
    } else {
      console.log('📡 Chat rooms loading from API...');
    }

    // Use lightning data instead of manual loading
    console.log('⚡ Using lightning data for chat rooms');

    // Connect to WebSocket for real-time updates
    const connectWebSocket = async () => {
      if (!webSocketService.isConnected) {
        console.log('🔌 Connecting to WebSocket for chat updates...');
        await webSocketService.connect();
      }
    };

    connectWebSocket();

    // Set up real-time message handlers
    const handleNewMessage = (message) => {
      console.log('📨 New message received in chat list:', message);
      // Refresh chat rooms when new message arrives
      loadLocalData();
    };

    const handleMessageRead = (message) => {
      console.log('👁️ Message read in chat list:', message);
      // Refresh chat rooms to update unread counts
      loadLocalData();
    };

    // Register WebSocket handlers
    webSocketService.onMessage('new_message', handleNewMessage);
    webSocketService.onMessage('message_read', handleMessageRead);

    // Disable polling for production deployment - use manual refresh instead
    console.log('💬 Chat polling disabled for production deployment');

    // Cleanup on unmount
    return () => {
      console.log('👤 User left chat - cleaning up real-time systems');

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        console.log('🛑 Stopped background polling');
      }

      if (webSocketService && typeof webSocketService.offMessage === 'function') {
        webSocketService.offMessage('new_message');
        webSocketService.offMessage('message_read');
      }

      // Stop real-time polling in lightning data service
      try {
        lightningDataService.stopPolling('chat-rooms');
        console.log('🛑 Stopped real-time data polling');
      } catch (error) {
        console.warn('⚠️ Failed to stop real-time polling:', error);
      }
    };
  }, []);

  const loadChatRooms = async () => {
    try {
      setLoading(true);

      // For production: Set user as online and load local data first
      setChatServiceAvailable(true);
      console.log('🚀 Production mode: Loading chat from local data');

      // Load local data immediately for production
      await loadLocalData();

      // Try API call with very short timeout for production
      try {
        const response = await Promise.race([
          ApiService.getChatRooms(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Chat service timeout')), 1000) // 1 second for production
          )
        ]);

        if (response && response.success) {
          console.log('✅ Chat API available:', response.data?.length || 0, 'rooms');
          await enhanceChatRoomsWithCounts();
        }
      } catch (apiError) {
        console.log('📱 Using local chat data (API unavailable)');
        setChatServiceAvailable(false);
      }

    } catch (error) {
      console.log('📱 Production: Using local data only');
      setChatServiceAvailable(false);

      // Production: Always gracefully handle errors
      try {
        await loadLocalData();
      } catch (localError) {
        // Set empty state for production
        setChatRooms([]);
        setFilteredRooms([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Enhance chat rooms with message and member counts (with rate limiting)
  const enhanceChatRoomsWithCounts = async () => {
    try {
      console.log('🔄 Enhancing chat rooms with counts...');

      // Process rooms in smaller batches to avoid rate limiting
      const batchSize = 3; // Process 3 rooms at a time
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      for (let i = 0; i < chatRooms.length; i += batchSize) {
        const batch = chatRooms.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (room) => {
            try {
              // Skip if we already have the data
              if (room.enhanced) {
                return room;
              }

              // Get member count and participant names for private chats
              if (room.type === 'private' && (!room.otherUserName && !room.other_user_name)) {
                try {
                  const membersResponse = await ApiService.getChatRoomMembers(room.id);
                  if (membersResponse.success && membersResponse.data) {
                    console.log('🔍 Private chat members for room', room.id, ':', membersResponse.data);

                    // Find the other participant (not the current user)
                    const otherMember = membersResponse.data.find(member => member.id !== user?.id);
                    if (otherMember) {
                      room.otherUserName = otherMember.name ||
                                         otherMember.username ||
                                         otherMember.full_name ||
                                         otherMember.display_name ||
                                         otherMember.email ||
                                         `User ${otherMember.id}`;

                      console.log('✅ Found other user name:', room.otherUserName);
                    }

                    // Also store participants for future use
                    room.participants = membersResponse.data;
                  }
                } catch (error) {
                  console.warn('Failed to get members for private chat:', room.id, error);
                }
              }

              // Get member count for groups/support if not available
              if ((room.type === 'group' || room.type === 'chama' || room.type === 'support') && !room.member_count && !room.memberCount) {
                try {
                  const membersResponse = await ApiService.getChatRoomMembers(room.id);
                  if (membersResponse.success && membersResponse.data) {
                    room.member_count = membersResponse.data.length || 0;
                  }
                } catch (error) {
                  console.warn('Failed to get members for group chat:', room.id, error);
                }
              }

              // Mark as enhanced to avoid re-processing
              room.enhanced = true;
              return room;
            } catch (error) {
              console.warn('Failed to enhance room data for:', room.id, error);
              return room;
            }
          })
        );

        // Add delay between batches to avoid rate limiting
        if (i + batchSize < chatRooms.length) {
          await delay(500); // 500ms delay between batches
        }
      }

      console.log('✅ Enhanced chat rooms with counts and names');
    } catch (error) {
      console.warn('Failed to enhance chat rooms:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    console.log('⚡ Lightning refresh for chat rooms...');
    await refreshChatRooms();
    setRefreshing(false);
  };

  const formatTime = (dateString) => {
    const eatDate = toEAT(dateString);
    if (!eatDate) return '';

    return formatDate(eatDate, 'relative');
  };

  const getFilteredRooms = () => {
    // Use lightning data first, fallback to context data
    const roomsToUse = lightningChatRooms || chatRooms || [];
    let filtered = roomsToUse;

   
    

    if (activeTab === 'private') {
      filtered = roomsToUse.filter(room => room.type === 'private');
    } else if (activeTab === 'groups') {
      // Include 'chama', 'group', and 'support' types for groups
      filtered = roomsToUse.filter(room =>
        room.type === 'group' ||
        room.type === 'chama' ||
        room.type === 'GROUP' ||
        room.type === 'CHAMA' ||
        room.type === 'support' ||
        room.type === 'SUPPORT'
      );
    }

    if (searchQuery) {
      filtered = filtered.filter(room =>
        room.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.last_message?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered.sort((a, b) =>
      new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at)
    );
  };

  const handleCreatePrivateChat = () => {
    navigation.navigate('CreatePrivateChat');
  };

  const handleCreateGroupChat = () => {
    navigation.navigate('CreateGroupChat');
  };

  const handleLongPress = (item) => {
    const displayName = getChatDisplayName(item);

    Alert.alert(
      `${displayName}`,
      'Choose an action',
      [
        {
          text: 'Clear Chat',
          onPress: () => handleClearChat(item),
          style: 'destructive',
        },
        {
          text: 'Delete Chat',
          onPress: () => handleDeleteChat(item),
          style: 'destructive',
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleClearChat = async (item) => {
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to clear all messages in this chat? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await ApiService.clearChatRoom(item.id);
              if (response.success) {
                Alert.alert('Success', 'Chat cleared successfully');
                await loadChatRooms(); // Refresh the list
              } else {
                Alert.alert('Error', response.error || 'Failed to clear chat');
              }
            } catch (error) {
              console.error('Failed to clear chat:', error);
              Alert.alert('Error', 'Failed to clear chat');
            }
          },
        },
      ]
    );
  };

  const handleDeleteChat = async (item) => {
    Alert.alert(
      'Delete Chat',
      'Are you sure you want to delete this chat? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await ApiService.deleteChatRoom(item.id);
              if (response.success) {
                Alert.alert('Success', 'Chat deleted successfully');
                await loadChatRooms(); // Refresh the list
              } else {
                Alert.alert('Error', response.error || 'Failed to delete chat');
              }
            } catch (error) {
              console.error('Failed to delete chat:', error);
              Alert.alert('Error', 'Failed to delete chat');
            }
          },
        },
      ]
    );
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.surface }]}>
      <View style={styles.headerTop}>
        {/* Compact Status Indicator */}
        <View style={[
          styles.statusIndicator,
          { backgroundColor: chatServiceAvailable ? colors.success + '20' : colors.warning + '20' }
        ]}>
          <Ionicons
            name={chatServiceAvailable ? "wifi" : "cloud-offline"}
            size={16}
            color={chatServiceAvailable ? colors.success : colors.warning}
          />
        </View>

        {/* Debug: Force Refresh Button */}
        {(!lightningChatRooms || lightningChatRooms.length === 0) && (
          <TouchableOpacity
            style={[styles.debugButton, { backgroundColor: colors.primary }]}
            onPress={async () => {
              try {
                const lightningDataService = (await import('../../services/lightningDataService')).default;

                // Clear storage quota issues first
                await lightningDataService.clearOldCacheData();

                // Clear current cache completely
                await lightningDataService.clearCache('chat-rooms');

                // Force fresh API call
                const freshData = await lightningDataService.getData('chat-rooms', { forceRefresh: true });
                if (freshData.success && freshData.data?.length > 0) {
                  // Trigger component refresh
                  await refreshChatRooms();
                } else {
                  console.warn('⚠️ Still no data after force refresh');
                }
              } catch (error) {
                console.error('❌ Force refresh failed:', error);
              }
            }}
          >
            <Ionicons name="refresh" size={16} color={colors.white} />
          </TouchableOpacity>
        )}

        {/* Compact Sorting Tabs */}
        <View style={styles.tabContainer}>
          {(() => {
            const roomsToUse = lightningChatRooms || chatRooms || [];
            return [
              { id: 'all', name: 'All', count: roomsToUse.length },
              { id: 'private', name: 'Private', count: roomsToUse.filter(r => r.type === 'private').length },
              { id: 'groups', name: 'Groups', count: roomsToUse.filter(r =>
                r.type === 'group' || r.type === 'chama' || r.type === 'GROUP' || r.type === 'CHAMA' ||
                r.type === 'support' || r.type === 'SUPPORT'
              ).length },
            ];
          })().map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                {
                  backgroundColor: activeTab === tab.id ? colors.primary : 'transparent',
                  borderColor: colors.border,
                }
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[
                styles.tabText,
                { color: activeTab === tab.id ? colors.white : colors.textSecondary }
              ]}>
                {tab.name} ({tab.count})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search Icon - Far Right */}
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('UserSearch')}
        >
          <Ionicons name="search" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const getChatDisplayName = (item) => {
    if (item.type === 'group' || item.type === 'chama' || item.type === 'GROUP' || item.type === 'CHAMA') {
      // For groups, use the group name from database
      return item.name || item.group_name || item.chama_name || `${item.type} ${item.id}`;
    } else if (item.type === 'support' || item.type === 'SUPPORT') {
      // For support chats, show as Support
      return item.name || 'Support Chat';
    } else if (item.type === 'private') {
      // console.log('🔍 Getting private chat name for:', item);

      // Priority 1: Use enhanced otherUserName from our data fetching
      if (item.otherUserName && item.otherUserName !== 'Private Chat') {
        // console.log('✅ Using enhanced otherUserName:', item.otherUserName);
        return item.otherUserName;
      }

      // Priority 2: Check participants array
      if (item.participants && Array.isArray(item.participants) && user?.id) {
        const otherParticipant = item.participants.find(p => p.id !== user.id);
        if (otherParticipant) {
          const name = otherParticipant.name ||
                      otherParticipant.username ||
                      otherParticipant.full_name ||
                      otherParticipant.display_name ||
                      otherParticipant.email;
          if (name) {
            console.log('✅ Using participant name:', name);
            return name;
          }
        }
      }

      // Priority 3: Try other database fields
      const dbName = item.other_user_name ||
                    item.participantName ||
                    item.participant_name ||
                    item.other_participant_name ||
                    item.created_by_name ||
                    item.creator_name;

      if (dbName) {
        console.log('✅ Using database field:', dbName);
        return dbName;
      }

      // Priority 4: Parse room name if it contains useful info
      if (item.name && !item.name.toLowerCase().includes('private')) {
        console.log('✅ Using parsed room name:', item.name);
        return item.name;
      }

      // If we still don't have a name, trigger async fetch but show loading state
      if (!item.fetchingName) {
        item.fetchingName = true;
        fetchPrivateChatName(item.id).then(name => {
          if (name) {
            item.otherUserName = name;
            item.fetchingName = false;
            // Trigger a re-render by calling loadLocalData
            loadLocalData();
          }
        }).catch(() => {
          item.fetchingName = false;
        });
      }

      // Show loading or fallback with more specific ID
      console.log('⚠️ No name found, showing fallback for room:', item.id);
      return item.fetchingName ? 'Loading...' : `User ${item.id?.slice(-4) || 'Unknown'}`;
    }

    // For other types, use name or ID
    return item.name || `Chat ${item.id}`;
  };

  // Helper method to fetch private chat participant name
  const fetchPrivateChatName = async (roomId) => {
    try {
      const response = await ApiService.getChatRoomMembers(roomId);
      if (response.success && response.data) {
        const otherMember = response.data.find(member => member.id !== user?.id);
        if (otherMember) {
          return otherMember.name || otherMember.username || otherMember.full_name || otherMember.email;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch private chat name:', error);
    }
    return null;
  };

  // Get message count for a chat room
  const getMessageCount = (item) => {
    // Try different possible fields for message count
    return item.message_count ||
           item.messageCount ||
           item.total_messages ||
           item.totalMessages ||
           0;
  };

  // Get unread message count
  const getUnreadCount = (item) => {
    return item.unread_count ||
           item.unreadCount ||
           item.unread_messages ||
           item.unreadMessages ||
           0;
  };

  // Get member count for a chat room
  const getMemberCount = (item) => {
    // For groups/chamas/support, show member count
    if (item.type === 'group' || item.type === 'chama' || item.type === 'GROUP' || item.type === 'CHAMA' ||
        item.type === 'support' || item.type === 'SUPPORT') {
      return item.member_count ||
             item.memberCount ||
             item.participants_count ||
             item.participantsCount ||
             (item.participants ? item.participants.length : 0) ||
             0;
    }
    // For private chats, always 2 members
    return 2;
  };

  // Format count display
  const formatCount = (count) => {
    if (count === 0) return '';
    if (count > 999) return '999+';
    return count.toString();
  };

  // Get correct avatar URL
  const getAvatarUrl = (avatarPath) => {
    if (!avatarPath) return null;

    // If it's already a data URL, use it directly
    if (avatarPath.startsWith('data:')) {
      return avatarPath;
    }

    // If it's a file path, prepend the server URL
    if (avatarPath.startsWith('/')) {
      return `http://localhost:8080${avatarPath}`;
    }

    // If it's already a full URL, use it directly
    if (avatarPath.startsWith('http')) {
      return avatarPath;
    }

    // Default: assume it's a relative path
    return `http://localhost:8080/${avatarPath}`;
  };

  // Helper function to clean last message content for display
  const cleanLastMessageForDisplay = (lastMessage) => {
    try {
      // If no message, return empty
      if (!lastMessage) return '';

      // Backend now provides decrypted last messages, just do basic cleanup
      if (typeof lastMessage === 'string') {
        // Basic cleanup for any remaining artifacts
        const cleanupPatterns = [
          /_enc_\d+_[a-zA-Z0-9]+$/,
          /_encrypted_\d+_[a-zA-Z0-9]+$/,
          /_cipher_[a-zA-Z0-9]+$/,
          /_secure_[a-zA-Z0-9]+$/
        ];

        let cleanedMessage = lastMessage;
        for (const pattern of cleanupPatterns) {
          if (pattern.test(cleanedMessage)) {
            cleanedMessage = cleanedMessage.replace(pattern, '');
          }
        }

        return cleanedMessage;
      }

      return lastMessage;
    } catch (error) {
      console.log('⚠️ Error in cleanLastMessageForDisplay:', error.message);
      return lastMessage || '';
    }
  };

  const renderChatRoom = ({ item }) => {
    const isGroup = item.type === 'group' || item.type === 'chama' || item.type === 'GROUP' || item.type === 'CHAMA' ||
                   item.type === 'support' || item.type === 'SUPPORT';
    const unreadCount = getUnreadCount(item);
    const displayName = getChatDisplayName(item);

    // Get decrypted last message from state
    const decryptedLastMessage = decryptedLastMessages.get(item.id) || item.last_message || item.lastMessage || '';

    return (
      <TouchableOpacity
        style={[styles.chatItem, { backgroundColor: colors.surface }]}
        onPress={() => {
          if (!item.id) {
            console.error('ChatScreen: Cannot navigate to ChatRoom, item.id is undefined:', item);
            Alert.alert('Error', 'Cannot open chat room. Please try again.');
            return;
          }
          navigation.navigate('ChatRoom', {
            roomId: item.id,
            roomName: displayName,
            roomType: item.type,
          });
        }}
        onLongPress={() => handleLongPress(item)}
      >
        <View style={styles.chatAvatar}>
          {isGroup ? (
            <View style={[styles.groupAvatar, { backgroundColor: colors.primary }]}>
              <Ionicons name="people" size={24} color={colors.white} />
            </View>
          ) : (
            // Private chat avatar - show profile picture if available
            item.otherUserAvatar ? (
              <Image
                source={{ uri: getAvatarUrl(item.otherUserAvatar) }}
                style={styles.profileImage}
                onError={(error) => {
                  console.log('Failed to load avatar:', item.otherUserAvatar, error);
                }}
                onLoad={() => {
                  // console.log('✅ Successfully loaded avatar for:', item.otherUserName);
                }}
              />
            ) : (
              <View style={[styles.privateAvatar, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.avatarText, { color: colors.white }]}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )
          )}

          {/* Online indicator for private chats */}
          {!isGroup && (
            <View style={[styles.onlineIndicator, { backgroundColor: colors.success }]} />
          )}
        </View>

        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={[styles.chatName, { color: colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>

            <View style={styles.chatMeta}>
              {item.last_message_at && (
                <Text style={[styles.chatTime, { color: colors.textTertiary }]}>
                  {formatTime(item.last_message_at)}
                </Text>
              )}

              {unreadCount > 0 && (
                <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.unreadCount, { color: colors.white }]}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.chatPreview}>
            <Text style={[styles.lastMessage, { color: colors.textSecondary }]} numberOfLines={2}>
              {decryptedLastMessage}
            </Text>

            <View style={styles.chatStats}>
              {/* Message Count */}
              {getMessageCount(item) > 0 && (
                <View style={styles.statItem}>
                  <Ionicons name="chatbubble" size={12} color={colors.textTertiary} />
                  <Text style={[styles.statText, { color: colors.textTertiary }]}>
                    {formatCount(getMessageCount(item))} messages
                  </Text>
                </View>
              )}

              {/* Member Count for Groups/Chamas */}
              {isGroup && (
                <View style={styles.statItem}>
                  <Ionicons name="people" size={12} color={colors.textTertiary} />
                  <Text style={[styles.statText, { color: colors.textTertiary }]}>
                    {formatCount(getMemberCount(item))} members
                  </Text>
                </View>
              )}

              {/* For Private Chats, show if online/offline status if available */}
              {!isGroup && item.other_user_online !== undefined && (
                <View style={styles.statItem}>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: item.other_user_online ? colors.success : colors.textTertiary }
                  ]} />
                  <Text style={[styles.statText, { color: colors.textTertiary }]}>
                    {item.other_user_online ? 'Online' : 'Offline'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    // Use chatRoomsError state or lightningChatRoomsError as fallback
    const errorToShow = chatRoomsError || lightningChatRoomsError;

    return (
      <View style={styles.emptyState}>
        {errorToShow?.serverDown ? (
        <>
          <Ionicons name="server-outline" size={64} color={colors.error} />
          <Text style={[styles.emptyTitle, { color: colors.error }]}>
            Server Temporarily Unavailable
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            The chat server is currently down. Please try again in a few moments.
          </Text>
        </>
      ) : errorToShow?.corsError ? (
        <>
          <Ionicons name="wifi-outline" size={64} color={colors.warning} />
          <Text style={[styles.emptyTitle, { color: colors.warning }]}>
            Connection Issue
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Unable to connect to chat server. Please check your internet connection.
          </Text>
        </>
      ) : (
        <>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No conversations yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Start a conversation with someone or create a group chat
          </Text>
        </>
      )}

      <View style={styles.emptyActions}>
        <Button
          title="Start Private Chat"
          onPress={handleCreatePrivateChat}
          style={styles.emptyButton}
          icon={<Ionicons name="person-add" size={20} color={colors.white} />}
        />

        <Button
          title="Create Group"
          variant="outline"
          onPress={handleCreateGroupChat}
          style={styles.emptyButton}
          icon={<Ionicons name="people" size={20} color={colors.primary} />}
        />
      </View>
    </View>
    );
  };

  const filteredRooms = getFilteredRooms();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}

      <FlatList
        data={filteredRooms}
        renderItem={renderChatRoom}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={!loading && renderEmptyState()}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: 'transparent',
  },

  tabContainer: {
    flexDirection: 'row',
    flex: 1,
    gap: spacing.xs,
    marginHorizontal: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 0, // Allow shrinking
  },
  tabText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
  },
  chatList: {
    padding: spacing.md,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  chatAvatar: {
    position: 'relative',
    marginRight: spacing.md,
  },
  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privateAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
  },
  avatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  chatName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
  },
  chatMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatTime: {
    fontSize: typography.fontSize.sm,
    marginRight: spacing.sm,
  },
  unreadBadge: {
    borderRadius: borderRadius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  chatPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: typography.fontSize.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCount: {
    fontSize: typography.fontSize.xs,
    marginLeft: spacing.xs,
  },
  chatStats: {
    flexDirection: 'column',
    gap: spacing.xs,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  statText: {
    fontSize: typography.fontSize.xs,
    marginLeft: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  chatNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  unreadText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
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
    marginBottom: spacing.xl,
  },
  emptyActions: {
    width: '100%',
    gap: spacing.md,
  },
  emptyButton: {
    marginBottom: spacing.sm,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
});

export default ChatScreen;
