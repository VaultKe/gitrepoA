import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography } from '../../utils/theme';

const LogoShowcaseScreen = () => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            VaultKe Logo Showcase
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Explore our brand assets and design elements
          </Text>
        </View>

        <View style={styles.logoSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Primary Logo
          </Text>
          <View style={[styles.logoContainer, { backgroundColor: colors.primary }]}>
            <Ionicons name="wallet" size={64} color={colors.white} />
          </View>
          <Text style={[styles.logoLabel, { color: colors.textTertiary }]}>
            VaultKe Wallet Icon
          </Text>
        </View>

        <View style={styles.logoSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Alternative Icons
          </Text>
          <View style={styles.iconGrid}>
            <View style={[styles.iconItem, { backgroundColor: colors.success }]}>
              <Ionicons name="shield-checkmark" size={32} color={colors.white} />
              <Text style={[styles.iconLabel, { color: colors.textTertiary }]}>Security</Text>
            </View>
            <View style={[styles.iconItem, { backgroundColor: colors.info }]}>
              <Ionicons name="people" size={32} color={colors.white} />
              <Text style={[styles.iconLabel, { color: colors.textTertiary }]}>Community</Text>
            </View>
            <View style={[styles.iconItem, { backgroundColor: colors.warning }]}>
              <Ionicons name="trending-up" size={32} color={colors.white} />
              <Text style={[styles.iconLabel, { color: colors.textTertiary }]}>Growth</Text>
            </View>
            <View style={[styles.iconItem, { backgroundColor: colors.secondary }]}>
              <Ionicons name="chatbubbles" size={32} color={colors.white} />
              <Text style={[styles.iconLabel, { color: colors.textTertiary }]}>Chat</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>
            Design Guidelines
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            • Use the primary blue (#007AFF) for main branding
            • Maintain consistent spacing and typography
            • Ensure logos are legible at small sizes
            • Use white icons on colored backgrounds
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  logoSection: {
    marginBottom: spacing.xxxl,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.lg,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoLabel: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    width: '100%',
  },
  iconItem: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  iconLabel: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  infoSection: {
    marginTop: spacing.xl,
  },
  infoTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
});

export default LogoShowcaseScreen;