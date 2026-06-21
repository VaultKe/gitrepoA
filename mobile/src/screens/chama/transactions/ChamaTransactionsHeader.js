import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../../components/common/Card';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import { filters } from './chamaTransactionsUtils';

const ChamaTransactionsHeader = ({
  viewMode,
  setViewMode,
  selectedFilter,
  isDropdownOpen,
  canViewGroupRecords,
  onToggleFilter,
  theme,
}) => {
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);
  const selected = filters.find(filter => filter.id === selectedFilter);

  return (
    <Card variant="outlined" padding="none" style={styles.headerCard}>
      <View style={styles.headerContent}>
        <View style={styles.viewModeContainer}>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'personal' ? styles.viewModeButtonActive : styles.viewModeButtonInactive,
            ]}
            onPress={() => setViewMode('personal')}
          >
            <Ionicons
              name="person"
              size={16}
              color={viewMode === 'personal' ? colors.white : colors.textSecondary}
            />
            <Text style={[
              styles.viewModeText,
              viewMode === 'personal' ? styles.viewModeTextActive : styles.viewModeTextInactive,
            ]}>
              Personal
            </Text>
          </TouchableOpacity>

          {canViewGroupRecords() && (
            <TouchableOpacity
              style={[
                styles.viewModeButton,
                viewMode === 'group' ? styles.viewModeButtonActive : styles.viewModeButtonInactive,
              ]}
              onPress={() => setViewMode('group')}
            >
              <Ionicons
                name="people"
                size={16}
                color={viewMode === 'group' ? colors.white : colors.textSecondary}
              />
              <Text style={[
                styles.viewModeText,
                viewMode === 'group' ? styles.viewModeTextActive : styles.viewModeTextInactive,
              ]}>
                Group
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={onToggleFilter}
        >
          <Ionicons
            name={selected?.icon || 'list'}
            size={16}
            color={colors.primary}
          />
          <Text style={[styles.filterButtonText, styles.filterButtonTextText]}>
            {selected?.name || 'All'}
          </Text>
          <Ionicons
            name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </Card>
  );
};

const createStyles = (colors) => StyleSheet.create({
  headerCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewModeContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    borderWidth: 1,
  },
  viewModeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  viewModeButtonInactive: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  viewModeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  viewModeTextActive: {
    color: colors.white,
  },
  viewModeTextInactive: {
    color: colors.textSecondary,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
    minWidth: 160,
    justifyContent: 'space-between',
  },
  filterButtonText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  filterButtonTextText: {
    color: colors.text,
  },
});

export default ChamaTransactionsHeader;
