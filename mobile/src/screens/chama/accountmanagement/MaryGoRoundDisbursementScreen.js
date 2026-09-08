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
import useMaryGoRoundDisbursementScreen from '../../../hooks/useMaryGoRoundDisbursementScreen';

const MaryGoRoundDisbursementScreen = ({ route, navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const screen = useMaryGoRoundDisbursementScreen({ route, navigation });

  const {
    maryGoRoundCycles,
    summary,
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
    selectedCycle,
    showBulkDisburseModal,
    disburseForm,
    initiating,
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
    loadMaryGoRoundCycles,
    onRefresh,
    handleDisburse,
    handleBulkDisburse,
    submitDisbursement,
    submitBulkDisbursement,
    handleInitiateApprove,
    handleVerifyOTP,
    handleResendOTP,
    canDisburseMaryGoRound,
    canApproveMaryGoRound,
    getStatusColor,
    getStatusText,
    formatCurrency,
    formatDate,
  } = screen;

  const renderTableRow = ({ item, index }) => {
    const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;

    const showInitiate =
      canDisburseMaryGoRound() && !item.pendingDisbursement && item.state === 'ready';
    const showConfirm = canApproveMaryGoRound() && item.state === 'awaiting_confirmation';
    const showAwaiting = canDisburseMaryGoRound() && item.state === 'awaiting_confirmation';

    return (
      <View style={{ backgroundColor: rowBackgroundColor, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[tableStyles.tableRow, { borderBottomWidth: 0 }]}
          onPress={() => navigation.navigate('MaryGoRoundDetails', { record: item, chamaId: currentChamaId })}
        >
          {/* Recipient + state */}
          <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
            <Text style={[tableStyles.tableCellText, tableStyles.nameText]} numberOfLines={1}>
              {item.recipientName || 'Unknown Recipient'}
            </Text>
            <Text style={[tableStyles.tableCellText, { fontSize: 9, color: getStatusColor(item), fontWeight: typography.fontWeight.bold, textAlign: 'left' }]} numberOfLines={1}>
              {getStatusText(item)}
            </Text>
            {item.mpesaCode ? (
              <Text style={[tableStyles.tableCellText, { fontSize: 8, color: colors.textSecondary, textAlign: 'left' }]} numberOfLines={1}>
                M-Pesa: {item.mpesaCode}
              </Text>
            ) : null}
          </View>

          {/* Amount */}
          <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
            <Text style={[tableStyles.tableCellText, { fontWeight: typography.fontWeight.medium }]}>
              {formatCurrency(item.amount || 0)}
            </Text>
            {item.state === 'collecting' && item.expectedAmount ? (
              <Text style={[tableStyles.tableCellText, { fontSize: 8, color: colors.textSecondary }]}>
                of ~{formatCurrency(item.expectedAmount)}
              </Text>
            ) : null}
          </View>

          {/* Round */}
          <View style={[tableStyles.tableCell, tableStyles.roundCell]}>
            <Text style={tableStyles.tableCellText}>{item.roundNumber}</Text>
          </View>

          {/* Date */}
          <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
            <Text style={tableStyles.tableCellText}>
              {item.disbursedAt ? formatDate(item.disbursedAt) : '—'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Action bar — full width, only when there is an action */}
        {(showInitiate || showConfirm || showAwaiting) && (
          <View style={styles.rowActionBar}>
            {showInitiate && (
              <TouchableOpacity
                style={[styles.rowActionBtn, { backgroundColor: colors.success }]}
                onPress={() => handleDisburse(item)}
              >
                <Ionicons name="cash" size={15} color={colors.white} />
                <Text style={styles.rowActionText}>Initiate disbursement</Text>
              </TouchableOpacity>
            )}
            {showConfirm && (
              <TouchableOpacity
                style={[styles.rowActionBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleInitiateApprove(item)}
              >
                <Ionicons name="shield-checkmark" size={15} color={colors.white} />
                <Text style={styles.rowActionText}>Confirm & disburse</Text>
              </TouchableOpacity>
            )}
            {showAwaiting && (
              <View style={[styles.rowActionBtn, { backgroundColor: colors.warning + '22' }]}>
                <Ionicons name="hourglass" size={15} color={colors.warning} />
                <Text style={[styles.rowActionText, { color: colors.warning }]}>Awaiting chairperson</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="refresh-circle" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No rounds to show
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {selectedFilter === 'all'
          ? 'No merry-go-round rounds have been recorded yet'
          : `No rounds match this filter`
        }
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={[headerStyles.header, { backgroundColor: colors.surface }]}>
      <View style={headerStyles.headerContent}>
        {/* Search Bar */}
        <View style={headerStyles.searchContainer}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[headerStyles.searchInput, { color: colors.text }]}
            placeholder="Search recipient"
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

        {/* Filter Dropdown */}
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

        {summary && (
          <View style={styles.summaryBar}>
            <View style={[styles.summaryPill, { backgroundColor: colors.warning + '18' }]}>
              <Text style={[styles.summaryNum, { color: colors.warning }]}>{summary.pendingDisbursement || 0}</Text>
              <Text style={[styles.summaryLbl, { color: colors.textSecondary }]}>pending payout</Text>
            </View>
            <View style={[styles.summaryPill, { backgroundColor: colors.success + '18' }]}>
              <Text style={[styles.summaryNum, { color: colors.success }]}>{summary.disbursed || 0}</Text>
              <Text style={[styles.summaryLbl, { color: colors.textSecondary }]}>disbursed</Text>
            </View>
            <View style={[styles.summaryPill, { backgroundColor: colors.primary + '18' }]}>
              <Text style={[styles.summaryNum, { color: colors.primary, fontSize: 12 }]}>{formatCurrency(summary.disbursedTotal || 0)}</Text>
              <Text style={[styles.summaryLbl, { color: colors.textSecondary }]}>paid out total</Text>
            </View>
          </View>
        )}

        {/* Dropdown Overlay */}
        {showFilterDropdown && (
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowFilterDropdown(false)}
          />
        )}

        {/* Table Container */}
        <View style={{ flex: 1, paddingHorizontal: spacing.sm, paddingTop: spacing.sm }}>
          <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
            {/* Table Header */}
            <View style={tableStyles.tableHeader}>
              <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
                <Text style={[tableStyles.tableHeaderText, { textAlign: 'left' }]}>Recipient & status</Text>
              </View>
              <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
                <Text style={tableStyles.tableHeaderText}>Amount</Text>
              </View>
              <View style={[tableStyles.tableCell, tableStyles.roundCell]}>
                <Text style={tableStyles.tableHeaderText}>Round</Text>
              </View>
              <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
                <Text style={tableStyles.tableHeaderText}>Disbursed</Text>
              </View>
            </View>

            {/* Table Body */}
            <FlatList
              data={maryGoRoundCycles}
              renderItem={renderTableRow}
              keyExtractor={(item) => item.key}
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

            {/* Pagination */}
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

            {/* Merry-go-round payouts are strictly one recipient at a time
                (treasurer initiates → chairperson confirms), so there is no
                bulk disbursement. */}
          </Card>
        </View>

        {loading && <LoadingSpinner />}
      </SafeAreaView>

      {/* Filter Dropdown */}
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

      {/* Disburse Modal */}
      <Modal
        visible={showDisburseModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDisburseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Disburse Merry Go Round
              </Text>
              <TouchableOpacity
                onPress={() => setShowDisburseModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedCycle && (
                <View>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    Recipient: {selectedCycle.recipientName || selectedCycle.recipient?.name || 'Current recipient'} · Round {selectedCycle.current_position || selectedCycle.currentRound || selectedCycle.cycleNumber || 1}
                  </Text>

                  <View style={[styles.formGroup, { backgroundColor: colors.primary + '10', borderRadius: borderRadius.md, padding: spacing.md }]}>
                    <Text style={{ color: colors.text, fontSize: typography.fontSize.sm, lineHeight: 20 }}>
                      The recipient is paid the amount actually collected for this round so far, drawn from the chama's merry-go-round wallet. VaultKe calculates it — you do not enter it here.
                      {'\n\n'}
                      When you continue, a one-time confirmation code is e-mailed to the chairperson. The payout is sent to the recipient's M-Pesa the moment the chairperson confirms.
                    </Text>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>
                      Note (optional)
                    </Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      value={disburseForm.description}
                      onChangeText={(text) => setDisburseForm(prev => ({ ...prev, description: text }))}
                      placeholder="Add a note for the records"
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
                      title={initiating ? 'Sending…' : 'Send for approval'}
                      onPress={submitDisbursement}
                      style={{ backgroundColor: colors.primary }}
                      disabled={initiating}
                    />
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bulk Disburse Modal */}
      <Modal
        visible={showBulkDisburseModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBulkDisburseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Bulk Merry Go Round Disbursement
              </Text>
              <TouchableOpacity
                onPress={() => setShowBulkDisburseModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Disburse merry go round funds for {bulkDisburseData.selectedCycles.length} ready cycles
              </Text>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Description *
                </Text>
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

              <View style={styles.bulkSummary}>
                <Text style={[styles.summaryTitle, { color: colors.text }]}>
                  Disbursement Summary
                </Text>
                {bulkDisburseData.selectedCycles.map((cycle, index) => (
                  <View key={cycle.id} style={styles.summaryItem}>
                    <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                      {index + 1}. {cycle.name || `Cycle ${cycle.cycleNumber || cycle.currentRound || 1}`} - {cycle.recipientName || cycle.recipient?.name}
                    </Text>
                    <Text style={[styles.summaryAmount, { color: colors.primary }]}>
                      {formatCurrency(cycle.amount)}
                    </Text>
                  </View>
                ))}
                <View style={styles.totalSummary}>
                  <Text style={[styles.totalText, { color: colors.text }]}>
                    Total Disbursement:
                  </Text>
                  <Text style={[styles.totalAmount, { color: colors.primary }]}>
                    {formatCurrency(bulkDisburseData.selectedCycles.reduce((sum, cycle) => sum + (cycle.amount || 0), 0))}
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
                  style={{ backgroundColor: colors.primary }}
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
        title="Confirm Disbursement"
        subtitle={
          selectedApprovalItem?.pendingDisbursement
            ? `Enter the code e-mailed to you to send KES ${Number(selectedApprovalItem.pendingDisbursement.amount || 0).toLocaleString()} to ${selectedApprovalItem.pendingDisbursement.recipientName || 'the recipient'}'s M-Pesa now.`
            : "Enter the confirmation code e-mailed to you as chairperson. On confirmation the payout is sent to the recipient's M-Pesa immediately."
        }
        onVerify={handleVerifyOTP}
        onResend={handleResendOTP}
        loading={otpLoading}
        itemType="merry-go-round"
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
  rowActionBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs / 2,
  },
  rowActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  rowActionText: {
    color: '#fff',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  summaryBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  summaryPill: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  summaryNum: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  summaryLbl: {
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
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

export default MaryGoRoundDisbursementScreen;
