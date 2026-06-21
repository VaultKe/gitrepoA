import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../../components/common/Card';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import ChamaTransactionRow from './ChamaTransactionRow';
import ChamaTransactionsEmptyState from './ChamaTransactionsEmptyState';

const { width } = Dimensions.get('window');

const ChamaTransactionsTable = ({
  transactions,
  loading,
  currentPage,
  totalPages,
  setCurrentPage,
  chamaMembers,
  onReceiptPress,
  onBulkPrintReceipts,
  onBulkShareReceipts,
  exportLoading,
  selectedFilter,
  theme,
}) => {
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);
  const [showTableMenu, setShowTableMenu] = useState(false);

  return (
    <View style={styles.tableContainer}>
      {showTableMenu && (
        <View style={styles.tableMenu}>
          <TouchableOpacity
            style={styles.tableMenuItem}
            onPress={() => {
              setShowTableMenu(false);
              onBulkPrintReceipts?.();
            }}
            disabled={transactions.length === 0 || exportLoading}
          >
            <Ionicons name="print-outline" size={16} color={colors.text} />
            <Text style={styles.tableMenuItemText}>Print All Reports</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tableMenuItem}
            onPress={() => {
              setShowTableMenu(false);
              onBulkShareReceipts?.();
            }}
            disabled={transactions.length === 0 || exportLoading}
          >
            <Ionicons name="share-outline" size={16} color={colors.text} />
            <Text style={styles.tableMenuItemText}>Share All Reports</Text>
          </TouchableOpacity>
        </View>
      )}

      <Card variant="outlined" style={styles.tableCard}>
        <View style={styles.tableToolbar}>
          <View style={styles.tableToolbarTitle}>
            <Text style={styles.tableToolbarTitleText}>Transactions</Text>
          </View>
          <TouchableOpacity
            style={[styles.tableMenuButton, showTableMenu && styles.tableMenuButtonActive]}
            onPress={() => setShowTableMenu(!showTableMenu)}
            disabled={transactions.length === 0 || exportLoading}
            accessibilityLabel="Transaction reports menu"
            accessibilityHint="Tap to print or share all visible transaction reports"
          >
            <Text style={styles.tableMenuButtonText}>...</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tableScrollContent}
        >
          <View style={styles.tableContent}>
            <View style={styles.tableHeader}>
              <View style={[styles.tableCell, styles.nameCell]}>
                <Text style={[styles.tableHeaderText, styles.tableHeaderTextLeft]}>User</Text>
              </View>
              <View style={[styles.tableCell, styles.descriptionCell]}>
                <Text style={styles.tableHeaderText}>Description</Text>
              </View>
              <View style={[styles.tableCell, styles.amountCell]}>
                <Text style={styles.tableHeaderText}>Amount</Text>
              </View>
              <View style={[styles.tableCell, styles.dateCell]}>
                <Text style={styles.tableHeaderText}>Date</Text>
              </View>
              <View style={[styles.tableCell, styles.typeCell]}>
                <Text style={styles.tableHeaderText}>Type</Text>
              </View>
              <View style={[styles.tableCell, styles.actionsCell]}>
                <Text style={styles.tableHeaderText}>Action</Text>
              </View>
            </View>

            <FlatList
              data={transactions}
              renderItem={({ item, index }) => (
                <ChamaTransactionRow
                  item={item}
                  index={index}
                  chamaMembers={chamaMembers}
                  onReceiptPress={onReceiptPress}
                  exportLoading={exportLoading}
                  theme={theme}
                />
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.transactionsList}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={!loading && (
                <ChamaTransactionsEmptyState selectedFilter={selectedFilter} theme={theme} />
              )}
            />

            {transactions.length > 15 && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[
                    styles.pageButton,
                    currentPage === 1 ? styles.pageButtonDisabled : styles.pageButtonActive,
                  ]}
                  onPress={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={currentPage === 1 ? colors.textSecondary : colors.text}
                  />
                </TouchableOpacity>
                <Text style={[styles.pageText, styles.pageTextDefault]}>
                  {currentPage} of {totalPages}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.pageButton,
                    currentPage === totalPages ? styles.pageButtonDisabled : styles.pageButtonActive,
                  ]}
                  onPress={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={currentPage === totalPages ? colors.textSecondary : colors.text}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </Card>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  tableContainer: {
    position: 'relative',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    alignSelf: 'stretch',
  },
  tableCard: {
    minHeight: 360,
    borderRadius: 8,
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  tableToolbar: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  tableToolbarTitle: {
    flex: 1,
  },
  tableToolbarTitleText: {
    color: colors.text,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  tableScrollContent: {
    flexGrow: 1,
    width: '100%',
  },
  tableContent: {
    position: 'relative',
    minWidth: Math.max(width - 32, 760),
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  nameCell: {
    flex: 1.8,
    alignItems: 'flex-start',
  },
  descriptionCell: {
    flex: 2.3,
  },
  amountCell: {
    flex: 1.2,
  },
  dateCell: {
    flex: 1.5,
  },
  typeCell: {
    flex: 1,
  },
  actionsCell: {
    flex: 0.8,
  },
  tableMenuButton: {
    minWidth: 28,
    minHeight: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tableMenuButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tableMenuButtonText: {
    color: colors.text,
    fontWeight: typography.fontWeight.bold,
    fontSize: 16,
    lineHeight: 18,
  },
  tableMenu: {
    position: 'absolute',
    top: 72,
    right: spacing.md,
    minWidth: 190,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 10000,
    elevation: 20,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  tableMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tableMenuItemText: {
    color: colors.text,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  tableHeaderText: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
  tableHeaderTextLeft: {
    textAlign: 'left',
  },
  transactionsList: {
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  pageButton: {
    padding: spacing.sm,
    borderRadius: 8,
  },
  pageButtonDisabled: {
    backgroundColor: colors.border,
    opacity: 0.5,
  },
  pageButtonActive: {
    backgroundColor: colors.primary,
  },
  pageText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  pageTextDefault: {
    color: colors.text,
  },
});

export default ChamaTransactionsTable;
