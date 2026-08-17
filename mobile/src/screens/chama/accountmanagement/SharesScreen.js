import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import { useSharesScreen } from '../../../hooks/useSharesScreen';

const SharesScreen = ({ navigation, route }) => {
  const {
    shares,
    offerings,
    loading,
    refreshing,
    personalBalance,
    showBuyModal,
    setShowBuyModal,
    paymentMethod,
    setPaymentMethod,
    buyForm,
    setBuyForm,
    chamaId,
    onRefresh,
    handleBuyShares,
    formatCurrency,
    formatDate,
    formatSharePrice,
    getStatusColor,
    renderOfferingRow,
    renderRow,
    renderEmpty,
    isEmpty,
    colors,
  } = useSharesScreen(route, styles);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        {offerings.length > 0 && (
          <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden', marginBottom: spacing.md }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm }}>
              Available Shares
            </Text>
            <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.primary + '10', borderBottomWidth: 2, borderBottomColor: colors.primary }}>
              <Text style={{ flex: 1.5, fontSize: 12, fontWeight: 'semibold', color: colors.primary }}>Offering</Text>
              <Text style={{ flex: 1, fontSize: 12, fontWeight: 'semibold', color: colors.primary, textAlign: 'center' }}>Shares</Text>
              <Text style={{ flex: 1, fontSize: 12, fontWeight: 'semibold', color: colors.primary, textAlign: 'right' }}>Price Per Share</Text>
            </View>

            <FlatList
              data={offerings}
              renderItem={renderOfferingRow}
              keyExtractor={(item) => item.id?.toString() || item.name}
              contentContainerStyle={{ paddingBottom: spacing.sm }}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
              ListEmptyComponent={null}
            />
          </Card>
        )}

        <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
          <View style={styles.headerRow}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
              Your Records
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              {personalBalance > 0 && (
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  Wallet: {formatCurrency(personalBalance)}
                </Text>
              )}
            </View>
          </View>

          <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.primary + '10', borderBottomWidth: 2, borderBottomColor: colors.primary }}>
            <Text style={{ flex: 1.5, fontSize: 12, fontWeight: 'semibold', color: colors.primary }}>Description</Text>
            <Text style={{ flex: 1, fontSize: 12, fontWeight: 'semibold', color: colors.primary, textAlign: 'center' }}>Date</Text>
            <Text style={{ flex: 1, fontSize: 12, fontWeight: 'semibold', color: colors.primary, textAlign: 'right' }}>Amount</Text>
          </View>

          <FlatList
            data={shares}
            renderItem={renderRow}
            keyExtractor={(item) => item.id?.toString()}
            contentContainerStyle={{ paddingBottom: spacing.sm }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={isEmpty && renderEmpty()}
            scrollEnabled={true}
          />
        </Card>
      </View>

      {loading && !refreshing && <LoadingSpinner />}

        <PageRefreshButton onRefresh={onRefresh} refreshing={refreshing} color={colors.primary} bottom={64} />
      </View>

      <Modal
        visible={showBuyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBuyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Buy Shares
              </Text>
              <TouchableOpacity onPress={() => setShowBuyModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.paymentToggle}>
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'mpesa' && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
                  { borderColor: colors.border },
                ]}
                onPress={() => setPaymentMethod('mpesa')}
              >
                <Ionicons name="phone-portrait" size={18} color={paymentMethod === 'mpesa' ? colors.primary : colors.textSecondary} />
                <Text style={[styles.paymentLabel, { color: paymentMethod === 'mpesa' ? colors.primary : colors.textSecondary }]}>
                  M-Pesa STK Push
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'personal' && { backgroundColor: colors.success + '20', borderColor: colors.success },
                  { borderColor: colors.border },
                ]}
                onPress={() => setPaymentMethod('personal')}
              >
                <Ionicons name="wallet" size={18} color={paymentMethod === 'personal' ? colors.success : colors.textSecondary} />
                <Text style={[styles.paymentLabel, { color: paymentMethod === 'personal' ? colors.success : colors.textSecondary }]}>
                  Personal Wallet
                </Text>
              </TouchableOpacity>
            </View>

            {paymentMethod === 'mpesa' && (
              <View style={[styles.hintBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                <Ionicons name="information-circle" size={16} color={colors.primary} />
                <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                  M-Pesa will use your registered phone number automatically
                </Text>
              </View>
            )}

            {paymentMethod === 'personal' && (
              <View style={[styles.hintBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                <Ionicons name="information-circle" size={16} color={colors.primary} />
                <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                  Personal wallet balance: {formatCurrency(personalBalance)}
                </Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Amount (KES)</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
                ]}
                keyboardType="numeric"
                value={buyForm.amount}
                onChangeText={(text) => setBuyForm((prev) => ({ ...prev, amount: text }))}
                placeholder="Enter amount"
                placeholderTextColor={colors.textSecondary}
              />
              {paymentMethod === 'personal' && buyForm.amount && parseFloat(buyForm.amount) > personalBalance && (
                <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>
                  Insufficient balance in personal wallet
                </Text>
              )}
            </View>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowBuyModal(false)}
                style={{ backgroundColor: colors.textSecondary }}
              />
              <Button
                title="Purchase"
                onPress={handleBuyShares}
                loading={submitting}
                disabled={submitting}
                style={{ backgroundColor: colors.primary }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1 },
  descriptionCell: { flex: 1.5, justifyContent: 'center' },
  dateCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  amountCell: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  rowTitle: { fontSize: typography.fontSize.sm, fontWeight: '600' },
  rowSub: { fontSize: typography.fontSize.xs, marginTop: 2 },
  rowAmount: { fontSize: typography.fontSize.sm, fontWeight: '700' },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2, borderRadius: borderRadius.sm, marginTop: spacing.xs / 2, alignItems: 'center' },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: typography.fontSize.lg, fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.xs },
  emptySubtitle: { fontSize: typography.fontSize.sm, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalContent: { borderRadius: borderRadius.lg, padding: spacing.lg, width: '90%', maxWidth: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: typography.fontSize.lg, fontWeight: '600' },
  paymentToggle: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  paymentOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1 },
  paymentLabel: { fontSize: typography.fontSize.sm, fontWeight: '500' },
  formGroup: { marginBottom: spacing.md },
  label: { fontSize: typography.fontSize.sm, fontWeight: '500', marginBottom: spacing.xs },
  input: { borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.fontSize.sm },
  hintBox: { padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  hintText: { fontSize: typography.fontSize.sm },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
});

export default SharesScreen;
