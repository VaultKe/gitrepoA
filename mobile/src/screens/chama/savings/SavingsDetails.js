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

const SavingsDetails = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const { accountId, chamaId } = route?.params || {};

  const [savingsAccount, setSavingsAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [userRole, setUserRole] = useState('member');

  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [selectedApprovalItem, setSelectedApprovalItem] = useState(null);
  const [approvalActionType, setApprovalActionType] = useState(null);

  useEffect(() => {
    if (accountId) {
      loadSavingsDetails();
    }
  }, [accountId]);

  const loadSavingsDetails = async () => {
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

      const accountResponse = await ApiService.getEligibleSavingsMembers(chamaId || currentChamaId);
      if (accountResponse.success) {
        const account = accountResponse.data?.find(acc => acc.id === accountId || acc.memberId === accountId);
        setSavingsAccount(account);
      }

      setTransactions([]);

    } catch (error) {
      console.error('Error loading savings details:', error);
      Alert.alert('Error', 'Failed to load savings account details');
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

  const canApproveSavings = () => {
    return ['treasurer', 'secretary', 'chairperson'].includes(userRole.toLowerCase());
  };

  const handleInitiateApprove = (account) => {
    if (!canApproveSavings()) {
      Alert.alert('Access Denied', 'You do not have permission to approve savings withdrawals.');
      return;
    }
    if (account.status === 'locked') {
      Alert.alert('Info', 'This account is locked and cannot be processed.');
      return;
    }
    setSelectedApprovalItem(account);
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
        disbursementType: 'savings-withdrawal',
        itemLabel: selectedApprovalItem.memberName || selectedApprovalItem.member_name || `Account #${selectedApprovalItem.id}`,
        amount: selectedApprovalItem.balance,
      };

      const response = await approveWelfareDisbursement(chamaId || currentChamaId, selectedApprovalItem.id, approvalData);

      if (response.success) {
        showInAppToast({
          title: 'Success',
          message: `Savings withdrawal ${approvalActionType}d successfully.`,
          type: 'success',
        });

        await sendApprovalNotification({
          chamaId: chamaId || currentChamaId,
          recipientUserId: selectedApprovalItem.memberId || selectedApprovalItem.id,
          recipientName: selectedApprovalItem.memberName || selectedApprovalItem.member_name || 'Member',
          recipientPhone: selectedApprovalItem.memberPhone || selectedApprovalItem.phone_number,
          recipientEmail: selectedApprovalItem.memberEmail || selectedApprovalItem.email,
          disbursementType: 'savings-withdrawal',
          disbursementId: selectedApprovalItem.id,
          entityLabel: selectedApprovalItem.memberName || selectedApprovalItem.member_name || `Account #${selectedApprovalItem.id}`,
          amount: selectedApprovalItem.balance,
          action: approvalActionType,
          initiatedBy: userRole,
          chamaName: '',
        });

        setShowOTPModal(false);
        setSelectedApprovalItem(null);
        setApprovalActionType(null);
        loadSavingsDetails();
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
        disbursementType: 'savings-withdrawal',
        disbursementId: selectedApprovalItem.id,
        entityLabel: selectedApprovalItem.memberName || selectedApprovalItem.member_name || `Account #${selectedApprovalItem.id}`,
        amount: selectedApprovalItem.balance,
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

  if (!savingsAccount) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorState}>
          <Ionicons name="wallet-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Account Not Found</Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            Unable to load savings account details
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
            <View style={styles.accountIcon}>
              <Ionicons name="wallet" size={32} color={colors.secondary} />
            </View>
            <View style={styles.accountInfo}>
              <Text style={[styles.accountName, { color: colors.text }]}>
                {savingsAccount.memberName || 'Savings Account'}
              </Text>
              <Text style={[styles.accountNumber, { color: colors.textSecondary }]}>
                Account: {savingsAccount.accountNumber || savingsAccount.id}
              </Text>
            </View>
          </View>
        </View>

        {/* Balance Card */}
        <Card variant="outlined" style={styles.balanceCard}>
          <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Current Balance</Text>
          <Text style={[styles.balanceAmount, { color: colors.success }]}>
            {formatCurrency(savingsAccount.balance)}
          </Text>
          <Text style={[styles.balanceDate, { color: colors.textSecondary }]}>
            Last Updated: {formatDate(savingsAccount.lastActivity)}
          </Text>
        </Card>

        {/* Account Details */}
        <Card variant="outlined" style={styles.detailsCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Details</Text>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Status</Text>
            <View style={[styles.statusBadge, {
              backgroundColor: savingsAccount.status === 'eligible' ? colors.success + '20' : colors.warning + '20'
            }]}>
              <Text style={[styles.statusText, {
                color: savingsAccount.status === 'eligible' ? colors.success : colors.warning
              }]}>
                {savingsAccount.status?.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Member ID</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {savingsAccount.memberId}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Created Date</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {formatDate(savingsAccount.createdAt)}
            </Text>
          </View>
        </Card>

        {/* Transaction History */}
        <Card variant="outlined" style={styles.transactionsCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Transaction History</Text>

          {transactions.length === 0 ? (
            <View style={styles.emptyTransactions}>
              <Ionicons name="document-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No transactions found
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Transaction history will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.map((transaction, index) => (
                <View key={transaction.id || index} style={styles.transactionItem}>
                  <View style={styles.transactionInfo}>
                    <Text style={[styles.transactionType, { color: colors.text }]}>
                      {transaction.type}
                    </Text>
                    <Text style={[styles.transactionDate, { color: colors.textSecondary }]}>
                      {formatDate(transaction.date)}
                    </Text>
                  </View>
                  <Text style={[styles.transactionAmount, {
                    color: transaction.type === 'deposit' ? colors.success : colors.error
                  }]}>
                    {transaction.type === 'deposit' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          {canApproveSavings() && savingsAccount.status !== 'locked' && (
            <Button
              title={savingsAccount.status === 'eligible' || savingsAccount.status === 'pending' ? 'Approve Withdrawal' : 'Verify Disbursement'}
              onPress={() => handleInitiateApprove(savingsAccount)}
              style={{ backgroundColor: colors.primary, marginBottom: spacing.md }}
              icon={<Ionicons name="checkmark-done" size={16} color={colors.white} />}
            />
          )}
          {savingsAccount.status === 'eligible' && (
            <Button
              title="Withdraw Funds"
              onPress={() => Alert.alert('Coming Soon', 'Savings withdrawal will be available in the next update.')}
              style={{ backgroundColor: colors.warning, marginBottom: spacing.md }}
              icon={<Ionicons name="cash" size={16} color={colors.white} />}
            />
          )}

          <Button
            title="Deposit Funds"
            onPress={() => Alert.alert('Coming Soon', 'Savings deposit will be available in the next update.')}
            style={{ backgroundColor: colors.success, marginBottom: spacing.md }}
            icon={<Ionicons name="add-circle" size={16} color={colors.white} />}
          />

          <Button
            title="View Statements"
            onPress={() => Alert.alert('Coming Soon', 'Account statements will be available in the next update.')}
            style={{ backgroundColor: colors.info }}
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
          title={approvalActionType === 'approve' ? 'Approve Withdrawal' : 'Verify Disbursement'}
          subtitle={`Enter the OTP sent to your phone to ${approvalActionType} this savings withdrawal.`}
          onVerify={handleVerifyOTP}
          onResend={handleResendOTP}
          loading={otpLoading}
          itemType="savings-withdrawal"
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
  accountIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  accountNumber: {
    fontSize: typography.fontSize.sm,
  },
  balanceCard: {
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  balanceLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  balanceAmount: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  balanceDate: {
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
  transactionsCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  emptyTransactions: {
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
  transactionsList: {
    marginTop: spacing.md,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs / 2,
  },
  transactionDate: {
    fontSize: typography.fontSize.xs,
  },
  transactionAmount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
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

export default SavingsDetails;