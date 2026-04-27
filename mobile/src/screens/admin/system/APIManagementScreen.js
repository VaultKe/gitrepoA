import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import BorderedButton from '../../../components/BorderedButton';
import { ButtonGrid } from '../../../components/ButtonGroup';

const APIManagementScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const [refreshing, setRefreshing] = useState(false);
  const [apiData, setApiData] = useState({
    totalRequests: 125430,
    successRate: 99.2,
    averageResponseTime: 45,
    activeKeys: 23,
    endpoints: [
      { name: '/api/v1/auth/login', requests: 15420, status: 'active', responseTime: '12ms' },
      { name: '/api/v1/wallets/balance', requests: 8930, status: 'active', responseTime: '8ms' },
      { name: '/api/v1/chamas/list', requests: 7650, status: 'active', responseTime: '15ms' },
      { name: '/api/v1/transactions/create', requests: 6540, status: 'active', responseTime: '25ms' },
      { name: '/api/v1/users/profile', requests: 5430, status: 'active', responseTime: '10ms' },
    ],
    apiKeys: [
      { name: 'Mobile App', key: 'vk_live_***************', status: 'active', lastUsed: '2 min ago' },
      { name: 'Web Dashboard', key: 'vk_live_***************', status: 'active', lastUsed: '5 min ago' },
      { name: 'Third Party Integration', key: 'vk_test_***************', status: 'inactive', lastUsed: '2 days ago' },
    ],
  });

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => {
      setApiData({
        ...apiData,
        totalRequests: Math.floor(Math.random() * 50000) + 100000,
        successRate: Math.floor(Math.random() * 5) + 95,
      });
      setRefreshing(false);
    }, 1500);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return colors.success;
      case 'inactive': return colors.warning;
      case 'blocked': return colors.error;
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

      {/* API Overview - User Dashboard Style */}
      <Card style={styles.statsCard}>
        <View style={styles.statsGrid}>
          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statTileHeader}>
              <View style={[styles.statTileIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="flash" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.statTileLabel, { color: colors.textSecondary }]}>
                Total Requests
              </Text>
            </View>
            <Text style={[styles.statTileValue, { color: colors.text }]}>
              {apiData.totalRequests.toLocaleString()}
            </Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statTileHeader}>
              <View style={[styles.statTileIcon, { backgroundColor: colors.success + '15' }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              </View>
              <Text style={[styles.statTileLabel, { color: colors.textSecondary }]}>
                Success Rate
              </Text>
            </View>
            <Text style={[styles.statTileValue, { color: colors.text }]}>
              {apiData.successRate}%
            </Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statTileHeader}>
              <View style={[styles.statTileIcon, { backgroundColor: colors.info + '15' }]}>
                <Ionicons name="time" size={20} color={colors.info} />
              </View>
              <Text style={[styles.statTileLabel, { color: colors.textSecondary }]}>
                Avg Response
              </Text>
            </View>
            <Text style={[styles.statTileValue, { color: colors.text }]}>
              {apiData.averageResponseTime}ms
            </Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statTileHeader}>
              <View style={[styles.statTileIcon, { backgroundColor: colors.accent + '15' }]}>
                <Ionicons name="key" size={20} color={colors.accent} />
              </View>
              <Text style={[styles.statTileLabel, { color: colors.textSecondary }]}>
                Active Keys
              </Text>
            </View>
            <Text style={[styles.statTileValue, { color: colors.text }]}>
              {apiData.activeKeys}
            </Text>
          </View>
        </View>
      </Card>

      {/* Top Endpoints */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Top Endpoints
        </Text>
        <Card style={[styles.endpointsCard, { backgroundColor: colors.surface }]}>
          {apiData.endpoints.map((endpoint, index) => (
            <View key={index} style={styles.endpointItem}>
              <View style={styles.endpointInfo}>
                <Text style={[styles.endpointName, { color: colors.text }]}>
                  {endpoint.name}
                </Text>
                <View style={styles.endpointStats}>
                  <Text style={[styles.endpointRequests, { color: colors.textSecondary }]}>
                    {endpoint.requests.toLocaleString()} requests
                  </Text>
                  <Text style={[styles.endpointResponse, { color: colors.textSecondary }]}>
                    {endpoint.responseTime}
                  </Text>
                </View>
              </View>
              <View style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(endpoint.status) + '20' }
              ]}>
                <Text style={[
                  styles.statusText,
                  { color: getStatusColor(endpoint.status) }
                ]}>
                  {endpoint.status.toUpperCase()}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      </View>

      {/* API Keys */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          API Keys
        </Text>
        <Card style={[styles.keysCard, { backgroundColor: colors.surface }]}>
          {apiData.apiKeys.map((key, index) => (
            <View key={index} style={styles.keyItem}>
              <View style={styles.keyInfo}>
                <Text style={[styles.keyName, { color: colors.text }]}>
                  {key.name}
                </Text>
                <Text style={[styles.keyValue, { color: colors.textSecondary }]}>
                  {key.key}
                </Text>
                <Text style={[styles.keyLastUsed, { color: colors.textSecondary }]}>
                  Last used: {key.lastUsed}
                </Text>
              </View>
              <View style={styles.keyActions}>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(key.status) + '20' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: getStatusColor(key.status) }
                  ]}>
                    {key.status.toUpperCase()}
                  </Text>
                </View>
                <BorderedButton
                  icon="trash"
                  iconPosition="only"
                  variant="danger"
                  size="small"
                  theme={theme}
                  style={styles.revokeButtonBordered}
                />
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
            title="Generate Key"
            icon="add"
            variant="primary"
            size="small"
            theme={theme}
            style={styles.actionButtonBordered}
          />
          <BorderedButton
            title="View Analytics"
            icon="analytics"
            variant="secondary"
            size="small"
            theme={theme}
            style={styles.actionButtonBordered}
          />
          <BorderedButton
            title="Rate Limits"
            icon="settings"
            variant="warning"
            size="small"
            theme={theme}
            style={styles.actionButtonBordered}
          />
          <BorderedButton
            title="Documentation"
            icon="document-text"
            variant="info"
            size="small"
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
  },
  endpointsCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  endpointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  endpointInfo: {
    flex: 1,
  },
  endpointName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  endpointStats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  endpointRequests: {
    fontSize: typography.fontSize.sm,
  },
  endpointResponse: {
    fontSize: typography.fontSize.sm,
  },
  keysCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  keyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  keyInfo: {
    flex: 1,
  },
  keyName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  keyValue: {
    fontSize: typography.fontSize.sm,
    fontFamily: 'monospace',
    marginBottom: spacing.xs,
  },
  keyLastUsed: {
    fontSize: typography.fontSize.sm,
  },
  keyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  revokeButton: {
    padding: spacing.sm,
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
  revokeButtonBordered: {
    width: 28,
    height: 28,
    minWidth: 24,
    maxWidth: 32,
  },
});

export default APIManagementScreen;
