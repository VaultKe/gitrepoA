import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import { filters } from '../../utils/transactionsHelpers';

const ChamaTransactionsFilterDropdown = ({
  selectedFilter,
  onSelectFilter,
  theme,
}) => {
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);

  return (
    <View style={styles.dropdownContainer}>
      {filters.map((filter) => {
        const isSelected = selectedFilter === filter.id;
        return (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.dropdownItem,
              isSelected && styles.dropdownItemSelected,
            ]}
            onPress={() => onSelectFilter(filter.id)}
          >
            <Ionicons
              name={filter.icon}
              size={16}
              color={isSelected ? colors.white : colors.textSecondary}
            />
            <Text style={[
              styles.dropdownItemText,
              isSelected && styles.dropdownItemTextSelected,
            ]}>
              {filter.name}
            </Text>
            {isSelected && (
              <Ionicons name="checkmark" size={14} color={colors.white} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  dropdownContainer: {
    minWidth: 200,
    maxWidth: 250,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
    position: 'absolute',
    top: 140,
    right: spacing.md,
    zIndex: 10000,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  dropdownItemSelected: {
    backgroundColor: colors.primary,
  },
  dropdownItemText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text,
  },
  dropdownItemTextSelected: {
    color: colors.white,
  },
});

export default ChamaTransactionsFilterDropdown;
