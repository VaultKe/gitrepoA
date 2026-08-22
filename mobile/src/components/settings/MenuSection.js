import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography } from '../../utils/theme';

const MenuSection = ({ title, items, colors }) => {
  return (
    <Card variant="outlined" style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {title}
      </Text>

      {items.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.menuItem,
            { borderBottomColor: colors.border },
            index === items.length - 1 && styles.lastMenuItem
          ]}
          onPress={item.onPress}
          activeOpacity={0.7}
          delayPressIn={0}
        >
          <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
            <Ionicons name={item.icon} size={20} color={item.color} />
          </View>

          <View style={styles.menuContent}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>
              {item.title}
            </Text>
            {item.subtitle && (
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
                {item.subtitle}
              </Text>
            )}
          </View>

          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      ))}
    </Card>
  );
};

const styles = StyleSheet.create({
  section: {
    margin: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    minHeight: 64,
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  menuSubtitle: {
    fontSize: typography.fontSize.sm,
  },
});

export default MenuSection;
