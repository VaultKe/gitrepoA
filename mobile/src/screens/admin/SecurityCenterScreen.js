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

export default function SecurityCenterScreen() {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const [refreshing, setRefreshing] = useState(false);
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: true,
    loginNotifications: true,
    suspiciousActivityAlerts: true,
    autoLockout: true,
    encryptionEnabled: true,
    auditLogging: true,
  });
  const [securityAlerts, setSecurityAlerts] = useState([
    {
      id: '1',
      type: 'warning',
      title: 'Multiple Failed Login Attempts',
      description: 'User john.doe@example.com has 5 failed login attempts',
      timestamp: '2024-01-20 14:30:00',
      severity: 'medium',
      resolved: false,
    },
    {
      id: '2',
      type: 'info',
      title: 'New Admin Login',
      description: 'Admin user logged in from new device',
      timestamp: '2024-01-20 12:15:00',
      severity: 'low',
      resolved: true,
    },
    {
      id: '3',
      type: 'error',
      title: 'Suspicious Transaction Pattern',
      description: 'Unusual transaction pattern detected in Chama ID: 123',
      timestamp: '2024-01-20 10:45:00',
      severity: 'high',
      resolved: false,
    },
  ]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate data refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  };

  const toggleSetting = (setting) => {
    setSecuritySettings(prev => ({
      ...prev,
      [setting]: !prev[setting],
    }));
  };

  const handleAlertAction = (alert, action) => {
    Alert.alert(
      'Confirm Action',
      `Are you sure you want to ${action} this alert?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            if (action === 'resolve') {
              setSecurityAlerts(prev =>
                prev.map(a => a.id === alert.id ? { ...a, resolved: true } : a)
              );
            } else if (action === 'dismiss') {
              setSecurityAlerts(prev => prev.filter(a => a.id !== alert.id));
            }
            Alert.alert('Success', `Alert ${action}d successfully`);
          },
        },
      ]
    );
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return colors.error;
      case 'medium': return colors.warning;
      case 'low': return colors.info;
      default: return colors.textSecondary;
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'error': return 'alert-circle';
      case 'warning': return 'warning';
      case 'info': return 'information-circle';
      default: return 'notifications';
    }
  };

  const renderSecuritySetting = (key, title, description) => (
    <View key={key} style={[styles.settingItem, { borderBottomColor: colors.border }]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
          {description}
        </Text>
      </View>
      <Switch
        value={securitySettings[key]}
        onValueChange={() => toggleSetting(key)}
        trackColor={{ false: colors.border, true: colors.primary + '50' }}
        thumbColor={securitySettings[key] ? colors.primary : colors.textSecondary}
      />
    </View>
  );

  const renderSecurityAlert = (alert) => (
    <View
      key={alert.id}
      style={[
        styles.alertCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderLeftColor: getSeverityColor(alert.severity),
          opacity: alert.resolved ? 0.6 : 1,
        }
      ]}
    >
      <View style={styles.alertHeader}>
        <View style={styles.alertInfo}>
          <View style={styles.alertTitleRow}>
            <Ionicons
              name={getAlertIcon(alert.type)}
              size={14}
              color={getSeverityColor(alert.severity)}
            />
            <Text style={[styles.alertTitle, { color: colors.text }]}>
              {alert.title}
            </Text>
            {alert.resolved && (
              <View style={[styles.resolvedBadge, { backgroundColor: colors.success }]}>
                <Text style={[styles.resolvedText, { color: colors.background }]}>
                  RESOLVED
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.alertDescription, { color: colors.textSecondary }]}>
            {alert.description}
          </Text>
          <Text style={[styles.alertTimestamp, { color: colors.textTertiary }]}>
            {alert.timestamp}
          </Text>
        </View>
        <View style={[
          styles.severityIndicator,
          { backgroundColor: getSeverityColor(alert.severity) }
        ]}>
          <Text style={[styles.severityText, { color: colors.background }]}>
            {alert.severity.toUpperCase()}
          </Text>
        </View>
      </View>

      {!alert.resolved && (
        <View style={styles.alertActions}>
          <TouchableOpacity
            style={[styles.alertButton, { backgroundColor: colors.success + '20' }]}
            onPress={() => handleAlertAction(alert, 'resolve')}
          >
            <Ionicons name="checkmark" size={12} color={colors.success} />
            <Text style={[styles.alertButtonText, { color: colors.success }]}>
              Resolve
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.alertButton, { backgroundColor: colors.info + '20' }]}
            onPress={() => handleAlertAction(alert, 'investigate')}
          >
            <Ionicons name="search" size={12} color={colors.info} />
            <Text style={[styles.alertButtonText, { color: colors.info }]}>
              Investigate
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.alertButton, { backgroundColor: colors.error + '20' }]}
            onPress={() => handleAlertAction(alert, 'dismiss')}
          >
            <Ionicons name="close" size={12} color={colors.error} />
            <Text style={[styles.alertButtonText, { color: colors.error }]}>
              Dismiss
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const activeAlerts = securityAlerts.filter(alert => !alert.resolved);
  const resolvedAlerts = securityAlerts.filter(alert => alert.resolved);

  return (
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
          {/* Security Overview */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Security Overview
            </Text>
            <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.overviewStats}>
                <View style={styles.overviewStat}>
                  <Ionicons name="shield-checkmark" size={16} color={colors.success} />
                  <Text style={[styles.overviewValue, { color: colors.success }]}>
                    Secure
                  </Text>
                  <Text style={[styles.overviewLabel, { color: colors.textSecondary }]}>
                    System Status
                  </Text>
                </View>
                <View style={styles.overviewStat}>
                  <Ionicons name="warning" size={16} color={colors.warning} />
                  <Text style={[styles.overviewValue, { color: colors.warning }]}>
                    {activeAlerts.length}
                  </Text>
                  <Text style={[styles.overviewLabel, { color: colors.textSecondary }]}>
                    Active Alerts
                  </Text>
                </View>
                <View style={styles.overviewStat}>
                  <Ionicons name="lock-closed" size={16} color={colors.primary} />
                  <Text style={[styles.overviewValue, { color: colors.primary }]}>
                    99.8%
                  </Text>
                  <Text style={[styles.overviewLabel, { color: colors.textSecondary }]}>
                    Security Score
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Security Settings */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Security Settings
            </Text>
            <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {renderSecuritySetting(
                'twoFactorAuth',
                'Two-Factor Authentication',
                'Require 2FA for admin accounts'
              )}
              {renderSecuritySetting(
                'loginNotifications',
                'Login Notifications',
                'Send alerts for new login sessions'
              )}
              {renderSecuritySetting(
                'suspiciousActivityAlerts',
                'Suspicious Activity Alerts',
                'Monitor and alert on unusual patterns'
              )}
              {renderSecuritySetting(
                'autoLockout',
                'Auto Account Lockout',
                'Lock accounts after failed attempts'
              )}
              {renderSecuritySetting(
                'encryptionEnabled',
                'Data Encryption',
                'Encrypt sensitive data at rest'
              )}
              {renderSecuritySetting(
                'auditLogging',
                'Audit Logging',
                'Log all administrative actions'
              )}
            </View>
          </View>

          {/* Active Security Alerts */}
          {activeAlerts.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Active Security Alerts ({activeAlerts.length})
              </Text>
              {activeAlerts.map(renderSecurityAlert)}
            </View>
          )}

          {/* Resolved Alerts */}
          {resolvedAlerts.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Recently Resolved ({resolvedAlerts.length})
              </Text>
              {resolvedAlerts.map(renderSecurityAlert)}
            </View>
          )}
        </ScrollView>
    </View>
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
    lineHeight: 20,
  },
  alertCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  alertInfo: {
    flex: 1,
    marginRight: 12,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  resolvedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  resolvedText: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  alertDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  alertTimestamp: {
    fontSize: 12,
  },
  severityIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  alertActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  alertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  alertButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
});
