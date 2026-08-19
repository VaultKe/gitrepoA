import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius } from '../../utils/theme';

const UserSavingsBanner = ({ colors, userSavings, formatCurrency }) => {
  if (!userSavings) return null;

  return (
    <View style={{
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.success + '15',
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.success + '30',
    }}>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs }}>
        My Savings Balance
      </Text>
      <Text style={{ fontSize: 24, fontWeight: '700', color: colors.success }}>
        {formatCurrency(userSavings.balance || 0)}
      </Text>
    </View>
  );
};

export default UserSavingsBanner;
