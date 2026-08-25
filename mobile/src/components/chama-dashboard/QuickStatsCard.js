import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography } from '../../utils/theme';
import Card from '../common/Card';

const StatTile = ({ icon, label, value, color, colors }) => (
  <View style={{ flex: 1, marginHorizontal: spacing.xs, marginBottom: spacing.sm, height: 152 }}>
    <View style={{ padding: spacing.md, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, height: '100%' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, flex: 1 }}>{label}</Text>
      </View>
      <Text style={{ fontSize: typography.fontSize.lg, fontWeight: 'bold', color: colors.text }}>{value}</Text>
    </View>
  </View>
);

const QuickStatsCard = ({ selectedChama, realTimeData, getUserRole, formatCurrency }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  if (!selectedChama) return null;

  return (
    <Card style={styles.statsCard} variant="outlined">
      <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.md }}>
        <Text style={{ fontSize: typography.fontSize.lg, fontWeight: 'semibold', color: colors.text, marginBottom: spacing.md }}>
          {selectedChama.name} Overview
        </Text>
        <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
          <StatTile icon="wallet" label={selectedChama?.category === 'contribution' ? 'Group Wallet' : 'Chama Wallet'} value={formatCurrency(realTimeData.walletBalance)} color={colors.primary} colors={colors} />
          <StatTile icon="people" label="Members" value={`${realTimeData.totalMembers}/${selectedChama.max_members || 50}`} color={colors.secondary} colors={colors} />
        </View>
        <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
          <StatTile icon="calendar" label="Meetings" value={realTimeData.totalMeetings || 0} color={colors.warning} colors={colors} />
          <StatTile icon="trending-up" label="Contributions" value={realTimeData.contributionCount || 0} color={colors.success} colors={colors} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <StatTile icon="shield-checkmark" label="Your Role" value={getUserRole(selectedChama)} color={colors.info} colors={colors} />
          <StatTile icon="swap-horizontal" label="Your Transactions" value={realTimeData.userTransactionCount || 0} color={colors.primary} colors={colors} />
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  statsCard: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
});

export default QuickStatsCard;
