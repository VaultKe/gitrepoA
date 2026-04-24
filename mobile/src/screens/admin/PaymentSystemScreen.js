import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';

export default function PaymentSystemScreen() {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentGateways, setPaymentGateways] = useState([
    {
      id: 'mpesa',
      name: 'M-Pesa',
      status: 'active',
      enabled: true,
      transactionCount: 1247,
      successRate: 98.5,
      lastTransaction: '2024-01-20 15:30:00',
    },
    {
      id: 'airtel',
      name: 'Airtel Money',
      status: 'active',
      enabled: true,
      transactionCount: 456,
      successRate: 97.2,
      lastTransaction: '2024-01-20 14:45:00',
    },
    {
      id: 'equity',
      name: 'Equity Bank',
      status: 'maintenance',
      enabled: false,
      transactionCount: 234,
      successRate: 99.1,
      lastTransaction: '2024-01-20 10:15:00',
    },
  ]);

  const [systemSettings, setSystemSettings] = useState({
    autoReconciliation: true,
    failureRetry: true,
    notificationAlerts: true,
    fraudDetection: true,
    transactionLimits: true,
  });

  const [recentTransactions, setRecentTransactions] = useState([
    {
      id: '1',
      type: 'deposit',
      amount: 5000,
      gateway: 'M-Pesa',
      status: 'completed',
      timestamp: '2024-01-20 15:30:00',
      reference: 'MPX123456789',
    },
    {
      id: '2',
      type: 'withdrawal',
      amount: 2500,
      gateway: 'Airtel Money',
      status: 'pending',
      timestamp: '2024-01-20 15:25:00',
      reference: 'ATL987654321',
    },
    {
      id: '3',
      type: 'transfer',
      amount: 10000,
      gateway: 'M-Pesa',
      status: 'failed',
      timestamp: '2024-01-20 15:20:00',
      reference: 'MPX111222333',
    },
  ]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate data refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  };

  const toggleGateway = (gatewayId) => {
    Alert.alert(
      'Toggle Payment Gateway',
      'Are you sure you want to change the status of this payment gateway?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            setPaymentGateways(prev =>
              prev.map(gateway =>
                gateway.id === gatewayId
                  ? { ...gateway, enabled: !gateway.enabled }
                  : gateway
              )
            );
          },
        },
      ]
    );
  };

  const toggleSetting = (setting) => {
    setSystemSettings(prev => ({
      ...prev,
      [setting]: !prev[setting],
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return colors.success;
      case 'maintenance': return colors.warning;
      case 'inactive': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getTransactionStatusColor = (status) => {
    switch (status) {
      case 'completed': return colors.success;
      case 'pending': return colors.warning;
      case 'failed': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const formatCurrency = (amount) => {
    return `KSh ${amount.toLocaleString()}`;
  };

  const renderPaymentGateway = (gateway) => (
    <View
      key={gateway.id}
      style={[styles.gatewayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.gatewayHeader}>
        <View style={styles.gatewayInfo}>
          <Text style={[styles.gatewayName, { color: colors.text }]}>
            {gateway.name}
          </Text>
          <View style={styles.gatewayStatus}>
            <View style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(gateway.status) }
            ]} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              {gateway.status}
            </Text>
          </View>
        </View>
        <Switch
          value={gateway.enabled}
          onValueChange={() => toggleGateway(gateway.id)}
          trackColor={{ false: colors.border, true: colors.primary + '50' }}
          thumbColor={gateway.enabled ? colors.primary : colors.textSecondary}
        />
      </View>

      <View style={styles.gatewayStats}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {gateway.transactionCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Transactions
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {gateway.successRate}%
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Success Rate
          </Text>
        </View>
      </View>

      <Text style={[styles.lastTransaction, { color: colors.textSecondary }]}>
        Last transaction: {gateway.lastTransaction}
      </Text>
    </View>
  );

  const renderTransaction = (transaction) => (
    <View
      key={transaction.id}
      style={[styles.transactionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.transactionHeader}>
        <View style={styles.transactionInfo}>
          <View style={styles.transactionType}>
            <Ionicons
              name={
                transaction.type === 'deposit' ? 'arrow-down' :
                transaction.type === 'withdrawal' ? 'arrow-up' : 'swap-horizontal'
              }
              size={16}
              color={colors.primary}
            />
            <Text style={[styles.transactionTypeText, { color: colors.text }]}>
              {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
            </Text>
          </View>
          <Text style={[styles.transactionAmount, { color: colors.text }]}>
            {formatCurrency(transaction.amount)}
          </Text>
        </View>
        <View style={[
          styles.transactionStatus,
          { backgroundColor: getTransactionStatusColor(transaction.status) + '20' }
        ]}>
          <Text style={[
            styles.transactionStatusText,
            { color: getTransactionStatusColor(transaction.status) }
          ]}>
            {transaction.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.transactionMeta}>
        <Text style={[styles.transactionGateway, { color: colors.textSecondary }]}>
          {transaction.gateway} • {transaction.reference}
        </Text>
        <Text style={[styles.transactionTime, { color: colors.textSecondary }]}>
          {transaction.timestamp}
        </Text>
      </View>
    </View>
  );

  return (
    <>
      <View style={[styles.container, { backgroundColor: colors.background }]}>


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
          {/* Payment Overview */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Payment Overview
            </Text>
            <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.overviewStats}>
                <View style={styles.overviewStat}>
                  <Ionicons name="card" size={24} color={colors.primary} />
                  <Text style={[styles.overviewValue, { color: colors.primary }]}>
                    {paymentGateways.filter(g => g.enabled).length}
                  </Text>
                  <Text style={[styles.overviewLabel, { color: colors.textSecondary }]}>
                    Active Gateways
                  </Text>
                </View>
                <View style={styles.overviewStat}>
                  <Ionicons name="trending-up" size={24} color={colors.success} />
                  <Text style={[styles.overviewValue, { color: colors.success }]}>
                    98.2%
                  </Text>
                  <Text style={[styles.overviewLabel, { color: colors.textSecondary }]}>
                    Success Rate
                  </Text>
                </View>
                <View style={styles.overviewStat}>
                  <Ionicons name="receipt" size={24} color={colors.info} />
                  <Text style={[styles.overviewValue, { color: colors.info }]}>
                    1,937
                  </Text>
                  <Text style={[styles.overviewLabel, { color: colors.textSecondary }]}>
                    Today's Transactions
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Payment Gateways */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Payment Gateways
            </Text>
            {paymentGateways.map(renderPaymentGateway)}
          </View>

          {/* System Settings */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              System Settings
            </Text>
            <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>
                    Auto Reconciliation
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    Automatically reconcile transactions
                  </Text>
                </View>
                <Switch
                  value={systemSettings.autoReconciliation}
                  onValueChange={() => toggleSetting('autoReconciliation')}
                  trackColor={{ false: colors.border, true: colors.primary + '50' }}
                  thumbColor={systemSettings.autoReconciliation ? colors.primary : colors.textSecondary}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>
                    Failure Retry
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    Retry failed transactions automatically
                  </Text>
                </View>
                <Switch
                  value={systemSettings.failureRetry}
                  onValueChange={() => toggleSetting('failureRetry')}
                  trackColor={{ false: colors.border, true: colors.primary + '50' }}
                  thumbColor={systemSettings.failureRetry ? colors.primary : colors.textSecondary}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>
                    Fraud Detection
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    Enable fraud detection algorithms
                  </Text>
                </View>
                <Switch
                  value={systemSettings.fraudDetection}
                  onValueChange={() => toggleSetting('fraudDetection')}
                  trackColor={{ false: colors.border, true: colors.primary + '50' }}
                  thumbColor={systemSettings.fraudDetection ? colors.primary : colors.textSecondary}
                />
              </View>
            </View>
          </View>

          {/* Recent Transactions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Recent Transactions
            </Text>
            {recentTransactions.map(renderTransaction)}
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  overviewCard: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  overviewStat: {
    alignItems: 'center',
  },
  overviewValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  overviewLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  gatewayCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  gatewayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  gatewayInfo: {
    flex: 1,
  },
  gatewayName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  gatewayStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  gatewayStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  lastTransaction: {
    fontSize: 12,
    textAlign: 'center',
  },
  settingsCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
  },
  transactionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  transactionTypeText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  transactionStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  transactionStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  transactionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  transactionGateway: {
    fontSize: 12,
  },
  transactionTime: {
    fontSize: 12,
  },
});
