import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { useFocusEffect } from '@react-navigation/native';
import { getThemeColors } from '../../utils/theme';
import { formatTime } from '../../utils/dateUtils';
import chatService from '../../services/chat/ChatService';

export default function CreateGroupChatScreen({ navigation }) {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const [chamas, setChamas] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadChatRooms = useCallback(async () => {
    try {
      setLoading(true);
      const rooms = await chatService.getRooms();
      
      if (rooms && rooms.length > 0) {
        // Use the lastMessage/lastMessageAt already returned by getRooms rather
        // than issuing one extra API call per room. The backend populates
        // chat_rooms.last_message and last_message_at on every new message,
        // so the list is already enriched.
        const enrichedRooms = rooms.map(room => ({
          ...room,
          lastMessage: room.lastMessage || null,
          lastMessageAt: room.lastMessageAt || room.updatedAt || Date.now(),
        }));
        setChamas(enrichedRooms);
      } else {
        setChamas([]);
      }
    } catch (error) {
      console.error('Failed to load chat rooms:', error);
      setChamas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChatRooms();
  }, [loadChatRooms]);

  useFocusEffect(
    useCallback(() => {
      loadChatRooms();
    }, [loadChatRooms])
  );

  const getLastMessageText = (room) => {
    if (!room.lastMessage) return '';
    
    if (typeof room.lastMessage === 'string') return room.lastMessage;
    
    if (room.lastMessage.type === 'image') return 'Photo';
    if (room.lastMessage.content) return room.lastMessage.content;
    return '';
  };

  const sortedChamas = useMemo(() => {
    return [...chamas].sort((a, b) => {
      const aLastMsg = a.lastMessage;
      const bLastMsg = b.lastMessage;
      
      const aReceived = aLastMsg && typeof aLastMsg === 'object' && aLastMsg.senderId !== user?.id;
      const bReceived = bLastMsg && typeof bLastMsg === 'object' && bLastMsg.senderId !== user?.id;
      
      if (aReceived && !bReceived) return -1;
      if (!aReceived && bReceived) return 1;
      
      const aTime = a.lastMessageAt || 0;
      const bTime = b.lastMessageAt || 0;
      return bTime - aTime;
    });
  }, [chamas, user?.id]);

  const openChatRoom = (room) => {
    navigation.replace('ChatRoom', {
      roomId: room.id,
      roomName: room.name,
      roomType: room.type || 'group',
    });
  };

  const getChamaIcon = (type) => {
    switch (type) {
      case 'savings':
        return 'wallet-outline';
      case 'business':
        return 'briefcase-outline';
      case 'investment':
        return 'trending-up-outline';
      default:
        return 'people-outline';
    }
  };

  const renderChamaItem = ({ item }) => {
    const lastMessageText = getLastMessageText(item);
    const truncatedText = lastMessageText.length > 10 ? lastMessageText.substring(0, 10) + '...' : lastMessageText;
    const isReceived = item.lastMessage && typeof item.lastMessage === 'object' && item.lastMessage.senderId !== user?.id;
    const lastTime = item.lastMessageAt ? formatTime(new Date(item.lastMessageAt)) : '';

    return (
      <TouchableOpacity
        style={[styles.chamaItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => openChatRoom(item)}
      >
        <View style={[styles.chamaIcon, { backgroundColor: colors.primary }]}>
          <Ionicons 
            name={getChamaIcon(item.type)} 
            size={24} 
            color={colors.surface} 
          />
        </View>
        
        <View style={styles.chamaInfo}>
          <Text style={[styles.chamaName, { color: colors.text }]}>
            {item.name}
          </Text>
          <Text style={[styles.lastMessage, { color: isReceived ? colors.success || colors.primary : colors.textSecondary }]}>
            {truncatedText || 'No messages yet'}
          </Text>
          {lastTime && (
            <Text style={[styles.lastMessageTime, { color: colors.textTertiary }]}>
              {lastTime}
            </Text>
          )}
        </View>
        
        <Ionicons 
          name="chatbubbles-outline" 
          size={24} 
          color={colors.primary} 
        />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading your chat rooms...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Group Chats
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Your recent group conversations
        </Text>
      </View>

      {/* Chat Rooms List */}
      <FlatList
        data={sortedChamas}
        renderItem={renderChamaItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No chat rooms available
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
              Create or join a chama to get started
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },
  chamaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  chamaIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chamaInfo: {
    flex: 1,
    marginLeft: 16,
  },
  chamaName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 13,
    marginBottom: 2,
  },
  lastMessageTime: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
});
