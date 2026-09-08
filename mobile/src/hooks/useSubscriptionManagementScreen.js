import { useState, useEffect, useCallback } from 'react';
import { Alert, Toast } from 'react-native';
import { useApp } from '../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, breakpoints } from '../utils/theme';
import api from '../services/api';
import { getChamaSubscriptionPayments, paySubscriptionPayment } from '../services/api/chamaEndpoints';
import { downloadBackendPdf, downloadTransactionReceiptPdf } from '../services/pdfDownload';
import { Dimensions } from 'react-native';

const useSubscriptionManagementScreen = ({ route }) => {
  const { chamaId } = route.params;
  const { theme, userRole, user } = useApp();
  const colors = getThemeColors(theme);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isDesktop = screenWidth >= breakpoints.lg;

  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [page, setPage] = useState(1);
  const [memberRole, setMemberRole] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const PER_PAGE = 12;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    loadSubscriptions();
    loadMemberRole();
  }, [chamaId]);

  const loadMemberRole = async () => {
    try {
      const response = await api.makeRequest(`/chamas/${chamaId}/members`);
      if (response.success && response.data) {
        const members = Array.isArray(response.data) ? response.data : [response.data];
        const currentUser = members.find(m => m.userId === user?.id || m.user_id === user?.id);
        if (currentUser) {
          const role = (currentUser.role || currentUser.memberRole || '').toLowerCase();
          setMemberRole(role || null);
        }
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Failed to load member role',
        text2: error.message || 'Please try again',
      });
    }
  };

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const response = await getChamaSubscriptionPayments(chamaId);
      if (response.success && response.data) {
        setSubscriptions(response.data);
      } else {
        setSubscriptions([]);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Failed to load subscriptions',
        text2: error.message || 'Please try again',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePaySubscription = async (payment) => {
    const normalizedUserRole = (userRole || '').toLowerCase();
    const normalizedMemberRole = (memberRole || '').toLowerCase();
    const canPay = ['admin'].includes(normalizedUserRole) || ['chairperson', 'treasurer'].includes(normalizedMemberRole);

    if (!canPay) {
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'Only chairperson or treasurer can initiate payments',
      });
      return;
    }

    try {
      setPayingId(payment.id);
      const response = await paySubscriptionPayment(chamaId, payment.id);
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Payment Initiated',
          text2: 'STK push sent to your phone',
        });
        loadSubscriptions();
      } else {
        const errorMsg = response.error || 'Failed to initiate payment';
        throw new Error(errorMsg);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Payment Failed',
        text2: error.message || 'Failed to initiate payment',
      });
    } finally {
      setPayingId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'KES 0';
    return `KES ${Number(amount).toLocaleString()}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return colors.success;
      case 'pending': return colors.warning;
      case 'overdue': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return 'checkmark-circle';
      case 'pending': return 'time';
      case 'overdue': return 'alert-circle';
      default: return 'help-circle';
    }
  };

  const getReceiptId = (sub) => {
    return `RCP-${String(sub?.transactionId || sub?.id || Date.now()).substring(0, 8).toUpperCase()}`;
  };

  // A single subscription payment IS a transaction — its receipt is the
  // backend-rendered transaction receipt PDF (same style as the loan report).
  const handlePrintSubscriptionReceipt = async (sub) => {
    if (!sub) return;
    const txnId = sub.transactionId || sub.transaction_id;
    if (!txnId) {
      Alert.alert('Receipt not ready', 'A receipt is available once the payment is confirmed.', [{ text: 'OK' }]);
      return;
    }
    setReceiptLoading(true);
    try {
      await downloadTransactionReceiptPdf(txnId);
    } catch (error) {
      Alert.alert('Receipt Failed', error.message || 'Failed to generate the receipt.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  // "Invoice" and "Receipt" now resolve to the same backend PDF.
  const handleDownloadInvoice = handlePrintSubscriptionReceipt;

  // The whole subscription ledger as a table-based PDF from the backend.
  const handlePrintAllPaidSubscriptions = async () => {
    setReceiptLoading(true);
    try {
      await downloadBackendPdf({
        path: `/chamas/${chamaId}/subscription-payments/report`,
        fileName: `VaultKe_Subscriptions_${new Date().toISOString().split('T')[0]}.pdf`,
        dialogTitle: 'Subscription payments statement',
      });
    } catch (error) {
      Alert.alert('Failed', error.message || 'Failed to generate the subscriptions statement.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const totalPages = Math.ceil(subscriptions.length / PER_PAGE);
  const startIndex = (page - 1) * PER_PAGE;
  const paginatedSubscriptions = subscriptions.slice(startIndex, startIndex + PER_PAGE);

  return {
    colors,
    subscriptions,
    loading,
    payingId,
    page,
    memberRole,
    receiptLoading,
    isDesktop,
    totalPages,
    startIndex,
    paginatedSubscriptions,
    setPage,
    setPayingId,
    loadSubscriptions,
    handlePaySubscription,
    formatDate,
    formatCurrency,
    getStatusColor,
    getStatusIcon,
    handlePrintSubscriptionReceipt,
    handleDownloadInvoice,
    handlePrintAllPaidSubscriptions,
  };
};

export default useSubscriptionManagementScreen;
