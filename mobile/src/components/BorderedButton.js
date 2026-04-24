import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors } from '../utils/theme';

const { width: screenWidth } = Dimensions.get('window');

/**
 * Unified BorderedButton Component
 * Provides consistent, responsive, bordered buttons across all screens
 */
export default function BorderedButton({
  title,
  onPress,
  variant = 'primary', // primary, secondary, success, warning, danger, info
  size = 'medium', // small, medium, large, full
  icon,
  iconPosition = 'left', // left, right, only
  loading = false,
  disabled = false,
  style,
  textStyle,
  theme = 'light',
  ...props
}) {
  const colors = getThemeColors(theme);

  // Get variant colors
  const getVariantColors = () => {
    switch (variant) {
      case 'primary':
        return {
          borderColor: colors.primary,
          textColor: colors.primary,
          backgroundColor: 'transparent',
          disabledBorderColor: colors.border,
          disabledTextColor: colors.textSecondary,
        };
      case 'secondary':
        return {
          borderColor: colors.textSecondary,
          textColor: colors.textSecondary,
          backgroundColor: 'transparent',
          disabledBorderColor: colors.border,
          disabledTextColor: colors.textSecondary,
        };
      case 'success':
        return {
          borderColor: colors.success,
          textColor: colors.success,
          backgroundColor: 'transparent',
          disabledBorderColor: colors.border,
          disabledTextColor: colors.textSecondary,
        };
      case 'warning':
        return {
          borderColor: colors.warning,
          textColor: colors.warning,
          backgroundColor: 'transparent',
          disabledBorderColor: colors.border,
          disabledTextColor: colors.textSecondary,
        };
      case 'danger':
        return {
          borderColor: colors.error,
          textColor: colors.error,
          backgroundColor: 'transparent',
          disabledBorderColor: colors.border,
          disabledTextColor: colors.textSecondary,
        };
      case 'info':
        return {
          borderColor: colors.info,
          textColor: colors.info,
          backgroundColor: 'transparent',
          disabledBorderColor: colors.border,
          disabledTextColor: colors.textSecondary,
        };
      default:
        return {
          borderColor: colors.primary,
          textColor: colors.primary,
          backgroundColor: 'transparent',
          disabledBorderColor: colors.border,
          disabledTextColor: colors.textSecondary,
        };
    }
  };

  // Get size dimensions - RESPONSIVE
  const getSizeDimensions = () => {
    const baseWidth = screenWidth - 32; // Account for margins
    const isSmallScreen = screenWidth < 350;
    const isMediumScreen = screenWidth < 400;

    switch (size) {
      case 'small':
        return {
          height: isSmallScreen ? 32 : 36,
          paddingHorizontal: isSmallScreen ? 8 : 12,
          fontSize: isSmallScreen ? 11 : 12,
          iconSize: isSmallScreen ? 14 : 16,
          minWidth: Math.min(80, baseWidth * 0.2),
          maxWidth: Math.min(120, baseWidth * 0.3),
        };
      case 'medium':
        return {
          height: isSmallScreen ? 36 : isMediumScreen ? 40 : 44,
          paddingHorizontal: isSmallScreen ? 12 : 16,
          fontSize: isSmallScreen ? 12 : isMediumScreen ? 13 : 14,
          iconSize: isSmallScreen ? 16 : 18,
          minWidth: Math.min(100, baseWidth * 0.25),
          maxWidth: Math.min(160, baseWidth * 0.4),
        };
      case 'large':
        return {
          height: isSmallScreen ? 40 : isMediumScreen ? 44 : 48,
          paddingHorizontal: isSmallScreen ? 16 : 20,
          fontSize: isSmallScreen ? 13 : isMediumScreen ? 14 : 15,
          iconSize: isSmallScreen ? 18 : 20,
          minWidth: Math.min(120, baseWidth * 0.3),
          maxWidth: Math.min(200, baseWidth * 0.5),
        };
      case 'full':
        return {
          height: isSmallScreen ? 40 : isMediumScreen ? 44 : 48,
          paddingHorizontal: isSmallScreen ? 16 : 20,
          fontSize: isSmallScreen ? 13 : isMediumScreen ? 14 : 15,
          iconSize: isSmallScreen ? 16 : 18,
          width: baseWidth,
        };
      case 'auto':
        return {
          height: isSmallScreen ? 32 : 36,
          paddingHorizontal: isSmallScreen ? 8 : 12,
          fontSize: isSmallScreen ? 11 : 12,
          iconSize: isSmallScreen ? 14 : 16,
          // No width constraints - let content determine size
        };
      default:
        return {
          height: isSmallScreen ? 36 : isMediumScreen ? 40 : 44,
          paddingHorizontal: isSmallScreen ? 12 : 16,
          fontSize: isSmallScreen ? 12 : isMediumScreen ? 13 : 14,
          iconSize: isSmallScreen ? 16 : 18,
          minWidth: Math.min(100, baseWidth * 0.25),
          maxWidth: Math.min(160, baseWidth * 0.4),
        };
    }
  };

  const variantColors = getVariantColors();
  const sizeDimensions = getSizeDimensions();
  const isDisabled = disabled || loading;

  const buttonStyle = [
    styles.button,
    {
      height: sizeDimensions.height,
      paddingHorizontal: sizeDimensions.paddingHorizontal,
      minWidth: sizeDimensions.minWidth,
      maxWidth: sizeDimensions.maxWidth,
      width: sizeDimensions.width,
      borderColor: isDisabled ? variantColors.disabledBorderColor : variantColors.borderColor,
      backgroundColor: variantColors.backgroundColor,
    },
    style,
  ];

  const textStyleCombined = [
    styles.text,
    {
      fontSize: sizeDimensions.fontSize,
      color: isDisabled ? variantColors.disabledTextColor : variantColors.textColor,
    },
    textStyle,
  ];

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator 
            size="small" 
            color={isDisabled ? variantColors.disabledTextColor : variantColors.textColor} 
          />
          {title && (
            <Text style={[textStyleCombined, styles.loadingText]}>
              {title}
            </Text>
          )}
        </View>
      );
    }

    if (iconPosition === 'only' && icon) {
      return (
        <Ionicons 
          name={icon} 
          size={sizeDimensions.iconSize} 
          color={isDisabled ? variantColors.disabledTextColor : variantColors.textColor} 
        />
      );
    }

    return (
      <View style={styles.contentContainer}>
        {icon && iconPosition === 'left' && (
          <Ionicons 
            name={icon} 
            size={sizeDimensions.iconSize} 
            color={isDisabled ? variantColors.disabledTextColor : variantColors.textColor}
            style={styles.iconLeft}
          />
        )}
        {title && (
          <Text style={textStyleCombined} numberOfLines={1}>
            {title}
          </Text>
        )}
        {icon && iconPosition === 'right' && (
          <Ionicons 
            name={icon} 
            size={sizeDimensions.iconSize} 
            color={isDisabled ? variantColors.disabledTextColor : variantColors.textColor}
            style={styles.iconRight}
          />
        )}
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      {...props}
    >
      {renderContent()}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1.5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 8,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
