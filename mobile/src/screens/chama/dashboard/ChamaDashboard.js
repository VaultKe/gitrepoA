import React from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, RefreshControl } from 'react-native';
import { useApp } from '../../../context/AppContext';
import { getThemeColors } from '../../../utils/theme';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import useChamaDashboard from '../../../hooks/useChamaDashboard';
import ChamaSelectorCard from '../../../components/chama-dashboard/ChamaSelectorCard';
import QuickStatsCard from '../../../components/chama-dashboard/QuickStatsCard';
import QuickActionsCard from '../../../components/chama-dashboard/QuickActionsCard';
import EmptyState from '../../../components/chama-dashboard/EmptyState';

const ChamaDashboard = ({ navigation, onRouteChange, route }) => {
  const dashboard = useChamaDashboard({ route, navigation, onRouteChange });
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const {
    userChamas,
    refreshing,
    selectedChama,
    chamaFeatures,
    realTimeData,
  } = dashboard;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={dashboard.onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {userChamas.length === 0 && !selectedChama ? (
            <EmptyState />
          ) : (
            <>
              <ChamaSelectorCard
                userChamas={userChamas}
                selectedChama={selectedChama}
                getUserRole={dashboard.getUserRole}
                switchToChama={dashboard.switchToChama}
              />
              <QuickStatsCard
                selectedChama={selectedChama}
                realTimeData={realTimeData}
                getUserRole={dashboard.getUserRole}
                formatCurrency={dashboard.formatCurrency}
              />
              <QuickActionsCard
                selectedChama={selectedChama}
                chamaFeatures={chamaFeatures}
                onRouteChange={onRouteChange}
                navigation={navigation}
              />
            </>
          )}
        </ScrollView>
        <PageRefreshButton onRefresh={dashboard.onRefresh} refreshing={refreshing} color={colors.primary} bottom={64} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
});

export default ChamaDashboard;
