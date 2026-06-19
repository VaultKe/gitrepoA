import React from 'react';
import { View, StyleSheet } from 'react-native';
import { getThemeColors, spacing, borderRadius } from '../../../utils/theme';

const ChamaMembersLoading = () => {
  const colors = getThemeColors();
  const styles = createStyles(colors);
  const skeletonLines = [
    ['70%', '50%'],
    ['60%', '40%'],
    ['80%', '30%'],
    ['55%', '65%'],
    ['45%', '75%'],
  ];
  const skeletonLineStyles = {
    '70%': styles.skeletonLine70,
    '50%': styles.skeletonLine50,
    '60%': styles.skeletonLine60,
    '40%': styles.skeletonLine40,
    '80%': styles.skeletonLine80,
    '30%': styles.skeletonLine30,
    '55%': styles.skeletonLine55,
    '65%': styles.skeletonLine65,
    '45%': styles.skeletonLine45,
    '75%': styles.skeletonLine75,
  };

  return (
    <View style={styles.loadingContainer}>
      {skeletonLines.map(([firstWidth, secondWidth], index) => (
        <View key={index} style={[styles.skeletonCard, styles.skeletonCardSurface]}>
          <View style={[styles.skeletonLine, skeletonLineStyles[firstWidth]]} />
          <View style={[styles.skeletonLine, skeletonLineStyles[secondWidth]]} />
        </View>
      ))}
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    padding: spacing.md,
  },
  skeletonCard: {
    height: 120,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  skeletonCardSurface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    marginBottom: spacing.sm,
    backgroundColor: colors.border,
  },
  skeletonLine70: {
    width: '70%',
  },
  skeletonLine50: {
    width: '50%',
  },
  skeletonLine60: {
    width: '60%',
  },
  skeletonLine40: {
    width: '40%',
  },
  skeletonLine80: {
    width: '80%',
  },
  skeletonLine30: {
    width: '30%',
  },
  skeletonLine55: {
    width: '55%',
  },
  skeletonLine65: {
    width: '65%',
  },
  skeletonLine45: {
    width: '45%',
  },
  skeletonLine75: {
    width: '75%',
  },
});

export default ChamaMembersLoading;
