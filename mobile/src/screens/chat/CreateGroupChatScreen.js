import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';
import ApiService from '../../services/api';

export default function CreateGroupChatScreen({ navigation }) {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const [chamas, setChamas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadChamas();
  }, []);

  const loadChamas = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getChamas();
      
      if (response.success) {
        setChamas(response.data || []);
      } else {
        // Use mock data if API fails
        const mockChamas = [
          {
            id: '1',
            name: 'Savings Group',
            description: 'Monthly savings and investment group',
            memberCount: 12,
            type: 'savings',
          },
          {
            id: '2',
            name: 'Business Network',
            description: 'Entrepreneurs and business owners',
            memberCount: 8,
            type: 'business',
          },
          {
            id: '3',
            name: 'Investment Club',
            description: 'Stock market and investment discussions',
            memberCount: 15,
            type: 'investment',
          },
        ];
        setChamas(mockChamas);
      }
    } catch (error) {
      console.error('Failed to load chamas:', error);
      // Use mock data as fallback
      const mockChamas = [
        {
          id: '1',
          name: 'Savings Group',
          description: 'Monthly savings and investment group',
          memberCount: 12,
          type: 'savings',
        },
      ];
      setChamas(mockChamas);
    } finally {
      setLoading(false);
    }
  };

  const createChamaChat = async (chama) => {
    try {
      setCreating(true);
      
      const response = await ApiService.createChatRoom({
        type: 'chama',
        chamaId: chama.id,
        name: `${chama.name} Chat`,
      });

      if (response.success) {
        // Navigate to the chat room
        navigation.replace('ChatRoom', {
          roomId: response.data.id,
          roomName: `${chama.name} Chat`,
          roomType: 'chama',
          chamaId: chama.id,
        });
      } else {
        Alert.alert('Error', 'Failed to create group chat');
      }
    } catch (error) {
      console.error('Failed to create chama chat:', error);
      Alert.alert('Error', 'Failed to create group chat');
    } finally {
      setCreating(false);
    }
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

  const renderChamaItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.chamaItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => createChamaChat(item)}
      disabled={creating}
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
        <Text style={[styles.chamaDescription, { color: colors.textSecondary }]}>
          {item.description}
        </Text>
        <Text style={[styles.memberCount, { color: colors.textTertiary }]}>
          {item.memberCount} members
        </Text>
      </View>
      
      <Ionicons 
        name="chatbubbles-outline" 
        size={24} 
        color={colors.primary} 
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading your chamas...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Create Group Chat
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Select a chama to create a group chat
        </Text>
      </View>

      {/* Chamas List */}
      <FlatList
        data={chamas}
        renderItem={renderChamaItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No chamas available
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
              Join a chama first to create group chats
            </Text>
          </View>
        }
      />

      {creating && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Creating group chat...
          </Text>
        </View>
      )}
    </View>
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
  chamaDescription: {
    fontSize: 14,
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 12,
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
