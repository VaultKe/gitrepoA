import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../../context/AppContext';
import { getThemeColors, spacing } from '../../../../utils/theme';

const ReminderTableHeader = ({
  isDesktop,
  searchValue,
  onSearchChange,
  filterValue,
  onFilterChange,
  onCreate,
  filterOptions = ['all', 'once', 'daily', 'weekly', 'monthly'],
  showSearchFilter = true,
  showTableHeader = true,
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  if (!isDesktop) return null; // Only show on desktop

  const getFilterLabel = (value) => {
    switch (value) {
      case 'all': return 'All Types';
      case 'once': return 'One-time';
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      default: return value;
    }
  };

  return (
    <View>
    {showSearchFilter && (
      <>
        {/* Search and Filter Row */}
        <View style={{
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: 12,
      }}>
        {/* Search Input */}
        <View style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 8,
          paddingVertical: 6,
        }}>
          <Ionicons name="search" size={14} color={colors.textSecondary} />
          <TextInput
            style={{
              flex: 1,
              marginLeft: 6,
              fontSize: 12,
              color: colors.text,
            }}
            placeholder="Search ..."
            placeholderTextColor={colors.textSecondary}
            value={searchValue}
            onChangeText={onSearchChange}
          />
        </View>

        {/* Filter Dropdown */}
        <View style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 8,
          paddingVertical: 6,
        }}>
          <Ionicons name="filter" size={14} color={colors.textSecondary} />
          <TouchableOpacity
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginLeft: 6,
            }}
            onPress={() => {
              const currentIndex = filterOptions.indexOf(filterValue);
              const nextIndex = (currentIndex + 1) % filterOptions.length;
              onFilterChange(filterOptions[nextIndex]);
            }}
          >
            <Text style={{
              fontSize: 12,
              color: colors.text,
            }}>
              {getFilterLabel(filterValue)}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Create Button */}
        {onCreate && (
          <TouchableOpacity
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 8,
            }}
            onPress={onCreate}
          >
            <Ionicons name="add" size={20} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>
      </>
    )}

    {showTableHeader && (
      <View style={{
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginTop: spacing.sm,
      }}>
        <Text style={{
          flex: 3,
          fontSize: 14,
          fontWeight: '600',
          color: colors.textSecondary,
        }}>Title & Description</Text>
        <Text style={{
          flex: 1,
          fontSize: 14,
          fontWeight: '600',
          color: colors.textSecondary,
          textAlign: 'center',
        }}>Type</Text>
        <Text style={{
          flex: 2,
          fontSize: 14,
          fontWeight: '600',
          color: colors.textSecondary,
          textAlign: 'center',
        }}>Date & Time</Text>
        <Text style={{
          flex: 1,
          fontSize: 14,
          fontWeight: '600',
          color: colors.textSecondary,
          textAlign: 'center',
        }}>Status</Text>
        <Text style={{
          flex: 1.5,
          fontSize: 14,
          fontWeight: '600',
          color: colors.textSecondary,
          textAlign: 'center',
        }}>Actions</Text>
      </View>
    )}
    </View>
  );
};

export default ReminderTableHeader;