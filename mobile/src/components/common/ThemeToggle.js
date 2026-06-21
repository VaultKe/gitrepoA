import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';

const ThemeToggle = ({ size = 22, iconColor, style, activeOpacity = 0.7 }) => {
  const { theme, toggleTheme } = useApp();
  const colors = getThemeColors(theme);
  const isDark = theme === 'dark';

  const handlePress = () => {
    toggleTheme();
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={activeOpacity}
      accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      accessibilityRole="button"
    >
      <Ionicons
        name={isDark ? 'sunny' : 'moon'}
        size={size}
        color={iconColor || colors.primary}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 20,
  },
});

export default ThemeToggle;
