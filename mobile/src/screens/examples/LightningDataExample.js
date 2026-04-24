import React, { useState, useEffect } from 'react';
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
import { 
  useLightningData, 
  useOptimisticUpdate, 
  useSmartPrefetch,
  useMultiData 
} from '../hooks/useLightningData';
import PerformanceMonitor from '../components/PerformanceMonitor';
import { getThemeColors } from '../utils/theme';

/**
 * Lightning Data Example Screen
 * Demonstrates instant data loading, optimistic updates, and smart prefetching
 */
const LightningDataExample = ({ navigation, theme = 'dark' }) => {
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const colors = getThemeColors(theme);

  // Lightning data hooks - instant data access
  const {
    data: notifications,
    loading: notificationsLoading,
    source: notificationsSource,
    loadTime: notificationsLoadTime,
    refresh: refreshNotifications,
    isInstant: notificationsInstant,
  } = useLightningData('notifications');

  const {
    data: wallet,
    loading: walletLoading,
    source: walletSource,
    loadTime: walletLoadTime,
    isInstant: walletInstant,
  } = useLightningData('wallet');

  // Multi-data loading - load multiple data types simultaneously
  const {
    data: multiData,
    loading: multiLoading,
    loadTimes: multiLoadTimes,
    totalLoadTime,
    refresh: refreshMultiData,
  } = useMultiData(['chamas', 'transactions', 'products'], {
    chamas: { limit: 10 },
    transactions: { limit: 20 },
    products: { limit: 15 },
  });

  // Optimistic updates - instant UI feedback
  const {
    markNotificationAsRead,
    addToCart,
    addToWishlist,
    transferMoney,
    hasPendingUpdates,
    pendingUpdates,
  } = useOptimisticUpdate();

  // Smart prefetching - predictive data loading
  const { prefetchStats, prefetchForPage, onUserHover, onUserScroll } = useSmartPrefetch('lightning-example');

  // Prefetch data for likely next pages
  useEffect(() => {
    // Prefetch data for pages user might visit next
    prefetchForPage('user-dashboard', 'normal');
    prefetchForPage('marketplace', 'low');
    prefetchForPage('wallet', 'low');
  }, [prefetchForPage]);

  // Handle optimistic notification read
  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      Alert.alert('Success', 'Notification marked as read instantly!');
    } catch (error) {
      Alert.alert('Error', 'Failed to mark notification as read');
    }
  };

  // Handle optimistic cart addition
  const handleAddToCart = async (productId) => {
    try {
      await addToCart(productId, 1);
      Alert.alert('Success', 'Product added to cart instantly!');
    } catch (error) {
      Alert.alert('Error', 'Failed to add product to cart');
    }
  };

  // Handle optimistic money transfer
  const handleTransferMoney = async () => {
    try {
      await transferMoney('user123', 100, 'Lightning transfer test');
      Alert.alert('Success', 'Money transfer initiated instantly!');
    } catch (error) {
      Alert.alert('Error', 'Failed to transfer money');
    }
  };

  const renderDataSection = (title, data, loading, source, loadTime, isInstant) => (
    <View style={[styles.section, { backgroundColor: colors.surface }]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        <View style={styles.performanceIndicators}>
          {isInstant && (
            <View style={[styles.indicator, { backgroundColor: colors.success }]}>
              <Ionicons name="flash" size={12} color="white" />
              <Text style={styles.indicatorText}>INSTANT</Text>
            </View>
          )}
          <View style={[styles.indicator, { backgroundColor: getSourceColor(source, colors) }]}>
            <Text style={styles.indicatorText}>{source?.toUpperCase()}</Text>
          </View>
          <Text style={[styles.loadTime, { color: colors.textSecondary }]}>
            {loadTime}ms
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading {title.toLowerCase()}...
          </Text>
        </View>
      ) : (
        <View style={styles.dataContainer}>
          <Text style={[styles.dataCount, { color: colors.text }]}>
            {Array.isArray(data) ? `${data.length} items` : 'Data loaded'}
          </Text>
          {Array.isArray(data) && data.slice(0, 3).map((item, index) => (
            <View key={item.id || index} style={styles.dataItem}>
              <Text style={[styles.dataItemText, { color: colors.textSecondary }]}>
                {item.title || item.name || item.description || `Item ${index + 1}`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const getSourceColor = (source, colors) => {
    switch (source) {
      case 'memory': return colors.success;
      case 'persistent': return colors.info;
      case 'database': return colors.warning;
      case 'api': return colors.error;
      default: return colors.textSecondary;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          ⚡ Lightning Data Demo
        </Text>
        <TouchableOpacity onPress={() => setShowPerformanceMonitor(true)}>
          <Ionicons name="analytics" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Performance Status */}
      <View style={[styles.statusBar, { backgroundColor: colors.surface }]}>
        <View style={styles.statusItem}>
          <Ionicons name="flash" size={16} color={colors.success} />
          <Text style={[styles.statusText, { color: colors.text }]}>
            {hasPendingUpdates ? `${pendingUpdates} pending` : 'All synced'}
          </Text>
        </View>
        {prefetchStats && (
          <View style={styles.statusItem}>
            <Ionicons name="download" size={16} color={colors.info} />
            <Text style={[styles.statusText, { color: colors.text }]}>
              {prefetchStats.hitRate?.toFixed(1)}% hit rate
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              refreshNotifications();
              refreshMultiData();
            }}
            tintColor={colors.primary}
          />
        }
        onScroll={(event) => {
          const scrollPosition = event.nativeEvent.contentOffset.y / 
            (event.nativeEvent.contentSize.height - event.nativeEvent.layoutMeasurement.height);
          onUserScroll(scrollPosition);
        }}
        scrollEventThrottle={16}
      >
        {/* Individual Data Sections */}
        {renderDataSection(
          'Notifications',
          notifications,
          notificationsLoading,
          notificationsSource,
          notificationsLoadTime,
          notificationsInstant
        )}

        {renderDataSection(
          'Wallet',
          wallet,
          walletLoading,
          walletSource,
          walletLoadTime,
          walletInstant
        )}

        {/* Multi-Data Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Multi-Data Loading
          </Text>
          <Text style={[styles.loadTime, { color: colors.textSecondary }]}>
            Total: {totalLoadTime}ms
          </Text>
          
          {multiLoading ? (
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading multiple data types...
            </Text>
          ) : (
            <View>
              {Object.entries(multiData).map(([dataType, data]) => (
                <View key={dataType} style={styles.multiDataItem}>
                  <Text style={[styles.multiDataType, { color: colors.text }]}>
                    {dataType}: {Array.isArray(data) ? data.length : 1} items
                  </Text>
                  <Text style={[styles.multiDataTime, { color: colors.textSecondary }]}>
                    {multiLoadTimes[dataType]}ms
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Optimistic Update Actions */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Optimistic Updates
          </Text>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => handleMarkAsRead('notification123')}
            >
              <Ionicons name="checkmark" size={16} color="white" />
              <Text style={styles.actionButtonText}>Mark Read</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.success }]}
              onPress={() => handleAddToCart('product123')}
            >
              <Ionicons name="cart" size={16} color="white" />
              <Text style={styles.actionButtonText}>Add to Cart</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.warning }]}
              onPress={handleTransferMoney}
            >
              <Ionicons name="send" size={16} color="white" />
              <Text style={styles.actionButtonText}>Transfer $100</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Prefetch Actions */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Smart Prefetching
          </Text>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.info }]}
              onPress={() => prefetchForPage('user-dashboard', 'high')}
              onPressIn={() => onUserHover('dashboard-button')}
            >
              <Ionicons name="home" size={16} color="white" />
              <Text style={styles.actionButtonText}>Prefetch Dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.info }]}
              onPress={() => prefetchForPage('marketplace', 'high')}
              onPressIn={() => onUserHover('marketplace-button')}
            >
              <Ionicons name="storefront" size={16} color="white" />
              <Text style={styles.actionButtonText}>Prefetch Marketplace</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Performance Monitor Modal */}
      <PerformanceMonitor
        visible={showPerformanceMonitor}
        onClose={() => setShowPerformanceMonitor(false)}
        theme={theme}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    marginLeft: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  performanceIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  indicatorText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  loadTime: {
    fontSize: 12,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  dataContainer: {
    gap: 8,
  },
  dataCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  dataItem: {
    paddingVertical: 4,
  },
  dataItemText: {
    fontSize: 12,
  },
  multiDataItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  multiDataType: {
    fontSize: 14,
  },
  multiDataTime: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default LightningDataExample;
