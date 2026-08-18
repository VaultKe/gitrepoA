import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';
import FormErrorMessage from './FormErrorMessage';
import InvitationModeSelector from './InvitationModeSelector';
import RoleSelector from './RoleSelector';
import EmailInvitationForm from './EmailInvitationForm';
import UserSearchResults from './UserSearchResults';
import SelectedUsersList from './SelectedUsersList';

const InvitationForm = ({
  canInvite,
  invitationMode,
  setInvitationMode,
  selectedRole,
  setSelectedRole,
  userRoles,
  formErrors,
  showErrors,
  availableRoles,
  email,
  phoneNumber,
  setEmail,
  setPhoneNumber,
  message,
  setMessage,
  searchQuery,
  setSearchQuery,
  searchLoading,
  searchResults,
  selectedUsers,
  showUserSearch,
  searchUsers,
  addSelectedUser,
  removeSelectedUser,
  updateUserRole,
  handleSendInvitation,
  loading,
  colors,
  chamaName,
  onRouteChange,
  navigation,
}) => {
  if (!canInvite) {
    return (
      <View style={styles.accessDeniedContainer}>
        <Ionicons name="lock-closed" size={64} color={colors.textSecondary} />
        <Text style={[styles.accessDeniedTitle, { color: colors.text }]}>
          Access Denied
        </Text>
        <Text style={[styles.accessDeniedText, { color: colors.textSecondary }]}>
          Only chairperson, secretary, and treasurer can send member invitations.
        </Text>
        <TouchableOpacity
          style={[styles.backToMembersButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            if (onRouteChange) {
              onRouteChange('members', 'ChamaMembersScreen');
            } else {
              navigation.goBack();
            }
          }}
        >
          <Text style={styles.backToMembersButtonText}>Back to Members</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
        <Ionicons name="information-circle" size={24} color={colors.primary} />
        <View style={styles.infoTextContainer}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>
            Invite New Members
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Send invitations to join {chamaName}. You can invite by email or search for existing users.
          </Text>
        </View>
      </View>

      <View style={[styles.modeCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Invitation Method
        </Text>
        <InvitationModeSelector
          invitationMode={invitationMode}
          onModeChange={setInvitationMode}
          colors={colors}
        />
      </View>

      <RoleSelector
        availableRoles={availableRoles}
        selectedRole={selectedRole}
        onSelectRole={setSelectedRole}
        formErrors={formErrors}
        showErrors={showErrors}
        colors={colors}
        invitationMode={invitationMode}
      />

      {invitationMode === 'email' && (
        <EmailInvitationForm
          email={email}
          phoneNumber={phoneNumber}
          onEmailChange={(text) => {
            setEmail(text.replace(/[<>\"'&]/g, '').trim().substring(0, 254));
            if (formErrors.email) {
              formErrors.email = undefined;
            }
          }}
          onPhoneChange={(text) => {
            setPhoneNumber(text.replace(/[^0-9\s\-+()]/g, '').trim().substring(0, 20));
            if (formErrors.phone) {
              formErrors.phone = undefined;
            }
          }}
          showErrors={showErrors}
          formErrors={formErrors}
          colors={colors}
        />
      )}

      {invitationMode === 'users' && (
        <View style={[styles.formCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Search & Select Users
          </Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              Search Users
            </Text>
            <View style={styles.searchContainer}>
              <TextInput
                style={[styles.searchInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  searchUsers(text);
                }}
                placeholder="Search by name, email, or phone..."
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
              />
              {searchLoading && (
                <ActivityIndicator size="small" color={colors.primary} style={styles.searchLoader} />
              )}
            </View>
          </View>

          <UserSearchResults
            searchResults={searchResults}
            searchLoading={searchLoading}
            onSelectUser={addSelectedUser}
            colors={colors}
          />

          <SelectedUsersList
            selectedUsers={selectedUsers}
            userRoles={userRoles}
            availableRoles={availableRoles}
            selectedRole={selectedRole}
            onRemoveUser={removeSelectedUser}
            onCycleRole={updateUserRole}
            colors={colors}
          />
        </View>
      )}

      <View style={[styles.formCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginTop: 16 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Personal Message
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>
            Custom Message (Optional)
          </Text>
          <TextInput
            style={[
              styles.textArea,
              {
                backgroundColor: colors.background,
                borderColor: showErrors && formErrors.message ? colors.error : colors.border,
                color: colors.text
              }
            ]}
            value={message}
            onChangeText={(text) => {
              setMessage(text.replace(/[<>\"'&]/g, '').trim().substring(0, 500));
              if (formErrors.message) {
                formErrors.message = undefined;
              }
            }}
            placeholder={`You have been invited to join ${chamaName} as a ${availableRoles.find(r => r.id === selectedRole)?.name}!`}
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          {showErrors && formErrors.message && (
            <FormErrorMessage error={formErrors.message} showErrors={showErrors} colors={colors} />
          )}
        </View>

        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
          onPress={handleSendInvitation}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="send" size={20} color="white" />
          )}
          <Text style={styles.sendButtonText}>
            {loading ? 'Sending...' :
              invitationMode === 'users' && selectedUsers.length > 1
                ? `Send ${selectedUsers.length} Invitations`
                : 'Send Invitation'
            }
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = {
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  formCard: {
    padding: 20,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 10,
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modeCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  searchContainer: {
    position: 'relative',
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    paddingRight: 40,
  },
  searchLoader: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
  },
  accessDeniedText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  backToMembersButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backToMembersButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
};

export default InvitationForm;
