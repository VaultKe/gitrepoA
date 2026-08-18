import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MeetingTypeOption = ({ type, selectedType, onSelect, colors }) => {
  const isSelected = selectedType === type.id;

  return (
    <TouchableOpacity
      style={[
        styles.typeOption,
        {
          backgroundColor: isSelected ? colors.primary + '20' : colors.background,
          borderColor: isSelected ? colors.primary : colors.border,
        }
      ]}
      onPress={() => onSelect(type.id)}
    >
      <View style={styles.typeHeader}>
        <Ionicons
          name={type.icon}
          size={24}
          color={isSelected ? colors.primary : colors.textSecondary}
        />
        <Text style={[
          styles.typeName,
          { color: isSelected ? colors.primary : colors.text }
        ]}>
          {type.name}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
        )}
      </View>
      <Text style={[
        styles.typeDescription,
        { color: isSelected ? colors.primary : colors.textSecondary }
      ]}>
        {type.description}
      </Text>
    </TouchableOpacity>
  );
};

const styles = {
  typeOption: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  typeName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  typeDescription: {
    fontSize: 14,
    marginLeft: 36,
  },
};

export default MeetingTypeOption;
