import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { spacing, typography } from '../../utils/theme';
import { formatCurrency, isMemberLeft, getMemberName } from '../../utils/merryGoRoundHelpers';

const { width } = Dimensions.get('window');

const MerryGoRoundContributorsTable = ({
  colors,
  selectedRound,
  roundContributions,
  contributorFilter,
  setContributorFilter,
  contributorSearch,
  setContributorSearch,
  selectedRecipientPosition,
  setSelectedRecipientPosition,
  isMemberLeft,
  getMemberName,
  getRowData,
  getPayoutDate,
  formatCurrency,
}) => {
  const target = useMemo(() => {
    if (!selectedRound) return null;
    const participants = selectedRound.members || selectedRound.participants || [];
    const currentParticipant = participants.find(p => (p.status || 'pending') === 'current');
    const currentPosition = currentParticipant ? participants.indexOf(currentParticipant) + 1 : (selectedRound.current_position || selectedRound.currentRound || 1);

    const position = selectedRecipientPosition || currentPosition;
    const targetParticipant = participants[position - 1];
    const recipientMember = targetParticipant ? (targetParticipant.user || targetParticipant) : null;
    const recipientId = recipientMember ? (targetParticipant.user_id || (targetParticipant.user && targetParticipant.user.id)) : null;

    return {
      position,
      recipientId,
      recipientName: recipientMember ? getMemberName(recipientMember) : '',
      isRecipientView: selectedRecipientPosition !== null,
    };
  }, [selectedRound, selectedRecipientPosition]);

  const isRecipientView = !!(target && target.isRecipientView);
  const amountPerRound = selectedRound ? (selectedRound.amount_per_round || selectedRound.amountPerRound || 0) : 0;

  let rows = getRowData();

  if (contributorFilter === 'contributed') rows = rows.filter(r => r.contributed);
  if (contributorFilter === 'paid_to_current') rows = rows.filter(r => r.paidToRecipient);
  if (contributorFilter === 'pending') rows = rows.filter(r => !r.contributed);
  if (contributorSearch.trim()) {
    const q = contributorSearch.toLowerCase();
    rows = rows.filter(r => r.name.toLowerCase().includes(q));
  }

  const totalContributed = rows.filter(r => r.contributed).length;
  const totalAmount = rows.filter(r => r.contributed).reduce((sum, r) => sum + r.amount, 0);
  const totalPaidToRecipient = rows.filter(r => r.paidToRecipient).length;
  const totalPaidToRecipientAmount = rows.filter(r => r.paidToRecipient).reduce((sum, r) => sum + (isRecipientView ? amountPerRound : r.amount), 0);

  const getFilterSummary = () => {
    if (isRecipientView) {
      if (contributorFilter === 'paid_to_current') return `${totalPaidToRecipient} paid to ${target.recipientName} • ${formatCurrency(totalPaidToRecipientAmount)}`;
      if (contributorFilter === 'pending') return `${rows.length} yet to pay ${target.recipientName}`;
      return `${totalPaidToRecipient} of ${rows.length} paid ${target.recipientName} • ${formatCurrency(totalPaidToRecipientAmount)}`;
    }
    if (contributorFilter === 'all') return `${totalContributed} paid • ${formatCurrency(totalAmount)} raised`;
    if (contributorFilter === 'contributed') return `${totalContributed} paid • ${formatCurrency(totalAmount)} raised`;
    if (contributorFilter === 'paid_to_current') return `${totalPaidToRecipient} paid to current recipient • ${formatCurrency(totalPaidToRecipientAmount)}`;
    if (contributorFilter === 'pending') return `${rows.length} pending payments`;
    return `${totalContributed} paid • ${formatCurrency(totalAmount)} raised`;
  };

  const showBanner = isRecipientView || contributorFilter === 'paid_to_current';

  return (
    <Card variant="outlined" style={styles.statsCard}>
      <View style={styles.tableSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: width - 32 }}>
            {showBanner && (
              <View style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.success + '12', borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: typography.fontSize.sm, color: colors.success, fontWeight: 'medium', flex: 1 }}>
                  {isRecipientView
                    ? `Showing who has paid ${target.recipientName} (Position ${target.position})`
                    : 'Showing members who have paid to the current recipient'}
                </Text>
                {isRecipientView && (
                  <TouchableOpacity onPress={() => { setSelectedRecipientPosition(null); setContributorFilter('all'); }}>
                    <Ionicons name="close-circle" size={18} color={colors.success} />
                  </TouchableOpacity>
                )}
              </View>
            )}
            <View style={[styles.tableHeaderRow, { backgroundColor: colors.primary + '10', borderBottomColor: colors.primary }]}>
              <Text style={[styles.tableHeaderText, { color: colors.primary, textAlign: 'center' }, { flex: 0.8 }]}>#</Text>
              <Text style={[styles.tableHeaderText, { color: colors.primary }, { flex: 2.5 }]}>Member</Text>
              <Text style={[styles.tableHeaderText, { color: colors.primary, textAlign: 'center' }, { flex: 1.8 }]}>Status</Text>
              <Text style={[styles.tableHeaderText, { color: colors.primary, textAlign: 'right' }, { flex: 1.2 }]}>Amount</Text>
              <Text style={[styles.tableHeaderText, { color: colors.primary, textAlign: 'right' }, { flex: 2 }]}>Recipient</Text>
              <Text style={[styles.tableHeaderText, { color: colors.primary, textAlign: 'right' }, { flex: 1.5 }]}>Payout Date</Text>
              <Text style={[styles.tableHeaderText, { color: colors.primary, textAlign: 'right' }, { flex: 1 }]}>Receive</Text>
            </View>
            {rows.map(row => {
              const paidStatus = isRecipientView ? row.paidToRecipient : row.contributed;
              const statusAmount = isRecipientView ? (row.paidToRecipient ? amountPerRound : 0) : row.amount;
              return (
                <View key={row.id} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { color: colors.text, textAlign: 'center', flex: 0.8 }]}>{row.position}</Text>
                  <Text style={[
                    styles.tableCell,
                    { color: row.memberLeft ? colors.error : colors.text, flex: 2.5 },
                    row.memberLeft && { textDecorationLine: 'line-through' }
                  ]} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <View style={[
                    styles.statusBadgeCell,
                    { backgroundColor: row.memberLeft ? colors.error + '20' : paidStatus ? colors.success + '20' : colors.warning + '20', flex: 1.8 }
                  ]}>
                    <Ionicons
                      name={row.memberLeft ? 'close-circle' : (paidStatus ? 'checkmark-circle' : 'time')}
                      size={10}
                      color={row.memberLeft ? colors.error : (paidStatus ? colors.success : colors.warning)}
                    />
                    <Text style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: row.memberLeft ? colors.error : (paidStatus ? colors.success : colors.warning),
                    }}>
                      {row.memberLeft ? 'Left' : (paidStatus ? 'Paid' : 'Pending')}
                    </Text>
                  </View>
                  <Text style={[styles.tableCell, { color: colors.text, textAlign: 'right', flex: 1.2 }]}>{formatCurrency(statusAmount)}</Text>
                  <Text style={[styles.tableCell, { color: colors.textSecondary, textAlign: 'right', flex: 2 }]} numberOfLines={1}>{row.recipientDisplay || '-'}</Text>
                  <Text style={[styles.tableCell, { color: colors.textSecondary, textAlign: 'right', flex: 1.5 }]}>{getPayoutDate(row)}</Text>
                  <Text style={[styles.tableCell, { color: row.hasBeenPaidOut ? colors.success : row.eligibleToContributeToAll ? colors.warning : colors.textTertiary, textAlign: 'right', flex: 1 }]}>
                    {row.hasBeenPaidOut ? 'Yes' : row.eligibleToContributeToAll ? 'Eligible' : 'Partial'}
                  </Text>
                </View>
              );
            })}
            {!rows.length && (
              <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary }}>No members match this filter.</Text>
              </View>
            )}
          </View>
        </ScrollView>
        <View style={[styles.tableFooter, { borderTopColor: colors.border }]}>
          <Text style={[styles.tableFooterText, { color: colors.textSecondary }]}>
            {getFilterSummary()}
          </Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  statsCard: { marginHorizontal: spacing.md, marginVertical: spacing.xs, borderRadius: 8, overflow: 'hidden' },
  tableSection: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 8 },
  tableHeaderRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 2, alignItems: 'center' },
  tableHeaderText: { flex: 1, fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  tableCell: { flex: 1, fontSize: 12 },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 0, 0, 0.05)', alignItems: 'center' },
  statusBadgeCell: { flex: 1, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  tableFooter: { paddingVertical: 8, paddingHorizontal: 12, borderTopWidth: 1 },
  tableFooterText: { fontSize: 12, fontWeight: '500' },
});

export default MerryGoRoundContributorsTable;
