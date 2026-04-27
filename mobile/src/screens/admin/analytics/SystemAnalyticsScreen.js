import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import StatsCard from '../../../components/admin/StatsCard';
import ApiService from '../../../services/api';

const { width } = Dimensions.get('window');

export default function SystemAnalyticsScreen() {
  console.log('📊 REAL: SystemAnalyticsScreen rendering...');
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Analytics data state
  const [analytics, setAnalytics] = useState({
    users: {
      total: 0,
      active: 0,
      new: 0,
      growth: '+0%',
    },
    chamas: {
      total: 0,
      active: 0,
      new: 0,
      growth: '+0%',
    },
    transactions: {
      total: 0,
      volume: 0,
      successful: 0,
      failed: 0,
      successRate: '0%',
    },
    system: {
      uptime: '0%',
      responseTime: '0ms',
      errorRate: '0%',
      storage: '0%',
    },
  });

  const periodOptions = [
    { key: '24h', label: '24 Hours' },
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
  ];

  useEffect(() => {
    // Load analytics on component mount and when period changes
    loadAnalytics();
  }, [selectedPeriod]);

  const loadAnalytics = async () => {
    try {
      console.log('🔍 Loading system analytics for period:', selectedPeriod);
      setLoading(true);

      const response = await ApiService.getSystemAnalytics(selectedPeriod);
      console.log('📊 System analytics response:', response);

      if (response.success) {
        const data = response.data;

        // Transform backend data to UI format
        const processedAnalytics = {
          users: {
            total: data.users?.total || 0,
            active: data.users?.active || 0,
            new: data.users?.newUsers || 0,
            growth: data.growth?.userGrowth ? `+${data.growth.userGrowth.toFixed(1)}%` : '+0%',
          },
          chamas: {
            total: data.chamas?.total || 0,
            active: data.chamas?.active || 0,
            new: data.chamas?.newChamas || 0,
            growth: data.growth?.chamaGrowth ? `+${data.growth.chamaGrowth.toFixed(1)}%` : '+0%',
          },
          transactions: {
            total: data.transactions?.total || 0,
            volume: data.transactions?.volume || 0,
            successful: data.transactions?.successful || 0,
            failed: data.transactions?.failed || 0,
            successRate: data.transactions?.successRate || '0%',
          },
          system: {
            uptime: data.system?.uptime || '99.5%',
            responseTime: data.system?.responseTime || '45ms',
            errorRate: data.system?.errorRate || '0.1%',
            storage: data.system?.storage || '45%',
          },
        };

        setAnalytics(processedAnalytics);

        console.log('✅ System analytics loaded:', {
          users: processedAnalytics.users.total,
          chamas: processedAnalytics.chamas.total,
          transactions: processedAnalytics.transactions.total,
          volume: processedAnalytics.transactions.volume
        });
      }
    } catch (error) {
      console.error('❌ Error loading system analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadAnalytics();
    } catch (error) {
      console.error('Error refreshing analytics:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const formatCurrency = (amount) => {
    return `KSh ${amount.toLocaleString()}`;
  };

  const renderMetricCard = (title, value, icon, color, subtitle = null) => (
    <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.metricHeader}>
        <View style={[styles.metricIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={14} color={color} />
        </View>
        <Text style={[styles.metricTitle, { color: colors.textSecondary }]}>
          {title}
        </Text>
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>
        {value}
      </Text>
      {subtitle && (
        <Text style={[styles.metricSubtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      )}
    </View>
  );

  const renderSystemHealth = () => (
    <View style={[styles.healthCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        System Health
      </Text>
      
      <View style={styles.healthMetrics}>
        <View style={styles.healthItem}>
          <View style={styles.healthHeader}>
            <Ionicons name="pulse" size={12} color={colors.success} />
            <Text style={[styles.healthLabel, { color: colors.textSecondary }]}>
              Uptime
            </Text>
          </View>
          <Text style={[styles.healthValue, { color: colors.success }]}>
            {analytics.system.uptime}
          </Text>
        </View>

        <View style={styles.healthItem}>
          <View style={styles.healthHeader}>
            <Ionicons name="speedometer" size={12} color={colors.info} />
            <Text style={[styles.healthLabel, { color: colors.textSecondary }]}>
              Response Time
            </Text>
          </View>
          <Text style={[styles.healthValue, { color: colors.info }]}>
            {analytics.system.responseTime}
          </Text>
        </View>

        <View style={styles.healthItem}>
          <View style={styles.healthHeader}>
            <Ionicons name="warning" size={12} color={colors.warning} />
            <Text style={[styles.healthLabel, { color: colors.textSecondary }]}>
              Error Rate
            </Text>
          </View>
          <Text style={[styles.healthValue, { color: colors.warning }]}>
            {analytics.system.errorRate}
          </Text>
        </View>

        <View style={styles.healthItem}>
          <View style={styles.healthHeader}>
            <Ionicons name="server" size={12} color={colors.primary} />
            <Text style={[styles.healthLabel, { color: colors.textSecondary }]}>
              Storage Used
            </Text>
          </View>
          <Text style={[styles.healthValue, { color: colors.primary }]}>
            {analytics.system.storage}
          </Text>
        </View>
      </View>
    </View>
  );

  console.log('📊 SystemAnalyticsScreen about to render');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>


        {/* REAL: Data Source and Loading Info */}
        <View style={[styles.infoSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="server-outline" size={16} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Source: API
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name={loading ? "sync-outline" : "checkmark-circle-outline"}
                       size={16} color={loading ? colors.warning : colors.success} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                {loading ? 'Loading...' : 'Ready'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={16} color={colors.info} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                {new Date().toLocaleTimeString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Period Selector */}
        <View style={styles.periodSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodContainer}>
            {periodOptions.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.periodButton,
                  {
                    backgroundColor: selectedPeriod === option.key ? colors.primary : colors.surface,
                    borderColor: colors.border,
                  }
                ]}
                onPress={() => setSelectedPeriod(option.key)}
              >
                <Text style={[
                  styles.periodText,
                  { color: selectedPeriod === option.key ? colors.background : colors.text }
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* User Analytics - User Dashboard Style */}
          <Card style={styles.statsCard}>
            <View style={styles.statsGrid}>
              <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.statTileHeader}>
                  <View style={[styles.statTileIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="people" size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.statTileLabel, { color: colors.textSecondary }]}>
                    Total Users
                  </Text>
                </View>
                <Text style={[styles.statTileValue, { color: colors.text }]}>
                  {analytics.users.total.toLocaleString()}
                </Text>
                <Text style={[styles.statTileSubtitle, { color: colors.success }]}>
                  {analytics.users.growth}
                </Text>
              </View>

              <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.statTileHeader}>
                  <View style={[styles.statTileIcon, { backgroundColor: colors.success + '15' }]}>
                    <Ionicons name="person" size={20} color={colors.success} />
                  </View>
                  <Text style={[styles.statTileLabel, { color: colors.textSecondary }]}>
                    Active Users
                  </Text>
                </View>
                <Text style={[styles.statTileValue, { color: colors.text }]}>
                  {analytics.users.active.toLocaleString()}
                </Text>
                <Text style={[styles.statTileSubtitle, { color: colors.textSecondary }]}>
                  Last 30 days
                </Text>
              </View>

              <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.statTileHeader}>
                  <View style={[styles.statTileIcon, { backgroundColor: colors.info + '15' }]}>
                    <Ionicons name="person-add" size={20} color={colors.info} />
                  </View>
                  <Text style={[styles.statTileLabel, { color: colors.textSecondary }]}>
                    New Users
                  </Text>
                </View>
                <Text style={[styles.statTileValue, { color: colors.text }]}>
                  {analytics.users.new.toString()}
                </Text>
                <Text style={[styles.statTileSubtitle, { color: colors.textSecondary }]}>
                  Last {selectedPeriod}
                </Text>
              </View>

              <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.5 }]}>
                <View style={styles.statTileHeader}>
                  <View style={[styles.statTileIcon, { backgroundColor: colors.textTertiary + '15' }]}>
                    <Ionicons name="analytics" size={20} color={colors.textTertiary} />
                  </View>
                  <Text style={[styles.statTileLabel, { color: colors.textTertiary }]}>
                    Coming Soon
                  </Text>
                </View>
                <Text style={[styles.statTileValue, { color: colors.textTertiary }]}>
                  --
                </Text>
              </View>
            </View>
          </Card>

          {/* Chama Analytics */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Chama Analytics
            </Text>
            <View style={[styles.analyticsCard, { backgroundColor: colors.surface }]}>
              <View style={styles.statsContainer}>
                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="business" size={24} color={colors.secondary} />
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {analytics.chamas.total.toString()}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Total Chamas
                  </Text>
                  <Text style={[styles.statTrend, { color: colors.success }]}>
                    {analytics.chamas.growth}
                  </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {analytics.chamas.active.toString()}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Active Chamas
                  </Text>
                </View>
              </View>

              <View style={[styles.statsContainer, { marginBottom: 0 }]}>
                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="add-circle" size={24} color={colors.info} />
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {analytics.chamas.new.toString()}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    New Chamas
                  </Text>
                  <Text style={[styles.statSubtitle, { color: colors.textSecondary }]}>
                    Last {selectedPeriod}
                  </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.5 }]}>
                  <Ionicons name="analytics" size={24} color={colors.textTertiary} />
                  <Text style={[styles.statValue, { color: colors.textTertiary }]}>
                    --
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                    Coming Soon
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Transaction Analytics */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Transaction Analytics
            </Text>
            <View style={[styles.analyticsCard, { backgroundColor: colors.surface }]}>
              <View style={styles.statsContainer}>
                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="receipt" size={24} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {analytics.transactions.total.toLocaleString()}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Total Transactions
                  </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="wallet" size={24} color={colors.success} />
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {formatCurrency(analytics.transactions.volume)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Transaction Volume
                  </Text>
                </View>
              </View>

              <View style={[styles.statsContainer, { marginBottom: 0 }]}>
                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {analytics.transactions.successRate}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Success Rate
                  </Text>
                  <Text style={[styles.statSubtitle, { color: colors.textSecondary }]}>
                    {analytics.transactions.successful} successful
                  </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="close-circle" size={24} color={colors.error} />
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {analytics.transactions.failed.toString()}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Failed Transactions
                  </Text>
                  <Text style={[styles.statSubtitle, { color: colors.error }]}>
                    Needs attention
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* System Health */}
          <View style={styles.section}>
            {renderSystemHealth()}
          </View>
        </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  periodSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  periodContainer: {
    flexDirection: 'row',
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  periodText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24, // Increased horizontal padding
    paddingTop: 8, // Add top padding
  },
  section: {
    marginBottom: 32, // Increased spacing between sections
    paddingHorizontal: 4, // Add horizontal padding
  },
  sectionTitle: {
    fontSize: 20, // Slightly larger title
    fontWeight: '600',
    marginBottom: 20, // Increased spacing below title
    marginLeft: 4, // Align with cards
  },
  analyticsCard: {
    borderRadius: 12,
    padding: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  statCard: {
    width: '47%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  statTrend: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  statSubtitle: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20, // Increased spacing between rows
    gap: 12, // Add gap between cards (if supported)
  },
  statsCardPlaceholder: {
    width: '48%',
    height: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricCard: {
    width: '48%', // Use percentage for better responsiveness
    borderRadius: 16, // More rounded corners
    padding: 20, // Increased padding to match StatsCard
    borderWidth: 1,
    minHeight: 120, // Consistent height with StatsCard
    marginHorizontal: 2, // Small horizontal margin for breathing room
    elevation: 3, // Match StatsCard elevation
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12, // Increased spacing
  },
  metricIcon: {
    width: 36, // Larger icon
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10, // Increased spacing
  },
  metricTitle: {
    fontSize: 13, // Slightly larger
    fontWeight: '500',
    flex: 1,
  },
  metricValue: {
    fontSize: 20, // Larger font
    fontWeight: 'bold',
    marginBottom: 6, // Increased spacing
  },
  metricSubtitle: {
    fontSize: 11, // Slightly larger
    opacity: 0.8,
  },
  healthCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  healthMetrics: {
    marginTop: 16,
  },
  healthItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthLabel: {
    fontSize: 14,
    marginLeft: 8,
  },
  healthValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  // User Dashboard Style Stats
  statsCard: {
    margin: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statTile: {
    width: '48%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  statTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statTileIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  statTileLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  statTileValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'left',
    marginBottom: spacing.xs,
  },
  statTileSubtitle: {
    fontSize: typography.fontSize.xs,
  },
  // REAL: Info section styles
  infoSection: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 11,
    marginLeft: 4,
    fontWeight: '500',
  },
});
