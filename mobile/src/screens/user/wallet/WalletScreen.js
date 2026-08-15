import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../../context/AppContext';
import { useLightningData, useOptimisticUpdate } from '../../../hooks/useLightningData';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import ApiService from '../../../services/api';

// Generate theme-aware styles
const createThemeStyles = (colors) => ({
  safeArea: { backgroundColor: colors.background },
  totalBalanceLabel: { color: colors.textSecondary },
  totalBalanceAmount: { color: colors.text },
  sectionTitle: { color: colors.text },
  balanceLoadingText: { color: colors.textSecondary },
  refreshButton: { backgroundColor: colors.primary + '20' },
  actionButtonPrimary: { backgroundColor: colors.primary + '20' },
  actionButtonSuccess: { backgroundColor: colors.success + '20' },
  actionButtonInfo: { backgroundColor: colors.info + '20' },
  actionButtonError: { backgroundColor: colors.error + '20' },
  actionTextPrimary: { color: colors.primary },
  actionTextSuccess: { color: colors.success },
  actionTextInfo: { color: colors.info },
  actionTextError: { color: colors.error },
  quickActionCardPrimary: { backgroundColor: colors.primary + '20' },
  quickActionCardSuccess: { backgroundColor: colors.success + '20' },
  quickActionTextPrimary: { color: colors.primary },
  quickActionTextSuccess: { color: colors.success },
});

const WalletScreen = ({ navigation }) => {
  const { theme, user, wallets, transactions, loadLocalData, getCachedData, prefetchForPage } = useApp();
  const colors = getThemeColors(theme);
  const themeStyles = createThemeStyles(colors);

  const [balanceLoading, setBalanceLoading] = useState(false);
  const [realTimeBalance, setRealTimeBalance] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);

  // Load real-time balance from API
  const loadRealTimeBalance = useCallback(async () => {
    try {
      setBalanceLoading(true);
      const response = await ApiService.getWalletBalance();

      if (response.success) {
        const balance = response.data.balance || 0;
        setRealTimeBalance(balance);
      } else {
        // Fallback to static balance calculation - use current wallets state
        const fallbackBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
        setRealTimeBalance(fallbackBalance);
      }
    } catch (error) {
      // Fallback to static balance calculation - use current wallets state
      const fallbackBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
      setRealTimeBalance(fallbackBalance);
    } finally {
      setBalanceLoading(false);
    }
  }, [wallets]); // Only depend on wallets for fallback calculation

  // Effect for setting selected wallet when wallets change
  useEffect(() => {
    if (wallets.length > 0) {
      setSelectedWallet(wallets.find(w => w.type === 'personal') || wallets[0]);
    }
  }, [wallets]);

  // Effect for setting recent transactions when transactions change
  useEffect(() => {
    setRecentTransactions(transactions.slice(0, 5));
  }, [transactions]);

  // Effect for loading balance and setting up auto-refresh (only on mount)
  useEffect(() => {
    // Load real-time balance on component mount
    loadRealTimeBalance();

    // Set up auto-refresh for balance every 30 seconds
    const balanceInterval = setInterval(() => {
      loadRealTimeBalance();
    }, 30000);

    return () => {
      clearInterval(balanceInterval);
    };
  }, [loadRealTimeBalance]); // Only depend on the memoized function

  // Refresh balance when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadRealTimeBalance();
    }, [loadRealTimeBalance])
  );



  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadLocalData(),
        loadRealTimeBalance()
      ]);
    } catch (error) {
      console.warn('Wallet refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getTotalBalance = () => {
    // Always prioritize real-time balance over static wallet data
    if (realTimeBalance !== null && realTimeBalance !== undefined) {
      return realTimeBalance;
    }
    // Fallback to static calculation only if real-time balance is not available
    const staticBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
    return staticBalance;
  };

  const getWalletIcon = (type) => {
    switch (type) {
      case 'personal': return 'wallet';
      case 'chama': return 'people';
      case 'business': return 'briefcase';
      case 'savings': return 'piggy-bank';
      default: return 'card';
    }
  };

  const getWalletColor = (type) => {
    switch (type) {
      case 'personal': return colors.primary;
      case 'chama': return colors.secondary;
      case 'business': return colors.info;
      case 'savings': return colors.success;
      default: return colors.textSecondary;
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'deposit': return 'arrow-down';
      case 'withdrawal': return 'arrow-up';
      case 'transfer': return 'swap-horizontal';
      case 'payment': return 'card';
      default: return 'cash';
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'deposit': return colors.success;
      case 'withdrawal': return colors.error;
      case 'transfer': return colors.info;
      case 'payment': return colors.warning;
      default: return colors.textSecondary;
    }
  };

  const renderWalletHeader = () => {
    return (
      <Card style={{ margin: spacing.md }} variant="outlined">
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <Text style={[{ fontSize: typography.fontSize.base, marginBottom: spacing.sm }, themeStyles.totalBalanceLabel]}>
            Total Balance
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
            {balanceLoading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[{ fontSize: typography.fontSize.sm, fontStyle: 'italic' }, themeStyles.balanceLoadingText]}>
                  Updating...
                </Text>
              </View>
            ) : (
              <Text style={[{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.bold }, themeStyles.totalBalanceAmount]}>
                {formatCurrency(getTotalBalance())}
              </Text>
            )}
            <TouchableOpacity
              onPress={loadRealTimeBalance}
              style={[{ padding: spacing.sm, borderRadius: borderRadius.full }, themeStyles.refreshButton]}
            >
              <Ionicons name="refresh" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
          <TouchableOpacity
            style={[{ flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.lg }, themeStyles.actionButtonInfo]}
            onPress={() => navigation.navigate('Deposit')}
          >
            <Ionicons name="add" size={24} color={colors.info} />
            <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginTop: spacing.sm }, themeStyles.actionTextInfo]}>
              Top Up
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[{ flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.lg }, themeStyles.actionButtonError]}
            onPress={() => navigation.navigate('Withdraw')}
          >
            <Ionicons name="arrow-up-circle" size={24} color={colors.error} />
            <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginTop: spacing.sm }, themeStyles.actionTextError]}>
              Withdraw
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const renderQuickActionsSection = () => {
    return (
      <Card style={{ margin: spacing.md }} variant="outlined">
        <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.md }, themeStyles.sectionTitle]}>
          Quick Actions
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <TouchableOpacity
            style={[{ flex: 1, alignItems: 'center', padding: spacing.lg, borderRadius: borderRadius.lg }, themeStyles.quickActionCardPrimary]}
            onPress={() => navigation.navigate('TransactionHistory')}
          >
            <Ionicons name="list" size={24} color={colors.primary} />
            <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginTop: spacing.sm }, themeStyles.quickActionTextPrimary]}>
              History
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[{ flex: 1, alignItems: 'center', padding: spacing.lg, borderRadius: borderRadius.lg }, themeStyles.quickActionCardSuccess]}
            onPress={() => navigation.navigate('AIAssistant')}
          >
            <Ionicons name="sparkles" size={24} color={colors.success} />
            <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginTop: spacing.sm }, themeStyles.quickActionTextSuccess]}>
              AI Advisor
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[{ flex: 1 }, themeStyles.safeArea]}>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {renderWalletHeader()}
          {renderQuickActionsSection()}
        </ScrollView>

        <PageRefreshButton
          onRefresh={onRefresh}
          refreshing={refreshing}
          color={colors.primary}
          bottom={64}
        />
      </View>
    </SafeAreaView>
  );
};

export default WalletScreen;
