import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ApiService from '../services/api';
import { useApp } from '../context/AppContext';

const useTransactionHistoryScreen = ({ navigation }) => {
  const { user } = useApp();

  const [filter, setFilter] = useState('all');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [showTransactionMenu, setShowTransactionMenu] = useState(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const fetchRef = useRef(false);

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
        setTransactions(formattedTransactions);
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
