import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';
import useSmartNavigation from '../../hooks/useSmartNavigation';

/**
 * Smart Back Button Component
 * Automatically handles back navigation using navigation history
 * Works seamlessly across different dashboard contexts
 */
const SmartBackButton = ({ 
  style, 
  iconSize = 24, 
  iconColor, 
  onPress,
  disabled = false 
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const { goBack, getNavigationState } = useSmartNavigation();

  const handlePress = () => {
    if (disabled) return;
    
    if (onPress) {
      // Allow custom onPress to override default behavior
      onPress();
    } else {
      // Use smart back navigation with detailed logging
      const navState = getNavigationState();
      goBack();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.backButton, style]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Ionicons
        name="arrow-back"
        size={iconSize}
        color={iconColor || colors.text}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    minHeight: 40,
  },
});

export default SmartBackButton;
