import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';

const Button = ({
  title,
  onPress,
  variant = 'primary', // 'primary', 'secondary', 'outline', 'ghost', 'danger'
  size = 'medium', // 'small', 'medium', 'large'
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left', // 'left', 'right'
  fullWidth = false,
  style,
  textStyle,
  ...props
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const getButtonStyle = () => {
    const baseStyle = {
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: iconPosition === 'right' ? 'row-reverse' : 'row',
    };

    // Size styles
    const sizeStyles = {
      small: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        minHeight: 36,
      },
      medium: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 44,
      },
      large: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        minHeight: 52,
      },
    };

    // Variant styles
    const variantStyles = {
      primary: {
        backgroundColor: colors.primary,
        borderWidth: 0,
      },
      secondary: {
        backgroundColor: colors.secondary,
        borderWidth: 0,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.primary,
      },
      ghost: {
        backgroundColor: 'transparent',
        borderWidth: 0,
      },
      danger: {
        backgroundColor: colors.error,
        borderWidth: 0,
      },
    };

    // Disabled styles
    const disabledStyle = disabled || loading ? {
      opacity: 0.6,
    } : {};

    // Full width style
    const fullWidthStyle = fullWidth ? {
      width: '100%',
    } : {};

    return [
      baseStyle,
      sizeStyles[size],
      variantStyles[variant],
      disabledStyle,
      fullWidthStyle,
    ];
  };

  const getTextStyle = () => {
    const baseTextStyle = {
      fontWeight: '600',
      textAlign: 'center',
    };

    // Size text styles
    const sizeTextStyles = {
      small: {
        fontSize: 14,
      },
      medium: {
        fontSize: 16,
      },
      large: {
        fontSize: 18,
      },
    };

    // Variant text styles
    const variantTextStyles = {
      primary: {
        color: colors.white,
      },
      secondary: {
        color: colors.white,
      },
      outline: {
        color: colors.primary,
      },
      ghost: {
        color: colors.primary,
      },
      danger: {
        color: colors.white,
      },
    };

    return [
      baseTextStyle,
      sizeTextStyles[size],
      variantTextStyles[variant],
    ];
  };

  const renderIcon = () => {
    if (!icon) return null;

    // If icon is a string, convert to Ionicons component
    if (typeof icon === 'string') {
      const iconColor = variant === 'outline' || variant === 'ghost' ? colors.primary : colors.white;
      const iconSize = size === 'small' ? 16 : size === 'large' ? 20 : 18;
      return <Ionicons name={icon} size={iconSize} color={iconColor} />;
    }

    // If icon is already a component, return as is
    return icon;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="small"
            color={variant === 'outline' || variant === 'ghost' ? colors.primary : colors.white}
          />
          {title && (
            <Text style={[getTextStyle(), textStyle, { marginLeft: 8 }]}>
              {title}
            </Text>
          )}
        </View>
      );
    }

    const iconComponent = renderIcon();

    return (
      <View style={styles.contentContainer}>
        {iconComponent && iconPosition === 'left' && (
          <View style={[styles.iconContainer, { marginRight: title ? 8 : 0 }]}>
            {iconComponent}
          </View>
        )}
        {title && (
          <Text style={[getTextStyle(), textStyle]}>
            {title}
          </Text>
        )}
        {iconComponent && iconPosition === 'right' && (
          <View style={[styles.iconContainer, { marginLeft: title ? 8 : 0 }]}>
            {iconComponent}
          </View>
        )}
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Button;
