import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../../services/api';
import { getThemeColors, spacing } from '../../../utils/theme';
import { formatRoleLabel, getMemberName, getRoleColor, getRoleIcon } from './chamaMembersUtils';

const ChamaMemberRow = ({
  item,
  index,
  navigation,
  chamaId,
  currentUser,
  userRole,
  onOpenRoleModal,
  theme,
}) => {
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);

  const handleStartChat = async () => {
    try {
      const recipientId = item.user_id;
      if (!recipientId) {
        Alert.alert('Error', 'Cannot start chat: User ID not found');
        return;
      }

      const response = await ApiService.createPrivateChat(recipientId);
      if (response.success) {
        const roomName = item.user?.first_name && item.user?.last_name
          ? `${item.user.first_name} ${item.user.last_name}`
          : 'Chat';

        navigation.navigate('ChatRoom', {
          roomId: response.data.id,
          roomName,
          roomType: 'private',
        });
      } else {
        Alert.alert('Error', response.error || 'Failed to create chat room');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start chat: ' + error.message);
    }
  };

  return (
    <View style={index % 2 === 0 ? styles.memberTableRowEven : styles.memberTableRowOdd}>
      <View style={styles.memberNameCell}>
        <Text style={styles.memberNameText}>{getMemberName(item)}</Text>
      </View>

      <View style={styles.roleCell}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.roleScrollContent}
        >
          <TouchableOpacity
            style={getMemberRoleBadgeStyle(item.role, styles)}
            onPress={() => onOpenRoleModal(item)}
          >
            <Ionicons
              name={getRoleIcon(item.role)}
              size={10}
              color={getRoleColor(item.role, colors)}
            />
            <Text style={getMemberRoleTextStyle(item.role, styles)}>
              {formatRoleLabel(item.role)}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.centeredCell}>
        <Text style={styles.memberTableText}>
          {item.attendance_rate?.toFixed(1) || 0}%
        </Text>
      </View>

      <View style={styles.reputationCell}>
        <Ionicons name="star" size={12} color={colors.warning} />
        <Text style={styles.memberTableText}>{item.reputation_score?.toFixed(1) || 0}</Text>
      </View>

      <View style={styles.actionCell}>
        <TouchableOpacity
          style={styles.iconButtonPrimary}
          onPress={() => {
            navigation.navigate('ViewMember', {
              memberId: item.user_id,
              chamaId,
              userRole,
            });
          }}
        >
          <Ionicons
            name={item.user_id === currentUser?.id ? 'person-circle' : 'person'}
            size={12}
            color={colors.primary}
          />
        </TouchableOpacity>

        {item.user_id !== currentUser?.id && (
          <TouchableOpacity
            style={styles.iconButtonSecondary}
            onPress={handleStartChat}
          >
            <Ionicons name="chatbubble" size={12} color={colors.secondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const getMemberRoleBadgeStyle = (role, styles) => {
  switch (role) {
    case 'chairperson':
    case 'treasurer':
    case 'secretary':
      return [styles.roleBadge, styles.roleBadgeWarning];
    case 'assistant':
      return [styles.roleBadge, styles.roleBadgeSecondary];
    default:
      return [styles.roleBadge, styles.roleBadgeMuted];
  }
};

const getMemberRoleTextStyle = (role, styles) => {
  switch (role) {
    case 'chairperson':
    case 'treasurer':
    case 'secretary':
      return [styles.roleText, styles.roleTextWarning];
    case 'assistant':
      return [styles.roleText, styles.roleTextSecondary];
    default:
      return [styles.roleText, styles.roleTextMuted];
  }
};

const createStyles = (colors) => StyleSheet.create({
  memberTableRowEven: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  memberTableRowOdd: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  memberNameCell: {
    flex: 3,
    justifyContent: 'center',
  },
  memberNameText: {
    fontSize: 8.5,
    fontWeight: 'medium',
    color: colors.text,
  },
  roleCell: {
    flex: 1.5,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleScrollContent: {
    paddingRight: spacing.xs,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleBadgeWarning: {
    backgroundColor: colors.warning + '20',
  },
  roleBadgeSecondary: {
    backgroundColor: colors.secondary + '20',
  },
  roleBadgeMuted: {
    backgroundColor: colors.textSecondary + '20',
  },
  roleText: {
    fontSize: 8.5,
    fontWeight: 'medium',
    marginLeft: spacing.xs,
  },
  roleTextWarning: {
    color: colors.warning,
  },
  roleTextSecondary: {
    color: colors.secondary,
  },
  roleTextMuted: {
    color: colors.textSecondary,
  },
  centeredCell: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberTableText: {
    fontSize: 8.5,
    fontWeight: 'medium',
    color: colors.text,
  },
  reputationCell: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  actionCell: {
    flex: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  iconButtonPrimary: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSecondary: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.secondary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChamaMemberRow;
