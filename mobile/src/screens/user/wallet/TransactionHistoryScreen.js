import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import { downloadTransactionReceiptPdf } from '../../../services/pdfDownload';
import Card from '../../../components/common/Card';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import TransactionFilterBar from '../../../components/wallet/TransactionFilterBar';
import TransactionRow from '../../../components/wallet/TransactionRow';
import ReceiptActionModal from '../../../components/wallet/ReceiptActionModal';
import useTransactionHistoryScreen from '../../../hooks/useTransactionHistoryScreen';

const TransactionHistoryScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const { width: screenWidth } = Dimensions.get('window');
  const getResponsiveTextSize = (baseSize) => {
    return screenWidth < 600 ? baseSize : screenWidth < 900 ? baseSize * 1.1 : baseSize * 1.2;
  };

  const screen = useTransactionHistoryScreen({ navigation });

  const {
    user,
    filter,
    setFilter,
    transactions,
    loading,
    refreshing,
    receiptLoading,
    setReceiptLoading,
    statementLoading,
    handleDownloadStatement,
    showTransactionMenu,
    setShowTransactionMenu,
    showHeaderMenu,
    setShowHeaderMenu,
    filterTypes,
    filteredTransactions,
    formatDate,
    onRefresh,
  } = screen;

  const getTransactionColor = (type, amount) => {
    if (amount > 0) return colors.success;
    if (amount < 0) return colors.error;
    return colors.primary;
  };

  // All three receipt actions resolve to the same backend PDF, handed to the OS
  // share sheet (from which the user can print, save or share).
  const handleReceiptAction = async (transaction) => {
    const transactionId = transaction?.id;
    if (!transactionId) {
      Alert.alert('Receipt unavailable', 'This record has no transaction reference.', [{ text: 'OK' }]);
      return;
    }
    setReceiptLoading?.(true);
    try {
      await downloadTransactionReceiptPdf(transactionId);
    } catch (error) {
      Alert.alert('Receipt Failed', error.message || 'Unable to generate the receipt.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading?.(false);
    }
  };

  const handleTransactionMenuAction = (transaction) => {
    setShowTransactionMenu(null);
    handleReceiptAction(transaction);
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
    <TransactionRow
      item={item}
      index={index}
      colors={colors}
      getResponsiveTextSize={getResponsiveTextSize}
      getTransactionColor={getTransactionColor}
      formatDate={formatDate}
      onMenuToggle={setShowTransactionMenu}
      showTransactionMenu={showTransactionMenu}
    />
  );

  const selectedTransaction = filteredTransactions.find((t) => t.id === showTransactionMenu);

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
         <View style={{ flex: 1, paddingHorizontal: spacing.sm, paddingTop: spacing.md }}>
          <Card variant="outlined" style={{ flex: 1, borderRadius: 8, overflow: 'hidden' }}>
            {loading && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  Loading transactions...
                </Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs, paddingTop: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <TransactionFilterBar
                  filter={filter}
                  setFilter={setFilter}
                  filterTypes={filterTypes}
                  colors={colors}
                />
              </View>
              <TouchableOpacity
                onPress={() => setShowHeaderMenu((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ padding: spacing.xs, marginRight: spacing.xs }}
              >
                <Ionicons
                  name={statementLoading ? 'hourglass-outline' : 'ellipsis-vertical'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
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

          <PageRefreshButton
            onRefresh={onRefresh}
            refreshing={refreshing}
            color={colors.primary}
            bottom={64}
          />
        </View>

        {showHeaderMenu && (
          <>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setShowHeaderMenu(false)}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }}
            />
            <View
              style={{
                position: 'absolute',
                top: 44,
                right: spacing.sm,
                zIndex: 21,
                minWidth: 220,
                backgroundColor: colors.surface,
                borderRadius: borderRadius.md,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: spacing.xs,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}
                onPress={() => { setShowHeaderMenu(false); handleDownloadStatement('all'); }}
              >
                <Ionicons name="document-text-outline" size={16} color={colors.text} />
                <Text style={{ color: colors.text, fontSize: typography.fontSize.sm }}>Download full statement (PDF)</Text>
              </TouchableOpacity>
              {filter !== 'all' && (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}
                  onPress={() => { setShowHeaderMenu(false); handleDownloadStatement(filter); }}
                >
                  <Ionicons name="filter-outline" size={16} color={colors.text} />
                  <Text style={{ color: colors.text, fontSize: typography.fontSize.sm }}>
                    {`Download ${filterTypes.find((f) => f.id === filter)?.name || filter} only`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        <ReceiptActionModal
          visible={!!showTransactionMenu}
          onClose={() => setShowTransactionMenu(null)}
          onDownload={() => handleTransactionMenuAction(selectedTransaction, 'download')}
          onPrint={() => handleTransactionMenuAction(selectedTransaction, 'print')}
          onShare={() => handleTransactionMenuAction(selectedTransaction, 'share')}
          receiptLoading={receiptLoading}
          colors={colors}
        />
      </View>
    </View>
  );
};

export default TransactionHistoryScreen;
