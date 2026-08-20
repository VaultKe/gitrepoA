import React, { useState, useEffect, useCallback } from 'react';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import { getMemberServiceFeePayments, payMemberServiceFee } from '../services/api/chamaEndpoints';
import { getProfile } from '../services/api/userEndpoints';

const ONBOARDING_DRAFT_KEY = 'createChama_onboarding_draft';

const useMemberOnboarding = ({ chamaData, onboardedMembers, onAddMember, onUpdateMember, user }) => {
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

  const getRoleCount = useCallback((roleId) => {
    return onboardedMembers.filter(m => m.role === roleId).length;
  }, [onboardedMembers]);

  const canAssignRole = useCallback((roleId) => {
    if (roleId === 'chairperson') return false;
    const role = memberRoles.find(r => r.id === roleId);
    if (!role || role.maxCount === Infinity) return true;
    return getRoleCount(roleId) < role.maxCount;
  }, [memberRoles, getRoleCount]);

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
          const profileData = response.data.user || response.data;
          setUserProfile(profileData);
        }
      } catch (e) {
      }
    };
    fetchUserProfile();
  }, [user?.id]);

  const buildFoundUser = useCallback((backendUser) => {
    if (!backendUser) return null;
    return {
      ...backendUser,
      phoneNumber: backendUser.phoneNumber || backendUser.phone,
      idNumber: backendUser.nationalId || backendUser.idNumber,
    };
  }, []);

  const searchUser = useCallback(async () => {
    if (!phoneNumber && !nationalId) {
      Toast.show({ type: 'error', text1: 'Enter phone number and national ID to search' });
      return;
    }

    if (!phoneNumber || !nationalId) {
      Toast.show({ type: 'error', text1: 'Both phone number and national ID are required' });
      return;
    }

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
      setFoundUser(buildFoundUser(existingInTable));
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

      if (idUser && phoneUser && idUser.id === phoneUser.id) {
        setFoundUser(buildFoundUser(idUser));
        setOnboardingPhase('confirm');
        return;
      }

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
  }, [phoneNumber, nationalId, onboardedMembers, buildFoundUser]);

  const checkEmailUniqueness = useCallback(async (email) => {
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
  }, []);

  const handleUserFormChange = useCallback((field, value) => {
    setUserForm(prev => ({ ...prev, [field]: value }));
    setFormErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    if (field === 'email') {
      checkEmailUniqueness(value);
    }
  }, [checkEmailUniqueness]);

  const generateDevTOTP = useCallback(() => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    Toast.show({ type: 'info', text1: 'Dev mode: TOTP printed to terminal', text2: `Code: ${code}`, visibilityTime: 5000 });
    return code;
  }, []);

  const sendTOTP = useCallback(async () => {
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
  }, [userForm.phone, foundUser, generateDevTOTP]);

  const validateUserForm = useCallback(() => {
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
  }, [userForm, emailExists]);

  const confirmExistingUser = useCallback(() => {
    setUserForm(prev => ({
      ...prev,
      firstName: foundUser?.firstName || '',
      lastName: foundUser?.lastName || '',
      email: foundUser?.email || '',
      phone: foundUser?.phone || foundUser?.phoneNumber || '',
      idNumber: foundUser?.nationalId || foundUser?.idNumber || '',
    }));
    setOnboardingPhase('new_user');
  }, [foundUser]);

  useEffect(() => {
    if (onboardingPhase === 'totp' && !totpVerified) {
      sendTOTP();
    }
  }, [onboardingPhase, sendTOTP, totpVerified]);

  const resetOnboarding = useCallback(() => {
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
  }, []);

  const onboardMember = useCallback(async (role = 'member') => {
    if (!validateUserForm()) return;

    setOnboardLoading(true);
    try {
      const memberData = {
        ...userForm,
        role,
        phoneVerified: totpVerified,
        serviceFeeStatus: 'pending',
        onboardedAt: new Date().toISOString(),
      };

      if (foundUser) {
        memberData.id = foundUser.id;
      } else {
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
  }, [validateUserForm, userForm, totpVerified, foundUser, onAddMember, resetOnboarding]);

  const verifyTOTP = useCallback(async () => {
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
  }, [totpCode, userForm.phone, foundUser, onboardMember]);

  const updateMemberStatus = useCallback((memberId, field, value) => {
    onUpdateMember(memberId, { [field]: value });
  }, [onUpdateMember]);

  const togglePaymentSelection = useCallback((memberId) => {
    setSelectedForPayment((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }, []);

  const handlePayServiceFee = useCallback(async (memberId) => {
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
  }, [chamaData, payingFeeTimestamp]);

  return {
    phoneNumber,
    nationalId,
    searchLoading,
    foundUser,
    showUserForm,
    userForm,
    emailChecking,
    emailExists,
    formErrors,
    showErrors,
    onboardingPhase,
    totpCode,
    totpLoading,
    totpVerified,
    onboardLoading,
    editingRole,
    payingFee,
    payingFeeTimestamp,
    selectedForPayment,
    userProfile,
    memberRoles,
    genderOptions,
    getRoleCount,
    canAssignRole,
    buildFoundUser,
    searchUser,
    handleUserFormChange,
    checkEmailUniqueness,
    generateDevTOTP,
    sendTOTP,
    validateUserForm,
    confirmExistingUser,
    verifyTOTP,
    onboardMember,
    resetOnboarding,
    updateMemberStatus,
    togglePaymentSelection,
    handlePayServiceFee,
    setPhoneNumber,
    setNationalId,
    setFoundUser,
    setShowUserForm,
    setUserForm,
    setFormErrors,
    setShowErrors,
    setOnboardingPhase,
    setTotpCode,
    setTotpLoading,
    setTotpVerified,
    setOnboardLoading,
    setEditingRole,
    setPayingFee,
    setPayingFeeTimestamp,
    setSelectedForPayment,
    setEmailChecking,
    setEmailExists,
  };
};

export default useMemberOnboarding;
