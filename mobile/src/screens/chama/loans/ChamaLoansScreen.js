import React from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, shadows } from '../../../utils/theme';
import MessageBanner from '../../../components/common/MessageBanner';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import ChamaLoansSearchCard from '../../../components/chama-loans/ChamaLoansSearchCard';
import ChamaLoansTable from '../../../components/chama-loans/ChamaLoansTable';
import useChamaLoansScreen from '../../../hooks/useChamaLoansScreen';

const ChamaLoansScreen = ({ route, navigation, onRouteChange }) => {
  const screen = useChamaLoansScreen({ route, navigation, onRouteChange });
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={[styles.container, styles.containerBackground]}>
      <View style={{ flex: 1, position: 'relative' }}>
        {screen.successBanner.visible && (
          <MessageBanner
            type="success"
            message={screen.successBanner.message}
            onClose={() => screen.setSuccessBanner({ visible: false, message: '' })}
          />
        )}

        <ChamaLoansSearchCard
          searchQuery={screen.searchQuery}
          setSearchQuery={screen.setSearchQuery}
          theme={theme}
        />

        <ChamaLoansTable
          loans={screen.filteredLoans}
          loading={screen.loading}
          refreshing={screen.refreshing}
          onRefresh={screen.onRefresh}
          navigation={navigation}
          currentUser={user}
          canManageLoans={screen.canManageLoans}
          onLoanAction={screen.handleLoanAction}
          theme={theme}
        />

        <View style={{ position: 'absolute', right: spacing.md, bottom: 64, flexDirection: 'column', alignItems: 'center', gap: spacing.md, zIndex: 999 }}>
          <PageRefreshButton onRefresh={screen.onRefresh} refreshing={screen.refreshing} color={colors.primary} absolute={false} />
          <TouchableOpacity
            style={[styles.fab, styles.fabPrimary]}
            onPress={screen.handleApplyForLoan}
          >
            <Ionicons name="add" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  containerBackground: {
    backgroundColor: colors.background,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  fabPrimary: {
    backgroundColor: colors.primary,
  },
});

export default ChamaLoansScreen;
