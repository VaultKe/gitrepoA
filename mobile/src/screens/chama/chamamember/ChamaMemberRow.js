import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../../services/api';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
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

  const isLeft = item.is_active === false || item.is_active === 0 || item.is_active === '0';

  const rowBackground = isLeft
    ? colors.error + '10'
    : index % 2 === 0
      ? colors.background
      : colors.surface;

  const nameColor = isLeft ? colors.error : colors.text;
  const iconColor = isLeft ? colors.error : colors.primary;
  const chatIconColor = isLeft ? colors.error : colors.secondary;

  const roleBadgeBg = isLeft
    ? colors.error + '20'
    : {
        chairperson: colors.warning + '20',
        treasurer: colors.warning + '20',
        secretary: colors.warning + '20',
        assistant: colors.secondary + '20',
      }[item.role] || colors.textSecondary + '20';

  const roleBadgeColor = isLeft
    ? colors.error
    : {
        chairperson: colors.warning,
        treasurer: colors.warning,
        secretary: colors.warning,
        assistant: colors.secondary,
      }[item.role] || colors.textSecondary;

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
    <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, backgroundColor: rowBackground, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' }}>
      <View style={{ flex: 1.5, justifyContent: 'center', paddingHorizontal: spacing.xs }}>
        <Text style={{ fontSize: 12, fontWeight: isLeft ? 'normal' : 'medium', color: nameColor, textDecorationLine: isLeft ? 'line-through' : 'none' }} numberOfLines={1}>{getMemberName(item)}</Text>
        {isLeft && (
          <Text style={{ fontSize: 10, color: colors.error, marginTop: 2, fontWeight: '600' }}>Left</Text>
        )}
      </View>

      <View style={{ flex: 1.5, minWidth: 76, alignItems: 'center', justifyContent: 'center' }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: spacing.xs }}
        >
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 4, borderRadius: borderRadius.sm, backgroundColor: roleBadgeBg }}
            onPress={() => onOpenRoleModal(item)}
          >
            <Ionicons
              name={getRoleIcon(item.role)}
              size={10}
              color={roleBadgeColor}
            />
            <Text style={{ fontSize: 12, fontWeight: 'medium', color: roleBadgeColor, marginLeft: spacing.xs, textDecorationLine: isLeft ? 'line-through' : 'none' }}>
              {formatRoleLabel(item.role)}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      <View style={{ flex: 1.5, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
        <TouchableOpacity
          style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: isLeft ? colors.error + '20' : colors.primary + '20', alignItems: 'center', justifyContent: 'center' }}
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
            color={iconColor}
          />
        </TouchableOpacity>

        {item.user_id !== currentUser?.id && (
          <TouchableOpacity
            style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: isLeft ? colors.error + '20' : colors.secondary + '20', alignItems: 'center', justifyContent: 'center' }}
            onPress={handleStartChat}
          >
            <Ionicons name="chatbubble" size={12} color={chatIconColor} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default ChamaMemberRow;
