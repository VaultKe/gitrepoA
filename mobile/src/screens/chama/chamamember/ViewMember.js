import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useApp } from '../../../context/AppContext';
import { getThemeColors } from '../../../utils/theme';
import useViewMember from '../../../hooks/useViewMember';
import ViewMemberProfileSection from '../../../components/chama-members/ViewMemberProfileSection';
import ViewMemberStatsSection from '../../../components/chama-members/ViewMemberStatsSection';
import ViewMemberDetailsSection from '../../../components/chama-members/ViewMemberDetailsSection';
import ViewMemberServiceFeeSection from '../../../components/chama-members/ViewMemberServiceFeeSection';
import ViewMemberApprovalSection from '../../../components/chama-members/ViewMemberApprovalSection';
import ViewMemberActionsSection from '../../../components/chama-members/ViewMemberActionsSection';

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
            <Button title="Retry" onPress={() => screen.loadMemberDetails()} style={{ marginTop: 12 }} />
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
  contentContainer: { padding: 16 },
  inlineTableLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  inlineTableLoadingText: { fontSize: 14 },
  profileCard: { padding: 20, borderRadius: 12, marginBottom: 16 },
  framelessCard: { padding: 0, overflow: 'hidden' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarContainer: { marginRight: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary },
  avatarPlaceholderPrimary: { backgroundColor: colors.primary },
  avatarText: { color: colors.white, fontSize: 32, fontWeight: '600' },
  expandImageOverlay: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.info + '90' },
  framelessProfileLayout: { position: 'relative', overflow: 'hidden' },
  minimizeButton: { position: 'absolute', top: 12, right: 12, zIndex: 10, backgroundColor: 'rgba(0, 0, 0, 0.5)', borderRadius: 20, padding: 12 },
  framelessImageContainer: { width: '100%', alignItems: 'center' },
  expandedAvatar: { width: '100%', height: 350, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, backgroundColor: colors.surface },
  expandedAvatarPlaceholder: { width: '100%', height: 350, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary },
  expandedAvatarText: { fontSize: 120, fontWeight: '600' },
  framelessProfileInfo: { alignItems: 'center', padding: 20, backgroundColor: 'transparent' },
  minimizeHint: { fontSize: 14, fontStyle: 'italic', marginTop: 12 },
  minimizeHintSecondary: { color: colors.textSecondary },
  profileInfo: { flex: 1 },
  memberName: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  memberNameText: { color: colors.text },
  memberEmail: { fontSize: 14, marginBottom: 8 },
  memberEmailSecondary: { color: colors.textSecondary },
  statsCard: { borderRadius: 12, marginBottom: 16 },
  statsContent: { paddingHorizontal: 12, paddingVertical: 16 },
  statsTitle: { color: colors.text, marginBottom: 12, fontSize: 18, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statItem: { width: '48%', alignItems: 'center', marginBottom: 16 },
  statCard: { padding: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  statIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statIconBoxPrimary: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  statIconBoxSuccess: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.success + '15', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  statIconBoxWarning: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.warning + '15', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  statIconBoxInfo: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.info + '15', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  statLabel: { fontSize: 14, color: colors.textSecondary, flex: 1 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  combinedCardRow: { flexDirection: 'row', alignItems: 'stretch' },
  combinedCardColumn: { flexDirection: 'column' },
  combinedCardLeft: { flex: 1, flexBasis: 0, minWidth: 0 },
  combinedCardRight: { flex: 1, flexBasis: 0, minWidth: 0 },
  combinedCardFull: { width: '100%' },
  combinedDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border },
  combinedSectionContent: { paddingHorizontal: 12, paddingVertical: 16 },
  combinedSectionContentDesktop: { flex: 1, minWidth: 0 },
  combinedSectionContentStacked: { borderTopWidth: 1, borderTopColor: colors.border },
  combinedSectionTitle: { color: colors.text, marginBottom: 12, fontSize: 16, fontWeight: '600' },
  detailsCardContent: { padding: 16 },
  detailsTableContainer: { width: '100%' },
  tableScrollArea: { width: '100%' },
  tableScrollAreaContent: { flexGrow: 1 },
  detailsTableHeader: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: colors.primary, backgroundColor: colors.primary + '10' },
  detailsTableHeaderText: { flex: 1, fontSize: 12, fontWeight: 'bold', textAlign: 'left', color: colors.primary },
  detailsTable: { marginTop: 8 },
  tableRowEven: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 0, 0, 0.05)', alignItems: 'center', backgroundColor: colors.background },
  tableRowOdd: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 0, 0, 0.05)', alignItems: 'center', backgroundColor: colors.surface },
  tableLabel: { flex: 1, fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  tableValue: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  tableValueText: { fontSize: 12, flex: 1, color: colors.text },
  tableValueTextPrimary: { fontSize: 12, flex: 1, color: colors.primary },
  tableValueTextSuccess: { fontSize: 12, flex: 1, color: colors.success },
  tableValueTextError: { fontSize: 12, flex: 1, color: colors.error },
  feeCard: { borderRadius: 12, marginBottom: 16 },
  feeCardContent: { padding: 16 },
  feeCardTitle: { color: colors.text, marginBottom: 12, fontSize: 16, fontWeight: '600' },
  feeTableWrapper: { minWidth: 320 },
  feeTableScroll: { maxHeight: 300 },
  feeTableHorizontalContent: { flexGrow: 1 },
  feeTable: { minWidth: 380 },
  feeTableHeader: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: colors.primary, backgroundColor: colors.primary + '10', alignItems: 'center' },
  feeTableHeaderText: { flex: 1, fontSize: 12, fontWeight: 'bold', textAlign: 'left' },
  feeTableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 0, 0, 0.05)', alignItems: 'center' },
  feeTableCell: { flex: 1, fontSize: 12 },
  feeStatusCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  feeStatusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  feePayButton: { flex: 1, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center', minWidth: 60 },
  feePayButtonText: { fontSize: 12, fontWeight: '600' },
  feeReceiptButton: { flex: 1, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center', minWidth: 60, borderWidth: 1 },
  feeReceiptButtonText: { fontSize: 12, fontWeight: '600' },
  approvalCard: { borderRadius: 12, marginBottom: 16, marginTop: 16 },
  approvalCardContent: { padding: 16 },
  approvalLoadingContainer: { paddingVertical: 32, alignItems: 'center' },
  approvalEmptyContainer: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  approvalEmptyText: { fontSize: 14, marginTop: 12, textAlign: 'center' },
  approvalTableScroll: { maxHeight: 300 },
  approvalTableHorizontalContent: { flexGrow: 1 },
  approvalTable: { minWidth: 400 },
  approvalTableCombinedDesktop: { minWidth: 320, width: '100%' },
  approvalTableHeader: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: colors.primary, backgroundColor: colors.primary + '10', alignItems: 'center' },
  approvalTableHeaderText: { flex: 1, fontSize: 12, fontWeight: 'bold', textAlign: 'left' },
  approvalTableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 0, 0, 0.05)', alignItems: 'center' },
  approvalTableCell: { flex: 1, fontSize: 12 },
  approvalStatusCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  approvalStatusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  approvalViewText: { fontSize: 12, fontWeight: '500' },
  actionsCard: { borderRadius: 12, marginBottom: 16, marginTop: 32 },
  actionsCardContent: { padding: 20 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  removeButton: { marginBottom: 8 },
  removeButtonOutline: { borderColor: colors.error },
  actionButtonText: { fontSize: 14, fontWeight: '600', marginLeft: 8 },
  actionButtonTextError: { color: colors.error },
  removeConfirmOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  removeConfirmCard: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: colors.error + '40' },
  removeConfirmTitle: { fontSize: 18, fontWeight: '700', color: colors.error, marginBottom: 8 },
  removeConfirmMessage: { fontSize: 14, color: colors.text, marginBottom: 20, lineHeight: 20 },
  removeConfirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  removeConfirmBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, minWidth: 80, alignItems: 'center', justifyContent: 'center' },
  removeConfirmCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  removeConfirmCancelText: { color: colors.text, fontWeight: '600' },
  removeConfirmDestructive: { backgroundColor: colors.error },
  removeConfirmDestructiveText: { color: '#fff', fontWeight: '700' },
});

export default ViewMember;
