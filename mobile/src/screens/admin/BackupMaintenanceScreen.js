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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';
import ApiService from '../../services/api';
import Toast from 'react-native-toast-message';

export default function BackupMaintenanceScreen() {
  const { theme, userRole } = useApp();
  const colors = getThemeColors(theme);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backupSettings, setBackupSettings] = useState({
    autoBackup: true,
    dailyBackup: true,
    weeklyBackup: true,
    cloudBackup: true,
    encryptBackups: true,
    retentionDays: 30,
  });

  const [backupHistory, setBackupHistory] = useState([]);
  const [systemStatus, setSystemStatus] = useState({
    diskUsage: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    activeConnections: 0,
    uptime: 'Loading...',
    lastMaintenance: 'Loading...',
  });

  // Load backup history from API
  const loadBackupHistory = async () => {
    try {
      const response = await ApiService.makeRequest('/users/backup/history');
      if (response.success) {
        setBackupHistory(response.backups || []);
      } else {
        console.warn('Failed to load backup history:', response.error);
        setBackupHistory([]);
      }
    } catch (error) {
      console.error('Error loading backup history:', error);
      setBackupHistory([]);
    }
  };

  // Load system status from API
  const loadSystemStatus = async () => {
    try {
      const response = await ApiService.makeRequest('/users/backup/system-status');
      if (response.success) {
        setSystemStatus(response.system_status);
      } else {
        console.warn('Failed to load system status:', response.error);
        // Set default values
        setSystemStatus({
          diskUsage: 0,
          memoryUsage: 0,
          cpuUsage: 0,
          activeConnections: 0,
          uptime: 'Unknown',
          lastMaintenance: 'Unknown',
        });
      }
    } catch (error) {
      console.error('Error loading system status:', error);
      setSystemStatus({
        diskUsage: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        activeConnections: 0,
        uptime: 'Unknown',
        lastMaintenance: 'Unknown',
      });
    }
  };

  // Load backup settings from API
  const loadBackupSettings = async () => {
    try {
      const response = await ApiService.makeRequest('/users/backup/settings');
      if (response.success) {
        setBackupSettings(response.settings);
      } else {
        console.warn('Failed to load backup settings:', response.error);
        // Keep default settings
      }
    } catch (error) {
      console.error('Error loading backup settings:', error);
      // Keep default settings
    }
  };

  // Load all data
  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadBackupHistory(),
        loadSystemStatus(),
        loadBackupSettings(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      Toast.show({
        type: 'error',
        text1: 'Data Load Error',
        text2: 'Failed to load some backup data',
        position: 'bottom',
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadAllData();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadAllData();
  }, []);

  const toggleSetting = async (setting) => {
    const newValue = !backupSettings[setting];
    const updatedSettings = {
      ...backupSettings,
      [setting]: newValue,
    };

    // Update local state immediately for responsive UI
    setBackupSettings(updatedSettings);

    // Save to backend
    try {
      const response = await ApiService.makeRequest('/users/backup/settings', {
        method: 'PUT',
        body: JSON.stringify(updatedSettings),
      });

      if (!response.success) {
        // Revert on error
        setBackupSettings(backupSettings);
        Toast.show({
          type: 'error',
          text1: 'Settings Update Failed',
          text2: 'Could not save backup settings',
          position: 'bottom',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error('Error updating backup settings:', error);
      // Revert on error
      setBackupSettings(backupSettings);
      Toast.show({
        type: 'error',
        text1: 'Settings Update Failed',
        text2: 'Could not save backup settings',
        position: 'bottom',
        visibilityTime: 3000,
      });
    }
  };

  const handleBackupAction = async (action) => {
    // Parse action to determine backup type
    let backupType = 'full';
    if (action.includes('incremental')) {
      backupType = 'incremental';
    }

    Alert.alert(
      'Confirm Action',
      `Are you sure you want to start a ${backupType} backup? This may take several minutes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const response = await ApiService.makeRequest('/users/backup/start', {
                method: 'POST',
                body: JSON.stringify({ type: backupType }),
              });

              if (response.success) {
                Toast.show({
                  type: 'success',
                  text1: 'Backup Started',
                  text2: `${backupType.charAt(0).toUpperCase() + backupType.slice(1)} backup has been initiated`,
                  position: 'bottom',
                  visibilityTime: 4000,
                });

                // Refresh data after a delay to show the new backup
                setTimeout(() => {
                  loadBackupHistory();
                }, 2000);
              } else {
                throw new Error(response.error || 'Failed to start backup');
              }
            } catch (error) {
              console.error('Error starting backup:', error);
              Toast.show({
                type: 'error',
                text1: 'Backup Failed',
                text2: error.message || 'Could not start backup',
                position: 'bottom',
                visibilityTime: 4000,
              });
            }
          },
        },
      ]
    );
  };

  const handleMaintenanceAction = async (action) => {
    // Map action text to API action
    let apiAction = 'restart';
    if (action.includes('optimize')) {
      apiAction = 'optimize';
    } else if (action.includes('cleanup')) {
      apiAction = 'cleanup';
    }

    Alert.alert(
      'System Maintenance',
      `This will ${action}. Users may experience temporary service interruption. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await ApiService.makeRequest('/users/backup/maintenance', {
                method: 'POST',
                body: JSON.stringify({ action: apiAction }),
              });

              if (response.success) {
                Toast.show({
                  type: 'success',
                  text1: 'Maintenance Started',
                  text2: `System ${apiAction} has been initiated`,
                  position: 'bottom',
                  visibilityTime: 4000,
                });

                // Refresh system status after maintenance
                setTimeout(() => {
                  loadSystemStatus();
                }, 3000);
              } else {
                throw new Error(response.error || 'Failed to start maintenance');
              }
            } catch (error) {
              console.error('Error starting maintenance:', error);
              Toast.show({
                type: 'error',
                text1: 'Maintenance Failed',
                text2: error.message || 'Could not start maintenance',
                position: 'bottom',
                visibilityTime: 4000,
              });
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return colors.success;
      case 'failed': return colors.error;
      case 'running': return colors.warning;
      default: return colors.textSecondary;
    }
  };

  const getUsageColor = (percentage) => {
    if (percentage >= 80) return colors.error;
    if (percentage >= 60) return colors.warning;
    return colors.success;
  };

  const renderBackupItem = (backup) => {
    // Format timestamp
    const formatTimestamp = (timestamp) => {
      if (!timestamp) return 'Unknown';

      try {
        const date = new Date(timestamp);
        return date.toLocaleString('en-KE', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (error) {
        return timestamp;
      }
    };

    return (
      <View
        key={backup.id}
        style={[styles.backupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={styles.backupHeader}>
          <View style={styles.backupInfo}>
            <View style={styles.backupType}>
              <Ionicons
                name={backup.type === 'full' ? 'server' : 'layers'}
                size={12}
                color={colors.primary}
              />
              <Text style={[styles.backupTypeText, { color: colors.text }]}>
                {backup.type ? backup.type.charAt(0).toUpperCase() + backup.type.slice(1) : 'Unknown'} Backup
              </Text>
            </View>
            <Text style={[styles.backupTimestamp, { color: colors.textSecondary }]}>
              {formatTimestamp(backup.timestamp)}
            </Text>
          </View>
          <View style={[
            styles.backupStatus,
            { backgroundColor: getStatusColor(backup.status || 'unknown') + '20' }
          ]}>
            <Text style={[
              styles.backupStatusText,
              { color: getStatusColor(backup.status || 'unknown') }
            ]}>
              {(backup.status || 'unknown').toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.backupDetails}>
          <View style={styles.backupStat}>
            <Text style={[styles.backupStatLabel, { color: colors.textSecondary }]}>
              Size:
            </Text>
            <Text style={[styles.backupStatValue, { color: colors.text }]}>
              {backup.size || 'Unknown'}
            </Text>
          </View>
          <View style={styles.backupStat}>
            <Text style={[styles.backupStatLabel, { color: colors.textSecondary }]}>
              Duration:
            </Text>
            <Text style={[styles.backupStatValue, { color: colors.text }]}>
              {backup.duration || 'Unknown'}
            </Text>
          </View>
          <View style={styles.backupStat}>
            <Text style={[styles.backupStatLabel, { color: colors.textSecondary }]}>
              Location:
            </Text>
            <Text style={[styles.backupStatValue, { color: colors.text }]}>
              {backup.location || 'Unknown'}
            </Text>
          </View>
        </View>

        {backup.error && (
          <View style={styles.backupError}>
            <Ionicons name="warning" size={12} color={colors.error} />
            <Text style={[styles.backupErrorText, { color: colors.error }]}>
              {backup.error}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderSystemMetric = (label, value, unit, icon, color) => (
    <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.metricHeader}>
        <Ionicons name={icon} size={14} color={color} />
        <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>
        {value}{unit}
      </Text>
      {typeof value === 'number' && (
        <View style={styles.metricBar}>
          <View
            style={[
              styles.metricProgress,
              {
                width: `${value}%`,
                backgroundColor: getUsageColor(value),
              }
            ]}
          />
        </View>
      )}
    </View>
  );

  // Check if user is admin
  if (userRole !== 'admin') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.accessDenied}>
          <Ionicons name="shield-checkmark" size={64} color={colors.textSecondary} />
          <Text style={[styles.accessDeniedTitle, { color: colors.text }]}>
            Admin Access Required
          </Text>
          <Text style={[styles.accessDeniedText, { color: colors.textSecondary }]}>
            You need administrator privileges to access backup maintenance.
          </Text>
        </View>
      </View>
    );
  }

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
          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Quick Actions
            </Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
                onPress={() => handleBackupAction('start full backup')}
              >
                <Ionicons name="server" size={16} color={colors.primary} />
                <Text style={[styles.actionText, { color: colors.primary }]}>
                  Full Backup
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.info + '20' }]}
                onPress={() => handleBackupAction('start incremental backup')}
              >
                <Ionicons name="layers" size={16} color={colors.info} />
                <Text style={[styles.actionText, { color: colors.info }]}>
                  Incremental
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.warning + '20' }]}
                onPress={() => handleMaintenanceAction('restart system')}
              >
                <Ionicons name="refresh" size={16} color={colors.warning} />
                <Text style={[styles.actionText, { color: colors.warning }]}>
                  Restart
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.success + '20' }]}
                onPress={() => handleMaintenanceAction('optimize database')}
              >
                <Ionicons name="build" size={16} color={colors.success} />
                <Text style={[styles.actionText, { color: colors.success }]}>
                  Optimize
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* System Status */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              System Status
            </Text>
            <View style={styles.metricsGrid}>
              {renderSystemMetric('Disk Usage', systemStatus.diskUsage, '%', 'server', getUsageColor(systemStatus.diskUsage))}
              {renderSystemMetric('Memory Usage', systemStatus.memoryUsage, '%', 'hardware-chip', getUsageColor(systemStatus.memoryUsage))}
              {renderSystemMetric('CPU Usage', systemStatus.cpuUsage, '%', 'speedometer', getUsageColor(systemStatus.cpuUsage))}
              {renderSystemMetric('Connections', systemStatus.activeConnections, '', 'people', colors.info)}
            </View>
            <View style={[styles.uptimeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.uptimeLabel, { color: colors.textSecondary }]}>
                System Uptime
              </Text>
              <Text style={[styles.uptimeValue, { color: colors.success }]}>
                {systemStatus.uptime}
              </Text>
              <Text style={[styles.lastMaintenance, { color: colors.textSecondary }]}>
                Last maintenance: {systemStatus.lastMaintenance}
              </Text>
            </View>
          </View>

          {/* Backup Settings */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Backup Settings
            </Text>
            <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>
                    Automatic Backup
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    Enable scheduled automatic backups
                  </Text>
                </View>
                <Switch
                  value={backupSettings.autoBackup}
                  onValueChange={() => toggleSetting('autoBackup')}
                  trackColor={{ false: colors.border, true: colors.primary + '50' }}
                  thumbColor={backupSettings.autoBackup ? colors.primary : colors.textSecondary}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>
                    Cloud Backup
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    Store backups in cloud storage
                  </Text>
                </View>
                <Switch
                  value={backupSettings.cloudBackup}
                  onValueChange={() => toggleSetting('cloudBackup')}
                  trackColor={{ false: colors.border, true: colors.primary + '50' }}
                  thumbColor={backupSettings.cloudBackup ? colors.primary : colors.textSecondary}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>
                    Encrypt Backups
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    Encrypt backup files for security
                  </Text>
                </View>
                <Switch
                  value={backupSettings.encryptBackups}
                  onValueChange={() => toggleSetting('encryptBackups')}
                  trackColor={{ false: colors.border, true: colors.primary + '50' }}
                  thumbColor={backupSettings.encryptBackups ? colors.primary : colors.textSecondary}
                />
              </View>
            </View>
          </View>

          {/* Backup History */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Backup History
            </Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Loading backup history...
                </Text>
              </View>
            ) : backupHistory.length > 0 ? (
              backupHistory.map(renderBackupItem)
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="server" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No Backup History
                </Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Backup history will appear here once backups are performed.
                </Text>
              </View>
            )}
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
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    marginLeft: 8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  metricBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  metricProgress: {
    height: '100%',
    borderRadius: 2,
  },
  uptimeCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  uptimeLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  uptimeValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  lastMaintenance: {
    fontSize: 12,
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
  backupCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  backupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  backupInfo: {
    flex: 1,
  },
  backupType: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  backupTypeText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  backupTimestamp: {
    fontSize: 12,
  },
  backupStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  backupStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  backupDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backupStat: {
    alignItems: 'center',
  },
  backupStatLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  backupStatValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  backupError: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(218, 54, 51, 0.1)',
    borderRadius: 8,
  },
  backupErrorText: {
    fontSize: 12,
    marginLeft: 8,
  },

  // Access denied styles
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  accessDeniedText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Loading and empty state styles
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
