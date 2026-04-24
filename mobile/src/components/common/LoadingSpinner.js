import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing } from '../../utils/theme';

const LoadingSpinner = ({ 
  size = 'large', 
  text = 'Loading...', 
  showText = true,
  style,
  color 
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator 
        size={size} 
        color={color || colors.primary} 
      />
      {showText && (
        <Text style={[styles.text, { color: colors.text }]}>
          {text}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  text: {
    marginTop: spacing.md,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default LoadingSpinner;
