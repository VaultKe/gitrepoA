import React from 'react';
import { Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import { filters } from '../../utils/transactionsHelpers';

const ChamaTransactionsFilterChips = ({
  selectedFilter,
  onSelectFilter,
  theme,
}) => {
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);

  return (
    <FlatList
      horizontal
      data={filters}
      renderItem={({ item }) => {
        const isSelected = selectedFilter === item.id;
        return (
          <TouchableOpacity
            style={[
              styles.filterChip,
              isSelected ? styles.filterChipActive : styles.filterChipInactive,
            ]}
            onPress={() => onSelectFilter(item.id)}
          >
            <Ionicons
              name={item.icon}
              size={16}
              color={isSelected ? colors.white : colors.textSecondary}
            />
            <Text style={[
              styles.filterText,
              isSelected ? styles.filterTextActive : styles.filterTextInactive,
            ]}>
              {item.name}
            </Text>
          </TouchableOpacity>
        );
      }}
      keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filtersContent}
    />
  );
};

const createStyles = (colors) => StyleSheet.create({
  filtersContent: {
    paddingHorizontal: spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    marginRight: spacing.sm,
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipInactive: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
  },
  filterText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  filterTextActive: {
    color: colors.white,
  },
  filterTextInactive: {
    color: colors.textSecondary,
  },
});

export default ChamaTransactionsFilterChips;
