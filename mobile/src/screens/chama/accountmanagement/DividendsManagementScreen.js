import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import OTPVerificationModal from '../../../components/common/OTPVerificationModal';
import useDividendsManagementScreen from '../../../hooks/useDividendsManagementScreen';

const DividendsManagementScreen = ({ route, navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const screen = useDividendsManagementScreen({ route, navigation });

  const {
    declarations,
    eligibleMembers,
    loading,
    showDeclareModal,
    setShowDeclareModal,
    form,
    setForm,
    submitting,
    showOTPModal,
    setShowOTPModal,
    otpLoading,
    formatCurrency,
    formatDate,
    handleDeclareDividends,
    canApproveDividends,
    handleInitiateApprove,
    handleVerifyOTP,
    handleResendOTP,
    setSelectedApprovalItem,
    setApprovalActionType,
    chamaId,
  } = screen;

  const renderRow = ({ item }) => (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.declarationCell}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{item.description || item.type || 'Dividend Declaration'}</Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
          {formatDate(item.timestamp || item.createdAt || item.created_at)}
        </Text>
      </View>
      <View style={styles.amountCell}>
        <Text style={[styles.rowAmount, { color: colors.success }]}>
          {formatCurrency(item.totalAmount || item.amount)}
        </Text>
      </View>
      <View style={styles.actionsCell}>
        <View style={[styles.statusBadge, { backgroundColor: (colors[item.status] || colors.textSecondary) + '20' }]}>
          <Text style={[styles.statusText, { color: colors[item.status] || colors.textSecondary }]}>
            {(item.status || 'pending').toUpperCase()}
          </Text>
          {canApproveDividends() && item.status !== 'disbursed' && (
            <TouchableOpacity
              style={[styles.approveButton, { backgroundColor: colors.primary }]}
              onPress={() => handleInitiateApprove(item)}
            >
              <Ionicons name="checkmark-done" size={12} color={colors.white} />
              <Text style={[styles.approveButtonText, { color: colors.white }]}>Approve</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cash-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Dividend Declarations</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Create a declaration to disburse dividends to shareholders.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.text }}>Dividends Management</Text>
            <Button title="Declare Dividends" size="small" icon={<Ionicons name="cash" size={14} color={colors.white} />} onPress={() => setShowDeclareModal(true)} />
          </View>

          <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.primary + '10', borderBottomWidth: 2, borderBottomColor: colors.primary }}>
            <Text style={{ flex: 1.5, fontSize: 12, fontWeight: 'semibold', color: colors.primary }}>Declaration</Text>
            <Text style={{ flex: 1, fontSize: 12, fontWeight: 'semibold', color: colors.primary, textAlign: 'right' }}>Amount</Text>
            <Text style={{ flex: 1, fontSize: 12, fontWeight: 'semibold', color: colors.primary, textAlign: 'center' }}>Actions</Text>
          </View>

          <FlatList
            data={declarations}
            renderItem={renderRow}
            keyExtractor={(item) => item.id?.toString()}
            contentContainerStyle={{ paddingBottom: spacing.sm }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={!loading && declarations.length === 0 && renderEmpty()}
            scrollEnabled={true}
          />
        </Card>
      </View>

      {loading && <LoadingSpinner />}

      <Modal visible={showDeclareModal} transparent animationType="slide" onRequestClose={() => setShowDeclareModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Declare Dividends</Text>
              <TouchableOpacity onPress={() => setShowDeclareModal(false)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>

            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Eligible members: {eligibleMembers.length}
            </Text>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Dividend Per Share (KES)</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} keyboardType="numeric" value={form.dividendPerShare} onChangeText={(t) => setForm((p) => ({ ...p, dividendPerShare: t }))} placeholder="100" placeholderTextColor={colors.textSecondary} />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Total Amount (KES)</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} keyboardType="numeric" value={form.totalAmount} onChangeText={(t) => setForm((p) => ({ ...p, totalAmount: t }))} placeholder="Total payout" placeholderTextColor={colors.textSecondary} />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Source Wallet</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={form.fromAccount} onChangeText={(t) => setForm((p) => ({ ...p, fromAccount: t }))} placeholder={`wallet-${chamaId}-dividends`} placeholderTextColor={colors.textSecondary} />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Description</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={form.description} onChangeText={(t) => setForm((p) => ({ ...p, description: t }))} placeholder="Q1 2026 dividends" placeholderTextColor={colors.textSecondary} />
            </View>

            <View style={styles.modalActions}>
              <Button title="Cancel" onPress={() => setShowDeclareModal(false)} style={{ backgroundColor: colors.textSecondary }} />
              <Button title="Declare" onPress={handleDeclareDividends} loading={submitting} disabled={submitting} style={{ backgroundColor: colors.primary }} />
            </View>
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
        title={screen.approvalActionType === 'approve' ? 'Approve Dividends' : 'Verify Dividends'}
        subtitle={`Enter the OTP sent to your phone to ${screen.approvalActionType} this dividend declaration.`}
        onVerify={handleVerifyOTP}
        onResend={handleResendOTP}
        loading={otpLoading}
        itemType="dividends"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1 },
  declarationCell: { flex: 1.5, justifyContent: 'center' },
  amountCell: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  actionsCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold },
  rowSub: { fontSize: typography.fontSize.xs, marginTop: 2 },
  rowAmount: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2, borderRadius: borderRadius.sm, marginTop: spacing.xs / 2, alignItems: 'center' },
  statusText: { fontSize: 10, fontWeight: typography.fontWeight.bold, textTransform: 'uppercase' },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 4,
    gap: 3,
  },
  approveButtonText: { fontSize: 10, fontWeight: typography.fontWeight.semibold },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: typography.fontSize.lg, fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.xs },
  emptySubtitle: { fontSize: typography.fontSize.sm, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalContent: { borderRadius: borderRadius.lg, padding: spacing.lg, width: '90%', maxWidth: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: typography.fontSize.lg, fontWeight: '600' },
  formGroup: { marginBottom: spacing.md },
  label: { fontSize: typography.fontSize.sm, fontWeight: '500', marginBottom: spacing.xs },
  input: { borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.fontSize.sm },
  hint: { fontSize: typography.fontSize.sm, marginBottom: spacing.md },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
});

export default DividendsManagementScreen;
