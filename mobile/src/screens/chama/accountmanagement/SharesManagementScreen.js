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
import useSharesManagementScreen from '../../../hooks/useSharesManagementScreen';

const SharesManagementScreen = ({ route, navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const screen = useSharesManagementScreen({ route, navigation });

  const {
    offerings,
    loading,
    showCreateModal,
    form,
    submitting,
    setShowCreateModal,
    setForm,
    handleCreateOffering,
    formatCurrency,
    formatDate,
  } = screen;

  const renderRow = ({ item }) => (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.nameCell}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
          {item.name || 'Share Offering'}
        </Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
          Total: {item.totalShares ?? '-'} | Available: {item.availableShares ?? item.totalShares ?? '-'}
        </Text>
      </View>
      <View style={styles.sharesCell}>
        <Text style={[styles.rowAmount, { color: colors.primary }]}>
          {item.totalShares ?? '-'}
        </Text>
      </View>
      <View style={styles.priceCell}>
        <Text style={[styles.rowAmount, { color: colors.success }]}>
          KES {(item.pricePerShare ?? 0).toLocaleString()}
        </Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cube-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Share Offerings</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Create an offering to start issuing shares.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Shares Management</Text>
            <Button title="Create Offering" size="small" icon={<Ionicons name="add" size={14} color={colors.white} />} onPress={() => setShowCreateModal(true)} />
          </View>

          <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.primary + '10', borderBottomWidth: 2, borderBottomColor: colors.primary }}>
            <Text style={{ flex: 1.5, fontSize: 12, fontWeight: 'semibold', color: colors.primary }}>Offering</Text>
            <Text style={{ flex: 1, fontSize: 12, fontWeight: 'semibold', color: colors.primary, textAlign: 'center' }}>Shares</Text>
            <Text style={{ flex: 1, fontSize: 12, fontWeight: 'semibold', color: colors.primary, textAlign: 'right' }}>Price Per Share</Text>
          </View>

          <FlatList
            data={offerings}
            renderItem={renderRow}
            keyExtractor={(item) => item.id?.toString()}
            contentContainerStyle={{ paddingBottom: spacing.sm }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={!loading && offerings.length === 0 && renderEmpty()}
            scrollEnabled={true}
          />
        </Card>
      </View>

      {loading && <LoadingSpinner />}

      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Create Share Offering</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Offering Name</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={form.name} onChangeText={(t) => setForm((p) => ({ ...p, name: t }))} placeholder="e.g., Q1 2026 Shares" placeholderTextColor={colors.textSecondary} />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Total Shares</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} keyboardType="numeric" value={form.totalShares} onChangeText={(t) => setForm((p) => ({ ...p, totalShares: t }))} placeholder="1000" placeholderTextColor={colors.textSecondary} />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Price Per Share (KES)</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} keyboardType="numeric" value={form.pricePerShare} onChangeText={(t) => setForm((p) => ({ ...p, pricePerShare: t }))} placeholder="500" placeholderTextColor={colors.textSecondary} />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Open Date</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={form.openDate} onChangeText={(t) => setForm((p) => ({ ...p, openDate: t }))} placeholder="ISO date" placeholderTextColor={colors.textSecondary} />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Close Date</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={form.closeDate} onChangeText={(t) => setForm((p) => ({ ...p, closeDate: t }))} placeholder="ISO date" placeholderTextColor={colors.textSecondary} />
            </View>

            <View style={styles.modalActions}>
              <Button title="Cancel" onPress={() => setShowCreateModal(false)} style={{ backgroundColor: colors.textSecondary }} />
              <Button title="Create" onPress={handleCreateOffering} loading={submitting} disabled={submitting} style={{ backgroundColor: colors.primary }} />
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
  nameCell: { flex: 1.5, justifyContent: 'center' },
  sharesCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  priceCell: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  rowTitle: { fontSize: typography.fontSize.sm, fontWeight: '600' },
  rowSub: { fontSize: typography.fontSize.xs, marginTop: 2 },
  rowAmount: { fontSize: typography.fontSize.sm, fontWeight: '700' },
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
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
});

export default SharesManagementScreen;
