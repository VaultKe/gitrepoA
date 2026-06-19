import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../../components/common/Card';
import { getThemeColors, spacing, typography } from '../../../utils/theme';
import ChamaTransactionRow from './ChamaTransactionRow';
import ChamaTransactionsEmptyState from './ChamaTransactionsEmptyState';

const ChamaTransactionsTable = ({
  transactions,
  loading,
  currentPage,
  totalPages,
  setCurrentPage,
  chamaMembers,
  onReceiptPress,
  exportLoading,
  selectedFilter,
  theme,
}) => {
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);

  return (
    <View style={styles.tableContainer}>
      <Card variant="default" style={styles.tableCard}>
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
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tableScrollContent: {
    flexGrow: 1,
    width: '100%',
  },
  tableContent: {
    minWidth: 720,
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  nameCell: {
    flex: 2.5,
    alignItems: 'flex-start',
  },
  descriptionCell: {
    flex: 2,
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
  tableHeaderText: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    fontSize: 9,
    textAlign: 'center',
  },
  tableHeaderTextLeft: {
    textAlign: 'left',
  },
  transactionsList: {
    padding: spacing.md,
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
