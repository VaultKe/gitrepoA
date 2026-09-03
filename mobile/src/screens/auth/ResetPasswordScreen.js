import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius, breakpoints } from '../../utils/theme';
import { useApp } from '../../context/AppContext';
import ApiService from '../../services/api';
import FormField from '../../components/FormField';
import LoadingButton from '../../components/LoadingButton';
import Card from '../../components/common/Card';

export default function ResetPasswordScreen({ navigation, route }) {
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Countdown timer state
  const [timeRemaining, setTimeRemaining] = useState(120); // 2 minutes in seconds
  const [isTokenValid, setIsTokenValid] = useState(true);
  const [trialCount, setTrialCount] = useState(0);
  const [tokenError, setTokenError] = useState('');

  // Refs for intervals
  const countdownInterval = useRef(null);
  const statusCheckInterval = useRef(null);

  const { theme } = useApp();
  const colors = getThemeColors(theme);

  // Responsive design
  const { width: screenWidth } = Dimensions.get('window');
  const isDesktop = screenWidth >= breakpoints.lg;
  const isTablet = screenWidth >= breakpoints.md && screenWidth < breakpoints.lg;

  // Get email from route params if passed from ForgotPasswordScreen
  const userEmail = route?.params?.email || route?.params?.userEmail || '';
  const identifier = route?.params?.identifier || '';
  const token = route?.params?.token || 'user-will-enter-code';

  const validateForm = () => {
    const newErrors = {};

    if (!resetCode.trim()) {
      newErrors.resetCode = 'Reset code is required';
    } else if (resetCode.trim().length !== 6) {
      newErrors.resetCode = 'Reset code must be 6 digits';
    }

    if (!newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Countdown timer functions
  useEffect(() => {
    // Start countdown when component mounts
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
    if (!resetCode.trim() || resetCode.trim().length !== 6) {
      return; // Don't check status if no valid code entered yet
    }

    try {
      const response = await ApiService.checkTokenStatus(resetCode.trim());

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
          setTokenError('Reset code has expired');
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
      if (isTokenValid && resetCode.trim().length === 6) {
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

  // Request new reset code
  const requestNewCode = async () => {
    if (!userEmail && !identifier) {
      Alert.alert('Error', 'Email address not available. Please go back and try again.');
      return;
    }

    try {
      setIsLoading(true);
      const emailToUse = userEmail || identifier;
      const response = await ApiService.forgotPassword(emailToUse);

      if (response.success) {
        // Reset state for new code
        setResetCode('');
        setTimeRemaining(120);
        setIsTokenValid(true);
        setTokenError('');
        setTrialCount(0);
        setErrors({});

        // Restart countdown
        startCountdown();

        Alert.alert(
          'New Code Sent!',
          `A new 6-digit reset code has been sent to ${emailToUse}. The code will expire in 2 minutes.`
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to send new reset code');
      }
    } catch (error) {
      console.error('Error requesting new code:', error);
      Alert.alert('Error', 'Failed to send new reset code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!isTokenValid) {
      Alert.alert('Error', 'Reset code is invalid or expired');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await ApiService.resetPassword(resetCode.trim(), newPassword);

      if (response.success) {
        // Stop countdown on success
        stopCountdown();

        // Show success message
        Alert.alert(
          '✅ Password Reset Successful!',
          response.message || 'Your password has been reset successfully. You can now login with your new password.',
          [
            {
              text: 'Login Now',
              onPress: () => navigation.navigate('Login'),
            },
          ]
        );

        // Auto-redirect to login after 3 seconds if user doesn't click
        setTimeout(() => {
          navigation.navigate('Login');
        }, 3000);
      } else {
        // Check if it's a trial count error
        if (response.error?.includes('maximum attempts')) {
          setIsTokenValid(false);
          setTokenError('Maximum attempts exceeded. Please request a new reset code.');
          stopCountdown();
        } else {
          setErrors({ general: response.error || 'Failed to reset password' });
          // Refresh token status to get updated trial count
          checkTokenStatus();
        }
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setErrors({ general: 'Failed to reset password. Please try again.' });
      checkTokenStatus(); // Refresh status
    } finally {
      setIsLoading(false);
    }
  };

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
          {/* Responsive Container */}
          <View style={[
            styles.responsiveContainer,
            { maxWidth: isDesktop ? 600 : isTablet ? 500 : '100%' }
          ]}>
            {/* Logo Section */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/chama_logo.png')}
                style={{ width: isDesktop ? 100 : 80, height: isDesktop ? 100 : 80, borderRadius: isDesktop ? 50 : 40 }}
                resizeMode="cover"
              />
              <Text style={[
                styles.logoText,
                { color: colors.text },
                isDesktop && styles.desktopLogoText
              ]}>
                VaultKe
              </Text>
            </View>

            {/* Reset Password Card */}
            <Card
              variant="outlined"
              padding="md"
              style={[
                styles.resetPasswordCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: 8,
                  shadowColor: 'transparent',
                  shadowOpacity: 0,
                  shadowRadius: 0,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 0,
                },
                !isDesktop && !isTablet && styles.mobileResetPasswordCard
              ]}
            >
              <View style={styles.headerContainer}>
                <Text style={[
                  styles.titleText,
                  { color: colors.text },
                  isDesktop && styles.desktopTitle
                ]}>
                  Reset Password
                </Text>
                <Text style={[
                  styles.subtitleText,
                  { color: colors.textSecondary },
                  isDesktop && styles.desktopSubtitle
                ]}>
                  Enter the 6-digit code sent to{'\n'}
                  <Text style={{ fontWeight: '600', color: colors.text }}>
                    {userEmail || identifier || 'your email'}
                  </Text>
                  {'\n'}and create a new password
                </Text>
              </View>

              {/* Countdown Timer Card */}
              <Card
                variant="outlined"
                padding="lg"
                style={[styles.countdownCard, {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: 8,
                  shadowColor: 'transparent',
                  shadowOpacity: 0,
                  shadowRadius: 0,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 0,
                }]}
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
                      Time remaining to reset your password
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
                      loading={isLoading}
                      loadingText="Sending..."
                      style={[styles.newCodeButton, { backgroundColor: colors.primary }]}
                    />
                  </>
                )}
              </Card>

              {Platform.OS === 'web' ? (
                <form onSubmit={(e) => { e.preventDefault(); handleResetPassword(); }}>
                  {/* General Error */}
                  {errors.general && (
                    <Card
                      variant="outlined"
                      padding="md"
                      style={[styles.errorCard, {
                        backgroundColor: colors.error + '15',
                        borderColor: colors.error,
                        borderRadius: 8,
                        shadowColor: 'transparent',
                        shadowOpacity: 0,
                        shadowRadius: 0,
                        shadowOffset: { width: 0, height: 0 },
                        elevation: 0,
                      }]}
                    >
                      <View style={styles.errorContent}>
                        <Ionicons name="alert-circle" size={20} color={colors.error} />
                        <Text style={[styles.errorText, { color: colors.error }]}>{errors.general}</Text>
                      </View>
                    </Card>
                  )}

                  {/* Reset Code Input */}
                  <FormField
                    value={resetCode}
                    onChangeText={setResetCode}
                    placeholder="Reset code"
                    icon="keypad-outline"
                    keyboardType="numeric"
                    maxLength={6}
                    autoCapitalize="none"
                    error={errors.resetCode}
                  />

                  {/* New Password Input */}
                  <FormField
                    placeholder="New password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    icon="lock-closed-outline"
                    secureTextEntry={true}
                    showPassword={showPassword}
                    onTogglePassword={() => setShowPassword(!showPassword)}
                    error={errors.newPassword}
                  />

                  {/* Confirm Password Input */}
                  <FormField
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    icon="lock-closed-outline"
                    secureTextEntry={true}
                    showPassword={showConfirmPassword}
                    onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
                    error={errors.confirmPassword}
                  />

                  {/* Reset Password Button */}
                  <LoadingButton
                    title="Reset Password"
                    onPress={handleResetPassword}
                    loading={isLoading}
                    loadingText="Resetting Password..."
                    style={[
                      styles.resetButton,
                      { backgroundColor: colors.primary },
                      isDesktop && styles.desktopResetButton
                    ]}
                    disabled={!resetCode.trim() || !newPassword || !confirmPassword}
                  />

                  {/* Resend Code Card */}
                  <Card
                    variant="flat"
                    padding="md"
                    style={styles.resendCard}
                    onPress={requestNewCode}
                    disabled={isLoading}
                  >
                    <Text style={[styles.resendText, { color: colors.textSecondary }]}>
                      Didn't receive the code?{' '}
                      <Text style={{ color: colors.primary, fontWeight: '600' }}>
                        Resend Code
                      </Text>
                    </Text>
                  </Card>

                  {/* Back Button Card */}
                  <Card
                    variant="flat"
                    padding="md"
                    style={styles.backCard}
                    onPress={() => navigation.goBack()}
                  >
                    <View style={styles.backButton}>
                      <Ionicons name="arrow-back" size={20} color={colors.primary} />
                      <Text style={[styles.backButtonText, { color: colors.primary }]}>Back</Text>
                    </View>
                  </Card>
                </form>
              ) : (
                <>
                  {/* General Error */}
                  {errors.general && (
                    <Card
                      variant="outlined"
                      padding="md"
                      style={[styles.errorCard, {
                        backgroundColor: colors.error + '15',
                        borderColor: colors.error,
                        borderRadius: 8,
                        shadowColor: 'transparent',
                        shadowOpacity: 0,
                        shadowRadius: 0,
                        shadowOffset: { width: 0, height: 0 },
                        elevation: 0,
                      }]}
                    >
                      <View style={styles.errorContent}>
                        <Ionicons name="alert-circle" size={20} color={colors.error} />
                        <Text style={[styles.errorText, { color: colors.error }]}>{errors.general}</Text>
                      </View>
                    </Card>
                  )}

                  {/* Reset Code Input */}
                  <FormField
                    value={resetCode}
                    onChangeText={setResetCode}
                    placeholder="Reset code"
                    icon="keypad-outline"
                    keyboardType="numeric"
                    maxLength={6}
                    autoCapitalize="none"
                    error={errors.resetCode}
                  />

                  {/* New Password Input */}
                  <FormField
                    placeholder="New password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    icon="lock-closed-outline"
                    secureTextEntry={true}
                    showPassword={showPassword}
                    onTogglePassword={() => setShowPassword(!showPassword)}
                    error={errors.newPassword}
                  />

                  {/* Confirm Password Input */}
                  <FormField
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    icon="lock-closed-outline"
                    secureTextEntry={true}
                    showPassword={showConfirmPassword}
                    onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
                    error={errors.confirmPassword}
                  />

                  {/* Reset Password Button */}
                  <LoadingButton
                    title="Reset Password"
                    onPress={handleResetPassword}
                    loading={isLoading}
                    loadingText="Resetting Password..."
                    style={[
                      styles.resetButton,
                      { backgroundColor: colors.primary },
                      isDesktop && styles.desktopResetButton
                    ]}
                    disabled={!resetCode.trim() || !newPassword || !confirmPassword}
                  />

                  {/* Resend Code Card */}
                  <Card
                    variant="flat"
                    padding="md"
                    style={styles.resendCard}
                    onPress={requestNewCode}
                    disabled={isLoading}
                  >
                    <Text style={[styles.resendText, { color: colors.textSecondary }]}>
                      Didn't receive the code?{' '}
                      <Text style={{ color: colors.primary, fontWeight: '600' }}>
                        Resend Code
                      </Text>
                    </Text>
                  </Card>

                  {/* Back Button Card */}
                  <Card
                    variant="flat"
                    padding="md"
                    style={styles.backCard}
                    onPress={() => navigation.goBack()}
                  >
                    <View style={styles.backButton}>
                      <Ionicons name="arrow-back" size={20} color={colors.primary} />
                      <Text style={[styles.backButtonText, { color: colors.primary }]}>Back</Text>
                    </View>
                  </Card>
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
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.lg,
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
    marginBottom: spacing.sm,
  },
  emailText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    fontStyle: 'italic',
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
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 14,
  },
  eyeIcon: {
    padding: spacing.xs,
  },
  fieldError: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
    marginLeft: spacing.sm,
  },
  resetButton: {
    borderRadius: borderRadius.md,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
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
  resendContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  resendText: {
    fontSize: typography.fontSize.sm,
  },

  // Countdown Timer Styles
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

  // Desktop/Tablet specific styles
  desktopScrollContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100%',
    paddingVertical: spacing.sm,
  },
  responsiveContainer: {
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  resetPasswordCard: {
    width: '100%',
    borderRadius: 8,
    marginTop: spacing.md,
  },
  mobileResetPasswordCard: {
    borderRadius: 8,
    marginTop: spacing.md,
    marginHorizontal: spacing.sm,
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
  resendCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  backCard: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
});
