import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import usePaymentMethodsScreen from '../../../hooks/usePaymentMethodsScreen';

const PaymentMethodsScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const {
    theme: _theme,
    user: _user,
    loading,
    mpesaPhone,
  } = usePaymentMethodsScreen({ navigation });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="card" size={32} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Payment Methods
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Manage your payment options for contributions and purchases
          </Text>
        </View>

        {/* M-Pesa Method (read-only, bound to user phone) */}
        <Card style={styles.methodCard}>
          <View style={styles.methodHeader}>
            <View style={styles.methodInfo}>
              <View style={[styles.methodIcon, { backgroundColor: '#00A651' + '20' }]}>
                <Ionicons name="phone-portrait" size={24} color="#00A651" />
              </View>
              <View style={styles.methodDetails}>
                <Text style={[styles.methodName, { color: colors.text }]}>
                  M-Pesa
                </Text>
                <Text style={[styles.methodDetailsText, { color: colors.textSecondary }]}>
                  {mpesaPhone || 'Not set'}
                </Text>
                <Text style={[styles.methodDescription, { color: colors.textSecondary }]}>
                  Default mobile money payment method
                </Text>
              </View>
            </View>
            <View style={[styles.activeBadge, { backgroundColor: colors.success + '20' }]}>
              <Text style={[styles.activeBadgeText, { color: colors.success }]}>
                Active
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: spacing.md,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  methodCard: {
    padding: spacing.md,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  methodInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  methodDetails: {
    flex: 1,
  },
  methodName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  methodDetailsText: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  methodDescription: {
    fontSize: typography.fontSize.xs,
  },
  activeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  activeBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
  },
});

export default PaymentMethodsScreen;
