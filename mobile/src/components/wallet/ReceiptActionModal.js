import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const ReceiptActionModal = ({ visible, onClose, onDownload, onPrint, onShare, receiptLoading, colors }) => {
  if (!visible) return null;

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
      <View style={{ width: 220, borderRadius: borderRadius.xl, borderWidth: 1, backgroundColor: colors.surface, borderColor: colors.border, elevation: 20, overflow: 'hidden' }}>
        <View style={{ padding: spacing.md, borderBottomWidth: 1, alignItems: 'center', borderBottomColor: colors.border }}>
          <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Receipt Actions</Text>
        </View>

        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}
          onPress={onDownload}
          disabled={receiptLoading}
        >
          <View style={{ width: 32, height: 32, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '20' }}>
            <Text style={{ color: colors.primary, fontSize: 16 }}>⬇</Text>
          </View>
          <Text style={[{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: receiptLoading ? colors.textTertiary : colors.text, flex: 1 }]}>Download Receipt</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}
          onPress={onPrint}
          disabled={receiptLoading}
        >
          <View style={{ width: 32, height: 32, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success + '20' }}>
            <Text style={{ color: colors.success, fontSize: 16 }}>🖨</Text>
          </View>
          <Text style={[{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: receiptLoading ? colors.textTertiary : colors.text, flex: 1 }]}>Print Receipt</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md }}
          onPress={onShare}
          disabled={receiptLoading}
        >
          <View style={{ width: 32, height: 32, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent + '20' }}>
            <Text style={{ color: colors.accent, fontSize: 16 }}>⬆</Text>
          </View>
          <Text style={[{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: receiptLoading ? colors.textTertiary : colors.text, flex: 1 }]}>Share Receipt</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={onClose}
        activeOpacity={1}
      />
    </View>
  );
};

export default ReceiptActionModal;
