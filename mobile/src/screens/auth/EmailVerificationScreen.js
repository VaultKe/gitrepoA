import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, getShadowStyle, breakpoints } from '../../utils/theme';
import ApiService from '../../services/api';
import AppIcon from '../../components/AppIcon';
import FormField from '../../components/FormField';
import LoadingButton from '../../components/LoadingButton';
import Card from '../../components/common/Card';

export default function EmailVerificationScreen({ route, navigation }) {
  const { theme, login } = useApp();
  const colors = getThemeColors(theme);
  const { userId, userEmail, userName, token } = route.params || {};

  // Responsive design
  const { width: screenWidth } = Dimensions.get('window');
  const isDesktop = screenWidth >= breakpoints.lg;
  const isTablet = screenWidth >= breakpoints.md && screenWidth < breakpoints.lg;

  // State management
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Countdown and token status
  const [timeRemaining, setTimeRemaining] = useState(120); // 2 minutes in seconds
  const [isTokenValid, setIsTokenValid] = useState(true);
  const [trialCount, setTrialCount] = useState(0);
  const [tokenError, setTokenError] = useState('');
  
  // Refs
  const countdownInterval = useRef(null);
  const statusCheckInterval = useRef(null);

  // Check token status and start countdown
  useEffect(() => {
    if (verificationCode.length === 6) {
      checkTokenStatus();
    }
    startCountdown();
    startStatusChecking();

    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }
    };
  }, []);

  // Check token status from server
  const checkTokenStatus = async () => {
    if (!verificationCode.trim() || verificationCode.trim().length !== 6) {
      return; // Don't check status if no valid code entered yet
    }

    try {
      const response = await ApiService.checkEmailVerificationStatus(verificationCode.trim());
      
      if (response.success && response.data.valid) {
        setTimeRemaining(response.data.remainingSeconds);
        setTrialCount(response.data.trialCount);
        setIsTokenValid(true);
        setTokenError('');
      } else {
        setIsTokenValid(false);
        setTokenError(response.data.error || 'Token is invalid or expired');
        stopCountdown();
      }
    } catch (error) {
      console.error('Error checking token status:', error);
      // Don't show error for token status check failures
    }
  };

  // Start countdown timer
  const startCountdown = () => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }

    countdownInterval.current = setInterval(() => {
      setTimeRemaining((prevTime) => {
        if (prevTime <= 1) {
          setIsTokenValid(false);
          setTokenError('Verification code has expired');
          stopCountdown();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  };

  // Stop countdown timer
  const stopCountdown = () => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
  };

  // Start periodic status checking
  const startStatusChecking = () => {
    statusCheckInterval.current = setInterval(() => {
      if (isTokenValid && verificationCode.trim().length === 6) {
        checkTokenStatus();
      }
    }, 15000); // Check every 15 seconds
  };

  // Format time display
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle email verification
  const handleVerifyEmail = async () => {
    if (!isTokenValid) {
      Alert.alert('Error', 'Verification code is invalid or expired');
      return;
    }

    if (!verificationCode.trim()) {
      setErrors({ verificationCode: 'Please enter the verification code' });
      return;
    }

    if (verificationCode.trim().length !== 6) {
      setErrors({ verificationCode: 'Verification code must be 6 digits' });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const response = await ApiService.verifyEmailCode(verificationCode.trim());
      
      if (response.success) {
        // Stop countdown on success
        stopCountdown();
        setRedirecting(true);
        // Auto-login and redirect immediately
        setTimeout(async () => {
          try {
            await login(token);
            // Navigation will be handled by the app context automatically
          } catch (error) {
            console.error('❌ Auto-login failed:', error);
            setRedirecting(false);
            Alert.alert(
              'Login Required',
              'Email verified successfully, but auto-login failed. Please log in manually.',
              [
                {
                  text: 'Go to Login',
                  onPress: () => navigation.navigate('Login'),
                },
              ]
            );
          }
        }, 1000); // Reduced delay for faster redirect
      } else {
        // Check if it's a trial count error
        if (response.error?.includes('maximum attempts')) {
          setIsTokenValid(false);
          setTokenError('Maximum attempts exceeded. Please request a new verification code.');
          stopCountdown();
        } else {
          setErrors({ general: response.error || 'Failed to verify email' });
          // Refresh token status to get updated trial count
          checkTokenStatus();
        }
      }
    } catch (error) {
      console.error('Email verification error:', error);
      setErrors({ general: 'Failed to verify email. Please try again.' });
      checkTokenStatus(); // Refresh status
    } finally {
      setLoading(false);
    }
  };

  // Request new verification code
  const requestNewCode = async () => {
    try {
      setLoading(true);
      const response = await ApiService.sendEmailVerification(userId);
      
      if (response.success) {
        // Reset state for new code
        setVerificationCode('');
        setTimeRemaining(120);
        setIsTokenValid(true);
        setTokenError('');
        setTrialCount(0);
        setErrors({});
        
        // Restart countdown
        startCountdown();
        
        Alert.alert('Success', 'A new verification code has been sent to your email.');
      } else {
        Alert.alert('Error', response.error || 'Failed to send new verification code');
      }
    } catch (error) {
      console.error('Error requesting new code:', error);
      Alert.alert('Error', 'Failed to send new verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContainer,
            (isDesktop || isTablet) && styles.desktopScrollContainer
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Responsive Container */}
          <View style={[
            styles.responsiveContainer,
            { maxWidth: isDesktop ? 500 : isTablet ? 400 : '100%' }
          ]}>
            {/* App Logo */}
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

            {/* Email Verification Card */}
            <Card
              variant="elevated"
              padding={isDesktop ? "xl" : "lg"}
              style={[
                styles.verificationCard,
                { backgroundColor: colors.surface },
                getShadowStyle(isDesktop ? 'lg' : 'md'),
                !isDesktop && !isTablet && styles.mobileVerificationCard
              ]}
            >
              {/* Header */}
              <View style={styles.header}>
                <Text style={[
                  styles.title,
                  { color: colors.text },
                  isDesktop && styles.desktopTitle
                ]}>
                  Verify Your Email
                </Text>
                <Text style={[
                  styles.subtitle,
                  { color: colors.textSecondary },
                  isDesktop && styles.desktopSubtitle
                ]}>
                  We've sent a 6-digit code to{'\n'}
                  <Text style={{ fontWeight: '600', color: colors.text }}>{userEmail}</Text>
                </Text>
              </View>

              {/* Countdown Timer Card */}
              <Card
                variant="outlined"
                padding="lg"
                style={[styles.countdownCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                {isTokenValid ? (
                  <>
                    <View style={styles.countdownContainer}>
                      <Ionicons name="time-outline" size={28} color={colors.primary} />
                      <Text style={[styles.countdownText, { color: colors.primary }]}>
                        {formatTime(timeRemaining)}
                      </Text>
                    </View>
                    <Text style={[styles.countdownLabel, { color: colors.textSecondary }]}>
                      Time remaining to verify your email
                    </Text>
                    {trialCount > 0 && (
                      <View style={styles.trialContainer}>
                        <Ionicons name="warning-outline" size={16} color={colors.warning} />
                        <Text style={[styles.trialText, { color: colors.warning }]}>
                          Attempts used: {trialCount}/3
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <View style={styles.expiredContainer}>
                      <Ionicons name="alert-circle" size={28} color={colors.error} />
                      <Text style={[styles.expiredText, { color: colors.error }]}>
                        {tokenError}
                      </Text>
                    </View>
                    <LoadingButton
                      title="Send New Code"
                      onPress={requestNewCode}
                      loading={loading}
                      loadingText="Sending..."
                      style={[styles.newCodeButton, { backgroundColor: colors.primary }]}
                    />
                  </>
                )}
              </Card>

              {/* Form */}
              {isTokenValid && (
                <>
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

                  {/* Verification Code Input */}
                  <FormField
                    value={verificationCode}
                    onChangeText={(text) => {
                      setVerificationCode(text);
                      if (errors.verificationCode) {
                        setErrors({ ...errors, verificationCode: null });
                      }
                    }}
                    placeholder="Enter 6-digit code"
                    icon="keypad-outline"
                    keyboardType="numeric"
                    maxLength={6}
                    autoCapitalize="none"
                    error={errors.verificationCode}
                    textAlign="center"
                  />

                  {/* Verify Button */}
                  <LoadingButton
                    title={redirecting ? "Redirecting to Dashboard..." : "Verify Email"}
                    onPress={handleVerifyEmail}
                    loading={loading || redirecting}
                    loadingText={redirecting ? "Redirecting..." : "Verifying..."}
                    style={[
                      styles.verifyButton,
                      {
                        backgroundColor: redirecting ? colors.success : colors.primary,
                      },
                      isDesktop && styles.desktopVerifyButton
                    ]}
                    disabled={!verificationCode.trim() || verificationCode.length !== 6}
                  />

                  {/* Resend Code Card */}
                  {!redirecting && (
                    <Card
                      variant="flat"
                      padding="md"
                      style={styles.resendCard}
                      onPress={requestNewCode}
                      disabled={loading}
                    >
                      <Text style={[styles.resendText, { color: colors.textSecondary }]}>
                        Didn't receive the code?{' '}
                        <Text style={{ color: colors.primary, fontWeight: '600' }}>
                          Resend
                        </Text>
                      </Text>
                    </Card>
                  )}
                </>
              )}
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.lg,
  },
  logoText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.sm,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 24,
  },
  countdownCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  countdownText: {
    fontSize: 36,
    fontWeight: typography.fontWeight.bold,
    marginLeft: spacing.md,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  countdownLabel: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  trialContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  trialText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.xs,
  },
  expiredContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  expiredText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  newCodeButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  newCodeButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  form: {
    flex: 1,
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
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  codeInput: {
    height: 60,
    borderWidth: 2,
    borderRadius: borderRadius.lg,
    fontSize: 24,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  fieldError: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  verifyButton: {
    height: 50,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  verifyButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  redirectingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  resendText: {
    fontSize: typography.fontSize.sm,
  },

  // Desktop/Tablet specific styles
  desktopScrollContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100%',
    paddingVertical: spacing.xl,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  responsiveContainer: {
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  verificationCard: {
    width: '100%',
    borderRadius: borderRadius.xl,
    marginTop: spacing.lg,
  },
  mobileVerificationCard: {
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
  desktopVerifyButton: {
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
  resendCard: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
});
