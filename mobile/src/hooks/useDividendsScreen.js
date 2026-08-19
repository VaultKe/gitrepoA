import { useState, useEffect, useCallback } from 'react';
import { View, Text, Alert, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, FlatList, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import ApiService from '../services/api';
import { getWalletBalance, transferMoney } from '../services/api/walletEndpoints';
import stkPushService from '../services/stkPushService';
import { getChamaDividendDeclarations } from '../services/api/settingsEndpoints';
import { getThemeColors } from '../utils/theme';
import { spacing, typography, borderRadius } from '../utils/theme';
import Button from '../components/common/Button';

const useDividendsScreen = ({ navigation, route }) => {
  const { theme } = useApp();
  const { currentChamaId, user } = useChamaContext();
  const colors = getThemeColors(theme);

  const [records, setRecords] = useState([]);
  const [declarations, setDeclarations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [personalBalance, setPersonalBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('mpesa');
  const [buyForm, setBuyForm] = useState({ amount: '' });
  const [submitting, setSubmitting] = useState(false);

  const chamaId = currentChamaId || route?.params?.chamaId;

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

  const fetchDeclarations = useCallback(async () => {
    if (!chamaId) return;
    try {
      const response = await getChamaDividendDeclarations(chamaId);
      if (response.success) {
        setDeclarations(response.data || []);
      } else {
        console.error('Failed to fetch declarations:', response.error);
      }
    } catch (error) {
      console.error('Error fetching dividend declarations:', error);
    }
  }, [chamaId]);

  const fetchDividends = useCallback(async (isRefresh = false) => {
    if (!chamaId) return;
    if (!isRefresh) setLoading(true);

    try {
      const response = await ApiService.makeRequest(
        `/chamas/${chamaId}/subwallets/dividends/transactions`
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
        setRecords(mapped);
      }
    } catch (error) {
      console.error('Error fetching dividends:', error);
    } finally {
      if (!isRefresh) setLoading(false);
      setRefreshing(false);
    }
  }, [chamaId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDividends(true);
    fetchDeclarations();
  }, [fetchDividends, fetchDeclarations]);

  useEffect(() => {
    const loadInitialData = async () => {
      if (chamaId) {
        await Promise.all([
          fetchDeclarations(),
          fetchDividends(),
          fetchPersonalBalance(),
        ]);
        setLoading(false);
      }
    };
    loadInitialData();
  }, [chamaId, fetchDeclarations, fetchDividends, fetchPersonalBalance]);

  const handleBuyDividends = async () => {
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
          recipientId: `wallet-${chamaId}-dividends`,
          description: 'Dividend purchase',
        });

        if (response.success) {
          Alert.alert('Success', `Dividends purchased for KES ${amount.toLocaleString()} from your personal wallet.`);
        } else {
          Alert.alert('Error', response.error || 'Failed to purchase dividends from personal wallet.');
        }
      } else {
        const rawPhone = user?.phone || user?.phone_number || user?.phoneNumber || '';
        
        let userPhone = '';
        if (rawPhone) {
          userPhone = rawPhone.replace(/\D/g, '');
          if (userPhone.startsWith('0') && userPhone.length === 10) {
            userPhone = '254' + userPhone.substring(1);
          } else if (userPhone.length === 9) {
            userPhone = '254' + userPhone;
          }
        }
        
        if (!userPhone) {
          Alert.alert('Error', 'No phone number registered. Please update your profile with a phone number.');
          setSubmitting(false);
          return;
        }

        const payload = {
          PhoneNumber: userPhone,
          Amount: parseFloat(amount),
          description: 'Dividend purchase',
        };
        const response = await ApiService.makeRequest(
          `/chamas/${chamaId}/subwallets/dividends/pay`,
          {
            method: 'POST',
            body: payload,
          }
        );

        if (response.success) {
          Alert.alert('Success', 'Dividend purchase initiated successfully.');
        } else {
          Alert.alert('Error', response.error || 'Failed to purchase dividends.');
        }
      }

      setShowBuyModal(false);
      setBuyForm({ amount: '' });
      fetchDividends(true);
      fetchPersonalBalance();
    } catch (error) {
      Alert.alert('Error', 'Failed to purchase dividends. Please try again.');
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

  const renderDeclarationRow = ({ item }) => (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.declarationCell}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>
          {item.description || 'Dividend Declaration'}
        </Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
          {formatDate(item.timestamp || item.createdAt || item.created_at)}
        </Text>
      </View>
      <View style={styles.amountCell}>
        <Text style={[styles.rowAmount, { color: colors.success }]}>
          {formatCurrency(item.totalAmount || item.amount)}
        </Text>
      </View>
      <View style={styles.actionsCell}>
        <View style={[styles.statusBadge, { backgroundColor: (colors[item.status] || colors.textSecondary) + '20' }]}>
          <Text style={[styles.statusText, { color: colors[item.status] || colors.textSecondary }]}>
            {(item.status || 'pending').toUpperCase()}
          </Text>
        </View>
        <Button
          title="Buy"
          size="small"
          onPress={() => {
            setBuyForm({ amount: String(item?.totalAmount || item?.amount || '') });
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
          {item.description || 'Dividend Payment'}
        </Text>
      </View>
      <View style={styles.dateCell}>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
          {formatDate(item.date)}
        </Text>
      </View>
      <View style={styles.amountCell}>
        <Text style={[styles.rowAmount, { color: colors.success }]}>
          +{formatCurrency(item.amount)}
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
      <Ionicons name="cash-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Dividend Records
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Dividend payments will appear here once declared by the chama.
      </Text>
    </View>
  );

  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      alignItems: 'center',
      gap: 12,
    },
    declarationCell: {
      flex: 2,
    },
    rowTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 2,
    },
    rowSub: {
      fontSize: 12,
    },
    amountCell: {
      flex: 1,
      alignItems: 'center',
    },
    rowAmount: {
      fontSize: 14,
      fontWeight: '700',
    },
    actionsCell: {
      flex: 1.5,
      alignItems: 'flex-end',
      gap: 8,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      alignSelf: 'flex-end',
    },
    statusText: {
      fontSize: 11,
      fontWeight: '700',
    },
    descriptionCell: {
      flex: 2,
    },
    dateCell: {
      flex: 1,
      alignItems: 'center',
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 64,
      paddingHorizontal: 32,
      gap: 12,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
  });

  return {
    colors,
    records,
    declarations,
    loading,
    refreshing,
    personalBalance,
    loadingBalance,
    showBuyModal,
    paymentMethod,
    buyForm,
    submitting,
    setPaymentMethod,
    setShowBuyModal,
    setBuyForm,
    onRefresh,
    handleBuyDividends,
    formatCurrency,
    formatDate,
    getStatusColor,
    renderDeclarationRow,
    renderRow,
    renderEmpty,
  };
};

export default useDividendsScreen;
