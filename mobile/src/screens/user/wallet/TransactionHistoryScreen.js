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
  Platform,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import ApiService from '../../../services/api';
import Card from '../../../components/common/Card';

export default function TransactionHistoryScreen() {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const { width: screenWidth } = Dimensions.get('window');
  const getResponsiveTextSize = (baseSize) => {
    return screenWidth < 600 ? baseSize : screenWidth < 900 ? baseSize * 1.1 : baseSize * 1.2;
  };

  const [filter, setFilter] = useState('all');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [showTransactionMenu, setShowTransactionMenu] = useState(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  const fetchAllPages = async (label, fetchFn) => {
    const results = [];
    let page = 1;
    let hasMore = true;
    const pageSize = 100;

    while (hasMore) {
      const offset = (page - 1) * pageSize;
      try {
        const response = await fetchFn(pageSize, offset);
        if (response.success && response.data) {
          const batch = Array.isArray(response.data)
            ? response.data
            : response.data.transactions || response.data.data || [];
          results.push(...batch);
          hasMore = batch.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      } catch (error) {
        console.warn(`${label}: fetch page ${page} error:`, error.message);
        hasMore = false;
      }
    }

    return results;
  };

  const loadAllUserTransactions = useCallback(async () => {
      try {
        // 1. Load wallet transactions first (paginated)
        let allTransactions = [];
        try {
          const walletTxns = await fetchAllPages('walletTransactions', (limit, offset) =>
            ApiService.getTransactions(limit, offset)
          );
          allTransactions.push(...walletTxns);
        } catch (e) {
          console.warn('Failed to load wallet transactions:', e);
        }

        // 2. Load user's chamas
        let userChamas = [];
        try {
          const chamasResponse = await ApiService.getUserChamas(100, 0);
          if (chamasResponse.success && chamasResponse.data) {
            userChamas = Array.isArray(chamasResponse.data) ? chamasResponse.data : (chamasResponse.data.chamas || chamasResponse.data.data || []);
          }
        } catch (e) {
          console.warn('Failed to load user chamas:', e);
        }

        // 3. For each chama, fetch all transaction types (paginated)
        const seenIds = new Set();
        const dedupPush = (items, typeOverride) => {
          (items || []).forEach(item => {
            const itemId = String(item.id || item.transaction_id || item.reference || '');
            if (!itemId || seenIds.has(itemId)) return;
            seenIds.add(itemId);
            const tx = { ...item };
            if (typeOverride) tx.type = typeOverride;
            allTransactions.push(tx);
          });
        };

        await Promise.allSettled(
          userChamas.map(async (chama) => {
            const chamaId = chama.id || chama.chamaId;
            if (!chamaId) return;

            // Chama transactions (paginated)
            try {
              const txnTxns = await fetchAllPages(`chamaTxns-${chamaId}`, (limit, offset) =>
                ApiService.getChamaTransactions(chamaId, limit, offset)
              );
              dedupPush(txnTxns, 'transaction');
            } catch (e) { /* skip */ }

            // Contributions (paginated)
            try {
              const contribTxns = await fetchAllPages(`contrib-${chamaId}`, (limit, offset) =>
                ApiService.getContributions(chamaId, limit, offset)
              );
              dedupPush(contribTxns, 'contribution');
            } catch (e) { /* skip */ }

            // Loans (paginated)
            try {
              const loanTxns = await fetchAllPages(`loans-${chamaId}`, (limit, offset) =>
                ApiService.getLoans(chamaId, limit, offset)
              );
              dedupPush(loanTxns, 'loan');
            } catch (e) { /* skip */ }

            // Welfare requests + contributions (paginated)
            try {
              const welfareRequests = await fetchAllPages(`welfare-${chamaId}`, (limit, offset) =>
                ApiService.getWelfareRequests(chamaId, limit, offset)
              );
              dedupPush(welfareRequests, 'welfare');

              // Fetch contributions for each welfare request in parallel
              await Promise.allSettled(
                welfareRequests.map(async (req) => {
                  try {
                    const welfareId = req.id || req.welfareId;
                    if (!welfareId) return;
                    const wContribTxns = await fetchAllPages(`welfareContrib-${welfareId}`, (limit, offset) =>
                      ApiService.getWelfareContributions(welfareId, limit, offset)
                    );
                    dedupPush(wContribTxns, 'welfare_contribution');
                  } catch (e) { /* skip */ }
                })
              );
            } catch (e) { /* skip */ }

            // Merry-go-round rounds + payments
            try {
              const mgrResp = await ApiService.getMerryGoRounds(chamaId);
              if (mgrResp.success && mgrResp.data) {
                const rounds = Array.isArray(mgrResp.data) ? mgrResp.data : (mgrResp.data.rounds || mgrResp.data.data || []);

                await Promise.allSettled(
                  rounds.map(async (round) => {
                    try {
                      const roundId = round.id || round.roundId;
                      if (!roundId) return;
                      const paymentsResp = await ApiService.getMerryGoRoundPayments(roundId);
                      if (paymentsResp.success && paymentsResp.data) {
                        dedupPush(Array.isArray(paymentsResp.data) ? paymentsResp.data : (paymentsResp.data.payments || paymentsResp.data.data || []), 'merry-go-round');
                      }
                    } catch (e) { /* skip */ }
                  })
                );
              }
            } catch (e) { /* skip */ }
          })
        );

        // 4. Format and set transactions
        if (allTransactions.length > 0) {
          const formattedTransactions = allTransactions.map(tx => ({
            ...tx,
            date: tx.createdAt || tx.created_at,
            amount: tx.type === 'deposit' || tx.type === 'contribution' || tx.type === 'welfare_contribution'
              ? Math.abs(parseFloat(tx.amount) || 0)
              : -Math.abs(parseFloat(tx.amount) || 0),
          }));
          setTransactions(formattedTransactions);
          return;
        }

        // 5. Fallback to local storage if no API data
        try {
          const localData = await AsyncStorage.getItem('cachedTransactions');
          if (localData) {
            const localTransactions = JSON.parse(localData);
            const formattedTransactions = localTransactions.map(tx => ({
              ...tx,
              date: tx.createdAt || tx.created_at,
              amount: tx.type === 'deposit' || tx.type === 'contribution'
                ? Math.abs(parseFloat(tx.amount) || 0)
                : -Math.abs(parseFloat(tx.amount) || 0),
            }));
            setTransactions(formattedTransactions);
            return;
          }
        } catch (storageError) {
          console.warn('Failed to load transactions from local storage:', storageError);
        }

        setTransactions([]);
      } catch (error) {
        console.error('Error in loadAllUserTransactions:', error);
        Alert.alert('Error', 'Failed to load transaction history');
        setTransactions([]);
      }
    }, []);

   const onRefresh = useCallback(async () => {
     setRefreshing(true);
     await loadAllUserTransactions();
     setRefreshing(false);
   }, [loadAllUserTransactions]);

   useEffect(() => {
     const initializeData = async () => {
       setLoading(true);
       await loadAllUserTransactions();
       setLoading(false);
     };
     initializeData();
   }, [loadAllUserTransactions]);

   useFocusEffect(
     React.useCallback(() => {
       loadAllUserTransactions();
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
    : transactions.filter(t => t.type === filter);

  const getTransactionColor = (type, amount) => {
    if (amount > 0) return colors.success;
    if (amount < 0) return colors.error;
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

  const getReceiptFileName = (receiptId) => {
    return `VaultKe_Receipt_${receiptId}_${new Date().toISOString().split('T')[0]}.pdf`;
  };

  const downloadReceiptPDF = async (transactionId, fileName) => {
    const token = await ApiService.getAuthToken();
    const response = await fetch(
      `${ApiService.getApiBaseUrl()}/receipts/transactions/${encodeURIComponent(transactionId)}/download?format=pdf`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Receipt download failed: ${response.status} ${errorText}`);
    }

    if (Platform.OS === 'web') {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      return { success: true, fileName, uri: url };
    }

    if (!FileSystem?.documentDirectory || !Sharing?.isAvailableAsync) {
      throw new Error('Download is not available on this device');
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Download is not available on this device');
    }

    const blob = await response.blob();
    const reader = new FileReader();
    const base64Data = await new Promise((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result.split(',')[1]);
        } else {
          reject(new Error('Failed to read PDF'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const uri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Download transaction receipt',
      UTI: 'com.adobe.pdf',
    });

    return { success: true, fileName, uri };
  };

  const printReceiptPDF = async (transactionId, title, receiptId) => {
    const fileName = getReceiptFileName(receiptId);
    const result = await downloadReceiptPDF(transactionId, fileName);
    if (!result.success) {
      throw new Error(result.error || 'Failed to download PDF receipt');
    }

    if (Platform.OS === 'web') {
      return { success: true, fileName };
    }

    if (!FileSystem?.documentDirectory) {
      throw new Error('Print is not available on this device');
    }

    const fileUri = `${FileSystem.documentDirectory}${fileName}`;
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Print receipt - ${receiptId}`,
      UTI: 'com.adobe.pdf',
    });

    return { success: true, fileName };
  };

  const shareReceiptPDF = async (transactionId, fileName) => {
    const result = await downloadReceiptPDF(transactionId, fileName);
    return result;
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
      const transactionId = transaction?.id || transaction?.transaction_id || transaction?.reference;
      if (!transactionId) {
        throw new Error('Transaction ID not found');
      }
      const receiptId = `RCP-${String(transactionId).substring(0, 8).toUpperCase()}`;
      const fileName = getReceiptFileName(receiptId);
      const result = await downloadReceiptPDF(transactionId, fileName);
      if (result.success) {
        Alert.alert('Downloaded', `Receipt saved as ${result.fileName}`, [{ text: 'OK', style: 'default' }], { cancelable: true });
      } else {
        throw new Error(result.error || 'Download failed');
      }
    } catch (error) {
      Alert.alert('Download Failed', error.message || 'Unable to download receipt. Please try again.', [{ text: 'OK', style: 'default' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handlePrintReceipt = async (transaction) => {
    if (!transaction) return;
    setReceiptLoading(true);
    try {
      const transactionId = transaction?.id || transaction?.transaction_id || transaction?.reference;
      if (!transactionId) {
        throw new Error('Transaction ID not found');
      }
      const receiptId = `RCP-${String(transactionId).substring(0, 8).toUpperCase()}`;
      const result = await printReceiptPDF(transactionId, `Transaction Receipt - ${receiptId}`, receiptId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to print receipt');
      }

      Alert.alert('Print Ready', 'Transaction receipt has been opened for printing.', [{ text: 'OK' }]);
    } catch (error) {
      Alert.alert('Print Failed', error.message || 'Failed to print receipt.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleShareReceipt = async (transaction) => {
    if (!transaction) return;
    setReceiptLoading(true);
    try {
      const transactionId = transaction?.id || transaction?.transaction_id || transaction?.reference;
      if (!transactionId) {
        throw new Error('Transaction ID not found');
      }
      const receiptId = `RCP-${String(transactionId).substring(0, 8).toUpperCase()}`;
      const fileName = getReceiptFileName(receiptId);
      const result = await shareReceiptPDF(transactionId, fileName);

      if (!result.success) {
        throw new Error(result.error || 'Failed to share receipt');
      }

      Alert.alert('Receipt Shared', 'Transaction receipt is ready to share.', [{ text: 'OK' }]);
    } catch (error) {
      Alert.alert('Share Failed', error.message || 'Failed to share receipt.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleBulkDownloadReceipts = async () => {
    if (transactions.length === 0) {
      Alert.alert('No Data', 'No transactions available to download');
      return;
    }

    setReceiptLoading(true);
    try {
      let downloadedCount = 0;
      for (const transaction of transactions) {
        const transactionId = transaction?.id || transaction?.transaction_id || transaction?.reference;
        if (!transactionId) continue;
        const receiptId = `RCP-${String(transactionId).substring(0, 8).toUpperCase()}`;
        const fileName = getReceiptFileName(receiptId);
        try {
          const result = await downloadReceiptPDF(transactionId, fileName);
          if (result.success) {
            downloadedCount++;
          }
        } catch (e) {
          console.warn(`Failed to download receipt for ${transactionId}:`, e.message);
        }
      }

      Alert.alert('Downloaded', `${downloadedCount} of ${transactions.length} receipt(s) downloaded.`, [{ text: 'OK' }]);
    } catch (error) {
      Alert.alert('Download Failed', error.message || 'Unable to download transaction receipts. Please try again.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleBulkPrintReceipts = async () => {
    if (transactions.length === 0) {
      Alert.alert('No Data', 'No transactions available to print');
      return;
    }

    setReceiptLoading(true);
    try {
      let printedCount = 0;
      for (const transaction of transactions) {
        const transactionId = transaction?.id || transaction?.transaction_id || transaction?.reference;
        if (!transactionId) continue;
        const receiptId = `RCP-${String(transactionId).substring(0, 8).toUpperCase()}`;
        try {
          const result = await printReceiptPDF(transactionId, 'Wallet Transaction Reports', receiptId);
          if (result.success) {
            printedCount++;
          }
        } catch (e) {
          console.warn(`Failed to print receipt for ${transactionId}:`, e.message);
        }
      }

      Alert.alert('Reports Ready', `${printedCount} of ${transactions.length} transaction report(s) opened for printing.`, [{ text: 'OK' }]);
    } catch (error) {
      Alert.alert('Print Failed', error.message || 'Failed to print transaction reports.', [{ text: 'OK' }]);
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

  const renderTransactionHeader = () => (
    <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.primary + '10', borderBottomWidth: 2, borderBottomColor: colors.primary }}>
      <Text style={{ flex: 2.5, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.primary, textTransform: 'uppercase' }}>Description</Text>
      <Text style={{ flex: 1.4, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.primary, textAlign: 'center', textTransform: 'uppercase' }}>Date</Text>
      <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.primary, textAlign: 'center', textTransform: 'uppercase' }}>Status</Text>
      <Text style={{ flex: 1.8, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.primary, textAlign: 'right', textTransform: 'uppercase' }}>Amount</Text>
    </View>
  );

  const renderTransaction = ({ item, index }) => (
    <View style={[{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }]}>
      <Text style={{ flex: 2.5, fontSize: getResponsiveTextSize(14), color: colors.text }} numberOfLines={1}>{item.description}</Text>
      <Text style={{ flex: 1.4, fontSize: getResponsiveTextSize(14), color: colors.textSecondary, textAlign: 'center' }}>{formatDate(item.date)}</Text>
      <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), color: item.status === 'completed' ? colors.success : colors.warning, textAlign: 'center' }}>{item.status}</Text>
      <View style={{ flex: 1.8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.medium, color: getTransactionColor(item.type, item.amount), textAlign: 'right' }}>
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
        <View style={{ position: 'absolute', top: 60, right: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, paddingVertical: spacing.xs, minWidth: 170, backgroundColor: colors.surface, borderColor: colors.border, zIndex: 1001, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 }}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm }}
            onPress={() => {
              setShowHeaderMenu(false);
              handleBulkDownloadReceipts();
            }}
            disabled={receiptLoading}
          >
            <Ionicons name="download" size={18} color={receiptLoading ? colors.textTertiary : colors.text} />
            <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: receiptLoading ? colors.textTertiary : colors.text }]}>Download All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm }}
            onPress={() => {
              setShowHeaderMenu(false);
              handleBulkPrintReceipts();
            }}
            disabled={receiptLoading}
          >
            <Ionicons name="print" size={18} color={receiptLoading ? colors.textTertiary : colors.text} />
            <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: receiptLoading ? colors.textTertiary : colors.text }]}>Print All</Text>
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

      <View style={{ flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        <Card variant="outlined" style={{ flex: 1, borderRadius: 8, overflow: 'hidden' }}>
          {loading && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                Loading transactions...
              </Text>
            </View>
          )}
          {renderTransactionHeader()}
          <FlatList
              data={filteredTransactions}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                />
              }
              renderItem={renderTransaction}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl }}>
                  <Ionicons name="receipt-outline" size={64} color={colors.textTertiary} />
                  <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, marginTop: spacing.md }]}>
                    {transactions.length === 0 ? 'No transactions yet' : 'No transactions found'}
                  </Text>
                  <Text style={[{ fontSize: typography.fontSize.sm, marginTop: spacing.sm, textAlign: 'center', color: colors.textTertiary }]}>
                    {transactions.length === 0
                      ? 'Start by making a deposit or transfer'
                      : 'Try changing the filter above'
                    }
                  </Text>
                </View>
              )}
              contentContainerStyle={{ paddingBottom: spacing.md }}
              style={{ flex: 1 }}
            />
        </Card>
      </View>

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
