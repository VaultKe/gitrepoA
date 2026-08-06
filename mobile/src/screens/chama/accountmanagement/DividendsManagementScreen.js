import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import OTPVerificationModal from '../../../components/common/OTPVerificationModal';
import ApiService from '../../../services/api';
import { getChamaDividendDeclarations } from '../../../services/api/settingsEndpoints';
import { sendApprovalNotification, showInAppToast } from '../../../services/disbursementNotificationService';
import { approveWelfareDisbursement } from '../../../services/api/welfareEndpoints';

const DividendsManagementScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const chamaId = currentChamaId || route?.params?.chamaId;

  const [declarations, setDeclarations] = useState([]);
  const [eligibleMembers, setEligibleMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('member');
  const [showDeclareModal, setShowDeclareModal] = useState(false);
  const [form, setForm] = useState({ dividendPerShare: '', totalAmount: '', description: '', fromAccount: '' });
  const [submitting, setSubmitting] = useState(false);

  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [selectedApprovalItem, setSelectedApprovalItem] = useState(null);
  const [approvalActionType, setApprovalActionType] = useState(null);

  const loadUserRole = async () => {
    if (!user?.id || !chamaId) return;
    try {
      const response = await ApiService.getMemberRole(chamaId, user.id);
      if (response.success) {
        setUserRole(response.data?.role || 'member');
      } else {
        setUserRole('left');
      }
    } catch (error) {
      console.error('Error loading user role:', error);
      setUserRole('left');
    }
  };

  const fetchData = useCallback(async () => {
    if (!chamaId) return;
    try {
      const [declRes, eligibleRes] = await Promise.all([
        getChamaDividendDeclarations(chamaId),
        ApiService.getEligibleDividendMembers(chamaId),
      ]);

      if (declRes.success) setDeclarations(declRes.data || []);
      if (eligibleRes.success) setEligibleMembers(eligibleRes.data || []);
    } catch (error) {
      console.error('Error fetching dividend data:', error);
    } finally {
      setLoading(false);
    }
  }, [chamaId]);

   useEffect(() => {
     fetchData();
     loadUserRole();
   }, [fetchData]);

   // Redirect if user has left the chama
   useEffect(() => {
     if (userRole === 'left') {
       Alert.alert(
         'Access Denied',
         'You are no longer a member of this chama. You cannot access dividend management features.',
         [{ text: 'OK', onPress: () => navigation.goBack() }]
       );
     }
   }, [userRole, navigation]);

  const handleDeclareDividends = async () => {
    if (!form.dividendPerShare || !form.totalAmount) {
      Alert.alert('Validation', 'Please fill dividend per share and total amount.');
      return;
    }

    if (!chamaId) {
      Alert.alert('Error', 'Missing chama ID.');
      return;
    }

    setSubmitting(true);
    try {
      const eligibleMembersPayload = (eligibleMembers || []).map(m => ({
        id: m.user_id || m.id || '',
        name: m.first_name && m.last_name ? `${m.first_name} ${m.last_name}` : (m.name || m.member_name || 'Member'),
        sharesOwned: m.shares_owned || 1,
      }));

      const payload = {
        type: 'dividend',
        category: 'bulk',
        dividendPerShare: parseFloat(form.dividendPerShare),
        totalAmount: parseFloat(form.totalAmount),
        description: form.description || 'Dividend declaration',
        eligibleMembers: eligibleMembersPayload,
        fromAccount: form.fromAccount || `wallet-${chamaId}-dividends`,
        initiatedBy: 'Admin',
        initiatedById: 'admin',
        timestamp: new Date().toISOString(),
        transactionId: `TXN_${Date.now()}`,
        securityHash: 'hash',
      };

      const response = await ApiService.declareChamaDividends(chamaId, payload);

      if (response.success) {
        Alert.alert('Success', 'Dividend declaration created successfully.');
        setShowDeclareModal(false);
        setForm({ dividendPerShare: '', totalAmount: '', description: '', fromAccount: '' });
        fetchData();
      } else {
        Alert.alert('Error', response.error || 'Failed to declare dividends.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to declare dividends. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const canApproveDividends = () => {
    if (userRole === 'left') return false;
    const normalizedUserRole = (userRole || '').toLowerCase();
    return ['chairperson', 'secretary', 'treasurer'].includes(normalizedUserRole);
  };

  const handleInitiateApprove = (declaration) => {
    if (userRole === 'left') {
      Alert.alert('Access Denied', 'You are no longer a member of this chama and cannot approve dividends.');
      return;
    }
    if (!canApproveDividends()) {
      Alert.alert('Access Denied', 'You do not have permission to approve dividends.');
      return;
    }
    if (declaration.status === 'approved' || declaration.status === 'disbursed') {
      Alert.alert('Info', 'This dividend declaration has already been processed.');
      return;
    }
    setSelectedApprovalItem(declaration);
    setApprovalActionType('approve');
    setShowOTPModal(true);
  };

  const handleVerifyOTP = async (code) => {
    if (!selectedApprovalItem) return;
    setOtpLoading(true);
    try {
      const approvalData = {
        action: approvalActionType,
        otpCode: code,
        approvedBy: userRole,
        approvedById: user.id,
        approvedByName: user?.fullName || user?.firstName || user?.email || 'Unknown',
        timestamp: new Date().toISOString(),
        chamaId,
        disbursementType: 'dividends',
        itemLabel: selectedApprovalItem.description || selectedApprovalItem.type || `Declaration #${selectedApprovalItem.id}`,
        amount: selectedApprovalItem.totalAmount || selectedApprovalItem.amount || 0,
      };

      const response = await approveWelfareDisbursement(chamaId, selectedApprovalItem.id, approvalData);

      if (response.success) {
        showInAppToast({
          title: 'Success',
          message: `Dividend ${approvalActionType}d successfully.`,
          type: 'success',
        });

        await sendApprovalNotification({
          chamaId,
          recipientUserId: user.id,
          recipientName: user?.fullName || user?.firstName || 'You',
          recipientPhone: user?.phone || user?.phone_number,
          recipientEmail: user?.email,
          disbursementType: 'dividends',
          disbursementId: selectedApprovalItem.id,
          entityLabel: selectedApprovalItem.description || selectedApprovalItem.type || `Declaration #${selectedApprovalItem.id}`,
          amount: selectedApprovalItem.totalAmount || selectedApprovalItem.amount || 0,
          action: approvalActionType,
          initiatedBy: userRole,
          chamaName: '',
        });

        setShowOTPModal(false);
        setSelectedApprovalItem(null);
        setApprovalActionType(null);
        fetchData();
      } else {
        Alert.alert('Error', response.error || 'Failed to process approval.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to verify OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!selectedApprovalItem) return;
    try {
      await sendApprovalNotification({
        chamaId,
        recipientUserId: user.id,
        recipientName: user?.fullName || user?.firstName || 'You',
        recipientPhone: user?.phone || user?.phone_number,
        recipientEmail: user?.email,
        disbursementType: 'dividends',
        disbursementId: selectedApprovalItem.id,
        entityLabel: selectedApprovalItem.description || selectedApprovalItem.type || `Declaration #${selectedApprovalItem.id}`,
        amount: selectedApprovalItem.totalAmount || selectedApprovalItem.amount || 0,
        action: 'otp_resend',
        initiatedBy: userRole,
        chamaName: '',
      });
      showInAppToast({
        title: 'OTP Resent',
        message: 'A new OTP has been sent to your phone.',
        type: 'info',
      });
    } catch (error) {
      showInAppToast({
        title: 'Resend Failed',
        message: 'Could not resend OTP. Please try again.',
        type: 'error',
      });
    }
  };

  const formatCurrency = (amount) => {
    const val = amount || 0;
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(val);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '-';
    }
  };

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
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Dividends Management</Text>
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
        title={approvalActionType === 'approve' ? 'Approve Dividends' : 'Verify Dividends'}
        subtitle={`Enter the OTP sent to your phone to ${approvalActionType} this dividend declaration.`}
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
  rowTitle: { fontSize: typography.fontSize.sm, fontWeight: '600' },
  rowSub: { fontSize: typography.fontSize.xs, marginTop: 2 },
  rowAmount: { fontSize: typography.fontSize.sm, fontWeight: '700' },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2, borderRadius: borderRadius.sm, marginTop: spacing.xs / 2, alignItems: 'center' },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 4,
    gap: 3,
  },
  approveButtonText: { fontSize: 10, fontWeight: '600' },
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
