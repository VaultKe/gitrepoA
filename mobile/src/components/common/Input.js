import React, { useState, forwardRef } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const Input = forwardRef(({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  success,
  helperText,
  leftIcon,
  rightIcon,
  rightIconColor,
  loading = false,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoCorrect = false,
  editable = true,
  multiline = false,
  numberOfLines = 1,
  maxLength,
  style,
  inputStyle,
  containerStyle,
  labelStyle,
  errorStyle,
  helperStyle,
  onFocus,
  onBlur,
  ...props
}, ref) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);

  const handleFocus = (e) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const getContainerStyle = () => {
    return [
      styles.container,
      containerStyle,
    ];
  };

  const getLabelStyle = () => {
    return [
      styles.label,
      {
        color: error ? colors.error : colors.textSecondary,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
      },
      labelStyle,
    ];
  };

  const getInputContainerStyle = () => {
    const baseStyle = {
      backgroundColor: colors.surface,
      borderColor: colors.border, // Always use neutral border color
      borderWidth: 1, // Always use consistent border width
    };

    return [
      styles.inputContainer,
      baseStyle,
      !editable && { opacity: 0.6 },
    ];
  };

  const getInputStyle = () => {
    return [
      styles.input,
      {
        color: colors.text,
        fontSize: typography.fontSize.base,
      },
      multiline && {
        height: numberOfLines * 20 + 24,
        textAlignVertical: 'top',
      },
      inputStyle,
    ];
  };

  const getErrorStyle = () => {
    return [
      styles.errorText,
      {
        color: colors.error,
        fontSize: typography.fontSize.sm,
      },
      errorStyle,
    ];
  };

  const getHelperStyle = () => {
    return [
      styles.helperText,
      {
        color: colors.textTertiary,
        fontSize: typography.fontSize.sm,
      },
      helperStyle,
    ];
  };

  const renderLeftIcon = () => {
    if (!leftIcon) return null;

    return (
      <View style={styles.leftIconContainer}>
        {typeof leftIcon === 'string' ? (
          <Ionicons
            name={leftIcon}
            size={20}
            color={colors.textSecondary}
          />
        ) : (
          leftIcon
        )}
      </View>
    );
  };

  const renderRightIcon = () => {
    // Show loading spinner
    if (loading) {
      return (
        <View style={styles.rightIconContainer}>
          <Ionicons
            name="refresh"
            size={20}
            color={colors.primary}
            style={{ transform: [{ rotate: '45deg' }] }}
          />
        </View>
      );
    }

    // Password visibility toggle
    if (secureTextEntry) {
      return (
        <TouchableOpacity
          style={styles.rightIconContainer}
          onPress={togglePasswordVisibility}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={isPasswordVisible ? 'eye-off' : 'eye'}
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      );
    }

    if (!rightIcon) return null;

    return (
      <View style={styles.rightIconContainer}>
        {typeof rightIcon === 'string' ? (
          <Ionicons
            name={rightIcon}
            size={20}
            color={rightIconColor || colors.textSecondary}
          />
        ) : (
          rightIcon
        )}
      </View>
    );
  };

  return (
    <View style={[getContainerStyle(), style]}>
      {label && (
        <Text style={getLabelStyle()}>
          {label}
        </Text>
      )}

      <View style={getInputContainerStyle()}>
        {renderLeftIcon()}

        <TextInput
          ref={ref}
          style={getInputStyle()}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />

        {renderRightIcon()}
      </View>

      {error && (
        <Text style={getErrorStyle()}>
          {error}
        </Text>
      )}

      {success && !error && (
        <Text style={[getHelperStyle(), { color: colors.success }]}>
          {success}
        </Text>
      )}

      {helperText && !error && !success && (
        <Text style={getHelperStyle()}>
          {helperText}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  label: {
    marginBottom: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
  },
  leftIconContainer: {
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightIconContainer: {
    marginLeft: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.sm,
  },
  helperText: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.sm,
  },
});

Input.displayName = 'Input';

export default Input;
