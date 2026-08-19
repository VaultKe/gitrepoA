import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import MerryGoRoundStatTile from './MerryGoRoundStatTile';
import { spacing, typography } from '../../utils/theme';
import { isMemberLeft, getMemberShortName } from '../../utils/merryGoRoundHelpers';

const MerryGoRoundCompactTop = ({
  colors,
  selectedRound,
  isMemberLeft,
  getMemberShortName,
  onRefresh,
  loadMerryGoRounds,
  loadRoundContributions,
  selectedRoundRef,
}) => {
  if (!selectedRound) return null;
  const participants = selectedRound.members || selectedRound.participants || [];
  const amountPerRound = selectedRound.amount_per_round || selectedRound.amountPerRound || 0;
  const totalPayoutPerPerson = amountPerRound * participants.length;

  const currentParticipant = participants.find(p => (p.status || 'pending') === 'current');
  const currentMember = currentParticipant ? (currentParticipant.user || currentParticipant) : participants[0];
  const currentMemberLeft = currentParticipant ? isMemberLeft(currentParticipant) : false;

  return (
    <Card style={styles.statsCard} variant="outlined">
      <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <Text style={{ fontSize: typography.fontSize.lg, fontWeight: 'semibold', color: colors.text, flex: 1 }}>
            {selectedRound.name} Overview
          </Text>
          <TouchableOpacity
            onPress={async () => {
              await loadMerryGoRounds();
              if (selectedRoundRef.current) {
                await loadRoundContributions();
              }
            }}
            style={{ padding: spacing.xs }}
          >
            <Ionicons name="refresh" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
          <MerryGoRoundStatTile icon="cash" label="Amount Per Period" value={formatCurrency(amountPerRound)} color={colors.primary} colors={colors} />
          <MerryGoRoundStatTile icon="people" label="Members" value={participants.length} color={colors.secondary} colors={colors} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <MerryGoRoundStatTile icon="wallet" label="Total Payout" value={formatCurrency(totalPayoutPerPerson)} color={colors.success} colors={colors} />
          <MerryGoRoundStatTile
            icon="person"
            label="Current Recipient"
            value={getMemberShortName(currentMember)}
            color={currentMemberLeft ? colors.error : colors.warning}
            subtext={currentMemberLeft ? 'Left' : undefined}
            textColor={currentMemberLeft ? colors.error : colors.text}
            crossedOut={currentMemberLeft}
            colors={colors}
          />
        </View>
      </View>
    </Card>
  );
};

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return 'KES 0';
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);
};

const styles = StyleSheet.create({
  statsCard: { marginHorizontal: spacing.md, marginVertical: spacing.xs },
});

export default MerryGoRoundCompactTop;
