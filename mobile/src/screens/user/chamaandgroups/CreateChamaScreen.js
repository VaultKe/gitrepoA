/**
 * CreateChamaScreen - Secure Chama/Contribution Group Creation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import ApiService from '../../../services/api';
import CreateChamaStep1 from './CreateChamaStep1';
import CreateChamaStep2 from './CreateChamaStep2';
import CreateChamaStep3 from './CreateChamaStep3';
import CreateChamaStep4 from './CreateChamaStep4';

const CREATE_CHAMA_DRAFT_KEY = 'createChama_draft';

const CreateChamaScreen = ({ navigation }) => {
  const { theme, user, loadUserChamas } = useApp();
  const colors = getThemeColors(theme);

  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [chamaData, setChamaData] = useState({
    group_type: '',
    name: '',
    description: '',
    type: '',
    county: user?.county || '',
    town: user?.town || '',
    contribution_amount: '',
    contribution_frequency: 'monthly',
    target_amount: '',
    contribution_rules: '',
    max_members: '',
    is_public: false,
    requires_approval: false,
    rules: '',
    meeting_schedule: '',
    payment_method: '',
    till_number: '',
    paybill_business_number: '',
    paybill_account_number: '',
    payment_recipient_name: '',
    wallet_types: [],
    rules_file: null,
  });

  const [onboardedMembers, setOnboardedMembers] = useState([]);

  // Form validation state
  const [formErrors, setFormErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);

  // Security state
  const [submissionAttempts, setSubmissionAttempts] = useState(0);
  const [lastSubmissionTime, setLastSubmissionTime] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);

  // Security patterns
  const securityPatterns = {
    xss: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    xssEvents: /on\w+\s*=/gi,
    xssJavascript: /javascript:/gi,
    xssVbscript: /vbscript:/gi,
    xssData: /data:/gi,
    sqlInjection: /(union|select|insert|update|delete|drop|create|alter|exec|execute|script|declare|cast|convert)\s/gi,
    sqlComments: /(--|\/\*|\*\/|#)/g,
    sqlQuotes: /('|"|`)/g,
    commandInjection: /[;&|`$(){}[\]\\]/g,
    pathTraversal: /\.\.[\/\\]/g,
    htmlTags: /<[^>]*>/g,
    xmlEntities: /&[a-zA-Z0-9#]+;/g,
    dangerousChars: /[<>\"'&\x00-\x1f\x7f-\x9f]/g,
    controlChars: /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g,
  };

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const saved = await AsyncStorage.getItem(CREATE_CHAMA_DRAFT_KEY);
        if (saved) {
          const draft = JSON.parse(saved);
          if (draft.chamaData) setChamaData({
            ...draft.chamaData,
            wallet_types: draft.chamaData.wallet_types || [],
            rules_file: null,
          });
          if (draft.onboardedMembers) {
            const members = Array.isArray(draft.onboardedMembers)
              ? draft.onboardedMembers.filter(m => !m.isChairperson)
              : draft.onboardedMembers;
            setOnboardedMembers(members);
          }
          if (draft.currentStep) setCurrentStep(draft.currentStep);
        }
      } catch (e) {
        console.error('Failed to load create chama draft:', e);
      }
    };
    loadDraft();
  }, []);

  useEffect(() => {
    const saveDraft = async () => {
      try {
        const { rules_file, ...chamaDataToSave } = chamaData;
        await AsyncStorage.setItem(CREATE_CHAMA_DRAFT_KEY, JSON.stringify({
          chamaData: chamaDataToSave,
          onboardedMembers,
          currentStep,
        }));
      } catch (e) {
        console.error('Failed to save create chama draft:', e);
      }
    };
    saveDraft();
  }, [chamaData, onboardedMembers, currentStep]);

  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem(CREATE_CHAMA_DRAFT_KEY);
    } catch (e) {
      console.error('Failed to clear draft:', e);
    }
  };

  const sanitizeInput = (value, type = 'text') => {
    if (!value) return '';
    let sanitized = value.toString();
    sanitized = sanitized.replace(securityPatterns.controlChars, '');
    sanitized = sanitized.replace(securityPatterns.xss, '');
    sanitized = sanitized.replace(securityPatterns.xssEvents, '');
    sanitized = sanitized.replace(securityPatterns.xssJavascript, '');
    sanitized = sanitized.replace(securityPatterns.xssVbscript, '');

    switch (type) {
      case 'text':
        sanitized = sanitized.replace(securityPatterns.dangerousChars, '');
        sanitized = sanitized.replace(securityPatterns.sqlInjection, '');
        sanitized = sanitized.replace(securityPatterns.commandInjection, '');
        return sanitized.substring(0, 255);
      case 'name':
        sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-_.]/g, '');
        sanitized = sanitized.replace(securityPatterns.sqlInjection, '');
        return sanitized.substring(0, 100);
      case 'number':
        sanitized = sanitized.replace(/[^0-9.]/g, '');
        const parts = sanitized.split('.');
        if (parts.length > 2) {
          sanitized = parts[0] + '.' + parts.slice(1).join('');
        }
        return sanitized.substring(0, 20);
      case 'alphanumeric':
        sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, '');
        return sanitized.substring(0, 50);
      case 'description':
        sanitized = sanitized.replace(securityPatterns.htmlTags, '');
        sanitized = sanitized.replace(securityPatterns.sqlInjection, '');
        sanitized = sanitized.replace(securityPatterns.commandInjection, '');
        sanitized = sanitized.replace(securityPatterns.pathTraversal, '');
        sanitized = sanitized.replace(/[<>\"'&]/g, '');
        return sanitized.substring(0, 1000);
      case 'location':
        sanitized = sanitized.replace(/[^a-zA-Z\s\-]/g, '');
        sanitized = sanitized.replace(securityPatterns.sqlInjection, '');
        return sanitized.substring(0, 50);
      default:
        sanitized = sanitized.replace(securityPatterns.dangerousChars, '');
        return sanitized.substring(0, 255);
    }
  };

  const isSecureInput = (value, type = 'text') => {
    if (!value) return true;
    const str = value.toString();
    const suspiciousPatterns = [
      /script/gi, /javascript/gi, /vbscript/gi, /onload/gi, /onerror/gi, /onclick/gi,
      /eval\(/gi, /expression\(/gi, /url\(/gi, /import/gi, /document\./gi, /window\./gi,
      /alert\(/gi, /confirm\(/gi, /prompt\(/gi, /console\./gi, /function\s*\(/gi, /=\s*function/gi,
      /\$\(/gi, /angular\./gi, /react\./gi, /vue\./gi,
    ];
    return !suspiciousPatterns.some(pattern => pattern.test(str));
  };

  const validateInputSecurity = (value, fieldName) => {
    const errors = {};
    if (!value) return errors;
    const str = value.toString();
    if (str.length > 10000) {
      errors[fieldName] = 'Input too long. Maximum 10,000 characters allowed.';
      return errors;
    }
    if (!isSecureInput(str)) {
      errors[fieldName] = 'Input contains potentially dangerous content.';
      return errors;
    }
    const specialCharCount = (str.match(/[^a-zA-Z0-9\s]/g) || []).length;
    const specialCharRatio = specialCharCount / str.length;
    if (specialCharRatio > 0.3 && str.length > 10) {
      errors[fieldName] = 'Input contains too many special characters.';
      return errors;
    }
    const repeatedPatterns = [
      /(.{3,})\1{3,}/g, /(\w)\1{10,}/g,
    ];
    if (repeatedPatterns.some(pattern => pattern.test(str))) {
      errors[fieldName] = 'Input contains suspicious repeated patterns.';
      return errors;
    }
    return errors;
  };

  const validateField = (field, value) => {
    const errors = {};
    const securityErrors = validateInputSecurity(value, field);
    if (Object.keys(securityErrors).length > 0) {
      return securityErrors;
    }

    switch (field) {
      case 'name':
        if (!value || value.trim().length < 3) {
          errors.name = 'Chama name must be at least 3 characters long';
        } else if (value.trim().length > 100) {
          errors.name = 'Chama name must be less than 100 characters';
        } else if (!/^[a-zA-Z0-9\s\-_.]+$/.test(value)) {
          errors.name = 'Chama name contains invalid characters';
        }
        break;
      case 'description':
        if (!value || value.trim().length < 10) {
          errors.description = 'Description must be at least 10 characters long';
        } else if (value.trim().length > 1000) {
          errors.description = 'Description must be less than 1000 characters';
        }
        break;
      case 'group_type':
        if (!value || !['chama', 'contribution'].includes(value)) {
          errors.group_type = 'Please select what you want to create';
        }
        break;
      case 'type':
        if (chamaData.group_type === 'chama') {
          const validChamaTypes = ['savings', 'investment', 'welfare', 'business', 'merry-go-round'];
          if (!value || !validChamaTypes.includes(value)) {
            errors.type = 'Please select a valid chama type';
          }
        } else if (chamaData.group_type === 'contribution') {
          const validContributionTypes = ['emergency', 'medical', 'education', 'community', 'personal'];
          if (!value || !validContributionTypes.includes(value)) {
            errors.type = 'Please select a valid contribution type';
          }
        }
        break;
      case 'county':
        if (!value || value.trim().length < 2) {
          errors.county = 'Please enter a valid county';
        } else if (value.trim().length > 50) {
          errors.county = 'County name is too long';
        }
        break;
      case 'town':
        if (!value || value.trim().length < 2) {
          errors.town = 'Please enter a valid town';
        } else if (value.trim().length > 50) {
          errors.town = 'Town name is too long';
        }
        break;
      case 'contribution_amount':
        if (chamaData.group_type === 'chama') {
          const amount = parseFloat(value);
          if (!value || isNaN(amount)) {
            errors.contribution_amount = 'Please enter a valid contribution amount';
          } else if (amount < 10) {
            errors.contribution_amount = 'Minimum contribution amount is KES 10';
          } else if (amount > 1000000) {
            errors.contribution_amount = 'Maximum contribution amount is KES 1,000,000';
          }
        }
        break;
      case 'max_members':
        const maxMembers = parseInt(value);
        if (!value || isNaN(maxMembers)) {
          errors.max_members = 'Please enter a valid number of maximum members';
        } else if (maxMembers < 2) {
          errors.max_members = 'Minimum number of members is 2';
        } else if (maxMembers > 1000) {
          errors.max_members = 'Maximum number of members is 1000';
        }
        break;
      case 'rules':
        if (value && value.trim().length > 2000) {
          errors.rules = 'Rules must be less than 2000 characters';
        }
        break;
      case 'meeting_schedule':
        if (value && value.trim().length > 200) {
          errors.meeting_schedule = 'Meeting schedule must be less than 200 characters';
        }
        break;
      case 'target_amount':
        if (chamaData.group_type === 'contribution') {
          const targetAmount = parseFloat(value);
          if (!value || isNaN(targetAmount)) {
            errors.target_amount = 'Please enter a valid target amount';
          } else if (targetAmount < 100) {
            errors.target_amount = 'Minimum target amount is KES 100';
          } else if (targetAmount > 500000) {
            errors.target_amount = 'Maximum target amount is KES 500,000';
          }
        }
        break;
      case 'contribution_rules':
        if (chamaData.group_type === 'contribution') {
          if (value && value.trim().length > 1000) {
            errors.contribution_rules = 'Contribution rules must be less than 1000 characters';
          }
        }
        break;
      case 'payment_method':
        if (value && !['till', 'paybill'].includes(value)) {
          errors.payment_method = 'Payment method must be either TILL or PAYBILL';
        }
        break;
      case 'till_number':
        if (chamaData.payment_method === 'till') {
          if (!value || value.trim().length === 0) {
            errors.till_number = 'Till number is required';
          } else if (!/^[0-9]+$/.test(value)) {
            errors.till_number = 'Till number must contain digits only';
          } else if (value.trim().length < 5) {
            errors.till_number = 'Till number must be at least 5 digits';
          } else if (value.trim().length > 10) {
            errors.till_number = 'Till number must be at most 10 digits';
          }
        }
        break;
      case 'paybill_business_number':
        if (chamaData.payment_method === 'paybill') {
          if (!value || value.trim().length === 0) {
            errors.paybill_business_number = 'Business number is required';
          } else if (!/^[0-9]+$/.test(value)) {
            errors.paybill_business_number = 'Business number must contain digits only';
          } else if (value.trim().length < 5) {
            errors.paybill_business_number = 'Business number must be at least 5 digits';
          } else if (value.trim().length > 10) {
            errors.paybill_business_number = 'Business number must be at most 10 digits';
          }
        }
        break;
      case 'paybill_account_number':
        if (chamaData.payment_method === 'paybill') {
          if (!value || value.trim().length === 0) {
            errors.paybill_account_number = 'Account number is required';
          } else if (!/^[a-zA-Z0-9]+$/.test(value)) {
            errors.paybill_account_number = 'Account number must be letters and numbers only';
          } else if (value.trim().length < 2) {
            errors.paybill_account_number = 'Account number must be at least 2 characters';
          } else if (value.trim().length > 50) {
            errors.paybill_account_number = 'Account number is too long';
          }
        }
        break;
      case 'payment_recipient_name':
        if (chamaData.payment_method && (!value || value.trim().length < 2)) {
          errors.payment_recipient_name = 'Payment recipient name is required';
        }
        break;
      case 'wallet_types':
        if (!Array.isArray(value) || value.length === 0) {
          errors.wallet_types = 'Please select at least one wallet type';
        }
        break;
    }
    return errors;
  };

  const finalSanitizeInput = (value, type = 'text') => {
    if (!value) return '';
    let sanitized = value.toString();
    Object.values(securityPatterns).forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    switch (type) {
      case 'text':
        sanitized = sanitized.replace(/[^\w\s\-_.]/g, '').trim();
        return sanitized.substring(0, 255);
      case 'name':
        sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-_.]/g, '').trim();
        sanitized = sanitized.replace(/\s+/g, ' ');
        return sanitized.substring(0, 100);
      case 'number':
        sanitized = sanitized.replace(/[^0-9.]/g, '');
        const parts = sanitized.split('.');
        if (parts.length > 2) {
          sanitized = parts[0] + '.' + parts.slice(1).join('');
        }
        if (sanitized.length > 1 && sanitized[0] === '0' && sanitized[1] !== '.') {
          sanitized = sanitized.replace(/^0+/, '');
        }
        return sanitized.substring(0, 20);
      case 'alphanumeric':
        sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, '');
        return sanitized.substring(0, 50);
      case 'description':
        sanitized = sanitized.replace(/[^\w\s\-_.,!?]/g, '').trim();
        sanitized = sanitized.replace(/\s+/g, ' ');
        return sanitized.substring(0, 1000);
      case 'location':
        sanitized = sanitized.replace(/[^a-zA-Z\s\-]/g, '').trim();
        sanitized = sanitized.replace(/\s+/g, ' ');
        return sanitized.substring(0, 50);
      default:
        sanitized = sanitized.replace(/[^\w\s]/g, '').trim();
        return sanitized.substring(0, 255);
    }
  };

  const handleInputChange = (field, value) => {
    let sanitizedValue = value;
    switch (field) {
      case 'name':
      case 'payment_recipient_name':
        sanitizedValue = sanitizeInput(value, 'name');
        break;
      case 'description':
      case 'rules':
      case 'contribution_rules':
        sanitizedValue = sanitizeInput(value, 'description');
        break;
      case 'contribution_amount':
      case 'target_amount':
      case 'max_members':
        sanitizedValue = sanitizeInput(value, 'number');
        break;
      case 'till_number':
      case 'paybill_business_number':
        sanitizedValue = sanitizeInput(value, 'number').replace(/\./g, '');
        break;
      case 'paybill_account_number':
        sanitizedValue = sanitizeInput(value, 'alphanumeric');
        break;
      case 'county':
      case 'town':
        sanitizedValue = sanitizeInput(value, 'location');
        break;
      case 'meeting_schedule':
        sanitizedValue = sanitizeInput(value, 'text');
        break;
      case 'wallet_types':
        sanitizedValue = Array.isArray(value) ? value : [];
        break;
      case 'rules_file':
        sanitizedValue = value;
        break;
      default:
        sanitizedValue = value.toString().replace(/[<>\"'&]/g, '');
    }

    setChamaData(prev => ({
      ...prev,
      [field]: sanitizedValue,
    }));

    const fieldErrors = validateField(field, sanitizedValue);
    setFormErrors(prev => ({
      ...prev,
      ...fieldErrors,
      ...(Object.keys(fieldErrors).length === 0 && { [field]: undefined })
    }));
  };

  const validateStep = (step, showErrors = false) => {
    const errors = {};
    let isValid = true;

    switch (step) {
      case 1:
        const groupTypeErrors = validateField('group_type', chamaData.group_type);
        const nameErrors = validateField('name', chamaData.name);
        const descErrors = validateField('description', chamaData.description);
        const typeErrors = validateField('type', chamaData.type);
        Object.assign(errors, groupTypeErrors, nameErrors, descErrors, typeErrors);
        isValid = Object.keys(errors).length === 0;
        break;

      case 2:
        const countyErrors = validateField('county', chamaData.county);
        const townErrors = validateField('town', chamaData.town);
        const membersErrors = validateField('max_members', chamaData.max_members);
        let financialErrors = {};
        if (chamaData.group_type === 'chama') {
          financialErrors = validateField('contribution_amount', chamaData.contribution_amount);
        } else if (chamaData.group_type === 'contribution') {
          const targetAmountErrors = validateField('target_amount', chamaData.target_amount);
          const contributionRulesErrors = validateField('contribution_rules', chamaData.contribution_rules);
          Object.assign(financialErrors, targetAmountErrors, contributionRulesErrors);
        }
        Object.assign(errors, countyErrors, townErrors, membersErrors, financialErrors);

        if (chamaData.payment_method === 'till') {
          Object.assign(errors, validateField('till_number', chamaData.till_number));
          Object.assign(errors, validateField('payment_recipient_name', chamaData.payment_recipient_name));
        } else if (chamaData.payment_method === 'paybill') {
          Object.assign(errors, validateField('paybill_business_number', chamaData.paybill_business_number));
          Object.assign(errors, validateField('paybill_account_number', chamaData.paybill_account_number));
          Object.assign(errors, validateField('payment_recipient_name', chamaData.payment_recipient_name));
        }
        isValid = Object.keys(errors).length === 0;
        break;

      case 3:
        isValid = true;
        break;

      case 4:
        if (chamaData.rules) {
          const rulesErrors = validateField('rules', chamaData.rules);
          Object.assign(errors, rulesErrors);
        }
        if (chamaData.meeting_schedule) {
          const scheduleErrors = validateField('meeting_schedule', chamaData.meeting_schedule);
          Object.assign(errors, scheduleErrors);
        }
        if (!chamaData.wallet_types || chamaData.wallet_types.length === 0) {
          errors.wallet_types = 'Please select at least one wallet type';
        }
        isValid = Object.keys(errors).length === 0;
        break;

      default:
        isValid = false;
    }

    if (showErrors) {
      setFormErrors(prev => ({ ...prev, ...errors }));
      setShowErrors(true);
    }
    return isValid;
  };

  const validateAllSteps = () => {
    const allErrors = {};
    for (let step = 1; step <= 4; step++) {
      validateStep(step, false);
    }
    const commonFields = ['group_type', 'name', 'description', 'type', 'county', 'town', 'max_members', 'meeting_schedule'];
    const chamaFields = ['contribution_amount', 'contribution_frequency', 'rules'];
    const contributionFields = ['target_amount', 'contribution_rules'];
    const fieldsToValidate = [
      ...commonFields,
      ...(chamaData.group_type === 'chama' ? chamaFields : contributionFields)
    ];
    fieldsToValidate.forEach(field => {
      if (chamaData.hasOwnProperty(field)) {
        const fieldErrors = validateField(field, chamaData[field]);
        Object.assign(allErrors, fieldErrors);
      }
    });
    if (chamaData.payment_method === 'till') {
      Object.assign(allErrors, validateField('till_number', chamaData.till_number));
      Object.assign(allErrors, validateField('payment_recipient_name', chamaData.payment_recipient_name));
    } else if (chamaData.payment_method === 'paybill') {
      Object.assign(allErrors, validateField('paybill_business_number', chamaData.paybill_business_number));
      Object.assign(allErrors, validateField('paybill_account_number', chamaData.paybill_account_number));
      Object.assign(allErrors, validateField('payment_recipient_name', chamaData.payment_recipient_name));
    }
    if (!chamaData.wallet_types || chamaData.wallet_types.length === 0) {
      allErrors.wallet_types = 'Please select at least one wallet type';
    }
    setFormErrors(allErrors);
    setShowErrors(true);
    return Object.keys(allErrors).length === 0;
  };

  const getTotalSteps = () => chamaData.group_type === 'chama' ? 4 : 3;

  const handleNext = () => {
    if (validateStep(currentStep, true)) {
      if (chamaData.group_type === 'contribution' && currentStep === 2) {
        setCurrentStep(4);
      } else {
        setCurrentStep(currentStep + 1);
      }
      setShowErrors(false);
    } else {
      Toast.show({
        type: 'error',
        text1: 'Form Validation Failed',
        text2: 'Please fix the errors highlighted in red below',
        visibilityTime: 4000,
      });
    }
  };

  const handleBack = () => {
    if (chamaData.group_type === 'contribution' && currentStep === 4) {
      setCurrentStep(2);
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleMemberAdded = (memberData) => {
    if (memberData._complete) {
      setCurrentStep(4);
      return;
    }
    if (memberData._remove) {
      setOnboardedMembers(prev => prev.filter(m => (m.id || m.phone) !== memberData.id));
      return;
    }
    setOnboardedMembers(prev => {
      const exists = prev.find(m => (m.id || m.phone) === (memberData.id || memberData.phone));
      if (exists) {
        return prev.map(m => (m.id || m.phone) === (memberData.id || memberData.phone) ? memberData : m);
      }
      return [...prev, memberData];
    });
  };

  const handleMemberUpdated = (memberId, updates) => {
    if (updates._remove) {
      setOnboardedMembers(prev => prev.filter(m => (m.id || m.phone) !== memberId));
      return;
    }
    setOnboardedMembers(prev => prev.map(m =>
      (m.id || m.phone) === memberId ? { ...m, ...updates } : m
    ));
  };

  const handleSubmit = async () => {
    const currentTime = Date.now();
    if (currentTime - lastSubmissionTime < 5000) {
      Toast.show({ type: 'error', text1: 'Too Fast!', text2: 'Please wait 5 seconds between submissions' });
      return;
    }
    if (submissionAttempts >= 5) {
      setIsBlocked(true);
      Toast.show({ type: 'error', text1: 'Too Many Attempts', text2: 'Please refresh the page and try again' });
      return;
    }
    if (isBlocked) {
      Toast.show({ type: 'error', text1: 'Submission Blocked', text2: 'Please refresh the page to continue' });
      return;
    }

    setSubmissionAttempts(prev => prev + 1);
    setLastSubmissionTime(currentTime);

    if (!validateAllSteps()) {
      Toast.show({
        type: 'error',
        text1: 'Form Validation Failed',
        text2: 'Please fix all errors before creating the chama',
        visibilityTime: 4000,
      });
      return;
    }

    try {
      setLoading(true);

      const baseData = {
        name: finalSanitizeInput(chamaData.name, 'name'),
        description: finalSanitizeInput(chamaData.description, 'description'),
        category: chamaData.group_type,
        type: chamaData.type,
        county: finalSanitizeInput(chamaData.county, 'location'),
        town: finalSanitizeInput(chamaData.town, 'location'),
        max_members: parseInt(chamaData.max_members),
        is_public: Boolean(chamaData.is_public),
        requires_approval: Boolean(chamaData.requires_approval),
        meeting_schedule: finalSanitizeInput(chamaData.meeting_schedule, 'text'),
        payment_method: chamaData.payment_method || '',
        till_number: chamaData.payment_method === 'till' ? finalSanitizeInput(chamaData.till_number, 'alphanumeric') : '',
        paybill_business_number: chamaData.payment_method === 'paybill' ? finalSanitizeInput(chamaData.paybill_business_number, 'alphanumeric') : '',
        paybill_account_number: chamaData.payment_method === 'paybill' ? finalSanitizeInput(chamaData.paybill_account_number, 'alphanumeric') : '',
        payment_recipient_name: chamaData.payment_method ? finalSanitizeInput(chamaData.payment_recipient_name, 'name') : '',
        created_by: user.id,
      };

      const sanitizedData = {
        ...baseData,
        wallet_types: chamaData.wallet_types || [],
        ...(chamaData.group_type === 'chama' ? {
          contribution_amount: parseFloat(chamaData.contribution_amount),
          contribution_frequency: chamaData.contribution_frequency,
          rules: finalSanitizeInput(chamaData.rules, 'description'),
        } : {
          target_amount: parseFloat(chamaData.target_amount),
          contribution_rules: finalSanitizeInput(chamaData.contribution_rules, 'description'),
        })
      };

      const securityValidation = {
        name: isSecureInput(sanitizedData.name, 'name'),
        description: isSecureInput(sanitizedData.description, 'description'),
        county: isSecureInput(sanitizedData.county, 'location'),
        town: isSecureInput(sanitizedData.town, 'location'),
        meeting_schedule: isSecureInput(sanitizedData.meeting_schedule, 'text'),
        payment_recipient_name: sanitizedData.payment_recipient_name ? isSecureInput(sanitizedData.payment_recipient_name, 'name') : true,
      };

      if (chamaData.group_type === 'chama') {
        securityValidation.rules = sanitizedData.rules ? isSecureInput(sanitizedData.rules, 'description') : true;
      } else {
        securityValidation.contribution_rules = sanitizedData.contribution_rules ? isSecureInput(sanitizedData.contribution_rules, 'description') : true;
      }

      const securityPassed = Object.values(securityValidation).every(Boolean);
      if (!securityPassed) {
        throw new Error('Security validation failed. Please check your inputs for suspicious content.');
      }

      const baseValidation = [
        sanitizedData.name.length >= 3 && sanitizedData.name.length <= 100,
        sanitizedData.description.length >= 10 && sanitizedData.description.length <= 1000,
        ['chama', 'contribution'].includes(sanitizedData.category),
        sanitizedData.max_members >= 2 && sanitizedData.max_members <= 1000,
        sanitizedData.county.length >= 2 && sanitizedData.county.length <= 50,
        sanitizedData.town.length >= 2 && sanitizedData.town.length <= 50,
        typeof sanitizedData.name === 'string',
        typeof sanitizedData.description === 'string',
        typeof sanitizedData.category === 'string',
        typeof sanitizedData.county === 'string',
        typeof sanitizedData.town === 'string',
        Number.isInteger(sanitizedData.max_members),
        sanitizedData.max_members > 0,
      ];

      const typeSpecificValidation = chamaData.group_type === 'chama' ? [
        ['savings', 'investment', 'welfare', 'business', 'merry-go-round'].includes(sanitizedData.type),
        sanitizedData.contribution_amount >= 10 && sanitizedData.contribution_amount <= 1000000,
        typeof sanitizedData.contribution_amount === 'number',
        !isNaN(sanitizedData.contribution_amount),
        isFinite(sanitizedData.contribution_amount),
        typeof sanitizedData.contribution_frequency === 'string',
        ['weekly', 'monthly', 'quarterly'].includes(sanitizedData.contribution_frequency),
      ] : [
        ['emergency', 'medical', 'education', 'community', 'personal'].includes(sanitizedData.type),
        sanitizedData.target_amount >= 100 && sanitizedData.target_amount <= 500000,
        typeof sanitizedData.target_amount === 'number',
        !isNaN(sanitizedData.target_amount),
        isFinite(sanitizedData.target_amount),
      ];

      const paymentValidation = [];
      if (sanitizedData.payment_method) {
        paymentValidation.push(['till', 'paybill'].includes(sanitizedData.payment_method), typeof sanitizedData.payment_method === 'string');
        if (sanitizedData.payment_method === 'till') {
          paymentValidation.push(
            sanitizedData.till_number.length >= 5,
            sanitizedData.till_number.length <= 10,
            /^[0-9]+$/.test(sanitizedData.till_number),
            sanitizedData.payment_recipient_name.length >= 2
          );
        } else if (sanitizedData.payment_method === 'paybill') {
          paymentValidation.push(
            sanitizedData.paybill_business_number.length >= 5,
            sanitizedData.paybill_business_number.length <= 10,
            /^[0-9]+$/.test(sanitizedData.paybill_business_number),
            sanitizedData.paybill_account_number.length >= 2,
            sanitizedData.payment_recipient_name.length >= 2
          );
        }
      }

      const finalValidation = [...baseValidation, ...typeSpecificValidation, ...paymentValidation];
      if (!finalValidation.every(Boolean)) {
        console.error('Validation failed:', {
          baseValidation: baseValidation.map((v, i) => ({ index: i, passed: v })),
          typeSpecificValidation: typeSpecificValidation.map((v, i) => ({ index: i, passed: v })),
          paymentValidation: paymentValidation.map((v, i) => ({ index: i, passed: v })),
        });
        throw new Error('Data validation failed. Please check your inputs for correctness and security.');
      }

      let requestPayload;
      const jsonPayload = {
        ...sanitizedData,
        members: [
          {
            user_id: user.id,
            role: 'chairperson',
            status: 'active',
          },
          ...onboardedMembers.map(member => ({
            user_id: member.id,
            role: member.role || 'member',
            status: 'pending',
            phone_verified: member.phoneVerified || false,
          }))
        ]
      };

      if (chamaData.rules_file && chamaData.rules_file.uri) {
        const multipart = new FormData();
        Object.entries(jsonPayload).forEach(([key, value]) => {
          if (value === undefined || value === null) return;

          if (Array.isArray(value)) {
            value.forEach(item => {
              if (typeof item === 'object') {
                multipart.append(key, JSON.stringify(item));
              } else {
                multipart.append(key, String(item));
              }
            });
          } else if (typeof value === 'object') {
            multipart.append(key, JSON.stringify(value));
          } else {
            multipart.append(key, String(value));
          }
        });
        multipart.append('rules_file', {
          uri: chamaData.rules_file.uri,
          type: chamaData.rules_file.mimeType || 'application/pdf',
          name: chamaData.rules_file.name || 'rules.pdf',
        });
        requestPayload = multipart;
      } else {
        requestPayload = jsonPayload;
      }

      const response = await ApiService.createChama(requestPayload);

      if (response.success) {
        try {
          const membersResponse = await ApiService.makeRequest(`/chamas/${response.data.id}/members`);
          if (membersResponse.success && Array.isArray(membersResponse.data)) {
            const backendChair = membersResponse.data.find(m =>
              (m.role === 'chairperson') || (m.user_id === user.id) || (m.user?.id === user.id)
            );
            if (backendChair) {
              const normalizedChair = {
                id: backendChair.user_id || backendChair.id,
                user_id: backendChair.user_id || backendChair.user?.id,
                firstName: backendChair.user?.first_name || backendChair.first_name || user.firstName || user.first_name || 'You',
                lastName: backendChair.user?.last_name || backendChair.last_name || user.lastName || user.last_name || '',
                phone: backendChair.user?.phone || backendChair.phone || 'N/A',
                phoneNumber: backendChair.user?.phone || backendChair.phone || 'N/A',
                idNumber: backendChair.user?.id_number || backendChair.user?.idNumber || backendChair.id_number || 'N/A',
                nationalId: backendChair.user?.id_number || backendChair.user?.idNumber || backendChair.id_number || 'N/A',
                phoneVerified: backendChair.phone_verified ?? true,
                role: backendChair.role || 'chairperson',
                serviceFeeStatus: backendChair.service_fee_status || 'pending',
                hasPaidRegistration: backendChair.user?.registration_fee_paid || backendChair.registration_fee_paid || false,
                isChairperson: true,
              };
              setOnboardedMembers(prev => {
                const filtered = prev.filter(m => !m.isChairperson);
                return [normalizedChair, ...filtered];
              });
            }
          }
        } catch (memberFetchError) {
        }

        if (typeof loadUserChamas === 'function') {
          await loadUserChamas();
        }
        setSubmissionAttempts(0);
        setLastSubmissionTime(0);
        setIsBlocked(false);
        const isContribution = chamaData.group_type === 'contribution';
        Toast.show({
          type: 'success',
          text1: `${isContribution ? 'Contribution Group' : 'Chama'} Created Successfully!`,
          text2: `Your ${isContribution ? 'contribution group' : 'chama'} has been created and you are now the chairperson.`,
          visibilityTime: 3000,
        });
        await clearDraft();
        setChamaData({
          group_type: '',
          name: '',
          description: '',
          type: '',
          county: user?.county || '',
          town: user?.town || '',
          contribution_amount: '',
          contribution_frequency: 'monthly',
          target_amount: '',
          contribution_rules: '',
          max_members: '',
          is_public: false,
          requires_approval: false,
          rules: '',
          meeting_schedule: '',
          payment_method: '',
          till_number: '',
          paybill_business_number: '',
          paybill_account_number: '',
          payment_recipient_name: '',
          wallet_types: [],
          rules_file: null,
        });
        setOnboardedMembers([]);
        setCurrentStep(1);
        setFormErrors({});
        setShowErrors(false);
        navigation.navigate('MyChamas', {
          newChamaId: response.data.id,
          refresh: true
        });
      } else {
        const groupType = chamaData.group_type === 'contribution' ? 'contribution group' : 'chama';
        throw new Error(response.error || `Failed to create ${groupType}`);
      }
    } catch (error) {
      const groupType = chamaData.group_type === 'contribution' ? 'contribution group' : 'chama';
      console.error(`${groupType} creation failed:`, error);
      Toast.show({
        type: 'error',
        text1: 'Creation Failed',
        text2: error.message || `Failed to create ${groupType}. Please try again.`,
        visibilityTime: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => {
    const totalSteps = getTotalSteps();
    const steps = chamaData.group_type === 'chama' ? [1, 2, 3, 4] : [1, 2, 4];
    return (
      <View style={styles.stepIndicator}>
        {steps.map((step, index) => (
          <View key={step} style={styles.stepContainer}>
            <View style={[
              styles.stepCircle,
              {
                backgroundColor: step <= currentStep ? colors.primary : colors.backgroundSecondary,
                borderColor: step <= currentStep ? colors.primary : colors.border,
              }
            ]}>
              <Text style={[
                styles.stepNumber,
                { color: step <= currentStep ? colors.white : colors.textSecondary }
              ]}>
                {chamaData.group_type === 'chama' ? step : index + 1}
              </Text>
            </View>
            {index < steps.length - 1 && (
              <View style={[
                styles.stepLine,
                { backgroundColor: step < currentStep ? colors.primary : colors.border }
              ]} />
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderStepContent = () => {
    if (chamaData.group_type === 'contribution' && currentStep === 3) {
      return null;
    }
    switch (currentStep) {
      case 1:
        return (
          <CreateChamaStep1
            chamaData={chamaData}
            handleInputChange={handleInputChange}
            showErrors={showErrors}
            formErrors={formErrors}
            colors={colors}
          />
        );
      case 2:
        return (
          <CreateChamaStep2
            chamaData={chamaData}
            handleInputChange={handleInputChange}
            showErrors={showErrors}
            formErrors={formErrors}
            colors={colors}
          />
        );
      case 3:
        return (
          <CreateChamaStep3
            chamaData={chamaData}
            onboardedMembers={onboardedMembers}
            onAddMember={handleMemberAdded}
            onUpdateMember={handleMemberUpdated}
            user={user}
            colors={colors}
          />
        );
      case 4:
        return (
          <CreateChamaStep4
            chamaData={chamaData}
            handleInputChange={handleInputChange}
            showErrors={showErrors}
            formErrors={formErrors}
            colors={colors}
            user={user}
            onRegistrationFeeStatusChange={(status) => {
              setChamaData(prev => ({
                ...prev,
                registration_fee_status: status,
              }));
            }}
          />
        );
      default:
        return null;
    }
  };

  const renderNavigationButtons = () => {
    const totalSteps = getTotalSteps();
    const isLastStep = currentStep >= totalSteps;
    return (
      <View style={[styles.navigationButtons, { backgroundColor: colors.surface }]}>
        {currentStep > 1 && (
          <Button
            title="Back"
            variant="outline"
            onPress={handleBack}
            style={styles.navButton}
          />
        )}

        {!isLastStep ? (
          <Button
            title="Next"
            onPress={handleNext}
            style={styles.navButton}
          />
        ) : (
          <Button
            title={`Create ${chamaData.group_type === 'contribution' ? 'Contribution Group' : 'Chama'}`}
            onPress={handleSubmit}
            loading={loading}
            style={styles.navButton}
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {renderStepIndicator()}
        {renderStepContent()}
        <View style={styles.spacer} />
      </ScrollView>

      {renderNavigationButtons()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: spacing.sm,
  },
  spacer: {
    height: 100,
  },
  navigationButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.lg,
  },
  navButton: {
    flex: 1,
  },
});

export default CreateChamaScreen;
