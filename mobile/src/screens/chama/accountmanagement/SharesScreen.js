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

const SharesScreen = ({ navigation, route }) => {
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
        // Auto-use user's phone number for M-Pesa STK Push
        const rawPhone = user?.phone || user?.phone_number || user?.phoneNumber || '';
        
        // Validate phone using the service
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
          description: 'Share purchase'
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
      <View style={styles.rowLeft}>
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
      <View style={styles.rowRight}>
        <Text style={[styles.rowAmount, { color: colors.primary }]}>
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
      <View style={styles.rowLeft}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>
          {item.description || 'Share Purchase'}
        </Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
          {formatDate(item.date)}
        </Text>
      </View>
      <View style={styles.rowRight}>
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        {offerings.length > 0 && (
          <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden', marginBottom: spacing.md }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm }}>
              Available Shares
            </Text>
            <FlatList
              data={offerings}
              renderItem={renderOfferingRow}
              keyExtractor={(item) => item.id?.toString() || item.name}
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
              Your Records
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
            data={shares}
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
            ListEmptyComponent={!loading && shares.length === 0 && renderEmpty()}
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
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Buy Shares
              </Text>
              <TouchableOpacity onPress={() => setShowBuyModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.paymentToggle}>
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'mpesa' && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
                  { borderColor: colors.border },
                ]}
                onPress={() => setPaymentMethod('mpesa')}
              >
                <Ionicons name="phone-portrait" size={18} color={paymentMethod === 'mpesa' ? colors.primary : colors.textSecondary} />
                <Text style={[styles.paymentLabel, { color: paymentMethod === 'mpesa' ? colors.primary : colors.textSecondary }]}>
                  M-Pesa STK Push
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'personal' && { backgroundColor: colors.success + '20', borderColor: colors.success },
                  { borderColor: colors.border },
                ]}
                onPress={() => setPaymentMethod('personal')}
              >
                <Ionicons name="wallet" size={18} color={paymentMethod === 'personal' ? colors.success : colors.textSecondary} />
                <Text style={[styles.paymentLabel, { color: paymentMethod === 'personal' ? colors.success : colors.textSecondary }]}>
                  Personal Wallet
                </Text>
              </TouchableOpacity>
            </View>

            {paymentMethod === 'mpesa' && (
              <View style={[styles.hintBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                <Ionicons name="information-circle" size={16} color={colors.primary} />
                <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                  M-Pesa will use your registered phone number automatically
                </Text>
              </View>
            )}

            {paymentMethod === 'personal' && (
              <View style={[styles.hintBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                <Ionicons name="information-circle" size={16} color={colors.primary} />
                <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                  Personal wallet balance: {formatCurrency(personalBalance)}
                </Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Amount (KES)</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
                ]}
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

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowBuyModal(false)}
                style={{ backgroundColor: colors.textSecondary }}
              />
              <Button
                title="Purchase"
                onPress={handleBuyShares}
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalContent: { borderRadius: borderRadius.lg, padding: spacing.lg, width: '90%', maxWidth: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: typography.fontSize.lg, fontWeight: '600' },
  paymentToggle: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  paymentOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1 },
  paymentLabel: { fontSize: typography.fontSize.sm, fontWeight: '500' },
  formGroup: { marginBottom: spacing.md },
  label: { fontSize: typography.fontSize.sm, fontWeight: '500', marginBottom: spacing.xs },
  input: { borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.fontSize.sm },
  hintBox: { padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  hintText: { fontSize: typography.fontSize.sm },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
});

export default SharesScreen;
