import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import { getThemeColors, spacing } from '../utils/theme';
import Button from '../components/common/Button';
import ApiService from '../services/api';
import { getWalletBalance, transferMoney } from '../services/api/walletEndpoints';
import stkPushService from '../services/stkPushService';

export const useSharesScreen = (route, styles) => {
  const { theme } = useApp();
  const { currentChamaId, user } = useChamaContext();
  const colors = getThemeColors(theme);

  const [shares, setShares] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [personalBalance, setPersonalBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('mpesa');
  const [buyForm, setBuyForm] = useState({ amount: '' });
  const [submitting, setSubmitting] = useState(false);

  const chamaId = currentChamaId || route?.params?.chamaId;

  const fetchOfferings = useCallback(async () => {
    if (!chamaId) return;
    try {
      const response = await ApiService.getChamaShareOfferings(chamaId);
      if (response.success) {
        setOfferings(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching share offerings:', error);
    }
  }, [chamaId]);

  const fetchPersonalBalance = useCallback(async () => {
    try {
      const res = await getWalletBalance();
      if (res.success) {
        setPersonalBalance(res.data?.balance ?? res.data?.availableBalance ?? 0);
      }
    } catch (e) {
      console.warn('Failed to fetch personal wallet balance:', e);
    }
  }, []);

  const fetchShares = useCallback(async (isRefresh = false) => {
    if (!chamaId) return;
    if (!isRefresh) setLoading(true);

    try {
      const response = await ApiService.makeRequest(
        `/chamas/${chamaId}/subwallets/shares/transactions`
      );
      if (response.success) {
        const transactions = response.data || [];
        const mapped = transactions.map((tx) => ({
          id: tx.id,
          amount: tx.amount,
          date: tx.createdAt || tx.created_at,
          description: tx.description || tx.type,
          status: tx.status,
          type: tx.type,
        }));
        mapped.sort((a, b) => new Date(b.date) - new Date(a.date));
        setShares(mapped);
      }
    } catch (error) {
      console.error('Error fetching shares:', error);
    } finally {
      if (!isRefresh) setLoading(false);
      setRefreshing(false);
    }
  }, [chamaId]);

  useEffect(() => {
    fetchShares();
    fetchPersonalBalance();
    fetchOfferings();
  }, [fetchShares, fetchPersonalBalance, fetchOfferings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchShares(true);
    fetchPersonalBalance();
    fetchOfferings();
  }, [fetchShares, fetchPersonalBalance, fetchOfferings]);

  const handleBuyShares = async () => {
    const amount = parseFloat(buyForm.amount);
    if (!amount || amount <= 0) {
      Alert.alert('Validation', 'Enter a valid amount.');
      return;
    }

    setSubmitting(true);
    try {
      if (paymentMethod === 'personal') {
        if (amount > personalBalance) {
          Alert.alert('Insufficient Balance', 'Your personal wallet balance is too low for this purchase.');
          setSubmitting(false);
          return;
        }

        const response = await transferMoney({
          amount,
          recipientId: `wallet-${chamaId}-shares`,
          description: 'Share purchase',
        });

        if (response.success) {
          Alert.alert('Success', `Shares purchased for KES ${amount.toLocaleString()} from your personal wallet.`);
        } else {
          Alert.alert('Error', response.error || 'Failed to purchase shares from personal wallet.');
        }
      } else {
        const rawPhone = user?.phone || user?.phone_number || user?.phoneNumber || '';
        const phoneCheck = stkPushService.validatePhone(rawPhone);
        if (!rawPhone || !phoneCheck.valid) {
          Alert.alert('Error', 'No phone number registered or invalid format. Please update your profile with a valid phone number.');
          setSubmitting(false);
          return;
        }

        const payload = {
          phone: phoneCheck.phone,
          amount: parseFloat(amount),
          chamaId: chamaId,
          userId: user?.id,
          description: 'Share purchase',
        };
        const response = await stkPushService.startPayment(payload);

        if (response.success) {
          Alert.alert('Success', response.message || 'Check your phone for the STK prompt.');
        } else {
          Alert.alert('Error', response.message || 'Failed to purchase shares.');
        }
      }

      setShowBuyModal(false);
      setBuyForm({ amount: '' });
      fetchShares(true);
      fetchPersonalBalance();
    } catch (error) {
      Alert.alert('Error', 'Failed to purchase shares. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    const val = amount || 0;
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '-';
    }
  };

  const formatSharePrice = (price) => {
    const val = price || 0;
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const getStatusColor = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'completed':
        return colors.success;
      case 'pending':
        return colors.warning;
      case 'failed':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const renderOfferingRow = ({ item }) => (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.nameCell}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>
          {item.name || 'Share Offering'}
        </Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
          Total: {item.totalShares ?? '-'} | Available: {item.availableShares ?? item.totalShares ?? '-'}
        </Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
          {item.status ? item.status.toUpperCase() : 'OPEN'}
        </Text>
      </View>
      <View style={styles.sharesCell}>
        <Text style={[styles.rowAmount, { color: colors.primary }]}>
          {item.totalShares ?? '-'}
        </Text>
      </View>
      <View style={styles.priceCell}>
        <Text style={[styles.rowAmount, { color: colors.success }]}>
          {formatSharePrice(item.pricePerShare)}/share
        </Text>
        <Button
          title="Buy"
          size="small"
          onPress={() => {
            setBuyForm({ amount: String(item.pricePerShare ?? '') });
            setPaymentMethod('mpesa');
            setShowBuyModal(true);
          }}
          style={{ marginTop: spacing.xs }}
        />
      </View>
    </View>
  );

  const renderRow = ({ item }) => (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.descriptionCell}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>
          {item.description || 'Share Purchase'}
        </Text>
      </View>
      <View style={styles.dateCell}>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
          {formatDate(item.date)}
        </Text>
      </View>
      <View style={styles.amountCell}>
        <Text style={[styles.rowAmount, { color: colors.primary }]}>
          {formatCurrency(item.amount)}
        </Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) + '20' },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: getStatusColor(item.status) },
            ]}
          >
            {(item.status || 'pending').toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cube-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Shares Purchased
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Tap the button below to purchase shares for this chama.
      </Text>
    </View>
  );

  return {
    shares,
    offerings,
    loading,
    refreshing,
    personalBalance,
    loadingBalance,
    showBuyModal,
    setShowBuyModal,
    paymentMethod,
    setPaymentMethod,
    buyForm,
    setBuyForm,
    submitting,
    chamaId,
    onRefresh,
    handleBuyShares,
    formatCurrency,
    formatDate,
    formatSharePrice,
    getStatusColor,
    renderOfferingRow,
    renderRow,
    renderEmpty,
    isEmpty: !loading && shares.length === 0,
    colors,
  };
};
