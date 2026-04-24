import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import Card from '../../components/common/Card';
import BorderedButton from '../../components/BorderedButton';
import { ButtonGrid } from '../../components/ButtonGroup';

const SystemHealthScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const [refreshing, setRefreshing] = useState(false);
  const [systemHealth, setSystemHealth] = useState({
    overallHealth: 98.5,
    uptime: '99.9%',
    responseTime: '45ms',
    activeUsers: 1247,
    services: [
      { name: 'API Gateway', status: 'healthy', uptime: '99.9%', responseTime: '12ms' },
      { name: 'Database', status: 'healthy', uptime: '99.8%', responseTime: '8ms' },
      { name: 'Authentication', status: 'healthy', uptime: '100%', responseTime: '15ms' },
      { name: 'Payment System', status: 'warning', uptime: '98.5%', responseTime: '120ms' },
      { name: 'File Storage', status: 'healthy', uptime: '99.7%', responseTime: '25ms' },
      { name: 'Notification Service', status: 'healthy', uptime: '99.9%', responseTime: '18ms' },
    ],
    alerts: [
      { type: 'warning', message: 'Payment system response time elevated', time: '5 min ago' },
      { type: 'info', message: 'Database maintenance scheduled for tonight', time: '2 hours ago' },
    ],
  });

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate data refresh
    setTimeout(() => {
      setSystemHealth({
        ...systemHealth,
        overallHealth: Math.floor(Math.random() * 5) + 95,
        activeUsers: Math.floor(Math.random() * 500) + 1000,
      });
      setRefreshing(false);
    }, 1500);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return colors.success;
      case 'warning': return colors.warning;
      case 'error': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return 'checkmark-circle';
      case 'warning': return 'warning';
      case 'error': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'warning': return 'warning';
      case 'error': return 'alert-circle';
      case 'info': return 'information-circle';
      default: return 'help-circle';
    }
  };

  const getAlertColor = (type) => {
    switch (type) {
      case 'warning': return colors.warning;
      case 'error': return colors.error;
      case 'info': return colors.info;
      default: return colors.textSecondary;
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Content starts here - header handled by navigator */}

      {/* Overall Health */}
      <View style={styles.section}>
        <Card style={[styles.healthCard, { backgroundColor: colors.surface }]}>
          <View style={styles.healthHeader}>
            <View style={[styles.healthIcon, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="pulse" size={32} color={colors.success} />
            </View>
            <View style={styles.healthInfo}>
              <Text style={[styles.healthTitle, { color: colors.text }]}>
                Overall System Health
              </Text>
              <Text style={[styles.healthValue, { color: colors.success }]}>
                {systemHealth.overallHealth}%
              </Text>
            </View>
          </View>
          <View style={styles.healthStats}>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Uptime
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {systemHealth.uptime}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Response Time
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {systemHealth.responseTime}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Active Users
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {systemHealth.activeUsers.toLocaleString()}
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* Services Status */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Services Status
        </Text>
        <Card style={[styles.servicesCard, { backgroundColor: colors.surface }]}>
          {systemHealth.services.map((service, index) => (
            <View key={index} style={styles.serviceItem}>
              <View style={styles.serviceInfo}>
                <View style={styles.serviceHeader}>
                  <Ionicons
                    name={getStatusIcon(service.status)}
                    size={20}
                    color={getStatusColor(service.status)}
                  />
                  <Text style={[styles.serviceName, { color: colors.text }]}>
                    {service.name}
                  </Text>
                </View>
                <View style={styles.serviceStats}>
                  <Text style={[styles.serviceUptime, { color: colors.textSecondary }]}>
                    Uptime: {service.uptime}
                  </Text>
                  <Text style={[styles.serviceResponse, { color: colors.textSecondary }]}>
                    Response: {service.responseTime}
                  </Text>
                </View>
              </View>
              <View style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(service.status) + '20' }
              ]}>
                <Text style={[
                  styles.statusText,
                  { color: getStatusColor(service.status) }
                ]}>
                  {service.status.toUpperCase()}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      </View>

      {/* Recent Alerts */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Recent Alerts
        </Text>
        <Card style={[styles.alertsCard, { backgroundColor: colors.surface }]}>
          {systemHealth.alerts.map((alert, index) => (
            <View key={index} style={styles.alertItem}>
              <Ionicons
                name={getAlertIcon(alert.type)}
                size={20}
                color={getAlertColor(alert.type)}
              />
              <View style={styles.alertContent}>
                <Text style={[styles.alertMessage, { color: colors.text }]}>
                  {alert.message}
                </Text>
                <Text style={[styles.alertTime, { color: colors.textSecondary }]}>
                  {alert.time}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Quick Actions
        </Text>
        <ButtonGrid spacing={8}>
          <BorderedButton
            title="Restart Services"
            icon="refresh"
            variant="primary"
            size="small"
            onPress={() => console.log('Restart Services')}
            theme={theme}
            style={styles.actionButtonBordered}
          />
          <BorderedButton
            title="System Config"
            icon="settings"
            variant="secondary"
            size="small"
            onPress={() => console.log('System Config')}
            theme={theme}
            style={styles.actionButtonBordered}
          />
          <BorderedButton
            title="Download Logs"
            icon="download"
            variant="info"
            size="small"
            onPress={() => console.log('Download Logs')}
            theme={theme}
            style={styles.actionButtonBordered}
          />
          <BorderedButton
            title="View Metrics"
            icon="analytics"
            variant="success"
            size="small"
            onPress={() => console.log('View Metrics')}
            theme={theme}
            style={styles.actionButtonBordered}
          />
        </ButtonGrid>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  healthCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  healthIcon: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  healthInfo: {
    flex: 1,
  },
  healthTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  healthValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
  },
  healthStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  servicesCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  serviceName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
  },
  serviceStats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  serviceUptime: {
    fontSize: typography.fontSize.sm,
  },
  serviceResponse: {
    fontSize: typography.fontSize.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  alertsCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  alertContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  alertMessage: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.xs,
  },
  alertTime: {
    fontSize: typography.fontSize.sm,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  actionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  // BorderedButton styles - RESPONSIVE
  actionButtonBordered: {
    width: '48%',
    marginBottom: spacing.md,
    maxWidth: 160,
  },
});

export default SystemHealthScreen;
