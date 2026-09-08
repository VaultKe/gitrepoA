import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
  Animated,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import usePollsVotingScreen from '../../../hooks/usePollsVotingScreen';
import PollItem from '../../../components/pollsandvoting/PollItem';
import PollVisualizations from '../../../components/pollsandvoting/PollVisualizations';
import VisualizationModal from '../../../components/pollsandvoting/VisualizationModal';
import EmptyState from '../../../components/pollsandvoting/EmptyState';
import SuccessBanner from '../../../components/pollsandvoting/SuccessBanner';
import TabNavigation from '../../../components/pollsandvoting/TabNavigation';

const PollsVotingScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [isDesktop, setIsDesktop] = useState(Dimensions.get('window').width >= 768);
  const [numColumns, setNumColumns] = useState(Dimensions.get('window').width >= 768 ? 2 : 1);
  const [floatingButtonPosition, setFloatingButtonPosition] = useState({ x: Dimensions.get('window').width - 80, y: Dimensions.get('window').height - 160 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Optional: Add visual feedback
      },
      onPanResponderMove: (evt, gestureState) => {
        const newX = floatingButtonPosition.x + gestureState.dx;
        const newY = floatingButtonPosition.y + gestureState.dy;
        const screenWidth = Dimensions.get('window').width;
        const screenHeight = Dimensions.get('window').height;
        const constrainedX = Math.max(0, Math.min(newX, screenWidth - 60));
        const constrainedY = Math.max(0, Math.min(newY, screenHeight - 60));
        setFloatingButtonPosition({ x: constrainedX, y: constrainedY });
      },
      onPanResponderRelease: () => {
        // Optional: Snap to edge or something
      },
    })
  ).current;

  useEffect(() => {
    const updateLayout = ({ window }) => {
      const width = window.width;
      const height = window.height;
      const desktop = width >= 768;
      setScreenWidth(width);
      setIsDesktop(desktop);
      setNumColumns(desktop ? (width >= 1200 ? 3 : 2) : 1);

      setFloatingButtonPosition(prev => ({
        x: Math.min(prev.x, width - 60),
        y: Math.min(prev.y, height - 60)
      }));
    };

    const subscription = Dimensions.addEventListener('change', updateLayout);
    return () => subscription?.remove();
  }, []);

  const {
    chamaId,
    loading,
    refreshing,
    activeTab,
    setActiveTab,
    polls,
    votes,
    allPolls,
    completedPolls,
    chamaDetails,
    currentPage,
    setCurrentPage,
    pageSize,
    userRole,
    chamaMembers,
    filteredMembers,
    memberSearchQuery,
    loadError,
    lastSyncedAt,
    totalPollCount,
    retryCount,
    showSuccessBanner,
    successMessage,
    showVisualizationModal,
    selectedVisualizationPoll,
    pollForm,
    setPollForm,
    roleForm,
    setRoleForm,
    onRefresh,
    handleRetry,
    openVisualizationModal,
    closeVisualizationModal,
    handleCreatePoll,
    handleVote,
    resetPollForm,
    resetRoleForm,
    handleMemberSearch,
    handleSelectCandidate,
    addPollOption,
    removePollOption,
    updatePollOption,
    canCreatePolls,
    canCreateRoleEscalation,
    getMemberName,
    getMemberEmail,
    formatTableDate,
    getPollTypeColor,
    getStatusColor,
    getTotalVotesCast,
    getTotalEligibleVoters,
    getVotePercentage,
    isPollFullyVoted,
  } = usePollsVotingScreen({ route, navigation });

  const openCreateModal = () => {
    navigation.navigate('CreatePoll', { chamaId });
  };

  // Refresh the list when returning from the Create Poll page.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (chamaId) onRefresh();
    });
    return unsub;
  }, [navigation, chamaId, onRefresh]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Success Banner */}
      <SuccessBanner
        colors={colors}
        message={successMessage}
        onClose={() => {
          setShowSuccessBanner(false);
          setSuccessMessage('');
        }}
      />

      {/* Tab Navigation */}
      <TabNavigation
        colors={colors}
        isDesktop={isDesktop}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenCreateModal={openCreateModal}
        canCreatePolls={canCreatePolls}
      />

      {/* Content */}
      <View style={{ flex: 1, position: 'relative' }}>
        <FlatList
          data={activeTab === 'completed' ? completedPolls : polls}
          renderItem={({ item, index }) => (
            <PollItem
              item={item}
              colors={colors}
              isDesktop={isDesktop}
              screenWidth={screenWidth}
              numColumns={numColumns}
              getMemberName={getMemberName}
              getMemberEmail={getMemberEmail}
              formatTableDate={formatTableDate}
              getPollTypeColor={getPollTypeColor}
              getStatusColor={getStatusColor}
              getTotalVotesCast={getTotalVotesCast}
              getTotalEligibleVoters={getTotalEligibleVoters}
              getVotePercentage={getVotePercentage}
              isPollFullyVoted={isPollFullyVoted}
              onVote={handleVote}
              onOpenVisualization={openVisualizationModal}
            />
          )}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            isDesktop && styles.listContentDesktop
          ]}
          numColumns={numColumns}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              colors={colors}
              isDesktop={isDesktop}
              loading={loading}
              loadError={loadError}
              activeTab={activeTab}
              onRetry={handleRetry}
              lastSyncedAt={lastSyncedAt}
              totalPollCount={totalPollCount}
              activeCount={polls.length}
              completedCount={completedPolls.length}
            />
          }
        />

        {/* Floating Action Buttons */}
        <View style={{ position: 'absolute', right: spacing.md, bottom: 64, flexDirection: 'column', alignItems: 'center', gap: spacing.md, zIndex: 999 }}>
          <PageRefreshButton onRefresh={onRefresh} refreshing={refreshing} color={colors.primary} bottom={64} absolute={false} />
        </View>
      </View>

      {/* Visualization Modal */}
      <VisualizationModal
        colors={colors}
        isDesktop={isDesktop}
        visible={showVisualizationModal}
        onClose={closeVisualizationModal}
        poll={selectedVisualizationPoll}
        formatTableDate={formatTableDate}
        getPollTypeColor={getPollTypeColor}
        getStatusColor={getStatusColor}
        getTotalVotesCast={getTotalVotesCast}
        getTotalEligibleVoters={getTotalEligibleVoters}
        getVotePercentage={getVotePercentage}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  listContentDesktop: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
});

export default PollsVotingScreen;
