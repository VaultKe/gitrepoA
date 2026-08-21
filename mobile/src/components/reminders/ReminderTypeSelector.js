import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';

const ReminderTypeSelector = ({ selectedType, onTypeChange }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const types = [
    { key: 'once', label: 'One-time', icon: 'time' },
    { key: 'daily', label: 'Daily', icon: 'today' },
    { key: 'weekly', label: 'Weekly', icon: 'calendar' },
    { key: 'monthly', label: 'Monthly', icon: 'calendar-outline' },
  ];

  return (
    <View style={{
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    }}>
      {types.map((type) => (
        <TouchableOpacity
          key={type.key}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 20,
            borderWidth: 1,
            backgroundColor: selectedType === type.key ? colors.primary + '15' : colors.background,
            borderColor: selectedType === type.key ? colors.primary : colors.border,
          }}
          onPress={() => onTypeChange(type.key)}
        >
          <Ionicons
            name={type.icon}
            size={16}
            color={selectedType === type.key ? colors.primary : colors.textSecondary}
          />
          <Text style={{
            fontSize: 14,
            fontWeight: '500',
            marginLeft: 6,
            color: selectedType === type.key ? colors.primary : colors.textSecondary,
          }}>
            {type.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default ReminderTypeSelector;
