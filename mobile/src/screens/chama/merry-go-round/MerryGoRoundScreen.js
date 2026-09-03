import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import useMerryGoRoundScreen from '../../../hooks/useMerryGoRoundScreen';
import MerryGoRoundRoundSelector from '../../../components/merry-go-round/MerryGoRoundRoundSelector';
import MerryGoRoundCompactTop from '../../../components/merry-go-round/MerryGoRoundCompactTop';
import MerryGoRoundMemberOrderList from '../../../components/merry-go-round/MerryGoRoundMemberOrderList';
import MerryGoRoundContributorsTable from '../../../components/merry-go-round/MerryGoRoundContributorsTable';
import MerryGoRoundActions from '../../../components/merry-go-round/MerryGoRoundActions';
import MerryGoRoundEmptyState from '../../../components/merry-go-round/MerryGoRoundEmptyState';

const MerryGoRoundScreen = ({ route, navigation, onRouteChange }) => {
  const screen = useMerryGoRoundScreen({ route, navigation });

  const {
    theme,
    user,
    chamaId,
    merryGoRounds,
    loading,
    refreshing,
    selectedRound,
    selectedRoundRef,
    contributorFilter,
    setContributorFilter,
    contributorSearch,
    setContributorSearch,
    roundContributions,
    selectedRecipientPosition,
    setSelectedRecipientPosition,
    onRefresh,
    handleSelectRound,
    loadMerryGoRounds,
    loadRoundContributions,
    formatCurrency,
    getMemberName,
    getMemberShortName,
    isMemberLeft,
    getTargetRecipient,
    getRowData,
    getPayoutDate,
  } = screen;

  const colors = getThemeColors(theme);

  const handleContributePress = () => {
    if (!selectedRound) return;
    const navParams = {
      chamaId,
      roundId: selectedRound.id,
      roundName: selectedRound.name,
      contributionType: 'merry-go-round',
      amountPerRound: selectedRound.amount_per_round || selectedRound.amountPerRound,
    };
    if (onRouteChange) onRouteChange('contributions', 'ContributeScreen', navParams);
    else if (navigation && navigation.navigate) navigation.navigate('ContributeScreen', navParams);
    else Alert.alert('Navigation Error', 'Unable to navigate to contribution screen. Please try again.');
  };

  const recipientTarget = getTargetRecipient();
  const isRecipientView = !!(recipientTarget && recipientTarget.isRecipientView);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        >
          {loading && merryGoRounds.length === 0 && (
            <View style={styles.fullPageLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ marginTop: spacing.md, color: colors.textSecondary }}>
                Loading merry-go-rounds...
              </Text>
            </View>
          )}

          {!loading && merryGoRounds.length === 0 && (
            <MerryGoRoundEmptyState
              colors={colors}
              onCreatePress={() => {
                if (onRouteChange) onRouteChange('create-merry-go-round', 'CreateMerryGoRound');
                else navigation.navigate('CreateMerryGoRound', { chamaId });
              }}
            />
          )}

          {merryGoRounds.length > 0 && (
            <>
              {loading && (
                <View style={styles.inlineLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={{ marginLeft: spacing.sm, color: colors.textSecondary }}>
                    Updating...
                  </Text>
                </View>
              )}

              <MerryGoRoundRoundSelector
                colors={colors}
                merryGoRounds={merryGoRounds}
                selectedRound={selectedRound}
                onSelectRound={handleSelectRound}
                formatCurrency={formatCurrency}
              />

              {selectedRound && (
                <>
                  <MerryGoRoundCompactTop
                    colors={colors}
                    selectedRound={selectedRound}
                    isMemberLeft={isMemberLeft}
                    getMemberShortName={getMemberShortName}
                    onRefresh={loadMerryGoRounds}
                    loadRoundContributions={loadRoundContributions}
                    selectedRoundRef={selectedRoundRef}
                  />

                  <MerryGoRoundMemberOrderList
                    colors={colors}
                    selectedRound={selectedRound}
                    selectedRecipientPosition={selectedRecipientPosition}
                    setSelectedRecipientPosition={setSelectedRecipientPosition}
                    setContributorFilter={setContributorFilter}
                    setContributorSearch={setContributorSearch}
                    isMemberLeft={isMemberLeft}
                    getMemberName={getMemberName}
                  />

                  <MerryGoRoundContributorsTable
                    colors={colors}
                    selectedRound={selectedRound}
                    roundContributions={roundContributions}
                    contributorFilter={contributorFilter}
                    setContributorFilter={setContributorFilter}
                    contributorSearch={contributorSearch}
                    setContributorSearch={setContributorSearch}
                    selectedRecipientPosition={selectedRecipientPosition}
                    setSelectedRecipientPosition={setSelectedRecipientPosition}
                    isMemberLeft={isMemberLeft}
                    getMemberName={getMemberName}
                    getRowData={getRowData}
                    getPayoutDate={getPayoutDate}
                    formatCurrency={formatCurrency}
                  />

                  <MerryGoRoundActions
                    colors={colors}
                    theme={theme}
                    selectedRound={selectedRound}
                    user={user}
                    isMemberLeft={isMemberLeft}
                    navigation={navigation}
                    onRouteChange={onRouteChange}
                    onContributePress={handleContributePress}
                  />
                </>
              )}
            </>
          )}
        </ScrollView>

        <View style={{ position: 'absolute', right: spacing.md, bottom: 64, flexDirection: 'column', alignItems: 'center', gap: spacing.md, zIndex: 999 }}>
          <PageRefreshButton onRefresh={onRefresh} refreshing={refreshing} color={colors.primary} absolute={false} />
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (onRouteChange) onRouteChange('create-merry-go-round', 'CreateMerryGoRound');
              else navigation.navigate('CreateMerryGoRound', { chamaId });
            }}
          >
            <Ionicons name="add" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  fullPageLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  fab: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...shadows.lg },
});

export default MerryGoRoundScreen;
