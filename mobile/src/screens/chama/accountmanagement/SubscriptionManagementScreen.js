import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, breakpoints } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import useSubscriptionManagementScreen from '../../../hooks/useSubscriptionManagementScreen';

const SubscriptionManagementScreen = ({ route, navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const screen = useSubscriptionManagementScreen({ route, navigation });

  const {
    subscriptions,
    loading,
    payingId,
    page,
    receiptLoading,
    isDesktop,
    totalPages,
    paginatedSubscriptions,
    setPage,
    loadSubscriptions,
    handlePaySubscription,
    formatDate,
    formatCurrency,
    getStatusColor,
    getStatusIcon,
    handlePrintSubscriptionReceipt,
    handleDownloadInvoice,
    handlePrintAllPaidSubscriptions,
  } = screen;

  const renderSubscriptionTable = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }

    if (subscriptions.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="repeat-outline" size={40} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No subscription payments yet
          </Text>
        </View>
      );
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.table}>
          <View style={[styles.tableHeader, { backgroundColor: colors.primary + '10' }]}>
            <Text style={[styles.tableHeaderText, { color: colors.primary, flex: 1.5 }]}>Due Date</Text>
            <Text style={[styles.tableHeaderText, { color: colors.primary, flex: 1 }]}>Amount</Text>
            <Text style={[styles.tableHeaderText, { color: colors.primary, flex: 1.5 }]}>Status</Text>
            <Text style={[styles.tableHeaderText, { color: colors.primary, flex: 1, minWidth: 60, textAlign: 'center' }]}>Action</Text>
            <TouchableOpacity
              style={[styles.moreButton, { backgroundColor: colors.primary + '15' }]}
              onPress={handlePrintAllPaidSubscriptions}
              disabled={receiptLoading}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {paginatedSubscriptions.map((sub, index) => {
            const isEven = index % 2 === 0;
            const isPaying = payingId === sub.id;
            const isUnpaid = sub.status !== 'paid';
            return (
              <View
                key={sub.id}
                style={[
                  styles.tableRow,
                  { backgroundColor: isEven ? colors.background : colors.surface }
                ]}
              >
                <Text style={[styles.tableCell, { color: colors.text, flex: 1.5 }]}>
                  {formatDate(sub.dueDate || sub.createdAt)}
                </Text>
                <Text style={[styles.tableCell, { color: colors.text, flex: 1 }]}>
                  {formatCurrency(sub.amount)}
                </Text>
                <View style={[styles.statusCell, { flex: 1.5 }]}>
                  <Ionicons
                    name={getStatusIcon(sub.status)}
                    size={14}
                    color={getStatusColor(sub.status)}
                  />
                  <Text style={[
                    styles.statusText,
                    { color: getStatusColor(sub.status) }
                  ]}>
                    {sub.status?.charAt(0).toUpperCase() + sub.status?.slice(1)}
                  </Text>
                </View>
                <View style={[styles.actionCell, { flex: 1 }]}>
                  {isUnpaid ? (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.payButton, { backgroundColor: colors.primary }]}
                        onPress={() => handlePaySubscription(sub)}
                        disabled={isPaying}
                      >
                        {isPaying ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <Text style={[styles.payButtonText, { color: colors.white }]}>
                            Pay
                          </Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.invoiceButton, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}
                        onPress={() => handleDownloadInvoice(sub)}
                        disabled={receiptLoading}
                      >
                        <Ionicons name="document-text-outline" size={14} color={colors.warning} />
                        <Text style={[styles.invoiceButtonText, { color: colors.warning }]}>Invoice</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.receiptButton, { backgroundColor: colors.success + '20', borderColor: colors.success }]}
                        onPress={() => handlePrintSubscriptionReceipt(sub)}
                        disabled={receiptLoading}
                      >
                        <Ionicons name="print" size={14} color={colors.success} />
                        <Text style={[styles.receiptButtonText, { color: colors.success }]}>Receipt</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.invoiceButton, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}
                        onPress={() => handleDownloadInvoice(sub)}
                        disabled={receiptLoading}
                      >
                        <Ionicons name="document-text-outline" size={14} color={colors.warning} />
                        <Text style={[styles.invoiceButtonText, { color: colors.warning }]}>Invoice</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <View style={styles.pagination}>
        <TouchableOpacity
          style={[styles.pageButton, { opacity: page === 1 ? 0.5 : 1 }]}
          onPress={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          <Ionicons name="chevron-back" size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.pageText, { color: colors.text }]}>
          {page} / {totalPages}
        </Text>
        <TouchableOpacity
          style={[styles.pageButton, { opacity: page === totalPages ? 0.5 : 1 }]}
          onPress={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Monthly Subscriptions
          </Text>
          <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
            Manage monthly subscription payments for this chama. Unpaid subscriptions will show a Pay button.
          </Text>
        </Card>

        <Card variant="outlined" style={styles.tableCard}>
          {renderSubscriptionTable()}
          {renderPagination()}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  sectionDesc: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
  },
  tableCard: {
    borderRadius: 12,
    marginBottom: spacing.lg,
    padding: 12,
  },
  table: {
    minWidth: 420,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 4,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
  table: {
    minWidth: 420,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    alignItems: 'center',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 12,
  },
  statusCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  actionCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  payButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  moreButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    minWidth: 60,
  },
  receiptButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  invoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    minWidth: 60,
  },
  invoiceButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  pageButton: {
    padding: spacing.sm,
    borderRadius: 6,
  },
  pageText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default SubscriptionManagementScreen;
