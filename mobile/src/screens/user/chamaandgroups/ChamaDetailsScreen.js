import React from 'react';
import {
  View,
  ScrollView,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useApp } from '../../../context/AppContext';
import { getThemeColors } from '../../../utils/theme';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import DestructiveConfirmModal from '../../../components/common/DestructiveConfirmModal';
import getResponsiveStyles from '../../../styles/ChamaDetailsScreenStyles';
import useChamaDetails from '../../../hooks/useChamaDetails';
import ChamaHeader from '../../../components/chama-details/ChamaHeader';
import ChamaStats from '../../../components/chama-details/ChamaStats';
import ChamaMembers from '../../../components/chama-details/ChamaMembers';
import ChamaMeetings from '../../../components/chama-details/ChamaMeetings';
import ChamaTransactions from '../../../components/chama-details/ChamaTransactions';
import ChamaPolls from '../../../components/chama-details/ChamaPolls';
import ChamaRules from '../../../components/chama-details/ChamaRules';
import ChamaUploadRules from '../../../components/chama-details/ChamaUploadRules';
import ChamaGroupChat from '../../../components/chama-details/ChamaGroupChat';
import ChamaMembershipActions from '../../../components/chama-details/ChamaMembershipActions';
import SmartResponsiveLayout from '../../../components/chama-details/SmartResponsiveLayout';
import MemberAvatar from '../../../components/chama-details/MemberAvatar';

const ChamaDetailsScreen = ({ route, navigation }) => {
  const { theme, setSelectedChama, switchToChamaDashboard } = useApp();
  const colors = getThemeColors(theme);
  const details = useChamaDetails({ route, navigation });
  const styles = getResponsiveStyles(details.screenType, details.screenWidth, colors);

  const handleAvatarPress = (member) => {
    navigation.navigate('ViewMember', {
      memberId: member?.user_id || member?.id,
      chamaId: details.chamaId,
      userRole: details.userMembership?.role,
    });
  };

  const handleOpenRulesFile = () => {
    const rawRulesFilePath = (details.chama?.rules_file_path && details.chama.rules_file_path.trim()) ||
      (details.chama?.permissions && details.chama.permissions.rules_file_path);
    const rulesFilePath = rawRulesFilePath ? rawRulesFilePath.trim() : null;
    if (!rulesFilePath) return;

    navigation.navigate('DocumentViewer', {
      documentUrl: rulesFilePath,
      documentName: details.chama?.rules_file_name || 'Rules Document',
      title: 'Chama Rules Document',
      chamaId: details.chamaId,
    });
  };

  const renderMemberAvatar = (member) => {
    return (
      <MemberAvatar
        member={member}
        colors={colors}
        onAvatarPress={handleAvatarPress}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          key={details.chamaId}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={details.refreshing}
              onRefresh={details.onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <ChamaHeader chama={details.chama} colors={colors} getGroupLabel={details.getGroupLabel} />
          <ChamaStats
            statistics={details.statistics}
            chama={details.chama}
            members={details.members}
            polls={details.polls}
            formatCurrency={details.formatCurrency}
            colors={colors}
          />

          <SmartResponsiveLayout isLargeScreen={details.isLargeScreen}>
            <ChamaMembers
              members={details.members}
              colors={colors}
              navigation={navigation}
              chamaId={details.chamaId}
              renderMemberAvatar={renderMemberAvatar}
              handleAvatarPress={handleAvatarPress}
              userMembership={details.userMembership}
            />
            <ChamaMeetings
              meetings={details.meetings}
              colors={colors}
              navigation={navigation}
              chamaId={details.chamaId}
              getResponsiveTextSize={details.getResponsiveTextSize}
            />
            <ChamaTransactions
              transactions={details.transactions}
              colors={colors}
              navigation={navigation}
              chamaId={details.chamaId}
              chama={details.chama}
              setSelectedChama={setSelectedChama}
              formatCurrency={details.formatCurrency}
              getResponsiveTextSize={details.getResponsiveTextSize}
            />
            <ChamaPolls
              polls={details.polls}
              pollsLoading={details.pollsLoading}
              colors={colors}
              navigation={navigation}
              chamaId={details.chamaId}
              getResponsiveTextSize={details.getResponsiveTextSize}
            />
          </SmartResponsiveLayout>

          {details.isLargeScreen ? (
            <View style={styles.desktopBottomRow}>
              <View style={styles.desktopRulesColumn}>
                <ChamaRules chama={details.chama} colors={colors} handleOpenRulesFile={handleOpenRulesFile} />
              </View>
              <View style={styles.desktopSideColumn}>
                <ChamaUploadRules
                  userMembership={details.userMembership}
                  colors={colors}
                  handleUploadRulesFile={details.handleUploadRulesFile}
                  handleRemoveRulesFile={details.handleRemoveRulesFile}
                  uploadingRules={details.uploadingRules}
                  rulesFilePath={details.chama?.rules_file_path}
                />
                <ChamaGroupChat
                  userMembership={details.userMembership}
                  chama={details.chama}
                  colors={colors}
                  getExistingChatRoomId={details.getExistingChatRoomId}
                  getGroupLabel={details.getGroupLabel}
                  handleCreateChatRoom={details.handleCreateChatRoom}
                  navigateToChatRoom={details.navigateToChatRoom}
                  chatRoomLoading={details.chatRoomLoading}
                />
                <ChamaMembershipActions
                  userMembership={details.userMembership}
                  chama={details.chama}
                  colors={colors}
                  handleJoinChama={details.handleJoinChama}
                  handleLeaveChama={details.handleLeaveChama}
                  switchToChamaDashboard={switchToChamaDashboard}
                />
              </View>
            </View>
          ) : (
            <>
              <ChamaRules chama={details.chama} colors={colors} handleOpenRulesFile={handleOpenRulesFile} />
              <ChamaUploadRules
                userMembership={details.userMembership}
                colors={colors}
                handleUploadRulesFile={details.handleUploadRulesFile}
                handleRemoveRulesFile={details.handleRemoveRulesFile}
                uploadingRules={details.uploadingRules}
                rulesFilePath={details.chama?.rules_file_path}
              />
              <ChamaGroupChat
                userMembership={details.userMembership}
                chama={details.chama}
                colors={colors}
                getExistingChatRoomId={details.getExistingChatRoomId}
                getGroupLabel={details.getGroupLabel}
                handleCreateChatRoom={details.handleCreateChatRoom}
                navigateToChatRoom={details.navigateToChatRoom}
                chatRoomLoading={details.chatRoomLoading}
              />
              <ChamaMembershipActions
                userMembership={details.userMembership}
                chama={details.chama}
                colors={colors}
                handleJoinChama={details.handleJoinChama}
                handleLeaveChama={details.handleLeaveChama}
                switchToChamaDashboard={switchToChamaDashboard}
              />
            </>
          )}
        </ScrollView>
        <PageRefreshButton onRefresh={details.onRefresh} refreshing={details.refreshing} color={colors.primary} bottom={64} />
      </View>

      <DestructiveConfirmModal
        visible={details.showLeaveModal}
        onClose={() => details.setShowLeaveModal(false)}
        onConfirm={details.confirmLeaveChama}
        chamaName={details.chama?.name}
        action="leave"
      />
    </SafeAreaView>
  );
};

export default ChamaDetailsScreen;
