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
import ApiService from '../../../services/api';
import { getChamaDividendDeclarations } from '../../../services/api/settingsEndpoints';

const DividendsManagementScreen = ({ route, navigation }) => {
  const { theme } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const chamaId = currentChamaId || route?.params?.chamaId;

  const [declarations, setDeclarations] = useState([]);
  const [eligibleMembers, setEligibleMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeclareModal, setShowDeclareModal] = useState(false);
  const [form, setForm] = useState({ dividendPerShare: '', totalAmount: '', description: '', fromAccount: '' });
  const [submitting, setSubmitting] = useState(false);

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
  }, [fetchData]);

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
      <View style={styles.rowLeft}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{item.description || item.type || 'Dividend Declaration'}</Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
          {formatDate(item.timestamp || item.createdAt || item.created_at)}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowAmount, { color: colors.success }]}>
          {formatCurrency(item.totalAmount || item.amount)}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: (colors[item.status] || colors.textSecondary) + '20' }]}>
          <Text style={[styles.statusText, { color: colors[item.status] || colors.textSecondary }]}>
            {(item.status || 'pending').toUpperCase()}
          </Text>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1 },
  rowLeft: { flex: 1 },
  rowTitle: { fontSize: typography.fontSize.sm, fontWeight: '600' },
  rowSub: { fontSize: typography.fontSize.xs, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowAmount: { fontSize: typography.fontSize.sm, fontWeight: '700' },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2, borderRadius: borderRadius.sm, marginTop: spacing.xs / 2 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
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
