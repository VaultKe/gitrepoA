import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, createThemedStyles } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import ApiService from '../../../services/api';

const { width } = Dimensions.get('window');

const createStyles = createThemedStyles((colors, spacing, typography, shadows) => ({
  statsSection: {
    paddingHorizontal: spacing.md,
    marginVertical: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  statTileContainer: {
    flex: 1,
    marginHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  statTile: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    height: '100%',
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  statTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statTileIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  statTileLabel: {
    fontSize: typography.fontSize.sm,
    flex: 1,
    color: colors.textSecondary,
  },
  statTileValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  sectionContainer: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.md,
    color: colors.text,
  },
  section: {
    marginBottom: spacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionItem: {
    width: `${100 / 4 - 2}%`,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  actionText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    color: colors.text,
  },
  lastActionContainer: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  lastActionTouchable: {
    alignItems: 'center',
  },
}));



export default function AdminHomepage() {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const navigation = useNavigation();
  const themedStyles = createStyles(theme);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeChamas: 0,
    totalTransactions: 0,
    systemHealth: 0,
  });

  useEffect(() => {
    // Load admin statistics on component mount
    loadAdminStatistics();
  }, []);

  const loadAdminStatistics = async () => {
    try {
      const response = await ApiService.getAdminStatistics();
      if (response.success) {
        const { user_stats, chama_stats, transaction_stats, system_health } = response.data;

        setStats({
          totalUsers: user_stats?.total_users || 0,
          activeChamas: chama_stats?.active_chamas || 0,
          totalTransactions: transaction_stats?.total_transactions || 0,
          systemHealth: system_health || 0,
        });
      }
    } catch (error) {

    }
  };

  const quickActions = [
    {
      id: 1,
      title: 'User Management',
      icon: 'people',
      color: colors.primary,
      action: () => navigation.navigate('UserManagementScreen'),
    },
    {
      id: 2,
      title: 'Chama Management',
      icon: 'business',
      color: colors.secondary,
      action: () => navigation.navigate('ChamaManagementScreen'),
    },
    {
      id: 3,
      title: 'System Analytics',
      icon: 'analytics',
      color: colors.accent,
      action: () => navigation.navigate('SystemAnalyticsScreen'),
    },
    {
      id: 4,
      title: 'Security Center',
      icon: 'shield-checkmark',
      color: colors.success,
      action: () => navigation.navigate('SecurityCenterScreen'),
    },
    {
      id: 5,
      title: 'Payment System',
      icon: 'card',
      color: colors.warning,
      action: () => navigation.navigate('PaymentSystemScreen'),
    },
    {
      id: 6,
      title: 'Learning Hub',
      icon: 'school',
      color: colors.info,
      action: () => navigation.navigate('LearningManagementScreen'),
    },
    {
      id: 7,
      title: 'Support Center',
      icon: 'help-circle',
      color: colors.primary,
      action: () => navigation.navigate('AdminSupport'),
    },
    {
      id: 8,
      title: 'Backup & Maintenance',
      icon: 'server',
      color: colors.error,
      action: () => navigation.navigate('BackupMaintenanceScreen'),
    },
    {
      id: 9,
      title: 'Admin Settings',
      icon: 'settings',
      color: colors.secondary,
      action: () => navigation.navigate('AdminSettingsScreen'),
    },
    {
      id: 10,
      title: 'Financial Reports',
      icon: 'document-text',
      color: colors.accent,
      action: () => navigation.navigate('FinancialReportsScreen'),
    },
    {
      id: 11,
      title: 'Logo Showcase',
      icon: 'diamond',
      color: '#EC4899',
      action: () => navigation.navigate('LogoShowcase'),
    },
    {
      id: 11,
      title: 'Notifications',
      icon: 'notifications',
      color: colors.warning,
      action: () => navigation.navigate('NotificationManagementScreen'),
    },
    {
      id: 12,
      title: 'Audit Logs',
      icon: 'list',
      color: colors.info,
      action: () => navigation.navigate('AuditLogsScreen'),
    },
    {
      id: 13,
      title: 'System Health',
      icon: 'pulse',
      color: colors.success,
      action: () => navigation.navigate('SystemHealthScreen'),
    },
    {
      id: 14,
      title: 'API Management',
      icon: 'code-slash',
      color: colors.primary,
      action: () => navigation.navigate('APIManagementScreen'),
    },
    {
      id: 15,
      title: 'Content Moderation',
      icon: 'eye',
      color: colors.error,
      action: () => navigation.navigate('ContentModerationScreen'),
    },
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Reload admin statistics
      await loadAdminStatistics();
    } catch (error) {

    } finally {
      setRefreshing(false);
    }
  };

  const handleQuickAction = (action) => {
    if (action.action) {
      action.action();
    }
  };

  const mainActions = quickActions.slice(0, -1);
  const lastAction = quickActions[quickActions.length - 1];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Header */}

      {/* Overview Stats */}
      <View style={themedStyles.statsSection}>
        <Text style={themedStyles.sectionTitle}>
          Overview
        </Text>
        <View style={themedStyles.statsRow}>
          <View style={themedStyles.statTileContainer}>
            <View style={themedStyles.statTile}>
              <View style={themedStyles.statTileHeader}>
                <View style={[themedStyles.statTileIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="people" size={20} color={colors.primary} />
                </View>
                <Text style={themedStyles.statTileLabel}>Total Users</Text>
              </View>
              <Text style={themedStyles.statTileValue}>{stats.totalUsers.toLocaleString()}</Text>
            </View>
          </View>
          <View style={themedStyles.statTileContainer}>
            <View style={themedStyles.statTile}>
              <View style={themedStyles.statTileHeader}>
                <View style={[themedStyles.statTileIcon, { backgroundColor: colors.secondary + '15' }]}>
                  <Ionicons name="business" size={20} color={colors.secondary} />
                </View>
                <Text style={themedStyles.statTileLabel}>Active Chamas</Text>
              </View>
              <Text style={themedStyles.statTileValue}>{stats.activeChamas}</Text>
            </View>
          </View>
        </View>
        <View style={themedStyles.statsRow}>
          <View style={themedStyles.statTileContainer}>
            <View style={themedStyles.statTile}>
              <View style={themedStyles.statTileHeader}>
                <View style={[themedStyles.statTileIcon, { backgroundColor: colors.info + '15' }]}>
                  <Ionicons name="receipt" size={20} color={colors.info} />
                </View>
                <Text style={themedStyles.statTileLabel}>Transactions</Text>
              </View>
              <Text style={themedStyles.statTileValue}>{stats.totalTransactions.toLocaleString()}</Text>
            </View>
          </View>
          <View style={themedStyles.statTileContainer}>
            <View style={themedStyles.statTile}>
              <View style={themedStyles.statTileHeader}>
                <View style={[themedStyles.statTileIcon, { backgroundColor: colors.success + '15' }]}>
                  <Ionicons name="heart" size={20} color={colors.success} />
                </View>
                <Text style={themedStyles.statTileLabel}>System Health</Text>
              </View>
              <Text style={themedStyles.statTileValue}>{stats.systemHealth}%</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={themedStyles.sectionContainer}>
        <Card style={[themedStyles.section, { backgroundColor: colors.surface }]}>
          <Text style={themedStyles.sectionTitle}>
            Quick Actions
          </Text>
        <View style={themedStyles.actionsGrid}>
          {mainActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={themedStyles.actionItem}
              onPress={action.onPress}
            >
              <View style={themedStyles.actionIcon}>
                <Ionicons name={action.icon} size={24} color={action.color} />
              </View>
              <Text style={themedStyles.actionText}>
                {action.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={themedStyles.lastActionContainer}>
          <TouchableOpacity
            onPress={() => handleQuickAction(lastAction)}
            style={themedStyles.lastActionTouchable}
          >
            <View style={themedStyles.actionIcon}>
              <Ionicons name={lastAction.icon} size={24} color={lastAction.color} />
            </View>
            <Text style={themedStyles.actionText}>
              {lastAction.title}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    </View>
  </ScrollView>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
