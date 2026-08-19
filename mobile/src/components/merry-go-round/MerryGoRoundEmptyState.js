import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '../../utils/theme';

const MerryGoRoundEmptyState = ({ colors, onCreatePress }) => (
  <View style={styles.emptyState}>
    <Ionicons name="refresh-circle-outline" size={64} color={colors.textTertiary} />
    <Text style={[styles.emptyTitle, { color: colors.text }]}>No Merry-Go-Rounds</Text>
    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Create or join a merry-go-round to start rotating savings</Text>
    <Text onPress={onCreatePress} style={styles.createButton}>Create Merry-Go-Round</Text>
  </View>
);

const styles = StyleSheet.create({
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  createButton: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: '#007AFF',
    marginTop: spacing.md,
  },
});

export default MerryGoRoundEmptyState;
