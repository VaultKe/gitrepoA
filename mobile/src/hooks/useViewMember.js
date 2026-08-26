import { useState, useEffect } from 'react';
import { Alert, ActivityIndicator, Image, View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useApp } from '../context/AppContext';
import { getThemeColors, breakpoints } from '../utils/theme';
import api from '../services/api';
import { getMemberServiceFeePayments, payMemberServiceFee, payServiceFeePayment, removeMemberFromChama, getChamaMember } from '../services/api/chamaEndpoints';
import { getMemberName } from '../utils/chamaMembersUtils';
import { sendApprovalNotification, showInAppToast } from '../services/disbursementNotificationService';
import { getChamaDisbursementApprovals, approveWelfareDisbursement } from '../services/api/welfareEndpoints';
import {
  maskPhone,
  maskLocation,
  maskOccupation,
  formatDate,
  formatCurrency,
  getFeeStatusColor,
  getFeeStatusIcon,
  getRoleColor,
  getRoleIcon,
  getActivityColor,
} from '../utils/viewMemberHelpers';

const PAY_COOLDOWN_MS = 30000;
const MEMBER_CACHE_TTL = 5 * 60 * 1000;

const useViewMember = ({ route, navigation }) => {
  const { memberId, chamaId, userRole } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  const [loading, setLoading] = useState(false);
  const [memberData, setMemberData] = useState(null);
  const [memberStats, setMemberStats] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [failedAvatars, setFailedAvatars] = useState(new Set());
  const [serviceFeePayments, setServiceFeePayments] = useState([]);
  const [feePaymentsLoading, setFeePaymentsLoading] = useState(false);
  const [payingFee, setPayingFee] = useState(null);
  const [lastPayAttempt, setLastPayAttempt] = useState(null);
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [serviceFeePaid, setServiceFeePaid] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [approvalHistoryLoading, setApprovalHistoryLoading] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [selectedApprovalItem, setSelectedApprovalItem] = useState(null);
  const [approvalActionType, setApprovalActionType] = useState(null);
  const [screenWidth, setScreenWidth] = useState(breakpoints.md + 1);
  const isDesktop = screenWidth >= breakpoints.md;
  const [recentActivity, setRecentActivity] = useState([]);
  const [activityPage, setActivityPage] = useState(1);
  const activityItemsPerPage = 10;

  const isSelf = memberId === user?.id;
  const isEligible = userRole === 'chairperson' || userRole === 'treasurer';

  const getPaymentTransactionId = (payment) => {
    if (!payment) return null;
    return payment.transactionId || payment.transaction_id;
  };

  const isPaymentVerifiedPaid = (payment) => {
    if (!payment) return false;
    return payment.status === 'paid' && !!getPaymentTransactionId(payment);
  };

  const hasPaidServiceFee =
    serviceFeePaid ||
    (memberData?.service_fee_paid && serviceFeePayments.some(isPaymentVerifiedPaid)) ||
    serviceFeePayments.some(isPaymentVerifiedPaid);

  const MEMBER_CACHE_KEY = `cached_member_${chamaId}_${memberId}`;

  const loadCachedMember = async () => {
    try {
      const cached = await AsyncStorage.getItem(MEMBER_CACHE_KEY);
      if (cached) {
        const { memberData: cachedMember, memberStats: cachedStats, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < MEMBER_CACHE_TTL) {
          if (cachedMember) setMemberData(cachedMember);
          if (cachedStats) setMemberStats(cachedStats);
          return true;
        }
      }
    } catch (error) {
      // Silent fail for cache read
    }
    return false;
  };

  const cacheMember = async (member, stats) => {
    try {
      await AsyncStorage.setItem(MEMBER_CACHE_KEY, JSON.stringify({
        memberData: member,
        memberStats: stats,
        timestamp: Date.now(),
      }));
    } catch (error) {
      // Silent fail for cache write
    }
  };

  useEffect(() => {
    if (memberData?.service_fee_paid && !serviceFeePayments.some(isPaymentVerifiedPaid)) {
      setServiceFeePaid(false);
    }
  }, [memberData?.service_fee_paid, serviceFeePayments]);

  useEffect(() => {
    let timer;
    if (lastPayAttempt && cooldownActive) {
      const updateCooldown = () => {
        const remaining = Math.ceil((PAY_COOLDOWN_MS - (Date.now() - lastPayAttempt)) / 1000);
        if (remaining <= 0) {
          setCooldownActive(false);
          setCooldownRemaining(0);
        } else {
          setCooldownRemaining(remaining);
        }
      };
      updateCooldown();
      timer = setInterval(updateCooldown, 1000);
    }
    return () => clearInterval(timer);
  }, [lastPayAttempt, cooldownActive]);

  useEffect(() => {
    const initialize = async () => {
      const hadCache = await loadCachedMember();
      await loadMemberDetails(hadCache);
      loadServiceFeePayments();
      loadApprovalHistory();
      if (isSelf) {
        loadRecentActivity();
      }
    };
    initialize();
  }, [memberId, chamaId]);

  const loadServiceFeePayments = async () => {
    try {
      setFeePaymentsLoading(true);
      const response = await getMemberServiceFeePayments(chamaId, memberId);
      if (response.success && response.data) {
        setServiceFeePayments(response.data);
      }
    } catch (error) {
    } finally {
      setFeePaymentsLoading(false);
    }
  };

  const loadMemberDetails = async (useBackgroundLoader = false) => {
    try {
      if (!useBackgroundLoader) setLoading(true);
      setLoadError(null);

      const memberResponse = await getChamaMember(chamaId, memberId);
      if (memberResponse.success && memberResponse.data) {
        setMemberData(memberResponse.data);
      } else {
        throw new Error(memberResponse.error || 'Member not found');
      }

      try {
        const statsResponse = await api.makeRequest(`/chamas/${chamaId}/members/${memberId}/stats`);
        if (statsResponse.success && statsResponse.data) {
          setMemberStats(statsResponse.data);
        }
      } catch (error) {
      }

      cacheMember(memberData, memberStats);
    } catch (error) {
      console.error('Error loading member details:', error);
      setLoadError(error.message || 'Failed to load member details');
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to load member details',
      });
    } finally {
      if (!useBackgroundLoader) setLoading(false);
    }
  };

  const loadApprovalHistory = async () => {
    try {
      setApprovalHistoryLoading(true);
      const response = await getChamaDisbursementApprovals(chamaId, user?.id);
      if (response.success && response.data) {
        setApprovalHistory(response.data);
      }
    } catch (error) {
    } finally {
      setApprovalHistoryLoading(false);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const response = await api.makeRequest(`/chamas/${chamaId}/transactions?limit=10&offset=0`);
      if (response.success && response.data) {
        const memberTransactions = (response.data || []).filter(t => t.initiated_by === memberId || t.user_id === memberId);
        const formatted = memberTransactions.map(t => ({
          id: t.id,
          date: t.created_at || t.date,
          type: t.type || 'transaction',
          amount: t.amount,
          description: t.description || t.metadata?.description || 'Transaction',
        }));
        setRecentActivity(formatted);
      }
    } catch (error) {
      // Silently fail - activity is optional
    }
  };

  const handleRemoveMember = () => {
    if (userRole !== 'chairperson') {
      Toast.show({ type: 'error', text1: 'Access Denied', text2: 'Only chairperson can remove members' });
      return;
    }
    if (memberData?.user_id === user.id) {
      Toast.show({ type: 'error', text1: 'Cannot Remove Self', text2: 'You cannot remove yourself from the chama' });
      return;
    }
    setShowRemoveConfirm(true);
  };

  const confirmRemoveMember = async () => {
    try {
      if (!chamaId || !memberId) {
        Alert.alert('Error', 'Missing chama ID or member ID');
        return;
      }
      setRemoveLoading(true);
      const response = await removeMemberFromChama(chamaId, memberId);
      if (response && response.success) {
        Toast.show({ type: 'success', text1: 'Member Removed', text2: response.message || `${getMemberName(memberData)} has been removed from the chama` });
        setTimeout(() => navigation.goBack(), 1200);
      } else {
        Toast.show({ type: 'error', text1: 'Remove Failed', text2: response?.error || 'Failed to remove member' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Remove Failed', text2: error.message || 'Failed to remove member from chama' });
    } finally {
      setRemoveLoading(false);
      setShowRemoveConfirm(false);
    }
  };

  const handlePayServiceFee = async (payment) => {
    if (userRole !== 'chairperson') {
      Toast.show({ type: 'error', text1: 'Access Denied', text2: 'Only chairperson can initiate payments' });
      return;
    }
    try {
      setPayingFee(payment.id);
      const response = await payServiceFeePayment(chamaId, payment.id);
      if (response.success) {
        Toast.show({ type: 'success', text1: 'Payment Initiated', text2: "STK push sent to member's phone" });
        loadServiceFeePayments();
      } else {
        throw new Error(response.error || 'Failed to initiate payment');
      }
    } catch (error) {
      if (error.message?.includes('Service fee already paid')) {
        setServiceFeePaid(true);
        loadMemberDetails();
        loadServiceFeePayments();
        Toast.show({ type: 'info', text1: 'Already Paid', text2: 'This service fee was already paid' });
        return;
      }
      Toast.show({ type: 'error', text1: 'Payment Failed', text2: error.message || 'Failed to initiate payment' });
    } finally {
      setPayingFee(null);
    }
  };

  const handlePayMemberServiceFee = async () => {
    if (userRole !== 'chairperson' && userRole !== 'treasurer') {
      Toast.show({ type: 'error', text1: 'Access Denied', text2: 'Only chairperson or treasurer can initiate payments' });
      return;
    }
    const now = Date.now();
    if (lastPayAttempt && now - lastPayAttempt < PAY_COOLDOWN_MS) {
      const remaining = Math.ceil((PAY_COOLDOWN_MS - (now - lastPayAttempt)) / 1000);
      Toast.show({ type: 'info', text1: 'Please wait', text2: `Cooldown active. Try again in ${remaining}s` });
      return;
    }
    try {
      setPayingFee('pending');
      setLastPayAttempt(Date.now());
      setCooldownActive(true);
      const response = await payMemberServiceFee(chamaId, memberId);
      if (response.success) {
        Toast.show({ type: 'success', text1: 'Payment Initiated', text2: "STK push sent to member's phone" });
        loadServiceFeePayments();
      } else {
        throw new Error(response.error || 'Failed to initiate payment');
      }
    } catch (error) {
      if (error.message?.includes('Service fee already paid')) {
        setServiceFeePaid(true);
        loadMemberDetails();
        loadServiceFeePayments();
        Toast.show({ type: 'info', text1: 'Already Paid', text2: 'This service fee was already paid' });
        return;
      }
      Toast.show({ type: 'error', text1: 'Payment Failed', text2: error.message || 'Failed to initiate payment' });
    } finally {
      setPayingFee(null);
    }
  };

  const handleDownloadReceipt = async (member, payment) => {
    if (!member || !payment?.id) return;
    setReceiptLoading(true);
    try {
      const transactionId = payment.transactionId || payment.transaction_id;
      if (!transactionId) {
        throw new Error('Payment transaction ID not found. Please contact support or try again after payment is confirmed.');
      }
      const token = await api.getAuthToken();
      const response = await fetch(`${api.getApiBaseUrl()}/receipts/transactions/${encodeURIComponent(transactionId)}/download?format=pdf`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Receipt download failed: ${response.status} ${errorText}`);
      }
      const blob = await response.blob();
      const fileName = `VaultKe_ETR_Receipt_${String(transactionId).substring(0, 8).toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`;

      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
        Toast.show({ type: 'success', text1: 'ETR Receipt Downloaded', text2: 'PDF receipt has been downloaded successfully.' });
        return;
      }

      if (!FileSystem?.documentDirectory || !Sharing?.isAvailableAsync) {
        throw new Error('Download is not available on this device');
      }

      const reader = new FileReader();
      const base64Data = await new Promise((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result;
          if (typeof result === 'string') resolve(result.split(',')[1]);
          else reject(new Error('Failed to read PDF'));
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Download ETR Receipt', UTI: 'com.adobe.pdf' });
      Toast.show({ type: 'success', text1: 'ETR Receipt Ready', text2: 'PDF receipt has been generated.' });
    } catch (error) {
      console.error('Receipt download failed:', error);
      Alert.alert('ETR Receipt Failed', error.message || 'Failed to download receipt.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleInitiateApprove = (item) => {
    setSelectedApprovalItem(item);
    setApprovalActionType('approve');
    setShowOTPModal(true);
  };

  const handleVerifyOTP = async (code) => {
    if (!selectedApprovalItem) return;
    try {
      setOtpLoading(true);
      const response = await approveWelfareDisbursement(chamaId, selectedApprovalItem.id, { otp: code, userId: user?.id });
      if (response.success) {
        showInAppToast({ title: 'Disbursement Approved', message: `${selectedApprovalItem.type || 'Disbursement'} has been approved successfully.`, type: 'success' });
        sendApprovalNotification({
          chamaId,
          recipientUserId: selectedApprovalItem.recipientId || selectedApprovalItem.member_id,
          recipientName: selectedApprovalItem.recipientName || selectedApprovalItem.member_name,
          disbursementType: selectedApprovalItem.type || 'disbursement',
          disbursementId: selectedApprovalItem.id,
          entityLabel: selectedApprovalItem.description || 'Disbursement',
          amount: selectedApprovalItem.amount,
          action: 'approved',
          initiatedBy: user?.first_name || 'Member',
          chamaName: memberData?.chama?.name || 'Chama',
        });
      } else {
        throw new Error(response.error || 'Failed to approve disbursement');
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Approval Failed', text2: error.message || 'Failed to approve disbursement' });
    } finally {
      setOtpLoading(false);
      setShowOTPModal(false);
      setSelectedApprovalItem(null);
      setApprovalActionType(null);
    }
  };

  const handleResendOTP = async () => {
    if (!selectedApprovalItem) return;
    try {
      await sendApprovalNotification({
        chamaId,
        recipientUserId: user?.id,
        recipientName: user?.first_name || 'Member',
        disbursementType: selectedApprovalItem.type || 'disbursement',
        disbursementId: selectedApprovalItem.id,
        entityLabel: selectedApprovalItem.description || 'Disbursement',
        amount: selectedApprovalItem.amount,
        action: 'ready_for_verification',
        initiatedBy: memberData?.chama?.name || 'Chama',
        chamaName: memberData?.chama?.name || 'Chama',
      });
      showInAppToast({ title: 'OTP Resent', message: 'A new OTP has been sent to your phone.', type: 'info' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Resend Failed', text2: error.message || 'Failed to resend OTP' });
    }
  };

  const handleImagePress = () => setImageExpanded(!imageExpanded);

  const renderMemberAvatar = (isExpanded = false) => {
    const memberUser = memberData?.user || {};
    const avatarUrl = memberUser?.avatar_url || memberUser?.avatar || memberUser?.profile_image || memberData?.avatar;
    const firstName = memberUser?.first_name || memberData?.first_name;
    const lastName = memberUser?.last_name || memberData?.last_name;

    const avatarStyle = isExpanded ? { width: '100%', height: 350, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, backgroundColor: colors.surface } : { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface };
    const placeholderStyle = isExpanded ? { width: '100%', height: 350, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary } : { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary };
    const textStyle = isExpanded ? { fontSize: 120, fontWeight: '600', color: colors.white } : { fontSize: 32, fontWeight: '600', color: colors.white };

    if (avatarUrl && !failedAvatars.has(avatarUrl)) {
      let fullAvatarUrl;
      if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) {
        fullAvatarUrl = avatarUrl;
      } else {
        fullAvatarUrl = `${api.uploadBaseUrl}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
      }

      return (
        <Image
          source={{ uri: fullAvatarUrl }}
          style={avatarStyle}
          resizeMode="cover"
          onError={() => {
            setFailedAvatars(prev => new Set([...prev, avatarUrl]));
          }}
        />
      );
    }

    return (
      <View style={placeholderStyle}>
        <Text style={textStyle}>
          {firstName?.[0]?.toUpperCase() || 'M'}{lastName?.[0]?.toUpperCase() || ''}
        </Text>
      </View>
    );
  };

  return {
    loading, memberData, memberStats, loadError, imageExpanded, serviceFeePayments,
    feePaymentsLoading, payingFee, cooldownActive, cooldownRemaining, serviceFeePaid,
    removeLoading, showRemoveConfirm, receiptLoading, approvalHistory, approvalHistoryLoading,
    showOTPModal, otpLoading, selectedApprovalItem, approvalActionType, isDesktop, isSelf,
    isEligible, hasPaidServiceFee, recentActivity, activityPage, colors,
    setImageExpanded, setShowRemoveConfirm, setShowOTPModal, setSelectedApprovalItem, setApprovalActionType,
    setActivityPage,
    loadMemberDetails, loadServiceFeePayments, loadApprovalHistory, loadRecentActivity,
    handleRemoveMember, confirmRemoveMember, handlePayServiceFee, handlePayMemberServiceFee,
    handleDownloadReceipt, handleInitiateApprove, handleVerifyOTP, handleResendOTP, handleImagePress,
    renderMemberAvatar,
    formatDate, formatCurrency, maskPhone, maskLocation, maskOccupation,
    getFeeStatusColor, getFeeStatusIcon, getRoleColor, getRoleIcon, getActivityColor, getMemberName,
  };
};

export default useViewMember;
