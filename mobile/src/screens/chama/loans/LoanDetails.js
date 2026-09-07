import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import RecordPaymentModal from '../../../components/chama-loans/RecordPaymentModal';
import LoanJourneyCard from '../../../components/chama-loans/LoanJourneyCard';
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
    { id: 'appGuarantors', cells: ['Accepted Guarantors', `${screen.loan?.approvedGuarantors ?? 0}/${screen.loan?.requiredGuarantors ?? 0}`] },
    { id: 'reqReferees', cells: ['Required Referees', screen.loan?.requiredReferees?.toString() || '0'] },
    { id: 'appReferees', cells: ['Accepted Referees', `${screen.loan?.approvedReferees ?? 0}/${screen.loan?.requiredReferees ?? 0}`] },
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

  const guarantorHeaders = ['Guarantor', 'Current Exposure', 'Status'];
  const guarantorData = screen.guarantors.map((g) => {
    const fullName = g.user ? `${g.user.firstName || ''} ${g.user.lastName || ''}`.trim() : 'Unknown';
    // Exposure is only meaningful once the guarantor has accepted; it tracks the
    // live outstanding balance + unpaid fines, split across accepted guarantors.
    const exposure = g.status === 'accepted' ? screen.formatCurrency(g.amount) : '—';
    return { id: g.id, cells: [fullName, exposure, screen.renderStatusBadge(g.status)] };
  });

  const refereeHeaders = ['Referee', 'Status'];
  const refereeData = (screen.referees || []).map((r) => {
    const fullName = r.user ? `${r.user.firstName || ''} ${r.user.lastName || ''}`.trim() : 'Unknown';
    return { id: r.id, cells: [fullName, screen.renderStatusBadge(r.status)] };
  });

  // Officer approval can only begin once every guarantor AND referee has accepted.
  // Gate on the loan's OWN counts (they arrive with the fast single-loan fetch and
  // are authoritative) so the Approve button never flickers while the separate
  // guarantor/referee lists are still loading.
  const guarantorsList = screen.guarantors || [];
  const refereesList = screen.referees || [];
  const backers = [...guarantorsList, ...refereesList];
  const reqGuarantors = Number(screen.loan?.requiredGuarantors ?? 0);
  const accGuarantors = Number(screen.loan?.approvedGuarantors ?? 0);
  const reqReferees = Number(screen.loan?.requiredReferees ?? 0);
  const accReferees = Number(screen.loan?.approvedReferees ?? 0);
  const totalRequiredBackers = reqGuarantors + reqReferees;
  const totalAcceptedBackers = accGuarantors + accReferees;
  const acceptedBackers = totalAcceptedBackers;
  const anyBackerDeclined =
    backers.some((b) => ['declined', 'rejected'].includes(String(b.status).toLowerCase())) ||
    screen.loan?.approvalStage === 'guarantors_declined';
  const backersReady =
    totalRequiredBackers === 0
      ? true
      : (accGuarantors >= reqGuarantors && accReferees >= reqReferees && !anyBackerDeclined);
  const isFirstApprovalStage = screen.loan?.approvalStage === 'pending';

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
      <Card variant="outlined" padding="none" margin="none" style={styles.tableCard}>
        {title ? <Text style={styles.tableTitle}>{title}</Text> : null}
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
          {data.length === 0
            ? renderEmpty(emptyMessage)
            : data.map((item, index) => (
                <View key={item.id} style={index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
                  {item.cells.map((cell, cellIndex) => renderCell(cell, cellIndex, item.cells.length))}
                </View>
              ))}
        </View>
      </Card>
    </View>
  );

  const renderDetailsCell = (cell, index, totalCells) => {
    const isFirst = index === 0;
    const flex = isFirst ? 1 : 1.5;
    return (
      <View key={index} style={[styles.tableCell, isFirst && styles.nameCell, { flex, alignItems: 'flex-start' }]}>
        <Text style={[styles.tableCellText, isFirst && styles.nameText, { textAlign: 'left' }]}>{cell}</Text>
      </View>
    );
  };

  const renderDetailsTable = ({ title, headers, data, emptyMessage }) => (
    <View style={styles.tableContainer}>
      <Card variant="outlined" padding="none" margin="none" style={styles.tableCard}>
        {title ? <Text style={styles.tableTitle}>{title}</Text> : null}
        <View style={styles.tableContent}>
          <View style={styles.tableHeader}>
            {headers.map((header, index) => {
              const isFirst = index === 0;
              const flex = isFirst ? 1 : 1.5;
              return (
                <View key={index} style={[styles.tableCell, isFirst && styles.nameCell, { flex, alignItems: 'flex-start' }]}>
                  <Text style={[styles.tableHeaderText, isFirst && styles.tableHeaderTextLeft, { textAlign: 'left' }]}>{header}</Text>
                </View>
              );
            })}
          </View>
          {data.length === 0
            ? renderEmpty(emptyMessage)
            : data.map((item, index) => (
                <View key={item.id} style={index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
                  {item.cells.map((cell, cellIndex) => renderDetailsCell(cell, cellIndex, item.cells.length))}
                </View>
              ))}
        </View>
      </Card>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, styles.containerBackground]}>
      <ScrollView
        ref={screen.scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
          <Card variant="outlined" margin="none" style={styles.amountCard}>
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
        {renderLoanTable({ title: 'Referees', headers: refereeHeaders, data: refereeData, emptyMessage: 'No referees for this loan' })}
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

        <LoanJourneyCard
          loan={screen.loan}
          disbursement={screen.disbursement}
          guarantors={screen.guarantors}
          referees={screen.referees}
          colors={colors}
        />

        <View style={styles.actions}>
          {/* Applicant view: only a Cancel button, and only before chairperson approval. */}
          {screen.isApplicant && (
            screen.canCancel ? (
              <Button
                title={screen.cancelling ? 'Withdrawing…' : 'Cancel Loan Application'}
                size="medium"
                loading={screen.cancelling}
                disabled={screen.cancelling}
                onPress={screen.handleCancelLoan}
                style={{ backgroundColor: colors.error, marginBottom: spacing.md }}
                icon={<Ionicons name="close-circle" size={16} color={colors.white} />}
              />
            ) : (
              <View style={{ marginBottom: spacing.md, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.textSecondary + '12', borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
                  This application can no longer be withdrawn. Its status is tracked in the Loan Journey above.
                </Text>
              </View>
            )
          )}

          {!screen.isApplicant && (screen.loan?.approvalStage === 'pending' || screen.loan?.approvalStage === 'secretary_approved' || screen.loan?.approvalStage === 'treasurer_approved') && !(isFirstApprovalStage && !backersReady) && (
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

          {!screen.isApplicant && screen.approvalStep === 'idle' && isFirstApprovalStage && !backersReady && (
            <View style={{ marginBottom: spacing.md, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: (anyBackerDeclined ? colors.error : colors.warning) + '15', borderWidth: 1, borderColor: (anyBackerDeclined ? colors.error : colors.warning) }}>
              <Text style={{ color: anyBackerDeclined ? colors.error : colors.warning, fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm }}>
                {anyBackerDeclined
                  ? 'A guarantor or referee declined — this loan cannot be approved.'
                  : `Waiting for all guarantors and referees to accept (${totalAcceptedBackers}/${totalRequiredBackers}).`}
              </Text>
            </View>
          )}

          {!screen.isApplicant && screen.approvalStep === 'idle' && (screen.loan?.approvalStage === 'pending' || screen.loan?.approvalStage === 'secretary_approved' || screen.loan?.approvalStage === 'treasurer_approved') && (() => {
            const canApprove = !isFirstApprovalStage || (backersReady && !anyBackerDeclined);
            return (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
                {canApprove && (
                  <Button title="Approve" size="medium" onPress={screen.handleInitiateApproval} loading={screen.approving} style={{ backgroundColor: colors.success, flex: 1 }} icon={<Ionicons name="checkmark" size={16} color={colors.white} />} />
                )}
                <Button title="Reject" size="medium" onPress={screen.handleRejectLoan} loading={screen.approving} style={canApprove ? { backgroundColor: colors.error, flex: 1 } : { backgroundColor: colors.error, alignSelf: 'flex-start' }} icon={<Ionicons name="close" size={16} color={colors.white} />} />
              </View>
            );
          })()}

          {!screen.isApplicant && screen.approvalStep === 'confirm' && (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={[styles.label, { color: colors.text, marginBottom: spacing.xs }]}>Enter the verification code e-mailed to you</Text>
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

          {/* Recording a repayment is an officer action — the applicant cannot
              act on their own loan at all (maker-checker). */}
          {!screen.isApplicant && ['active', 'delinquent', 'partial', 'recovery_active'].includes(screen.loan?.status?.toLowerCase()) && (
            <Button title="Record Payment" size="medium" onPress={() => screen.setPaymentModalVisible(true)} style={{ backgroundColor: colors.success, marginBottom: spacing.md }} icon={<Ionicons name="cash" size={16} color={colors.white} />} />
          )}

          <View style={styles.secondaryActions}>
            <Button
              title={screen.downloadingReport ? 'Preparing…' : 'Loan Report (PDF)'}
              size="small"
              variant="outline"
              loading={screen.downloadingReport}
              disabled={screen.downloadingReport}
              onPress={screen.handleDownloadReport}
              style={{ alignSelf: 'flex-start' }}
              icon={<Ionicons name="document-text" size={14} color={colors.primary} />}
            />
          </View>
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
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  secondaryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
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
  tableContainer: { marginTop: spacing.xs, marginBottom: spacing.sm, alignSelf: 'stretch' },
  tableCard: { borderRadius: 8, width: '100%', alignSelf: 'stretch', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tableScrollContent: { flexGrow: 1, width: '100%' },
  tableContent: { width: '100%' },
  tableTitle: { fontSize: 11, fontWeight: typography.fontWeight.bold, color: colors.textSecondary, paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.4 },
  tableHeader: { flexDirection: 'row', paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, backgroundColor: colors.primary + '10', borderBottomWidth: 1, borderBottomColor: colors.primary },
  tableCell: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  nameCell: { flex: 1.6, alignItems: 'flex-start' },
  amountCell: { flex: 1.3 },
  statusCell: { flex: 1 },
  dateCell: { flex: 1.2 },
  actionsCell: { flex: 1 },
  tableHeaderText: { fontWeight: typography.fontWeight.bold, color: colors.primary, fontSize: 11, textAlign: 'center' },
  tableHeaderTextLeft: { textAlign: 'left' },
  tableRowEven: { flexDirection: 'row', paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center', backgroundColor: colors.background },
  tableRowOdd: { flexDirection: 'row', paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center', backgroundColor: colors.surface },
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
  loansList: { flexGrow: 1 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md },
  emptyText: { color: colors.textSecondary, fontSize: typography.fontSize.xs, marginTop: spacing.xs, textAlign: 'center' },
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
