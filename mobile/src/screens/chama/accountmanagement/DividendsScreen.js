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
import stkPushService from '../../../services/stkPushService';
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
        // Auto-use user's phone number for M-Pesa STK Push
        const rawPhone = user?.phone || user?.phone_number || user?.phoneNumber || '';
        
        // Format phone number to international format
        let userPhone = '';
        if (rawPhone) {
          userPhone = rawPhone.replace(/\D/g, ''); // Remove all non-digits
          if (userPhone.startsWith('0') && userPhone.length === 10) {
            userPhone = '254' + userPhone.substring(1);
          } else if (userPhone.length === 9) {
            // Add 254 prefix if missing
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

      <Modal
        visible={showBuyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBuyModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <View style={{ borderRadius: borderRadius.lg, padding: spacing.lg, width: '90%', maxWidth: 400, backgroundColor: colors.surface }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
              <Text style={{ fontSize: typography.fontSize.lg, fontWeight: '600', color: colors.text }}>
                Buy Dividends
              </Text>
              <TouchableOpacity onPress={() => setShowBuyModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              <TouchableOpacity
                style={[
                  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1 },
                  paymentMethod === 'mpesa' && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
                  { borderColor: colors.border },
                ]}
                onPress={() => setPaymentMethod('mpesa')}
              >
                <Ionicons name="phone-portrait" size={18} color={paymentMethod === 'mpesa' ? colors.primary : colors.textSecondary} />
                <Text style={[ { fontSize: typography.fontSize.sm, fontWeight: '500' }, { color: paymentMethod === 'mpesa' ? colors.primary : colors.textSecondary }]}>
                  M-Pesa STK Push
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1 },
                  paymentMethod === 'personal' && { backgroundColor: colors.success + '20', borderColor: colors.success },
                  { borderColor: colors.border },
                ]}
                onPress={() => setPaymentMethod('personal')}
              >
                <Ionicons name="wallet" size={18} color={paymentMethod === 'personal' ? colors.success : colors.textSecondary} />
                <Text style={[ { fontSize: typography.fontSize.sm, fontWeight: '500' }, { color: paymentMethod === 'personal' ? colors.success : colors.textSecondary }]}>
                  Personal Wallet
                </Text>
              </TouchableOpacity>
            </View>

            {paymentMethod === 'mpesa' && (
              <View style={{ padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md, backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }}>
                <Ionicons name="information-circle" size={16} color={colors.primary} />
                <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  M-Pesa will use your registered phone number automatically
                </Text>
              </View>
            )}

            {paymentMethod === 'personal' && (
              <View style={{ padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md, backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }}>
                <Ionicons name="information-circle" size={16} color={colors.primary} />
                <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  Personal wallet balance: {formatCurrency(personalBalance)}
                </Text>
              </View>
            )}

            <View style={{ marginBottom: spacing.md }}>
              <Text style={{ fontSize: typography.fontSize.sm, fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>
                Amount (KES)
              </Text>
              <TextInput
                style={{ borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.fontSize.sm, backgroundColor: colors.background, borderColor: colors.border, color: colors.text }}
                keyboardType="numeric"
                value={buyForm.amount}
                onChangeText={(text) => setBuyForm((prev) => ({ ...prev, amount: text }))}
                placeholder="Enter amount"
                placeholderTextColor={colors.textSecondary}
              />
              {paymentMethod === 'personal' && buyForm.amount && parseFloat(buyForm.amount) > personalBalance && (
                <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>
                  Insufficient balance in personal wallet
                </Text>
              )}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg }}>
              <Button
                title="Cancel"
                onPress={() => setShowBuyModal(false)}
                style={{ backgroundColor: colors.textSecondary }}
              />
              <Button
                title="Purchase"
                onPress={handleBuyDividends}
                loading={submitting}
                disabled={submitting}
                style={{ backgroundColor: colors.primary }}
              />
            </View>
          </View>
        </View>
      </Modal>
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
