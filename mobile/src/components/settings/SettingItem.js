import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography } from '../../utils/theme';

const SettingItem = ({ title, description, value, onValueChange, type = 'switch', colors }) => {
  return (
    <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingTitle, { color: colors.text }]}>
          {title}
        </Text>
        {description && (
          <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
            {description}
          </Text>
        )}
      </View>

      {type === 'switch' ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
        />
      ) : (
        <TouchableOpacity onPress={onValueChange}>
          <View style={styles.settingValue}>
            <Text style={[styles.settingValueText, { color: colors.textSecondary }]}>
              {value}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    minHeight: 60,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  settingDescription: {
    fontSize: typography.fontSize.sm,
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValueText: {
    fontSize: typography.fontSize.base,
    marginRight: spacing.sm,
  },
});

export default SettingItem;
