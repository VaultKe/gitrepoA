import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SelectedUsersList = ({ selectedUsers, userRoles, availableRoles, selectedRole, onRemoveUser, onCycleRole, colors }) => {
  if (selectedUsers.length === 0) {
    return null;
  }

  return (
    <View style={styles.selectedUsers}>
      <Text style={[styles.selectedUsersTitle, { color: colors.text }]}>
        Selected Users ({selectedUsers.length})
      </Text>
      {selectedUsers.map((user) => {
        const userRole = userRoles[user.id] || selectedRole;
        const roleInfo = availableRoles.find(r => r.id === userRole);

        return (
          <View
            key={user.id}
            style={[styles.selectedUserItem, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}
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
              <View style={styles.userRoleContainer}>
                <Ionicons name={roleInfo.icon} size={14} color={colors.primary} />
                <Text style={[styles.userRoleText, { color: colors.primary }]}>
                  {roleInfo.name}
                </Text>
              </View>
            </View>

            <View style={styles.userActions}>
              <TouchableOpacity
                style={[styles.roleChangeButton, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}
                onPress={() => {
                  const currentIndex = availableRoles.findIndex(r => r.id === userRole);
                  const nextIndex = (currentIndex + 1) % availableRoles.length;
                  onCycleRole(user.id, availableRoles[nextIndex].id);
                }}
              >
                <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onRemoveUser(user.id)}
                style={styles.removeButton}
              >
                <Ionicons name="close-circle" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = {
  selectedUsers: {
    marginTop: 20,
  },
  selectedUsersTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  selectedUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
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
  userRoleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  userRoleText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleChangeButton: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  removeButton: {
    padding: 4,
  },
};

export default SelectedUsersList;
