import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import { formatDate } from '../../utils/dateUtils';
import { useApp } from '../../context/AppContext';
import chatService from '../../services/chat/ChatService';

const ChatScreen = () => {
  const navigation = useNavigation();
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  // State
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Refs
  const initializedRef = useRef(false);

  // Initialize ChatService once
  useEffect(() => {
    const init = async () => {
      if (initializedRef.current) return;
      initializedRef.current = true;

      try {
        await chatService.initialize();

        const cachedRooms = chatService.getAllRooms();
        if (cachedRooms && cachedRooms.length > 0) {
          setRooms(cachedRooms);
        }

        const roomList = await chatService.getRooms();
        setRooms(roomList);
        setError(null);
      } catch (err) {
        console.error('Chat init error:', err);
        setError('Failed to load chats. Pull to refresh.');
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      if (chatService.cleanup) chatService.cleanup();
    };
  }, []);

  // Subscribe to room updates to refresh unread counts
  useEffect(() => {
    if (rooms.length === 0) return;

    const unsubscribers = rooms.map(room => {
      return chatService.subscribeToRoom(room.id, () => {
        setRefreshCounter(prev => prev + 1);
      });
    });

    return () => {
      unsubscribers.forEach(unsub => {
        if (unsub) unsub();
      });
    };
  }, [rooms]);

  // Refresh rooms
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const roomList = await chatService.getRooms(true);
      setRooms(roomList);
    } catch (err) {
      console.error('Refresh error:', err);
      setError('Failed to refresh chats');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Navigate to chat room
  const openRoom = useCallback((room) => {
    navigation.navigate('ChatRoom', { roomId: room.id, roomName: room.name });
  }, [navigation]);

  const getLatestMessage = (room) => {
    const roomMessages = chatService.getRoomMessages(room.id);
    if (roomMessages.length === 0) return null;
    return roomMessages.reduce((latest, msg) => msg.createdAt > (latest?.createdAt || 0) ? msg : latest, roomMessages[0]);
  };

  const getLatestMessageTime = (room) => {
    const latest = getLatestMessage(room);
    if (latest) return latest.createdAt;
    return room.lastMessageAt || room.updatedAt || 0;
  };

  const sortedRooms = rooms
    .slice()
    .sort((a, b) => getLatestMessageTime(b) - getLatestMessageTime(a));

  const filteredRooms = sortedRooms.filter(room => {
    const latestMessage = getLatestMessage(room);
    const matchesSearch = room.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         latestMessage?.content?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || room.type === activeTab;
    return matchesSearch && matchesTab;
  });

  // Render room item
  const renderRoom = ({ item: room }) => {
    const unreadCount = chatService.getUnreadCount(room.id);
    const lastMessage = getLatestMessage(room) || {};

    return (
      <TouchableOpacity
        style={[styles.roomItem, { borderBottomColor: colors.divider }]}
        onPress={() => openRoom(room)}
      >
        <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
          {room.type === 'private' ? (
            <Ionicons name="person" size={24} color={colors.primary} />
          ) : (
            <Ionicons name="people" size={24} color={colors.primary} />
          )}
        </View>

        <View style={styles.roomContent}>
          <View style={styles.roomHeader}>
            <Text style={[styles.roomName, { color: colors.text }]} numberOfLines={1}>
              {room.name || 'Chat'}
            </Text>
<Text style={[styles.timestamp, { color: colors.textSecondary }]}>
               {formatDate(lastMessage.createdAt || room.lastMessageAt || room.updatedAt, 'relative')}
             </Text>
          </View>
          <View style={styles.messageRow}>
            <Text
              style={[styles.lastMessage, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {lastMessage.content || 'No messages yet'}
            </Text>
            {unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search chats..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['all', 'private', 'groups'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.textSecondary }]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Error Message */}
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: colors.error + '20' }]}>
          <Ionicons name="alert-circle" size={20} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}

      {/* Chat List */}
      <FlatList
        data={filteredRooms}
        renderItem={renderRoom}
        keyExtractor={(item) => item.id}
        contentContainerStyle={rooms.length === 0 ? styles.emptyContainer : null}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading chats...
              </Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No chats yet
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Start a conversation by tapping the + button
              </Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      />

      {/* Create Chat Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('UserSearch')}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
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
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.md,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
   errorText: {
     marginLeft: spacing.sm,
     flex: 1,
     fontSize: typography.fontSize.sm,
   },
  roomItem: {
    flexDirection: 'row',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  roomContent: {
    flex: 1,
    justifyContent: 'center',
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
   roomName: {
     fontSize: typography.fontSize.lg,
     fontWeight: '600',
     flex: 1,
   },
   timestamp: {
     fontSize: typography.fontSize.xs,
   },
   lastMessage: {
     flex: 1,
     fontSize: typography.fontSize.sm,
   },
   badgeText: {
     color: 'white',
     fontSize: typography.fontSize.xs,
     fontWeight: '600',
   },
   emptyText: {
     fontSize: typography.fontSize.xl,
     fontWeight: '600',
     marginTop: spacing.md,
   },
   emptySubtext: {
     fontSize: typography.fontSize.md,
     marginTop: spacing.xs,
     textAlign: 'center',
     paddingHorizontal: spacing.xl,
   },
   timestamp: {
     fontSize: typography.fontSize.xs,
   },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
   lastMessage: {
     flex: 1,
     fontSize: typography.fontSize.sm,
   },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    marginLeft: spacing.sm,
  },
   badgeText: {
     color: 'white',
     fontSize: typography.fontSize.xs,
     fontWeight: '600',
   },
  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  emptyContainer: {
    paddingTop: 100,
  },
   emptyText: {
     fontSize: typography.fontSize.xl,
     fontWeight: '600',
     marginTop: spacing.md,
   },
   emptySubtext: {
     fontSize: typography.fontSize.md,
     marginTop: spacing.xs,
     textAlign: 'center',
     paddingHorizontal: spacing.xl,
   },
});

export default ChatScreen;
