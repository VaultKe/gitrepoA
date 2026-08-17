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
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import useDividendsScreen from '../../../hooks/useDividendsScreen';

const DividendsScreen = ({ navigation, route }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const screen = useDividendsScreen({ navigation, route });

  const {
    records,
    declarations,
    loading,
    refreshing,
    personalBalance,
    showBuyModal,
    paymentMethod,
    buyForm,
    submitting,
    setPaymentMethod,
    setShowBuyModal,
    setBuyForm,
    onRefresh,
    handleBuyDividends,
    formatCurrency,
    formatDate,
    getStatusColor,
    renderDeclarationRow,
    renderRow,
    renderEmpty,
  } = screen;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        {declarations.length > 0 && (
          <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden', marginBottom: spacing.md }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm }}>
              Dividend Declarations
            </Text>
            <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.primary + '10', borderBottomWidth: 2, borderBottomColor: colors.primary }}>
              <Text style={{ flex: 1.5, fontSize: 12, fontWeight: 'semibold', color: colors.primary }}>Declaration</Text>
              <Text style={{ flex: 1, fontSize: 12, fontWeight: 'semibold', color: colors.primary, textAlign: 'right' }}>Amount</Text>
              <Text style={{ flex: 1, fontSize: 12, fontWeight: 'semibold', color: colors.primary, textAlign: 'center' }}>Status</Text>
            </View>

            <FlatList
              data={declarations}
              renderItem={renderDeclarationRow}
              keyExtractor={(item) => item.id?.toString()}
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
              Dividend Records
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              {!loading && (
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
            data={records}
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
            ListEmptyComponent={!loading && records.length === 0 && renderEmpty()}
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
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <View style={{ borderRadius: borderRadius.lg, padding: spacing.lg, width: '90%', maxWidth: 400, backgroundColor: colors.surface }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
              <Text style={{ fontSize: typography.fontSize.lg, fontWeight: '600', color: colors.text }}>
                Buy Dividends
              </Text>
              <TouchableOpacity onPress={() => setShowBuyModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              <TouchableOpacity
                style={[
                  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1 },
                  paymentMethod === 'mpesa' && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
                  { borderColor: colors.border },
                ]}
                onPress={() => setPaymentMethod('mpesa')}
              >
                <Ionicons name="phone-portrait" size={18} color={paymentMethod === 'mpesa' ? colors.primary : colors.textSecondary} />
                <Text style={[ { fontSize: typography.fontSize.sm, fontWeight: '500' }, { color: paymentMethod === 'mpesa' ? colors.primary : colors.textSecondary }]}>
                  M-Pesa STK Push
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1 },
                  paymentMethod === 'personal' && { backgroundColor: colors.success + '20', borderColor: colors.success },
                  { borderColor: colors.border },
                ]}
                onPress={() => setPaymentMethod('personal')}
              >
                <Ionicons name="wallet" size={18} color={paymentMethod === 'personal' ? colors.success : colors.textSecondary} />
                <Text style={[ { fontSize: typography.fontSize.sm, fontWeight: '500' }, { color: paymentMethod === 'personal' ? colors.success : colors.textSecondary }]}>
                  Personal Wallet
                </Text>
              </TouchableOpacity>
            </View>

            {paymentMethod === 'mpesa' && (
              <View style={{ padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md, backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }}>
                <Ionicons name="information-circle" size={16} color={colors.primary} />
                <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  M-Pesa will use your registered phone number automatically
                </Text>
              </View>
            )}

            {paymentMethod === 'personal' && (
              <View style={{ padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md, backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }}>
                <Ionicons name="information-circle" size={16} color={colors.primary} />
                <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  Personal wallet balance: {formatCurrency(personalBalance)}
                </Text>
              </View>
            )}

            <View style={{ marginBottom: spacing.md }}>
              <Text style={{ fontSize: typography.fontSize.sm, fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>
                Amount (KES)
              </Text>
              <TextInput
                style={{ borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.fontSize.sm, backgroundColor: colors.background, borderColor: colors.border, color: colors.text }}
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

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg }}>
              <Button
                title="Cancel"
                onPress={() => setShowBuyModal(false)}
                style={{ backgroundColor: colors.textSecondary }}
              />
              <Button
                title="Purchase"
                onPress={handleBuyDividends}
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
  declarationCell: { flex: 1.5, justifyContent: 'center' },
  amountCell: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  actionsCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: typography.fontSize.sm, fontWeight: '600' },
  rowSub: { fontSize: typography.fontSize.xs, marginTop: 2 },
  rowAmount: { fontSize: typography.fontSize.sm, fontWeight: '700' },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2, borderRadius: borderRadius.sm, marginTop: spacing.xs / 2, alignItems: 'center' },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: typography.fontSize.lg, fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.xs },
  emptySubtitle: { fontSize: typography.fontSize.sm, textAlign: 'center' },
});

export default DividendsScreen;
