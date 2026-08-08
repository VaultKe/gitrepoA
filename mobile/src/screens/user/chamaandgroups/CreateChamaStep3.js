import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../../../services/api';
import { getMemberServiceFeePayments, payMemberServiceFee } from '../../../services/api/chamaEndpoints';
import { getProfile } from '../../../services/api/userEndpoints';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import Dropdown from '../../../components/common/Dropdown';

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
  const [payingFee, setPayingFee] = useState(null);
  const [payingFeeTimestamp, setPayingFeeTimestamp] = useState(null);
  const [selectedForPayment, setSelectedForPayment] = useState(new Set());
  const [userProfile, setUserProfile] = useState(null);

  const memberRoles = [
    { id: 'chairperson', name: 'Chairperson', description: 'Leads the chama and presides over meetings', maxCount: 2 },
    { id: 'secretary', name: 'Secretary', description: 'Keeps records and manages communications', maxCount: 2 },
    { id: 'treasurer', name: 'Treasurer', description: 'Manages finances and transactions', maxCount: 2 },
    { id: 'member', name: 'Member', description: 'Regular member with basic privileges', maxCount: 1000 },
  ];

  const getRoleCount = (roleId) => {
    return onboardedMembers.filter(m => m.role === roleId).length;
  };

  const canAssignRole = (roleId) => {
    if (roleId === 'chairperson') return false;
    const role = memberRoles.find(r => r.id === roleId);
    if (!role || role.maxCount === Infinity) return true;
    return getRoleCount(roleId) < role.maxCount;
  };

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

useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;
      try {
        const response = await getProfile();
        if (response.success && response.data) {
          // Extract user from the nested response structure: { data: { user: {...} } }
          const profileData = response.data.user || response.data;
          setUserProfile(profileData);
        }
      } catch (e) {
      }
    };
    fetchUserProfile();
  }, [user?.id]);

  // The backend now returns unmasked phone and national ID for these
  // onboarding search endpoints (email stays masked for privacy).  No merge
  // with form values is needed — we use the database records directly so
  // that "same ID different phone" scenarios always resolve to the existing
  // account's canonical data.
  const buildFoundUser = (backendUser) => {
    if (!backendUser) return null;
    return {
      ...backendUser,
      // Normalise field names so downstream code can use either convention.
      phoneNumber: backendUser.phoneNumber || backendUser.phone,
      idNumber: backendUser.nationalId || backendUser.idNumber,
    };
  };

   const searchUser = async () => {
    if (!phoneNumber && !nationalId) {
      Toast.show({ type: 'error', text1: 'Enter phone number and national ID to search' });
      return;
    }

    if (!phoneNumber || !nationalId) {
      Toast.show({ type: 'error', text1: 'Both phone number and national ID are required' });
      return;
    }

    // --- Step 1: Table-level duplicate check ---
    // Before even hitting the database, verify the member isn't already in
    // the onboarded members table.  This covers the scenario where the second
    // member is being added and the system needs to confirm the table state.
    const existingInTable = onboardedMembers.find(m =>
      m.phone === phoneNumber ||
      m.phoneNumber === phoneNumber ||
      (m.nationalId || m.idNumber || m.national_id) === nationalId
    );

    if (existingInTable) {
      Toast.show({
        type: 'warning',
        text1: 'Member Already Added',
        text2: `${existingInTable.firstName || ''} ${existingInTable.lastName || ''}`.trim() +
          ' is already in the onboarded members list. Their details will be pre-filled for review.',
        visibilityTime: 5000,
      });
      // Set foundUser with the existing table member so that onboardMember
      // reuses their ID and does NOT create a duplicate backend user.
      setFoundUser(buildFoundUser(existingInTable));
      // Pre-fill the form with the existing member's data from the table
      setUserForm({
        firstName: existingInTable.firstName || '',
        lastName: existingInTable.lastName || '',
        email: existingInTable.email || '',
        phone: phoneNumber,
        idNumber: nationalId,
        gender: existingInTable.gender || '',
      });
      setShowUserForm(true);
      setOnboardingPhase('new_user');
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    setFoundUser(null);
    setShowUserForm(false);

    try {
      // Check national ID (primary) and phone (secondary) independently.
      // National ID is the key identifier because users may keep changing
      // phone numbers while the ID stays constant — this prevents the
      // creation of duplicate user accounts.
      const [idResponse, phoneResponse] = await Promise.allSettled([
        ApiService.searchUserByIdNumber(nationalId),
        ApiService.searchUserByPhone(phoneNumber),
      ]);

      const idUser =
        idResponse.status === 'fulfilled' &&
        idResponse.value?.success &&
        idResponse.value?.data
          ? idResponse.value.data
          : null;

      const phoneUser =
        phoneResponse.status === 'fulfilled' &&
        phoneResponse.value?.success &&
        phoneResponse.value?.data
          ? phoneResponse.value.data
          : null;

      // Case 1: Both credentials match the same user — confirmed match.
      if (idUser && phoneUser && idUser.id === phoneUser.id) {
        setFoundUser(buildFoundUser(idUser));
        setOnboardingPhase('confirm');
        return;
      }

      // Case 2: Credential mismatch — both exist but as different users.
      // "ID is so important" — prioritise the national-ID user so we never
      // end up with the same ID paired with a different phone number.
      if (idUser && phoneUser && idUser.id !== phoneUser.id) {
        Toast.show({
          type: 'warning',
          text1: 'User Already Exists',
          text2: 'A user with this National ID already exists in the system. Their phone number differs from the one entered. Using existing records to avoid duplicates.',
          visibilityTime: 6000,
        });
        setFoundUser(buildFoundUser(idUser));
        setOnboardingPhase('confirm');
        return;
      }

      // Case 3: Found by national ID only (phone not registered or user changed numbers).
      if (idUser) {
        Toast.show({
          type: 'warning',
          text1: 'User Already Exists',
          text2: 'A user with this National ID already exists in the system. Using existing records.',
          visibilityTime: 5000,
        });
        setFoundUser(buildFoundUser(idUser));
        setOnboardingPhase('confirm');
        return;
      }

      // Case 4: Found by phone only (national ID not registered).
      if (phoneUser) {
        Toast.show({
          type: 'warning',
          text1: 'User Already Exists',
          text2: 'A user with this phone number already exists in the system. Using existing records.',
          visibilityTime: 5000,
        });
        setFoundUser(buildFoundUser(phoneUser));
        setOnboardingPhase('confirm');
        return;
      }

      // Case 5: No user found — proceed to create a new user account.
      Toast.show({
        type: 'info',
        text1: 'No existing user found',
        text2: 'This user does not exist and can be created.',
        visibilityTime: 3000,
      });
      setShowUserForm(true);
      setOnboardingPhase('new_user');
      setUserForm(prev => ({
        ...prev,
        phone: phoneNumber,
        idNumber: nationalId,
      }));
    } catch (error) {
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
    Toast.show({ type: 'info', text1: 'Dev mode: TOTP printed to terminal', text2: `Code: ${code}`, visibilityTime: 5000 });
    return code;
  };

  const sendTOTP = async () => {
    const phone = userForm.phone || foundUser?.phoneNumber || foundUser?.phone;
    const userId = foundUser?.id || 'new';
    setTotpLoading(true);
    try {
      const response = await ApiService.sendOnboardingTOTP(phone, userId);
      if (response.success) {
        const devCode = response.data?.devCode || generateDevTOTP();
        setTotpCode(devCode);
        Toast.show({ type: 'success', text1: 'Verification code sent to phone', text2: `Dev: ${devCode}`, visibilityTime: 5000 });
      } else {
        throw new Error(response.error || 'Failed to send code');
      }
    } catch (error) {
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
     // Pre-fill the form with the **database** record's values so we never
     // end up with the same national ID paired with a different phone number.
     // The user can still edit fields if needed before proceeding.
     setUserForm(prev => ({
       ...prev,
       firstName: foundUser?.firstName || '',
       lastName: foundUser?.lastName || '',
       email: foundUser?.email || '',
       phone: foundUser?.phone || foundUser?.phoneNumber || '',
       idNumber: foundUser?.nationalId || foundUser?.idNumber || '',
     }));
    setOnboardingPhase('new_user');
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
      const phone = userForm.phone || foundUser?.phoneNumber || foundUser?.phone;
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
    if (!validateUserForm()) return;

    setOnboardLoading(true);
    try {
      // Always build memberData from the form (pre-filled with existing user
      // data when a user was found, or filled in by the user for new accounts).
      const memberData = {
        ...userForm,
        role,
        phoneVerified: totpVerified,
        serviceFeeStatus: 'pending',
        onboardedAt: new Date().toISOString(),
      };

      if (foundUser) {
        // Existing user — reuse their ID so no duplicate account is created.
        memberData.id = foundUser.id;
      } else {
        // New user — create the account on the backend.
        const createResponse = await ApiService.onboardUser({
          ...userForm,
          password: null,
        });
        if (createResponse.success && createResponse.data) {
          memberData.id = createResponse.data.id;
        }
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

  const togglePaymentSelection = (memberId) => {
    setSelectedForPayment((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const handlePayServiceFee = async (memberId) => {
    // During chama creation, chamaData.id may not be set yet
    if (!chamaData?.id) {
      Toast.show({
        type: 'info',
        text1: 'Chama not created yet',
        text2: 'Complete chama creation before paying service fees',
      });
      return;
    }

    const now = Date.now();
    if (payingFeeTimestamp && now - payingFeeTimestamp < 30000) {
      const remaining = Math.ceil((30000 - (now - payingFeeTimestamp)) / 1000);
      Toast.show({
        type: 'info',
        text1: 'Please wait',
        text2: `Cooldown active. Try again in ${remaining}s`,
      });
      return;
    }

    setPayingFee(memberId);
    setPayingFeeTimestamp(now);
    try {
      const response = await payMemberServiceFee(chamaData.id, memberId);
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Payment Initiated',
          text2: "STK push sent to member's phone",
        });
        setSelectedForPayment((prev) => {
          const next = new Set(prev);
          next.delete(memberId);
          return next;
        });
      } else {
        throw new Error(response.error || 'Failed to initiate payment');
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Payment Failed',
        text2: error.message || 'Failed to initiate payment',
      });
    } finally {
      setPayingFee(null);
    }
  };

  const renderSearchSection = () => (
    <Card style={styles.section} variant="outlined">
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
    <Card style={styles.section} variant="outlined">
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
    <Card style={styles.section} variant="outlined">
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

      <Dropdown
        label="Gender"
        value={userForm.gender}
        placeholder="Select gender"
        options={genderOptions}
        onSelect={(value) => handleUserFormChange('gender', value)}
        error={showErrors && !!formErrors.gender}
        errorText={formErrors.gender}
        colors={colors}
      />

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
    <Card style={styles.section} variant="outlined">
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setOnboardingPhase('new_user')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Verify Phone Number
        </Text>
      </View>

      <Text style={[styles.stepDescription, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
        A 6-digit code has been sent to {foundUser?.phone || foundUser?.phoneNumber || userForm.phone}. Enter it below to verify the phone number.
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

     const profile = userProfile || user;
     const chairperson = onboardedMembers.find(m => m.isChairperson) || {
       id: profile?.id || user?.id,
       user_id: profile?.id || user?.id,
       firstName: profile?.firstName || profile?.first_name || user?.firstName || user?.first_name || 'You',
       lastName: profile?.lastName || profile?.last_name || user?.lastName || user?.last_name || '',
       phone: profile?.phone || profile?.phoneNumber || user?.phone || user?.phoneNumber || 'N/A',
       phoneNumber: profile?.phone || profile?.phoneNumber || user?.phone || user?.phoneNumber || 'N/A',
       idNumber: profile?.idNumber || profile?.nationalId || profile?.id_number || user?.idNumber || user?.nationalId || 'N/A',
       nationalId: profile?.idNumber || profile?.nationalId || profile?.id_number || user?.idNumber || user?.nationalId || 'N/A',
       phoneVerified: profile?.isPhoneVerified ?? profile?.phoneVerified ?? user?.isPhoneVerified ?? user?.phoneVerified ?? true,
       role: 'chairperson',
       serviceFeeStatus: 'pending',
       isChairperson: true,
     };

     const allRows = [chairperson, ...onboardedMembers.filter(m => !m.isChairperson)];

    return (
      <Card style={styles.section} variant="outlined">
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Onboarded Members ({allRows.length})
        </Text>

        <ScrollView horizontal>
          <View style={styles.tableContainer}>
            <View style={[
              styles.tableRow,
              styles.tableHeader,
              { backgroundColor: colors.primary + '15', borderBottomColor: colors.primary, borderBottomWidth: 2 }
            ]}>
              <View style={[styles.tableCell, { flex: 1.5, alignItems: 'flex-start' }]}>
                <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Name</Text>
              </View>
              <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Phone</Text>
              </View>
              <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                <Text style={[styles.tableHeaderText, { color: colors.primary }]}>National ID</Text>
              </View>
              <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Role</Text>
              </View>
              <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Phone Verified</Text>
              </View>
              <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Service Fee</Text>
              </View>
              <View style={[styles.tableCell, { flex: 1.3, alignItems: 'center' }]}>
                <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Actions</Text>
              </View>
            </View>

            {allRows.map((member, index) => {
              const memberKey = member.isChairperson ? `chairperson-${member.id}` : (member.id || member.phone);
              const isSelected = selectedForPayment.has(member.id || member.phone);
              const isEven = index % 2 === 0;

              return (
                <View key={memberKey} style={[styles.tableRow, isEven ? styles.tableRowEven : styles.tableRowOdd, { borderBottomColor: colors.border }]}>
                  <View style={[styles.tableCell, { flex: 1.5, alignItems: 'flex-start' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      {member.isChairperson && (
                        <Ionicons name="star" size={14} color={colors.warning || colors.primary} />
                      )}
                      <Text style={[styles.tableCellText, { color: colors.text, textAlign: 'left' }]}>
                        {member.firstName} {member.lastName}
                      </Text>
                    </View>
                  </View>
                   <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                     <Text style={[styles.tableCellText, { color: colors.text }]}>
                       {member.phone || member.phoneNumber || 'N/A'}
                     </Text>
                   </View>
                   <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                     <Text style={[styles.tableCellText, { color: colors.text }]}>
                       {member.idNumber || member.nationalId || member.national_id || 'N/A'}
                     </Text>
                   </View>
                  <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                    {member.isChairperson ? (
                      <View style={[styles.statusChip, { backgroundColor: colors.warning + '20' }]}>
                        <Ionicons name="star" size={14} color={colors.warning || colors.primary} />
                        <Text style={[styles.statusText, { color: colors.warning || colors.primary }]}>Chairperson</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.roleDropdown, { borderColor: colors.border }]}
                        onPress={() => setEditingRole({ member: member.id || member.phone, currentRole: member.role })}
                      >
                        <Text style={[styles.roleDropdownText, { color: colors.text }]}>
                          {memberRoles.find(r => r.id === member.role)?.name || 'Select role'}
                        </Text>
                        <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                    <View style={[styles.statusChip, { backgroundColor: member.phoneVerified ? colors.success + '20' : colors.error + '20' }]}>
                      <Ionicons
                        name={member.phoneVerified ? 'checkmark-circle' : 'close-circle'}
                        size={16}
                        color={member.phoneVerified ? colors.success : colors.error}
                      />
                      <Text style={[styles.statusText, { color: member.phoneVerified ? colors.success : colors.error }]}>
                        {member.phoneVerified ? 'Verified' : 'Unverified'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                    <View style={[styles.statusChip, { backgroundColor: (member.service_fee_status === 'paid' || member.has_paid_registration) ? colors.success + '20' : colors.error + '20' }]}>
                      <Ionicons
                        name={(member.service_fee_status === 'paid' || member.has_paid_registration) ? 'checkmark-circle' : 'close-circle'}
                        size={16}
                        color={(member.service_fee_status === 'paid' || member.has_paid_registration) ? colors.success : colors.error}
                      />
                      <Text style={[styles.statusText, { color: (member.service_fee_status === 'paid' || member.has_paid_registration) ? colors.success : colors.error }]}>
                        {(member.service_fee_status === 'paid' || member.has_paid_registration) ? 'Paid' : 'Unpaid'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.tableCell, { flex: 1.3, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.xs }]}>
                    {!member.isChairperson && (
                      <>
                        <TouchableOpacity
                          style={[
                            styles.tableCheckbox,
                            isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                          ]}
                          onPress={() => togglePaymentSelection(member.id || member.phone)}
                        >
                          {isSelected && (
                            <Ionicons name="checkmark" size={14} color={colors.white} />
                          )}
                        </TouchableOpacity>
                        {isSelected && (
                          <TouchableOpacity
                            style={[
                              styles.tablePayButton,
                              { backgroundColor: colors.primary },
                              payingFee === (member.id || member.phone) && styles.tablePayButtonDisabled,
                            ]}
                            onPress={() => handlePayServiceFee(member.id || member.phone)}
                            disabled={payingFee === (member.id || member.phone)}
                          >
                            <Text style={styles.tablePayButtonText}>
                              {payingFee === (member.id || member.phone) ? '...' : 'Pay'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                    {member.isChairperson ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <TouchableOpacity
                          style={[
                            styles.tableCheckbox,
                            isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                          ]}
                          onPress={() => togglePaymentSelection(member.id || member.phone)}
                        >
                          {isSelected && (
                            <Ionicons name="checkmark" size={14} color={colors.white} />
                          )}
                        </TouchableOpacity>
{isSelected && (
                           <TouchableOpacity
                             style={[
                               styles.tablePayButton,
                               { backgroundColor: colors.primary },
                               payingFee === (member.id || member.phone) && styles.tablePayButtonDisabled,
                               !chamaData?.id && { opacity: 0.5 },
                             ]}
                             onPress={() => handlePayServiceFee(member.id || member.phone)}
                             disabled={payingFee === (member.id || member.phone) || !chamaData?.id}
                           >
                             <Text style={styles.tablePayButtonText}>
                               {!chamaData?.id ? 'After Creation' : (payingFee === (member.id || member.phone) ? '...' : 'Pay')}
                             </Text>
                           </TouchableOpacity>
                         )}
                       </View>
                     ) : (
                       <TouchableOpacity
                         style={styles.removeButton}
                         onPress={() => onUpdateMember(member.id || member.phone, { _remove: true })}
                       >
                         <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
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
            title={`Complete Chama Creation (${allRows.length} members)`}
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
            {memberRoles.map((role) => {
              const isFull = !canAssignRole(role.id);
              const isCurrentRole = member.role === role.id;
              return (
                <TouchableOpacity
                  key={role.id}
                  style={[
                    styles.modalOption,
                    { borderBottomColor: colors.border },
                    isCurrentRole && { backgroundColor: colors.primary + '20' },
                    isFull && !isCurrentRole && { opacity: 0.5 }
                  ]}
                  onPress={() => {
                    if (isFull && !isCurrentRole) {
                      Toast.show({ type: 'error', text1: `${role.name} role is already filled (max 1)` });
                      return;
                    }
                    updateMemberStatus(member.id || member.phone, 'role', role.id);
                    setEditingRole(null);
                  }}
                  disabled={isFull && !isCurrentRole}
                >
                  <View>
                    <Text style={[
                      styles.modalOptionText,
                      { color: isCurrentRole ? colors.primary : colors.text, fontWeight: isCurrentRole ? 'bold' : 'normal' }
                    ]}>
                      {role.name}
                    </Text>
                    <Text style={styles.modalOptionDesc}>
                      {role.description}
                    </Text>
                    {isFull && !isCurrentRole && (
                      <Text style={[styles.roleFullText, { color: colors.error }]}>
                        (Filled - max 2)
                      </Text>
                    )}
                  </View>
                  {isCurrentRole && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
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
    minWidth: 780,
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
  tableRowEven: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  tableRowOdd: {
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  tableCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableCheckboxChecked: {
    // color applied inline via colors.primary
  },
  tablePayButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tablePayButtonDisabled: {
    opacity: 0.6,
  },
  tablePayButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
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
  roleDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minWidth: 110,
    maxWidth: 140,
    gap: spacing.xs,
  },
  roleDropdownText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'capitalize',
    flex: 1,
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
  roleFullText: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
    fontStyle: 'italic',
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
