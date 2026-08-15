import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';
import ApiService from '../../services/api';

export default function CreatePrivateChatScreen({ navigation }) {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchQuery, users]);

  const loadUsers = async () => {
    try {
      setLoading(true);

      const chatRoomsResponse = await ApiService.getChatRooms();
      if (!chatRoomsResponse.success || !chatRoomsResponse.data) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const privateRooms = chatRoomsResponse.data.filter(r => r.type === 'private');
      if (privateRooms.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Parallelize member lookups for all private rooms instead of N+1
      // sequential requests.
      const memberPromises = privateRooms.map(room =>
        ApiService.makeRequest(`/chat/rooms/${room.id}/members`).catch(err => ({
          success: false,
          data: [],
        }))
      );
      const memberResults = await Promise.all(memberPromises);

      const usersWithHistory = [];
      const seenUserIds = new Set();

      for (let i = 0; i < privateRooms.length; i++) {
        const room = privateRooms[i];
        const result = memberResults[i];
        if (!result.success || !result.data) continue;

        const otherUsers = result.data.filter(member =>
          member && member.user_id && member.user_id !== user?.id
        );

        for (const member of otherUsers) {
          if (member.user_id && !seenUserIds.has(member.user_id)) {
            seenUserIds.add(member.user_id);
            // Fetch individual user detail in parallel via the bulk users
            // endpoint. Fall back to room metadata if detail fetch fails.
            try {
              const userResponse = await ApiService.makeRequest(`/users/${member.user_id}`);
              if (userResponse.success && userResponse.data) {
                usersWithHistory.push({
                  id: userResponse.data.id,
                  firstName: userResponse.data.first_name || userResponse.data.firstName,
                  lastName: userResponse.data.last_name || userResponse.data.lastName,
                  email: userResponse.data.email,
                  avatar: userResponse.data.avatar,
                  lastChatAt: room.last_message_at || room.created_at,
                  roomId: room.id,
                });
              }
            } catch (error) {
              console.error('Failed to fetch user details for:', member.user_id, error);
            }
          }
        }
      }

      // Sort by last chat time (most recent first)
      usersWithHistory.sort((a, b) => new Date(b.lastChatAt) - new Date(a.lastChatAt));

      setUsers(usersWithHistory);
    } catch (error) {
      console.error('Failed to load users with conversation history:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const filtered = users.filter(user =>
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredUsers(filtered);
  };

  const createPrivateChat = async (recipientUser) => {
    try {
      setCreating(true);

      // If user already has a roomId (existing conversation), navigate directly
      if (recipientUser.roomId) {
        navigation.replace('ChatRoom', {
          roomId: recipientUser.roomId,
          roomName: `${recipientUser.firstName} ${recipientUser.lastName}`,
          roomType: 'private',
        });
        return;
      }

      // Otherwise, create a new chat room
      const response = await ApiService.createChatRoom({
        type: 'private',
        recipientId: recipientUser.id,
      });

      if (response.success) {
        // Navigate to the chat room
        navigation.replace('ChatRoom', {
          roomId: response.data.id,
          roomName: `${recipientUser.firstName} ${recipientUser.lastName}`,
          roomType: 'private',
        });
      } else {
        Alert.alert('Error', 'Failed to create chat');
      }
    } catch (error) {
      console.error('Failed to create private chat:', error);
      Alert.alert('Error', 'Failed to create chat');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteContact = async (contactUser) => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete your conversation with ${contactUser.firstName} ${contactUser.lastName}?`,
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
              if (contactUser.roomId) {
                const response = await ApiService.deleteChatRoom(contactUser.roomId);
                if (response.success) {
                  Alert.alert('Success', 'Contact deleted successfully');
                  await loadUsers(); // Refresh the list
                } else {
                  Alert.alert('Error', response.error || 'Failed to delete contact');
                }
              } else {
                Alert.alert('Error', 'No conversation found to delete');
              }
            } catch (error) {
              console.error('Failed to delete contact:', error);
              Alert.alert('Error', 'Failed to delete contact');
            }
          },
        },
      ]
    );
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.userItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => createPrivateChat(item)}
      onLongPress={() => handleDeleteContact(item)}
      disabled={creating}
    >
      <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
        <Text style={[styles.avatarText, { color: colors.surface }]}>
          {item.firstName.charAt(0)}{item.lastName?.charAt(0) || ''}
        </Text>
      </View>

      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: colors.text }]}>
          {item.firstName} {item.lastName}
        </Text>
        <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
          {item.email}
        </Text>
        {item.lastChatAt && (
          <Text style={[styles.lastChatTime, { color: colors.textTertiary }]}>
            Last chat: {new Date(item.lastChatAt).toLocaleDateString()}
          </Text>
        )}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={() => createPrivateChat(item)}
          disabled={creating}
        >
          <Ionicons name="chatbubble-outline" size={20} color={colors.white} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.error }]}
          onPress={() => handleDeleteContact(item)}
          disabled={creating}
        >
          <Ionicons name="trash-outline" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading users...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search users..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Users List */}
      <FlatList
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {searchQuery ? 'No contacts found' : 'No conversation history'}
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
              Start a new conversation to see contacts here
            </Text>
          </View>
        }
      />

      {creating && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Creating chat...
          </Text>
        </View>
      )}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  lastChatTime: {
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '600',
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
