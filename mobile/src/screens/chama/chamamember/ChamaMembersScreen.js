import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useApp } from '../../../context/AppContext';
import { getThemeColors } from '../../../utils/theme';
import ApiService from '../../../services/api';
import ChamaMembersHeaderCard from './ChamaMembersHeaderCard';
import ChamaMembersTable from './ChamaMembersTable';
import ChamaInvitationsList from './ChamaInvitationsList';
import ChamaMemberRoleModal from './ChamaMemberRoleModal';
import ChamaMembersLoading from './ChamaMembersLoading';
import { getFilteredMembers, roles } from './chamaMembersUtils';

const ChamaMembersScreen = ({ route, navigation, onRouteChange }) => {
  const { chamaId } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [userRole, setUserRole] = useState('member');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [activeTab, setActiveTab] = useState('members');
  const [sentInvitations, setSentInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const refreshIntervalRef = useRef(null);

  const canManageMembers = () => {
    return ['chairperson', 'secretary', 'treasurer'].includes(userRole);
  };

  const canManageRoles = () => {
    return userRole === 'chairperson';
  };

  const canExportMembers = () => {
    return ['chairperson', 'secretary', 'treasurer'].includes(userRole);
  };

  useEffect(() => {
    loadMembers();
    if (canManageMembers()) {
      loadSentInvitations();
    }

    refreshIntervalRef.current = setInterval(() => {
      loadMembers(true);
      if (canManageMembers()) {
        loadSentInvitations(true);
      }
    }, 30000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'invitations' && canManageMembers()) {
      loadSentInvitations();
    }
  }, [activeTab]);

  const loadMembers = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const response = await ApiService.getChamaMembers(chamaId);
      if (response.success) {
        const membersData = response.data || [];
        setMembers(membersData);

        // Member stats remain available for future stats cards.

        const currentUser = membersData.find(m => m.user_id === user?.id);
        const detectedRole = currentUser?.role || 'member';
        setUserRole(detectedRole);
      }
    } catch (error) {
      console.error('Failed to load members:', error);
      if (!silent) {
        Alert.alert('Error', 'Failed to load chama members. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSentInvitations = async (silent = false) => {
    if (!canManageMembers()) return;

    try {
      if (!silent) setInvitationsLoading(true);

      const response = await ApiService.getChamaSentInvitations(chamaId);
      if (response.success) {
        setSentInvitations(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load sent invitations:', error);
      if (!silent) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load invitations',
        });
      }
    } finally {
      if (!silent) setInvitationsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadMembers(),
      activeTab === 'invitations' ? loadSentInvitations() : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  const handleChangeRole = async (memberId, newRole) => {
    try {
      const response = await ApiService.updateMemberRole(chamaId, memberId, newRole);
      if (response.success) {
        Alert.alert('Success', 'Member role updated successfully');
        await loadMembers();
        setShowRoleModal(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update member role');
    }
  };

  const handleRemoveMember = (member) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.user?.first_name} ${member.user?.last_name} from the chama?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => confirmRemoveMember(member.id) },
      ]
    );
  };

  const confirmRemoveMember = async (memberId) => {
    try {
      const response = await ApiService.removeChamaMember(chamaId, memberId);
      if (response.success) {
        Alert.alert('Success', 'Member removed successfully');
        await loadMembers();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to remove member');
    }
  };

  const handleCancelInvitation = async (invitationId) => {
    Alert.alert(
      'Cancel Invitation',
      'Are you sure you want to cancel this invitation?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await ApiService.cancelInvitation(invitationId);
              if (response.success) {
                Toast.show({
                  type: 'success',
                  text1: 'Invitation Cancelled',
                  text2: 'The invitation has been cancelled successfully',
                });
                await loadSentInvitations();
              } else {
                throw new Error(response.error || 'Failed to cancel invitation');
              }
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to cancel invitation',
              });
            }
          },
        },
      ]
    );
  };

  const handleResendInvitation = async (invitationId) => {
    try {
      const response = await ApiService.resendInvitation(invitationId);
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Invitation Resent',
          text2: 'The invitation has been sent again',
        });
        await loadSentInvitations();
      } else {
        throw new Error(response.error || 'Failed to resend invitation');
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to resend invitation',
      });
    }
  };

  const handleExportMembers = async () => {
    if (exporting) return;
    setExporting(true);

    try {
      // Call backend export endpoint
      const blob = await ApiService.exportChamaMembers(chamaId);
      
      if (Platform.OS === 'web') {
        // Web: trigger download using blob
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const fileName = `ChamaMembers_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Native: convert blob to base64 and save
        const fileName = `ChamaMembers_${new Date().toISOString().split('T')[0]}.xlsx`;
        const fileUri = FileSystem.documentDirectory + fileName;
        
        // Convert blob to base64 - React Native compatible
        const base64data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result;
            if (typeof result === 'string') {
              resolve(result.split(',')[1]);
            } else {
              reject(new Error('Failed to read blob'));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        await FileSystem.writeAsStringAsync(fileUri, base64data, { 
          encoding: FileSystem.EncodingType.Base64 
        });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Export Members',
            UTI: 'org.openxmlformats.spreadsheetml.sheet',
          });
        }
      }
      
      Toast.show({
        type: 'success',
        text1: 'Export Ready',
        text2: 'Members list has been downloaded.',
      });
    } catch (error) {
      console.error('Export failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Export Failed',
        text2: error.message || 'Could not export members list.',
      });
    } finally {
      setExporting(false);
    }
  };

  const filteredMembers = useMemo(
    () => getFilteredMembers(members, searchQuery),
    [members, searchQuery]
  );

  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);

  const handleInvitePress = () => {
    if (onRouteChange) {
      onRouteChange('invite-members', 'InviteMembers', {
        userRole,
      });
    } else {
      navigation.navigate('InviteMembers', {
        chamaId,
        chamaName: route.params?.chamaName || 'Chama',
        userRole,
      });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ChamaMembersLoading />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <ChamaMembersHeaderCard
          activeTab={activeTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filteredMembersCount={filteredMembers.length}
          sentInvitationsCount={sentInvitations.length}
          canManageMembers={canManageMembers}
          canExportMembers={canExportMembers()}
          setActiveTab={setActiveTab}
          theme={theme}
          onExportMenuPress={handleExportMembers}
        />

        {activeTab === 'members' ? (
          <ChamaMembersTable
            filteredMembers={filteredMembers}
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            setCurrentPage={setCurrentPage}
            loading={loading}
            navigation={navigation}
            chamaId={chamaId}
            currentUser={user}
            userRole={userRole}
            searchQuery={searchQuery}
            theme={theme}
            onOpenRoleModal={(member) => {
              setSelectedMember(member);
              setShowRoleModal(true);
            }}
          />
        ) : (
          <ChamaInvitationsList
            invitations={sentInvitations}
            loading={invitationsLoading}
            searchQuery={searchQuery}
            onResendInvitation={handleResendInvitation}
            onCancelInvitation={handleCancelInvitation}
            theme={theme}
          />
        )}

        {canManageMembers() && (
          <TouchableOpacity
            style={{ position: 'absolute', bottom: 32, right: 32, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}
            onPress={handleInvitePress}
          >
            <Ionicons name="person-add" size={24} color={colors.white} />
          </TouchableOpacity>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      <ChamaMemberRoleModal
        visible={showRoleModal}
        selectedMember={selectedMember}
        roles={roles}
        canManageRoles={canManageRoles}
        onClose={() => {
          setShowRoleModal(false);
          setSelectedMember(null);
        }}
        onChangeRole={handleChangeRole}
        onRemoveMember={handleRemoveMember}
      />
    </SafeAreaView>
  );
};

export default ChamaMembersScreen;
