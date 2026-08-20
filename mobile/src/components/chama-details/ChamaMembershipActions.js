import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography } from '../../utils/theme';

const ChamaMembershipActions = ({ userMembership, chama, colors, handleJoinChama, handleLeaveChama, switchToChamaDashboard }) => {
  if (!userMembership) {
    return (
      <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs }} variant="outlined">
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Join this chama to access membership options
        </Text>
      </Card>
    );
  }

  return (
    <View>
      <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs }} variant="outlined">
        <View style={styles.membershipInfo}>
          <Text style={[styles.membershipTitle, { color: colors.text }]}>
            Your Membership
          </Text>
          <Text style={[styles.membershipRole, { color: colors.primary }]}>
            {userMembership.role?.toUpperCase()}
          </Text>
          <Text style={[styles.membershipDate, { color: colors.textSecondary }]}>
            Joined {new Date(userMembership.joined_at).toLocaleDateString()}
          </Text>
        </View>
      </Card>

      <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs }} variant="outlined">
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
          onPress={switchToChamaDashboard}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionButtonText, { color: colors.primary }]}>
            Switch to Dashboard
          </Text>
        </TouchableOpacity>
      </Card>

      <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs }} variant="outlined">
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.error + '15', borderColor: colors.error }]}
          onPress={() => {
            Alert.alert(
              'Leave Chama',
              'Are you sure you want to leave this chama? You will lose access to all chama features.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Leave', style: 'destructive', onPress: handleLeaveChama },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionButtonText, { color: colors.error }]}>
            Leave Chama
          </Text>
        </TouchableOpacity>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  emptyText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  membershipInfo: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  membershipTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  membershipRole: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  membershipDate: {
    fontSize: typography.fontSize.sm,
  },
  actionButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
  },
  actionButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default ChamaMembershipActions;
