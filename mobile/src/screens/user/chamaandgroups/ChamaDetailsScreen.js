import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
  Linking,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import ApiService from '../../../services/api';
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
  const { theme, user, setSelectedChama, switchToChamaDashboard } = useApp();
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

  const handleOpenRulesFile = async () => {
    const rawRulesFilePath = (details.chama?.rules_file_path && details.chama.rules_file_path.trim()) ||
      (details.chama?.permissions && details.chama.permissions.rules_file_path);
    const rulesFilePath = rawRulesFilePath ? rawRulesFilePath.trim() : null;
    if (!rulesFilePath) return;
    const fullUrl = rulesFilePath.startsWith('http')
      ? rulesFilePath
      : `${ApiService.uploadBaseUrl}${rulesFilePath.startsWith('/') ? '' : '/'}${rulesFilePath}`;
    try {
      const supported = await Linking.canOpenURL(fullUrl);
      if (supported) {
        await Linking.openURL(fullUrl);
      } else {
        Alert.alert('Unable to open', 'No application is available to open the rules document.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open the rules document.');
    }
  };

  const renderMemberAvatar = (member) => {
    return (
      <MemberAvatar
        member={member}
        colors={colors}
        onAvatarPress={handleAvatarPress}
        apiUploadBaseUrl={ApiService.uploadBaseUrl}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          key={details.chamaId}
          style={styles.scrollView}
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
