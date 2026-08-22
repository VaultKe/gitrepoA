import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import ApiService from '../services/api';
import { useApp } from '../context/AppContext';

const useWalletScreen = ({ navigation }) => {
  const { theme, wallets, transactions, loadLocalData } = useApp();

  const [balanceLoading, setBalanceLoading] = useState(false);
  const [realTimeBalance, setRealTimeBalance] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);

  const loadRealTimeBalance = useCallback(async () => {
    try {
      setBalanceLoading(true);
      const response = await ApiService.getWalletBalance();

      if (response.success) {
        const balance = Number(response.data.balance) || 0;
        setRealTimeBalance(balance);
      } else {
        const fallbackBalance = wallets.reduce((sum, wallet) => sum + (Number(wallet.balance) || 0), 0);
        setRealTimeBalance(fallbackBalance);
      }
    } catch (error) {
      const fallbackBalance = wallets.reduce((sum, wallet) => sum + (Number(wallet.balance) || 0), 0);
      setRealTimeBalance(fallbackBalance);
    } finally {
      setBalanceLoading(false);
    }
  }, [wallets]);

  useEffect(() => {
    if (wallets.length > 0) {
      setSelectedWallet(wallets.find(w => w.type === 'personal') || wallets[0]);
    }
  }, [wallets]);

  useEffect(() => {
    setRecentTransactions(transactions.slice(0, 5));
  }, [transactions]);

  useEffect(() => {
    loadRealTimeBalance();
    const balanceInterval = setInterval(() => {
      loadRealTimeBalance();
    }, 30000);
    return () => clearInterval(balanceInterval);
  }, [loadRealTimeBalance]);

  useFocusEffect(
    useCallback(() => {
      loadRealTimeBalance();
    }, [loadRealTimeBalance])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadLocalData(),
        loadRealTimeBalance(),
      ]);
    } catch (error) {
      console.warn('Wallet refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadLocalData, loadRealTimeBalance]);

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  }, []);

  const totalBalance = useMemo(() => {
    if (typeof realTimeBalance === 'number' && !isNaN(realTimeBalance) && realTimeBalance >= 0) {
      return realTimeBalance;
    }
    const staticBalance = wallets.reduce((sum, wallet) => sum + (Number(wallet.balance) || 0), 0);
    return isNaN(staticBalance) ? 0 : staticBalance;
  }, [realTimeBalance, wallets]);

  const getWalletIcon = useCallback((type) => {
    switch (type) {
      case 'personal': return 'wallet';
      case 'chama': return 'people';
      case 'business': return 'briefcase';
      case 'savings': return 'piggy-bank';
      default: return 'card';
    }
  }, []);

  const getWalletColor = useCallback((type, colors) => {
    switch (type) {
      case 'personal': return colors.primary;
      case 'chama': return colors.secondary;
      case 'business': return colors.info;
      case 'savings': return colors.success;
      default: return colors.textSecondary;
    }
  }, []);

  const getTransactionIcon = useCallback((type) => {
    switch (type) {
      case 'deposit': return 'arrow-down';
      case 'withdrawal': return 'arrow-up';
      case 'transfer': return 'swap-horizontal';
      case 'payment': return 'card';
      default: return 'cash';
    }
  }, []);

  const getTransactionColor = useCallback((type, colors) => {
    switch (type) {
      case 'deposit': return colors.success;
      case 'withdrawal': return colors.error;
      case 'transfer': return colors.info;
      case 'payment': return colors.warning;
      default: return colors.textSecondary;
    }
  }, []);

  return {
    theme,
    wallets,
    transactions,
    balanceLoading,
    realTimeBalance,
    refreshing,
    selectedWallet,
    recentTransactions,
    totalBalance,
    loadRealTimeBalance,
    onRefresh,
    formatCurrency,
    getWalletIcon,
    getWalletColor,
    getTransactionIcon,
    getTransactionColor,
  };
};

export default useWalletScreen;
