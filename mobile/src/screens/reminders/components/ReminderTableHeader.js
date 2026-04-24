import React from 'react';
import { View, Text } from 'react-native';
import { useApp } from '../../../context/AppContext';
import { getThemeColors } from '../../../utils/theme';

const ReminderTableHeader = ({ isDesktop }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  if (!isDesktop) return null; // Only show on desktop

  return (
    <View style={{
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    }}>
      <Text style={{
        flex: 3,
        fontSize: 8,
        fontWeight: '600',
        color: colors.textSecondary,
      }}>Title & Description</Text>
      <Text style={{
        flex: 1,
        fontSize: 8,
        fontWeight: '600',
        color: colors.textSecondary,
        textAlign: 'center',
      }}>Type</Text>
      <Text style={{
        flex: 2,
        fontSize: 8,
        fontWeight: '600',
        color: colors.textSecondary,
        textAlign: 'center',
      }}>Date & Time</Text>
      <Text style={{
        flex: 1,
        fontSize: 8,
        fontWeight: '600',
        color: colors.textSecondary,
        textAlign: 'center',
      }}>Status</Text>
      <Text style={{
        flex: 1.5,
        fontSize: 8,
        fontWeight: '600',
        color: colors.textSecondary,
        textAlign: 'center',
      }}>Actions</Text>
    </View>
  );
};

export default ReminderTableHeader;