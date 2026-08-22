import React from 'react';
import { TextInput, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const AmountInput = ({ value, onChangeText, placeholder, label, colors, style }) => {
  return (
    <View>
      {label && (
        <Text style={[{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm, marginTop: spacing.md, color: colors.text }]}>
          {label}
        </Text>
      )}
      <TextInput
        style={[
          {
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            fontSize: typography.fontSize['2xl'],
            fontWeight: typography.fontWeight.bold,
            textAlign: 'center',
            backgroundColor: colors.surface,
            color: colors.text,
          },
          style,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || '0.00'}
        keyboardType="numeric"
        placeholderTextColor={colors.textTertiary}
      />
    </View>
  );
};

export default AmountInput;
