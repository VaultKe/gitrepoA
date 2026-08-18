import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DurationOption = ({ duration, selectedDuration, onSelect, colors }) => {
  const isSelected = selectedDuration === duration.value;

  return (
    <TouchableOpacity
      style={[
        styles.durationOption,
        {
          backgroundColor: isSelected ? colors.primary + '20' : colors.background,
          borderColor: isSelected ? colors.primary : colors.border,
        }
      ]}
      onPress={() => onSelect(duration.value)}
    >
      <Text style={[
        styles.durationText,
        { color: isSelected ? colors.primary : colors.text }
      ]}>
        {duration.label}
      </Text>
      {isSelected && (
        <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
      )}
    </TouchableOpacity>
  );
};

const styles = {
  durationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    minWidth: '45%',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '500',
  },
};

export default DurationOption;
