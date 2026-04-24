import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, borderRadius, shadows } from '../../utils/theme';

const Card = ({
  children,
  onPress,
  style,
  variant = 'default', // 'default', 'elevated', 'outlined', 'flat'
  padding = 'md', // 'none', 'sm', 'md', 'lg', 'xl'
  margin = 'sm', // 'none', 'sm', 'md', 'lg', 'xl'
  borderRadius: cardBorderRadius = 'lg',
  disabled = false,
  ...props
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const getCardStyle = () => {
    const baseStyle = {
      borderRadius: borderRadius[cardBorderRadius] || borderRadius.lg,
    };

    // Padding styles
    const paddingStyles = {
      none: {},
      sm: { padding: spacing.sm },
      md: { padding: spacing.md },
      lg: { padding: spacing.lg },
      xl: { padding: spacing.xl },
    };

    // Margin styles
    const marginStyles = {
      none: {},
      sm: { margin: spacing.sm },
      md: { margin: spacing.md },
      lg: { margin: spacing.lg },
      xl: { margin: spacing.xl },
    };

    // Variant styles
    const variantStyles = {
      default: {
        backgroundColor: colors.surface,
        ...shadows.md,
      },
      elevated: {
        backgroundColor: colors.surface,
        ...shadows.lg,
      },
      outlined: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      },
      flat: {
        backgroundColor: colors.surface,
      },
    };

    // Disabled style
    const disabledStyle = disabled ? {
      opacity: 0.6,
    } : {};

    return [
      baseStyle,
      paddingStyles[padding],
      marginStyles[margin],
      variantStyles[variant],
      disabledStyle,
    ];
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={[getCardStyle(), style]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[getCardStyle(), style]} {...props}>
      {children}
    </View>
  );
};

export default Card;
