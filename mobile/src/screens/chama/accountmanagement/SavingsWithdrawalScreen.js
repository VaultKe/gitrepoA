import React from 'react';
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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import OTPVerificationModal from '../../../components/common/OTPVerificationModal';
import useSavingsWithdrawalScreen from '../../../hooks/useSavingsWithdrawalScreen';

const SavingsWithdrawalScreen = ({ route, navigation }) => {
  const { theme } = useApp();
  const { currentChamaId } = useChamaContext();
  const hook = useSavingsWithdrawalScreen(navigation);
  const colors = getThemeColors(theme);

  const {
    savingsAccounts,
    loading,
    refreshing,
    selectedFilter,
    searchQuery,
    showFilterDropdown,
    userRole,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    showWithdrawModal,
    selectedAccount,
    showBulkWithdrawModal,
    withdrawForm,
    bulkWithdrawData,
    showOTPModal,
    otpLoading,
    selectedApprovalItem,
    approvalActionType,
    filters,
    tableStyles,
    headerStyles,
    setSearchQuery,
    setShowFilterDropdown,
    setSelectedFilter,
    setCurrentPage,
    onRefresh,
    formatCurrency,
    formatDate,
    getStatusColor,
    handleWithdraw,
    handleBulkWithdraw,
    submitWithdrawal,
    submitBulkWithdrawal,
    handleInitiateApprove,
    handleVerifyOTP,
    handleResendOTP,
    setShowWithdrawModal,
    setShowBulkWithdrawModal,
    setWithdrawForm,
    setBulkWithdrawData,
  } = hook;

  const renderTableRow = ({ item, index }) => {
    const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;

    return (
      <View style={[tableStyles.tableRow, { backgroundColor: rowBackgroundColor }]}>
        <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
          <Text style={[tableStyles.tableCellText, tableStyles.nameText]} numberOfLines={1}>
            {item.name || 'Unknown Member'}
          </Text>
        </View>

        <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
          <Text style={[tableStyles.tableCellText, { fontWeight: typography.fontWeight.medium, color: colors.success }]}>
            {formatCurrency(item.balance)}
          </Text>
        </View>

        <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
          <Text style={tableStyles.tableCellText}>
            {formatDate(item.lastActivity)}
          </Text>
        </View>

        <View style={[tableStyles.tableCell, tableStyles.statusCell]}>
          <View style={[tableStyles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[tableStyles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status?.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
          <View style={tableStyles.actionButtons}>
            <TouchableOpacity
              style={[tableStyles.actionButton, { backgroundColor: colors.info + '20' }]}
              onPress={() => navigation.navigate('SavingsDetails', { accountId: item.id, chamaId: currentChamaId })}
            >
              <Ionicons name="eye" size={14} color={colors.info} />
            </TouchableOpacity>
            {userRole !== 'left' && (item.status === 'eligible' || item.status === 'pending') && (
              <TouchableOpacity
                style={[tableStyles.actionButton, { backgroundColor: colors.primary + '20' }]}
                onPress={() => handleInitiateApprove(item)}
              >
                <Ionicons name="checkmark-done" size={14} color={colors.primary} />
              </TouchableOpacity>
            )}
            {userRole !== 'left' && item.status === 'eligible' && (
              <TouchableOpacity
                style={[tableStyles.actionButton, { backgroundColor: colors.warning + '20' }]}
                onPress={() => handleWithdraw(item)}
              >
                <Ionicons name="cash" size={14} color={colors.warning} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="wallet" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Savings Accounts Found
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {selectedFilter === 'all'
          ? 'No savings accounts have been created yet'
          : `No savings accounts with status "${selectedFilter}" found`
        }
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={[headerStyles.header, { backgroundColor: colors.surface }]}>
      <View style={headerStyles.headerContent}>
        <View style={headerStyles.searchContainer}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[headerStyles.searchInput, { color: colors.text }]}
            placeholder="Search by name"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={headerStyles.filterContainer}>
          <TouchableOpacity
            style={headerStyles.filterButton}
            onPress={() => setShowFilterDropdown(!showFilterDropdown)}
          >
            <Ionicons
              name={filters.find(f => f.id === selectedFilter)?.icon || 'list'}
              size={16}
              color={colors.primary}
            />
            <Text style={[headerStyles.filterButtonText, { color: colors.text }]}>
              {filters.find(f => f.id === selectedFilter)?.name || 'All'}
            </Text>
            <Ionicons
              name={showFilterDropdown ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {renderHeader()}

        {showFilterDropdown && (
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowFilterDropdown(false)}
          />
        )}

        <View style={{ flex: 1, paddingHorizontal: spacing.sm, paddingTop: spacing.sm }}>
          <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
            <View style={tableStyles.tableHeader}>
              <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
                <Text style={[tableStyles.tableHeaderText, { textAlign: 'left' }]}>Member & Account</Text>
              </View>
              <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
                <Text style={tableStyles.tableHeaderText}>Balance</Text>
              </View>
              <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
                <Text style={tableStyles.tableHeaderText}>Last Activity</Text>
              </View>
              <View style={[tableStyles.tableCell, tableStyles.statusCell]}>
                <Text style={tableStyles.tableHeaderText}>Status</Text>
              </View>
              <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
                <Text style={tableStyles.tableHeaderText}>Actions</Text>
              </View>
            </View>

            <FlatList
              data={savingsAccounts}
              renderItem={renderTableRow}
              keyExtractor={(item) => item.id?.toString()}
              style={{ flex: 1, zIndex: 1 }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                />
              }
              ListEmptyComponent={!loading && renderEmptyState()}
            />

            {totalItems > pageSize && (
              <View style={[styles.pagination, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
                  onPress={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <Ionicons name="chevron-back" size={16} color={currentPage === 1 ? colors.textTertiary : colors.primary} />
                  <Text style={[styles.paginationText, currentPage === 1 && styles.paginationTextDisabled]}>Previous</Text>
                </TouchableOpacity>

                <Text style={[styles.paginationInfo, { color: colors.text }]}>
                  Page {currentPage} of {totalPages} ({totalItems} total)
                </Text>

                <TouchableOpacity
                  style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
                  onPress={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <Text style={[styles.paginationText, currentPage === totalPages && styles.paginationTextDisabled]}>Next</Text>
                  <Ionicons name="chevron-forward" size={16} color={currentPage === totalPages ? colors.textTertiary : colors.primary} />
                </TouchableOpacity>
              </View>
            )}

            {userRole !== 'left' && savingsAccounts.filter(account => account.status === 'eligible').length > 0 && (
              <View style={[styles.bulkActions, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                <Button
                  title={`Bulk Withdraw (${savingsAccounts.filter(account => account.status === 'eligible').length} eligible accounts)`}
                  onPress={handleBulkWithdraw}
                  style={{ backgroundColor: colors.warning }}
                  icon={<Ionicons name="cash" size={16} color={colors.white} />}
                />
              </View>
            )}
          </Card>
        </View>

        {loading && <LoadingSpinner />}
      </SafeAreaView>

      {showFilterDropdown && (
        <View style={[headerStyles.dropdownContainer, {
          position: 'absolute',
          top: 140,
          right: 20,
          zIndex: 10000,
        }]}>
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                headerStyles.dropdownItem,
                selectedFilter === filter.id && headerStyles.dropdownItemSelected
              ]}
              onPress={() => {
                setSelectedFilter(filter.id);
                setShowFilterDropdown(false);
              }}
            >
              <Ionicons
                name={filter.icon}
                size={16}
                color={selectedFilter === filter.id ? colors.white : colors.textSecondary}
              />
              <Text style={[
                headerStyles.dropdownItemText,
                selectedFilter === filter.id && { color: colors.white }
              ]}>
                {filter.name}
              </Text>
              {selectedFilter === filter.id && (
                <Ionicons name="checkmark" size={14} color={colors.white} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Modal
        visible={showWithdrawModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Withdraw Savings
              </Text>
              <TouchableOpacity
                onPress={() => setShowWithdrawModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedAccount && (
                <View>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    {selectedAccount.memberName} - Available: {formatCurrency(selectedAccount.balance)}
                  </Text>

                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>
                      Withdrawal Amount (KES) *
                    </Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      value={withdrawForm.amount}
                      onChangeText={(text) => setWithdrawForm(prev => ({ ...prev, amount: text }))}
                      placeholder="Enter withdrawal amount"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                    />
                    <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                      Maximum: {formatCurrency(selectedAccount.balance)}
                    </Text>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>
                      Reason *
                    </Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      value={withdrawForm.reason}
                      onChangeText={(text) => setWithdrawForm(prev => ({ ...prev, reason: text }))}
                      placeholder="Enter withdrawal reason"
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      numberOfLines={2}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>
                      Private Note (Audit Trail)
                    </Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      value={withdrawForm.privateNote}
                      onChangeText={(text) => setWithdrawForm(prev => ({ ...prev, privateNote: text }))}
                      placeholder="Optional note for audit purposes"
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      numberOfLines={2}
                    />
                  </View>

                  <View style={styles.modalActions}>
                    <Button
                      title="Cancel"
                      onPress={() => setShowWithdrawModal(false)}
                      style={{ backgroundColor: colors.textSecondary, marginRight: spacing.sm }}
                    />
                    <Button
                      title="Withdraw"
                      onPress={submitWithdrawal}
                      style={{ backgroundColor: colors.warning }}
                      disabled={!withdrawForm.amount || !withdrawForm.reason}
                    />
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBulkWithdrawModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBulkWithdrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Bulk Savings Withdrawal
              </Text>
              <TouchableOpacity
                onPress={() => setShowBulkWithdrawModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Withdraw savings from {bulkWithdrawData.selectedAccounts.length} eligible accounts
              </Text>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Reason *
                </Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={bulkWithdrawData.reason}
                  onChangeText={(text) => setBulkWithdrawData(prev => ({ ...prev, reason: text }))}
                  placeholder="Enter bulk withdrawal reason"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.bulkSummary}>
                <Text style={[styles.summaryTitle, { color: colors.text }]}>
                  Withdrawal Summary
                </Text>
                {bulkWithdrawData.selectedAccounts.map((account, index) => (
                  <View key={account.id} style={styles.summaryItem}>
                    <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                      {index + 1}. {account.memberName}
                    </Text>
                    <Text style={[styles.summaryAmount, { color: colors.warning }]}>
                      {formatCurrency(account.balance)}
                    </Text>
                  </View>
                ))}
                <View style={styles.totalSummary}>
                  <Text style={[styles.totalText, { color: colors.text }]}>
                    Total Withdrawal:
                  </Text>
                  <Text style={[styles.totalAmount, { color: colors.warning }]}>
                    {formatCurrency(bulkWithdrawData.selectedAccounts.reduce((sum, account) => sum + (account.balance || 0), 0))}
                  </Text>
                </View>
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setShowBulkWithdrawModal(false)}
                  style={{ backgroundColor: colors.textSecondary, marginRight: spacing.sm }}
                />
                <Button
                  title="Withdraw All"
                  onPress={submitBulkWithdrawal}
                  style={{ backgroundColor: colors.warning }}
                  disabled={!bulkWithdrawData.reason}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <OTPVerificationModal
        visible={showOTPModal}
        onClose={() => {
          setShowOTPModal(false);
          setSelectedApprovalItem(null);
          setApprovalActionType(null);
        }}
        title={approvalActionType === 'approve' ? 'Approve Withdrawal' : 'Verify Withdrawal'}
        subtitle={`Enter the OTP sent to your phone to ${approvalActionType} this savings withdrawal.`}
        onVerify={handleVerifyOTP}
        onResend={handleResendOTP}
        loading={otpLoading}
        itemType="savings-withdrawal"
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  },
  bulkActions: {
    padding: spacing.md,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalBody: {
    flex: 1,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.lg,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  formLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.sm,
  },
  formHint: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs / 2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.lg,
  },
  bulkSummary: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: '#f5f5f5',
    borderRadius: borderRadius.md,
  },
  summaryTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryText: {
    fontSize: typography.fontSize.sm,
  },
  summaryAmount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  totalSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: spacing.sm,
  },
  totalText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  totalAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationText: {
    fontSize: typography.fontSize.sm,
    color: '#2563eb',
    fontWeight: typography.fontWeight.medium,
  },
  paginationTextDisabled: {
    color: '#9ca3af',
  },
  paginationInfo: {
    fontSize: typography.fontSize.sm,
    color: '#6b7280',
    fontWeight: typography.fontWeight.medium,
  },
});

export default SavingsWithdrawalScreen;
