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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import ApiService from '../../../services/api';
import ReceiptService from '../../../services/receiptService';

export default function TransactionHistoryScreen() {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  const [filter, setFilter] = useState('all');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Removed modal states - instant download only
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [showTransactionMenu, setShowTransactionMenu] = useState(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

   // Load transactions from API and local database
   const loadTransactions = useCallback(async () => {
     try {
       // Try to load from API first
       let apiTransactions = [];
       try {
         const response = await ApiService.getTransactions(50, 0);
         if (response.success && response.data) {
           apiTransactions = response.data;
           
           // Transform API data to match expected format
           const formattedTransactions = apiTransactions.map(tx => ({
             ...tx,
             date: tx.createdAt || tx.created_at,
             // Ensure amount is properly signed based on transaction type
             amount: tx.type === 'deposit' ? Math.abs(tx.amount) : -Math.abs(tx.amount),
           }));
           
           setTransactions(formattedTransactions);
           return; // Exit early if we got API data
         }
       } catch (error) {
         console.warn('Failed to load transactions from API:', error);
         // Continue with empty API data - will try local fallback
       }

       // If no API data, try to load from local storage (AsyncStorage fallback)
       try {
         const localData = await AsyncStorage.getItem('cachedTransactions');
         if (localData) {
           const localTransactions = JSON.parse(localData);
           
           // Transform local data to match expected format
           const formattedTransactions = localTransactions.map(tx => ({
             ...tx,
             date: tx.createdAt || tx.created_at,
             // Ensure amount is properly signed based on transaction type
             amount: tx.type === 'deposit' ? Math.abs(tx.amount) : -Math.abs(tx.amount),
           }));
           
           setTransactions(formattedTransactions);
           return;
         }
       } catch (storageError) {
         console.warn('Failed to load transactions from local storage:', storageError);
       }

       // No data available from any source - show empty state
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
    if (amount > 0) return colors.success; // Green for incoming
    if (type === 'withdraw') return colors.error; // Red for withdrawals
    return colors.primary; // Primary color for transfers
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

  // Receipt functionality - INSTANT DOWNLOAD (NO PREVIEW)
  const handleReceiptAction = (transaction, action) => {
    switch (action) {
      case 'download':
        // INSTANT PDF DOWNLOAD - NO MODAL, NO PREVIEW
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

  // INSTANT PDF DOWNLOAD - NO MODAL, NO PREVIEW, NO BULLSHIT
  const handleInstantDownloadReceipt = async (transaction) => {
    if (!transaction) return;

    // Show loading indicator briefly
    setReceiptLoading(true);

    try {
      // Build user info for receipt - THIS IS THE USER'S PERSONAL TRANSACTION
      const firstName = user?.firstName || user?.first_name || '';
      const lastName = user?.lastName || user?.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim() || 'User';

      const userInfo = {
        name: fullName,
        firstName: firstName,
        lastName: lastName,
        email: user?.email || '',
        phone: user?.phone || '',
        // For personal transactions, the user is always the one who made the transaction
        isPersonalTransaction: true
      };

      // DIRECT PDF DOWNLOAD - NO FORMAT SELECTION
      const result = await ReceiptService.downloadReceipt(transaction, 'pdf', userInfo);

      if (result.success) {
        // Show brief success message
        Alert.alert(
          'Downloaded',
          `Receipt saved as ${result.fileName}`,
          [{ text: 'OK', style: 'default' }],
          { cancelable: true }
        );
      } else {
        throw new Error(result.error || 'Download failed');
      }
    } catch (error) {
      Alert.alert(
        'Download Failed',
        'Unable to download receipt. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setReceiptLoading(false);
    }
  };

  // Legacy function - kept for compatibility but not used
  const handleDownloadReceipt = async (format) => {
    if (!selectedTransaction) return;

    setReceiptLoading(true);
    try {
      // Build user info for legacy function
      const userInfo = {
        name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'User',
        firstName: user?.first_name || '',
        lastName: user?.last_name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        isPersonalTransaction: true
      };

      const result = await ReceiptService.downloadReceipt(selectedTransaction, format, userInfo);
      if (result.success) {
        setShowReceiptModal(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to download receipt');
    } finally {
      setReceiptLoading(false);
    }
  };

  const handlePrintReceipt = async (transaction) => {
    try {
      // Build user info for print - THIS IS THE USER'S PERSONAL TRANSACTION
      const firstName = user?.firstName || user?.first_name || '';
      const lastName = user?.lastName || user?.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim() || 'User';

      const userInfo = {
        name: fullName,
        firstName: firstName,
        lastName: lastName,
        email: user?.email || '',
        phone: user?.phone || '',
        // For personal transactions, the user is always the one who made the transaction
        isPersonalTransaction: true
      };

      await ReceiptService.printReceipt(transaction, userInfo);
    } catch (error) {
      Alert.alert('Error', 'Failed to print receipt');
    }
  };

  const handleShareReceipt = async (transaction) => {
    try {
      // Build user info for share - THIS IS THE USER'S PERSONAL TRANSACTION
      const firstName = user?.firstName || user?.first_name || '';
      const lastName = user?.lastName || user?.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim() || 'User';

      const userInfo = {
        name: fullName,
        firstName: firstName,
        lastName: lastName,
        email: user?.email || '',
        phone: user?.phone || '',
        // For personal transactions, the user is always the one who made the transaction
        isPersonalTransaction: true
      };

      const result = await ReceiptService.generatePDFReceipt(transaction, userInfo);
      if (result.success) {
        await ReceiptService.shareReceipt(result.uri, result.fileName);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share receipt');
    }
  };

  // INSTANT BULK PDF DOWNLOAD - NO MODAL, NO PREVIEW
  const handleInstantBulkDownload = async () => {
    if (transactions.length === 0) {
      Alert.alert('No Data', 'No transactions available to download');
      return;
    }

    setReceiptLoading(true);
    try {
      // Build user info for bulk receipt - THESE ARE THE USER'S PERSONAL TRANSACTIONS
      const firstName = user?.firstName || user?.first_name || '';
      const lastName = user?.lastName || user?.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim() || 'User';

      const userInfo = {
        name: fullName,
        firstName: firstName,
        lastName: lastName,
        email: user?.email || '',
        phone: user?.phone || '',
        // For personal transaction history, the user is always the one who made all transactions
        isPersonalTransaction: true,
        reportTitle: 'Personal Transaction History'
      };

      // DIRECT PDF DOWNLOAD - NO FORMAT SELECTION
      const result = await ReceiptService.downloadBulkReceipts(transactions, 'pdf', userInfo);

      if (result.success) {
        Alert.alert(
          'Downloaded',
          `Transaction history saved as ${result.fileName}`,
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        throw new Error(result.error || 'Bulk download failed');
      }
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

  // Legacy function - kept for compatibility but not used
  const handleBulkDownload = async (format) => {
    if (transactions.length === 0) {
      Alert.alert('No Data', 'No transactions available to download');
      return;
    }

    setReceiptLoading(true);
    try {
      // Build user info for legacy function
      const userInfo = {
        name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'User',
        firstName: user?.first_name || '',
        lastName: user?.last_name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        isPersonalTransaction: true,
        reportTitle: 'Personal Transaction History'
      };

      const result = await ReceiptService.downloadBulkReceipts(transactions, format, userInfo);
      if (result.success) {
        Alert.alert(
          'Success',
          `Transaction history downloaded successfully as ${result.fileName}`,
          [{ text: 'OK' }]
        );
        // Modal removed - instant download only
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to download transaction history');
    } finally {
      setReceiptLoading(false);
    }
  };

  // Transaction menu actions
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
      {/* Compact Header with Filters */}
      <View style={[{ borderBottomWidth: 1, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomColor: 'transparent' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
            {/* Filters moved to header row - now taking full width */}
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

            {/* Three-dot menu for actions */}
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

      {/* Header Menu Dropdown */}
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
              // Add export functionality here if needed
            }}
          >
            <Ionicons name="share" size={18} color={colors.text} />
            <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.text }]}>Export</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Overlay to close menu */}
      {showHeaderMenu && (
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}
          onPress={() => setShowHeaderMenu(false)}
          activeOpacity={1}
        />
      )}

      {/* Scrollable Content */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, marginTop: spacing.md }]}>
            Loading transactions...
          </Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: spacing.md }}>
          {/* Table Header */}
          <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 2, borderBottomColor: colors.primary }}>
            <Text style={{ flex: 1, fontSize: 9, fontWeight: typography.fontWeight.bold, color: colors.text, textTransform: 'uppercase' }}>Description</Text>
            <Text style={{ flex: 1, fontSize: 9, fontWeight: typography.fontWeight.bold, color: colors.text, textAlign: 'center', textTransform: 'uppercase' }}>Date</Text>
            <Text style={{ flex: 1, fontSize: 9, fontWeight: typography.fontWeight.bold, color: colors.text, textAlign: 'center', textTransform: 'uppercase' }}>Status</Text>
            <Text style={{ flex: 1, fontSize: 9, fontWeight: typography.fontWeight.bold, color: colors.text, textAlign: 'right', textTransform: 'uppercase' }}>Amount</Text>
          </View>

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
        </View>
      )}

      {/* Transaction Menu Modal */}
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
            {/* Menu Header */}
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


