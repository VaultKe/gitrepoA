import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, breakpoints } from '../../utils/theme';
import apiService from '../../services/api';
import { API_BASE_URL } from '../../config/environment';
import Toast from 'react-native-toast-message';
import FormField from '../../components/FormField';
import LoadingButton from '../../components/LoadingButton';
import Card from '../../components/common/Card';

export default function LoginScreen({ navigation }) {
  const [identifier, setIdentifier] = useState(''); // email or phone
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [networkStatus, setNetworkStatus] = useState('checking');

  // Enhanced error handling state
  const [errors, setErrors] = useState({});

  const { login, isAuthenticated, userRole, theme } = useApp();
  const colors = getThemeColors(theme);

  // Responsive design
  const { width: screenWidth } = Dimensions.get('window');
  const isDesktop = screenWidth >= breakpoints.lg;
  const isTablet = screenWidth >= breakpoints.md && screenWidth < breakpoints.lg;

  // Check network status on mount
  useEffect(() => {
    checkNetworkStatus();
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Check user role and redirect accordingly
      if (userRole === 'admin') {
        navigation.replace('MainTabs', { screen: 'Admin' });
      } else {
        navigation.replace('MainTabs');
      }
    }
  }, [isAuthenticated, userRole, navigation]);

  const checkNetworkStatus = async () => {
    setNetworkStatus('checking');
    try {
      // Use API service for health check - this will automatically use the correct URL
      await apiService.checkHealth();

      setNetworkStatus('online');
      return 'online';
    } catch (error) {
      setNetworkStatus('offline');
      return 'offline';
    }
  };

  // Enhanced validation function
  const validateForm = () => {
    const newErrors = {};
    const id = identifier.trim();

    if (!id) {
      newErrors.identifier = 'Email or phone number is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^(\+254|254|0)[17]\d{8}$/;

      if (!emailRegex.test(id) && !phoneRegex.test(id)) {
        newErrors.identifier = 'Please enter a valid email or phone number ';
      }
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isCredentialError = (message) => {
    return /invalid credentials|incorrect credentials|wrong email|wrong phone|wrong password|invalid email|invalid phone|invalid password|login failed/i.test(message);
  };

  const isNetworkError = (message) => {
    return /network|connection|failed to fetch|timeout|offline|unreachable|ECONNREFUSED|ENOTFOUND|ERR_NETWORK|ERR_CONNECTION|server unreachable/i.test(message);
  };

  const handleLogin = async () => {
    // Clear previous errors
    setErrors({});

    if (!validateForm()) {
      Toast.show({
        type: 'error',
        text1: 'Please fix the errors below',
      });
      return;
    }

    setIsLoading(true);

    const credentials = {
      identifier: identifier.trim(),
      password: password,
    };

    try {
      const result = await login(credentials);

      if (result.success) {
        if (result.previousDeviceLoggedOut) {
          const deviceName = result.previousDeviceName || 'another device';
          Toast.show({
            type: 'info',
            text1: 'Security notice',
            text2: `Your account was logged out from ${deviceName}. Only one device can be active at a time.`,
          });
        } else {
          Toast.show({
            type: 'success',
            text1: 'Welcome back!',
            text2: 'Logging you in...',
          });
        }
        return;
      }

      const message = result.error || 'Login failed';
      if (isCredentialError(message)) {
        Toast.show({
          type: 'error',
          text1: 'Incorrect credentials',
          text2: 'Please check your email or phone number and password.',
          position: 'bottom',
          visibilityTime: 3000,
        });
        return;
      }

      if (isNetworkError(message)) {
        const storedUsers = await AsyncStorage.getItem('offlineUsers');
        if (storedUsers) {
          const users = JSON.parse(storedUsers);
          const user = users.find(u =>
            (u.email === identifier || u.phone === identifier) && u.password === password
          );

          if (user) {
            const { password: _, ...userWithoutPassword } = user;
            const compressedUserData = {
              id: userWithoutPassword.id,
              firstName: userWithoutPassword.firstName,
              lastName: userWithoutPassword.lastName,
              email: userWithoutPassword.email,
              phone: userWithoutPassword.phone,
              role: userWithoutPassword.role,
              avatar: userWithoutPassword.avatar,
              status: userWithoutPassword.status,
              isEmailVerified: userWithoutPassword.isEmailVerified,
              isPhoneVerified: userWithoutPassword.isPhoneVerified,
            };

            await AsyncStorage.setItem('authToken', 'offline_token_' + user.id);
            await AsyncStorage.setItem('userData', JSON.stringify(compressedUserData));
            await AsyncStorage.setItem('userRole', user.role || 'user');

            Toast.show({
              type: 'success',
              text1: 'Offline login successful',
              text2: 'Data will sync when connection is restored.',
              position: 'bottom',
              visibilityTime: 3000,
            });
            setTimeout(() => {
              if (user.role === 'admin') {
                navigation.replace('MainTabs', { screen: 'Admin' });
              } else {
                navigation.replace('MainTabs');
              }
            }, 2000);
            return;
          }
        }

        Toast.show({
          type: 'error',
          text1: 'Connection issue',
          text2: `Please check your email or phone number and password.`,
          position: 'bottom',
          visibilityTime: 3000,
        });
        return;
      }

      Toast.show({
        type: 'error',
        text1: 'Login failed',
        text2: message,
        position: 'bottom',
        visibilityTime: 3000,
      });
    } catch (error) {
      console.error('Login error:', error);

      const errorMessage = error?.message || 'Unable to login. Please try again.';
      if (isCredentialError(errorMessage)) {
        Toast.show({
          type: 'error',
          text1: 'Incorrect credentials',
          text2: 'Please check your email or phone number and password.',
          position: 'bottom',
          visibilityTime: 3000,
        });
      } else if (isNetworkError(errorMessage)) {
        Toast.show({
          type: 'error',
          text1: 'Connection issue',
          text2: `Server is unreachable.Please check your internet connection.`,
          position: 'bottom',
          visibilityTime: 3000,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Login failed',
          text2: errorMessage,
          position: 'bottom',
          visibilityTime: 3000,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  const loginFormContent = (
    <>
      {/* Email/Phone Input */}
      <FormField
        value={identifier}
        onChangeText={(text) => {
          setIdentifier(text);
          if (errors.identifier) {
            setErrors(prev => ({ ...prev, identifier: null }));
          }
        }}
        placeholder="Email or phone"
        icon="person-outline"
        keyboardType="email-address"
        autoCapitalize="none"
        showError={false}
      />

      {/* Password Input */}
      <FormField
        placeholder="Enter your password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (errors.password) {
            setErrors(prev => ({ ...prev, password: null }));
          }
        }}
        icon="lock-closed-outline"
        secureTextEntry={true}
        showPassword={showPassword}
        onTogglePassword={() => setShowPassword(!showPassword)}
        showError={false}
      />

      {/* Forgot Password Card */}
      <Card
        variant="flat"
        padding="sm"
        style={styles.forgotPasswordCard}
        onPress={handleForgotPassword}
      >
        <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>
          Forgot Password?
        </Text>
      </Card>

      {/* Login Button */}
      <LoadingButton
        title="Sign In"
        onPress={handleLogin}
        loading={isLoading}
        loadingText="Signing In..."
        style={[
          styles.loginButton,
          { backgroundColor: colors.primary },
          isDesktop && styles.desktopLoginButton
        ]}
        disabled={!identifier.trim() || !password}
      />

      {/* Divider */}
      <View style={styles.dividerContainer}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </View>

      {/* Sign Up Link Card */}
      <Card
        variant="flat"
        padding="md"
        style={styles.signUpCard}
        onPress={() => navigation.navigate('Register')}
      >
        <View style={styles.signUpContainer}>
          <Text style={[styles.signUpText, { color: colors.textSecondary }]}>
            Don't have an account?{' '}
          </Text>
          <Text style={[styles.signUpLink, { color: colors.primary }]}>
            Sign Up
          </Text>
        </View>
      </Card>
    </>
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
          {/* Responsive Container */}
          <View style={[
            styles.responsiveContainer,
            { maxWidth: isDesktop ? 500 : isTablet ? 400 : '100%' }
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

            {/* Login Card - Consistent across all screen sizes */}
            <Card
              variant="outlined"
              padding={isDesktop ? "xl" : "lg"}
              style={[
                styles.loginCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                !isDesktop && !isTablet && styles.mobileLoginCard
              ]}
            >
              <Text style={[
                styles.welcomeText,
                { color: colors.text },
                isDesktop && styles.desktopWelcomeText
              ]}>
                Welcome Back
              </Text>
              <Text style={[
                styles.subtitleText,
                { color: colors.textSecondary },
                isDesktop && styles.desktopSubtitleText
              ]}>
                Sign in to your account
              </Text>

              {Platform.OS === 'web' ? (
                <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
                  {loginFormContent}
                </form>
              ) : (
                <View>
                  {loginFormContent}
                </View>
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
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
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
  // Removed formContainer - using card-based layout consistently
  welcomeText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitleText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },

  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  networkStatusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: typography.fontSize.base,
  },
  passwordInput: {
    paddingRight: spacing.xl,
  },
  eyeIcon: {
    position: 'absolute',
    right: spacing.md,
    padding: spacing.xs,
  },
  // Removed forgotPasswordContainer - using card-based design
  forgotPasswordText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  loginButton: {
    borderRadius: borderRadius.md,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.sm,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    height: 50,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  biometricText: {
    fontSize: typography.fontSize.base,
    marginLeft: spacing.sm,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  signUpText: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * 1.4,
  },
  signUpLink: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.fontSize.sm * 1.4,
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
  loginCard: {
    width: '100%',
    borderRadius: borderRadius.xl,
    marginTop: spacing.lg,
  },
  mobileLoginCard: {
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
    marginHorizontal: 0,
  },
  desktopLogoText: {
    fontSize: typography.fontSize.xxxl,
    marginBottom: spacing.lg,
  },
  desktopWelcomeText: {
    fontSize: typography.fontSize.xxl,
    marginBottom: spacing.sm,
  },
  desktopSubtitleText: {
    fontSize: typography.fontSize.lg,
    marginBottom: spacing.xxl,
  },
  desktopLoginButton: {
    height: 56,
    borderRadius: borderRadius.lg,
  },
  forgotPasswordCard: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
  },
  signUpCard: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
});
