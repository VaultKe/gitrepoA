import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import { getThemeColors } from '../utils/theme';
import ApiService from '../services/api';
import { sendApprovalNotification, showInAppToast } from '../services/disbursementNotificationService';
import { approveWelfareDisbursement } from '../services/api/welfareEndpoints';

const useWelfareDetails = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const { fundId, chamaId } = route?.params || {};

  const [welfareFund, setWelfareFund] = useState(null);
  const [loading, setLoading] = useState(false);
  const [contributions, setContributions] = useState([]);
  const [userRole, setUserRole] = useState('member');

  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [selectedApprovalItem, setSelectedApprovalItem] = useState(null);
  const [approvalActionType, setApprovalActionType] = useState(null);

  useEffect(() => {
    if (fundId) {
      loadWelfareDetails();
    }
  }, [fundId]);

  const loadWelfareDetails = async () => {
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

      const fundsResponse = await ApiService.getWelfareRequests(chamaId || currentChamaId);
      if (fundsResponse.success) {
        const fund = fundsResponse.data?.find(f => f.id === fundId);
        setWelfareFund(fund);
      }

      setContributions([]);

    } catch (error) {
      console.error('Error loading welfare details:', error);
      Alert.alert('Error', 'Failed to load welfare fund details');
    } finally {
      setLoading(false);
    }
  };

  const canApproveWelfare = () => {
    return ['treasurer', 'secretary', 'chairperson'].includes(userRole.toLowerCase());
  };

  const handleInitiateApprove = (fund) => {
    if (!canApproveWelfare()) {
      Alert.alert('Access Denied', 'You do not have permission to approve welfare funds.');
      return;
    }
    if (fund.status === 'disbursed' || fund.status === 'cancelled') {
      Alert.alert('Info', 'This disbursement has already been processed.');
      return;
    }
    setSelectedApprovalItem(fund);
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
        disbursementType: 'welfare',
        itemLabel: selectedApprovalItem.memberName || selectedApprovalItem.requester_name || `Fund #${selectedApprovalItem.id}`,
        amount: selectedApprovalItem.amount,
      };

      const response = await approveWelfareDisbursement(chamaId || currentChamaId, selectedApprovalItem.id, approvalData);

      if (response.success) {
        showInAppToast({
          title: 'Success',
          message: `Welfare fund ${approvalActionType}d successfully.`,
          type: 'success',
        });

        await sendApprovalNotification({
          chamaId: chamaId || currentChamaId,
          recipientUserId: selectedApprovalItem.requester_id || selectedApprovalItem.memberId || selectedApprovalItem.id,
          recipientName: selectedApprovalItem.memberName || selectedApprovalItem.requester_name || 'Member',
          recipientPhone: selectedApprovalItem.memberPhone || selectedApprovalItem.phone_number,
          recipientEmail: selectedApprovalItem.memberEmail || selectedApprovalItem.email,
          disbursementType: 'welfare',
          disbursementId: selectedApprovalItem.id,
          entityLabel: selectedApprovalItem.memberName || selectedApprovalItem.requester_name || `Fund #${selectedApprovalItem.id}`,
          amount: selectedApprovalItem.amount,
          action: approvalActionType,
          initiatedBy: userRole,
          chamaName: '',
        });

        setShowOTPModal(false);
        setSelectedApprovalItem(null);
        setApprovalActionType(null);
        loadWelfareDetails();
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
        disbursementType: 'welfare',
        disbursementId: selectedApprovalItem.id,
        entityLabel: selectedApprovalItem.memberName || selectedApprovalItem.requester_name || `Fund #${selectedApprovalItem.id}`,
        amount: selectedApprovalItem.amount,
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

  const closeOTPModal = () => {
    setShowOTPModal(false);
    setSelectedApprovalItem(null);
    setApprovalActionType(null);
  };

  return {
    theme,
    user,
    colors,
    chamaId,
    fundId,
    currentChamaId,
    welfareFund,
    loading,
    contributions,
    userRole,
    showOTPModal,
    otpLoading,
    selectedApprovalItem,
    approvalActionType,
    loadWelfareDetails,
    canApproveWelfare,
    handleInitiateApprove,
    handleVerifyOTP,
    handleResendOTP,
    closeOTPModal,
    formatCurrency,
    formatDate,
  };
};

export default useWelfareDetails;
