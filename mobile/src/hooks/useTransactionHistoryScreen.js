import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ApiService from '../services/api';
import { useApp } from '../context/AppContext';
import { downloadBackendPdf } from '../services/pdfDownload';

const useTransactionHistoryScreen = ({ navigation }) => {
  const { user } = useApp();

  const [filter, setFilter] = useState('all');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [statementLoading, setStatementLoading] = useState(false);
  const [showTransactionMenu, setShowTransactionMenu] = useState(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const fetchRef = useRef(false);

  // Wallet statement as a table-based PDF from the backend (same style as the
  // loan report). Pass a `type` ('all' | deposit | withdrawal | transfer) to
  // scope it; defaults to the active filter.
  const handleDownloadStatement = useCallback(async (type) => {
    if (statementLoading) return;
    const t = type || filter || 'all';
    setStatementLoading(true);
    try {
      const typeParam = t && t !== 'all' ? `?type=${encodeURIComponent(t)}` : '';
      await downloadBackendPdf({
        path: `/wallets/transactions/report${typeParam}`,
        fileName: `VaultKe_Wallet_Statement_${t}_${new Date().toISOString().split('T')[0]}.pdf`,
        dialogTitle: 'Wallet statement',
      });
    } catch (error) {
      Alert.alert('Statement failed', error.message || 'Could not generate the statement.', [{ text: 'OK' }]);
    } finally {
      setStatementLoading(false);
    }
  }, [filter, statementLoading]);

  const loadAllUserTransactions = useCallback(async () => {
    if (fetchRef.current) return;
    fetchRef.current = true;

    try {
      const response = await ApiService.getTransactions(100, 0);

      if (response.success && Array.isArray(response.data)) {
        const formattedTransactions = response.data.map((tx) => ({
          id: tx.id,
          type: tx.type,
          status: tx.status,
          amount:
            tx.type === 'deposit' ||
            tx.type === 'contribution' ||
            tx.type === 'welfare_contribution'
              ? Math.abs(tx.amount || 0)
              : -Math.abs(tx.amount || 0),
          currency: tx.currency,
          description: tx.description,
          reference: tx.reference,
          paymentMethod: tx.paymentMethod,
          fees: tx.fees,
          initiatedBy: tx.initiatedBy,
          recipientId: tx.recipientId,
          date: tx.createdAt,
          updatedAt: tx.updatedAt,
          chamaId: tx.chamaId,
          metadata: tx.metadata,
          chamaName: tx.chamaName,
          contributionType: tx.contributionType,
        }));
        // Filter to only include transactions relevant to the current user
        const extractUserId = (val) => {
          if (!val) return null;
          if (typeof val === 'string' || typeof val === 'number') return String(val);
          if (typeof val === 'object') return String(val.id || val.userId || val._id || (val.user && val.user.id) || '');
          return null;
        };

        const currentUserId = user?.id ? String(user.id) : null;
        const userTransactions = formattedTransactions.filter((tx) => {
          const initiator = extractUserId(tx.initiatedBy);
          const recipient = extractUserId(tx.recipientId) || extractUserId(tx.metadata?.userId) || extractUserId(tx.metadata?.recipientId);
          return (!currentUserId) || initiator === currentUserId || recipient === currentUserId;
        });

        setTransactions(userTransactions);
        return;
      }

      setTransactions([]);
    } catch (error) {
      console.error('Error loading transactions:', error);
      setTransactions([]);
    } finally {
      fetchRef.current = false;
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAllUserTransactions();
    } catch (error) {
      console.warn('Transaction history refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadAllUserTransactions]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const initializeData = async () => {
        if (isActive) {
          setLoading(true);
        }
        await loadAllUserTransactions();
        if (isActive) {
          setLoading(false);
        }
      };
      initializeData();
      return () => {
        isActive = false;
      };
    }, [loadAllUserTransactions])
  );

  const filterTypes = [
    { id: 'all', name: 'All', icon: 'list' },
    { id: 'deposit', name: 'Deposits', icon: 'arrow-down-circle' },
    { id: 'withdrawal', name: 'Withdrawals', icon: 'arrow-up-circle' },
    { id: 'transfer', name: 'Transfers', icon: 'swap-horizontal' },
  ];

  const filteredTransactions = filter === 'all'
    ? transactions
    : transactions.filter((t) => t.type === filter);

  const formatDate = useCallback((dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const getReceiptFileName = useCallback((receiptId) => {
    return `VaultKe_Receipt_${receiptId}_${new Date().toISOString().split('T')[0]}.pdf`;
  }, []);

  const buildUserInfo = useCallback(() => {
    const firstName = user?.firstName || '';
    const lastName = user?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'User';
    return {
      name: fullName,
      firstName,
      lastName,
      email: user?.email || '',
      phone: user?.phone || '',
      isPersonalTransaction: true,
    };
  }, [user]);

  return {
    user,
    filter,
    setFilter,
    transactions,
    loading,
    refreshing,
    receiptLoading,
    setReceiptLoading,
    statementLoading,
    handleDownloadStatement,
    showTransactionMenu,
    setShowTransactionMenu,
    showHeaderMenu,
    setShowHeaderMenu,
    filterTypes,
    filteredTransactions,
    formatDate,
    getReceiptFileName,
    buildUserInfo,
    loadAllUserTransactions,
    onRefresh,
  };
};

export default useTransactionHistoryScreen;
