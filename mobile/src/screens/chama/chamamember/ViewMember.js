import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import useViewMember from '../../../hooks/useViewMember';
import ViewMemberProfileSection from '../../../components/chama-members/ViewMemberProfileSection';
import ViewMemberStatsSection from '../../../components/chama-members/ViewMemberStatsSection';
import ViewMemberDetailsSection from '../../../components/chama-members/ViewMemberDetailsSection';
import ViewMemberServiceFeeSection from '../../../components/chama-members/ViewMemberServiceFeeSection';
import ViewMemberApprovalSection from '../../../components/chama-members/ViewMemberApprovalSection';
import ViewMemberActionsSection from '../../../components/chama-members/ViewMemberActionsSection';
import ViewMemberActivitySection from '../../../components/chama-members/ViewMemberActivitySection';

const ViewMember = ({ route, navigation }) => {
  const screen = useViewMember({ route, navigation });
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);

  const canShowCombined = screen.userRole === 'chairperson' || screen.userRole === 'secretary' || screen.userRole === 'treasurer' ||
    screen.approvalHistory.some(item => item.randomVerifierId === screen.user?.id || item.verifierId === screen.user?.id);

  return (
    <SafeAreaView style={[styles.container, styles.containerBackground]}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {screen.loading && !screen.memberData && !screen.loadError && (
          <View style={styles.inlineTableLoading}>
            <Text style={[styles.inlineTableLoadingText, { color: colors.textSecondary }]}>Loading member details...</Text>
          </View>
        )}
        {screen.loadError && !screen.memberData && !screen.loading && (
          <View style={styles.inlineTableLoading}>
            <Text style={[styles.inlineTableLoadingText, { color: colors.textSecondary }]}>{screen.loadError}</Text>
            <Button title="Retry" onPress={() => screen.loadMemberDetails()} style={{ marginTop: spacing.sm }} />
          </View>
        )}
        {screen.memberData && (
          <>
            <ViewMemberProfileSection
              memberData={screen.memberData}
              imageExpanded={screen.imageExpanded}
              failedAvatars={screen.failedAvatars}
              renderMemberAvatar={screen.renderMemberAvatar}
              handleImagePress={screen.handleImagePress}
              styles={styles}
              colors={colors}
            />
            <ViewMemberStatsSection
              memberStats={screen.memberStats}
              formatCurrency={screen.formatCurrency}
              styles={styles}
              colors={colors}
            />
            {canShowCombined && (
              <Card variant="outlined" padding="none" style={styles.statsCard}>
                <View style={screen.isDesktop ? styles.combinedCardRow : styles.combinedCardColumn}>
                  <View style={screen.isDesktop ? styles.combinedCardLeft : styles.combinedCardFull}>
                    <ViewMemberDetailsSection
                      memberData={screen.memberData}
                      isCombined
                      isDesktop={screen.isDesktop}
                      formatDate={screen.formatDate}
                      maskPhone={screen.maskPhone}
                      maskLocation={screen.maskLocation}
                      maskOccupation={screen.maskOccupation}
                      getRoleColor={screen.getRoleColor}
                      getRoleIcon={screen.getRoleIcon}
                      styles={styles}
                      colors={colors}
                    />
                  </View>
                  {screen.isDesktop && <View style={styles.combinedDivider} />}
                  <View style={screen.isDesktop ? styles.combinedCardRight : styles.combinedCardFull}>
                    <ViewMemberApprovalSection
                      approvalHistory={screen.approvalHistory}
                      userRole={screen.userRole}
                      approvalHistoryLoading={screen.approvalHistoryLoading}
                      isDesktop={screen.isDesktop}
                      isCombined
                      onInitiateApprove={screen.handleInitiateApprove}
                      styles={styles}
                      colors={colors}
                    />
                  </View>
                </View>
              </Card>
            )}
            {screen.isSelf && (
              <ViewMemberActivitySection
                recentActivity={screen.recentActivity}
                activityPage={screen.activityPage}
                setActivityPage={screen.setActivityPage}
                activityItemsPerPage={10}
                getActivityColor={screen.getActivityColor}
                formatDate={screen.formatDate}
                formatCurrency={screen.formatCurrency}
                styles={styles}
                colors={colors}
              />
            )}
            <ViewMemberServiceFeeSection
              serviceFeePayments={screen.serviceFeePayments}
              memberData={screen.memberData}
              userRole={screen.userRole}
              payingFee={screen.payingFee}
              cooldownActive={screen.cooldownActive}
              cooldownRemaining={screen.cooldownRemaining}
              hasPaidServiceFee={screen.hasPaidServiceFee}
              feePaymentsLoading={screen.feePaymentsLoading}
              onPayServiceFee={screen.handlePayServiceFee}
              onPayMemberServiceFee={screen.handlePayMemberServiceFee}
              onDownloadReceipt={screen.handleDownloadReceipt}
              styles={styles}
              colors={colors}
            />
            <ViewMemberActionsSection
              userRole={screen.userRole}
              memberData={screen.memberData}
              user={screen.user}
              removeLoading={screen.removeLoading}
              showRemoveConfirm={screen.showRemoveConfirm}
              showOTPModal={screen.showOTPModal}
              selectedApprovalItem={screen.selectedApprovalItem}
              approvalActionType={screen.approvalActionType}
              otpLoading={screen.otpLoading}
              onRemoveMember={screen.handleRemoveMember}
              onConfirmRemove={screen.confirmRemoveMember}
              onCancelRemove={() => screen.setShowRemoveConfirm(false)}
              onVerifyOTP={screen.handleVerifyOTP}
              onResendOTP={screen.handleResendOTP}
              onCloseOTP={() => { screen.setShowOTPModal(false); screen.setSelectedApprovalItem(null); screen.setApprovalActionType(null); }}
              getMemberName={screen.getMemberName}
              formatCurrency={screen.formatCurrency}
              styles={styles}
              colors={colors}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  containerBackground: { backgroundColor: colors.background },
  content: { flex: 1 },
  contentContainer: { padding: spacing.md },
  inlineTableLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  inlineTableLoadingText: { fontSize: typography.fontSize.sm },
  profileCard: { padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  framelessCard: { padding: 0, overflow: 'hidden' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  avatarContainer: { marginRight: spacing.md },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary },
  avatarPlaceholderPrimary: { backgroundColor: colors.primary },
  avatarText: { color: colors.white, fontSize: 32, fontWeight: typography.fontWeight.semibold },
  expandImageOverlay: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.info + '90' },
  framelessProfileLayout: { position: 'relative', overflow: 'hidden' },
  minimizeButton: { position: 'absolute', top: spacing.sm, right: spacing.sm, zIndex: 10, backgroundColor: 'rgba(0, 0, 0, 0.5)', borderRadius: 20, padding: spacing.sm },
  framelessImageContainer: { width: '100%', alignItems: 'center' },
  expandedAvatar: { width: '100%', height: 350, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, backgroundColor: colors.surface },
  expandedAvatarPlaceholder: { width: '100%', height: 350, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary },
  expandedAvatarText: { fontSize: 120, fontWeight: typography.fontWeight.semibold },
  framelessProfileInfo: { alignItems: 'center', padding: spacing.md, backgroundColor: 'transparent' },
  minimizeHint: { fontSize: typography.fontSize.sm, fontStyle: 'italic', marginTop: spacing.sm },
  minimizeHintSecondary: { color: colors.textSecondary },
  profileInfo: { flex: 1 },
  memberName: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.xs },
  memberNameText: { color: colors.text },
  memberEmail: { fontSize: typography.fontSize.sm, marginBottom: spacing.sm },
  memberEmailSecondary: { color: colors.textSecondary },
  statsCard: { borderRadius: borderRadius.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  statsContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  statsTitle: { color: colors.text, marginBottom: spacing.md, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statItem: { width: '48%', alignItems: 'center', marginBottom: spacing.md },
  statCard: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
  statIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  statIconBoxPrimary: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  statIconBoxSuccess: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.success + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  statIconBoxWarning: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.warning + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  statIconBoxInfo: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.info + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  statLabel: { fontSize: typography.fontSize.sm, color: colors.textSecondary, flex: 1 },
  statValue: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.text },
  combinedCardRow: { flexDirection: 'row', alignItems: 'stretch' },
  combinedCardColumn: { flexDirection: 'column' },
  combinedCardLeft: { flex: 1, flexBasis: 0, minWidth: 0 },
  combinedCardRight: { flex: 1, flexBasis: 0, minWidth: 0 },
  combinedCardFull: { width: '100%' },
  combinedDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border },
  combinedSectionContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  combinedSectionContentDesktop: { flex: 1, minWidth: 0 },
  combinedSectionContentStacked: { borderTopWidth: 1, borderTopColor: colors.border },
  combinedSectionTitle: { color: colors.text, marginBottom: spacing.md, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold },
  detailsCardContent: { padding: spacing.md },
  detailsTableContainer: { width: '100%' },
  tableScrollArea: { width: '100%' },
  tableScrollAreaContent: { flexGrow: 1 },
  detailsTableHeader: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 2, borderBottomColor: colors.primary, backgroundColor: colors.primary + '10' },
  detailsTableHeaderText: { flex: 1, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, textAlign: 'left', color: colors.primary },
  detailsTable: { marginTop: spacing.sm },
  tableRowEven: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center', backgroundColor: colors.background },
  tableRowOdd: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center', backgroundColor: colors.surface },
  tableLabel: { flex: 1, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium, color: colors.textSecondary },
  tableValue: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  tableValueText: { fontSize: typography.fontSize.xs, flex: 1, color: colors.text },
  tableValueTextPrimary: { fontSize: typography.fontSize.xs, flex: 1, color: colors.primary },
  tableValueTextSuccess: { fontSize: typography.fontSize.xs, flex: 1, color: colors.success },
  tableValueTextError: { fontSize: typography.fontSize.xs, flex: 1, color: colors.error },
  feeCard: { borderRadius: borderRadius.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  feeCardContent: { padding: spacing.md },
  feeCardTitle: { color: colors.text, marginBottom: spacing.md, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold },
  feeTableWrapper: { minWidth: 320 },
  feeTableScroll: { maxHeight: 300 },
  feeTableHorizontalContent: { flexGrow: 1 },
  feeTable: { minWidth: 380 },
  feeTableHeader: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 2, borderBottomColor: colors.primary, backgroundColor: colors.primary + '10', alignItems: 'center' },
  feeTableHeaderText: { flex: 1, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, textAlign: 'left' },
  feeTableRow: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  feeTableCell: { flex: 1, fontSize: typography.fontSize.xs },
  feeStatusCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  feeStatusText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, textTransform: 'capitalize' },
  feePayButton: { flex: 1, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: borderRadius.sm, alignItems: 'center', justifyContent: 'center', minWidth: 60 },
  feePayButtonText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold },
  feeReceiptButton: { flex: 1, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: borderRadius.sm, alignItems: 'center', justifyContent: 'center', minWidth: 60, borderWidth: 1 },
  feeReceiptButtonText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold },
  approvalCard: { borderRadius: borderRadius.lg, marginBottom: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  approvalCardContent: { padding: spacing.md },
  approvalLoadingContainer: { paddingVertical: spacing.xl, alignItems: 'center' },
  approvalEmptyContainer: { paddingVertical: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  approvalEmptyText: { fontSize: typography.fontSize.sm, marginTop: spacing.sm, textAlign: 'center' },
  approvalTableScroll: { maxHeight: 300 },
  approvalTableHorizontalContent: { flexGrow: 1 },
  approvalTable: { minWidth: 400 },
  approvalTableCombinedDesktop: { minWidth: 320, width: '100%' },
  approvalTableHeader: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 2, borderBottomColor: colors.primary, backgroundColor: colors.primary + '10', alignItems: 'center' },
  approvalTableHeaderText: { flex: 1, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, textAlign: 'left' },
  approvalTableRow: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  approvalTableCell: { flex: 1, fontSize: typography.fontSize.xs },
  approvalStatusCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  approvalStatusText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, textTransform: 'capitalize' },
  approvalViewText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium },
  actionsCard: { borderRadius: borderRadius.lg, marginBottom: spacing.md, marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border },
  actionsCardContent: { padding: spacing.md },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, borderWidth: 1 },
  removeButton: { marginBottom: spacing.sm },
  removeButtonOutline: { borderColor: colors.error },
  actionButtonText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, marginLeft: spacing.sm },
  actionButtonTextError: { color: colors.error },
  removeConfirmOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.md },
  removeConfirmCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: colors.error + '40' },
  removeConfirmTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.error, marginBottom: spacing.sm },
  removeConfirmMessage: { fontSize: typography.fontSize.sm, color: colors.text, marginBottom: spacing.md, lineHeight: 20 },
  removeConfirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md },
  removeConfirmBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, minWidth: 80, alignItems: 'center', justifyContent: 'center' },
  removeConfirmCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  removeConfirmCancelText: { color: colors.text, fontWeight: typography.fontWeight.semibold },
  removeConfirmDestructive: { backgroundColor: colors.error },
  removeConfirmDestructiveText: { color: '#fff', fontWeight: typography.fontWeight.bold },
});

export default ViewMember;
