import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VaultKeTheme } from '../theme/theme';

const LoadingButton = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary', // 'primary', 'secondary', 'outline', 'danger'
  size = 'large', // 'small', 'medium', 'large'
  icon,
  iconPosition = 'left', // 'left', 'right'
  style,
  textStyle,
  loadingText,
  ...props
}) => {
  const isDisabled = disabled || loading;

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: VaultKeTheme.colors.surface,
          borderColor: VaultKeTheme.colors.border,
          borderWidth: 1,
          textColor: VaultKeTheme.colors.text,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: VaultKeTheme.colors.primary,
          borderWidth: 1,
          textColor: VaultKeTheme.colors.primary,
        };
      case 'danger':
        return {
          backgroundColor: VaultKeTheme.colors.error,
          borderColor: VaultKeTheme.colors.error,
          borderWidth: 1,
          textColor: '#FFFFFF',
        };
      case 'primary':
      default:
        return {
          backgroundColor: VaultKeTheme.colors.primary,
          borderColor: VaultKeTheme.colors.primary,
          borderWidth: 1,
          textColor: '#FFFFFF',
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          height: 36,
          paddingHorizontal: VaultKeTheme.spacing.md,
          fontSize: 14,
        };
      case 'medium':
        return {
          height: 44,
          paddingHorizontal: VaultKeTheme.spacing.lg,
          fontSize: 16,
        };
      case 'large':
      default:
        return {
          height: 50,
          paddingHorizontal: VaultKeTheme.spacing.xl,
          fontSize: 16,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContent}>
          <ActivityIndicator
            size="small"
            color={variantStyles.textColor}
            style={styles.loadingIndicator}
          />
          <Text style={[
            styles.buttonText,
            { color: variantStyles.textColor, fontSize: sizeStyles.fontSize },
            textStyle,
          ]}>
            {loadingText || 'Loading...'}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.content}>
        {icon && iconPosition === 'left' && (
          <Ionicons
            name={icon}
            size={sizeStyles.fontSize + 2}
            color={variantStyles.textColor}
            style={styles.iconLeft}
          />
        )}
        <Text style={[
          styles.buttonText,
          { color: variantStyles.textColor, fontSize: sizeStyles.fontSize },
          textStyle,
        ]}>
          {title}
        </Text>
        {icon && iconPosition === 'right' && (
          <Ionicons
            name={icon}
            size={sizeStyles.fontSize + 2}
            color={variantStyles.textColor}
            style={styles.iconRight}
          />
        )}
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: variantStyles.backgroundColor,
          borderColor: variantStyles.borderColor,
          borderWidth: variantStyles.borderWidth,
          height: sizeStyles.height,
          paddingHorizontal: sizeStyles.paddingHorizontal,
        },
        isDisabled && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      {...props}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: VaultKeTheme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingIndicator: {
    marginRight: VaultKeTheme.spacing.sm,
  },
  iconLeft: {
    marginRight: VaultKeTheme.spacing.sm,
  },
  iconRight: {
    marginLeft: VaultKeTheme.spacing.sm,
  },
});

export default LoadingButton;
