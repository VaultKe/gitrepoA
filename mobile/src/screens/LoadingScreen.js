import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { getThemeColors, spacing, typography } from '../utils/theme';

const LoadingScreen = () => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={[styles.logoContainer, { backgroundColor: colors.primary }]}>
          <Ionicons name="wallet" size={48} color={colors.white} />
        </View>

        {/* App Name */}
        <Text style={[styles.appName, { color: colors.text }]}>
          VaultKe
        </Text>

        {/* Tagline */}
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          Your Digital Finance Companion
        </Text>

        {/* Loading Indicator */}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading your financial world...
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <Ionicons name="shield-checkmark" size={20} color={colors.success} />
            <Text style={[styles.featureText, { color: colors.textTertiary }]}>
              Secure & Encrypted
            </Text>
          </View>
          
          <View style={styles.featureItem}>
            <Ionicons name="people" size={20} color={colors.info} />
            <Text style={[styles.featureText, { color: colors.textTertiary }]}>
              Community Driven
            </Text>
          </View>
          
          <View style={styles.featureItem}>
            <Ionicons name="trending-up" size={20} color={colors.warning} />
            <Text style={[styles.featureText, { color: colors.textTertiary }]}>
              Smart Savings
            </Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textTertiary }]}>
          Powered by VaultKe Technologies
        </Text>
        <Text style={[styles.versionText, { color: colors.textTertiary }]}>
          Version 1.0.0
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  appName: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  tagline: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xxxl,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  featuresContainer: {
    width: '100%',
    maxWidth: 300,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  featureText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.md,
    fontWeight: typography.fontWeight.medium,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },
  footerText: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  versionText: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
});

export default LoadingScreen;
