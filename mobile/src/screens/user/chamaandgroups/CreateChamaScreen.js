/**
 * CreateChamaScreen - Secure Chama/Contribution Group Creation
 
 */

import React, { useState } from 'react';
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
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import ApiService from '../../../services/api';

const CreateChamaScreen = ({ navigation }) => {
  const { theme, user, loadUserChamas } = useApp();
  const colors = getThemeColors(theme);

  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [nameValidation, setNameValidation] = useState({ isValid: true, message: '' });
  const [checkingName, setCheckingName] = useState(false);
  const [chamaData, setChamaData] = useState({
    group_type: '', // 'chama' or 'contribution' - user chooses first
    name: '',
    description: '',
    type: '',
    county: user?.county || '',
    town: user?.town || '',
    contribution_amount: '', // for chamas
    contribution_frequency: 'monthly', // for chamas
    target_amount: '', // for contributions
    contribution_rules: '', // for contributions
    max_members: '',
    is_public: false,
    requires_approval: false,
    rules: '', // for chamas
    meeting_schedule: '',
    // Payment method fields
    payment_method: '', // 'till' or 'paybill'
    till_number: '',
    paybill_business_number: '',
    paybill_account_number: '',
    payment_recipient_name: '',
  });

  // New state for member management
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Form validation state
  const [formErrors, setFormErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);

  // Security state
  const [submissionAttempts, setSubmissionAttempts] = useState(0);
  const [lastSubmissionTime, setLastSubmissionTime] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);

  // What user wants to create - shown first
  const creationOptions = [
    {
      id: 'chama',
      name: 'Chama',
      icon: 'people',
      description: 'Traditional savings and investment group with regular contributions',
      color: colors.primary
    },
    {
      id: 'contribution',
      name: 'Contribution Group',
      icon: 'heart',
      description: 'Fundraising group for specific causes and emergencies',
      color: colors.success
    },
  ];

  // Chama types (when user chooses 'chama')
  const chamaTypes = [
    { id: 'savings', name: 'Savings Group', icon: 'wallet', description: 'Focus on saving money together' },
    { id: 'investment', name: 'Investment Club', icon: 'trending-up', description: 'Pool funds for investments' },
    { id: 'welfare', name: 'Welfare Group', icon: 'heart', description: 'Support members in times of need' },
    { id: 'business', name: 'Business Group', icon: 'briefcase', description: 'Support business ventures' },
    { id: 'merry-go-round', name: 'Merry-go-round', icon: 'refresh', description: 'Rotating savings scheme' },
  ];

  // Contribution group types (when user chooses 'contribution')
  const contributionTypes = [
    { id: 'emergency', name: 'Emergency Fund', icon: 'alert-circle', description: 'For urgent financial needs' },
    { id: 'medical', name: 'Medical Support', icon: 'medical', description: 'Healthcare and medical expenses' },
    { id: 'education', name: 'Education Fund', icon: 'school', description: 'School fees and educational support' },
    { id: 'community', name: 'Community Project', icon: 'people', description: 'Local community development' },
    { id: 'personal', name: 'Personal Goal', icon: 'person', description: 'Individual financial goals' },
  ];



  const frequencies = [
    { id: 'weekly', name: 'Weekly' },
    { id: 'monthly', name: 'Monthly' },
    { id: 'quarterly', name: 'Quarterly' },
  ];

  const memberRoles = [
    { id: 'member', name: 'Member', description: 'Regular member with basic privileges' },
    { id: 'treasurer', name: 'Treasurer', description: 'Manages finances and transactions' },
    { id: 'secretary', name: 'Secretary', description: 'Keeps records and manages communications' },
  ];

  // Comprehensive security sanitization functions
  const securityPatterns = {
    // XSS prevention patterns
    xss: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    xssEvents: /on\w+\s*=/gi,
    xssJavascript: /javascript:/gi,
    xssVbscript: /vbscript:/gi,
    xssData: /data:/gi,

    // SQL injection patterns
    sqlInjection: /(union|select|insert|update|delete|drop|create|alter|exec|execute|script|declare|cast|convert)\s/gi,
    sqlComments: /(--|\/\*|\*\/|#)/g,
    sqlQuotes: /('|"|`)/g,

    // Command injection patterns
    commandInjection: /[;&|`$(){}[\]\\]/g,

    // Path traversal patterns
    pathTraversal: /\.\.[\/\\]/g,

    // HTML/XML injection
    htmlTags: /<[^>]*>/g,
    xmlEntities: /&[a-zA-Z0-9#]+;/g,

    // Dangerous characters for different contexts
    dangerousChars: /[<>\"'&\x00-\x1f\x7f-\x9f]/g,
    controlChars: /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g,
  };

  // Enhanced sanitization with security focus
  const sanitizeInput = (value, type = 'text') => {
    if (!value) return '';

    let sanitized = value.toString();

    // Remove control characters and null bytes
    sanitized = sanitized.replace(securityPatterns.controlChars, '');

    // Remove XSS patterns
    sanitized = sanitized.replace(securityPatterns.xss, '');
    sanitized = sanitized.replace(securityPatterns.xssEvents, '');
    sanitized = sanitized.replace(securityPatterns.xssJavascript, '');
    sanitized = sanitized.replace(securityPatterns.xssVbscript, '');

    // Context-specific sanitization
    switch (type) {
      case 'text':
        // General text - allow spaces, remove dangerous chars
        sanitized = sanitized.replace(securityPatterns.dangerousChars, '');
        sanitized = sanitized.replace(securityPatterns.sqlInjection, '');
        sanitized = sanitized.replace(securityPatterns.commandInjection, '');
        return sanitized.substring(0, 255);

      case 'name':
        // Names - letters, numbers, spaces, basic punctuation only
        sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-_.]/g, '');
        sanitized = sanitized.replace(securityPatterns.sqlInjection, '');
        return sanitized.substring(0, 100);

      case 'number':
        // Numbers only - prevent injection through numeric fields
        sanitized = sanitized.replace(/[^0-9.]/g, '');
        // Prevent multiple decimal points
        const parts = sanitized.split('.');
        if (parts.length > 2) {
          sanitized = parts[0] + '.' + parts.slice(1).join('');
        }
        return sanitized.substring(0, 20);

      case 'alphanumeric':
        // Account numbers - alphanumeric only, no spaces to prevent injection
        sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, '');
        return sanitized.substring(0, 50);

      case 'description':
        // Descriptions - more permissive but still secure
        sanitized = sanitized.replace(securityPatterns.htmlTags, '');
        sanitized = sanitized.replace(securityPatterns.sqlInjection, '');
        sanitized = sanitized.replace(securityPatterns.commandInjection, '');
        sanitized = sanitized.replace(securityPatterns.pathTraversal, '');
        sanitized = sanitized.replace(/[<>\"'&]/g, '');
        return sanitized.substring(0, 1000);

      case 'location':
        // County/Town - letters, spaces, hyphens only
        sanitized = sanitized.replace(/[^a-zA-Z\s\-]/g, '');
        sanitized = sanitized.replace(securityPatterns.sqlInjection, '');
        return sanitized.substring(0, 50);

      default:
        // Default - minimal sanitization
        sanitized = sanitized.replace(securityPatterns.dangerousChars, '');
        return sanitized.substring(0, 255);
    }
  };

  // Security validation functions
  const isSecureInput = (value, type = 'text') => {
    if (!value) return true;

    const str = value.toString();

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /script/gi,
      /javascript/gi,
      /vbscript/gi,
      /onload/gi,
      /onerror/gi,
      /onclick/gi,
      /eval\(/gi,
      /expression\(/gi,
      /url\(/gi,
      /import/gi,
      /document\./gi,
      /window\./gi,
      /alert\(/gi,
      /confirm\(/gi,
      /prompt\(/gi,
      /console\./gi,
      /function\s*\(/gi,
      /=\s*function/gi,
      /\$\(/gi, // jQuery
      /angular\./gi,
      /react\./gi,
      /vue\./gi,
    ];

    return !suspiciousPatterns.some(pattern => pattern.test(str));
  };

  const validateInputSecurity = (value, fieldName) => {
    const errors = {};

    if (!value) return errors;

    const str = value.toString();

    // Check input length to prevent buffer overflow attacks
    if (str.length > 10000) {
      errors[fieldName] = 'Input too long. Maximum 10,000 characters allowed.';
      return errors;
    }

    // Check for suspicious patterns
    if (!isSecureInput(str)) {
      errors[fieldName] = 'Input contains potentially dangerous content.';
      return errors;
    }

    // Check for excessive special characters (potential obfuscation)
    const specialCharCount = (str.match(/[^a-zA-Z0-9\s]/g) || []).length;
    const specialCharRatio = specialCharCount / str.length;
    if (specialCharRatio > 0.3 && str.length > 10) {
      errors[fieldName] = 'Input contains too many special characters.';
      return errors;
    }

    // Check for repeated patterns (potential injection)
    const repeatedPatterns = [
      /(.{3,})\1{3,}/g, // Same 3+ chars repeated 3+ times
      /(\w)\1{10,}/g,   // Same character repeated 10+ times
    ];

    if (repeatedPatterns.some(pattern => pattern.test(str))) {
      errors[fieldName] = 'Input contains suspicious repeated patterns.';
      return errors;
    }

    return errors;
  };

  const validateField = (field, value) => {
    const errors = {};

    // First check security
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
        // Only validate for chamas
        if (chamaData.group_type === 'chama') {
          const amount = parseFloat(value);
          if (!value || isNaN(amount)) {
            errors.contribution_amount = 'Please enter a valid contribution amount';
          } else if (amount < 10) {
            errors.contribution_amount = 'Minimum contribution amount is KES 10';
          } else if (amount > 1000000) {
            errors.contribution_amount = 'Maximum contribution amount is KES 1,000,000';
          }
        } else if (chamaData.group_type === 'contribution') {
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
        // Only validate for contributions
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
        // Only validate for contributions
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
        // Only required/checked when TILL is the selected payment method
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
        // Only required/checked when PAYBILL is the selected payment method
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
        // Only required/checked when PAYBILL is the selected payment method
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
    }

    return errors;
  };

  // Final sanitization for form submission (maximum security)
  const finalSanitizeInput = (value, type = 'text') => {
    if (!value) return '';

    let sanitized = value.toString();

    // Apply all security patterns aggressively
    Object.values(securityPatterns).forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    // Additional encoding for dangerous characters
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    switch (type) {
      case 'text':
        // Ultra-clean text
        sanitized = sanitized.replace(/[^\w\s\-_.]/g, '').trim();
        return sanitized.substring(0, 255);

      case 'name':
        // Names - only safe characters
        sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-_.]/g, '').trim();
        // Remove multiple spaces
        sanitized = sanitized.replace(/\s+/g, ' ');
        return sanitized.substring(0, 100);

      case 'number':
        // Numbers - strict validation
        sanitized = sanitized.replace(/[^0-9.]/g, '');
        const parts = sanitized.split('.');
        if (parts.length > 2) {
          sanitized = parts[0] + '.' + parts.slice(1).join('');
        }
        // Prevent leading zeros except for decimals
        if (sanitized.length > 1 && sanitized[0] === '0' && sanitized[1] !== '.') {
          sanitized = sanitized.replace(/^0+/, '');
        }
        return sanitized.substring(0, 20);

      case 'alphanumeric':
        // Account numbers - ultra strict
        sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, '');
        return sanitized.substring(0, 50);

      case 'description':
        // Descriptions - clean but readable
        sanitized = sanitized.replace(/[^\w\s\-_.,!?]/g, '').trim();
        sanitized = sanitized.replace(/\s+/g, ' ');
        return sanitized.substring(0, 1000);

      case 'location':
        // Locations - letters and spaces only
        sanitized = sanitized.replace(/[^a-zA-Z\s\-]/g, '').trim();
        sanitized = sanitized.replace(/\s+/g, ' ');
        return sanitized.substring(0, 50);

      default:
        sanitized = sanitized.replace(/[^\w\s]/g, '').trim();
        return sanitized.substring(0, 255);
    }
  };

  const handleInputChange = (field, value) => {
    // Light sanitization during typing - only remove truly dangerous characters
    let sanitizedValue = value;
    switch (field) {
      case 'name':
      case 'payment_recipient_name':
        // Allow spaces and normal characters while typing
        sanitizedValue = sanitizeInput(value, 'name');
        break;
      case 'description':
      case 'rules':
      case 'contribution_rules':
        // Allow spaces and normal text while typing
        sanitizedValue = sanitizeInput(value, 'description');
        break;
      case 'contribution_amount':
      case 'target_amount':
      case 'max_members':
        // Only allow numbers
        sanitizedValue = sanitizeInput(value, 'number');
        break;
      case 'till_number':
      case 'paybill_business_number':
        // TILL and PAYBILL business numbers are digits only
        sanitizedValue = sanitizeInput(value, 'number').replace(/\./g, '');
        break;
      case 'paybill_account_number':
        // Allow alphanumeric while typing
        sanitizedValue = sanitizeInput(value, 'alphanumeric');
        break;
      case 'county':
      case 'town':
        // Location fields - strict validation
        sanitizedValue = sanitizeInput(value, 'location');
        break;
      case 'meeting_schedule':
        // Allow normal text with spaces
        sanitizedValue = sanitizeInput(value, 'text');
        break;
      default:
        // Minimal sanitization for other fields
        sanitizedValue = value.toString().replace(/[<>\"'&]/g, '');
    }

    setChamaData(prev => ({
      ...prev,
      [field]: sanitizedValue,
    }));

    // Validate field and update errors
    const fieldErrors = validateField(field, sanitizedValue);
    setFormErrors(prev => ({
      ...prev,
      ...fieldErrors,
      // Remove error if field is now valid
      ...(Object.keys(fieldErrors).length === 0 && { [field]: undefined })
    }));

    // Check for duplicate chama name when name changes
    if (field === 'name') {
      checkChamaNameAvailability(sanitizedValue);
    }
  };

  // Function to check if chama name already exists
  const checkChamaNameAvailability = async (name) => {
    if (!name || name.length < 3) {
      setNameValidation({ isValid: true, message: '' });
      return;
    }

    try {
      setCheckingName(true);

       // Check against all public chamas
       const response = await ApiService.getChamas(20, 0);
       
      // Handle different response structures
      let chamasData = [];

      if (response && response.success) {
        // If response has data property
        if (response.data && Array.isArray(response.data)) {
          chamasData = response.data;
        }
        // If response data is directly an array
        else if (Array.isArray(response)) {
          chamasData = response;
        }
        // If response is the chamas array directly
        else if (response.chamas && Array.isArray(response.chamas)) {
          chamasData = response.chamas;
        }
      }
      // Handle case where response is directly an array
      else if (Array.isArray(response)) {
        chamasData = response;
      }

      if (chamasData.length > 0) {
        const existingChama = chamasData.find(chama =>
          chama && chama.name &&
          chama.name.toLowerCase().trim() === name.toLowerCase().trim()
        );

        if (existingChama) {
          setNameValidation({
            isValid: false,
            message: 'A chama with this name already exists. Please choose a different name.'
          });
        } else {
          setNameValidation({ isValid: true, message: 'Name is available!' });
        }
      } else {
        // No chamas found or empty response - name is available
        setNameValidation({ isValid: true, message: 'Name is available!' });
      }
    } catch (error) {
      // Don't block user if check fails - allow them to proceed
      setNameValidation({ isValid: true, message: '' });
    } finally {
      setCheckingName(false);
    }
  };

  // User search functionality
  const searchUsers = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const response = await ApiService.searchUsers(query);
      if (response.success) {
        // Filter out current user and already selected members
        const filteredResults = response.data.filter(searchUser =>
          searchUser.id !== user.id &&
          !selectedMembers.some(member => member.id === searchUser.id)
        );
        setSearchResults(filteredResults);
      }
    } catch (error) {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const addMember = (user, role = 'member') => {
    const newMember = {
      ...user,
      role: role,
    };
    setSelectedMembers(prev => [...prev, newMember]);
    setSearchResults(prev => prev.filter(u => u.id !== user.id));
    setSearchQuery('');
  };

  const removeMember = (userId) => {
    setSelectedMembers(prev => prev.filter(member => member.id !== userId));
  };

  const updateMemberRole = (userId, newRole) => {
    setSelectedMembers(prev =>
      prev.map(member =>
        member.id === userId ? { ...member, role: newRole } : member
      )
    );
  };

  const validateStep = (step, showErrors = false) => {
    const errors = {};
    let isValid = true;

    switch (step) {
      case 1:
        // Validate all step 1 fields
        const groupTypeErrors = validateField('group_type', chamaData.group_type);
        const nameErrors = validateField('name', chamaData.name);
        const descErrors = validateField('description', chamaData.description);
        const typeErrors = validateField('type', chamaData.type);

        Object.assign(errors, groupTypeErrors, nameErrors, descErrors, typeErrors);

        if (!nameValidation.isValid) {
          errors.name = nameValidation.message;
        }

        isValid = Object.keys(errors).length === 0 && nameValidation.isValid;
        break;

      case 2:
        // Validate all step 2 fields
        const countyErrors = validateField('county', chamaData.county);
        const townErrors = validateField('town', chamaData.town);
        const membersErrors = validateField('max_members', chamaData.max_members);

        // Conditional validation based on group type
        let financialErrors = {};

        if (chamaData.group_type === 'chama') {
          financialErrors = validateField('contribution_amount', chamaData.contribution_amount);
        } else if (chamaData.group_type === 'contribution') {
          const targetAmountErrors = validateField('target_amount', chamaData.target_amount);
          const contributionRulesErrors = validateField('contribution_rules', chamaData.contribution_rules);
          Object.assign(financialErrors, targetAmountErrors, contributionRulesErrors);
        }
        Object.assign(errors, countyErrors, townErrors, membersErrors, financialErrors);

        // Payment method fields - only checked when a payment method is actually selected
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
        // Optional step - members (always valid)
        isValid = true;
        break;

      case 4:
        // Validate optional fields if they have values
        if (chamaData.rules) {
          const rulesErrors = validateField('rules', chamaData.rules);
          Object.assign(errors, rulesErrors);
        }

        if (chamaData.meeting_schedule) {
          const scheduleErrors = validateField('meeting_schedule', chamaData.meeting_schedule);
          Object.assign(errors, scheduleErrors);
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

    // Validate all steps
    for (let step = 1; step <= 4; step++) {
      validateStep(step, false);
    }

    // Define fields to validate based on group type
    const commonFields = ['group_type', 'name', 'description', 'type', 'county', 'town', 'max_members', 'meeting_schedule'];
    const chamaFields = ['contribution_amount', 'contribution_frequency', 'rules'];
    const contributionFields = ['target_amount', 'contribution_rules'];

    // Collect validation errors only for relevant fields
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

    // Payment method fields - only checked when a payment method is actually selected
    if (chamaData.payment_method === 'till') {
      Object.assign(allErrors, validateField('till_number', chamaData.till_number));
      Object.assign(allErrors, validateField('payment_recipient_name', chamaData.payment_recipient_name));
    } else if (chamaData.payment_method === 'paybill') {
      Object.assign(allErrors, validateField('paybill_business_number', chamaData.paybill_business_number));
      Object.assign(allErrors, validateField('paybill_account_number', chamaData.paybill_account_number));
      Object.assign(allErrors, validateField('payment_recipient_name', chamaData.payment_recipient_name));
    }

    // Add name validation error if exists
    if (!nameValidation.isValid) {
      allErrors.name = nameValidation.message;
    }

    setFormErrors(allErrors);
    setShowErrors(true);

    return Object.keys(allErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep, true)) {
      setCurrentStep(currentStep + 1);
      setShowErrors(false); // Hide errors when moving to next step
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
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    // Security checks first
    const currentTime = Date.now();

    // Rate limiting - prevent rapid submissions
    if (currentTime - lastSubmissionTime < 5000) { // 5 second cooldown
      Toast.show({
        type: 'error',
        text1: 'Too Fast!',
        text2: 'Please wait 5 seconds between submissions',
      });
      return;
    }

    // Block after too many attempts
    if (submissionAttempts >= 5) {
      setIsBlocked(true);
      Toast.show({
        type: 'error',
        text1: 'Too Many Attempts',
        text2: 'Please refresh the page and try again',
      });
      return;
    }

    // Check if user is blocked
    if (isBlocked) {
      Toast.show({
        type: 'error',
        text1: 'Submission Blocked',
        text2: 'Please refresh the page to continue',
      });
      return;
    }

    // Update security tracking
    setSubmissionAttempts(prev => prev + 1);
    setLastSubmissionTime(currentTime);

    // Validate all steps before submission
    if (!validateAllSteps()) {
      Toast.show({
        type: 'error',
        text1: 'Form Validation Failed',
        text2: 'Please fix all errors before creating the chama',
        visibilityTime: 4000,
      });
      return;
    }

    // Final check for duplicate name before submission
    if (!nameValidation.isValid) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Chama Name',
        text2: nameValidation.message,
        visibilityTime: 4000,
      });
      return;
    }

    try {
      setLoading(true);

      // Double-check name availability one more time before creating
      await checkChamaNameAvailability(chamaData.name);

      if (!nameValidation.isValid) {
        Toast.show({
          type: 'error',
          text1: 'Chama Name Unavailable',
          text2: 'This chama name is no longer available. Please choose a different name.',
          visibilityTime: 4000,
        });
        setLoading(false);
        return;
      }

      // Additional security validation before sending to server
      const baseData = {
        name: finalSanitizeInput(chamaData.name, 'name'),
        description: finalSanitizeInput(chamaData.description, 'description'),
        category: chamaData.group_type, // 'chama' or 'contribution' - backend expects 'category'
        type: chamaData.type,
        county: finalSanitizeInput(chamaData.county, 'location'),
        town: finalSanitizeInput(chamaData.town, 'location'),
        max_members: parseInt(chamaData.max_members),
        is_public: Boolean(chamaData.is_public),
        requires_approval: Boolean(chamaData.requires_approval),
        meeting_schedule: finalSanitizeInput(chamaData.meeting_schedule, 'text'),
        // Payment method fields
        payment_method: chamaData.payment_method || '',
        till_number: chamaData.payment_method === 'till' ? finalSanitizeInput(chamaData.till_number, 'alphanumeric') : '',
        paybill_business_number: chamaData.payment_method === 'paybill' ? finalSanitizeInput(chamaData.paybill_business_number, 'alphanumeric') : '',
        paybill_account_number: chamaData.payment_method === 'paybill' ? finalSanitizeInput(chamaData.paybill_account_number, 'alphanumeric') : '',
        payment_recipient_name: chamaData.payment_method ? finalSanitizeInput(chamaData.payment_recipient_name, 'name') : '',
        created_by: user.id,
      };

      // Add conditional fields based on group type
      const sanitizedData = {
        ...baseData,
        ...(chamaData.group_type === 'chama' ? {
          // Chama-specific fields
          contribution_amount: parseFloat(chamaData.contribution_amount),
          contribution_frequency: chamaData.contribution_frequency,
          rules: finalSanitizeInput(chamaData.rules, 'description'),
        } : {
          // Contribution-specific fields
          target_amount: parseFloat(chamaData.target_amount),
          contribution_rules: finalSanitizeInput(chamaData.contribution_rules, 'description'),
        })
      };

      // Comprehensive security validation of sanitized data
      const securityValidation = {
        // Check all string fields for security
        name: isSecureInput(sanitizedData.name, 'name'),
        description: isSecureInput(sanitizedData.description, 'description'),
        county: isSecureInput(sanitizedData.county, 'location'),
        town: isSecureInput(sanitizedData.town, 'location'),
        meeting_schedule: isSecureInput(sanitizedData.meeting_schedule, 'text'),
        payment_recipient_name: sanitizedData.payment_recipient_name ? isSecureInput(sanitizedData.payment_recipient_name, 'name') : true,
      };

      // Check conditional fields
      if (chamaData.group_type === 'chama') {
        securityValidation.rules = sanitizedData.rules ? isSecureInput(sanitizedData.rules, 'description') : true;
      } else {
        securityValidation.contribution_rules = sanitizedData.contribution_rules ? isSecureInput(sanitizedData.contribution_rules, 'description') : true;
      }

      // Fail if any security check fails
      const securityPassed = Object.values(securityValidation).every(Boolean);
      if (!securityPassed) {
        throw new Error('Security validation failed. Please check your inputs for suspicious content.');
      }

      // Validate sanitized data structure and ranges
      const baseValidation = [
        sanitizedData.name.length >= 3 && sanitizedData.name.length <= 100,
        sanitizedData.description.length >= 10 && sanitizedData.description.length <= 1000,
        ['chama', 'contribution'].includes(sanitizedData.category),
        sanitizedData.max_members >= 2 && sanitizedData.max_members <= 1000,
        sanitizedData.county.length >= 2 && sanitizedData.county.length <= 50,
        sanitizedData.town.length >= 2 && sanitizedData.town.length <= 50,
        // Additional security checks
        typeof sanitizedData.name === 'string',
        typeof sanitizedData.description === 'string',
        typeof sanitizedData.category === 'string',
        typeof sanitizedData.county === 'string',
        typeof sanitizedData.town === 'string',
        Number.isInteger(sanitizedData.max_members),
        sanitizedData.max_members > 0,
      ];

      // Conditional validation based on group type with security checks
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

      // Payment method validation if provided
      const paymentValidation = [];
      if (sanitizedData.payment_method) {
        paymentValidation.push(
          ['till', 'paybill'].includes(sanitizedData.payment_method),
          typeof sanitizedData.payment_method === 'string'
        );

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

      const formData = {
        ...sanitizedData,
        // Add members data - creator is automatically chairperson
        members: [
          {
            user_id: user.id,
            role: 'chairperson',
            status: 'active',
          },
          ...selectedMembers.map(member => ({
            user_id: member.id,
            role: member.role,
            status: 'pending', // Members need to accept invitation
          }))
        ]
      };

      const response = await ApiService.createChama(formData);

      if (response.success) {
        // Refresh user chamas in context
        if (typeof loadUserChamas === 'function') {
          await loadUserChamas();
        }

        // Show success message with Toast instead of Alert
        const isContribution = chamaData.group_type === 'contribution';
        // Reset security state on success
        setSubmissionAttempts(0);
        setLastSubmissionTime(0);
        setIsBlocked(false);

        Toast.show({
          type: 'success',
          text1: `${isContribution ? 'Contribution Group' : 'Chama'} Created Successfully!`,
          text2: `Your ${isContribution ? 'contribution group' : 'chama'} has been created and you are now the chairperson.`,
          visibilityTime: 3000,
        });

        // Navigate back to My Chamas screen to show the newly created chama
        // This follows the same pattern as welfare creation
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

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3, 4].map((step) => (
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
              {step}
            </Text>
          </View>
          {step < 4 && (
            <View style={[
              styles.stepLine,
              { backgroundColor: step < currentStep ? colors.primary : colors.border }
            ]} />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <Card style={styles.section}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        What do you want to create?
      </Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
        Choose the type of group you want to create
      </Text>

      {/* Creation Type Selection */}
      <View style={[
        styles.typeContainer,
        showErrors && formErrors.group_type && { borderColor: colors.error, borderWidth: 1, borderRadius: 8 }
      ]}>
        {creationOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.typeCard,
              {
                backgroundColor: chamaData.group_type === option.id ? option.color + '20' : colors.backgroundSecondary,
                borderColor: chamaData.group_type === option.id ? option.color : colors.border,
                borderWidth: 2,
              }
            ]}
            onPress={() => {
              setChamaData(prev => ({
                ...prev,
                group_type: option.id,
                type: '', // Reset type when group type changes
                name: '', // Reset name to update placeholder
                description: '', // Reset description to update placeholder
                // Clear fields that don't apply to the selected group type
                contribution_amount: option.id === 'contribution' ? '' : prev.contribution_amount,
                target_amount: option.id === 'chama' ? '' : prev.target_amount,
                contribution_rules: option.id === 'chama' ? '' : prev.contribution_rules,
                rules: option.id === 'contribution' ? '' : prev.rules,
              }));

              // Clear any existing form errors when switching group types
              setFormErrors({});
              setShowErrors(false);
            }}
          >
            {chamaData.group_type === option.id && (
              <View style={[styles.checkBadge, { backgroundColor: option.color }]}>
                <Ionicons name="checkmark" size={10} color={colors.white} />
              </View>
            )}
            <Ionicons
              name={option.icon}
              size={22}
              color={chamaData.group_type === option.id ? option.color : colors.textSecondary}
            />
            <Text style={[
              styles.typeName,
              {
                color: chamaData.group_type === option.id ? option.color : colors.text,
                fontWeight: chamaData.group_type === option.id ? 'bold' : 'normal',
              }
            ]} numberOfLines={1}>
              {option.name}
            </Text>
            <Text style={[styles.typeDescription, { color: colors.textSecondary, textAlign: 'center' }]} numberOfLines={2}>
              {option.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {showErrors && formErrors.group_type && (
        <Text style={[styles.errorText, { color: colors.error }]}>
          {formErrors.group_type}
        </Text>
      )}

      {/* Show rest of form only after user selects what to create */}
      {chamaData.group_type && (
        <>
          <Input
            label={`${chamaData.group_type === 'contribution' ? 'Contribution Group' : 'Chama'} Name *`}
            value={chamaData.name}
            onChangeText={(text) => handleInputChange('name', text)}
            placeholder={`Enter ${chamaData.group_type === 'contribution' ? 'contribution group' : 'chama'} name`}
            loading={checkingName}
            rightIcon={
              chamaData.name.length >= 3 && !checkingName ? (
                nameValidation.isValid && !formErrors.name ? 'checkmark-circle' : 'close-circle'
              ) : undefined
            }
            rightIconColor={nameValidation.isValid && !formErrors.name ? colors.success : colors.error}
            error={showErrors && (formErrors.name || (!nameValidation.isValid ? nameValidation.message : undefined))}
            success={nameValidation.isValid && nameValidation.message && !formErrors.name ? nameValidation.message : undefined}
            style={{ marginTop: spacing.lg }}
          />

          <Input
            label="Description *"
            value={chamaData.description}
            onChangeText={(text) => handleInputChange('description', text)}
            placeholder={`Describe your ${chamaData.group_type === 'contribution' ? 'contribution goal and purpose' : 'chama\'s purpose'}...`}
            multiline
            numberOfLines={4}
            error={showErrors && formErrors.description}
          />

          {/* Conditional Type Selection */}
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            {chamaData.group_type === 'contribution' ? 'Contribution Type *' : 'Chama Type *'}
          </Text>
          <View style={[
            styles.typeContainer,
            showErrors && formErrors.type && { borderColor: colors.error, borderWidth: 1, borderRadius: 8 }
          ]}>
            {(chamaData.group_type === 'contribution' ? contributionTypes : chamaTypes).map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: chamaData.type === type.id ? colors.primary + '20' : colors.backgroundSecondary,
                    borderColor: chamaData.type === type.id ? colors.primary : colors.border,
                  }
                ]}
                onPress={() => handleInputChange('type', type.id)}
              >
                {chamaData.type === type.id && (
                  <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                    <Ionicons name="checkmark" size={10} color={colors.white} />
                  </View>
                )}
                <Ionicons
                  name={type.icon}
                  size={18}
                  color={chamaData.type === type.id ? colors.primary : colors.textSecondary}
                />
                <Text style={[
                  styles.typeName,
                  { color: chamaData.type === type.id ? colors.primary : colors.text }
                ]} numberOfLines={1}>
                  {type.name}
                </Text>
                <Text style={[styles.typeDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                  {type.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {showErrors && formErrors.type && (
            <Text style={[styles.errorText, { color: colors.error }]}>
              {formErrors.type}
            </Text>
          )}
        </>
      )}
    </Card>
  );

  const renderStep2 = () => (
    <Card style={styles.section}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        {chamaData.group_type === 'contribution' ? 'Target & Location Details' : 'Financial & Location Details'}
      </Text>

      {/* Location Details - Same for both */}
      <View style={styles.row}>
        <Input
          label="County *"
          value={chamaData.county}
          onChangeText={(text) => handleInputChange('county', text)}
          placeholder="Select county"
          style={styles.halfInput}
          error={showErrors && formErrors.county}
        />

        <Input
          label="Town *"
          value={chamaData.town}
          onChangeText={(text) => handleInputChange('town', text)}
          placeholder="Select town"
          style={styles.halfInput}
          error={showErrors && formErrors.town}
        />
      </View>

      {/* Conditional Financial Fields based on Group Type */}
      {chamaData.group_type === 'chama' && (
        <View style={styles.row}>
          <Input
            label="Contribution Amount (KES) *"
            value={chamaData.contribution_amount}
            onChangeText={(text) => handleInputChange('contribution_amount', text)}
            placeholder="0"
            keyboardType="numeric"
            style={styles.halfInput}
            error={showErrors && formErrors.contribution_amount}
          />

          <View style={styles.halfInput}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              Frequency *
            </Text>
            <View style={styles.frequencyContainer}>
              {frequencies.map((freq) => (
                <TouchableOpacity
                  key={freq.id}
                  style={[
                    styles.frequencyChip,
                    {
                      backgroundColor: chamaData.contribution_frequency === freq.id ? colors.primary : colors.backgroundSecondary,
                      borderColor: colors.border,
                    }
                  ]}
                  onPress={() => handleInputChange('contribution_frequency', freq.id)}
                >
                  <Text style={[
                    styles.frequencyText,
                    { color: chamaData.contribution_frequency === freq.id ? colors.white : colors.text }
                  ]}>
                    {freq.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {chamaData.group_type === 'contribution' && (
        <>
          <Input
            label="Target Amount (KES) *"
            value={chamaData.target_amount}
            onChangeText={(text) => handleInputChange('target_amount', text)}
            placeholder="e.g., 50000"
            keyboardType="numeric"
            error={showErrors && formErrors.target_amount}
          />

          <Input
            label="Contribution Rules"
            value={chamaData.contribution_rules}
            onChangeText={(text) => handleInputChange('contribution_rules', text)}
            placeholder="e.g., Minimum KES 100 per person, Deadline: End of month, No refunds after target reached"
            multiline
            numberOfLines={3}
            error={showErrors && formErrors.contribution_rules}
          />
        </>
      )}

      {/* Payment Method Section - Same for both */}
      <View style={styles.paymentMethodSection}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Payment Method (Optional)
        </Text>
        <View style={styles.descriptionContainer}>
          <Text
            style={[styles.sectionDescription, { color: colors.textSecondary }]}
            adjustsFontSizeToFit={false}
            allowFontScaling={true}
          >
            Configure how members will send payments to this {chamaData.group_type === 'contribution' ? 'contribution group' : 'chama'}
          </Text>
        </View>
      </View>

      {/* Payment Method Selection */}
      <View style={styles.paymentMethodRow}>
        <TouchableOpacity
          style={[
            styles.paymentMethodCard,
            styles.paymentMethodCardLeft,
            {
              backgroundColor: chamaData.payment_method === 'till' ? colors.primary + '20' : colors.backgroundSecondary,
              borderColor: chamaData.payment_method === 'till' ? colors.primary : colors.border,
            }
          ]}
          onPress={() => handleInputChange('payment_method', chamaData.payment_method === 'till' ? '' : 'till')}
        >
          {chamaData.payment_method === 'till' && (
            <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="checkmark" size={10} color={colors.white} />
            </View>
          )}
          <Ionicons
            name="card"
            size={24}
            color={chamaData.payment_method === 'till' ? colors.primary : colors.textSecondary}
          />
          <Text style={[
            styles.paymentMethodText,
            { color: chamaData.payment_method === 'till' ? colors.primary : colors.text }
          ]}>
            TILL
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.paymentMethodCard,
            styles.paymentMethodCardRight,
            {
              backgroundColor: chamaData.payment_method === 'paybill' ? colors.primary + '20' : colors.backgroundSecondary,
              borderColor: chamaData.payment_method === 'paybill' ? colors.primary : colors.border,
            }
          ]}
          onPress={() => handleInputChange('payment_method', chamaData.payment_method === 'paybill' ? '' : 'paybill')}
        >
          {chamaData.payment_method === 'paybill' && (
            <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="checkmark" size={10} color={colors.white} />
            </View>
          )}
          <Ionicons
            name="business"
            size={24}
            color={chamaData.payment_method === 'paybill' ? colors.primary : colors.textSecondary}
          />
          <Text style={[
            styles.paymentMethodText,
            { color: chamaData.payment_method === 'paybill' ? colors.primary : colors.text }
          ]}>
            PAYBILL
          </Text>
        </TouchableOpacity>
      </View>

      {/* TILL Number Input */}
      {chamaData.payment_method === 'till' && (
        <View>
          <Input
            label="TILL Number *"
            value={chamaData.till_number}
            onChangeText={(text) => handleInputChange('till_number', text)}
            placeholder="e.g., 123456"
            keyboardType="numeric"
            maxLength={10}
            error={showErrors && formErrors.till_number}
          />
          <Input
            label="Recipient Name *"
            value={chamaData.payment_recipient_name}
            onChangeText={(text) => handleInputChange('payment_recipient_name', text)}
            placeholder="Name members will see when paying"
            error={showErrors && formErrors.payment_recipient_name}
          />
        </View>
      )}

      {/* PAYBILL Details Input */}
      {chamaData.payment_method === 'paybill' && (
        <View>
          <Input
            label="Business Number *"
            value={chamaData.paybill_business_number}
            onChangeText={(text) => handleInputChange('paybill_business_number', text)}
            placeholder="e.g., 123456"
            keyboardType="numeric"
            maxLength={10}
            error={showErrors && formErrors.paybill_business_number}
          />
          <Input
            label="Account Number *"
            value={chamaData.paybill_account_number}
            onChangeText={(text) => handleInputChange('paybill_account_number', text)}
            placeholder="Account number for payments"
            error={showErrors && formErrors.paybill_account_number}
          />
          <Input
            label="Recipient Name *"
            value={chamaData.payment_recipient_name}
            onChangeText={(text) => handleInputChange('payment_recipient_name', text)}
            placeholder="Name members will see when paying"
            error={showErrors && formErrors.payment_recipient_name}
          />
        </View>
      )}

      {/* Maximum Members - Same for both */}
      <Input
        label="Maximum Members *"
        value={chamaData.max_members}
        onChangeText={(text) => handleInputChange('max_members', text)}
        placeholder="e.g., 20"
        keyboardType="numeric"
        error={showErrors && formErrors.max_members}
        style={{ marginTop: spacing.lg }}
      />
    </Card>
  );

  const renderStep3 = () => (
    <Card style={styles.section}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        Add Members (Optional)
      </Text>

      <View style={styles.descriptionContainer}>
        <Text
          style={[styles.stepDescription, { color: colors.textSecondary }]}
          adjustsFontSizeToFit={false}
          allowFontScaling={true}
        >
          Search and add members to your {chamaData.group_type === 'contribution' ? 'contribution group' : 'chama'}. You can assign roles to help manage the group.
        </Text>
      </View>

      {/* User Search */}
      <Input
        label="Search Users"
        value={searchQuery}
        onChangeText={(text) => {
          setSearchQuery(text);
          searchUsers(text);
        }}
        placeholder="Search by name, email, or phone number..."
        leftIcon="search"
        loading={searchLoading}
      />

      {/* Search Results */}
      {searchResults.length > 0 && (
        <View style={styles.searchResults}>
          <Text style={[styles.sectionSubtitle, { color: colors.text }]}>
            Search Results
          </Text>
          {searchResults.map((user) => (
            <TouchableOpacity
              key={user.id}
              style={[styles.userItem, { borderBottomColor: colors.border }]}
              onPress={() => addMember(user)}
            >
              <View style={styles.userInfo}>
                <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.userInitials, { color: colors.white }]}>
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </Text>
                </View>
                <View style={styles.userDetails}>
                  <Text style={[styles.userName, { color: colors.text }]}>
                    {user.firstName} {user.lastName}
                  </Text>
                  <Text style={[styles.userContact, { color: colors.textSecondary }]}>
                    {user.email} • {user.phone}
                  </Text>
                </View>
              </View>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Selected Members */}
      {selectedMembers.length > 0 && (
        <View style={styles.selectedMembers}>
          <Text style={[styles.sectionSubtitle, { color: colors.text }]}>
            Selected Members ({selectedMembers.length})
          </Text>

          {/* Creator (Chairperson) */}
          <View style={[styles.memberItem, { borderBottomColor: colors.border }]}>
            <View style={styles.memberInfo}>
              <View style={[styles.userAvatar, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.userInitials, { color: colors.white }]}>
                  {user.firstName?.[0]}{user.lastName?.[0]}
                </Text>
              </View>
              <View style={styles.userDetails}>
                <Text style={[styles.userName, { color: colors.text }]}>
                  {user.firstName} {user.lastName} (You)
                </Text>
                <Text style={[styles.userContact, { color: colors.textSecondary }]}>
                  {user.email}
                </Text>
              </View>
            </View>
            <View style={[styles.roleChip, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.roleText, { color: colors.white }]}>
                Chairperson
              </Text>
            </View>
          </View>

          {/* Other Members */}
          {selectedMembers.map((member) => (
            <View key={member.id} style={[styles.memberItem, { borderBottomColor: colors.border }]}>
              <View style={styles.memberInfo}>
                <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.userInitials, { color: colors.white }]}>
                    {member.firstName?.[0]}{member.lastName?.[0]}
                  </Text>
                </View>
                <View style={styles.userDetails}>
                  <Text style={[styles.userName, { color: colors.text }]}>
                    {member.firstName} {member.lastName}
                  </Text>
                  <Text style={[styles.userContact, { color: colors.textSecondary }]}>
                    {member.email}
                  </Text>
                </View>
              </View>

              <View style={styles.memberActions}>
                {/* Role Selector */}
                <View style={styles.roleSelector}>
                  {memberRoles.map((role) => (
                    <TouchableOpacity
                      key={role.id}
                      style={[
                        styles.roleOption,
                        {
                          backgroundColor: member.role === role.id ? colors.primary : colors.backgroundSecondary,
                          borderColor: colors.border,
                        }
                      ]}
                      onPress={() => updateMemberRole(member.id, role.id)}
                    >
                      <Text style={[
                        styles.roleOptionText,
                        { color: member.role === role.id ? colors.white : colors.text }
                      ]}>
                        {role.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Remove Button */}
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeMember(member.id)}
                >
                  <Ionicons name="close-circle" size={24} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {selectedMembers.length === 0 && searchResults.length === 0 && !searchQuery && (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            Search for users to add as members
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
            You can skip this step and add members later
          </Text>
        </View>
      )}
    </Card>
  );

  const renderStep4 = () => (
    <Card style={styles.section}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        Settings & Rules
      </Text>

      {/* Public/Private Setting - Same for both */}
      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>
            {chamaData.group_type === 'contribution' ? 'Public Contribution Group' : 'Public Chama'}
          </Text>
          <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
            {chamaData.group_type === 'contribution'
              ? 'Allow others to discover and join your contribution group'
              : 'Allow others to discover and join your chama'
            }
          </Text>
        </View>
        <Switch
          value={chamaData.is_public}
          onValueChange={(value) => handleInputChange('is_public', value)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
        />
      </View>

      {/* Approval Setting - Same for both */}
      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>
            Require Approval
          </Text>
          <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
            New members need approval to join
          </Text>
        </View>
        <Switch
          value={chamaData.requires_approval}
          onValueChange={(value) => handleInputChange('requires_approval', value)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
        />
      </View>

      {/* Conditional Rules Field */}
      {chamaData.group_type === 'chama' && (
        <Input
          label="Chama Rules (Optional)"
          value={chamaData.rules}
          onChangeText={(text) => handleInputChange('rules', text)}
          placeholder="Define rules and guidelines for your chama..."
          multiline
          numberOfLines={4}
          error={showErrors && formErrors.rules}
        />
      )}

      {/* Meeting Schedule - Same for both */}
      <Input
        label="Meeting Schedule (Optional)"
        value={chamaData.meeting_schedule}
        onChangeText={(text) => handleInputChange('meeting_schedule', text)}
        placeholder={chamaData.group_type === 'contribution'
          ? 'e.g., Weekly check-ins every Sunday at 7 PM'
          : 'e.g., Every first Saturday of the month at 2 PM'
        }
        error={showErrors && formErrors.meeting_schedule}
      />

      {/* Contribution-specific note */}
      {chamaData.group_type === 'contribution' && (
        <View style={[styles.infoBox, { backgroundColor: colors.info + '10', borderColor: colors.info }]}>
          <Ionicons name="information-circle" size={20} color={colors.info} />
          <Text style={[styles.infoText, { color: colors.info, marginLeft: spacing.sm }]}>
            Contribution rules were set in Step 2. You can modify them later from the group settings.
          </Text>
        </View>
      )}
    </Card>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return null;
    }
  };

  const renderNavigationButtons = () => (
    <View style={[styles.navigationButtons, { backgroundColor: colors.surface }]}>
      {currentStep > 1 && (
        <Button
          title="Back"
          variant="outline"
          onPress={handleBack}
          style={styles.navButton}
        />
      )}

      {currentStep < 4 ? (
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 140 }} // Extra padding for stack screens + fixed buttons
        showsVerticalScrollIndicator={false}
      >
        {renderStepIndicator()}
        {renderStepContent()}

        {/* Spacer for fixed buttons */}
        <View style={styles.spacer} />
      </ScrollView>

      {renderNavigationButtons()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.sm, // Add horizontal padding to prevent touching screen edges
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
    textAlign: 'left', // Changed from center to left for better mobile readability
    marginBottom: spacing.xl,
    lineHeight: 24, // Fixed line height for better mobile spacing
    paddingHorizontal: spacing.lg,
    letterSpacing: 0.2,
    width: '100%',
    flexShrink: 1,
    flexGrow: 1,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
  },
  // Compact 2-column grid for type selection cards (was a full-width stacked list)
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  typeCard: {
    width: '48%',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.xs,
    marginBottom: 2,
    textAlign: 'center',
  },
  typeDescription: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  frequencyContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  frequencyChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  frequencyText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: spacing.md,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  settingDescription: {
    fontSize: typography.fontSize.sm,
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
  // Member management styles
  searchResults: {
    marginTop: spacing.md,
  },
  selectedMembers: {
    marginTop: spacing.lg,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  memberItem: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginBottom: spacing.sm,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  userInitials: {
    fontSize: typography.fontSize.base,
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
  },
  memberActions: {
    alignItems: 'flex-end',
  },
  roleSelector: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  roleOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  roleOptionText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  roleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  roleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  removeButton: {
    padding: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  paymentMethodCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  paymentMethodText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: typography.lineHeight.normal,
  },
  // Responsive Layout Styles
  descriptionContainer: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
    marginHorizontal: spacing.xs, // Add margin from screen edges
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  paymentMethodSection: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    width: '100%',
    flexDirection: 'column',
  },
  sectionLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  sectionDescription: {
    fontSize: typography.fontSize.base,
    textAlign: 'left', // Changed from center to left for better mobile readability
    lineHeight: 22, // Fixed line height for mobile
    letterSpacing: 0.2,
    width: '100%',
    minHeight: 44, // Increased minimum height for mobile
    flexShrink: 1,
    flexGrow: 1,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md, // Increased padding from screen edges
    marginHorizontal: spacing.sm, // Add margin from screen edges
  },
  paymentMethodCardLeft: {
    flex: 1,
    marginRight: spacing.xs, // Reduced margin between cards
  },
  paymentMethodCardRight: {
    flex: 1,
    marginLeft: spacing.xs, // Reduced margin between cards
  },
});

export default CreateChamaScreen;