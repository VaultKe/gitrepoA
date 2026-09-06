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
import useLoanTypeCreationScreen from '../../../hooks/useLoanTypeCreationScreen';

const LoanTypeCreationScreen = ({ route, navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const screen = useLoanTypeCreationScreen({ route, navigation });

  const {
    loanTypes,
    loading,
    refreshing,
    selectedFilter,
    searchQuery,
    showFilterDropdown,
    userRole,
    showCreateModal,
    showEditModal,
    selectedLoanType,
    createForm,
    filters,
    tableStyles,
    headerStyles,
    currentChamaId,
    setSelectedFilter,
    setSearchQuery,
    setShowFilterDropdown,
    setShowCreateModal,
    setShowEditModal,
    setSelectedLoanType,
    setCreateForm,
    loadLoanTypes,
    onRefresh,
    handleCreateLoanType,
    handleEditLoanType,
    handleUpdateLoanType,
    handleToggleStatus,
    resetCreateForm,
    canCreateLoanTypes,
    formatCurrency,
  } = screen;

  const renderTableRow = ({ item, index }) => {
    const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;

    return (
      <View style={[tableStyles.tableRow, { backgroundColor: rowBackgroundColor }]}>
        {/* Loan Type Name */}
        <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
          <Text style={[tableStyles.tableCellText, tableStyles.nameText]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[tableStyles.tableCellText, { fontSize: 7, color: colors.textSecondary }]}>
            {item.description || 'No description'}
          </Text>
        </View>

        {/* Loan Amount */}
        <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
          <Text style={[tableStyles.tableCellText, { fontWeight: typography.fontWeight.medium }]}>
            {formatCurrency(item.exactAmount)}
          </Text>
        </View>

        {/* Interest Rate */}
        <View style={[tableStyles.tableCell, tableStyles.rateCell]}>
          <Text style={tableStyles.tableCellText}>
            {item.interestRate}%
          </Text>
        </View>

        {/* Term */}
        <View style={[tableStyles.tableCell, tableStyles.termCell]}>
          <Text style={tableStyles.tableCellText}>
            {item.termMonths} months
          </Text>
        </View>

        {/* Actions */}
        <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
          <View style={tableStyles.actionButtons}>
            <TouchableOpacity
              style={[tableStyles.actionButton, { backgroundColor: colors.info + '20' }]}
              onPress={() => navigation.navigate('LoanTypeDetails', { loanTypeId: item.id, chamaId: currentChamaId })}
            >
              <Ionicons name="eye" size={14} color={colors.info} />
            </TouchableOpacity>
            {canCreateLoanTypes() && (
              <>
                <TouchableOpacity
                  style={[tableStyles.actionButton, { backgroundColor: colors.primary + '20' }]}
                  onPress={() => handleEditLoanType(item)}
                >
                  <Ionicons name="create" size={14} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[tableStyles.actionButton, {
                    backgroundColor: (item.status === 'active' ? colors.error : colors.success) + '20'
                  }]}
                  onPress={() => handleToggleStatus(item)}
                >
                  <Ionicons
                    name={item.status === 'active' ? "close-circle" : "checkmark-circle"}
                    size={14}
                    color={item.status === 'active' ? colors.error : colors.success}
                  />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="card" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Loan Types Found
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Get started by creating your first loan type for the chama
      </Text>
      {canCreateLoanTypes() && (
        <Button
          title="Create First Loan Type"
          onPress={() => setShowCreateModal(true)}
          style={{ marginTop: spacing.lg, backgroundColor: colors.primary }}
          icon={<Ionicons name="add-circle" size={16} color={colors.white} />}
        />
      )}
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
            placeholder="Search loan types by name or amount..."
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
          {/* Table Header */}
          <View style={tableStyles.tableHeader}>
            <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
              <Text style={[tableStyles.tableHeaderText, { textAlign: 'left' }]}>Loan Type</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
              <Text style={tableStyles.tableHeaderText}>Loan Amount</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.rateCell]}>
              <Text style={tableStyles.tableHeaderText}>Rate</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.termCell]}>
              <Text style={tableStyles.tableHeaderText}>Term</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
              <Text style={tableStyles.tableHeaderText}>Actions</Text>
            </View>
          </View>

          {/* Table Body */}
          <FlatList
            data={loanTypes}
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

          {/* Create Button */}
          {canCreateLoanTypes() && (
            <View style={styles.createActions}>
              <Button
                title="Create New Loan Type"
                onPress={() => setShowCreateModal(true)}
                style={{ backgroundColor: colors.primary }}
                icon={<Ionicons name="add-circle" size={16} color={colors.white} />}
              />
            </View>
          )}
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

      {/* Create/Edit Modal */}
      <Modal
        visible={showCreateModal || showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
          setSelectedLoanType(null);
          resetCreateForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {showCreateModal ? 'Create Loan Type' : 'Edit Loan Type'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedLoanType(null);
                  resetCreateForm();
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Loan Name *</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={createForm.name}
                  onChangeText={(text) => setCreateForm(prev => ({ ...prev, name: text }))}
                  placeholder="Enter loan name"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Loan Description</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={createForm.description}
                  onChangeText={(text) => setCreateForm(prev => ({ ...prev, description: text }))}
                  placeholder="Describe this loan"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: spacing.sm }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>Loan Amount (KES) *</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={createForm.exactAmount}
                    onChangeText={(text) => setCreateForm(prev => ({ ...prev, exactAmount: text }))}
                    placeholder="e.g. 10000"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: spacing.sm }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>Net Disbursement (KES)</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={createForm.netDisbursement}
                    onChangeText={(text) => setCreateForm(prev => ({ ...prev, netDisbursement: text }))}
                    placeholder="e.g. 9500"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: spacing.sm }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>Loan Tenure (Months) *</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={createForm.termMonths}
                    onChangeText={(text) => setCreateForm(prev => ({ ...prev, termMonths: text }))}
                    placeholder="e.g. 12"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: spacing.sm }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>Default Threshold Days</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={createForm.defaultThresholdDays}
                    onChangeText={(text) => setCreateForm(prev => ({ ...prev, defaultThresholdDays: text }))}
                    placeholder="e.g. 30"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: spacing.sm }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>Installment Penalty Type</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={createForm.installmentPenaltyType}
                    onChangeText={(text) => setCreateForm(prev => ({ ...prev, installmentPenaltyType: text }))}
                    placeholder="fixed / percentage"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: spacing.sm }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>Installment Penalty Amount (KES)</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={createForm.installmentPenaltyAmount}
                    onChangeText={(text) => setCreateForm(prev => ({ ...prev, installmentPenaltyAmount: text }))}
                    placeholder="e.g. 50"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: spacing.sm }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>Loan Penalty Amount (KES)</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={createForm.loanPenaltyAmount}
                    onChangeText={(text) => setCreateForm(prev => ({ ...prev, loanPenaltyAmount: text }))}
                    placeholder="e.g. 500"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: spacing.sm }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>Interest Rate (%) *</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={createForm.interestRate}
                    onChangeText={(text) => setCreateForm(prev => ({ ...prev, interestRate: text }))}
                    placeholder="e.g. 12.5"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={{ marginTop: spacing.sm, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
                <Text style={[styles.formLabel, { color: colors.text, fontWeight: '700', marginBottom: spacing.sm }]}>Backing Requirements</Text>

                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }} onPress={() => setCreateForm(prev => ({ ...prev, requiresCollateral: !prev.requiresCollateral }))}>
                  <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: colors.border, backgroundColor: createForm.requiresCollateral ? colors.primary : colors.background, alignItems: 'center', justifyContent: 'center' }}>
                    {createForm.requiresCollateral && <Ionicons name="checkmark" size={14} color={colors.white} />}
                  </View>
                  <Text style={{ color: colors.text }}>Requires collateral</Text>
                </TouchableOpacity>

                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm }} onPress={() => setCreateForm(prev => ({ ...prev, requiresGuarantors: !prev.requiresGuarantors }))}>
                  <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: colors.border, backgroundColor: createForm.requiresGuarantors ? colors.primary : colors.background, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                    {createForm.requiresGuarantors && <Ionicons name="checkmark" size={14} color={colors.white} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text }}>Requires guarantors</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Guarantors carry a share of the loan liability.</Text>
                  </View>
                </TouchableOpacity>
                {createForm.requiresGuarantors && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: 28, marginBottom: spacing.sm }}>
                    <Text style={{ color: colors.textSecondary }}>Minimum guarantors</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, width: 64, textAlign: 'center', paddingVertical: 4 }]}
                      value={String(createForm.minGuarantors)}
                      onChangeText={(t) => setCreateForm(prev => ({ ...prev, minGuarantors: t.replace(/[^0-9]/g, '') }))}
                      keyboardType="numeric"
                      placeholder="2"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                )}

                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }} onPress={() => setCreateForm(prev => ({ ...prev, requiresReferees: !prev.requiresReferees }))}>
                  <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: colors.border, backgroundColor: createForm.requiresReferees ? colors.primary : colors.background, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                    {createForm.requiresReferees && <Ionicons name="checkmark" size={14} color={colors.white} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text }}>Requires referees</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Referees vouch for character only — no money is tied to them.</Text>
                  </View>
                </TouchableOpacity>
                {createForm.requiresReferees && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: 28, marginTop: spacing.sm }}>
                    <Text style={{ color: colors.textSecondary }}>Minimum referees</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, width: 64, textAlign: 'center', paddingVertical: 4 }]}
                      value={String(createForm.minReferees)}
                      onChangeText={(t) => setCreateForm(prev => ({ ...prev, minReferees: t.replace(/[^0-9]/g, '') }))}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                )}
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    setSelectedLoanType(null);
                    resetCreateForm();
                  }}
                  style={{ backgroundColor: colors.textSecondary, marginRight: spacing.sm }}
                />
                <Button
                  title={showCreateModal ? "Create" : "Update"}
                  onPress={showCreateModal ? handleCreateLoanType : handleUpdateLoanType}
                  style={{ backgroundColor: colors.primary }}
                  disabled={!createForm.name || !createForm.exactAmount || !createForm.interestRate || !createForm.termMonths}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  createActions: {
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
  formRow: {
    flexDirection: 'row',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.lg,
  },
});

export default LoanTypeCreationScreen;
