import React, { useState } from 'react';
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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, breakpoints } from '../../utils/theme';
import apiService from '../../services/api';
import MessageBanner from '../../components/MessageBanner';
import FormField from '../../components/FormField';
import LoadingButton from '../../components/LoadingButton';
import LegalAgreementSection from '../../components/legal/LegalAgreementSection';
import Card from '../../components/common/Card';

export default function RegisterScreen({ navigation }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    idNumber: '',
    password: '',
    confirmPassword: '',
    gender: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Enhanced error handling state
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState({ visible: false, text: '', type: 'error' });

  const { register, isAuthenticated, theme } = useApp();
  const colors = getThemeColors(theme);

  // Responsive design
  const { width: screenWidth } = Dimensions.get('window');
  const isDesktop = screenWidth >= breakpoints.lg;
  const isTablet = screenWidth >= breakpoints.md && screenWidth < breakpoints.lg;

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigation.replace('MainTabs');
    }
  }, [isAuthenticated, navigation]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Enhanced message display function
  const showMessage = (text, type = 'error', duration = 4000) => {
    setMessage({ visible: true, text, type });
    if (duration > 0) {
      setTimeout(() => {
        setMessage(prev => ({ ...prev, visible: false }));
      }, duration);
    }
  };

  const validateForm = () => {
    const { firstName, lastName, email, phone, idNumber, password, confirmPassword } = formData;
    const newErrors = {};

    // First Name validation
    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
    } else if (!/^[a-zA-Z\s]+$/.test(firstName.trim())) {
      newErrors.firstName = 'First name can only contain letters and spaces';
    }

    // Last Name validation
    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    } else if (!/^[a-zA-Z\s]+$/.test(lastName.trim())) {
      newErrors.lastName = 'Last name can only contain letters and spaces';
    }

    // Email validation
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    // Phone validation (Kenyan format)
    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else {
      const phoneRegex = /^(\+254|0)[17]\d{8}$/;
      if (!phoneRegex.test(phone.trim())) {
        newErrors.phone = 'Please enter a valid Kenyan phone number (e.g., 0712345678)';
      }
    }

    // ID Number validation
    if (!idNumber.trim()) {
      newErrors.idNumber = 'ID Number is required';
    } else if (!/^\d{6,9}$/.test(idNumber.trim())) {
      newErrors.idNumber = 'Please enter a valid ID number (6-9 digits)';
    }

    // Password validation
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, number, and special character';
    }

    // Confirm Password validation
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Terms validation
    if (!acceptedTerms) {
      newErrors.terms = 'Please accept the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    // Clear previous errors and messages
    setErrors({});
    setMessage({ visible: false, text: '', type: 'error' });

    if (!validateForm()) {
      showMessage('Please fix the errors below', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const { confirmPassword, ...userData } = formData;

      // Format data for backend (lowercase field names as per backend expectation)
      const backendUserData = {
        firstName: userData.firstName.trim(),
        lastName: userData.lastName.trim(),
        email: userData.email.trim().toLowerCase(),
        phone: userData.phone.trim(),
        idNumber: userData.idNumber.trim(),
        password: userData.password,
      };

      // Add gender if provided
      if (userData.gender && userData.gender.trim()) {
        backendUserData.gender = userData.gender.trim();
      }
      // Call API directly instead of using AppContext register to avoid auto-login
      const response = await apiService.register(backendUserData);

      if (response.success) {
        // Navigate to email verification screen
        navigation.navigate('EmailVerification', {
          userId: response.data.user.id,
          userEmail: response.data.user.email,
          userName: response.data.user.firstName || response.data.user.email,
          token: response.data.token, // Keep token for auto-login after verification
        });

        showMessage('Registration successful! Please verify your email to continue.', 'success', 3000);
      } else {
        throw new Error(response.error || 'Registration failed');
      }

    } catch (error) {
      console.error('Registration error:', error);

      // Enhanced error handling with specific messages
      let errorMessage = 'Unable to create account. Please try again.';

      if (error.message.includes('email') && error.message.includes('exists')) {
        errorMessage = 'An account with this email already exists. Please use a different email or try logging in.';
        setErrors({ email: 'This email is already registered' });
      } else if (error.message.includes('phone') && error.message.includes('exists')) {
        errorMessage = 'An account with this phone number already exists. Please use a different number or try logging in.';
        setErrors({ phone: 'This phone number is already registered' });
      } else if (error.message.includes('validation')) {
        errorMessage = 'Please check your information and try again.';
      } else if (error.message.includes('Network') || error.message.includes('connection')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message.includes('Rate limit') || error.message.includes('Too many')) {
        errorMessage = 'Too many registration attempts. Please wait a moment and try again.';
      }

      showMessage(errorMessage, 'error', 0);
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
        {/* Message Banner */}
        <MessageBanner
          visible={message.visible}
          message={message.text}
          type={message.type}
          onDismiss={() => setMessage(prev => ({ ...prev, visible: false }))}
        />

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

            {/* Registration Card - Consistent across all screen sizes */}
            <Card
              variant="outlined"
              padding={isDesktop ? "xl" : "lg"}
              style={[
                styles.registerCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                !isDesktop && !isTablet && styles.mobileRegisterCard
              ]}
            >
              <View style={styles.headerContainer}>
                <Text style={[
                  styles.title,
                  { color: colors.text },
                  isDesktop && styles.desktopTitle
                ]}>
                  Create Account
                </Text>
                <Text style={[
                  styles.subtitle,
                  { color: colors.textSecondary },
                  isDesktop && styles.desktopSubtitle
                ]}>
                  Join thousands of users managing their finances
                </Text>
              </View>
          {/* First Name */}
          <FormField
            label="First Name"
            value={formData.firstName}
            onChangeText={(value) => {
              handleInputChange('firstName', value);
              if (errors.firstName) {
                setErrors(prev => ({ ...prev, firstName: null }));
              }
            }}
            placeholder="First name"
            icon="person-outline"
            autoCapitalize="words"
            error={errors.firstName}
          />

          {/* Last Name */}
          <FormField
            label="Last Name"
            value={formData.lastName}
            onChangeText={(value) => {
              handleInputChange('lastName', value);
              if (errors.lastName) {
                setErrors(prev => ({ ...prev, lastName: null }));
              }
            }}
            placeholder="Last name"
            icon="person-outline"
            autoCapitalize="words"
            error={errors.lastName}
          />

          {/* Email */}
          <FormField
            label="Email Address"
            value={formData.email}
            onChangeText={(value) => {
              handleInputChange('email', value);
              if (errors.email) {
                setErrors(prev => ({ ...prev, email: null }));
              }
            }}
            placeholder="Email address"
            icon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          {/* Phone */}
          <FormField
            label="Phone Number"
            value={formData.phone}
            onChangeText={(value) => {
              handleInputChange('phone', value);
              if (errors.phone) {
                setErrors(prev => ({ ...prev, phone: null }));
              }
            }}
            placeholder="Phone number"
            icon="call-outline"
            keyboardType="phone-pad"
            error={errors.phone}
          />

          {/* ID Number */}
          <FormField
            label="ID Number"
            value={formData.idNumber}
            onChangeText={(value) => {
              handleInputChange('idNumber', value);
              if (errors.idNumber) {
                setErrors(prev => ({ ...prev, idNumber: null }));
              }
            }}
            placeholder="National ID number"
            icon="card-outline"
            keyboardType="number-pad"
            error={errors.idNumber}
          />

          {/* Gender Selection Card */}
          <Card
            variant="outlined"
            padding="md"
            style={[
              styles.genderCard,
              { borderColor: errors.gender ? colors.error : colors.border }
            ]}
          >
            <Text style={[styles.fieldLabel, { color: colors.text }]}>
              Gender (Optional)
            </Text>
            <View style={styles.genderContainer}>
              {[
                { value: 'male', label: 'Male', icon: 'male' },
                { value: 'female', label: 'Female', icon: 'female' },
                { value: 'other', label: 'Other', icon: 'transgender' },
              ].map((option) => (
                <Card
                  key={option.value}
                  variant="flat"
                  padding="sm"
                  style={[
                    styles.genderOption,
                    { backgroundColor: colors.surface },
                    formData.gender === option.value && {
                      backgroundColor: colors.primary + '20',
                      borderColor: colors.primary,
                      borderWidth: 2
                    }
                  ]}
                  onPress={() => {
                    handleInputChange('gender', option.value);
                    if (errors.gender) {
                      setErrors(prev => ({ ...prev, gender: null }));
                    }
                  }}
                >
                  <View style={styles.genderOptionContent}>
                    <Ionicons
                      name={option.icon}
                      size={20}
                      color={formData.gender === option.value ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[
                      styles.genderOptionText,
                      { color: formData.gender === option.value ? colors.primary : colors.textSecondary }
                    ]}>
                      {option.label}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
            {errors.gender && (
              <Text style={[styles.errorText, { color: colors.error }]}>
                {errors.gender}
              </Text>
            )}
          </Card>

          {/* Password */}
          <FormField
            label="Password"
            value={formData.password}
            onChangeText={(value) => {
              handleInputChange('password', value);
              if (errors.password) {
                setErrors(prev => ({ ...prev, password: null }));
              }
            }}
            placeholder="Password"
            icon="lock-closed-outline"
            secureTextEntry={true}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword(!showPassword)}
            error={errors.password}
          />

          {/* Confirm Password */}
          <FormField
            label="Confirm Password"
            value={formData.confirmPassword}
            onChangeText={(value) => {
              handleInputChange('confirmPassword', value);
              if (errors.confirmPassword) {
                setErrors(prev => ({ ...prev, confirmPassword: null }));
              }
            }}
            placeholder="Confirm password"
            icon="lock-closed-outline"
            secureTextEntry={true}
            showPassword={showConfirmPassword}
            onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
            error={errors.confirmPassword}
          />

          {/* Enhanced Legal Agreement Section */}
          <Card
            variant="flat"
            padding="md"
            style={styles.legalCard}
          >
            <LegalAgreementSection
              acceptedTerms={acceptedTerms}
              onAcceptTerms={() => {
                setAcceptedTerms(!acceptedTerms);
                if (errors.terms) {
                  setErrors(prev => ({ ...prev, terms: null }));
                }
              }}
              onNavigateToTerms={() => navigation.navigate('TermsOfService')}
              onNavigateToPrivacy={() => navigation.navigate('PrivacyPolicy')}
              error={errors.terms}
            />
          </Card>

          {/* Register Button */}
          <LoadingButton
            title="Create Account"
            onPress={handleRegister}
            loading={isLoading}
            loadingText="Creating Account..."
            style={[
              styles.registerButton,
              { backgroundColor: colors.primary },
              isDesktop && styles.desktopRegisterButton
            ]}
            disabled={!formData.firstName.trim() || !formData.lastName.trim() ||
                     !formData.email.trim() || !formData.phone.trim() ||
                     !formData.idNumber.trim() || !formData.password || !formData.confirmPassword || !acceptedTerms}
          />

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Sign In Link Card */}
          <Card
            variant="flat"
            padding="md"
            style={styles.signInCard}
            onPress={() => navigation.navigate('Login')}
          >
            <View style={styles.signInContainer}>
              <Text style={[styles.signInText, { color: colors.textSecondary }]}>
                Already have an account?{' '}
              </Text>
              <Text style={[styles.signInLink, { color: colors.primary }]}>
                Sign In
              </Text>
            </View>
          </Card>
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
    padding: spacing.lg,
    paddingBottom: spacing.xl,
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
    marginTop: spacing.lg,
  },
  titleText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  subtitleText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
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

  // Field container styles for proper spacing
  fieldContainer: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },

  // Gender picker styles
  genderContainer: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  genderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  genderOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  registerButton: {
    borderRadius: borderRadius.md,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginHorizontal: spacing.md,
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    fontSize: typography.fontSize.sm,
  },
  signInLink: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
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
  registerCard: {
    width: '100%',
    borderRadius: borderRadius.xl,
    marginTop: spacing.lg,
  },
  mobileRegisterCard: {
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
  desktopRegisterButton: {
    height: 56,
    borderRadius: borderRadius.lg,
  },
  genderCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
  },
  genderOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalCard: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
  },
  signInCard: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
});
