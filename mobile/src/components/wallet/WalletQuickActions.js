import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import Card from '../common/Card';

const WalletQuickActions = ({ onHistory, onAIAdvisor, colors }) => {
  return (
    <Card style={{ margin: spacing.sm }} variant="outlined">
      <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.md }, { color: colors.text }]}>
        Quick Actions
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <TouchableOpacity
          style={[{ flex: 1, alignItems: 'center', padding: spacing.lg, borderRadius: borderRadius.lg }, { backgroundColor: colors.primary + '20' }]}
          onPress={onHistory}
        >
          <Ionicons name="list" size={24} color={colors.primary} />
          <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginTop: spacing.sm }, { color: colors.primary }]}>
            History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[{ flex: 1, alignItems: 'center', padding: spacing.lg, borderRadius: borderRadius.lg }, { backgroundColor: colors.success + '20' }]}
          onPress={onAIAdvisor}
        >
          <Ionicons name="sparkles" size={24} color={colors.success} />
          <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginTop: spacing.sm }, { color: colors.success }]}>
            AI Advisor
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
};

export default WalletQuickActions;
