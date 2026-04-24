import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius, getShadowStyle, breakpoints } from '../../utils/theme';
import { useApp } from '../../context/AppContext';
import ApiService from '../../services/api';
import AppIcon from '../../components/AppIcon';
import FormField from '../../components/FormField';
import LoadingButton from '../../components/LoadingButton';
import Card from '../../components/common/Card';

export default function ForgotPasswordScreen({ navigation }) {
  const [identifier, setIdentifier] = useState(''); // email or phone
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('request'); // 'request' or 'sent'
  const [errors, setErrors] = useState({});

  const { theme } = useApp();
  const colors = getThemeColors(theme);

  // Responsive design
  const { width: screenWidth } = Dimensions.get('window');
  const isDesktop = screenWidth >= breakpoints.lg;
  const isTablet = screenWidth >= breakpoints.md && screenWidth < breakpoints.lg;

  const handleResetRequest = async () => {
    if (!identifier.trim()) {
      setErrors({ identifier: 'Please enter your email or phone number' });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[\d\s-()]+$/;

    if (!emailRegex.test(identifier.trim()) && !phoneRegex.test(identifier.trim())) {
      setErrors({ identifier: 'Please enter a valid email address or phone number' });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await ApiService.forgotPassword(identifier.trim());
      if (response && response.success) {
        // Show brief success message
        try {
          Alert.alert(
            'Reset Code Sent!',
            'A 6-digit reset code has been sent to your email. The code will expire in 2 minutes.',
            [
              {
                text: 'Continue',
                onPress: () => {
                  // Navigate to password reset screen immediately
                  navigation.navigate('ResetPassword', {
                    token: 'user-will-enter-code',
                    identifier: identifier.trim(),
                    email: identifier.trim(),
                    userEmail: identifier.trim()
                  });
                },
              },
            ]
          );
        } catch (alertError) {
          console.error('Alert error:', alertError);
          // Fallback: just navigate without showing alert
          navigation.navigate('ResetPassword', {
            token: 'user-will-enter-code',
            identifier: identifier.trim(),
            email: identifier.trim(),
            userEmail: identifier.trim()
          });
        }

        // Also auto-redirect after 2 seconds if user doesn't click
        setTimeout(() => {
          navigation.navigate('ResetPassword', {
            token: 'user-will-enter-code',
            identifier: identifier.trim(),
            email: identifier.trim(),
            userEmail: identifier.trim()
          });
        }, 2000);
      } else {
        // Check if it's a user not found error
        const errorMessage = response?.error || response?.message || 'Failed to send reset instructions';
        if (errorMessage.toLowerCase().includes('user not found')) {
          setErrors({ identifier: 'No account found with this email or phone number' });
        } else {
          setErrors({ general: errorMessage });
        }
      }
    } catch (error) {
      console.error('Password reset error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      setErrors({ general: 'Failed to send reset instructions. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const renderRequestStep = () => (
    <View style={[
      styles.responsiveContainer,
      { maxWidth: isDesktop ? 500 : isTablet ? 400 : '100%' }
    ]}>
      {/* Logo Section */}
      <View style={styles.logoContainer}>
        <AppIcon size={isDesktop ? 100 : 80} circular={true} />
        <Text style={[
          styles.logoText,
          { color: colors.text },
          isDesktop && styles.desktopLogoText
        ]}>
          VaultKe
        </Text>
      </View>

      {/* Forgot Password Card */}
      <Card
        variant="elevated"
        padding={isDesktop ? "xl" : "lg"}
        style={[
          styles.forgotPasswordCard,
          { backgroundColor: colors.surface },
          getShadowStyle(isDesktop ? 'lg' : 'md'),
          !isDesktop && !isTablet && styles.mobileForgotPasswordCard
        ]}
      >
        <View style={styles.headerContainer}>
          <Text style={[
            styles.titleText,
            { color: colors.text },
            isDesktop && styles.desktopTitle
          ]}>
            Forgot Password?
          </Text>
          <Text style={[
            styles.subtitleText,
            { color: colors.textSecondary },
            isDesktop && styles.desktopSubtitle
          ]}>
            Enter your email to reset your password
          </Text>
        </View>

        {/* General Error */}
        {errors.general && (
          <Card
            variant="outlined"
            padding="md"
            style={[styles.errorCard, { backgroundColor: colors.error + '15', borderColor: colors.error }]}
          >
            <View style={styles.errorContent}>
              <Ionicons name="alert-circle" size={20} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{errors.general}</Text>
            </View>
          </Card>
        )}

        {/* Email/Phone Input */}
        <FormField
          value={identifier}
          onChangeText={(text) => {
            setIdentifier(text);
            if (errors.identifier) setErrors({});
          }}
          placeholder="Email or phone"
          icon="person-outline"
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.identifier}
        />

        {/* Reset Button */}
        <LoadingButton
          title="Send Reset Instructions"
          onPress={handleResetRequest}
          loading={isLoading}
          loadingText="Sending..."
          style={[
            styles.resetButton,
            { backgroundColor: colors.primary },
            isDesktop && styles.desktopResetButton
          ]}
          disabled={!identifier.trim()}
        />

        {/* Back to Login Card */}
        <Card
          variant="flat"
          padding="md"
          style={styles.backCard}
          onPress={() => navigation.goBack()}
        >
          <View style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={colors.primary} />
            <Text style={[styles.backButtonText, { color: colors.primary }]}>Back to Login</Text>
          </View>
        </Card>
      </Card>
    </View>
  );

  const renderSentStep = () => (
    <View style={[
      styles.responsiveContainer,
      { maxWidth: isDesktop ? 500 : isTablet ? 400 : '100%' }
    ]}>
      {/* Logo Section */}
      <View style={styles.logoContainer}>
        <AppIcon size={isDesktop ? 100 : 80} circular={true} />
        <Text style={[
          styles.logoText,
          { color: colors.text },
          isDesktop && styles.desktopLogoText
        ]}>
          VaultKe
        </Text>
        <Text style={[styles.taglineText, { color: colors.textSecondary }]}>
          Your trusted chama finance companion
        </Text>
      </View>

      {/* Success Card */}
      <Card
        variant="elevated"
        padding={isDesktop ? "xl" : "lg"}
        style={[
          styles.successCard,
          { backgroundColor: colors.surface },
          getShadowStyle(isDesktop ? 'lg' : 'md'),
          !isDesktop && !isTablet && styles.mobileSuccessCard
        ]}
      >
        <View style={styles.headerContainer}>
          <View style={[styles.iconContainer, { backgroundColor: colors.surface, borderColor: colors.success }]}>
            <Ionicons name="mail" size={28} color={colors.success} />
          </View>
          <Text style={[
            styles.titleText,
            { color: colors.text },
            isDesktop && styles.desktopTitle
          ]}>
            Check Your Inbox
          </Text>
          <Text style={[
            styles.subtitleText,
            { color: colors.textSecondary },
            isDesktop && styles.desktopSubtitle
          ]}>
            We've sent password reset instructions to your email or phone number. You'll be redirected to enter the code in 2 seconds.
          </Text>
        </View>

        {/* Instructions Card */}
        <Card
          variant="outlined"
          padding="md"
          style={[styles.instructionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.instructionsText, { color: colors.text }]}>
            • Check your email inbox and spam folder{'\n'}
            • Check your SMS messages{'\n'}
            • Follow the link or code provided{'\n'}
            • Create a new password
          </Text>
        </Card>

        {/* Enter Code Button */}
        <LoadingButton
          title="Enter Reset Code"
          onPress={() => navigation.navigate('ResetPassword', { email: identifier })}
          style={[
            styles.resetButton,
            { backgroundColor: colors.primary },
            isDesktop && styles.desktopResetButton
          ]}
        />

        {/* Resend Instructions Card */}
        <Card
          variant="outlined"
          padding="md"
          style={[styles.secondaryCard, { borderColor: colors.primary }]}
          onPress={() => setStep('request')}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
            Resend Instructions
          </Text>
        </Card>

        {/* Back to Login Card */}
        <Card
          variant="flat"
          padding="md"
          style={styles.backCard}
          onPress={() => navigation.navigate('Login')}
        >
          <View style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={colors.primary} />
            <Text style={[styles.backButtonText, { color: colors.primary }]}>Back to Login</Text>
          </View>
        </Card>
      </Card>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContainer,
            (isDesktop || isTablet) && styles.desktopScrollContainer
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'request' ? renderRequestStep() : renderSentStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
  },
  logoText: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  taglineText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1.5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  titleText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 24,
  },
  formContainer: {
    width: '100%',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  fieldError: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
    marginLeft: spacing.sm,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 14,
  },
  resetButton: {
    borderRadius: borderRadius.md,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  secondaryButton: {
    borderRadius: borderRadius.md,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    marginLeft: spacing.sm,
  },
  instructionsContainer: {
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  instructionsText: {
    fontSize: typography.fontSize.base,
    lineHeight: 24,
  },

  // Desktop/Tablet specific styles
  desktopScrollContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100%',
    paddingVertical: spacing.xl,
  },
  responsiveContainer: {
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  forgotPasswordCard: {
    width: '100%',
    borderRadius: borderRadius.xl,
    marginTop: spacing.lg,
  },
  mobileForgotPasswordCard: {
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
    marginHorizontal: 0,
  },
  successCard: {
    width: '100%',
    borderRadius: borderRadius.xl,
    marginTop: spacing.lg,
  },
  mobileSuccessCard: {
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
    marginHorizontal: 0,
  },
  desktopLogoText: {
    fontSize: typography.fontSize.xxxl,
    marginBottom: spacing.lg,
  },
  desktopTitle: {
    fontSize: typography.fontSize.xxl,
    marginBottom: spacing.sm,
  },
  desktopSubtitle: {
    fontSize: typography.fontSize.lg,
    marginBottom: spacing.xl,
  },
  desktopResetButton: {
    height: 56,
    borderRadius: borderRadius.lg,
  },
  errorCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  instructionsCard: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.md,
  },
  secondaryCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  backCard: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
});
