import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native';
import { spacing, typography } from '../../utils/theme';

const EmptyState = ({
  colors,
  isDesktop,
  loading,
  loadError,
  activeTab,
  onRetry,
  lastSyncedAt,
  totalPollCount = 0,
  activeCount = 0,
  completedCount = 0,
}) => {
  const syncedText = lastSyncedAt
    ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : null;
  if (loading) {
    return (
      <View style={[
        styles.emptyContainer,
        isDesktop && styles.emptyContainerDesktop
      ]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[
          styles.emptyText,
          { color: colors.textSecondary, marginTop: 12 },
          isDesktop && styles.emptyTextDesktop
        ]}>
          Loading polls...
        </Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[
        styles.emptyContainer,
        isDesktop && styles.emptyContainerDesktop
      ]}>
        <Ionicons
          name="warning-outline"
          size={isDesktop ? 80 : 64}
          color={colors.error}
        />
        <Text style={[
          styles.emptyText,
          { color: colors.error, marginTop: 12 },
          isDesktop && styles.emptyTextDesktop
        ]}>
          Failed to load polls
        </Text>
        <Text style={[
          styles.emptyText,
          { fontSize: 14, marginTop: 8, color: colors.textSecondary },
          isDesktop && styles.emptyTextDesktop
        ]}>
          {loadError}
        </Text>
        <TouchableOpacity
          style={[
            styles.retryButton,
            { backgroundColor: colors.primary + '20', marginTop: 16 }
          ]}
          onPress={onRetry}
        >
          <Text style={[
            styles.retryButtonText,
            { color: colors.primary }
          ]}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Loaded successfully, but this tab has nothing. Show enough context that the
  // user can trust it's genuinely empty and not a silent failure.
  const otherCount = activeTab === 'active' ? completedCount : activeCount;
  const otherLabel = activeTab === 'active' ? 'completed' : 'active';

  return (
    <View style={[
      styles.emptyContainer,
      isDesktop && styles.emptyContainerDesktop
    ]}>
      <Ionicons
        name={activeTab === 'active' ? 'megaphone-outline' : 'checkmark-done-outline'}
        size={isDesktop ? 80 : 64}
        color={colors.textSecondary}
      />
      <Text style={[
        styles.emptyText,
        { color: colors.text, fontWeight: '600' },
        isDesktop && styles.emptyTextDesktop
      ]}>
        {activeTab === 'active' ? 'No active polls' : 'No completed polls'}
      </Text>
      <Text style={[
        styles.emptyText,
        { fontSize: 14, marginTop: 6, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 24 },
      ]}>
        {totalPollCount === 0
          ? 'This chama has not created any polls yet.'
          : `This chama has ${totalPollCount} poll${totalPollCount === 1 ? '' : 's'}${
              otherCount > 0 ? ` — ${otherCount} ${otherLabel}.` : `, none ${otherLabel}.`
            }`}
      </Text>
      {syncedText ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <Ionicons name="checkmark-circle" size={13} color={colors.success} />
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>{syncedText}</Text>
        </View>
      ) : null}
      {onRetry ? (
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary + '15', marginTop: 16 }]}
          onPress={onRetry}
        >
          <Text style={[styles.retryButtonText, { color: colors.primary, fontSize: 14 }]}>Refresh</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyContainerDesktop: {
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  emptyTextDesktop: {
    fontSize: 18,
    marginTop: 20,
    marginBottom: 32,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EmptyState;
