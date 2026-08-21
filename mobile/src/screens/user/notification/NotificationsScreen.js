import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography } from '../../../utils/theme';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import NotificationCard from '../../../components/notifications/NotificationCard';
import NotificationHeader from '../../../components/notifications/NotificationHeader';
import useNotificationsScreen from '../../../hooks/useNotificationsScreen';

const { width: screenWidth } = Dimensions.get('window');

const NotificationsScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const screen = useNotificationsScreen({ navigation });

  const {
    loading,
    refreshing,
    selectedFilter,
    setSelectedFilter,
    invitationsCount,
    displayNotifications,
    filters,
    smartNavigate,
    onRefresh,
    markAllAsRead,
    getFilteredNotifications,
    onMarkAsRead,
    onDelete,
  } = screen;

  const renderHeader = () => (
    <NotificationHeader
      colors={colors}
      screenWidth={screenWidth}
      filters={filters}
      selectedFilter={selectedFilter}
      setSelectedFilter={setSelectedFilter}
      invitationsCount={invitationsCount}
      smartNavigate={smartNavigate}
      displayNotifications={displayNotifications}
      markAllAsRead={markAllAsRead}
    />
  );

  const renderNotification = useCallback(({ item }) => {
    return (
      <NotificationCard
        item={item}
        colors={colors}
        screenWidth={screenWidth}
        onMarkAsRead={onMarkAsRead}
        onDelete={onDelete}
        smartNavigate={smartNavigate}
      />
    );
  }, [colors, screenWidth, onMarkAsRead, onDelete, smartNavigate]);

  const filteredNotifications = getFilteredNotifications();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
        {renderHeader()}

        <FlatList
          data={filteredNotifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.notificationsList,
            filteredNotifications.length === 0 && styles.emptyListContainer
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={!loading && (
            <View style={styles.emptyState}>
              <Ionicons
                name={selectedFilter === 'unread' ? 'checkmark-circle-outline' : 'notifications-outline'}
                size={64}
                color={colors.textTertiary}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {selectedFilter === 'unread' ? 'All caught up!' : 'No notifications'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {selectedFilter === 'unread'
                  ? 'You have no unread notifications'
                  : 'You\'ll see notifications here when they arrive'}
              </Text>
            </View>
          )}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={10}
          updateCellsBatchingPeriod={50}
        />

        <PageRefreshButton
          onRefresh={onRefresh}
          refreshing={refreshing}
          color={colors.primary}
          bottom={64}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  notificationsList: { padding: spacing.md, paddingBottom: spacing.xl },
  emptyListContainer: { flexGrow: 1, justifyContent: 'center', minHeight: 500 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg, minHeight: 400 },
  emptyTitle: { fontSize: screenWidth < 350 ? 24 : 28, fontWeight: '700', marginTop: spacing.xl, marginBottom: spacing.lg, textAlign: 'center', letterSpacing: 0.5 },
  emptySubtitle: { fontSize: screenWidth < 350 ? 16 : 18, textAlign: 'center', lineHeight: 24, paddingHorizontal: spacing.sm, marginTop: spacing.md, opacity: 0.8 },
});

export default NotificationsScreen;
