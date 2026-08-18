import React from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import Button from '../common/Button';

const RecordPaymentModal = ({
  visible,
  onClose,
  colors,
  paymentAmount,
  setPaymentAmount,
  paymentMethod,
  setPaymentMethod,
  submittingPayment,
  handleRecordPayment,
}) => {
  if (!visible) return null;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
        <View style={{ width: '100%', maxWidth: 400, borderRadius: borderRadius.lg, padding: spacing.lg, backgroundColor: colors.surface, ...shadows.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
            <Text style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.text }}>Record Payment</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={{ width: '100%' }}>
            <Text style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.text, marginBottom: spacing.xs }}>Amount (KES)</Text>
            <TextInput
              style={{ borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.fontSize.base, borderColor: colors.border, color: colors.text }}
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              placeholder="Enter amount"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />
            <Text style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs }}>Payment Method</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {['mobile_money', 'bank_transfer', 'cash'].map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[
                    { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderRadius: borderRadius.md, borderWidth: 1, alignItems: 'center' },
                    { borderColor: colors.border },
                    paymentMethod === method && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
                  ]}
                  onPress={() => setPaymentMethod(method)}
                >
                  <Text style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: paymentMethod === method ? colors.primary : colors.textSecondary }}>
                    {method.replace('_', ' ').toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button
              title={submittingPayment ? 'Processing...' : 'Submit Payment'}
              onPress={handleRecordPayment}
              disabled={submittingPayment}
              style={{ backgroundColor: colors.success, marginTop: spacing.lg }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default RecordPaymentModal;
