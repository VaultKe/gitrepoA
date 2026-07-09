import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import Card from '../../../components/common/Card';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, breakpoints } from '../../../utils/theme';
import api from '../../../services/api';
import { getMemberServiceFeePayments, payMemberServiceFee, payServiceFeePayment, removeMemberFromChama } from '../../../services/api/chamaEndpoints';
import Button from '../../../components/common/Button';
import OTPVerificationModal from '../../../components/common/OTPVerificationModal';
import { sendApprovalNotification, showInAppToast } from '../../../services/disbursementNotificationService';
import { getChamaDisbursementApprovals, approveWelfareDisbursement } from '../../../services/api/welfareEndpoints';
import { getMemberRole } from '../../../services/api';

const ViewMember = ({ route, navigation }) => {
  const { memberId, chamaId, userRole } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);

  const [loading, setLoading] = useState(false);
  const [memberData, setMemberData] = useState(null);
  const [memberStats, setMemberStats] = useState(null);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [serviceFeePayments, setServiceFeePayments] = useState([]);
  const [feePaymentsLoading, setFeePaymentsLoading] = useState(false);
  const [payingFee, setPayingFee] = useState(null);
  const [lastPayAttempt, setLastPayAttempt] = useState(null);
  const [cooldownActive, setCooldownActive] = useState(false);
const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [serviceFeePaid, setServiceFeePaid] = useState(false);
  const PAY_COOLDOWN_MS = 30000;

  // Cache-first loader (mirrors MyChamasScreen): show cached member data instantly, then refresh.
  const MEMBER_CACHE_KEY = `cached_member_${chamaId}_${memberId}`;
  const MEMBER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

const [receiptLoading, setReceiptLoading] = useState(false);
   const [approvalHistory, setApprovalHistory] = useState([]);
  const [approvalHistoryLoading, setApprovalHistoryLoading] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [selectedApprovalItem, setSelectedApprovalItem] = useState(null);
  const [approvalActionType, setApprovalActionType] = useState(null);

  const isSelf = memberId === user?.id;

  const getPaymentTransactionId = (payment) => {
    if (!payment) return null;
    return (
      payment.transactionId ||
      payment.transaction_id ||
      payment.mpesaCode ||
      payment.mpesa_code ||
      payment.mPesaCode ||
      payment.m_pesa_code ||
      payment.mpesaReceiptNumber ||
      payment.mpesa_receipt_number ||
      payment.code ||
      payment.reference ||
      payment.ref
    );
  };

  const isPaymentVerifiedPaid = (payment) => {
    if (!payment) return false;
    return payment.status === 'paid' && !!getPaymentTransactionId(payment);
  };

  const hasPaidServiceFee =
    serviceFeePaid ||
    (memberData?.service_fee_paid && serviceFeePayments.some(isPaymentVerifiedPaid)) ||
    serviceFeePayments.some(isPaymentVerifiedPaid);

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
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isDesktop = screenWidth >= breakpoints.md;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    const initialize = async () => {
      const hadCache = await loadCachedMember();
      await loadMemberDetails(hadCache);
      loadServiceFeePayments();
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
  const isEligible =
    userRole === 'chairperson' || userRole === 'treasurer';

  const loadMemberDetails = async (useBackgroundLoader = false) => {
    try {
      if (!useBackgroundLoader) setLoading(true);

      let loadedMember = null;
      let loadedStats = null;

      // Load member details
      const memberResponse = await api.makeRequest(`/chamas/${chamaId}/members`);
      if (memberResponse.success && memberResponse.data) {
        const member = memberResponse.data.find(m => m.id === memberId || m.user_id === memberId);
        if (member) {
          loadedMember = member;
          setMemberData(member);
        } else {
          throw new Error('Member not found');
        }
      }

      // Load member statistics (contributions, loans, etc.)
      try {
        const statsResponse = await api.makeRequest(`/chamas/${chamaId}/members/${memberId}/stats`);
        if (statsResponse.success && statsResponse.data) {
          loadedStats = statsResponse.data;
          setMemberStats(loadedStats);
        }
      } catch (error) {
      }

      // Persist loaded data for instant display on next visit (cache-first loader)
      if (loadedMember) {
        cacheMember(loadedMember, loadedStats);
      }
    } catch (error) {
      console.error('Error loading member details:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load member details',
      });
      // Only navigate back if we have nothing to display (e.g. no cached member)
      if (!memberData) {
        navigation.goBack();
      }
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

  const handleRemoveMember = () => {
    if (userRole !== 'chairperson') {
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'Only chairperson can remove members',
      });
      return;
    }

    if (memberData?.user_id === user.id) {
      Toast.show({
        type: 'error',
        text1: 'Cannot Remove Self',
        text2: 'You cannot remove yourself from the chama',
      });
      return;
    }

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberData?.first_name} ${memberData?.last_name} from the chama?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: confirmRemoveMember },
      ]
    );
  };

  const confirmRemoveMember = async () => {
    try {
      const response = await removeMemberFromChama(chamaId, memberId);
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Member Removed',
          text2: `${memberData?.first_name} ${memberData?.last_name} has been removed from the chama`,
        });
        navigation.goBack();
      } else {
        throw new Error(response.error || 'Failed to remove member');
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Remove Failed',
        text2: error.message || 'Failed to remove member from chama',
      });
    }
  };

  const handlePayServiceFee = async (payment) => {
    if (userRole !== 'chairperson') {
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'Only chairperson can initiate payments',
      });
      return;
    }

    try {
      setPayingFee(payment.id);
      const response = await payServiceFeePayment(chamaId, payment.id);
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Payment Initiated',
          text2: 'STK push sent to member\'s phone',
        });
        loadServiceFeePayments();
      } else {
        throw new Error(response.error || 'Failed to initiate payment');
      }
    } catch (error) {
      if (error.message && error.message.includes('Service fee already paid')) {
        setServiceFeePaid(true);
        loadMemberDetails();
        loadServiceFeePayments();
        Toast.show({
          type: 'info',
          text1: 'Already Paid',
          text2: 'This service fee was already paid',
        });
        return;
      }
      Toast.show({
        type: 'error',
        text1: 'Payment Failed',
        text2: error.message || 'Failed to initiate payment',
      });
    } finally {
      setPayingFee(null);
    }
  };

  const handlePayMemberServiceFee = async () => {
    if (userRole !== 'chairperson' && userRole !== 'treasurer') {
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'Only chairperson or treasurer can initiate payments',
      });
      return;
    }

    const now = Date.now();
    if (lastPayAttempt && now - lastPayAttempt < PAY_COOLDOWN_MS) {
      const remaining = Math.ceil((PAY_COOLDOWN_MS - (now - lastPayAttempt)) / 1000);
      Toast.show({
        type: 'info',
        text1: 'Please wait',
        text2: `Cooldown active. Try again in ${remaining}s`,
      });
      return;
    }

    try {
      setPayingFee('pending');
      setLastPayAttempt(Date.now());
      setCooldownActive(true);
      const response = await payMemberServiceFee(chamaId, memberId);
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Payment Initiated',
          text2: 'STK push sent to member\'s phone',
        });
        loadServiceFeePayments();
      } else {
        throw new Error(response.error || 'Failed to initiate payment');
      }
    } catch (error) {
      if (error.message && error.message.includes('Service fee already paid')) {
        setServiceFeePaid(true);
        loadMemberDetails();
        loadServiceFeePayments();
        Toast.show({
          type: 'info',
          text1: 'Already Paid',
          text2: 'This service fee was already paid',
        });
        return;
      }
      Toast.show({
        type: 'error',
        text1: 'Payment Failed',
        text2: error.message || 'Failed to initiate payment',
      });
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
        Toast.show({
          type: 'success',
          text1: 'ETR Receipt Downloaded',
          text2: 'PDF receipt has been downloaded successfully.',
        });
        return;
      }

      if (!FileSystem?.documentDirectory || !Sharing?.isAvailableAsync) {
        throw new Error('Download is not available on this device');
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Download is not available on this device');
      }

      const reader = new FileReader();
      const base64Data = await new Promise((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result;
          if (typeof result === 'string') {
            resolve(result.split(',')[1]);
          } else {
            reject(new Error('Failed to read PDF'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Download ETR Receipt',
        UTI: 'com.adobe.pdf',
      });

      Toast.show({
        type: 'success',
        text1: 'ETR Receipt Ready',
        text2: 'PDF receipt has been generated.',
      });
    } catch (error) {
      console.error('Receipt download failed:', error);
      Alert.alert('ETR Receipt Failed', error.message || 'Failed to download receipt.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const maskPhone = (phone) => {
    if (!phone) return 'N/A';
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 4) {
      return phone.slice(0, 2) + '****' + phone.slice(-4);
    }
    return phone;
  };

  const maskLocation = (location) => {
    if (!location) return 'N/A';
    const parts = location.split(',');
    if (parts.length >= 2) {
      const town = parts[0].trim();
      const county = parts.slice(1).join(',').trim();
      const maskedTown = town.slice(0, 2) + '****';
      return `${maskedTown}, ${county}`;
    }
    return location.slice(0, 2) + '****';
  };

  const maskOccupation = (text) => {
    if (!text) return 'N/A';
    const words = text.split(' ');
    return words.map((word, i) => {
      if (i === 0) return word;
      if (word.length <= 2) return word;
      return word.slice(0, 2) + '****';
    }).join(' ');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'KES 0';
    return `KES ${Number(amount).toLocaleString()}`;
  };

  const getFeeStatusColor = (status) => {
    switch (status) {
      case 'paid': return colors.success;
      case 'overdue': return colors.error;
      default: return colors.warning;
    }
  };

  const getFeeStatusIcon = (status) => {
    switch (status) {
      case 'paid': return 'checkmark-circle';
      case 'overdue': return 'alert-circle';
      default: return 'time';
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
      const response = await approveWelfareDisbursement(
        chamaId,
        selectedApprovalItem.id,
        { otp: code, userId: user?.id }
      );
      if (response.success) {
        showInAppToast({
          title: 'Disbursement Approved',
          message: `${selectedApprovalItem.type || 'Disbursement'} has been approved successfully.`,
          type: 'success',
        });
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
      Toast.show({
        type: 'error',
        text1: 'Approval Failed',
        text2: error.message || 'Failed to approve disbursement',
      });
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
      showInAppToast({
        title: 'OTP Resent',
        message: 'A new OTP has been sent to your phone.',
        type: 'info',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Resend Failed',
        text2: error.message || 'Failed to resend OTP',
      });
    }
  };

  const handleImagePress = () => {
    setImageExpanded(!imageExpanded);
  };

  // Helper function to render member avatar with real profile photo
  const renderMemberAvatar = (isExpanded = false) => {
    const user = memberData?.user || {};
    const avatarUrl = user?.avatar_url || user?.avatar || user?.profile_image || memberData?.avatar_url || memberData?.avatar;
    const firstName = user?.first_name || memberData?.first_name;
    const lastName = user?.last_name || memberData?.last_name;

    const avatarStyle = isExpanded ? styles.expandedAvatar : styles.avatar;
    const placeholderStyle = isExpanded ? styles.expandedAvatarPlaceholder : styles.avatarPlaceholder;
    const textStyle = isExpanded ? styles.expandedAvatarText : styles.avatarText;

    if (avatarUrl) {
      // Process avatar URL similar to ProfileScreen
      let fullAvatarUrl;
      if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) {
        fullAvatarUrl = avatarUrl;
      } else {
        fullAvatarUrl = `${api.baseURL}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
      }

      return (
        <Image
          source={{ uri: fullAvatarUrl }}
          style={avatarStyle}
          onError={(error) => {
          }}
        />
      );
    }

    // Fallback to initials if no avatar
    return (
      <View style={[placeholderStyle, styles.avatarPlaceholderPrimary]}>
        <Text style={[textStyle, styles.avatarText]}>
          {firstName?.[0]?.toUpperCase() || 'M'}{lastName?.[0]?.toUpperCase() || ''}
        </Text>
      </View>
    );
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'chairperson':
        return colors.warning;
      case 'secretary':
        return colors.warning;
      case 'treasurer':
        return colors.warning;
      default:
        return colors.textSecondary;
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'chairperson':
        return 'star';
      case 'secretary':
        return 'document-text';
      case 'treasurer':
        return 'wallet';
      default:
        return 'person';
    }
  };

  // Helper function to render Member Details section
  const renderMemberDetailsSection = (isCombined = false) => (
    <View style={[
      styles[isCombined ? 'combinedSectionContent' : 'detailsCardContent'],
      isCombined && isDesktop && styles.combinedSectionContentDesktop,
    ]}>
      <Text style={styles.combinedSectionTitle}>
        Member Details
      </Text>

      <View style={styles.detailsTableContainer}>
        <View style={styles.detailsTableHeader}>
          <Text style={styles.detailsTableHeaderText}>Item</Text>
          <Text style={styles.detailsTableHeaderText}>Details</Text>
        </View>

        <View style={styles.detailsTable}>
          <View style={styles.tableRowEven}>
            <Text style={styles.tableLabel}>Role</Text>
            <View style={styles.tableValue}>
              <Ionicons
                name={getRoleIcon(memberData.role)}
                size={12}
                color={getRoleColor(memberData.role)}
              />
              <Text style={styles.tableValueText}>
                {memberData.role?.charAt(0).toUpperCase() + memberData.role?.slice(1)}
              </Text>
            </View>
          </View>

          <View style={styles.tableRowOdd}>
            <Text style={styles.tableLabel}>Join Date</Text>
            <Text style={styles.tableValueText}>
              {formatDate(memberData.joined_at)}
            </Text>
          </View>

          <View style={styles.tableRowEven}>
            <Text style={styles.tableLabel}>Attendance Rate</Text>
            <Text style={styles.tableValueTextPrimary}>
              {memberData.attendance_rate?.toFixed(1) || 0}%
            </Text>
          </View>

          <View style={styles.tableRowOdd}>
            <Text style={styles.tableLabel}>Reputation</Text>
            <View style={styles.tableValue}>
              <Ionicons name="star" size={12} color={colors.warning} />
              <Text style={styles.tableValueText}>
                {memberData.reputation_score?.toFixed(1) || 0}
              </Text>
            </View>
          </View>

          <View style={styles.tableRowEven}>
            <Text style={styles.tableLabel}>Total Contributions</Text>
            <Text style={styles.tableValueTextSuccess}>
              {formatCurrency(memberData.total_contributions || 0)}
            </Text>
          </View>

          {memberData.loan_balance > 0 && (
            <View style={styles.tableRowOdd}>
              <Text style={styles.tableLabel}>Loan Balance</Text>
              <Text style={styles.tableValueTextError}>
                {formatCurrency(memberData.loan_balance)}
              </Text>
            </View>
          )}

          {memberData.business_type && (
            <View style={styles.tableRowOdd}>
              <Text style={styles.tableLabel}>Business Type</Text>
              <Text style={styles.tableValueText}>
                {memberData.business_type}
              </Text>
            </View>
          )}

          {memberData.location && (
            <View style={styles.tableRowEven}>
              <Text style={styles.tableLabel}>Location</Text>
              <Text style={styles.tableValueText}>
                {maskLocation(memberData.location)}
              </Text>
            </View>
          )}

          {(memberData.user?.phone || memberData.phone_number) && (
            <View style={styles.tableRowOdd}>
              <Text style={styles.tableLabel}>Phone</Text>
              <Text style={styles.tableValueText}>
                {maskPhone(memberData.user?.phone || memberData.phone_number)}
              </Text>
            </View>
          )}

          {(memberData.user?.bio || memberData.user?.occupation) && (
            <View style={styles.tableRowEven}>
              <Text style={styles.tableLabel}>
                {memberData.user?.occupation ? 'Occupation' : 'Bio'}
              </Text>
              <Text style={styles.tableValueText}>
                {maskOccupation(memberData.user?.occupation || memberData.user?.bio)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  // Helper function to render Service Fee Payments section
  const renderServiceFeeSection = () => (
    <Card variant="outlined" padding="none" style={styles.feeCard}>
      <View style={styles.feeCardContent}>
        <Text style={styles.feeCardTitle}>
          Service Fee Payments
        </Text>
        {serviceFeePayments.length === 0 && !hasPaidServiceFee ? (
          <View style={styles.feeTableWrapper}>
            <View style={styles.feeTableHeader}>
              <Text style={[styles.feeTableHeaderText, { color: colors.primary, flex: 1.5 }]}>Date</Text>
              <Text style={[styles.feeTableHeaderText, { color: colors.primary, flex: 1 }]}>Amount</Text>
              <Text style={[styles.feeTableHeaderText, { color: colors.primary, flex: 1.5 }]}>Status</Text>
              {(userRole === 'chairperson' || userRole === 'treasurer') && (
                <Text style={[styles.feeTableHeaderText, { color: colors.primary, flex: 1, minWidth: 60, textAlign: "center" }]}>Action</Text>
              )}
            </View>
            <View style={[styles.feeTableRow, { backgroundColor: colors.surface }]}>
              <Text style={[styles.feeTableCell, { color: colors.text, flex: 1.5 }]}>
                {formatDate(memberData.joined_at)}
              </Text>
              <Text style={[styles.feeTableCell, { color: colors.text, flex: 1 }]}>
                KES 50
              </Text>
              <View style={styles.feeStatusCell}>
                <Ionicons name="time" size={14} color={colors.warning} />
                <Text style={[styles.feeStatusText, { color: colors.warning }]}>
                  Pending
                </Text>
              </View>
              {(userRole === 'chairperson' || userRole === 'treasurer') && (
                <TouchableOpacity
                  style={[styles.feePayButton, { backgroundColor: colors.primary }]}
                  onPress={() => handlePayMemberServiceFee()}
                  disabled={payingFee === 'pending' || cooldownActive}
                >
                  {payingFee === 'pending' ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : cooldownActive ? (
                    <Text style={[styles.feePayButtonText, { color: colors.white }]}>
                      Wait {cooldownRemaining}s
                    </Text>
                  ) : (
                    <Text style={[styles.feePayButtonText, { color: colors.white }]}>
                      Pay
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : serviceFeePayments.length === 0 && hasPaidServiceFee ? (
          <View style={styles.feeTableWrapper}>
            <View style={styles.feeTableHeader}>
              <Text style={[styles.feeTableHeaderText, { color: colors.primary, flex: 1.5 }]}>Date</Text>
              <Text style={[styles.feeTableHeaderText, { color: colors.primary, flex: 1 }]}>Amount</Text>
              <Text style={[styles.feeTableHeaderText, { color: colors.primary, flex: 1.5 }]}>Status</Text>
              <Text style={[styles.feeTableHeaderText, { color: colors.primary, flex: 1, minWidth: 60, textAlign: "center" }]}>Receipt</Text>
            </View>
              <View style={[styles.feeTableRow, { backgroundColor: colors.surface }]}>
                <Text style={[styles.feeTableCell, { color: colors.text, flex: 1.5 }]}>
                  {formatDate(memberData.service_fee_paid_at || memberData.joined_at)}
                </Text>
                <Text style={[styles.feeTableCell, { color: colors.text, flex: 1 }]}>
                  KES 50
                </Text>
                <View style={styles.feeStatusCell}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={[styles.feeStatusText, { color: colors.success }]}>
                    Paid
                  </Text>
                </View>
              </View>
          </View>
        ) : (
          <ScrollView style={styles.feeTableScroll} nestedScrollEnabled>
            <View style={styles.feeTable}>
              <View style={styles.feeTableHeader}>
                <Text style={[styles.feeTableHeaderText, { color: colors.primary, flex: 1.5 }]}>Date</Text>
                <Text style={[styles.feeTableHeaderText, { color: colors.primary, flex: 1 }]}>Amount</Text>
                <Text style={[styles.feeTableHeaderText, { color: colors.primary, flex: 1.5 }]}>Status</Text>
                {(userRole === 'chairperson' || userRole === 'treasurer') && (
                  <Text style={[styles.feeTableHeaderText, { color: colors.primary, flex: 1, minWidth: 60, textAlign: "center" }]}>Action</Text>
                )}
              </View>
              {serviceFeePayments.map((payment, index) => {
                const isEven = index % 2 === 0;
                return (
                  <View
                    key={payment?.id || `payment-${index}`}
                    style={[
                      styles.feeTableRow,
                      { backgroundColor: isEven ? colors.background : colors.surface }
                    ]}
                  >
                    <Text style={[styles.feeTableCell, { color: colors.text, flex: 1.5 }]}>
                      {formatDate(payment.dueDate || payment.createdAt)}
                    </Text>
                    <Text style={[styles.feeTableCell, { color: colors.text, flex: 1 }]}>
                      {formatCurrency(payment.amount)}
                    </Text>
                    <View style={styles.feeStatusCell}>
                      <Ionicons
                        name={getFeeStatusIcon(payment.status)}
                        size={14}
                        color={getFeeStatusColor(payment.status)}
                      />
                      <Text style={[
                        styles.feeStatusText,
                        { color: getFeeStatusColor(payment.status) }
                      ]}>
                        {payment.status?.charAt(0).toUpperCase() + payment.status?.slice(1)}
                      </Text>
                    </View>
                    {!isPaymentVerifiedPaid(payment) && (
                      <TouchableOpacity
                        style={[
                          styles.feePayButton,
                          { backgroundColor: colors.primary }
                        ]}
                        onPress={() => handlePayServiceFee(payment)}
                        disabled={payingFee === payment.id}
                      >
                        {payingFee === payment.id ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <Text style={[styles.feePayButtonText, { color: colors.white }]}>
                            Pay
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                    {isPaymentVerifiedPaid(payment) && (
                      <TouchableOpacity
                        style={[styles.feeReceiptButton, { backgroundColor: colors.success + '20', borderColor: colors.success }]}
                        onPress={() => handleDownloadReceipt(memberData, payment)}
                      >
                        <Text style={[styles.feeReceiptButtonText, { color: colors.success }]}>
                          ETR Receipt
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    </Card>
  );

  // Helper function to render Disbursement Approvals section
  const renderDisbursementApprovalsSection = (isCombined = false) => (
    <View style={[
      styles[isCombined ? 'combinedSectionContent' : 'approvalCardContent'],
      isCombined && isDesktop && styles.combinedSectionContentDesktop,
      isCombined && !isDesktop && styles.combinedSectionContentStacked,
    ]}>
      <Text style={styles.combinedSectionTitle}>
        Disbursement Approvals & Verifications
      </Text>
      {approvalHistory.length === 0 ? (
        <View style={styles.approvalEmptyContainer}>
          <Ionicons name="document-text" size={48} color={colors.textSecondary} />
          <Text style={[styles.approvalEmptyText, { color: colors.textSecondary }]}>
            No pending approvals or verifications
          </Text>
        </View>
      ) : isDesktop ? (
        <ScrollView
          style={styles.approvalTableScroll}
          nestedScrollEnabled
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.approvalTableHorizontalContent}
          >
            <View style={[
              styles.approvalTable,
              isCombined && styles.approvalTableCombinedDesktop,
            ]}>
              {renderApprovalTableRows()}
            </View>
          </ScrollView>
        </ScrollView>
      ) : (
        <View style={styles.tableScrollArea}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            nestedScrollEnabled
            contentContainerStyle={styles.tableScrollAreaContent}
          >
            <View style={styles.approvalTable}>
              {renderApprovalTableRows()}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );

  const renderApprovalTableRows = () => (
    <>
      <View style={styles.approvalTableHeader}>
        <Text style={[styles.approvalTableHeaderText, { color: colors.primary, flex: 1.2 }]}>Type</Text>
        <Text style={[styles.approvalTableHeaderText, { color: colors.primary, flex: 1.5 }]}>Recipient</Text>
        <Text style={[styles.approvalTableHeaderText, { color: colors.primary, flex: 1 }]}>Amount</Text>
        <Text style={[styles.approvalTableHeaderText, { color: colors.primary, flex: 1.2 }]}>Date</Text>
        <Text style={[styles.approvalTableHeaderText, { color: colors.primary, flex: 1 }]}>Status</Text>
        <Text style={[styles.approvalTableHeaderText, { color: colors.primary, flex: 1, minWidth: 80, textAlign: 'center' }]}>Action</Text>
      </View>
      {approvalHistory.map((item, index) => {
        const isEven = index % 2 === 0;
        const canApprove =
          userRole === 'chairperson' ||
          userRole === 'secretary' ||
          userRole === 'treasurer' ||
          item.randomVerifierId === user?.id ||
          item.verifierId === user?.id;
        const isPending = item.status === 'pending' || item.approvalStatus === 'pending';
        return (
          <View
            key={item?.id || `approval-${index}`}
            style={[
              styles.approvalTableRow,
              { backgroundColor: isEven ? colors.background : colors.surface }
            ]}
          >
            <Text style={[styles.approvalTableCell, { color: colors.text, flex: 1.2 }]}>
              {item.type || 'Welfare'}
            </Text>
            <Text style={[styles.approvalTableCell, { color: colors.text, flex: 1.5 }]}>
              {item.recipientName || item.member_name || 'N/A'}
            </Text>
            <Text style={[styles.approvalTableCell, { color: colors.text, flex: 1 }]}>
              {formatCurrency(item.amount)}
            </Text>
            <Text style={[styles.approvalTableCell, { color: colors.text, flex: 1.2 }]}>
              {formatDate(item.createdAt || item.date)}
            </Text>
            <View style={styles.approvalStatusCell}>
              <Ionicons
                name={item.status === 'approved' || item.approvalStatus === 'approved' ? 'checkmark-circle' :
                  item.status === 'disbursed' || item.approvalStatus === 'disbursed' ? 'cash' : 'time'}
                size={14}
                color={item.status === 'approved' || item.approvalStatus === 'approved' ? colors.success :
                  item.status === 'disbursed' || item.approvalStatus === 'disbursed' ? colors.primary : colors.warning}
              />
              <Text style={[
                styles.approvalStatusText,
                { color: item.status === 'approved' || item.approvalStatus === 'approved' ? colors.success :
                  item.status === 'disbursed' || item.approvalStatus === 'disbursed' ? colors.primary : colors.warning }
              ]}>
                {item.status || item.approvalStatus || 'Pending'}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 80, alignItems: 'center' }}>
              {isPending && canApprove ? (
                <Button
                  title="Approve"
                  onPress={() => handleInitiateApprove(item)}
                  size="small"
                  style={{ paddingHorizontal: 8, paddingVertical: 4, minHeight: 28 }}
                />
              ) : (
                <Text style={[styles.approvalViewText, { color: colors.textSecondary }]}>View</Text>
              )}
            </View>
          </View>
        );
      })}
    </>
  );

  return (
    <SafeAreaView style={[styles.container, styles.containerBackground]}>
      {!memberData ? (
        loading ? (
          <View style={styles.inlineLoadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.inlineLoadingText, { color: colors.textSecondary }]}>
              Loading member details...
            </Text>
          </View>
        ) : (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={64} color={colors.error} />
            <Text style={[styles.errorTitle, styles.errorTitleText]}>
              Member Not Found
            </Text>
            <Text style={[styles.errorText, styles.errorTextSecondary]}>
              The member you're looking for could not be found.
            </Text>
            <TouchableOpacity
              style={[styles.backButton, styles.goBackButton]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        )
      ) : (
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Member Profile Card */}
        <Card
          variant="outlined"
          padding="none"
          style={[styles.profileCard, imageExpanded && styles.framelessCard]}
        >
          {imageExpanded ? (
            // Expanded layout: Frameless image at top, then info below
            <View style={styles.framelessProfileLayout}>
              {/* Minimize button positioned absolutely */}
              <TouchableOpacity onPress={handleImagePress} style={styles.minimizeButton}>
                <Ionicons name="close" size={24} color={colors.white} />
              </TouchableOpacity>

              {/* Frameless Image Section - touches top, left, and right edges */}
              <View style={styles.framelessImageContainer}>
                {renderMemberAvatar(true)}
              </View>

              {/* Profile Info Section - Below the image */}
              <View style={styles.framelessProfileInfo}>
                
                <Text style={[styles.minimizeHint, styles.minimizeHintSecondary]}>
                  Tap the × to minimize
                </Text>
              </View>
            </View>
          ) : (
            // Normal layout: Side-by-side
            <View style={styles.profileHeader}>
              <TouchableOpacity
                style={styles.avatarContainer}
                onPress={handleImagePress}
              >
                {renderMemberAvatar()}

                {/* Expand icon overlay */}
                <View style={styles.expandImageOverlay}>
                  <Ionicons name="expand" size={16} color={colors.white} />
                </View>
              </TouchableOpacity>

              <View style={styles.profileInfo}>
                <Text style={[styles.memberName, styles.memberNameText]}>
                  {memberData.user?.first_name || memberData.first_name} {memberData.user?.last_name || memberData.last_name}
                </Text>
                <Text style={[styles.memberEmail, styles.memberEmailSecondary]}>
                  {memberData.user?.email || memberData.email}
                </Text>
              </View>
            </View>
          )}
        </Card>
        {memberStats && (
          <Card variant="outlined" padding="none" style={styles.statsCard}>
            <View style={styles.statsContent}>
              <Text style={styles.statsTitle}>
                Member Statistics
              </Text>

              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <View style={styles.statCard}>
                    <View style={styles.statIconRow}>
                      <View style={styles.statIconBoxPrimary}>
                        <Ionicons name="wallet" size={20} color={colors.primary} />
                      </View>
                      <Text style={styles.statLabel}>Total Contributions</Text>
                    </View>
                    <Text style={styles.statValue}>{formatCurrency(memberStats.total_contributions)}</Text>
                  </View>
                </View>
                <View style={styles.statItem}>
                  <View style={styles.statCard}>
                    <View style={styles.statIconRow}>
                      <View style={styles.statIconBoxSuccess}>
                        <Ionicons name="card" size={20} color={colors.success} />
                      </View>
                      <Text style={styles.statLabel}>Loans Taken</Text>
                    </View>
                    <Text style={styles.statValue}>{memberStats.loans_count || 0}</Text>
                  </View>
                </View>
                <View style={styles.statItem}>
                  <View style={styles.statCard}>
                    <View style={styles.statIconRow}>
                      <View style={styles.statIconBoxWarning}>
                        <Ionicons name="calendar" size={20} color={colors.warning} />
                      </View>
                      <Text style={styles.statLabel}>Meetings Attended</Text>
                    </View>
                    <Text style={styles.statValue}>{memberStats.meetings_attended || 0}</Text>
                  </View>
                </View>
                <View style={styles.statItem}>
                  <View style={styles.statCard}>
                    <View style={styles.statIconRow}>
                      <View style={styles.statIconBoxInfo}>
                        <Ionicons name="star" size={20} color={colors.info} />
                      </View>
                      <Text style={styles.statLabel}>Member Rating</Text>
                    </View>
                    <Text style={styles.statValue}>{memberStats.rating || 0}/5</Text>
                  </View>
                </View>
              </View>
            </View>
          </Card>
        )}

{/* Combined Member Details & Disbursement Approvals Card */}
        {(userRole === 'chairperson' || userRole === 'secretary' || userRole === 'treasurer' || 
          approvalHistory.some(item => item.randomVerifierId === user?.id || item.verifierId === user?.id)) && (
          <Card variant="outlined" padding="none" style={styles.statsCard}>
            <View style={isDesktop ? styles.combinedCardRow : styles.combinedCardColumn}>
              {/* Member Details Section */}
              <View style={isDesktop ? styles.combinedCardLeft : styles.combinedCardFull}>
                {renderMemberDetailsSection(true)}
              </View>

              {/* Divider for desktop */}
              {isDesktop && (
                <View style={styles.combinedDivider} />
              )}

              {/* Disbursement Approvals Section */}
              <View style={isDesktop ? styles.combinedCardRight : styles.combinedCardFull}>
                {renderDisbursementApprovalsSection(true)}
              </View>
            </View>
          </Card>
        )}

        {/* Service Fee Payments */}
        {renderServiceFeeSection()}

        {/* Actions */}
        {userRole === 'chairperson' && memberData.user_id !== user.id && (
          <Card variant="outlined" padding="none" style={styles.actionsCard}>
            <View style={styles.actionsCardContent}>
              <Text style={[styles.sectionTitle, styles.sectionTitleText]}>
                Actions
              </Text>

              <TouchableOpacity
                style={[styles.actionButton, styles.removeButton, styles.removeButtonOutline]}
                onPress={handleRemoveMember}
              >
                <Ionicons name="person-remove" size={20} color={colors.error} />
                <Text style={[styles.actionButtonText, styles.actionButtonTextError]}>
                  Remove from Chama
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

      </ScrollView>
      )}

      <OTPVerificationModal
        visible={showOTPModal}
        onClose={() => {
          setShowOTPModal(false);
          setSelectedApprovalItem(null);
          setApprovalActionType(null);
        }}
        title={approvalActionType === 'approve' ? 'Approve Disbursement' : 'Verify Disbursement'}
        subtitle={`Enter the OTP sent to your phone to ${approvalActionType || 'verify'} this ${selectedApprovalItem?.type || 'disbursement'}`}
        onVerify={handleVerifyOTP}
        onResend={handleResendOTP}
        loading={otpLoading}
        itemType={selectedApprovalItem?.type}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  containerBackground: {
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerSurface: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerTitleText: {
    color: colors.text,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
   inlineLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    flexDirection: 'row',
    gap: 10,
  },
  inlineLoadingText: {
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
  },
  errorTitleText: {
    color: colors.text,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  errorTextSecondary: {
    color: colors.textSecondary,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  goBackButton: {
    backgroundColor: colors.primary,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  profileCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  framelessCard: {
    padding: 0,
    overflow: 'hidden',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderPrimary: {
    backgroundColor: colors.primary,
  },
  avatarText: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '600',
  },
  expandImageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.info + '90',
  },
  framelessProfileLayout: {
    position: 'relative',
    overflow: 'hidden',
  },
  minimizeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 12,
  },
  framelessImageContainer: {
    width: '100%',
    alignItems: 'center',
  },
  expandedAvatar: {
    width: '100%',
    height: 350,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  expandedAvatarPlaceholder: {
    width: '100%',
    height: 350,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedAvatarText: {
    fontSize: 120,
    fontWeight: '600',
  },
  framelessProfileInfo: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'transparent',
  },
  minimizeHint: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 12,
  },
  minimizeHintSecondary: {
    color: colors.textSecondary,
  },
  profileInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberNameText: {
    color: colors.text,
  },
  memberEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  memberEmailSecondary: {
    color: colors.textSecondary,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  roleBadgeWarning: {
    backgroundColor: colors.warning + '20',
  },
  roleBadgeMuted: {
    backgroundColor: colors.textSecondary + '20',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  roleTextWarning: {
    color: colors.warning,
  },
  roleTextMuted: {
    color: colors.textSecondary,
  },
  statsCard: {
    borderRadius: 12,
    marginBottom: 16,
  },
  statsContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  statsTitle: {
    color: colors.text,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  statCard: {
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIconBoxPrimary: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  statIconBoxSuccess: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.success + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  statIconBoxWarning: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.warning + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  statIconBoxInfo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.info + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  sectionTitleText: {
    color: colors.text,
  },
  actionsCard: {
    borderRadius: 12,
    marginBottom: 16,
    marginTop: 32,
  },
  actionsCardContent: {
    padding: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  removeButton: {
    marginBottom: 8,
  },
  removeButtonOutline: {
    borderColor: colors.error,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  actionButtonTextError: {
    color: colors.error,
  },
  detailsCard: {
    borderRadius: 12,
    marginBottom: 16,
  },
  detailsCardContent: {
    padding: 16,
  },
  detailsTitle: {
    color: colors.text,
    marginBottom: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  detailsTableContainer: {
    width: '100%',
  },
  tableScrollArea: {
    width: '100%',
  },
  tableScrollAreaContent: {
    flexGrow: 1,
  },
  detailsTableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  detailsTableHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'left',
    color: colors.primary,
  },
  detailsTable: {
    marginTop: 8,
  },
  tableRowEven: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  tableRowOdd: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  tableLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tableValue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableValueText: {
    fontSize: 12,
    flex: 1,
    color: colors.text,
  },
  tableValueTextPrimary: {
    fontSize: 12,
    flex: 1,
    color: colors.primary,
  },
  tableValueTextSuccess: {
    fontSize: 12,
    flex: 1,
    color: colors.success,
  },
  tableValueTextError: {
    fontSize: 12,
    flex: 1,
    color: colors.error,
  },
  combinedCardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  combinedCardColumn: {
    flexDirection: 'column',
  },
  combinedCardLeft: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  combinedCardRight: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  combinedCardFull: {
    width: '100%',
  },
  combinedDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  combinedSectionContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  combinedSectionContentDesktop: {
    flex: 1,
    minWidth: 0,
  },
  combinedSectionContentStacked: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  combinedSectionTitle: {
    color: colors.text,
    marginBottom: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  feeCard: {
    borderRadius: 12,
    marginBottom: 16,
  },
  feeCardContent: {
    padding: 16,
  },
  feeCardTitle: {
    color: colors.text,
    marginBottom: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  feeLoadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  feeTableWrapper: {
    minWidth: 320,
  },
  feeEmptyRow: {
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  feeEmptyCell: {
    fontSize: 13,
    textAlign: 'center',
    flex: 1,
  },
  feeTableScroll: {
    maxHeight: 300,
  },
  feeTable: {
    minWidth: 380,
  },
  feeTableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    backgroundColor: colors.primary + '10',
    alignItems: 'center',
  },
  feeTableHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  feeTableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
  },
  feeTableCell: {
    flex: 1,
    fontSize: 12,
  },
  feeStatusCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feeStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  feePayButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  feePayButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  feeReceiptButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    borderWidth: 1,
  },
  feeReceiptButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  approvalCard: {
    borderRadius: 12,
    marginBottom: 16,
    marginTop: 16,
  },
  approvalCardContent: {
    padding: 16,
  },
  approvalLoadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  approvalEmptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalEmptyText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  approvalTableScroll: {
    maxHeight: 300,
  },
  approvalTableHorizontalContent: {
    flexGrow: 1,
  },
  approvalTable: {
    minWidth: 400,
  },
  approvalTableCombinedDesktop: {
    minWidth: 320,
    width: '100%',
  },
  approvalTableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    backgroundColor: colors.primary + '10',
    alignItems: 'center',
  },
  approvalTableHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  approvalTableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
  },
  approvalTableCell: {
    flex: 1,
    fontSize: 12,
  },
  approvalStatusCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  approvalStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  approvalViewText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default ViewMember;
