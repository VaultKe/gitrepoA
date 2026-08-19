import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import ApiService from '../services/api';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import { approveWelfareDisbursement } from '../services/api/welfareEndpoints';
import { sendApprovalNotification, showInAppToast } from '../services/disbursementNotificationService';
import { formatCurrency, formatDate } from '../utils/merryGoRoundHelpers';

const useMaryGoRoundDetails = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
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

  return {
    theme,
    user,
    currentChamaId,
    cycle,
    loading,
    cycleHistory,
    userRole,
    showOTPModal,
    setShowOTPModal,
    otpLoading,
    selectedApprovalItem,
    setSelectedApprovalItem,
    approvalActionType,
    setApprovalActionType,
    loadCycleDetails,
    formatCurrency,
    formatDate,
    canApproveMaryGoRound,
    handleInitiateApprove,
    handleVerifyOTP,
    handleResendOTP,
  };
};

export default useMaryGoRoundDetails;
