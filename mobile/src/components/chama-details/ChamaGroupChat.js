import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography } from '../../utils/theme';

const ChamaGroupChat = ({ userMembership, chama, colors, getExistingChatRoomId, getGroupLabel, handleCreateChatRoom, navigateToChatRoom, chatRoomLoading }) => {
  const existingChatRoomId = getExistingChatRoomId();
  const canCreateChatRoom = ['chairperson', 'treasurer', 'secretary'].includes(userMembership?.role?.toLowerCase());
  const groupLabel = getGroupLabel();

  return (
    <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs }} variant="outlined">
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Group Communication
      </Text>

      {!userMembership ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary, paddingVertical: spacing.md }]}>
          Join this {groupLabel.toLowerCase()} to access group chat.
        </Text>
      ) : (
        <View>
          {existingChatRoomId ? (
            <TouchableOpacity
              style={[styles.chatButton, { backgroundColor: colors.success + '15', borderColor: colors.success }]}
              onPress={navigateToChatRoom}
              activeOpacity={0.7}
            >
              <Text style={[styles.chatButtonText, { color: colors.success }]}>
                Open Group Chat
              </Text>
            </TouchableOpacity>
          ) : canCreateChatRoom ? (
            <TouchableOpacity
              style={[styles.chatButton, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
              onPress={handleCreateChatRoom}
              disabled={chatRoomLoading}
              activeOpacity={0.7}
            >
              {chatRoomLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.chatButtonText, { color: colors.primary }]}>
                  Create Chat Room
                </Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
  },
  chatButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  chatButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
});

export default ChamaGroupChat;
