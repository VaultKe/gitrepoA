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
}) => {
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

  return (
    <View style={[
      styles.emptyContainer,
      isDesktop && styles.emptyContainerDesktop
    ]}>
      <Ionicons
        name="checkmark-circle-outline"
        size={isDesktop ? 80 : 64}
        color={colors.textSecondary}
      />
      <Text style={[
        styles.emptyText,
        { color: colors.textSecondary },
        isDesktop && styles.emptyTextDesktop
      ]}>
        No {activeTab} polls found
      </Text>
      <Text style={[
        styles.emptyText,
        { fontSize: 14, marginTop: 8 },
        isDesktop && styles.emptyTextDesktop
      ]}>
        {activeTab === 'active'
          ? 'Active polls will appear here'
          : 'Completed polls will appear here'}
      </Text>
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
