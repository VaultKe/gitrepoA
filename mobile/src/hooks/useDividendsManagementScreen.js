import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import ApiService from '../services/api';
import { getChamaDividendDeclarations } from '../services/api/settingsEndpoints';
import { sendApprovalNotification, showInAppToast } from '../services/disbursementNotificationService';
import { approveWelfareDisbursement } from '../services/api/welfareEndpoints';

const useDividendsManagementScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const chamaId = currentChamaId || route?.params?.chamaId;

  const [declarations, setDeclarations] = useState([]);
  const [eligibleMembers, setEligibleMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('member');
  const [showDeclareModal, setShowDeclareModal] = useState(false);
  const [form, setForm] = useState({ dividendPerShare: '', totalAmount: '', description: '', fromAccount: '' });
  const [submitting, setSubmitting] = useState(false);

  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [selectedApprovalItem, setSelectedApprovalItem] = useState(null);
  const [approvalActionType, setApprovalActionType] = useState(null);

  const loadUserRole = async () => {
    if (!user?.id || !chamaId) return;
    try {
      const response = await ApiService.getMemberRole(chamaId, user.id);
      if (response.success) {
        setUserRole(response.data?.role || 'member');
      } else {
        setUserRole('left');
      }
    } catch (error) {
      console.error('Error loading user role:', error);
      setUserRole('left');
    }
  };

  const fetchData = useCallback(async () => {
    if (!chamaId) return;
    try {
      const [declRes, eligibleRes] = await Promise.all([
        getChamaDividendDeclarations(chamaId),
        ApiService.getEligibleDividendMembers(chamaId),
      ]);

      if (declRes.success) setDeclarations(declRes.data || []);
      if (eligibleRes.success) setEligibleMembers(eligibleRes.data || []);
    } catch (error) {
      console.error('Error fetching dividend data:', error);
    } finally {
      setLoading(false);
    }
  }, [chamaId]);

  useEffect(() => {
    fetchData();
    loadUserRole();
  }, [fetchData]);

  useEffect(() => {
    if (userRole === 'left') {
      Alert.alert(
        'Access Denied',
        'You are no longer a member of this chama. You cannot access dividend management features.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [userRole, navigation]);

  const handleDeclareDividends = async () => {
    if (!form.dividendPerShare || !form.totalAmount) {
      Alert.alert('Validation', 'Please fill dividend per share and total amount.');
      return;
    }

    if (!chamaId) {
      Alert.alert('Error', 'Missing chama ID.');
      return;
    }

    setSubmitting(true);
    try {
      const eligibleMembersPayload = (eligibleMembers || []).map(m => ({
        id: m.user_id || m.id || '',
        name: m.first_name && m.last_name ? `${m.first_name} ${m.last_name}` : (m.name || m.member_name || 'Member'),
        sharesOwned: m.shares_owned || 1,
      }));

      const payload = {
        type: 'dividend',
        category: 'bulk',
        dividendPerShare: parseFloat(form.dividendPerShare),
        totalAmount: parseFloat(form.totalAmount),
        description: form.description || 'Dividend declaration',
        eligibleMembers: eligibleMembersPayload,
        fromAccount: form.fromAccount || `wallet-${chamaId}-dividends`,
        initiatedBy: 'Admin',
        initiatedById: 'admin',
        timestamp: new Date().toISOString(),
        transactionId: `TXN_${Date.now()}`,
        securityHash: 'hash',
      };

      const response = await ApiService.declareChamaDividends(chamaId, payload);

      if (response.success) {
        Alert.alert('Success', 'Dividend declaration created successfully.');
        setShowDeclareModal(false);
        setForm({ dividendPerShare: '', totalAmount: '', description: '', fromAccount: '' });
        fetchData();
      } else {
        Alert.alert('Error', response.error || 'Failed to declare dividends.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to declare dividends. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const canApproveDividends = () => {
    if (userRole === 'left') return false;
    const normalizedUserRole = (userRole || '').toLowerCase();
    return ['chairperson', 'secretary', 'treasurer'].includes(normalizedUserRole);
  };

  const handleInitiateApprove = (declaration) => {
    if (userRole === 'left') {
      Alert.alert('Access Denied', 'You are no longer a member of this chama and cannot approve dividends.');
      return;
    }
    if (!canApproveDividends()) {
      Alert.alert('Access Denied', 'You do not have permission to approve dividends.');
      return;
    }
    if (declaration.status === 'approved' || declaration.status === 'disbursed') {
      Alert.alert('Info', 'This dividend declaration has already been processed.');
      return;
    }
    setSelectedApprovalItem(declaration);
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
        approvedById: user.id,
        approvedByName: user?.fullName || user?.firstName || user?.email || 'Unknown',
        timestamp: new Date().toISOString(),
        chamaId,
        disbursementType: 'dividends',
        itemLabel: selectedApprovalItem.description || selectedApprovalItem.type || `Declaration #${selectedApprovalItem.id}`,
        amount: selectedApprovalItem.totalAmount || selectedApprovalItem.amount || 0,
      };

      const response = await approveWelfareDisbursement(chamaId, selectedApprovalItem.id, approvalData);

      if (response.success) {
        showInAppToast({
          title: 'Success',
          message: `Dividend ${approvalActionType}d successfully.`,
          type: 'success',
        });

        await sendApprovalNotification({
          chamaId,
          recipientUserId: user.id,
          recipientName: user?.fullName || user?.firstName || 'You',
          recipientPhone: user?.phone || user?.phone_number,
          recipientEmail: user?.email,
          disbursementType: 'dividends',
          disbursementId: selectedApprovalItem.id,
          entityLabel: selectedApprovalItem.description || selectedApprovalItem.type || `Declaration #${selectedApprovalItem.id}`,
          amount: selectedApprovalItem.totalAmount || selectedApprovalItem.amount || 0,
          action: approvalActionType,
          initiatedBy: userRole,
          chamaName: '',
        });

        setShowOTPModal(false);
        setSelectedApprovalItem(null);
        setApprovalActionType(null);
        fetchData();
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
        chamaId,
        recipientUserId: user.id,
        recipientName: user?.fullName || user?.firstName || 'You',
        recipientPhone: user?.phone || user?.phone_number,
        recipientEmail: user?.email,
        disbursementType: 'dividends',
        disbursementId: selectedApprovalItem.id,
        entityLabel: selectedApprovalItem.description || selectedApprovalItem.type || `Declaration #${selectedApprovalItem.id}`,
        amount: selectedApprovalItem.totalAmount || selectedApprovalItem.amount || 0,
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
    const val = amount || 0;
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(val);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '-';
    }
  };

  return {
    declarations,
    eligibleMembers,
    loading,
    userRole,
    showDeclareModal,
    setShowDeclareModal,
    form,
    setForm,
    submitting,
    showOTPModal,
    setShowOTPModal,
    otpLoading,
    selectedApprovalItem,
    setSelectedApprovalItem,
    approvalActionType,
    setApprovalActionType,
    formatCurrency,
    formatDate,
    handleDeclareDividends,
    canApproveDividends,
    handleInitiateApprove,
    handleVerifyOTP,
    handleResendOTP,
    fetchData,
    chamaId,
    user,
  };
};

export default useDividendsManagementScreen;
