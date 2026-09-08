import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import OTPVerificationModal from '../../../components/common/OTPVerificationModal';
import ApiService from '../../../services/api';
import {
  initiateMerryGoRoundDisbursement,
  confirmMerryGoRoundDisbursement,
} from '../../../services/api/chamaEndpoints';

const STATE_META = {
  ready: { label: 'Ready to disburse', icon: 'cash-outline' },
  awaiting_confirmation: { label: 'Awaiting chairperson', icon: 'hourglass-outline' },
  processing: { label: 'Sending to M-Pesa…', icon: 'sync-outline' },
  disbursed: { label: 'Disbursed', icon: 'checkmark-circle-outline' },
  failed: { label: 'Payout failed', icon: 'alert-circle-outline' },
  collecting: { label: 'Collecting contributions', icon: 'time-outline' },
  upcoming: { label: 'Upcoming', icon: 'ellipse-outline' },
};

const MaryGoRoundDetails = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const { record: initialRecord, chamaId } = route?.params || {};
  const chama = chamaId || currentChamaId;

  const [record, setRecord] = useState(initialRecord || null);
  const [userRole, setUserRole] = useState('member');
  const [working, setWorking] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (user?.id) {
        try {
          const r = await ApiService.getMemberRole(chama, user.id);
          if (r.success) setUserRole(r.data?.role || 'member');
        } catch {
          setUserRole('member');
        }
      }
    })();
  }, [chama, user?.id]);

  const role = (userRole || '').toLowerCase();
  const state = record?.state;
  const canInitiate = role === 'treasurer' && state === 'ready';
  const canConfirm = role === 'chairperson' && state === 'awaiting_confirmation';

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return 'KES 0';
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (d) => {
    if (!d) return '—';
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '—';
    }
  };

  const handleInitiate = async () => {
    if (working) return;
    setWorking(true);
    try {
      const res = await initiateMerryGoRoundDisbursement(chama, record.merryGoRoundId, {
        recipientId: record.recipientId || '',
      });
      if (res.success) {
        const d = res.data || {};
        Alert.alert(
          'Sent for approval',
          `KES ${Number(d.amount || 0).toLocaleString()} is ready for ${d.recipientName || 'the recipient'}. ` +
          `A confirmation code has been e-mailed to the chairperson${d.approver?.email ? ` (${d.approver.email})` : ''}. ` +
          `The payout is sent to their M-Pesa as soon as the chairperson confirms.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Cannot initiate', res.error || 'Failed to initiate disbursement.');
      }
    } catch {
      Alert.alert('Error', 'Failed to initiate disbursement. Please try again.');
    } finally {
      setWorking(false);
    }
  };

  const handleConfirm = async (code) => {
    setOtpLoading(true);
    try {
      const res = await confirmMerryGoRoundDisbursement(chama, record.merryGoRoundId, (code || '').trim());
      if (res.success) {
        const d = res.data || {};
        setShowOTPModal(false);
        Alert.alert(
          'Disbursement confirmed',
          `KES ${Number(d.amount || 0).toLocaleString()} is being sent to ${d.recipientName || 'the recipient'}'s M-Pesa now. ` +
          `The M-Pesa code will be recorded against this payout once Safaricom confirms it.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Could not confirm', res.error || 'Failed to confirm the disbursement.');
      }
    } catch {
      Alert.alert('Error', 'Failed to confirm the disbursement. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  if (!record) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorState}>
          <Ionicons name="refresh-circle-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Record not found</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} style={{ marginTop: spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  const meta = STATE_META[state] || STATE_META.upcoming;
  const shownAmount = record.state === 'disbursed' || record.state === 'processing'
    ? (record.amount || record.collected)
    : record.collected;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={styles.headerContent}>
            <View style={[styles.cycleIcon, { backgroundColor: colors.info + '1A' }]}>
              <Ionicons name={meta.icon} size={30} color={colors.info} />
            </View>
            <View style={styles.cycleInfo}>
              <Text style={[styles.cycleTitle, { color: colors.text }]}>
                {record.recipientName || 'Recipient'}
              </Text>
              <Text style={[styles.cycleRecipient, { color: colors.textSecondary }]}>
                {record.name || 'Merry-go-round'} · Round {record.roundNumber}
              </Text>
            </View>
          </View>
        </View>

        {/* Amount */}
        <Card variant="outlined" style={styles.amountCard}>
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
            {record.state === 'disbursed' ? 'Amount disbursed' : 'Collected for this round'}
          </Text>
          <Text style={[styles.amountValue, { color: colors.primary }]}>
            {formatCurrency(shownAmount)}
          </Text>
          <Text style={[styles.expectedDate, { color: colors.textSecondary }]}>
            {meta.label}
          </Text>
        </Card>

        {/* Details */}
        <Card variant="outlined" style={styles.detailsCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Record</Text>

          <Row label="Status" colors={colors} value={meta.label} />
          <Row label="Recipient" colors={colors} value={record.recipientName || '—'} />
          <Row label="Round" colors={colors} value={String(record.roundNumber)} />
          <Row label="Collected" colors={colors} value={formatCurrency(record.collected)} />
          {record.expectedAmount ? (
            <Row label="Expected (full pot)" colors={colors} value={`~${formatCurrency(record.expectedAmount)}`} />
          ) : null}
          <Row label="Disbursed on" colors={colors} value={formatDate(record.disbursedAt)} />
          {record.mpesaCode ? (
            <Row label="M-Pesa code" colors={colors} value={record.mpesaCode} />
          ) : null}
          {record.transactionStatus ? (
            <Row label="Payment status" colors={colors} value={record.transactionStatus} />
          ) : null}
        </Card>

        {/* Single contextual action */}
        <View style={styles.actions}>
          {canInitiate && (
            <Button
              title={working ? 'Sending…' : 'Initiate Disbursement'}
              onPress={handleInitiate}
              disabled={working}
              style={{ backgroundColor: colors.primary }}
              icon={<Ionicons name="cash" size={16} color={colors.white} />}
            />
          )}
          {canConfirm && (
            <Button
              title="Confirm Disbursement"
              onPress={() => setShowOTPModal(true)}
              style={{ backgroundColor: colors.primary }}
              icon={<Ionicons name="shield-checkmark" size={16} color={colors.white} />}
            />
          )}
          {!canInitiate && !canConfirm && (
            <Text style={[styles.note, { color: colors.textSecondary }]}>
              {state === 'awaiting_confirmation'
                ? 'Waiting for the chairperson to confirm with the code e-mailed to them.'
                : state === 'ready'
                ? 'Waiting for the treasurer to initiate this payout.'
                : state === 'collecting'
                ? 'Members are still contributing for this round.'
                : 'No action needed on this record.'}
            </Text>
          )}
        </View>

        <OTPVerificationModal
          visible={showOTPModal}
          onClose={() => setShowOTPModal(false)}
          title="Confirm Disbursement"
          subtitle={`Enter the code e-mailed to you to send KES ${Number(record.collected || 0).toLocaleString()} to ${record.recipientName || 'the recipient'}'s M-Pesa now.`}
          onVerify={handleConfirm}
          onResend={() => Alert.alert('Ask the treasurer', 'The code is issued when the treasurer initiates the payout. If it expired, ask the treasurer to initiate it again.')}
          loading={otpLoading}
          itemType="merry-go-round"
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const Row = ({ label, value, colors }) => (
  <View style={styles.detailRow}>
    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
    <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1, padding: spacing.md },
  header: { borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm },
  headerContent: { flexDirection: 'row', alignItems: 'center' },
  cycleIcon: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.lg,
  },
  cycleInfo: { flex: 1 },
  cycleTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.xs },
  cycleRecipient: { fontSize: typography.fontSize.sm },
  amountCard: { padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md, ...shadows.sm },
  amountLabel: { fontSize: typography.fontSize.sm, marginBottom: spacing.xs },
  amountValue: { fontSize: typography.fontSize.xxxl, fontWeight: typography.fontWeight.bold, marginBottom: spacing.xs },
  expectedDate: { fontSize: typography.fontSize.xs },
  detailsCard: { padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm },
  sectionTitle: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.lg },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  detailLabel: { fontSize: typography.fontSize.sm },
  detailValue: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, flexShrink: 1, marginLeft: spacing.md },
  actions: { marginBottom: spacing.xxxl, marginTop: spacing.sm },
  note: { fontSize: typography.fontSize.sm, textAlign: 'center', paddingHorizontal: spacing.md },
  errorState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  errorTitle: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, marginTop: spacing.lg },
});

export default MaryGoRoundDetails;
