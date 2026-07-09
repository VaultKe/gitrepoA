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
  ActivityIndicator,
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
  const [loggingOutId, setLoggingOutId] = useState(null);

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
    const activeOthers = loginHistory.filter(
      (item) => item.status === 'active' && !item.isCurrent
    );

    if (activeOthers.length === 0) {
      Toast.show({
        type: 'info',
        text1: 'No other devices',
        text2: 'There are no other active devices to log out',
      });
      return;
    }

    Alert.alert(
      'Logout All Other Devices',
      `This will log you out from ${activeOthers.length} other device${activeOthers.length > 1 ? 's' : ''}. You will need to log in again on those devices. Continue?`,
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
        const count = loginHistory.filter(
          (item) => item.status === 'active' && !item.isCurrent
        ).length;
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Logged out from ${count} other device${count !== 1 ? 's' : ''}`,
        });
        await loadLoginHistory();
      } else {
        throw new Error(response.error || 'Failed to logout from all devices');
      }
    } catch (error) {
      console.error('Failed to logout all devices:', error);
      Alert.alert('Error', error.message || 'Failed to logout from all devices');
    }
  };

  const logoutSpecificDevice = async (sessionId, deviceName) => {
    setLoggingOutId(sessionId);
    try {
      const response = await ApiService.logoutSpecificDevice(sessionId);

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Logged out from ${deviceName}`,
        });
        await loadLoginHistory();
      } else {
        throw new Error(response.error || 'Failed to logout from device');
      }
    } catch (error) {
      console.error('Failed to logout device:', error);
      Alert.alert('Error', error.message || 'Failed to logout from device');
    } finally {
      setLoggingOutId(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Unknown date';
    }

    const now = new Date();
    const diffInMs = now - date;
    const diffInMinutes = diffInMs / (1000 * 60);
    const diffInHours = diffInMinutes / 60;

    if (diffInMinutes < 1) {
      return `${Math.max(1, Math.floor(diffInMinutes * 60))} seconds ago`;
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

  const parseLocation = (locationStr) => {
    if (!locationStr) return null;

    const trimmed = locationStr.trim();
    const parts = trimmed.split(' • ').filter(Boolean);

    return {
      base: parts[0] || trimmed,
      timezone: null,
      connection: parts.length > 1 ? parts[parts.length - 1] : null,
    };
  };

  const getDisplayLocation = (locationStr) => {
    const parsed = parseLocation(locationStr);
    if (!parsed) return 'Unknown location';

    const { base, timezone, connection } = parsed;

    const meaningfulConnection =
      connection && connection.toLowerCase() !== 'unknown'
        ? connection
        : null;

    const parts = [base];
    if (timezone) parts.push(timezone);
    if (meaningfulConnection) parts.push(meaningfulConnection);

    return parts.join(' • ');
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

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active':
        return 'ACTIVE';
      case 'expired':
        return 'EXPIRED';
      case 'revoked':
        return 'REVOKED';
      default:
        return status?.toUpperCase() || 'UNKNOWN';
    }
  };

  const getDeviceDisplayName = (item) => {
    if (item.deviceName && item.deviceName.trim() !== '') {
      return item.deviceName;
    }

    const parts = [
      item.manufacturer,
      item.model,
      item.deviceType,
    ]
      .filter(Boolean)
      .join(' ');

    if (parts.trim()) {
      return parts.trim();
    }

    return `${item.deviceType || 'Unknown'} Device`;
  };

  const getOSDisplay = (item) => {
    const parts = [item.operatingSystem, item.osVersion].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');

    if (item.platform) {
      return item.platform;
    }

    return null;
  };

  const getConnectionTypeLabel = (item) => {
    if (item.connectionType && item.connectionType.toLowerCase() !== 'unknown') {
      return item.connectionType;
    }

    const parsed = parseLocation(item.location);
    if (parsed && parsed.connection && parsed.connection.toLowerCase() !== 'unknown') {
      return parsed.connection;
    }

    return null;
  };

  const isLocalhostIP = (ip) => {
    if (!ip) return false;
    return ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0';
  };

  const getIPDisplay = (ipAddress) => {
    if (!ipAddress) return 'Unknown IP';

    if (isLocalhostIP(ipAddress)) {
      return 'Localhost';
    }

    return ipAddress;
  };

  const renderLoginItem = (item) => {
    const isActive = item.status === 'active';
    const isCurrent = item.isCurrent;
    const isRevoked = item.status === 'revoked';
    const isLoggingOut = loggingOutId === item.id;

    const deviceName = getDeviceDisplayName(item);
    const osDisplay = getOSDisplay(item);
    const browserDisplay = item.browser || null;
    const appVersionDisplay = item.appVersion || null;

    const secondaryInfo = [osDisplay, browserDisplay, appVersionDisplay]
      .filter(Boolean)
      .join(' • ');

    const statusColor = getStatusColor(item.status);
    const statusLabel = getStatusLabel(item.status);

    const parsedLocation = parseLocation(item.location);
    const displayLocation = getDisplayLocation(item.location);
    const connectionType = getConnectionTypeLabel(item);
    const ipDisplay = getIPDisplay(item.ipAddress);

    const loginTimeValid = item.loginTime && !isNaN(new Date(item.loginTime).getTime());
    const lastActivityValid = item.lastActivity && !isNaN(new Date(item.lastActivity).getTime());

    const isLastActivitySameAsLogin =
      loginTimeValid &&
      lastActivityValid &&
      new Date(item.lastActivity).getTime() === new Date(item.loginTime).getTime();

    let activityLabel = 'Logged in';
    let activityTime = item.loginTime;

    if (isRevoked && lastActivityValid) {
      activityLabel = 'Logged out';
      activityTime = item.lastActivity;
    } else if (!isActive && lastActivityValid) {
      activityLabel = 'Last seen';
      activityTime = item.lastActivity;
    } else if (isActive && !isLastActivitySameAsLogin && lastActivityValid) {
      activityLabel = 'Last activity';
      activityTime = item.lastActivity;
    }

    return (
      <View
        key={item.id}
        style={[
          styles.loginItem,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: isRevoked ? 0.7 : 1,
          },
        ]}
      >
        <View style={styles.loginHeader}>
          <View style={styles.deviceInfo}>
            <View
              style={[
                styles.deviceIconContainer,
                { backgroundColor: colors.primary + '15' },
              ]}
            >
              <Ionicons
                name={getDeviceIcon(item.deviceType)}
                size={22}
                color={colors.primary}
              />
            </View>
            <View style={styles.deviceDetails}>
              <Text style={[styles.deviceName, { color: colors.text }]} numberOfLines={1}>
                {deviceName}
              </Text>
              {secondaryInfo ? (
                <Text style={[styles.deviceOS, { color: colors.textSecondary }]} numberOfLines={1}>
                  {secondaryInfo}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusColor + '20' },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: statusColor },
                ]}
              >
                {statusLabel}
              </Text>
            </View>
            {isCurrent && (
              <View style={[styles.currentDeviceBadge, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="phone-portrait" size={10} color={colors.primary} />
                <Text style={[styles.currentDevice, { color: colors.primary }]}>
                  This device
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.loginDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {activityLabel}: {formatDate(activityTime)}
            </Text>
          </View>

          {displayLocation && displayLocation !== 'Unknown location' ? (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
                {displayLocation}
              </Text>
            </View>
          ) : null}

          <View style={styles.detailRow}>
            <Ionicons name="globe-outline" size={15} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {ipDisplay}
            </Text>
          </View>

          {connectionType && !isLocalhostIP(item.ipAddress) ? (
            <View style={styles.detailRow}>
              <Ionicons name="wifi-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                {connectionType}
              </Text>
            </View>
          ) : null}
        </View>

        {isRevoked && (
          <View style={[styles.revokedBadge, { backgroundColor: colors.error + '15', borderColor: colors.error + '30' }]}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.error} />
            <Text style={[styles.revokedText, { color: colors.error }]}>
              Session terminated
            </Text>
          </View>
        )}

        {isActive && !isCurrent && (
          <TouchableOpacity
            style={[
              styles.logoutDeviceButton,
              {
                backgroundColor: colors.error + '10',
                borderColor: colors.error + '30',
                opacity: isLoggingOut ? 0.6 : 1,
              },
            ]}
            onPress={() => logoutSpecificDevice(item.id, deviceName)}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Ionicons name="log-out-outline" size={16} color={colors.error} />
            )}
            <Text
              style={[
                styles.logoutDeviceText,
                { color: colors.error },
              ]}
            >
              {isLoggingOut ? 'Logging out...' : 'Logout from this device'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Login History</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Monitor your account access and active sessions
        </Text>
      </View>

      <View style={[styles.securityActions, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
          onPress={handleLogoutAllDevices}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={[styles.actionButtonText, { color: colors.error }]}>
            Logout All Other Devices
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: spacing.md }]}>
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
              Your login activities will appear here after you sign in
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
  deviceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  currentDeviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
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
    flex: 1,
  },
  lastActivity: {
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
  },
  revokedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  revokedText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
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
    justifyContent: 'center',
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
