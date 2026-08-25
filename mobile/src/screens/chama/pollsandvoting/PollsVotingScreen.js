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
import CompletedPollsTable from '../../../components/pollsandvoting/CompletedPollsTable';
import PollVisualizations from '../../../components/pollsandvoting/PollVisualizations';
import CreatePollModal from '../../../components/pollsandvoting/CreatePollModal';
import RoleEscalationModal from '../../../components/pollsandvoting/RoleEscalationModal';
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
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
    chamaDetails,
    completedPolls,
    currentPage,
    setCurrentPage,
    pageSize,
    userRole,
    chamaMembers,
    filteredMembers,
    memberSearchQuery,
    loadError,
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
    getPaginatedCompletedPolls,
    getTotalPages,
    handlePageChange,
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
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
  };

  const handleRoleEscalationSubmit = async () => {
    // Reuse handleCreatePoll for role escalation
    await handleCreatePoll();
    setShowRoleModal(false);
  };

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
        {activeTab === 'completed' ? (
          <ScrollView
            style={{ flex: 1 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
          >
            <View style={{ padding: spacing.sm }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Completed Polls - {chamaDetails?.name || `Chama ${chamaId?.slice(-8) || 'Unknown'}`}
              </Text>
              <CompletedPollsTable
                colors={colors}
                paginatedPolls={getPaginatedCompletedPolls()}
                totalPages={getTotalPages()}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                onOpenVisualization={openVisualizationModal}
                formatTableDate={formatTableDate}
                getPollTypeColor={getPollTypeColor}
                getStatusColor={getStatusColor}
                getTotalVotesCast={getTotalVotesCast}
                getTotalEligibleVoters={getTotalEligibleVoters}
              />
            </View>
          </ScrollView>
        ) : (
          <FlatList
            data={polls}
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
              />
            }
          />
        )}

        {/* Floating Action Buttons */}
        <View style={{ position: 'absolute', right: spacing.md, bottom: 64, flexDirection: 'column', alignItems: 'center', gap: spacing.md, zIndex: 999 }}>
          <PageRefreshButton onRefresh={onRefresh} refreshing={refreshing} color={colors.primary} bottom={64} absolute={false} />
        </View>
      </View>

      {/* Create Poll Modal */}
      <CreatePollModal
        colors={colors}
        isDesktop={isDesktop}
        visible={showCreateModal}
        onClose={closeCreateModal}
        pollForm={pollForm}
        setPollForm={setPollForm}
        roleForm={roleForm}
        chamaMembers={chamaMembers}
        filteredMembers={filteredMembers}
        memberSearchQuery={memberSearchQuery}
        userRole={userRole}
        onMemberSearch={handleMemberSearch}
        onSelectCandidate={handleSelectCandidate}
        onAddOption={addPollOption}
        onRemoveOption={removePollOption}
        onUpdateOption={updatePollOption}
        onSubmit={handleCreatePoll}
        getMemberName={getMemberName}
        getMemberEmail={getMemberEmail}
      />

      {/* Role Escalation Modal */}
      <RoleEscalationModal
        colors={colors}
        visible={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        roleForm={roleForm}
        setRoleForm={setRoleForm}
        chamaMembers={chamaMembers}
        filteredMembers={filteredMembers}
        memberSearchQuery={memberSearchQuery}
        userRole={userRole}
        onMemberSearch={handleMemberSearch}
        onSelectCandidate={handleSelectCandidate}
        onSubmit={handleRoleEscalationSubmit}
        getMemberName={getMemberName}
        getMemberEmail={getMemberEmail}
      />

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
