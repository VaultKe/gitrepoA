import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, typography, spacing, shadows } from '../../utils/theme';
import ApiService from '../../services/api';

const UserSearchScreen = ({ navigation }) => {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadAllUsers();
  }, []);

  const loadAllUsers = async () => {
    try {
      setLoading(true);
      const response = await ApiService.makeRequest('/users/');

      if (response.success && response.data) {
        // Filter out current user
        const otherUsers = response.data.filter(u => u.id !== user?.id);
        setUsers(otherUsers);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query) => {
    if (!query.trim()) {
      loadAllUsers();
      return;
    }

    try {
      setSearching(true);
      const response = await ApiService.makeRequest(`/users/?search=${encodeURIComponent(query)}`);

      if (response.success && response.data) {
        // Filter out current user
        const otherUsers = response.data.filter(u => u.id !== user?.id);
        setUsers(otherUsers);
      }
    } catch (error) {
      console.error('Failed to search users:', error);
      // Filter locally if API search fails
      const filtered = users.filter(user =>
        user.firstName?.toLowerCase().includes(query.toLowerCase()) ||
        user.lastName?.toLowerCase().includes(query.toLowerCase()) ||
        user.email?.toLowerCase().includes(query.toLowerCase()) ||
        user.phone?.includes(query)
      );
      setUsers(filtered);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = (text) => {
    setSearchQuery(text);

    // Debounce search
    clearTimeout(searchUsers.timeout);
    searchUsers.timeout = setTimeout(() => {
      searchUsers(text);
    }, 500);
  };

  const startChat = async (selectedUser) => {
    try {
      setLoading(true);

      // Create or get existing private chat room
      const response = await ApiService.createChatRoom({
        type: 'private',
        recipientId: selectedUser.id,
      });

      if (response.success) {
        // Navigate to chat room
        navigation.navigate('ChatRoom', {
          roomId: response.data.id,
          roomName: `${selectedUser.firstName} ${selectedUser.lastName}`,
          roomType: 'private',
        });
      }
    } catch (error) {
      console.error('Failed to create chat:', error);
      Alert.alert('Error', 'Failed to start chat');
    } finally {
      setLoading(false);
    }
  };

  const renderUser = ({ item }) => (
    <TouchableOpacity
      style={[styles.userItem, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      onPress={() => startChat(item)}
    >
      <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
        <Text style={[styles.avatarText, { color: colors.primary }]}>
          {item.firstName?.[0]?.toUpperCase()}{item.lastName?.[0]?.toUpperCase()}
        </Text>
      </View>

      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: colors.text }]}>
          {item.firstName} {item.lastName}
        </Text>
        <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
          {item.email}
        </Text>
        {item.phone && (
          <Text style={[styles.userPhone, { color: colors.textTertiary }]}>
            {item.phone}
          </Text>
        )}
      </View>

      <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {/* <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity> */}

        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Search Users
        </Text>
      </View>

      {/* Search Input */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name, email, or phone..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
          />
          {searching && (
            <ActivityIndicator size="small" color={colors.primary} style={styles.searchLoader} />
          )}
        </View>
      </View>

      {/* Users List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading users...
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          style={styles.usersList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery ? 'No users found' : 'No users available'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = {
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    ...shadows.sm,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.md,
  },
  searchLoader: {
    marginLeft: spacing.sm,
  },
  usersList: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: typography.fontSize.sm,
    marginBottom: 2,
  },
  userPhone: {
    fontSize: typography.fontSize.xs,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
    textAlign: 'center',
  },
};

export default UserSearchScreen;
