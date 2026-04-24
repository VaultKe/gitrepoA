import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../utils/theme';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import EmailVerificationScreen from '../screens/auth/EmailVerificationScreen';

// Legal Screens
import PrivacyPolicyScreen from '../screens/legal/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/legal/TermsOfServiceScreen';

const Tab = createBottomTabNavigator();

// Custom Auth Tab Bar Component
const AuthTabBar = ({ state, descriptors, navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  // Smart shortcuts for auth screens - exactly 3 icons
  const quickShortcuts = [
    { name: 'Login', label: 'Login', icon: 'log-in', onPress: () => navigation.navigate('Login') },
    { name: 'Register', label: 'Sign Up', icon: 'person-add', onPress: () => navigation.navigate('Register') },
    { name: 'ForgotPassword', label: 'Reset', icon: 'key', onPress: () => navigation.navigate('ForgotPassword') },
  ];

  return (
    <View style={[styles.tabBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {/* Smart Footer Icons - Always show exactly 3 */}
      {quickShortcuts.map((item, index) => {
        const isActive = state.routeNames[state.index] === item.name;
        const iconColor = isActive ? colors.primary : colors.textSecondary;

        return (
          <TouchableOpacity
            key={item.name}
            style={styles.tabItem}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={styles.tabButton}>
              <Ionicons
                name={item.icon}
                size={20}
                color={iconColor}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: iconColor }
                ]}
              >
                {item.label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default function AuthTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <AuthTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Main Auth Screens */}
      <Tab.Screen
        name="Login"
        component={LoginScreen}
        options={{
          title: 'Login',
        }}
      />
      <Tab.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          title: 'Sign Up',
        }}
      />
      <Tab.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          title: 'Reset Password',
        }}
      />
      <Tab.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{
          title: 'Enter Reset Code',
        }}
      />
      <Tab.Screen
        name="EmailVerification"
        component={EmailVerificationScreen}
        options={{
          title: 'Verify Email',
        }}
      />

      {/* Legal Screens */}
      <Tab.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{
          title: 'Privacy Policy',
        }}
      />
      <Tab.Screen
        name="TermsOfService"
        component={TermsOfServiceScreen}
        options={{
          title: 'Terms of Service',
        }}
      />

    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    height: 70,
    paddingBottom: 8,
    paddingTop: 8,
    paddingHorizontal: spacing.sm,
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.xs,
  },
  tabLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
