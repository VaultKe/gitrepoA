import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import { useApp } from '../../context/AppContext';

const { width: screenWidth } = Dimensions.get('window');

const ResponsiveForm = ({ 
  children, 
  style,
  maxWidth = 800,
  padding = spacing.lg 
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  
  const isTabletOrDesktop = screenWidth > 768;
  
  return (
    <View style={[
      styles.formContainer,
      {
        maxWidth: isTabletOrDesktop ? maxWidth : '100%',
        alignSelf: 'center',
        width: '100%',
        paddingHorizontal: padding,
      },
      style
    ]}>
      {children}
    </View>
  );
};

const FormRow = ({ children, style }) => {
  const isTabletOrDesktop = screenWidth > 768;
  
  return (
    <View style={[
      styles.formRow,
      {
        flexDirection: isTabletOrDesktop ? 'row' : 'column',
        gap: isTabletOrDesktop ? spacing.md : 0,
      },
      style
    ]}>
      {children}
    </View>
  );
};

const FormField = ({ 
  label, 
  value, 
  onChangeText, 
  placeholder, 
  keyboardType = 'default',
  multiline = false,
  numberOfLines = 1,
  flex = 1,
  fullWidth = false,
  error,
  icon,
  style,
  inputStyle,
  ...props 
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const isTabletOrDesktop = screenWidth > 768;
  
  return (
    <View style={[
      styles.fieldContainer,
      {
        flex: isTabletOrDesktop && !fullWidth ? flex : 1,
        marginBottom: spacing.md,
      },
      style
    ]}>
      {label && (
        <Text style={[styles.label, { color: colors.text }]}>
          {label}
        </Text>
      )}
      <View style={[
        styles.inputContainer,
        {
          backgroundColor: colors.surface,
          borderColor: error ? colors.error : colors.border,
          borderWidth: error ? 2 : 1,
        }
      ]}>
        {icon && (
          <Ionicons 
            name={icon} 
            size={20} 
            color={colors.textSecondary} 
            style={styles.inputIcon}
          />
        )}
        <TextInput
          style={[
            styles.input,
            {
              color: colors.text,
              flex: 1,
              minHeight: multiline ? numberOfLines * 20 : undefined,
            },
            inputStyle
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          {...props}
        />
      </View>
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
};

const FormButton = ({ 
  title, 
  onPress, 
  disabled = false, 
  loading = false,
  variant = 'primary',
  icon,
  style,
  fullWidth = false,
  ...props 
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const isTabletOrDesktop = screenWidth > 768;
  
  const getButtonStyle = () => {
    const baseStyle = {
      backgroundColor: disabled ? colors.disabled : colors.primary,
      borderColor: colors.primary,
    };
    
    if (variant === 'outline') {
      return {
        backgroundColor: 'transparent',
        borderColor: disabled ? colors.disabled : colors.primary,
        borderWidth: 2,
      };
    }
    
    if (variant === 'secondary') {
      return {
        backgroundColor: disabled ? colors.disabled : colors.secondary,
        borderColor: colors.secondary,
      };
    }
    
    return baseStyle;
  };
  
  const getTextColor = () => {
    if (variant === 'outline') {
      return disabled ? colors.disabled : colors.primary;
    }
    return colors.white;
  };
  
  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonStyle(),
        {
          maxWidth: isTabletOrDesktop && !fullWidth ? 300 : '100%',
          alignSelf: isTabletOrDesktop && !fullWidth ? 'center' : 'stretch',
        },
        style
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      {...props}
    >
      <View style={styles.buttonContent}>
        {loading && (
          <Ionicons
            name="refresh"
            size={20}
            color={getTextColor()}
            style={[styles.loadingIcon, { marginRight: spacing.sm }]}
          />
        )}
        {icon && !loading && (
          <Ionicons
            name={icon}
            size={20}
            color={getTextColor()}
            style={{ marginRight: spacing.sm }}
          />
        )}
        <Text style={[
          styles.buttonText,
          { color: getTextColor() }
        ]}>
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const FormSection = ({ title, children, style }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  
  return (
    <View style={[styles.section, style]}>
      {title && (
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  formContainer: {
    flex: 1,
  },
  formRow: {
    marginBottom: spacing.sm,
  },
  fieldContainer: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    fontSize: typography.fontSize.md,
    paddingVertical: spacing.sm,
    textAlignVertical: 'top',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.xs,
  },
  button: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginVertical: spacing.sm,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  loadingIcon: {
    // Animation would be added here if needed
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
});

// Export all components
ResponsiveForm.Row = FormRow;
ResponsiveForm.Field = FormField;
ResponsiveForm.Button = FormButton;
ResponsiveForm.Section = FormSection;

export default ResponsiveForm;
