import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography } from '../../utils/theme';

const TransactionRow = ({ item, index, colors, getResponsiveTextSize, getTransactionColor, formatDate, onMenuToggle, showTransactionMenu }) => {
  return (
    <View style={[{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }]}>
      <Text style={{ flex: 2.5, fontSize: getResponsiveTextSize(14), color: colors.text }} numberOfLines={1}>{item.description}</Text>
      <Text style={{ flex: 1.4, fontSize: getResponsiveTextSize(14), color: colors.textSecondary, textAlign: 'center' }}>{formatDate(item.date)}</Text>
      <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), color: item.status === 'completed' ? colors.success : colors.warning, textAlign: 'center' }}>{item.status}</Text>
      <View style={{ flex: 1.8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.medium, color: getTransactionColor(item.type, item.amount), textAlign: 'right' }}>
          {item.amount > 0 ? '+' : ''}KES {Math.abs(item.amount).toLocaleString()}
        </Text>
        <TouchableOpacity
          style={{ padding: spacing.xs }}
          onPress={() => onMenuToggle(showTransactionMenu === item.id ? null : item.id)}
        >
          <Ionicons name="ellipsis-vertical" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default TransactionRow;
