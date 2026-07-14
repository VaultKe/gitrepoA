import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';

/**
 * Dropdown - Inline expandable select that mirrors the contribution dropdown
 * pattern used in ContributeScreen (bordered trigger with chevron that expands
 * an inline list of options with a checkmark for the selected value).
 *
 * options: [{ value, label, icon?, color?, description? }]
 */
const Dropdown = ({
  label,
  value,
  placeholder = 'Select an option',
  options = [],
  onSelect,
  error = false,
  errorText,
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Search...',
  style,
  colors: colorsProp,
}) => {
  const { theme } = useApp();
  const colors = colorsProp || getThemeColors(theme);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find((o) => o.value === value);

  const filtered = searchable
    ? options.filter((o) => (o.label || '').toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <View style={[styles.wrapper, style]}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}

      <TouchableOpacity
        style={[
          styles.trigger,
          {
            borderColor: error ? colors.error : open ? colors.primary : colors.border,
            backgroundColor: colors.surface,
          },
        ]}
        onPress={() => !disabled && setOpen(!open)}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Text
          style={[styles.triggerText, { color: selected ? colors.text : colors.textSecondary }]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {errorText && error && (
        <Text style={[styles.errorText, { color: colors.error }]}>{errorText}</Text>
      )}

      {open && (
        <View
          style={[
            styles.dropdown,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadows.sm,
          ]}
        >
          {searchable && (
            <View style={[styles.searchBox, { borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.textSecondary}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={styles.optionsScroll}>
            {filtered.length === 0 && (
              <Text style={[styles.noResults, { color: colors.textSecondary }]}>No options found</Text>
            )}
            {filtered.map((option) => {
              const isSelected = option.value === value;
              const hasIcon = !!option.icon;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.option,
                    isSelected && { backgroundColor: colors.primary + '15' },
                    !hasIcon && { justifyContent: 'center' },
                  ]}
                  onPress={() => {
                    onSelect(option.value);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  {option.icon && (
                    <Ionicons
                      name={option.icon}
                      size={20}
                      color={option.color || (isSelected ? colors.primary : colors.textSecondary)}
                    />
                  )}
                  <View style={[styles.optionContent, !hasIcon && styles.optionContentCentered]}>
                    <Text
                      style={[styles.optionText, !hasIcon && styles.optionTextCentered, { color: isSelected ? colors.primary : colors.text }]}
                      numberOfLines={1}
                    >
                      {option.label}
                    </Text>
                    {option.description && (
                      <Text style={[styles.optionDesc, !hasIcon && styles.optionTextCentered, { color: colors.textSecondary }]} numberOfLines={1}>
                        {option.description}
                      </Text>
                    )}
                  </View>
                  {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 44,
  },
  triggerText: {
    fontSize: typography.fontSize.base,
    flex: 1,
    marginRight: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
  },
  dropdown: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    paddingVertical: 0,
    marginLeft: spacing.sm,
  },
  optionsScroll: {
    maxHeight: 220,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  optionContentCentered: {
    flex: 1,
    marginLeft: 0,
    alignItems: 'center',
  },
  optionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  optionTextCentered: {
    textAlign: 'center',
  },
  optionDesc: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  noResults: {
    fontSize: typography.fontSize.sm,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
});

export default Dropdown;
