import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, FlatList, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import RecordPaymentModal from '../../../components/chama-loans/RecordPaymentModal';
import useLoanDetails from '../../../hooks/useLoanDetails';

const LoanDetails = ({ route, navigation }) => {
  const screen = useLoanDetails({ route, navigation });
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);

  if (screen.loading && !screen.loan) {
    return (
      <SafeAreaView style={[styles.container, styles.containerBackground]}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading loan details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!screen.loan) {
    return (
      <SafeAreaView style={[styles.container, styles.containerBackground]}>
        <View style={styles.errorState}>
          <Ionicons name="card-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Loan Not Found</Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>Unable to load loan details</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} style={{ marginTop: spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  const borrowerName = screen.loan?.borrower?.fullName || screen.loan?.memberName || 'Unknown Borrower';
  const detailsHeaders = ['Field', 'Value'];
  const detailsData = [
    { id: 'status', cells: ['Status', screen.renderStatusBadge(screen.loan?.status)] },
    { id: 'type', cells: ['Type', screen.loan?.type || 'N/A'] },
    { id: 'purpose', cells: ['Purpose', screen.loan?.purpose || 'N/A'] },
    { id: 'borrower', cells: ['Borrower', borrowerName] },
    { id: 'amount', cells: ['Loan Amount', screen.formatCurrency(screen.loan?.amount)] },
    { id: 'rate', cells: ['Interest Rate', `${screen.loan?.interestRate || 0}%`] },
    { id: 'duration', cells: ['Duration', `${screen.loan?.duration || 0} months`] },
    { id: 'total', cells: ['Total Amount', screen.formatCurrency(screen.loan?.totalAmount)] },
    { id: 'paid', cells: ['Paid Amount', screen.formatCurrency(screen.loan?.paidAmount)] },
    { id: 'remaining', cells: ['Remaining', screen.formatCurrency(screen.loan?.remainingAmount)] },
    { id: 'due', cells: ['Due Date', screen.formatDate(screen.loan?.dueDate)] },
    { id: 'reqGuarantors', cells: ['Required Guarantors', screen.loan?.requiredGuarantors?.toString() || '0'] },
    { id: 'appGuarantors', cells: ['Approved Guarantors', screen.loan?.approvedGuarantors?.toString() || '0'] },
    { id: 'approvalStage', cells: ['Approval Stage', screen.loan?.approvalStage?.toUpperCase().replace('_', ' ') || 'N/A'] },
    { id: 'secretary', cells: ['Secretary Approval', screen.loan?.secretaryApprovedBy ? screen.formatDate(screen.loan?.secretaryApprovedAt) : 'Pending'] },
    { id: 'treasurer', cells: ['Treasurer Approval', screen.loan?.treasurerApprovedBy ? screen.formatDate(screen.loan?.treasurerApprovedAt) : 'Pending'] },
    { id: 'chairperson', cells: ['Chairperson Approval', screen.loan?.chairpersonApprovedBy ? screen.formatDate(screen.loan?.chairpersonApprovedAt) : 'Pending'] },
    { id: 'loanType', cells: ['Loan Type', screen.loanType?.name || screen.loan?.loanTypeId || 'N/A'] },
    { id: 'gracePeriod', cells: ['Grace Period', screen.loanType ? `${screen.loanType.gracePeriodDays || 0} days` : 'N/A'] },
    { id: 'defaultThreshold', cells: ['Default Threshold', screen.loanType ? `${screen.loanType.defaultThresholdDays || 30} days` : 'N/A'] },
    { id: 'netDisbursement', cells: ['Net Disbursement', screen.loanType ? screen.formatCurrency(screen.loanType.netDisbursement || 0) : 'N/A'] },
    { id: 'installmentPenalty', cells: ['Installment Penalty', screen.loanType ? `${screen.loanType.installmentPenaltyType || 'fixed'} · ${screen.formatCurrency(screen.loanType.installmentPenaltyAmount || 0)}` : 'N/A'] },
    { id: 'loanPenalty', cells: ['Loan Penalty', screen.loanType ? screen.formatCurrency(screen.loanType.loanPenaltyAmount || 0) : 'N/A'] },
    { id: 'created', cells: ['Created At', screen.formatDate(screen.loan?.createdAt)] },
  ];

  const scheduleHeaders = ['Month', 'Amount', 'Status'];
  const scheduleData = screen.schedule.map((item) => ({
    id: String(item.number),
    cells: [`Month ${item.number}`, screen.formatCurrency(item.amount), item.status?.toUpperCase()],
  }));

  const paymentHeaders = ['Date', 'Amount', 'Status'];
  const paymentData = screen.payments.map((payment) => {
    const paymentDate = payment.paidAt || payment.date || payment.createdAt;
    const paymentStatus = payment.status || 'completed';
    return { id: payment.id, cells: [screen.formatDate(paymentDate), screen.formatCurrency(payment.amount), screen.renderStatusBadge(paymentStatus)] };
  });

  const guarantorHeaders = ['Guarantor', 'Amount', 'Status'];
  const guarantorData = screen.guarantors.map((g) => {
    const fullName = g.user ? `${g.user.firstName || ''} ${g.user.lastName || ''}`.trim() : 'Unknown';
    return { id: g.id, cells: [fullName, screen.formatCurrency(g.amount), screen.renderStatusBadge(g.status)] };
  });

  const fineHeaders = ['Date', 'Reason', 'Amount', 'Status'];
  const fineData = screen.fines.map((f) => ({
    id: f.id,
    cells: [screen.formatDate(f.createdAt), f.reason, screen.formatCurrency(f.amount), screen.renderStatusBadge(f.status)],
  }));

  const renderCell = (cell, index, totalCells) => {
    const isFirst = index === 0;
    const isLast = index === totalCells - 1;
    const flex = isFirst ? 1.5 : isLast ? 1 : 1.5;
    return (
      <View key={index} style={[styles.tableCell, isFirst && styles.nameCell, isLast && styles.actionsCell, { flex }]}>
        <Text style={[styles.tableCellText, isFirst && styles.nameText]}>{cell}</Text>
      </View>
    );
  };

  const renderEmpty = (message) => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-outline" size={24} color={colors.textSecondary} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );

  const renderLoanTable = ({ title, headers, data, emptyMessage }) => (
    <View style={styles.tableContainer}>
      <Card variant="outlined" padding="none" style={styles.tableCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScrollContent}>
          <View style={styles.tableContent}>
            <View style={styles.tableHeader}>
              {headers.map((header, index) => {
                const isFirst = index === 0;
                const isLast = index === headers.length - 1;
                const flex = isFirst ? 1.5 : isLast ? 1 : 1.5;
                return (
                  <View key={index} style={[styles.tableCell, isFirst && styles.nameCell, isLast && styles.actionsCell, { flex }]}>
                    <Text style={[styles.tableHeaderText, isFirst && styles.tableHeaderTextLeft]}>{header}</Text>
                  </View>
                );
              })}
            </View>
            <FlatList
              data={data}
              renderItem={({ item, index }) => (
                <View style={index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
                  {item.cells.map((cell, cellIndex) => renderCell(cell, cellIndex, item.cells.length))}
                </View>
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.loansList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={renderEmpty(emptyMessage)}
            />
          </View>
        </ScrollView>
      </Card>
    </View>
  );

  const renderDetailsCell = (cell, index, totalCells) => {
    const isFirst = index === 0;
    const flex = isFirst ? 0.8 : 2;
    return (
      <View key={index} style={[styles.tableCell, isFirst && styles.nameCell, { flex, alignItems: 'flex-start' }]}>
        <Text style={[styles.tableCellText, isFirst && styles.nameText, { textAlign: 'left' }]}>{cell}</Text>
      </View>
    );
  };

  const renderDetailsTable = ({ title, headers, data, emptyMessage }) => (
    <View style={styles.tableContainer}>
      <Card variant="outlined" padding="none" style={styles.tableCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScrollContent}>
          <View style={styles.tableContent}>
            <View style={styles.tableHeader}>
              {headers.map((header, index) => {
                const isFirst = index === 0;
                const flex = isFirst ? 0.8 : 2;
                return (
                  <View key={index} style={[styles.tableCell, isFirst && styles.nameCell, { flex, alignItems: 'flex-start' }]}>
                    <Text style={[styles.tableHeaderText, isFirst && styles.tableHeaderTextLeft, { textAlign: 'left' }]}>{header}</Text>
                  </View>
                );
              })}
            </View>
            <FlatList
              data={data}
              renderItem={({ item, index }) => (
                <View style={index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
                  {item.cells.map((cell, cellIndex) => renderDetailsCell(cell, cellIndex, item.cells.length))}
                </View>
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.loansList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={renderEmpty(emptyMessage)}
            />
          </View>
        </ScrollView>
      </Card>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, styles.containerBackground]}>
      <ScrollView ref={screen.scrollViewRef} style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={styles.headerContent}>
            <View style={styles.loanIcon}>
              <Ionicons name="card" size={32} color={colors.primary} />
            </View>
            <View style={styles.loanInfo}>
              <Text style={[styles.loanTitle, { color: colors.text }]}>
                Loan #{screen.loan.createdAt ? new Date(screen.loan.createdAt).toISOString().slice(0, 7).replace('-', '') : ''}-{screen.loan.id?.slice(-8)}
              </Text>
              <Text style={[styles.loanMember, { color: colors.textSecondary }]}>{borrowerName}</Text>
            </View>
          </View>
        </View>

        {renderDetailsTable({ title: 'Loan Details', headers: detailsHeaders, data: detailsData, emptyMessage: 'No loan details available' })}

        {screen.disbursement && (
          <Card variant="outlined" style={styles.amountCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.success + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
                <Ionicons name="cash-outline" size={20} color={colors.success} />
              </View>
              <View>
                <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Disbursement</Text>
                <Text style={[styles.amountValue, { color: screen.getStatusColor(screen.disbursement.status), fontSize: typography.fontSize.lg }]}>{screen.formatCurrency(screen.disbursement.amount)}</Text>
                {screen.disbursement.reference ? (
                  <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs }}>
                    Ref: {screen.disbursement.reference}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.statusRow}>
              {screen.renderStatusBadge(screen.disbursement.status)}
              <Text style={{ color: colors.textSecondary, fontSize: typography.fontSize.xs, marginLeft: spacing.sm }}>{screen.formatDate(screen.disbursement.updatedAt || screen.disbursement.createdAt)}</Text>
            </View>
          </Card>
        )}

        {renderLoanTable({ title: 'Repayment Schedule', headers: scheduleHeaders, data: scheduleData, emptyMessage: 'No schedule available yet' })}
        {renderLoanTable({ title: 'Repayment History', headers: paymentHeaders, data: paymentData, emptyMessage: 'No repayment history yet' })}
        {renderLoanTable({ title: 'Guarantors', headers: guarantorHeaders, data: guarantorData, emptyMessage: 'No guarantors for this loan' })}
        {renderLoanTable({ title: 'Fines / Penalties', headers: fineHeaders, data: fineData, emptyMessage: 'No fines for this loan' })}

        {screen.totalItems > screen.pageSize && (
          <View style={styles.paginationContainer}>
            <TouchableOpacity
              style={[styles.paginationArrow, screen.currentPage === 1 && styles.paginationArrowDisabled]}
              onPress={() => screen.currentPage > 1 && screen.setCurrentPage(screen.currentPage - 1)}
              disabled={screen.currentPage === 1}
            >
              <Ionicons name="chevron-back" size={20} color={screen.currentPage === 1 ? '#9ca3af' : '#2563eb'} />
            </TouchableOpacity>
            <Text style={styles.paginationInfo}>{screen.currentPage} / {screen.totalPages}</Text>
            <TouchableOpacity
              style={[styles.paginationArrow, screen.currentPage === screen.totalPages && styles.paginationArrowDisabled]}
              onPress={() => screen.currentPage < screen.totalPages && screen.setCurrentPage(screen.currentPage + 1)}
              disabled={screen.currentPage === screen.totalPages}
            >
              <Ionicons name="chevron-forward" size={20} color={screen.currentPage === screen.totalPages ? '#9ca3af' : '#2563eb'} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actions}>
          {(screen.loan?.approvalStage === 'pending' || screen.loan?.approvalStage === 'secretary_approved' || screen.loan?.approvalStage === 'treasurer_approved') && (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={[styles.label, { color: colors.text, marginBottom: spacing.xs }]}>Approval Comment (Required)</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                value={screen.approvalComment}
                onChangeText={screen.setApprovalComment}
                placeholder="Enter your approval comment"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          )}

          {screen.approvalStep === 'idle' && (screen.loan?.approvalStage === 'pending' || screen.loan?.approvalStage === 'secretary_approved' || screen.loan?.approvalStage === 'treasurer_approved') && (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              <Button title="Approve" onPress={screen.handleInitiateApproval} loading={screen.approving} style={{ backgroundColor: colors.success, flex: 1 }} icon={<Ionicons name="checkmark" size={16} color={colors.white} />} />
              <Button title="Reject" onPress={screen.handleRejectLoan} loading={screen.approving} style={{ backgroundColor: colors.error, flex: 1 }} icon={<Ionicons name="close" size={16} color={colors.white} />} />
            </View>
          )}

          {screen.approvalStep === 'confirm' && (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={[styles.label, { color: colors.text, marginBottom: spacing.xs }]}>Enter OTP sent to your phone</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text, marginBottom: spacing.sm }]}
                value={screen.approvalOTP}
                onChangeText={screen.setApprovalOTP}
                placeholder="123456"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                maxLength={6}
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button title="Verify & Approve" onPress={screen.handleConfirmApproval} loading={screen.approving} style={{ backgroundColor: colors.success, flex: 1 }} icon={<Ionicons name="checkmark" size={16} color={colors.white} />} />
                <Button title="Cancel" onPress={() => { screen.setApprovalStep('idle'); screen.setApprovalOTP(''); }} style={{ backgroundColor: colors.textSecondary, flex: 1 }} />
              </View>
            </View>
          )}

          {['active', 'delinquent', 'partial', 'recovery_active'].includes(screen.loan?.status?.toLowerCase()) && (
            <Button title="Record Payment" onPress={() => screen.setPaymentModalVisible(true)} style={{ backgroundColor: colors.success, marginBottom: spacing.md }} icon={<Ionicons name="cash" size={16} color={colors.white} />} />
          )}
          <Button title="View Schedule" onPress={() => {}} style={{ backgroundColor: colors.info, marginBottom: spacing.md }} icon={<Ionicons name="calendar" size={16} color={colors.white} />} />
          <Button title="Loan Report" onPress={() => Alert.alert('Coming Soon', 'Loan reports will be available in the next update.')} style={{ backgroundColor: colors.secondary, marginBottom: spacing.md }} icon={<Ionicons name="document-text" size={16} color={colors.white} />} />
        </View>
      </ScrollView>

      <RecordPaymentModal
        visible={screen.paymentModalVisible}
        onClose={() => screen.setPaymentModalVisible(false)}
        colors={colors}
        paymentAmount={screen.paymentAmount}
        setPaymentAmount={screen.setPaymentAmount}
        paymentMethod={screen.paymentMethod}
        setPaymentMethod={screen.setPaymentMethod}
        submittingPayment={screen.submittingPayment}
        handleRecordPayment={screen.handleRecordPayment}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  containerBackground: { backgroundColor: colors.background },
  scrollView: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { fontSize: typography.fontSize.base },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  errorTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginTop: spacing.md, marginBottom: spacing.xs },
  errorSubtitle: { fontSize: typography.fontSize.sm, textAlign: 'center' },
  header: { borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm },
  headerContent: { flexDirection: 'row', alignItems: 'center' },
  loanIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(59, 130, 246, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: spacing.lg },
  loanInfo: { flex: 1 },
  loanTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.xs },
  loanMember: { fontSize: typography.fontSize.sm },
  tableContainer: { marginHorizontal: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.sm, alignSelf: 'stretch' },
  tableCard: { minHeight: 360, borderRadius: 8, width: '100%', alignSelf: 'stretch', padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tableScrollContent: { flexGrow: 1, width: '100%' },
  tableContent: { minWidth: 680, width: '100%' },
  tableHeader: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.primary + '10', borderBottomWidth: 2, borderBottomColor: colors.primary },
  tableCell: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  nameCell: { flex: 1.6, alignItems: 'flex-start' },
  amountCell: { flex: 1.3 },
  statusCell: { flex: 1 },
  dateCell: { flex: 1.2 },
  actionsCell: { flex: 1 },
  tableHeaderText: { fontWeight: typography.fontWeight.bold, color: colors.primary, fontSize: 12, textAlign: 'center' },
  tableHeaderTextLeft: { textAlign: 'left' },
  tableRowEven: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center', backgroundColor: colors.background },
  tableRowOdd: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center', backgroundColor: colors.surface },
  tableCellText: { fontSize: 12, color: colors.text, textAlign: 'center' },
  nameText: { fontWeight: typography.fontWeight.medium, textAlign: 'left' },
  statusBadge: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs / 2, borderRadius: borderRadius.sm },
  statusBadgeSuccess: { backgroundColor: colors.success + '20' },
  statusBadgeWarning: { backgroundColor: colors.warning + '20' },
  statusBadgeError: { backgroundColor: colors.error + '20' },
  statusBadgeMuted: { backgroundColor: colors.textSecondary + '20' },
  statusText: { fontSize: 7, fontWeight: typography.fontWeight.bold, textTransform: 'capitalize' },
  statusTextSuccess: { color: colors.success },
  statusTextWarning: { color: colors.warning },
  statusTextError: { color: colors.error },
  statusTextMuted: { color: colors.textSecondary },
  loansList: { padding: spacing.md },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl },
  emptyText: { color: colors.textSecondary, fontSize: typography.fontSize.sm, marginTop: spacing.sm, textAlign: 'center' },
  amountCard: { padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md, ...shadows.sm },
  amountLabel: { fontSize: typography.fontSize.sm, marginBottom: spacing.xs },
  amountValue: { fontSize: typography.fontSize.xxxl, fontWeight: typography.fontWeight.bold, marginBottom: spacing.sm },
  label: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.fontSize.base, borderColor: colors.border, color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  paginationContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: '#f5f5f5', borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: spacing.sm },
  paginationArrow: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.sm },
  paginationArrowDisabled: { opacity: 0.5 },
  paginationInfo: { fontSize: typography.fontSize.sm, color: '#6b7280', fontWeight: typography.fontWeight.medium, minWidth: 60, textAlign: 'center' },
  actions: { marginBottom: spacing.xxxl },
});

export default LoanDetails;
