import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const PaymentMethodCard = ({ method, selected, onSelect, colors }) => {
  return (
    <TouchableOpacity
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginBottom: spacing.sm,
          borderWidth: 2,
          backgroundColor: colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
        selected && { backgroundColor: colors.primary + '20' },
      ]}
      onPress={onSelect}
    >
      <Ionicons
        name={method.icon}
        size={24}
        color={selected ? colors.primary : colors.textSecondary}
      />
      <Text style={[
        {
          flex: 1,
          fontSize: typography.fontSize.base,
          marginLeft: spacing.sm,
          color: selected ? colors.text : colors.textSecondary,
        },
        selected && { fontWeight: '600' },
      ]}>
        {method.name}
      </Text>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={selected ? colors.primary : colors.textSecondary}
      />
    </TouchableOpacity>
  );
};

export default PaymentMethodCard;
