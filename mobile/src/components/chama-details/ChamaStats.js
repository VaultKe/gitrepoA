import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const ChamaStats = ({ statistics, chama, members, polls, formatCurrency, colors }) => {
  const financialStats = statistics?.financial_stats || {};
  const memberStats = statistics?.member_stats || {};
  const activityStats = statistics?.activity_stats || {};
  const chamaInfo = statistics?.chama_info || {};
  const walletBalance = chamaInfo.wallet_balance || chamaInfo.total_funds || chama?.total_funds || 0;
  const totalMembers = memberStats.active_members || memberStats.total_members || chamaInfo.current_members || members.length || 0;
  const maxMembers = chama?.max_members || chamaInfo.max_members || 50;
  const totalMeetings = activityStats.total_meetings || 0;
  const contributionAmount = chama?.contribution_amount || 0;
  const contributionFrequency = chama?.contribution_frequency || 'Monthly';
  const totalContributions = financialStats.total_contributions || 0;
  const activePolls = polls.length || 0;

  return (
    <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs }} variant="outlined">
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Chama Statistics
      </Text>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Ionicons name="people" size={24} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {totalMembers}/{maxMembers}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Members
          </Text>
        </View>

        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Ionicons name="wallet" size={24} color={colors.secondary} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatCurrency(walletBalance)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Total Balance
          </Text>
        </View>

        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Ionicons name="trending-up" size={24} color={colors.success} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatCurrency(contributionAmount)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {contributionFrequency} Contribution
          </Text>
        </View>

        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Ionicons name="cash" size={24} color={colors.warning} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {totalContributions}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Total Accounts
          </Text>
        </View>

        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Ionicons name="calendar-outline" size={24} color={colors.info} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {totalMeetings}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Total Meetings
          </Text>
        </View>

        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {activePolls}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Active Polls
          </Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
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

export default ChamaStats;
