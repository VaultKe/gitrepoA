import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VaultKeTheme } from '../theme/theme';

const FormField = ({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  secureTextEntry,
  showPassword,
  onTogglePassword,
  error,
  showError = true,
  keyboardType = 'default',
  autoCapitalize = 'none',
  multiline = false,
  numberOfLines = 1,
  editable = true,
  maxLength,
  style,
  inputStyle,
  ...props
}) => {
  const hasError = !!error && showError;

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={styles.label}>{label}</Text>
      )}
      
      <View style={[
        styles.inputContainer,
        !editable && styles.inputContainerDisabled,
      ]}>
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={VaultKeTheme.colors.textSecondary}
            style={styles.inputIcon}
          />
        )}
        
        <TextInput
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            secureTextEntry && styles.passwordInput,
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={VaultKeTheme.colors.textSecondary}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          maxLength={maxLength}
          {...props}
        />
        
        {secureTextEntry && onTogglePassword && (
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={onTogglePassword}
          >
            <Ionicons
              name={showPassword ? "eye-outline" : "eye-off-outline"}
              size={20}
              color={VaultKeTheme.colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
      
      {hasError && (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle"
            size={16}
            color={VaultKeTheme.colors.error}
            style={styles.errorIcon}
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: VaultKeTheme.spacing.md,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: VaultKeTheme.colors.text,
    marginBottom: VaultKeTheme.spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VaultKeTheme.colors.surface,
    borderRadius: VaultKeTheme.borderRadius.md,
    borderWidth: 1,
    borderColor: VaultKeTheme.colors.border,
    paddingHorizontal: VaultKeTheme.spacing.md,
    minHeight: 50,
  },
  // Removed error styling to prevent red borders
  inputContainerDisabled: {
    backgroundColor: VaultKeTheme.colors.border + '30',
    opacity: 0.6,
  },
  inputIcon: {
    marginRight: VaultKeTheme.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: VaultKeTheme.colors.text,
    paddingVertical: VaultKeTheme.spacing.sm,
  },
  inputMultiline: {
    textAlignVertical: 'top',
    paddingTop: VaultKeTheme.spacing.md,
    paddingBottom: VaultKeTheme.spacing.md,
  },
  passwordInput: {
    paddingRight: VaultKeTheme.spacing.xl,
  },
  eyeIcon: {
    position: 'absolute',
    right: VaultKeTheme.spacing.md,
    padding: VaultKeTheme.spacing.xs,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: VaultKeTheme.spacing.xs,
    paddingHorizontal: VaultKeTheme.spacing.xs,
  },
  errorIcon: {
    marginRight: VaultKeTheme.spacing.xs,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: VaultKeTheme.colors.error,
    lineHeight: 18,
  },
});

export default FormField;
