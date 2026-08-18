import React from 'react';
import {
  View,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Text,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing } from '../../../utils/theme';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import useChamaMembersScreen from '../../../hooks/useChamaMembersScreen';
import { roles } from '../../../utils/chamaMembersUtils';
import ChamaMembersHeaderCard from '../../../components/chama-members/ChamaMembersHeaderCard';
import ChamaMembersTable from '../../../components/chama-members/ChamaMembersTable';
import ChamaInvitationsList from '../../../components/chama-members/ChamaInvitationsList';
import ChamaMemberRoleModal from '../../../components/chama-members/ChamaMemberRoleModal';

const ChamaMembersScreen = ({ route, navigation, onRouteChange }) => {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  const screen = useChamaMembersScreen({ route, navigation, onRouteChange, user });

  const {
    activeTab,
    searchQuery,
    setSearchQuery,
    filteredMembers,
    sentInvitations,
    invitationsLoading,
    refreshing,
    loading,
    currentPage,
    totalPages,
    itemsPerPage,
    setCurrentPage,
    canManageMembers,
    canManageRoles,
    canExportMembers,
    setActiveTab,
    selectedMember,
    showRoleModal,
    setShowRoleModal,
    userRole,
    onRefresh,
    handleExportMembers,
    handleInvitePress,
    handleRemoveMember,
    confirmRemoveMember,
    handleCancelInvitation,
    handleResendInvitation,
    handleChangeRole,
    showRemoveConfirm,
    setShowRemoveConfirm,
    removing,
    removeTarget,
  } = screen;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, position: 'relative' }}>
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
          <View style={{ flex: 1 }}>
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
                chamaId={route.params.chamaId}
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

            <View style={{ height: 60 }} />
          </View>
        </ScrollView>

        {canManageMembers() && (
          <View style={{ position: 'absolute', right: spacing.md, bottom: 64, flexDirection: 'column', alignItems: 'center', gap: spacing.md, zIndex: 999 }}>
            <PageRefreshButton onRefresh={onRefresh} refreshing={refreshing} color={colors.primary} absolute={false} />
            <TouchableOpacity
              style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}
              onPress={handleInvitePress}
            >
              <Ionicons name="person-add" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal visible={showRemoveConfirm} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }} activeOpacity={1} onPress={() => setShowRemoveConfirm(false)}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: colors.error + '40' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.error, marginBottom: 8 }}>Remove Member</Text>
            <Text style={{ fontSize: 14, color: colors.text, marginBottom: 20, lineHeight: 20 }}>
              Are you sure you want to remove {removeTarget?.user?.first_name} {removeTarget?.user?.last_name} from the chama? This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, minWidth: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }} onPress={() => setShowRemoveConfirm(false)} disabled={removing}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, minWidth: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.error }} onPress={confirmRemoveMember} disabled={removing}>
                {removing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Remove</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

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
