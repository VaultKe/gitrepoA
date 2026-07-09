import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePerformanceMonitoring } from '../hooks/useLightningData';
import { getThemeColors } from '../utils/theme';

const PerformanceMonitor = ({ theme = 'dark', visible, onClose }) => {
  const { metrics, clearCaches } = usePerformanceMonitoring();
  const [refreshKey, setRefreshKey] = useState(0);
  const colors = getThemeColors(theme);

  useEffect(() => {
    if (visible) {
      const interval = setInterval(() => {
        setRefreshKey(prev => prev + 1);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [visible]);

  if (!metrics) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Performance Monitor</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading performance metrics...
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  const { lightning, combined } = metrics;

  const formatPercentage = (value) => `${(value || 0).toFixed(1)}%`;
  const formatTime = (value) => `${(value || 0).toFixed(0)}ms`;
  const formatNumber = (value) => (value || 0).toLocaleString();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>⚡ Performance Monitor</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Overall Performance */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              🎯 Overall Performance
            </Text>
            <View style={styles.metricsGrid}>
              <MetricCard
                title="Cache Hit Rate"
                value={formatPercentage(combined.totalCacheHitRate)}
                icon="flash"
                color={combined.totalCacheHitRate > 80 ? colors.success : colors.warning}
                theme={colors}
              />
              <MetricCard
                title="Avg Load Time"
                value={formatTime(combined.averageLoadTime)}
                icon="time"
                color={combined.averageLoadTime < 100 ? colors.success : colors.warning}
                theme={colors}
              />
            </View>
          </View>

          {/* Lightning Data Service */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              ⚡ Lightning Data Service
            </Text>
            <View style={styles.metricsGrid}>
              <MetricCard
                title="Cache Hits"
                value={formatNumber(lightning.cacheHits)}
                icon="checkmark-circle"
                color={colors.success}
                theme={colors}
              />
              <MetricCard
                title="Cache Misses"
                value={formatNumber(lightning.cacheMisses)}
                icon="close-circle"
                color={colors.error}
                theme={colors}
              />
              <MetricCard
                title="API Calls"
                value={formatNumber(lightning.apiCalls)}
                icon="cloud"
                color={colors.primary}
                theme={colors}
              />
              <MetricCard
                title="Memory Cache"
                value={formatNumber(lightning.memoryCacheSize)}
                icon="hardware-chip"
                color={colors.info}
                theme={colors}
              />
            </View>
            
            <View style={styles.metricsRow}>
              <MetricCard
                title="Optimistic Updates"
                value={formatNumber(lightning.optimisticUpdates)}
                icon="trending-up"
                color={colors.success}
                theme={colors}
                style={styles.halfWidth}
              />
              <MetricCard
                title="Rollbacks"
                value={formatNumber(lightning.rollbacks)}
                icon="arrow-undo"
                color={lightning.rollbacks > 0 ? colors.warning : colors.success}
                theme={colors}
                style={styles.halfWidth}
              />
            </View>
          </View>

          {/* Actions */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              🛠️ Actions
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.error + '20', borderColor: colors.error }]}
              onPress={clearCaches}
            >
              <Ionicons name="trash" size={20} color={colors.error} />
              <Text style={[styles.actionButtonText, { color: colors.error }]}>
                Clear All Caches
              </Text>
            </TouchableOpacity>
          </View>

          {/* Performance Tips */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              💡 Performance Tips
            </Text>
            <View style={styles.tipsList}>
              <PerformanceTip
                icon="flash"
                text="Cache hit rate above 80% indicates excellent performance"
                color={colors.success}
                theme={colors}
              />
              <PerformanceTip
                icon="time"
                text="Load times under 100ms provide instant user experience"
                color={colors.info}
                theme={colors}
              />
              <PerformanceTip
                icon="trending-up"
                text="Optimistic updates improve perceived performance"
                color={colors.primary}
                theme={colors}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const MetricCard = ({ title, value, icon, color, theme, style }) => (
  <View style={[styles.metricCard, { borderColor: color + '30' }, style]}>
    <View style={styles.metricHeader}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.metricTitle, { color: theme.textSecondary }]}>{title}</Text>
    </View>
    <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
  </View>
);

const PerformanceTip = ({ icon, text, color, theme }) => (
  <View style={styles.tip}>
    <Ionicons name={icon} size={16} color={color} style={styles.tipIcon} />
    <Text style={[styles.tipText, { color: theme.textSecondary }]}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  section: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  halfWidth: {
    flex: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricTitle: {
    fontSize: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  tipsList: {
    gap: 8,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default PerformanceMonitor;
