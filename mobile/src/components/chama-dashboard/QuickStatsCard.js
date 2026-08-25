import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import Card from '../common/Card';

const QuickStatsCard = ({ selectedChama, realTimeData, getUserRole, formatCurrency }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  if (!selectedChama) return null;

  const walletLabel = selectedChama?.category === 'contribution' ? 'Group Wallet' : 'Chama Wallet';

  return (
    <Card style={styles.statsCard} variant="outlined">
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {selectedChama.name} Overview
      </Text>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Ionicons name="wallet" size={24} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatCurrency(realTimeData.walletBalance)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {walletLabel}
          </Text>
        </View>

        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Ionicons name="people" size={24} color={colors.secondary} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {realTimeData.totalMembers}/{selectedChama.max_members || 50}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Members
          </Text>
        </View>

        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Ionicons name="calendar" size={24} color={colors.warning} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {realTimeData.totalMeetings || 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Meetings
          </Text>
        </View>

        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Ionicons name="trending-up" size={24} color={colors.success} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {realTimeData.contributionCount || 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Contributions
          </Text>
        </View>

        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Ionicons name="shield-checkmark" size={24} color={colors.info} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {getUserRole(selectedChama)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Your Role
          </Text>
        </View>

        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Ionicons name="swap-horizontal" size={24} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {realTimeData.userTransactionCount || 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Your Transactions
          </Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  statsCard: {
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

export default QuickStatsCard;
