import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
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
import { sendApprovalNotification, showInAppToast } from '../../../services/disbursementNotificationService';
import { approveWelfareDisbursement } from '../../../services/api/welfareEndpoints';

const MaryGoRoundDetails = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const { cycleId, chamaId } = route?.params || {};

  const [cycle, setCycle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cycleHistory, setCycleHistory] = useState([]);
  const [userRole, setUserRole] = useState('member');

  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [selectedApprovalItem, setSelectedApprovalItem] = useState(null);
  const [approvalActionType, setApprovalActionType] = useState(null);

  useEffect(() => {
    if (cycleId) {
      loadCycleDetails();
    }
  }, [cycleId]);

  const loadCycleDetails = async () => {
    try {
      setLoading(true);

      if (user?.id) {
        try {
          const roleResponse = await ApiService.getMemberRole(chamaId || currentChamaId, user.id);
          if (roleResponse.success) {
            setUserRole(roleResponse.data?.role || 'member');
          }
        } catch {
          setUserRole('member');
        }
      }

      const cyclesResponse = await ApiService.getMerryGoRounds(chamaId || currentChamaId);
      if (cyclesResponse.success) {
        const foundCycle = cyclesResponse.data?.find(c => c.id === cycleId);
        setCycle(foundCycle);
      }

      setCycleHistory([]);

    } catch (error) {
      console.error('Error loading cycle details:', error);
      Alert.alert('Error', 'Failed to load merry go round cycle details');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return 'KES 0';
    }
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown Date';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const canApproveMaryGoRound = () => {
    return ['treasurer', 'secretary', 'chairperson'].includes(userRole.toLowerCase());
  };

  const handleInitiateApprove = (cycleItem) => {
    if (!canApproveMaryGoRound()) {
      Alert.alert('Access Denied', 'You do not have permission to approve merry go round disbursements.');
      return;
    }
    if (cycleItem.status?.toLowerCase() === 'disbursed' || cycleItem.status?.toLowerCase() === 'completed') {
      Alert.alert('Info', 'This disbursement has already been processed.');
      return;
    }
    setSelectedApprovalItem(cycleItem);
    setApprovalActionType('approve');
    setShowOTPModal(true);
  };

  const handleVerifyOTP = async (code) => {
    if (!selectedApprovalItem) return;
    setOtpLoading(true);
    try {
      const approvalData = {
        action: approvalActionType,
        otpCode: code,
        approvedBy: userRole,
        approvedById: user?.id,
        approvedByName: user?.fullName || user?.firstName || user?.email || 'Unknown',
        timestamp: new Date().toISOString(),
        chamaId: chamaId || currentChamaId,
        disbursementType: 'merry-go-round',
        itemLabel: selectedApprovalItem.recipientName || selectedApprovalItem.recipient?.name || `Cycle #${selectedApprovalItem.id}`,
        amount: selectedApprovalItem.amount_per_round || selectedApprovalItem.amountPerRound || selectedApprovalItem.amount || selectedApprovalItem.totalAmount || 0,
      };

      const response = await approveWelfareDisbursement(chamaId || currentChamaId, selectedApprovalItem.id, approvalData);

      if (response.success) {
        showInAppToast({
          title: 'Success',
          message: `Merry go round ${approvalActionType}d successfully.`,
          type: 'success',
        });

        await sendApprovalNotification({
          chamaId: chamaId || currentChamaId,
          recipientUserId: selectedApprovalItem.recipientId || selectedApprovalItem.recipient?.id || selectedApprovalItem.id,
          recipientName: selectedApprovalItem.recipientName || selectedApprovalItem.recipient?.name || 'Recipient',
          recipientPhone: selectedApprovalItem.recipientPhone,
          recipientEmail: selectedApprovalItem.recipientEmail,
          disbursementType: 'merry-go-round',
          disbursementId: selectedApprovalItem.id,
          entityLabel: selectedApprovalItem.recipientName || selectedApprovalItem.recipient?.name || `Cycle #${selectedApprovalItem.id}`,
          amount: selectedApprovalItem.amount_per_round || selectedApprovalItem.amountPerRound || selectedApprovalItem.amount || selectedApprovalItem.totalAmount || 0,
          action: approvalActionType,
          initiatedBy: userRole,
          chamaName: '',
        });

        setShowOTPModal(false);
        setSelectedApprovalItem(null);
        setApprovalActionType(null);
        loadCycleDetails();
      } else {
        Alert.alert('Error', response.error || 'Failed to process approval.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to verify OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!selectedApprovalItem) return;
    try {
      await sendApprovalNotification({
        chamaId: chamaId || currentChamaId,
        recipientUserId: user?.id,
        recipientName: user?.fullName || user?.firstName || 'You',
        recipientPhone: user?.phone || user?.phone_number,
        recipientEmail: user?.email,
        disbursementType: 'merry-go-round',
        disbursementId: selectedApprovalItem.id,
        entityLabel: selectedApprovalItem.recipientName || selectedApprovalItem.recipient?.name || `Cycle #${selectedApprovalItem.id}`,
        amount: selectedApprovalItem.amount_per_round || selectedApprovalItem.amountPerRound || selectedApprovalItem.amount || selectedApprovalItem.totalAmount || 0,
        action: 'otp_resend',
        initiatedBy: userRole,
        chamaName: '',
      });
      showInAppToast({
        title: 'OTP Resent',
        message: 'A new OTP has been sent to your phone.',
        type: 'info',
      });
    } catch (error) {
      showInAppToast({
        title: 'Resend Failed',
        message: 'Could not resend OTP. Please try again.',
        type: 'error',
      });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (!cycle) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorState}>
          <Ionicons name="refresh-circle-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Cycle Not Found</Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            Unable to load merry go round cycle details
          </Text>
          <Button
            title="Go Back"
            onPress={() => navigation.goBack()}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={styles.headerContent}>
            <View style={styles.cycleIcon}>
              <Ionicons name="refresh-circle" size={32} color={colors.info} />
            </View>
            <View style={styles.cycleInfo}>
              <Text style={[styles.cycleTitle, { color: colors.text }]}>
                Cycle {cycle.cycleNumber}
              </Text>
              <Text style={[styles.cycleRecipient, { color: colors.textSecondary }]}>
                Recipient: {cycle.recipientName}
              </Text>
            </View>
          </View>
        </View>

        {/* Amount Card */}
        <Card variant="outlined" style={styles.amountCard}>
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Cycle Amount</Text>
          <Text style={[styles.amountValue, { color: colors.primary }]}>
            {formatCurrency(cycle.amount)}
          </Text>
          <Text style={[styles.expectedDate, { color: colors.textSecondary }]}>
            Expected: {formatDate(cycle.expectedDate)}
          </Text>
        </Card>

        {/* Cycle Details */}
        <Card variant="outlined" style={styles.detailsCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Cycle Details</Text>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Status</Text>
            <View style={[styles.statusBadge, {
              backgroundColor: cycle.status?.toLowerCase().includes('ready') ? colors.success + '20' :
                             cycle.status === 'disbursed' ? colors.info + '20' : colors.warning + '20'
            }]}>
              <Text style={[styles.statusText, {
                color: cycle.status?.toLowerCase().includes('ready') ? colors.success :
                       cycle.status === 'disbursed' ? colors.info : colors.warning
              }]}>
                {cycle.status?.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Recipient ID</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {cycle.recipientId}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Cycle Created</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {formatDate(cycle.createdAt)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Disbursement Date</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {cycle.disbursedAt ? formatDate(cycle.disbursedAt) : 'Not yet disbursed'}
            </Text>
          </View>
        </Card>

        {/* Cycle History */}
        <Card variant="outlined" style={styles.historyCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Cycle History</Text>

          {cycleHistory.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons name="time-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No history available
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Cycle history will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {cycleHistory.map((event, index) => (
                <View key={event.id || index} style={styles.historyItem}>
                  <View style={styles.historyInfo}>
                    <Text style={[styles.historyEvent, { color: colors.text }]}>
                      {event.event}
                    </Text>
                    <Text style={[styles.historyDate, { color: colors.textSecondary }]}>
                      {formatDate(event.date)}
                    </Text>
                  </View>
                  <Ionicons
                    name={event.icon || 'checkmark-circle'}
                    size={20}
                    color={colors.primary}
                  />
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          {canApproveMaryGoRound() && cycle.status?.toLowerCase() !== 'disbursed' && cycle.status?.toLowerCase() !== 'completed' && (
            <Button
              title={cycle.status?.toLowerCase() === 'pending' ? 'Approve Cycle' : 'Verify Disbursement'}
              onPress={() => handleInitiateApprove(cycle)}
              style={{ backgroundColor: colors.primary, marginBottom: spacing.md }}
              icon={<Ionicons name="checkmark-done" size={16} color={colors.white} />}
            />
          )}
          {cycle.status?.toLowerCase().includes('ready') && (
            <Button
              title="Disburse Funds"
              onPress={() => Alert.alert('Coming Soon', 'Merry go round disbursement will be available in the next update.')}
              style={{ backgroundColor: colors.primary, marginBottom: spacing.md }}
              icon={<Ionicons name="cash" size={16} color={colors.white} />}
            />
          )}

          <Button
            title="View Participants"
            onPress={() => Alert.alert('Coming Soon', 'Cycle participants view will be available in the next update.')}
            style={{ backgroundColor: colors.info, marginBottom: spacing.md }}
            icon={<Ionicons name="people" size={16} color={colors.white} />}
          />

          <Button
            title="Cycle Report"
            onPress={() => Alert.alert('Coming Soon', 'Cycle reports will be available in the next update.')}
            style={{ backgroundColor: colors.secondary }}
            icon={<Ionicons name="document-text" size={16} color={colors.white} />}
          />
        </View>

        <OTPVerificationModal
          visible={showOTPModal}
          onClose={() => {
            setShowOTPModal(false);
            setSelectedApprovalItem(null);
            setApprovalActionType(null);
          }}
          title={approvalActionType === 'approve' ? 'Approve Disbursement' : 'Verify Disbursement'}
          subtitle={`Enter the OTP sent to your phone to ${approvalActionType} this merry go round disbursement.`}
          onVerify={handleVerifyOTP}
          onResend={handleResendOTP}
          loading={otpLoading}
          itemType="merry-go-round"
        />

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: spacing.md,
  },
  header: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cycleIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  cycleInfo: {
    flex: 1,
  },
  cycleTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  cycleRecipient: {
    fontSize: typography.fontSize.sm,
  },
  amountCard: {
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  amountLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  amountValue: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  expectedDate: {
    fontSize: typography.fontSize.xs,
  },
  detailsCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  historyCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  emptyHistory: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  historyList: {
    marginTop: spacing.md,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  historyInfo: {
    flex: 1,
  },
  historyEvent: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs / 2,
  },
  historyDate: {
    fontSize: typography.fontSize.xs,
  },
  actions: {
    marginBottom: spacing.xxxl,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorSubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
});

export default MaryGoRoundDetails;