import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';

const ChamaTransactionsNoChama = ({ navigation }) => {
  const colors = getThemeColors();
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={[styles.container, styles.containerBackground]}>
      <View style={styles.centerContainer}>
        <Ionicons name="business" size={64} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, styles.emptyTitleText]}>
          No Chama Selected
        </Text>
        <Text style={[styles.emptySubtitle, styles.emptySubtitleText]}>
          Please select a chama from the dashboard to view transactions
        </Text>
        <TouchableOpacity
          style={[styles.backButton, styles.backButtonPrimary]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backButtonText, styles.backButtonTextWhite]}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  containerBackground: {
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  backButtonPrimary: {
    backgroundColor: colors.primary,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  backButtonTextWhite: {
    color: colors.white,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyTitleText: {
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  emptySubtitleText: {
    color: colors.textSecondary,
  },
});

export default ChamaTransactionsNoChama;
