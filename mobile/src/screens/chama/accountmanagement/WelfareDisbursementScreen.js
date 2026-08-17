import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
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
import useWelfareDisbursementScreen from '../../../hooks/useWelfareDisbursementScreen';

const WelfareDisbursementScreen = ({ route, navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const screen = useWelfareDisbursementScreen({ route, navigation });

  const {
    welfareFunds,
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
    showDisburseModal,
    selectedFund,
    showBulkDisburseModal,
    disburseForm,
    bulkDisburseData,
    showOTPModal,
    otpLoading,
    selectedApprovalItem,
    approvalActionType,
    filters,
    tableStyles,
    headerStyles,
    currentChamaId,
    setSelectedFilter,
    setSearchQuery,
    setShowFilterDropdown,
    setShowDisburseModal,
    setShowBulkDisburseModal,
    setDisburseForm,
    setBulkDisburseData,
    setShowOTPModal,
    setSelectedApprovalItem,
    setApprovalActionType,
    loadWelfareFundsAll,
    onRefresh,
    handleDisburse,
    handleBulkDisburse,
    submitDisbursement,
    submitBulkDisbursement,
    handleInitiateApprove,
    handleVerifyOTP,
    handleResendOTP,
    canDisburseWelfare,
    canApproveWelfare,
    getStatusColor,
    formatCurrency,
    formatDate,
    getRequesterDisplayName,
  } = screen;

  const renderTableRow = ({ item, index }) => {
    const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;
    return (
      <View style={[tableStyles.tableRow, { backgroundColor: rowBackgroundColor }]}>
        <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
          <Text style={[tableStyles.tableCellText, tableStyles.nameText]} numberOfLines={1}>
            {item.requester_name || item.memberName || getRequesterDisplayName(item)}
          </Text>
        </View>
        <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
          <Text style={[tableStyles.tableCellText, { fontWeight: typography.fontWeight.medium }]}>
            {formatCurrency(item.amount)}
          </Text>
        </View>
        <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
          <Text style={tableStyles.tableCellText}>
            {formatDate(item.createdAt || item.created_at)}
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
              onPress={() => navigation.navigate('WelfareDetails', { fundId: item.id, chamaId: currentChamaId })}
            >
              <Ionicons name="eye" size={14} color={colors.info} />
            </TouchableOpacity>
            {canApproveWelfare() && (item.status === 'pending' || item.status === 'approved') && (
              <TouchableOpacity
                style={[tableStyles.actionButton, { backgroundColor: colors.primary + '20' }]}
                onPress={() => handleInitiateApprove(item)}
              >
                <Ionicons name="checkmark-done" size={14} color={colors.primary} />
              </TouchableOpacity>
            )}
            {canDisburseWelfare() && item.status === 'approved' && (
              <TouchableOpacity
                style={[tableStyles.actionButton, { backgroundColor: colors.success + '20' }]}
                onPress={() => handleDisburse(item)}
              >
                <Ionicons name="cash" size={14} color={colors.success} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="heart" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {selectedFilter === 'all'
          ? 'No welfare funds have been approved yet'
          : `No welfare funds with status "${selectedFilter}" found`}
      </Text>
    </View>
  );

  const renderHeader = () => {
    const approvedCount = screen.allWelfareFunds ? screen.allWelfareFunds.filter(fund => fund.status === 'approved').length : 0;
    return (
      <View style={[headerStyles.header, { backgroundColor: colors.surface }]}>
        <View style={headerStyles.headerContent}>
          <View style={[headerStyles.searchContainer, { marginRight: spacing.sm }]}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={[headerStyles.searchInput, { color: colors.text }]}
              placeholder="Search by name"
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          {canDisburseWelfare() && (
            <TouchableOpacity
              style={[headerStyles.bulkButton, { backgroundColor: colors.warning }]}
              onPress={handleBulkDisburse}
            >
              <Ionicons name="cash" size={16} color={colors.white} />
              <Text style={[headerStyles.bulkButtonText, { color: colors.white }]}>
                Bulk ({approvedCount})
              </Text>
            </TouchableOpacity>
          )}
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
  };

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
        <View style={{ flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.lg }}>
          <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
            <View style={tableStyles.tableHeader}>
              <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
                <Text style={[tableStyles.tableHeaderText, { textAlign: 'left' }]}>Member</Text>
              </View>
              <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
                <Text style={tableStyles.tableHeaderText}>Amount</Text>
              </View>
              <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
                <Text style={tableStyles.tableHeaderText}>Date</Text>
              </View>
              <View style={[tableStyles.tableCell, tableStyles.statusCell]}>
                <Text style={tableStyles.tableHeaderText}>Status</Text>
              </View>
              <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
                <Text style={tableStyles.tableHeaderText}>Actions</Text>
              </View>
            </View>
            <FlatList
              data={welfareFunds}
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
        visible={showDisburseModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDisburseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Disburse Welfare Fund</Text>
              <TouchableOpacity onPress={() => setShowDisburseModal(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {selectedFund && (
                <View>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    {selectedFund.memberName} - {formatCurrency(selectedFund.amount)}
                  </Text>
                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>Amount to Disburse (KES) *</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      value={disburseForm.amount}
                      onChangeText={(text) => setDisburseForm(prev => ({ ...prev, amount: text }))}
                      placeholder="Enter disbursement amount"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>Description *</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      value={disburseForm.description}
                      onChangeText={(text) => setDisburseForm(prev => ({ ...prev, description: text }))}
                      placeholder="Enter disbursement description"
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      numberOfLines={2}
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>Private Note (Audit Trail)</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      value={disburseForm.privateNote}
                      onChangeText={(text) => setDisburseForm(prev => ({ ...prev, privateNote: text }))}
                      placeholder="Optional note for audit purposes"
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      numberOfLines={2}
                    />
                  </View>
                  <View style={styles.modalActions}>
                    <Button
                      title="Cancel"
                      onPress={() => setShowDisburseModal(false)}
                      style={{ backgroundColor: colors.textSecondary, marginRight: spacing.sm }}
                    />
                    <Button
                      title="Disburse"
                      onPress={submitDisbursement}
                      style={{ backgroundColor: colors.success }}
                      disabled={!disburseForm.amount || !disburseForm.description}
                    />
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBulkDisburseModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBulkDisburseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Bulk Welfare Disbursement</Text>
              <TouchableOpacity onPress={() => setShowBulkDisburseModal(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Disburse welfare funds to {bulkDisburseData.selectedFunds.length} approved members
              </Text>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Description *</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={bulkDisburseData.description}
                  onChangeText={(text) => setBulkDisburseData(prev => ({ ...prev, description: text }))}
                  placeholder="Enter bulk disbursement description"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={2}
                />
              </View>
              <View style={[styles.bulkSummary, { backgroundColor: colors.surface }]}>
                <Text style={[styles.summaryTitle, { color: colors.text }]}>Disbursement Summary</Text>
                {bulkDisburseData.selectedFunds.map((fund, index) => (
                  <View key={fund.id} style={styles.summaryItem}>
                    <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                      {index + 1}. {getRequesterDisplayName(fund)}
                    </Text>
                    <Text style={[styles.summaryAmount, { color: colors.success }]}>
                      {formatCurrency(fund.amount)}
                    </Text>
                  </View>
                ))}
                <View style={styles.totalSummary}>
                  <Text style={[styles.totalText, { color: colors.text }]}>Total Amount:</Text>
                  <Text style={[styles.totalAmount, { color: colors.success }]}>
                    {formatCurrency(bulkDisburseData.selectedFunds.reduce((sum, fund) => sum + (fund.amount || 0), 0))}
                  </Text>
                </View>
              </View>
              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setShowBulkDisburseModal(false)}
                  style={{ backgroundColor: colors.textSecondary, marginRight: spacing.sm }}
                />
                <Button
                  title="Disburse All"
                  onPress={submitBulkDisbursement}
                  style={{ backgroundColor: colors.warning }}
                  disabled={!bulkDisburseData.description}
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
        title={approvalActionType === 'approve' ? 'Approve Disbursement' : 'Verify Disbursement'}
        subtitle={`Enter the OTP sent to your phone to ${approvalActionType} this welfare disbursement.`}
        onVerify={handleVerifyOTP}
        onResend={handleResendOTP}
        loading={otpLoading}
        itemType="welfare"
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
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
  paginationButtonDisabled: { opacity: 0.5 },
  paginationText: {
    fontSize: typography.fontSize.sm,
    color: '#2563eb',
    fontWeight: typography.fontWeight.medium,
  },
  paginationTextDisabled: { color: '#9ca3af' },
  paginationInfo: {
    fontSize: typography.fontSize.sm,
    color: '#6b7280',
    fontWeight: typography.fontWeight.medium,
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
  modalCloseButton: { padding: spacing.xs },
  modalBody: { flex: 1 },
  modalSubtitle: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.lg,
  },
  formGroup: { marginBottom: spacing.md },
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
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.lg,
  },
  bulkSummary: {
    marginTop: spacing.lg,
    padding: spacing.md,
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
  summaryText: { fontSize: typography.fontSize.sm },
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
});

export default WelfareDisbursementScreen;
