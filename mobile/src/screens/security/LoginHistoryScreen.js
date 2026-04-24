import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import ApiService from '../../services/api';
import Toast from 'react-native-toast-message';

const LoginHistoryScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const [loginHistory, setLoginHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadLoginHistory();
  }, []);

  const loadLoginHistory = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getLoginHistory();

      if (response.success) {
        setLoginHistory(response.data || []);
      } else {
        throw new Error(response.error || 'Failed to load login history');
      }
    } catch (error) {
      console.error('Failed to load login history:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load login history',
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLoginHistory();
    setRefreshing(false);
  };

  const handleLogoutAllDevices = () => {
    Alert.alert(
      'Logout All Devices',
      'This will log you out from all devices except this one. You will need to log in again on other devices. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout All',
          style: 'destructive',
          onPress: performLogoutAllDevices,
        },
      ]
    );
  };

  const performLogoutAllDevices = async () => {
    try {
      const response = await ApiService.logoutAllDevices();

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Logged out from all other devices',
        });
        loadLoginHistory(); // Refresh the list
      } else {
        throw new Error(response.error || 'Failed to logout from all devices');
      }
    } catch (error) {
      console.error('Failed to logout all devices:', error);
      Alert.alert('Error', error.message || 'Failed to logout from all devices');
    }
  };

  // Logout from specific device
  const logoutSpecificDevice = async (sessionId, deviceName) => {
    Alert.alert(
      'Logout Device',
      `Are you sure you want to logout from "${deviceName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await ApiService.logoutSpecificDevice(sessionId);

              if (response.success) {
                Toast.show({
                  type: 'success',
                  text1: 'Success',
                  text2: `Logged out from ${deviceName}`,
                });
                loadLoginHistory(); // Refresh the list
              } else {
                throw new Error(response.error || 'Failed to logout from device');
              }
            } catch (error) {
              console.error('Failed to logout device:', error);
              Alert.alert('Error', error.message || 'Failed to logout from device');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = (now - date) / (1000 * 60);
    const diffInHours = diffInMinutes / 60;

    // Always show actual time for login history for better tracking
    if (diffInMinutes < 1) {
      return `${Math.floor(diffInMinutes * 60)} seconds ago`;
    } else if (diffInMinutes < 60) {
      return `${Math.floor(diffInMinutes)} minutes ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInHours < 48) {
      return `Yesterday at ${date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const getDeviceIcon = (deviceType) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
      case 'android':
      case 'ios':
        return 'phone-portrait';
      case 'tablet':
        return 'tablet-portrait';
      case 'desktop':
      case 'windows':
      case 'mac':
        return 'desktop';
      default:
        return 'globe';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return colors.success;
      case 'expired':
        return colors.warning;
      case 'revoked':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const renderLoginItem = (item) => (
    <View
      key={item.id}
      style={[
        styles.loginItem,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderLeftColor: getStatusColor(item.status),
        },
      ]}
    >
      <View style={styles.loginHeader}>
        <View style={styles.deviceInfo}>
          <Ionicons
            name={getDeviceIcon(item.deviceType)}
            size={24}
            color={colors.primary}
          />
          <View style={styles.deviceDetails}>
            <Text style={[styles.deviceName, { color: colors.text }]}>
              {item.deviceName || `${item.deviceType || 'Unknown'} Device`}
            </Text>
            <Text style={[styles.deviceOS, { color: colors.textSecondary }]}>
              {item.operatingSystem} • {item.browser}
            </Text>
          </View>
        </View>
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) + '20' },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(item.status) },
              ]}
            >
              {item.status?.toUpperCase() || 'UNKNOWN'}
            </Text>
          </View>
          {item.isCurrent && (
            <Text style={[styles.currentDevice, { color: colors.primary }]}>
              Current Device
            </Text>
          )}
        </View>
      </View>

      <View style={styles.loginDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="time" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {formatDate(item.loginTime)}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="location" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {item.location || 'Unknown location'}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="globe" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {item.ipAddress}
          </Text>
        </View>
      </View>

      {item.lastActivity && (
        <Text style={[styles.lastActivity, { color: colors.textSecondary }]}>
          Last activity: {formatDate(item.lastActivity)}
        </Text>
      )}

      {/* Individual Device Logout Button - Only show for non-current devices */}
      {!item.isCurrent && item.status === 'active' && (
        <TouchableOpacity
          style={[styles.logoutDeviceButton, { backgroundColor: colors.error + '10', borderColor: colors.error + '30' }]}
          onPress={() => logoutSpecificDevice(item.id, item.deviceName || `${item.deviceType} Device`)}
        >
          <Ionicons name="log-out-outline" size={16} color={colors.error} />
          <Text style={[styles.logoutDeviceText, { color: colors.error }]}>
            Logout from this device
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Login History</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Monitor your account access and security
        </Text>
      </View>

      {/* Security Actions */}
      <View style={[styles.securityActions, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
          onPress={handleLogoutAllDevices}
        >
          <Ionicons name="log-out" size={20} color={colors.error} />
          <Text style={[styles.actionButtonText, { color: colors.error }]}>
            Logout All Other Devices
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading login history...
            </Text>
          </View>
        ) : loginHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="shield-checkmark-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No login history found
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Your login activities will appear here
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Recent Login Activity
            </Text>
            {loginHistory.map(renderLoginItem)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
  },
  securityActions: {
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 8,
    gap: spacing.sm,
  },
  actionButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  loginItem: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: spacing.md,
  },
  loginHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  deviceDetails: {
    flex: 1,
  },
  deviceName: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  deviceOS: {
    fontSize: typography.fontSize.sm,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    marginBottom: spacing.xs,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: 'bold',
  },
  currentDevice: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  loginDetails: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
  },
  lastActivity: {
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
  },
  logoutDeviceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    gap: spacing.xs,
  },
  logoutDeviceText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.fontSize.base,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

export default LoginHistoryScreen;
