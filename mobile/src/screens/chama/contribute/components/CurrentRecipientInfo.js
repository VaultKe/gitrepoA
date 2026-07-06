import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../../utils/theme';
import Card from '../../../../components/common/Card';

const CurrentRecipientInfo = ({ 
  currentRecipient, 
  contributionStatus, 
  formatCurrency 
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  return (
    <Card style={[styles.chamaInfoCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]} variant="outlined">
      <View style={styles.recipientInfo}>
        <View style={[styles.recipientIcon, { backgroundColor: colors.primary }]}>
          <Ionicons name="person" size={20} color={colors.white} />
        </View>
        <View style={styles.recipientDetails}>
          <Text style={[styles.recipientLabel, { color: colors.textSecondary }]}>
            Contributing to:
          </Text>
          <Text style={[styles.recipientName, { color: colors.primary }]}>
            {currentRecipient.fullName}
          </Text>
          <Text style={[styles.recipientPosition, { color: colors.textSecondary }]}>
            Position {currentRecipient.position} • Round {currentRecipient.position}
          </Text>
        </View>
      </View>

      {contributionStatus && (
        <View style={styles.statusContainer}>
          <View style={[
            styles.contributionStatusBanner,
            {
              backgroundColor: contributionStatus.hasContributed
                ? colors.success + '20'
                : colors.warning + '20',
              borderColor: contributionStatus.hasContributed
                ? colors.success
                : colors.warning
            }
          ]}>
            <View style={styles.statusBannerContent}>
              <Ionicons
                name={contributionStatus.hasContributed ? "checkmark-circle" : "radio-button-off"}
                size={24}
                color={contributionStatus.hasContributed ? colors.success : colors.warning}
              />
              <View style={styles.statusBannerText}>
                <Text style={[
                  styles.statusBannerTitle,
                  { color: contributionStatus.hasContributed ? colors.success : colors.warning }
                ]}>
                  {contributionStatus.hasContributed ? "You already Contributed.No need to!" : "You Haven't Contributed Yet"}
                </Text>
                <Text style={[styles.statusBannerSubtitle, { color: colors.textSecondary }]}>
                  {contributionStatus.hasContributed
                    ? `You successfully contributed ${formatCurrency(contributionStatus.amountPerRound || 0)} to this round`
                    : `You need to contribute exactly ${formatCurrency(contributionStatus.amountPerRound || 0)} to participate in this round`
                  }
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
              Round Progress:
            </Text>
            <View style={styles.progressContainer}>
              <Text style={[styles.progressText, { color: colors.text }]}>
                {contributionStatus.contributionStats?.totalContributions || 0}/{contributionStatus.contributionStats?.totalParticipants || 0} members
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${contributionStatus.contributionStats?.progressPercentage || 0}%`,
                      backgroundColor: contributionStatus.contributionStats?.progressPercentage === 100 ? colors.success : colors.primary
                    }
                  ]}
                />
              </View>
            </View>
          </View>

          {contributionStatus.roundComplete && (
            <View style={[styles.roundCompleteNotice, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
              <Ionicons name="trophy" size={16} color={colors.success} />
              <Text style={[styles.roundCompleteText, { color: colors.success }]}>
                🎉 Round Complete! The merry-go-round will advance to the next member automatically.
              </Text>
            </View>
          )}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  chamaInfoCard: {
    margin: spacing.md,
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipientIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  recipientDetails: {
    flex: 1,
  },
  recipientLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  recipientName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  recipientPosition: {
    fontSize: typography.fontSize.sm,
  },
  statusContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statusLabel: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  progressContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  progressText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    width: 80,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  roundCompleteNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  roundCompleteText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
    flex: 1,
  },
  contributionStatusBanner: {
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statusBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBannerText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  statusBannerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  statusBannerSubtitle: {
    fontSize: typography.fontSize.sm,
    lineHeight: 16,
  },
});

export default CurrentRecipientInfo;