import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import ApiService from '../../../services/api';
import { getWalletBalance, transferMoney } from '../../../services/api/walletEndpoints';
import { getChamaDividendDeclarations } from '../../../services/api/settingsEndpoints';

const DividendsScreen = ({ navigation, route }) => {
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
  const [buyForm, setBuyForm] = useState({ amount: '', phone: '' });
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
        const payload = {
          phoneNumber: buyForm.phone || '',
          amount,
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
      setBuyForm({ amount: '', phone: '' });
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
      <View style={styles.rowLeft}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>
          {item.description || 'Dividend Declaration'}
        </Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
          {formatDate(item.timestamp || item.createdAt || item.created_at)}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowAmount, { color: colors.success }]}>
          {formatCurrency(item.totalAmount || item.amount)}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: (colors[item.status] || colors.textSecondary) + '20' }]}>
          <Text style={[styles.statusText, { color: colors[item.status] || colors.textSecondary }]}>
            {(item.status || 'pending').toUpperCase()}
          </Text>
        </View>
        <Button
          title="Buy"
          size="small"
          onPress={() => {
            setBuyForm({ amount: '', phone: '' });
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
      <View style={styles.rowLeft}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>
          {item.description || 'Dividend Payment'}
        </Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
          {formatDate(item.date)}
        </Text>
      </View>
      <View style={styles.rowRight}>
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        {declarations.length > 0 && (
          <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden', marginBottom: spacing.md }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm }}>
              Dividend Declarations
            </Text>
            <FlatList
              data={declarations}
              renderItem={renderDeclarationRow}
              keyExtractor={(item) => item.id?.toString()}
              contentContainerStyle={{ paddingBottom: spacing.sm }}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
              ListEmptyComponent={null}
            />
          </Card>
        )}

        <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
          <View style={styles.headerRow}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
              Dividend Records
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              {!loadingBalance && (
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  Wallet: {formatCurrency(personalBalance)}
                </Text>
              )}
              <Button
                title="Buy"
                size="small"
                icon={<Ionicons name="cash" size={14} color={colors.white} />}
                onPress={() => {
                  setShowBuyModal(true);
                  setPaymentMethod('mpesa');
                  setBuyForm({ amount: '', phone: '' });
                }}
              />
            </View>
          </View>

          <FlatList
            data={records}
            renderItem={renderRow}
            keyExtractor={(item) => item.id?.toString()}
            contentContainerStyle={{ paddingBottom: spacing.sm }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={!loading && records.length === 0 && renderEmpty()}
            scrollEnabled={true}
          />
        </Card>
      </View>

      {loading && !refreshing && <LoadingSpinner />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1 },
  rowLeft: { flex: 1 },
  rowTitle: { fontSize: typography.fontSize.sm, fontWeight: '600' },
  rowSub: { fontSize: typography.fontSize.xs, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowAmount: { fontSize: typography.fontSize.sm, fontWeight: '700' },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2, borderRadius: borderRadius.sm, marginTop: spacing.xs / 2 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: typography.fontSize.lg, fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.xs },
  emptySubtitle: { fontSize: typography.fontSize.sm, textAlign: 'center' },
});

export default DividendsScreen;
