import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../../../services/api';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';

const ONBOARDING_DRAFT_KEY = 'createChama_onboarding_draft';

const CreateChamaStep3 = ({
  chamaData,
  onboardedMembers,
  onAddMember,
  onUpdateMember,
  user,
  colors,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [foundUser, setFoundUser] = useState(null);
  const [showUserForm, setShowUserForm] = useState(false);

  const [userForm, setUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    idNumber: '',
    gender: '',
  });

  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailExists, setEmailExists] = useState(false);

  const genderOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
  ];

  const [formErrors, setFormErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);

  const [onboardingPhase, setOnboardingPhase] = useState('search');
  const [totpCode, setTotpCode] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpVerified, setTotpVerified] = useState(false);

  const [onboardLoading, setOnboardLoading] = useState(false);
  const [editingRole, setEditingRole] = useState(null);

  const memberRoles = [
    { id: 'member', name: 'Member', description: 'Regular member with basic privileges' },
    { id: 'treasurer', name: 'Treasurer', description: 'Manages finances and transactions' },
    { id: 'secretary', name: 'Secretary', description: 'Keeps records and manages communications' },
  ];

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const saved = await AsyncStorage.getItem(ONBOARDING_DRAFT_KEY);
        if (saved) {
          const draft = JSON.parse(saved);
          if (draft.phoneNumber) setPhoneNumber(draft.phoneNumber);
          if (draft.nationalId) setNationalId(draft.nationalId);
          if (draft.userForm) setUserForm(draft.userForm);
          if (draft.onboardingPhase) setOnboardingPhase(draft.onboardingPhase);
          if (draft.foundUser) setFoundUser(draft.foundUser);
        }
      } catch (e) {
        console.error('Failed to load onboarding draft:', e);
      }
    };
    loadDraft();
  }, []);

  useEffect(() => {
    const saveDraft = async () => {
      try {
        await AsyncStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify({
          phoneNumber,
          nationalId,
          userForm,
          onboardingPhase,
          foundUser,
        }));
      } catch (e) {
        console.error('Failed to save onboarding draft:', e);
      }
    };
    saveDraft();
  }, [phoneNumber, nationalId, userForm, onboardingPhase, foundUser]);

  const searchUser = async () => {
    if (!phoneNumber && !nationalId) {
      Toast.show({ type: 'error', text1: 'Enter phone number and national ID to search' });
      return;
    }

    if (!phoneNumber || !nationalId) {
      Toast.show({ type: 'error', text1: 'Both phone number and national ID are required' });
      return;
    }

    setSearchLoading(true);
    setFoundUser(null);
    setShowUserForm(false);

    try {
      const response = await ApiService.searchUserByCredentials(phoneNumber, nationalId);
      console.log('Search credentials response:', response);

      if (response.success && response.data && response.match) {
        setFoundUser(response.data);
        setOnboardingPhase('confirm');
        return;
      }

      if (response.success === false && response.error) {
        if (response.error.includes('Credential mismatch')) {
          Toast.show({
            type: 'error',
            text1: 'Credential Mismatch',
            text2: 'Phone number and National ID do not belong to the same user. This may indicate credential sharing.',
            visibilityTime: 5000,
          });
        } else if (response.error.includes('not found')) {
          Toast.show({
            type: 'error',
            text1: 'Incomplete Credentials',
            text2: response.error,
            visibilityTime: 4000,
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Not Found',
            text2: response.error,
            visibilityTime: 4000,
          });
        }
      }

      setShowUserForm(true);
      setOnboardingPhase('new_user');
      setUserForm(prev => ({
        ...prev,
        phone: phoneNumber,
        idNumber: nationalId,
      }));
    } catch (error) {
      console.log('Search error:', error);
      Toast.show({ type: 'error', text1: 'Search failed', text2: error.message });
      setShowUserForm(true);
      setOnboardingPhase('new_user');
      setUserForm(prev => ({
        ...prev,
        phone: phoneNumber,
        idNumber: nationalId,
      }));
    } finally {
      setSearchLoading(false);
    }
  };

  const handleUserFormChange = (field, value) => {
    setUserForm(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (field === 'email') {
      checkEmailUniqueness(value);
    }
  };

  const checkEmailUniqueness = async (email) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailExists(false);
      return;
    }
    setEmailChecking(true);
    try {
      const response = await ApiService.searchUsers(email.trim());
      if (response.success && response.data && response.data.length > 0) {
        setEmailExists(true);
      } else {
        setEmailExists(false);
      }
    } catch (error) {
      setEmailExists(false);
    } finally {
      setEmailChecking(false);
    }
  };

  const generateDevTOTP = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('========================================');
    console.log('DEV TOTP (onboarding verification):', code);
    console.log('========================================');
    Toast.show({ type: 'info', text1: 'Dev mode: TOTP printed to terminal', text2: `Code: ${code}`, visibilityTime: 5000 });
    return code;
  };

  const sendTOTP = async () => {
    const phone = foundUser?.phoneNumber || foundUser?.phone || userForm.phone;
    const userId = foundUser?.id || 'new';
    setTotpLoading(true);
    try {
      const response = await ApiService.sendOnboardingTOTP(phone, userId);
      if (response.success) {
        const devCode = response.data?.devCode || generateDevTOTP();
        console.log('========================================');
        console.log('DEV TOTP (onboarding verification):', devCode);
        console.log('========================================');
        setTotpCode(devCode);
        Toast.show({ type: 'success', text1: 'Verification code sent to phone', text2: `Dev: ${devCode}`, visibilityTime: 5000 });
      } else {
        throw new Error(response.error || 'Failed to send code');
      }
    } catch (error) {
      console.log('TOTP API failed (expected in dev):', error.message);
      const devCode = generateDevTOTP();
      setTotpCode(devCode);
    } finally {
      setTotpLoading(false);
    }
  };

  const validateUserForm = () => {
    const errors = {};
    if (!userForm.firstName.trim()) errors.firstName = 'First name is required';
    if (!userForm.lastName.trim()) errors.lastName = 'Last name is required';
    if (userForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email.trim())) {
      errors.email = 'Invalid email address';
    }
    if (emailExists) {
      errors.email = 'This email is already registered';
    }
    if (!userForm.phone.trim()) errors.phone = 'Phone number is required';
    if (!userForm.idNumber.trim()) errors.idNumber = 'National ID is required';
    setFormErrors(errors);
    setShowErrors(true);
    return Object.keys(errors).length === 0;
  };

  const confirmExistingUser = () => {
    setOnboardingPhase('totp');
  };

  useEffect(() => {
    if (onboardingPhase === 'totp' && !totpVerified) {
      sendTOTP();
    }
  }, [onboardingPhase]);

  const verifyTOTP = async () => {
    if (!totpCode || totpCode.length < 6) {
      Toast.show({ type: 'error', text1: 'Enter the 6-digit code' });
      return;
    }
    setTotpLoading(true);
    try {
      const phone = foundUser?.phoneNumber || foundUser?.phone || userForm.phone;
      const userId = foundUser?.id || 'new';
      const response = await ApiService.verifyOnboardingTOTP(totpCode, userId);
      if (response.success) {
        setTotpVerified(true);
        Toast.show({ type: 'success', text1: 'Phone verified successfully' });
        onboardMember();
      } else {
        Toast.show({ type: 'error', text1: response.error || 'Invalid code' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Verification failed', text2: error.message });
    } finally {
      setTotpLoading(false);
    }
  };

  const onboardMember = async (role = 'member') => {
    if (!foundUser && !validateUserForm()) return;

    setOnboardLoading(true);
    try {
      const memberData = {
        ...(foundUser || userForm),
        role,
        phoneVerified: totpVerified,
        serviceFeeStatus: 'pending',
        onboardedAt: new Date().toISOString(),
      };

      if (!foundUser) {
        const createResponse = await ApiService.onboardUser({
          ...userForm,
          password: null,
        });
        if (createResponse.success && createResponse.data) {
          memberData.id = createResponse.data.id;
        }
      } else {
        memberData.id = foundUser.id;
      }

      onAddMember(memberData);
      resetOnboarding();
      Toast.show({ type: 'success', text1: 'Member onboarded successfully' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Onboarding failed', text2: error.message });
    } finally {
      setOnboardLoading(false);
    }
  };

  const resetOnboarding = () => {
    setPhoneNumber('');
    setNationalId('');
    setFoundUser(null);
    setShowUserForm(false);
    setUserForm({ firstName: '', lastName: '', email: '', phone: '', idNumber: '', gender: '' });
    setFormErrors({});
    setShowErrors(false);
    setOnboardingPhase('search');
    setTotpCode('');
    setTotpVerified(false);
  };

  const updateMemberStatus = (memberId, field, value) => {
    onUpdateMember(memberId, { [field]: value });
  };

  const renderSearchSection = () => (
    <Card style={styles.section}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        Onboard New Members
      </Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
        Enter a member's phone number and national ID to search or start onboarding.
      </Text>

      <View style={styles.row}>
        <Input
          label="Phone Number"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="e.g., 0712345678"
          keyboardType="phone-pad"
          style={styles.halfInput}
        />
        <Input
          label="National ID"
          value={nationalId}
          onChangeText={setNationalId}
          placeholder="e.g., 12345678"
          keyboardType="numeric"
          style={styles.halfInput}
        />
      </View>

      <Button
        title={searchLoading ? 'Searching...' : 'Search User'}
        onPress={searchUser}
        loading={searchLoading}
        style={styles.searchButton}
      />
    </Card>
  );

  const renderConfirmExistingUser = () => (
    <Card style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={[styles.stepTitle, { color: colors.text, alignItems: 'center' }]}>
          Confirm User Details
        </Text>
      </View>

      <View style={styles.userCard}>
        <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.userInitials, { color: colors.white }]}>
            {foundUser.firstName?.[0]}{foundUser.lastName?.[0]}
          </Text>
        </View>
        <View style={styles.userDetails}>
          <Text style={[styles.userName, { color: colors.text }]}>
            {foundUser.firstName} {foundUser.lastName}
          </Text>
          <Text style={[styles.userContact, { color: colors.textSecondary }]}>
            {foundUser.email}
          </Text>
          <Text style={[styles.userContact, { color: colors.textSecondary }]}>
            {foundUser.phoneNumber || foundUser.phone}
          </Text>
        </View>
      </View>

      <Button
        title="Confirm & Continue"
        onPress={confirmExistingUser}
        style={styles.confirmButton}
      />
    </Card>
  );

  const renderNewUserForm = () => (
    <Card style={styles.section}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setOnboardingPhase('search')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          New User Details
        </Text>
      </View>

      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Password will be auto-generated and sent to the user's email.
      </Text>

      <View style={styles.row}>
        <Input
          label="First Name *"
          value={userForm.firstName}
          onChangeText={(text) => handleUserFormChange('firstName', text)}
          placeholder="First name"
          style={styles.halfInput}
          error={showErrors && formErrors.firstName}
        />
        <Input
          label="Last Name *"
          value={userForm.lastName}
          onChangeText={(text) => handleUserFormChange('lastName', text)}
          placeholder="Last name"
          style={styles.halfInput}
          error={showErrors && formErrors.lastName}
        />
      </View>

      <Input
        label="Email (Optional)"
        value={userForm.email}
        onChangeText={(text) => handleUserFormChange('email', text)}
        placeholder="user@example.com"
        keyboardType="email-address"
        error={showErrors && formErrors.email}
        loading={emailChecking}
        rightIcon={emailChecking ? 'reload-circle' : (emailExists ? 'close-circle' : undefined)}
        rightIconColor={emailExists ? colors.error : colors.textSecondary}
      />

      <View style={styles.row}>
        <Input
          label="Phone Number *"
          value={userForm.phone}
          onChangeText={(text) => handleUserFormChange('phone', text)}
          placeholder="0712345678"
          keyboardType="phone-pad"
          style={styles.halfInput}
          error={showErrors && formErrors.phone}
        />
        <Input
          label="National ID *"
          value={userForm.idNumber}
          onChangeText={(text) => handleUserFormChange('idNumber', text)}
          placeholder="12345678"
          keyboardType="numeric"
          style={styles.halfInput}
          error={showErrors && formErrors.idNumber}
        />
      </View>

      <View>
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Gender</Text>
        <TouchableOpacity
          style={[styles.dropdownTrigger, { borderColor: formErrors.gender ? colors.error : colors.border }]}
          onPress={() => setShowGenderDropdown(true)}
        >
          <Text style={[styles.dropdownText, { color: userForm.gender ? colors.text : colors.textSecondary }]}>
            {genderOptions.find(g => g.value === userForm.gender)?.label || 'Select gender'}
          </Text>
          <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        {showErrors && formErrors.gender && (
          <Text style={[styles.errorText, { color: colors.error }]}>{formErrors.gender}</Text>
        )}
      </View>

      <Modal
        visible={showGenderDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGenderDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowGenderDropdown(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Gender</Text>
            {genderOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOption,
                  { borderBottomColor: colors.border },
                  userForm.gender === option.value && { backgroundColor: colors.primary + '20' }
                ]}
                onPress={() => {
                  handleUserFormChange('gender', option.value);
                  setShowGenderDropdown(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  { color: userForm.gender === option.value ? colors.primary : colors.text }
                ]}>
                  {option.label}
                </Text>
                {userForm.gender === option.value && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Button
        title="Continue to Verification"
        onPress={() => {
          if (validateUserForm()) {
            setOnboardingPhase('totp');
          }
        }}
        style={styles.confirmButton}
      />
    </Card>
  );

  const renderTOTPStep = () => (
    <Card style={styles.section}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setOnboardingPhase(foundUser ? 'confirm' : 'new_user')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Verify Phone Number
        </Text>
      </View>

      <Text style={[styles.stepDescription, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
        A 6-digit code has been sent to {foundUser?.email || userForm.email}. Enter it below to verify the phone number.
      </Text>

      <Input
        label="Verification Code"
        value={totpCode}
        onChangeText={setTotpCode}
        placeholder="000000"
        keyboardType="number-pad"
        maxLength={6}
        style={styles.totpInput}
      />

      <Button
        title={totpLoading ? 'Verifying...' : 'Verify Code'}
        onPress={verifyTOTP}
        loading={totpLoading}
        style={styles.confirmButton}
      />

      <Button
        title="Resend Code"
        variant="outline"
        onPress={sendTOTP}
        style={styles.resendButton}
      />
    </Card>
  );

  const renderOnboardedTable = () => {
    if (onboardedMembers.length === 0) return null;

    return (
      <Card style={styles.section}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Onboarded Members ({onboardedMembers.length})
        </Text>

        <ScrollView horizontal>
          <View style={styles.tableContainer}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <View style={[styles.tableCell, { flex: 2.0, alignItems: 'flex-start' }]}>
                <Text style={[styles.tableHeaderText, { color: colors.textSecondary }]}>Name</Text>
              </View>
              <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                <Text style={[styles.tableHeaderText, { color: colors.textSecondary }]}>Role</Text>
              </View>
              <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                <Text style={[styles.tableHeaderText, { color: colors.textSecondary }]}>Phone Verified</Text>
              </View>
              <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                <Text style={[styles.tableHeaderText, { color: colors.textSecondary }]}>Service Fee</Text>
              </View>
              <View style={[styles.tableCell, { flex: 0.5, alignItems: 'center' }]}>
                <Text style={[styles.tableHeaderText, { color: colors.textSecondary }]}>Actions</Text>
              </View>
            </View>

            {onboardedMembers.map((member) => (
              <View key={member.id || member.phone} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.tableCell, { flex: 1.5, alignItems: 'flex-start' }]}>
                  <Text style={[styles.tableCellText, { color: colors.text, textAlign: 'left' }]}>
                    {member.firstName} {member.lastName}
                  </Text>
                </View>
                <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                  <View style={styles.roleCell}>
                    <Text style={[styles.roleText, { color: colors.text }]}>
                      {memberRoles.find(r => r.id === member.role)?.name || member.role}
                    </Text>
                    <TouchableOpacity
                      style={[styles.roleEditButton, { borderColor: colors.border }]}
                      onPress={() => setEditingRole({ member: member.id || member.phone, currentRole: member.role })}
                    >
                      <Ionicons name="pencil" size={12} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                  <TouchableOpacity
                    style={[styles.statusChip, { backgroundColor: member.phoneVerified ? colors.success + '20' : colors.error + '20' }]}
                    onPress={() => updateMemberStatus(member.id || member.phone, 'phoneVerified', !member.phoneVerified)}
                  >
                    <Ionicons
                      name={member.phoneVerified ? 'checkmark-circle' : 'close-circle'}
                      size={16}
                      color={member.phoneVerified ? colors.success : colors.error}
                    />
                    <Text style={[styles.statusText, { color: member.phoneVerified ? colors.success : colors.error }]}>
                      {member.phoneVerified ? 'Verified' : 'Unverified'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                  <TouchableOpacity
                    style={[styles.statusChip, { backgroundColor: (member.serviceFeeStatus === 'paid' || member.hasPaidRegistration) ? colors.success + '20' : colors.error + '20' }]}
                    onPress={() => updateMemberStatus(member.id || member.phone, 'serviceFeeStatus', member.serviceFeeStatus === 'paid' ? 'pending' : 'paid')}
                  >
                    <Ionicons
                      name={(member.serviceFeeStatus === 'paid' || member.hasPaidRegistration) ? 'checkmark-circle' : 'close-circle'}
                      size={16}
                      color={(member.serviceFeeStatus === 'paid' || member.hasPaidRegistration) ? colors.success : colors.error}
                    />
                    <Text style={[styles.statusText, { color: (member.serviceFeeStatus === 'paid' || member.hasPaidRegistration) ? colors.success : colors.error }]}>
                      {(member.serviceFeeStatus === 'paid' || member.hasPaidRegistration) ? 'Paid' : 'Unpaid'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.tableCell, { flex: 0.5, alignItems: 'center' }]}>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => onUpdateMember(member.id || member.phone, { _remove: true })}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.tableActionRow, { flexDirection: 'column' }]}>
          <Button
            title="Onboard More Users"
            variant="outline"
            onPress={resetOnboarding}
            style={styles.tableActionButton}
          />
          <Button
            title={`Complete Chama Creation (${onboardedMembers.length} members)`}
            onPress={() => onAddMember({ _complete: true })}
            style={styles.tableActionButton}
          />
        </View>
      </Card>
    );
  };

  const renderOnboardingFlow = () => {
    switch (onboardingPhase) {
      case 'search':
        return renderSearchSection();
      case 'confirm':
        return renderConfirmExistingUser();
      case 'new_user':
        return renderNewUserForm();
      case 'totp':
        return renderTOTPStep();
      default:
        return renderSearchSection();
    }
  };

  const renderRoleEditModal = () => {
    if (!editingRole) return null;
    const member = onboardedMembers.find(m => (m.id || m.phone) === editingRole.member);
    if (!member) return null;

    return (
      <Modal
        visible={!!editingRole}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingRole(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditingRole(null)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Role for {member.firstName} {member.lastName}</Text>
            {memberRoles.map((role) => (
              <TouchableOpacity
                key={role.id}
                style={[
                  styles.modalOption,
                  { borderBottomColor: colors.border },
                  member.role === role.id && { backgroundColor: colors.primary + '20' }
                ]}
                onPress={() => {
                  updateMemberStatus(member.id || member.phone, 'role', role.id);
                  setEditingRole(null);
                }}
              >
                <View>
                  <Text style={[
                    styles.modalOptionText,
                    { color: member.role === role.id ? colors.primary : colors.text, fontWeight: member.role === role.id ? 'bold' : 'normal' }
                  ]}>
                    {role.name}
                  </Text>
                  <Text style={[styles.modalOptionDesc, { color: colors.textSecondary }]}>
                    {role.description}
                  </Text>
                </View>
                {member.role === role.id && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <View>
      {renderOnboardingFlow()}
      {renderOnboardedTable()}
      {renderRoleEditModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  stepTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: typography.fontSize.base,
    textAlign: 'left',
    lineHeight: 24,
    letterSpacing: 0.2,
    width: '100%',
    flexShrink: 1,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  searchButton: {
    marginTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  backText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  userInitials: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  userContact: {
    fontSize: typography.fontSize.sm,
    marginBottom: 2,
  },
  confirmButton: {
    marginTop: spacing.md,
  },
  totpInput: {
    marginBottom: spacing.md,
  },
  resendButton: {
    marginTop: spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxLabel: {
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  paymentSection: {
    marginBottom: spacing.lg,
  },
  payButton: {
    marginTop: spacing.sm,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  successText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  tableContainer: {
    minWidth: 500,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
  },
  tableHeader: {
    borderBottomWidth: 2,
  },
  tableHeaderText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    minWidth: 80,
  },
  tableCell: {
    fontSize: typography.fontSize.sm,
    minWidth: 100,
    justifyContent: 'center',
  },
  roleCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 100,
    justifyContent: 'center',
  },
  roleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'capitalize',
  },
  roleEditButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    minWidth: 90,
    justifyContent: 'center',
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginLeft: 4,
  },
  removeButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableActionRow: {
    flexDirection: 'column',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  tableActionButton: {
    flex: 1,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 48,
  },
  dropdownText: {
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    maxWidth: 300,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    ...shadows.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginBottom: spacing.xs,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  modalOptionText: {
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  modalOptionDesc: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
  },
});

export default CreateChamaStep3;
