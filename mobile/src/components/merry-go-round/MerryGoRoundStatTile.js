import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography } from '../../utils/theme';

const MerryGoRoundStatTile = ({ icon, label, value, color, subtext, textColor, crossedOut, colors }) => {
  const themeColors = colors || getThemeColors('light');
  return (
    <View style={{ flex: 1, marginHorizontal: spacing.xs }}>
      <View style={{ padding: spacing.md, backgroundColor: themeColors.surface, borderRadius: 12, borderWidth: 1, borderColor: themeColors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
            <Ionicons name={icon} size={20} color={color} />
          </View>
          <Text style={{ fontSize: typography.fontSize.sm, color: themeColors.textSecondary, flex: 1 }}>{label}</Text>
        </View>
        <Text style={{ fontSize: typography.fontSize.lg, fontWeight: 'bold', color: textColor || themeColors.text, textDecorationLine: crossedOut ? 'line-through' : 'none' }}>{value}</Text>
        {subtext && <Text style={{ fontSize: typography.fontSize.xs, color: themeColors.textSecondary, marginTop: spacing.xs }}>{subtext}</Text>}
      </View>
    </View>
  );
};

export default MerryGoRoundStatTile;
