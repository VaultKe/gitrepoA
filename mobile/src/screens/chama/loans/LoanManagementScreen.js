import React from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, RefreshControl, TouchableOpacity, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import useLoanManagementScreen from '../../../hooks/useLoanManagementScreen';

const createTableStyles = (colors, spacing, typography, shadows) => ({
  tableContainer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xxxl },
  tableHeader: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.primary + '10', borderBottomWidth: 2, borderBottomColor: colors.primary },
  tableRow: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableCell: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  nameCell: { flex: 2 },
  amountCell: { flex: 1.5 },
  dateCell: { flex: 1.5 },
  statusCell: { flex: 1.2 },
  actionsCell: { flex: 1 },
  tableHeaderText: { fontWeight: typography.fontWeight.bold, color: colors.primary, fontSize: 12, textAlign: 'center' },
  tableCellText: { fontSize: 12, color: colors.text, textAlign: 'center' },
  nameText: { fontWeight: typography.fontWeight.medium, textAlign: 'left' },
  statusBadge: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs / 2, borderRadius: borderRadius.sm },
  statusText: { fontSize: 12, fontWeight: typography.fontWeight.bold, textTransform: 'capitalize' },
  actionButtons: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  actionButton: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});

const createHeaderStyles = (colors, spacing, typography, borderRadius) => ({
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, ...shadows.sm },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterContainer: { marginLeft: 'auto', position: 'relative' },
  filterButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, gap: spacing.xs, minWidth: 100, justifyContent: 'space-between' },
  filterButtonText: { flex: 1, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium },
  dropdownContainer: { minWidth: 200, maxWidth: 250, backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, shadowColor: colors.text, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 20 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  dropdownItemSelected: { backgroundColor: colors.primary },
  dropdownItemIcon: { width: 20, textAlign: 'center' },
  dropdownItemText: { flex: 1, fontSize: typography.fontSize.sm, color: colors.text },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.backgroundSecondary, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, flex: 1, marginRight: spacing.md },
  searchInput: { flex: 1, fontSize: typography.fontSize.sm, marginLeft: spacing.sm },
});

const LoanManagementScreen = ({ route, navigation }) => {
  const screen = useLoanManagementScreen({ route, navigation });
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const tableStyles = createTableStyles(colors, spacing, typography, shadows);
  const headerStyles = createHeaderStyles(colors, spacing, typography, borderRadius);

  const renderTableRow = ({ item, index }) => {
    const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;
    return (
      <View key={item.id} style={[tableStyles.tableRow, { backgroundColor: rowBackgroundColor }]}>
        <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
          <Text style={[tableStyles.tableCellText, tableStyles.nameText]} numberOfLines={1}>
            {item.borrower?.fullName || item.borrower?.name || item.applicant_name || item.memberName || item.applicant?.name || item.borrower?.first_name + ' ' + item.borrower?.last_name || 'Unknown Member'}
          </Text>
        </View>
        <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
          <Text style={[tableStyles.tableCellText, { fontWeight: typography.fontWeight.medium }]}>{screen.formatCurrency(item.amount)}</Text>
        </View>
        <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
          <Text style={tableStyles.tableCellText}>{screen.formatDate(item.createdAt || item.created_at)}</Text>
        </View>
        <View style={[tableStyles.tableCell, tableStyles.statusCell]}>
          <View style={[tableStyles.statusBadge, { backgroundColor: screen.getStatusColor(item.status) + '20' }]}>
            <Text style={[tableStyles.statusText, { color: screen.getStatusColor(item.status) }]}>{item.status?.toUpperCase().replace('_', ' ')}</Text>
          </View>
        </View>
        <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
          <View style={tableStyles.actionButtons}>
            <TouchableOpacity style={[tableStyles.actionButton, { backgroundColor: colors.info + '20' }]} onPress={() => screen.handleAction(item, 'view')}>
              <Ionicons name="eye" size={14} color={colors.info} />
            </TouchableOpacity>
            {screen.canDisburseLoans() && item.status === 'disbursement' && (
              <TouchableOpacity style={[tableStyles.actionButton, { backgroundColor: colors.primary + '20' }]} onPress={() => screen.handleAction(item, 'disburse')}>
                <Ionicons name="send" size={14} color={colors.primary} />
              </TouchableOpacity>
            )}
            {screen.canCollectPayments() && ['delinquent', 'partial', 'recovery_active'].includes(item.status?.toLowerCase().replace(' ', '_')) && (
              <TouchableOpacity style={[tableStyles.actionButton, { backgroundColor: colors.success + '20' }]} onPress={() => screen.handleAction(item, 'collect')}>
                <Ionicons name="cash" size={14} color={colors.success} />
              </TouchableOpacity>
            )}
            {screen.canUpdateStatus() && (
              <TouchableOpacity style={[tableStyles.actionButton, { backgroundColor: colors.warning + '20' }]} onPress={() => screen.handleAction(item, 'update_status')}>
                <Ionicons name="create" size={14} color={colors.warning} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm }}>
      <Ionicons name="card-outline" size={36} color={colors.textTertiary} />
      <Text style={{ color: colors.textSecondary, fontSize: typography.fontSize.sm }}>No loans found</Text>
    </View>
  );

  const renderHeader = () => (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, backgroundColor: colors.background }}>
      <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm }}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={{ flex: 1, color: colors.text, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs }}
              placeholder="Search member"
              placeholderTextColor={colors.textSecondary}
              value={screen.searchQuery}
              onChangeText={screen.setSearchQuery}
            />
            {screen.searchQuery ? (
              <TouchableOpacity onPress={() => screen.setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border }}
            onPress={() => screen.setShowFilterDropdown(!screen.showFilterDropdown)}
          >
            <Ionicons name={screen.filters.find(f => f.id === screen.selectedFilter)?.icon || 'list'} size={16} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: typography.fontSize.sm }}>{screen.filters.find(f => f.id === screen.selectedFilter)?.name || 'All'}</Text>
            <Ionicons name={screen.showFilterDropdown ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </Card>
    </View>
  );

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {renderHeader()}
        <ScrollView
          style={{ flex: 1, marginTop: spacing.sm }}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={screen.refreshing} onRefresh={screen.onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
          }
        >
          <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.md, backgroundColor: screen.loanSubview === 'loans' ? colors.primary + '18' : 'transparent', borderBottomWidth: screen.loanSubview === 'loans' ? 2 : 0, borderBottomColor: colors.primary }} onPress={() => screen.setLoanSubview('loans')}>
                <Ionicons name="list" size={18} color={screen.loanSubview === 'loans' ? colors.primary : colors.textSecondary} />
                <Text style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginTop: spacing.xs, color: screen.loanSubview === 'loans' ? colors.primary : colors.textSecondary }}>Loans</Text>
              </TouchableOpacity>
              {screen.canManageLoanTypes() && (
                <TouchableOpacity style={{ flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.md, backgroundColor: screen.loanSubview === 'loan-types' ? colors.primary + '18' : 'transparent', borderBottomWidth: screen.loanSubview === 'loan-types' ? 2 : 0, borderBottomColor: colors.primary }} onPress={() => { screen.setLoanSubview('loan-types'); screen.loadLoanTypes(); }}>
                  <Ionicons name="cash" size={18} color={screen.loanSubview === 'loan-types' ? colors.primary : colors.textSecondary} />
                  <Text style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginTop: spacing.xs, color: screen.loanSubview === 'loan-types' ? colors.primary : colors.textSecondary }}>Loan Types</Text>
                </TouchableOpacity>
              )}
              {screen.canManageLoanTypes() && (
                <TouchableOpacity style={{ flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.md, backgroundColor: screen.loanSubview === 'create-loan-type' ? colors.primary + '18' : 'transparent', borderBottomWidth: screen.loanSubview === 'create-loan-type' ? 2 : 0, borderBottomColor: colors.primary }} onPress={() => screen.setLoanSubview('create-loan-type')}>
                  <Ionicons name="add-circle" size={18} color={screen.loanSubview === 'create-loan-type' ? colors.primary : colors.textSecondary} />
                  <Text style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginTop: spacing.xs, color: screen.loanSubview === 'create-loan-type' ? colors.primary : colors.textSecondary }}>Add Loan Type</Text>
                </TouchableOpacity>
              )}
            </View>
            {screen.loanSubview === 'loans' ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
                <View style={{ minWidth: 640 }}>
                  <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg }}>
                    <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, backgroundColor: colors.primary + '10', borderBottomWidth: 2, borderBottomColor: colors.primary }}>
                      <View style={{ flex: 2, paddingHorizontal: spacing.xs }}><Text style={{ fontSize: 13, fontWeight: 'semibold', color: colors.primary }}>Member</Text></View>
                      <View style={{ flex: 1.5, alignItems: 'center' }}><Text style={{ fontSize: 13, fontWeight: 'semibold', color: colors.primary }}>Amount</Text></View>
                      <View style={{ flex: 1.5, alignItems: 'center' }}><Text style={{ fontSize: 13, fontWeight: 'semibold', color: colors.primary }}>Date</Text></View>
                      <View style={{ flex: 1.2, alignItems: 'center' }}><Text style={{ fontSize: 13, fontWeight: 'semibold', color: colors.primary }}>Status</Text></View>
                      <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 13, fontWeight: 'semibold', color: colors.primary }}>Actions</Text></View>
                    </View>
                    {screen.loans.length === 0 && !screen.loading ? renderEmptyState() : screen.loans.map((item, index) => renderTableRow({ item, index, key: item.id || `loan-${index}` }))}
                  </View>
                </View>
              </ScrollView>
            ) : screen.loanSubview === 'loan-types' ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
                <View style={{ minWidth: 640 }}>
                  <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
                    <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, backgroundColor: colors.primary + '10', borderBottomWidth: 2, borderBottomColor: colors.primary }}>
                      <Text style={{ flex: 2, fontSize: 13, fontWeight: 'semibold', color: colors.primary, paddingHorizontal: spacing.xs }}>Name</Text>
                      <Text style={{ flex: 1.5, fontSize: 13, fontWeight: 'semibold', color: colors.primary, textAlign: 'center' }}>Loan Amount</Text>
                      <Text style={{ flex: 1, fontSize: 13, fontWeight: 'semibold', color: colors.primary, textAlign: 'center' }}>Rate</Text>
                      <Text style={{ flex: 1.5, fontSize: 13, fontWeight: 'semibold', color: colors.primary, textAlign: 'center' }}>Term</Text>
                      <Text style={{ flex: 1, fontSize: 13, fontWeight: 'semibold', color: colors.primary, textAlign: 'center' }}>Status</Text>
                      {screen.canManageLoanTypes() && <Text style={{ flex: 0.8, fontSize: 13, fontWeight: 'semibold', color: colors.primary, textAlign: 'center' }}>Actions</Text>}
                    </View>
                    {screen.loanTypes.length === 0 && !screen.loanTypesLoading ? (
                      <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
                        <Ionicons name="cash-outline" size={36} color={colors.textSecondary} />
                        <Text style={{ color: colors.textSecondary, fontSize: typography.fontSize.sm }}>No loan types found</Text>
                      </View>
                    ) : (
                      screen.loanTypes.map((item, index) => (
                        <View key={item.id} style={{ flexDirection: 'row', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: index % 2 === 0 ? colors.background : colors.surface, alignItems: 'center' }}>
                          <View style={{ flex: 2, justifyContent: 'center', paddingHorizontal: spacing.xs }}>
                            <Text style={{ fontSize: 11, fontWeight: 'medium', color: colors.text }} numberOfLines={1}>{item.name}</Text>
                            <Text style={{ fontSize: 10, color: colors.textSecondary }} numberOfLines={1}>{item.description || '-'}</Text>
                          </View>
                          <View style={{ flex: 1.5, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 11, color: colors.text }}>{item.exactAmount ? screen.formatCurrency(item.exactAmount) : 'KES 0'}</Text>
                          </View>
                          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 11, color: colors.text }}>{item.interestRate}%</Text>
                          </View>
                          <View style={{ flex: 1.5, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 11, color: colors.text }}>{item.termMonths} mo</Text>
                            <Text style={{ fontSize: 10, color: colors.textSecondary }}>Grace: {item.gracePeriodDays || 0}d | Default: {item.defaultThresholdDays || 30}d</Text>
                          </View>
                          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <View style={{ paddingHorizontal: spacing.xs / 2, paddingVertical: spacing.xs / 2, borderRadius: 4, backgroundColor: (item.status === 'active' ? colors.success : colors.textSecondary) + '20' }}>
                              <Text style={{ fontSize: 11, fontWeight: 'bold', color: item.status === 'active' ? colors.success : colors.textSecondary, textTransform: 'capitalize' }}>{item.status}</Text>
                            </View>
                          </View>
                          {screen.canManageLoanTypes() && (
                            <View style={{ flex: 0.8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.xs / 2 }}>
                              <TouchableOpacity style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '20' }} onPress={() => screen.handleEditLoanType(item)}>
                                <Ionicons name="create" size={14} color={colors.primary} />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </ScrollView>
            ) : screen.loanSubview === 'create-loan-type' ? (
              <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
                    <View style={{ marginBottom: spacing.lg }}>
                      <Text style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.text, marginBottom: spacing.xs }}>{screen.editingLoanType ? 'Edit Loan Type' : 'Loan Type Information'}</Text>
                      <Text style={{ fontSize: typography.fontSize.base, color: colors.textSecondary }}>{screen.editingLoanType ? 'Update the loan product details below.' : 'Fill in the details below to define a new loan product for this chama.'}</Text>
                    </View>
                    <View style={{ gap: spacing.md }}>
                      <View>
                        <Text style={[styles.formLabel, { color: colors.text }]}>Loan Name *</Text>
                        <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]} value={screen.createForm.name} onChangeText={(text) => screen.setCreateForm((prev) => ({ ...prev, name: text }))} placeholder="Loan name" placeholderTextColor={colors.textSecondary} />
                      </View>
                      <View>
                        <Text style={[styles.formLabel, { color: colors.text }]}>Loan Description</Text>
                        <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, minHeight: 80, borderWidth: 1.5 }]} value={screen.createForm.description} onChangeText={(text) => screen.setCreateForm((prev) => ({ ...prev, description: text }))} placeholder="Describe this loan" placeholderTextColor={colors.textSecondary} multiline numberOfLines={3} />
                      </View>
                      <View style={{ flexDirection: 'row', gap: spacing.md }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Loan Period</Text>
                          <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]} value={screen.createForm.termMonths} onChangeText={(text) => screen.setCreateForm((prev) => ({ ...prev, termMonths: text }))} placeholder="e.g. 12" placeholderTextColor={colors.textSecondary} keyboardType="numeric" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Grace Period (Days)</Text>
                          <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]} value={screen.createForm.gracePeriodDays} onChangeText={(text) => screen.setCreateForm((prev) => ({ ...prev, gracePeriodDays: text }))} placeholder="e.g. 7" placeholderTextColor={colors.textSecondary} keyboardType="numeric" />
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: spacing.md }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Loan Amount (KES) *</Text>
                          <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]} value={screen.createForm.exactAmount} onChangeText={(text) => screen.setCreateForm((prev) => ({ ...prev, exactAmount: text }))} placeholder="e.g. 10000" placeholderTextColor={colors.textSecondary} keyboardType="numeric" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Net Disbursement (KES)</Text>
                          <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]} value={screen.createForm.netDisbursement} onChangeText={(text) => screen.setCreateForm((prev) => ({ ...prev, netDisbursement: text }))} placeholder="e.g. 9500" placeholderTextColor={colors.textSecondary} keyboardType="numeric" />
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: spacing.md }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Loan Tenure (Repayment Cycle)</Text>
                          <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]} value={screen.createForm.termMonths} onChangeText={(text) => screen.setCreateForm((prev) => ({ ...prev, termMonths: text }))} placeholder="e.g. 12" placeholderTextColor={colors.textSecondary} keyboardType="numeric" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Default Threshold Days</Text>
                          <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]} value={screen.createForm.defaultThresholdDays} onChangeText={(text) => screen.setCreateForm((prev) => ({ ...prev, defaultThresholdDays: text }))} placeholder="e.g. 30" placeholderTextColor={colors.textSecondary} keyboardType="numeric" />
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: spacing.md }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Installment Penalty Type</Text>
                          <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]} value={screen.createForm.installmentPenaltyType} onChangeText={(text) => screen.setCreateForm((prev) => ({ ...prev, installmentPenaltyType: text }))} placeholder="fixed / percentage" placeholderTextColor={colors.textSecondary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Installment Penalty Amount (KES)</Text>
                          <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]} value={screen.createForm.installmentPenaltyAmount} onChangeText={(text) => screen.setCreateForm((prev) => ({ ...prev, installmentPenaltyAmount: text }))} placeholder="e.g. 50" placeholderTextColor={colors.textSecondary} keyboardType="numeric" />
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: spacing.md }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Loan Penalty Amount (KES)</Text>
                          <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]} value={screen.createForm.loanPenaltyAmount} onChangeText={(text) => screen.setCreateForm((prev) => ({ ...prev, loanPenaltyAmount: text }))} placeholder="e.g. 500" placeholderTextColor={colors.textSecondary} keyboardType="numeric" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Interest Rate (%) *</Text>
                          <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]} value={screen.createForm.interestRate} onChangeText={(text) => screen.setCreateForm((prev) => ({ ...prev, interestRate: text }))} placeholder="e.g. 12.5" placeholderTextColor={colors.textSecondary} keyboardType="numeric" />
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }} onPress={() => screen.setCreateForm((prev) => ({ ...prev, requiresCollateral: !prev.requiresCollateral }))}>
                          <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: colors.border, backgroundColor: screen.createForm.requiresCollateral ? colors.primary : colors.background, alignItems: 'center', justifyContent: 'center' }}>
                            {screen.createForm.requiresCollateral && <Ionicons name="checkmark" size={14} color={colors.white} />}
                          </View>
                          <Text style={{ color: colors.text }}>Requires collateral</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }} onPress={() => screen.setCreateForm((prev) => ({ ...prev, requiresGuarantors: !prev.requiresGuarantors }))}>
                          <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: colors.border, backgroundColor: screen.createForm.requiresGuarantors ? colors.primary : colors.background, alignItems: 'center', justifyContent: 'center' }}>
                            {screen.createForm.requiresGuarantors && <Ionicons name="checkmark" size={14} color={colors.white} />}
                          </View>
                          <Text style={{ color: colors.text }}>Requires guarantors</Text>
                        </TouchableOpacity>
                      </View>
                      <Button title={screen.createSubmitting ? (screen.editingLoanType ? 'Updating...' : 'Creating...') : (screen.editingLoanType ? 'Update Loan Type' : 'Create Loan Type')} onPress={screen.handleCreateLoanType} disabled={screen.createSubmitting} style={{ backgroundColor: colors.primary, marginTop: spacing.md }} icon={!screen.createSubmitting && <Ionicons name={screen.editingLoanType ? 'save' : 'add'} size={16} color={colors.white} />} />
                    </View>
                  </View>
                </ScrollView>
              </View>
            ) : null}
          </Card>
        </ScrollView>
        {screen.loading && <LoadingSpinner />}
      </SafeAreaView>
      {screen.showFilterDropdown && (
        <View style={[headerStyles.dropdownContainer, { position: 'absolute', top: 140, right: 20, zIndex: 10000 }]}>
          {screen.filters.map((filter) => (
            <TouchableOpacity key={filter.id} style={[headerStyles.dropdownItem, screen.selectedFilter === filter.id && headerStyles.dropdownItemSelected]} onPress={() => { screen.setSelectedFilter(filter.id); screen.setShowFilterDropdown(false); }}>
              <Ionicons name={filter.icon} size={16} color={screen.selectedFilter === filter.id ? colors.white : colors.textSecondary} />
              <Text style={[headerStyles.dropdownItemText, screen.selectedFilter === filter.id && { color: colors.white }]}>{filter.name}</Text>
              {screen.selectedFilter === filter.id && <Ionicons name="checkmark" size={14} color={colors.white} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
      <Modal visible={screen.showActionModal} transparent={true} animationType="slide" onRequestClose={() => screen.setShowActionModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Loan Action</Text>
              <TouchableOpacity onPress={() => screen.setShowActionModal(false)} style={styles.modalCloseButton}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            {screen.selectedLoan && (
              <View style={styles.modalBody}>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>{screen.selectedLoan.memberName} - {screen.formatCurrency(screen.selectedLoan.amount)}</Text>
                <Text style={[styles.comingSoon, { color: colors.textSecondary }]}>Action functionality coming soon...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  formLabel: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginBottom: spacing.xs },
  formInput: { height: 48, paddingHorizontal: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalContent: { borderRadius: borderRadius.lg, padding: spacing.lg, width: '90%', maxWidth: 400, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold },
  modalCloseButton: { padding: spacing.xs },
  modalBody: { flex: 1 },
  modalSubtitle: { fontSize: typography.fontSize.sm, marginBottom: spacing.lg },
  comingSoon: { fontSize: typography.fontSize.base, textAlign: 'center', padding: spacing.xl },
});

export default LoanManagementScreen;
