/**
 * useCreateChama - Custom hook for managing chama/contribution group creation flow.
 * Handles multi-step form state, validation, member onboarding, and submission.
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import { useApp } from '../context/AppContext';

const CREATE_CHAMA_DRAFT_KEY = 'createChama_draft';
const ONBOARDING_DRAFT_KEY = 'createChama_onboarding_draft';

const initialChamaData = {
  group_type: '',
  type: '',
  name: '',
  description: '',
  county: '',
  town: '',
  contribution_amount: '',
  contribution_frequency: '',
  target_amount: '',
  contribution_rules: '',
  max_members: '',
  wallet_types: [],
  rules_file: null,
  rules: '',
  meeting_schedule: '',
  is_public: false,
  requires_approval: false,
  registration_fee_status: '',
  id: null,
};

const useCreateChama = ({ navigation, loadUserChamas }) => {
  const { user } = useApp();

  const [chamaData, setChamaData] = useState(initialChamaData);
  const [currentStep, setCurrentStep] = useState(1);
  const [showErrors, setShowErrors] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [onboardedMembers, setOnboardedMembers] = useState([]);

  // ── Draft persistence ──────────────────────────────────────────────
  // Load saved draft on mount so users can resume an interrupted creation.
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const saved = await AsyncStorage.getItem(CREATE_CHAMA_DRAFT_KEY);
        if (saved) {
          const draft = JSON.parse(saved);
          setChamaData(prev => ({ ...initialChamaData, ...draft }));
        }
      } catch (e) {
        console.error('Failed to load create-chama draft:', e);
      }
    };
    loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save draft whenever chamaData changes.
  useEffect(() => {
    const saveDraft = async () => {
      try {
        await AsyncStorage.setItem(CREATE_CHAMA_DRAFT_KEY, JSON.stringify(chamaData));
      } catch (e) {
        console.error('Failed to save create-chama draft:', e);
      }
    };
    saveDraft();
  }, [chamaData]);

  // Clear onboarding draft when members change (keeps onboarding hook in sync).
  useEffect(() => {
    const clearOnboardingDraft = async () => {
      try {
        await AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);
      } catch (e) {
        // silent
      }
    };
    clearOnboardingDraft();
  }, [onboardedMembers]);

  // ── Step calculation ────────────────────────────────────────────────
  const getTotalSteps = useCallback(() => {
    return chamaData.group_type === 'contribution' ? 3 : 4;
  }, [chamaData.group_type]);

  // ── Validation ──────────────────────────────────────────────────────
  const validateStep = useCallback((step, data = chamaData, members = onboardedMembers) => {
    const errors = {};

    if (step === 1) {
      if (!data.group_type) {
        errors.group_type = 'Please select a group type';
      }
      if (!data.name || !data.name.trim()) {
        errors.name = 'Group name is required';
      }
      if (!data.description || !data.description.trim()) {
        errors.description = 'Description is required';
      }
      if (!data.type) {
        errors.type = 'Please select a type';
      }
    }

    if (step === 2) {
      if (!data.county) {
        errors.county = 'Please select a county';
      }
      if (!data.town || !data.town.trim()) {
        errors.town = 'Town is required';
      }
      if (!data.max_members || parseInt(data.max_members, 10) < 1) {
        errors.max_members = 'Must be at least 1';
      }
      if (data.group_type === 'chama') {
        if (!data.contribution_amount || parseFloat(data.contribution_amount) <= 0) {
          errors.contribution_amount = 'Enter a valid contribution amount';
        }
        if (!data.contribution_frequency) {
          errors.contribution_frequency = 'Please select a frequency';
        }
      } else {
        if (!data.target_amount || parseFloat(data.target_amount) <= 0) {
          errors.target_amount = 'Enter a valid target amount';
        }
      }
    }

    if (step === 3) {
      if (members.length === 0) {
        errors.members = 'Add at least one member to continue';
      }
    }

    if (step === 4) {
      if (!data.wallet_types || data.wallet_types.length === 0) {
        errors.wallet_types = 'Select at least one wallet type';
      }
    }

    return errors;
  }, [chamaData, onboardedMembers]);

  const getFirstInvalidStep = useCallback(() => {
    const { group_type } = chamaData;
    const steps = group_type === 'contribution' ? [1, 2, 4] : [1, 2, 3, 4];
    for (const step of steps) {
      const errors = validateStep(step);
      if (Object.keys(errors).length > 0) {
        return step;
      }
    }
    return 0;
  }, [chamaData, onboardedMembers, validateStep]);

  // ── Input handling ─────────────────────────────────────────────────
  const handleInputChange = useCallback((field, value) => {
    setChamaData(prev => ({ ...prev, [field]: value }));
    // Clear the specific field error when user starts editing.
    if (formErrors[field]) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, [formErrors]);

  // ── Step navigation ────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    const { group_type } = chamaData;
    const errors = validateStep(currentStep);

    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      setFormErrors(errors);
      return;
    }

    setShowErrors(false);
    setFormErrors({});

    if (group_type === 'contribution' && currentStep === 2) {
      // Skip step 3 (member onboarding) for contribution groups.
      setCurrentStep(4);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [chamaData, currentStep, validateStep]);

  const handleBack = useCallback(() => {
    const { group_type } = chamaData;
    if (group_type === 'contribution' && currentStep === 4) {
      // Skip step 3 when going back for contribution groups.
      setCurrentStep(2);
    } else {
      setCurrentStep(prev => Math.max(prev - 1, 1));
    }
  }, [chamaData, currentStep]);

  // ── Member management ──────────────────────────────────────────────
  const handleMemberAdded = useCallback((member) => {
    if (member._complete) {
      // "Complete Chama Creation" button was pressed in step 3.
      const allErrors = {};
      const steps = chamaData.group_type === 'contribution' ? [1, 2, 4] : [1, 2, 3, 4];
      steps.forEach(step => {
        Object.assign(allErrors, validateStep(step));
      });

      if (Object.keys(allErrors).length > 0) {
        setShowErrors(true);
        setFormErrors(allErrors);
        return;
      }

      setShowErrors(false);
      setFormErrors({});
      setCurrentStep(4);
      return;
    }

    setOnboardedMembers(prev => {
      // Avoid duplicate members.
      const existing = prev.find(m => (m.id || m.phone) === (member.id || member.phone));
      if (existing) {
        return prev.map(m => (m.id || m.phone) === (member.id || member.phone) ? member : m);
      }
      return [...prev, member];
    });
  }, [chamaData.group_type, validateStep]);

  const handleMemberUpdated = useCallback((memberId, updates) => {
    if (updates._remove) {
      setOnboardedMembers(prev => prev.filter(m => (m.id || m.phone) !== memberId));
      return;
    }
    setOnboardedMembers(prev =>
      prev.map(m => (m.id || m.phone) === memberId ? { ...m, ...updates } : m)
    );
  }, []);

  // ── Submission ─────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const firstInvalid = getFirstInvalidStep();

    if (firstInvalid !== 0) {
      setShowErrors(true);
      const allErrors = {};
      const steps = chamaData.group_type === 'contribution' ? [1, 2, 4] : [1, 2, 3, 4];
      steps.forEach(step => {
        Object.assign(allErrors, validateStep(step));
      });
      setFormErrors(allErrors);
      return;
    }

    setShowErrors(false);
    setFormErrors({});

    try {
      setLoading(true);

      const members = onboardedMembers.filter(m => !m._complete && !m._remove);

      const payload = {
        name: chamaData.name.trim(),
        description: chamaData.description.trim(),
        group_type: chamaData.group_type,
        type: chamaData.type,
        county: chamaData.county,
        town: chamaData.town,
        max_members: parseInt(chamaData.max_members, 10),
        wallet_types: chamaData.wallet_types,
        is_public: chamaData.is_public,
        requires_approval: chamaData.requires_approval,
        meeting_schedule: chamaData.meeting_schedule,
        registration_fee_status: chamaData.registration_fee_status,
      };

      if (chamaData.group_type === 'chama') {
        payload.contribution_amount = parseFloat(chamaData.contribution_amount);
        payload.contribution_frequency = chamaData.contribution_frequency;
        payload.rules = chamaData.rules;
      } else {
        payload.target_amount = parseFloat(chamaData.target_amount);
        payload.contribution_rules = chamaData.contribution_rules;
      }

      if (members.length > 0) {
        payload.members = members;
      }

      const response = await ApiService.createChama(payload);

      if (response.success) {
        // Clear drafts on successful creation.
        await AsyncStorage.removeItem(CREATE_CHAMA_DRAFT_KEY);
        await AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);

        if (loadUserChamas) {
          await loadUserChamas();
        }

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: chamaData.group_type === 'contribution'
            ? 'Contribution group created successfully!'
            : 'Chama created successfully!',
        });

        if (navigation) {
          navigation.goBack();
        }
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.error || 'Failed to create chama',
        });
      }
    } catch (error) {
      console.error('Error creating chama:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to create chama. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [chamaData, onboardedMembers, navigation, loadUserChamas, getFirstInvalidStep, validateStep]);

  // ── Return ─────────────────────────────────────────────────────────
  return {
    chamaData,
    currentStep,
    showErrors,
    formErrors,
    loading,
    onboardedMembers,
    setChamaData,
    handleInputChange,
    getTotalSteps,
    getFirstInvalidStep,
    handleNext,
    handleBack,
    handleSubmit,
    handleMemberAdded,
    handleMemberUpdated,
  };
};

export default useCreateChama;
