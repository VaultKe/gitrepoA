import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const UserSearchResults = ({ searchResults, searchLoading, onSelectUser, colors }) => {
  if (searchResults.length === 0 && !searchLoading) {
    return null;
  }

  return (
    <View style={styles.searchResults}>
      <Text style={[styles.searchResultsTitle, { color: colors.text }]}>
        Search Results
      </Text>
      {searchResults.slice(0, 5).map((user) => (
        <TouchableOpacity
          key={user.id}
          style={[styles.userSearchItem, { borderBottomColor: colors.border }]}
          onPress={() => onSelectUser(user)}
        >
          <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.userAvatarText}>
              {user.firstName?.[0]?.toUpperCase()}{user.lastName?.[0]?.toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>
              {user.firstName} {user.lastName}
            </Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
              {user.email}
            </Text>
            {user.phone && (
              <Text style={[styles.userPhone, { color: colors.textSecondary }]}>
                {user.phone}
              </Text>
            )}
          </View>
          <Ionicons name="add-circle" size={24} color={colors.primary} />
        </TouchableOpacity>
      ))}
      {searchResults.length > 5 && (
        <Text style={[styles.moreResultsText, { color: colors.textSecondary }]}>
          +{searchResults.length - 5} more results. Refine your search.
        </Text>
      )}
    </View>
  );
};

const styles = {
  searchResults: {
    marginTop: 16,
  },
  searchResultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  userSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 12,
  },
  moreResultsText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
};

export default UserSearchResults;
