import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import ChamaLoansEmptyState from './ChamaLoansEmptyState';
import {
  formatCurrency,
  formatDate,
  getActionStyle,
  getLoanName,
  getLoanStatusStyles,
  getStatusColor,
} from '../../utils/chamaLoansUtils';

const ChamaLoansTable = ({
  loans,
  loading,
  refreshing,
  onRefresh,
  navigation,
  currentUser,
  canManageLoans,
  onLoanAction,
  theme,
}) => {
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);

  const renderTableRow = ({ item, index }) => {
    const statusStyles = getLoanStatusStyles(item.status, styles);
    const statusColor = getStatusColor(item.status, colors);

    return (
      <View style={index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
        <View style={[styles.tableCell, styles.nameCell]}>
          <Text style={[styles.tableCellText, styles.nameText]} numberOfLines={1}>
            {getLoanName(item, currentUser)}
          </Text>
        </View>

        <View style={[styles.tableCell, styles.amountCell]}>
          <Text style={styles.tableCellText}>
            {formatCurrency(item.amount)}
          </Text>
        </View>

        <View style={[styles.tableCell, styles.statusCell]}>
          <View style={[statusStyles[0], statusStyles[1]]}>
            <Text style={[styles.statusText, statusStyles[2]]}>
              {item.status}
            </Text>
          </View>
        </View>

        <View style={[styles.tableCell, styles.dateCell]}>
          <Text style={styles.tableCellText}>
            {formatDate(item.created_at || item.createdAt)}
          </Text>
        </View>

        <View style={[styles.tableCell, styles.actionsCell]}>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={getActionStyle('view', styles)}
              onPress={() => navigation.navigate('LoanDetails', { loanId: item.id })}
            >
              <Ionicons name="eye" size={10} color={colors.white} />
            </TouchableOpacity>
            {canManageLoans() && item.status === 'pending' && (
              <>
                <TouchableOpacity
                  style={getActionStyle('approve', styles)}
                  onPress={() => onLoanAction(item, 'approve')}
                >
                  <Ionicons name="checkmark" size={10} color={colors.white} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={getActionStyle('reject', styles)}
                  onPress={() => onLoanAction(item, 'reject')}
                >
                  <Ionicons name="close" size={10} color={colors.white} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.tableContainer}>
      <Card variant="outlined" padding="none" style={styles.tableCard}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tableScrollContent}
        >
          <View style={styles.tableContent}>
            <View style={styles.tableHeader}>
              <View style={[styles.tableCell, styles.nameCell]}>
                <Text style={[styles.tableHeaderText, styles.tableHeaderTextLeft]}>Name</Text>
              </View>
              <View style={[styles.tableCell, styles.amountCell]}>
                <Text style={styles.tableHeaderText}>Amount</Text>
              </View>
              <View style={[styles.tableCell, styles.statusCell]}>
                <Text style={styles.tableHeaderText}>Status</Text>
              </View>
              <View style={[styles.tableCell, styles.dateCell]}>
                <Text style={styles.tableHeaderText}>Date</Text>
              </View>
              <View style={[styles.tableCell, styles.actionsCell]}>
                <Text style={styles.tableHeaderText}>Actions</Text>
              </View>
            </View>

            <FlatList
              data={loans}
              renderItem={renderTableRow}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.loansList}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                />
              }
              ListEmptyComponent={!loading && (
                <ChamaLoansEmptyState canViewAllLoans={canManageLoans} theme={theme} />
              )}
            />
          </View>
        </ScrollView>
      </Card>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  tableContainer: {
    flex: 1,
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
    minWidth: 680,
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary + '10',
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tableCell: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  nameCell: {
    flex: 1.6,
    alignItems: 'flex-start',
  },
  amountCell: {
    flex: 1.3,
  },
  statusCell: {
    flex: 1,
  },
  dateCell: {
    flex: 1.2,
  },
  actionsCell: {
    flex: 1,
  },
  tableHeaderText: {
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    fontSize: 12,
    textAlign: 'center',
  },
  tableHeaderTextLeft: {
    textAlign: 'left',
  },
  tableRowEven: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  tableRowOdd: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  tableCellText: {
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  nameText: {
    fontWeight: typography.fontWeight.medium,
    textAlign: 'left',
  },
  statusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  statusBadgePrimary: {
    backgroundColor: colors.primary + '20',
  },
  statusBadgeSuccess: {
    backgroundColor: colors.success + '20',
  },
  statusBadgeInfo: {
    backgroundColor: colors.info + '20',
  },
  statusBadgeWarning: {
    backgroundColor: colors.warning + '20',
  },
  statusBadgeError: {
    backgroundColor: colors.error + '20',
  },
  statusBadgeMuted: {
    backgroundColor: colors.textSecondary + '20',
  },
  statusText: {
    fontSize: 7,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'capitalize',
  },
  statusTextPrimary: {
    color: colors.primary,
  },
  statusTextSuccess: {
    color: colors.success,
  },
  statusTextInfo: {
    color: colors.info,
  },
  statusTextWarning: {
    color: colors.warning,
  },
  statusTextError: {
    color: colors.error,
  },
  statusTextMuted: {
    color: colors.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  actionButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  actionButtonSuccess: {
    backgroundColor: colors.success,
  },
  actionButtonError: {
    backgroundColor: colors.error,
  },
  loansList: {
    padding: spacing.md,
  },
});

export default ChamaLoansTable;
