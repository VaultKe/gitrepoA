import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import ApiService from '../../../services/api';
import Card from '../../../components/common/Card';
import { generatePDFOptimizedReceiptHTML } from '../../../services/receiptService/html/template';
import { COMPANY_INFO } from '../../../services/receiptService/config';

export default function TransactionHistoryScreen() {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  const [filter, setFilter] = useState('all');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [showTransactionMenu, setShowTransactionMenu] = useState(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  const loadTransactions = useCallback(async () => {
    try {
      let apiTransactions = [];
      try {
        const response = await ApiService.getTransactions(50, 0);
        if (response.success && response.data) {
          apiTransactions = response.data;
          const formattedTransactions = apiTransactions.map(tx => ({
            ...tx,
            date: tx.createdAt || tx.created_at,
            amount: tx.type === 'deposit' ? Math.abs(tx.amount) : -Math.abs(tx.amount),
          }));
          setTransactions(formattedTransactions);
          return;
        }
      } catch (error) {
        console.warn('Failed to load transactions from API:', error);
      }

      try {
        const localData = await AsyncStorage.getItem('cachedTransactions');
        if (localData) {
          const localTransactions = JSON.parse(localData);
          const formattedTransactions = localTransactions.map(tx => ({
            ...tx,
            date: tx.createdAt || tx.created_at,
            amount: tx.type === 'deposit' ? Math.abs(tx.amount) : -Math.abs(tx.amount),
          }));
          setTransactions(formattedTransactions);
          return;
        }
      } catch (storageError) {
        console.warn('Failed to load transactions from local storage:', storageError);
      }

      setTransactions([]);
    } catch (error) {
      console.error('Error in loadTransactions:', error);
      Alert.alert('Error', 'Failed to load transaction history');
      setTransactions([]);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  }, [loadTransactions]);

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await loadTransactions();
      setLoading(false);
    };
    initializeData();
  }, [loadTransactions]);

  const filterTypes = [
    { id: 'all', name: 'All', icon: 'list' },
    { id: 'deposit', name: 'Deposits', icon: 'arrow-down-circle' },
    { id: 'withdraw', name: 'Withdrawals', icon: 'arrow-up-circle' },
    { id: 'transfer', name: 'Transfers', icon: 'swap-horizontal' },
  ];

  const filteredTransactions = filter === 'all'
    ? transactions
    : transactions.filter(t => t.type === filter);

  const getTransactionColor = (type, amount) => {
    if (amount > 0) return colors.success;
    if (type === 'withdraw') return colors.error;
    return colors.primary;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const openTransactionReceipt = (transaction, html) => {
    const receiptId = `RCP-${String(transaction.id || Date.now()).substring(0, 8).toUpperCase()}`;
    const fileName = `VaultKe_Receipt_${receiptId}_${new Date().toISOString().split('T')[0]}.html`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      return { success: true, fileName };
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Transaction Receipt - ${receiptId}</title>
          <style>
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${html}
          <div class="no-print" style="position: fixed; top: 10px; right: 10px; background: #007bff; color: white; padding: 10px; border-radius: 5px; cursor: pointer;" onclick="window.print()">
            Click here to save as PDF
          </div>
          <script>
            window.onload = function() {
              setTimeout(() => window.print(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();

    return { success: true, fileName };
  };

  const buildUserInfo = () => {
    const firstName = user?.firstName || user?.first_name || '';
    const lastName = user?.lastName || user?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'User';
    return {
      name: fullName,
      firstName,
      lastName,
      email: user?.email || '',
      phone: user?.phone || '',
      isPersonalTransaction: true,
    };
  };

  const handleInstantDownloadReceipt = async (transaction) => {
    if (!transaction) return;
    setReceiptLoading(true);
    try {
      const html = generatePDFOptimizedReceiptHTML(transaction, 'Wallet', buildUserInfo().name, COMPANY_INFO);
      const result = openTransactionReceipt(transaction, html);
      if (result.success) {
        Alert.alert('Downloaded', `Receipt saved as ${result.fileName}`, [{ text: 'OK', style: 'default' }], { cancelable: true });
      } else {
        throw new Error(result.error || 'Download failed');
      }
    } catch (error) {
      Alert.alert('Download Failed', 'Unable to download receipt. Please try again.', [{ text: 'OK', style: 'default' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handlePrintReceipt = async (transaction) => {
    try {
      const html = generatePDFOptimizedReceiptHTML(transaction, 'Wallet', buildUserInfo().name, COMPANY_INFO);
      openTransactionReceipt(transaction, html);
    } catch (error) {
      Alert.alert('Error', 'Failed to print receipt');
    }
  };

  const handleShareReceipt = async (transaction) => {
    try {
      const html = generatePDFOptimizedReceiptHTML(transaction, 'Wallet', buildUserInfo().name, COMPANY_INFO);
      const receiptId = `RCP-${String(transaction.id || Date.now()).substring(0, 8).toUpperCase()}`;
      const fileName = `VaultKe_Receipt_${receiptId}_${new Date().toISOString().split('T')[0]}.html`;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      Alert.alert('Error', 'Failed to share receipt');
    }
  };

  const handleInstantBulkDownload = async () => {
    if (transactions.length === 0) {
      Alert.alert('No Data', 'No transactions available to download');
      return;
    }

    setReceiptLoading(true);
    try {
      Alert.alert(
        'Downloaded',
        `Transaction history download is not available yet.`,
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error) {
      Alert.alert(
        'Download Failed',
        'Unable to download transaction history. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleReceiptAction = (transaction, action) => {
    switch (action) {
      case 'download':
        handleInstantDownloadReceipt(transaction);
        break;
      case 'print':
        handlePrintReceipt(transaction);
        break;
      case 'share':
        handleShareReceipt(transaction);
        break;
    }
  };

  const handleTransactionMenuAction = (transaction, action) => {
    setShowTransactionMenu(null);
    handleReceiptAction(transaction, action);
  };

  const renderTransaction = ({ item, index }) => (
    <View style={[{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }]}>
      <Text style={{ flex: 1, fontSize: 8, color: colors.text }} numberOfLines={1}>{item.description}</Text>
      <Text style={{ flex: 1, fontSize: 8, color: colors.textSecondary, textAlign: 'center' }}>{formatDate(item.date)}</Text>
      <Text style={{ flex: 1, fontSize: 8, color: item.status === 'completed' ? colors.success : colors.warning, textAlign: 'center' }}>{item.status}</Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 8, fontWeight: typography.fontWeight.medium, color: getTransactionColor(item.type, item.amount) }}>
          {item.amount > 0 ? '+' : ''}KES {Math.abs(item.amount).toLocaleString()}
        </Text>
        <TouchableOpacity
          style={{ padding: spacing.xs }}
          onPress={() => setShowTransactionMenu(showTransactionMenu === item.id ? null : item.id)}
        >
          <Ionicons name="ellipsis-vertical" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      <View style={[{ borderBottomWidth: 1, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.xs }}
              >
                {filterTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      { flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, gap: spacing.xs, marginRight: spacing.xs, backgroundColor: colors.backgroundSecondary },
                      filter === type.id && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => setFilter(type.id)}
                  >
                    <Ionicons
                      name={type.icon}
                      size={14}
                      color={filter === type.id ? colors.white : colors.textSecondary}
                    />
                    <Text style={[
                      { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium, color: filter === type.id ? colors.white : colors.textSecondary },
                      filter === type.id && { fontWeight: '600' },
                    ]}>
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {transactions.length > 0 && (
              <TouchableOpacity
                style={{ width: 36, height: 36, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundSecondary }}
                onPress={() => setShowHeaderMenu(!showHeaderMenu)}
              >
                <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {showHeaderMenu && (
        <View style={{ position: 'absolute', top: 60, right: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, paddingVertical: spacing.xs, minWidth: 150, backgroundColor: colors.surface, borderColor: colors.border, zIndex: 1001, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 }}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm }}
            onPress={() => {
              setShowHeaderMenu(false);
              handleInstantBulkDownload();
            }}
          >
            <Ionicons name="download" size={18} color={colors.text} />
            <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.text }]}>Download All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm }}
            onPress={() => {
              setShowHeaderMenu(false);
            }}
          >
            <Ionicons name="share" size={18} color={colors.text} />
            <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.text }]}>Export</Text>
          </TouchableOpacity>
        </View>
      )}

      {showHeaderMenu && (
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}
          onPress={() => setShowHeaderMenu(false)}
          activeOpacity={1}
        />
      )}

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, marginTop: spacing.md }]}>
            Loading transactions...
          </Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: spacing.md }}>
          <Card variant="default" style={{ borderRadius: 8, overflow: 'hidden' }}>
            <FlatList
              data={filteredTransactions}
              renderItem={renderTransaction}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              onScroll={() => setShowTransactionMenu(null)}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                />
              }
              ListEmptyComponent={() => (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl }}>
                  <Ionicons name="receipt-outline" size={64} color={colors.textTertiary} />
                  <Text style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, marginTop: spacing.md }}>
                    {transactions.length === 0 ? 'No transactions yet' : 'No transactions found'}
                  </Text>
                  <Text style={{ fontSize: typography.fontSize.sm, marginTop: spacing.sm, textAlign: 'center', color: colors.textTertiary }}>
                    {transactions.length === 0
                      ? 'Start by making a deposit or transfer'
                      : 'Try changing the filter above'
                    }
                  </Text>
                </View>
              )}
            />
          </Card>
        </View>
      )}

      <Modal
        visible={!!showTransactionMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTransactionMenu(null)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}
          onPress={() => setShowTransactionMenu(null)}
          activeOpacity={1}
        >
          <View style={{ width: 220, borderRadius: borderRadius.xl, borderWidth: 1, backgroundColor: colors.surface, borderColor: colors.border, elevation: 20, overflow: 'hidden' }}>
            <View style={{ padding: spacing.md, borderBottomWidth: 1, alignItems: 'center', borderBottomColor: colors.border }}>
              <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Receipt Actions</Text>
            </View>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}
              onPress={() => handleTransactionMenuAction(
                filteredTransactions.find(t => t.id === showTransactionMenu),
                'download'
              )}
              activeOpacity={0.7}
            >
              <View style={{ width: 32, height: 32, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '20' }}>
                <Ionicons name="download-outline" size={18} color={colors.primary} />
              </View>
              <Text style={[{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: colors.text, flex: 1 }]}>Download Receipt</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}
              onPress={() => handleTransactionMenuAction(
                filteredTransactions.find(t => t.id === showTransactionMenu),
                'print'
              )}
              activeOpacity={0.7}
            >
              <View style={{ width: 32, height: 32, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success + '20' }}>
                <Ionicons name="print-outline" size={18} color={colors.success} />
              </View>
              <Text style={[{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: colors.text, flex: 1 }]}>Print Receipt</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md }}
              onPress={() => handleTransactionMenuAction(
                filteredTransactions.find(t => t.id === showTransactionMenu),
                'share'
              )}
              activeOpacity={0.7}
            >
              <View style={{ width: 32, height: 32, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent + '20' }}>
                <Ionicons name="share-outline" size={18} color={colors.accent} />
              </View>
              <Text style={[{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: colors.text, flex: 1 }]}>Share Receipt</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
