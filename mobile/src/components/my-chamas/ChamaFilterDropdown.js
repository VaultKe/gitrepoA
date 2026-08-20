import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../../utils/theme';

const ChamaFilterDropdown = ({ showFilterDropdown, setShowFilterDropdown, selectedCategory, setSelectedCategory, categoryOptions, colors }) => {
  return (
    <>
      {showFilterDropdown && (
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }}
          activeOpacity={1}
          onPress={() => setShowFilterDropdown(false)}
        />
      )}

      {showFilterDropdown && (
        <View style={[{
          position: 'absolute',
          top: 80,
          right: spacing.md + 20,
          minWidth: 200,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 20,
          zIndex: 10000,
        }]}>
          {categoryOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                gap: spacing.sm,
                backgroundColor: selectedCategory === option.id ? colors.primary : 'transparent',
              }]}
              onPress={() => {
                setSelectedCategory(option.id);
                setShowFilterDropdown(false);
              }}
            >
              <Text style={[{
                flex: 1,
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.medium,
                color: selectedCategory === option.id ? colors.white : colors.text,
              }]}>
                {option.name}
              </Text>
              {selectedCategory === option.id && (
                <Ionicons name="checkmark" size={14} color={colors.white} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );
};

export default ChamaFilterDropdown;
