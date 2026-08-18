import React from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing } from '../../../utils/theme';
import useInviteMembers from '../../../hooks/useInviteMembers';
import InvitationForm from '../../../components/chama-meeting/InvitationForm';

const InviteMembers = ({ route, navigation, onRouteChange }) => {
  const { theme } = useApp();
  const screen = useInviteMembers({ route, navigation, onRouteChange });

  const {
    canInvite,
    invitationMode,
    setInvitationMode,
    selectedRole,
    setSelectedRole,
    userRoles,
    formErrors,
    showErrors,
    availableRoles,
    email, setEmail,
    phoneNumber, setPhoneNumber,
    message, setMessage,
    searchQuery, setSearchQuery,
    searchLoading,
    searchResults,
    selectedUsers,
    searchUsers,
    addSelectedUser,
    removeSelectedUser,
    updateUserRole,
    handleSendInvitation,
    loading,
    colors,
    chamaName,
  } = screen;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <InvitationForm
          canInvite={canInvite}
          invitationMode={invitationMode}
          setInvitationMode={setInvitationMode}
          selectedRole={selectedRole}
          setSelectedRole={setSelectedRole}
          userRoles={userRoles}
          formErrors={formErrors}
          showErrors={showErrors}
          availableRoles={availableRoles}
          email={email}
          phoneNumber={phoneNumber}
          setEmail={setEmail}
          setPhoneNumber={setPhoneNumber}
          message={message}
          setMessage={setMessage}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchLoading={searchLoading}
          searchResults={searchResults}
          selectedUsers={selectedUsers}
          searchUsers={searchUsers}
          addSelectedUser={addSelectedUser}
          removeSelectedUser={removeSelectedUser}
          updateUserRole={updateUserRole}
          handleSendInvitation={handleSendInvitation}
          loading={loading}
          colors={colors}
          chamaName={chamaName}
          onRouteChange={onRouteChange}
          navigation={navigation}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
});

export default InviteMembers;
