import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import ApiService from '../services/api';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import { getThemeColors } from '../utils/theme';
import { sendApprovalNotification, showInAppToast } from '../services/disbursementNotificationService';
import { approveWelfareDisbursement } from '../services/api/welfareEndpoints';
import { formatCurrency, formatDate } from '../utils/savingsHelpers';

const useSavingsDetails = ({ route, navigation }) => {
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

  const handleInitiateApprove = (account) => {
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

  const canApproveSavings = () => {
    return ['treasurer', 'secretary', 'chairperson'].includes(userRole.toLowerCase());
  };

  return {
    theme,
    user,
    colors,
    currentChamaId,
    accountId,
    chamaId,
    savingsAccount,
    loading,
    transactions,
    userRole,
    showOTPModal,
    setShowOTPModal,
    otpLoading,
    selectedApprovalItem,
    setSelectedApprovalItem,
    approvalActionType,
    setApprovalActionType,
    loadSavingsDetails,
    handleInitiateApprove,
    handleVerifyOTP,
    handleResendOTP,
    canApproveSavings,
    formatCurrency,
    formatDate,
  };
};

export default useSavingsDetails;
