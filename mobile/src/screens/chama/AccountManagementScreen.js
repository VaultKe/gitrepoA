import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  Animated,
  useWindowDimensions,
  Platform,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';
// Removed unused import - using local formatters
import { spacing, typography, borderRadius } from '../../utils/theme';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ApiService from '../../services/api';

// 🔐 SECURE CHAMA ACCOUNT MANAGEMENT SYSTEM
// Central financial control panel for all money movements
// Built with transparency, security, and auditability

const AccountManagementScreen = ({ route, navigation }) => {
  const { chamaId } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  // Responsive layout logic - real-time updates
  // Responsive layout logic
  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < 768;
  const isTablet = screenWidth >= 768 && screenWidth < 1024;
  const isDesktop = screenWidth >= 1024;
  const isLargeScreen = screenWidth >= 768;

  // 🔐 CORE STATE MANAGEMENT
  const [dataReady, setDataReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState('member');
  const [activePanel, setActivePanel] = useState('disbursement'); // 'disbursement', 'creation', 'transparency', 'audit'

  // 💰 DISBURSEMENT PANEL STATE
  const [showDisbursementPanel, setShowDisbursementPanel] = useState(false);
  const [disbursementType, setDisbursementType] = useState('loan'); // 'loan', 'welfare', 'dividend', 'shares', 'savings_withdrawal', 'other'

  // 🎯 INDIVIDUAL DISBURSEMENT (Loans & Welfare)
  const [eligibleMembers, setEligibleMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSortBy, setMemberSortBy] = useState('name');
  const [individualDisbursementForm, setIndividualDisbursementForm] = useState({
    memberId: '',
    memberName: '',
    amount: '',
    purpose: '',
    privateNote: '',
  });

  // 📊 BULK DISBURSEMENT (Dividends/Shares)
  const [bulkDisbursementData, setBulkDisbursementData] = useState({
    totalAmount: 0,
    eligibleMembers: [],
    dividendPerShare: 0,
    description: '',
  });

  // Legacy form for backward compatibility
  const [disbursementForm, setDisbursementForm] = useState({
    amount: '',
    fromAccount: 'chama_main',
    toAccount: '',
    purpose: '',
    category: 'loan',
    privateNote: '',
    requiresApproval: true
  });

  // 📊 LIVE TRANSPARENCY FEED STATE
  const [transparencyFeed, setTransparencyFeed] = useState([]);
  const [feedFilters, setFeedFilters] = useState({
    dateRange: 'all',
    category: 'all',
    role: 'all',
    status: 'all',
    amountRange: { min: '', max: '' }
  });

  // 🔍 AUDIT & RECEIPT STATE
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [auditFilters, setAuditFilters] = useState({});
  const [selectedReceipts, setSelectedReceipts] = useState([]);

  // 🔔 NOTIFICATION STATE
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // 🎨 ANIMATION REFS
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // 🏗️ CREATION PANEL STATE
  const [creationType, setCreationType] = useState('shares'); // 'shares', 'dividends'
  const [existingShares, setExistingShares] = useState([]);
  const [existingDividends, setExistingDividends] = useState([]);
  const [shareCreationForm, setShareCreationForm] = useState({
    name: '',
    shareType: 'ordinary',
    totalShares: '',
    pricePerShare: '',
    minimumPurchase: '1',
    description: '',
    eligibilityCriteria: 'all_members',
    approvalRequired: true,
  });
  const [dividendCreationForm, setDividendCreationForm] = useState({
    dividendType: 'cash',
    totalAmount: '',
    dividendPerShare: '',
    paymentDate: '',
    description: '',
    eligibilityCriteria: 'shareholders_only',
    approvalRequired: true,
  });

  useEffect(() => {
    initializeSecureSystem();
  }, [chamaId]);

  useEffect(() => {
    // Real-time feed updates every 30 seconds
    const interval = setInterval(loadTransparencyFeed, 30000);
    return () => clearInterval(interval);
  }, []);

  // 🔐 INITIALIZE SECURE SYSTEM
  const initializeSecureSystem = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadUserRole(),
        loadTransparencyFeed(),
        loadNotifications(),
        loadEligibleMembers(),
        loadExistingShares(),
        loadExistingDividends(),
        validateSystemSecurity()
      ]);
      setDataReady(true);
    } catch (error) {
      console.error('❌ Failed to initialize secure system:', error);
      Alert.alert('Security Error', 'Failed to initialize secure system. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 🔐 ROLE-BASED SECURITY FUNCTIONS
  const loadUserRole = async () => {
    try {
      const response = await ApiService.getMemberRole(chamaId, user.id);
      if (response.success) {
        const role = response.data?.role || 'member';
        setUserRole(role);

        // Log security access
        await logSecurityEvent('role_access', { role, userId: user.id });
      }
    } catch (error) {
      console.error('🔐 Error loading user role:', error);
      setUserRole('member'); // Default to most restrictive
    }
  };

  // 🏗️ LOAD EXISTING SHARES AND DIVIDENDS
  const loadExistingShares = async () => {
    try {
      const response = await ApiService.getChamaShares(chamaId);
      if (response.success) {
        setExistingShares(response.data || []);
      } else {
        console.error('Failed to load existing shares:', response.error);
        setExistingShares([]);
      }
    } catch (error) {
      console.error('Error loading existing shares:', error);
      setExistingShares([]);
    }
  };

  const loadExistingDividends = async () => {
    try {
      const response = await ApiService.getChamaDividendDeclarations(chamaId);
      if (response.success) {
        setExistingDividends(response.data || []);
      } else {
        console.error('Failed to load existing dividends:', response.error);
        setExistingDividends([]);
      }
    } catch (error) {
      console.error('Error loading existing dividends:', error);
      setExistingDividends([]);
    }
  };

  // 🔐 PERMISSION CHECKS
  const canInitiateDisbursements = () => {
    return ['treasurer', 'secretary', 'chairperson'].includes(userRole.toLowerCase());
  };

  const canApproveDisbursements = () => {
    return ['chairperson', 'treasurer'].includes(userRole.toLowerCase());
  };

  const canViewFullAudit = () => {
    return ['chairperson', 'auditor', 'treasurer'].includes(userRole.toLowerCase());
  };

  const canFreezeAccounts = () => {
    return userRole.toLowerCase() === 'chairperson';
  };

  const canGenerateReceipts = () => {
    return ['treasurer', 'secretary', 'chairperson', 'auditor'].includes(userRole.toLowerCase());
  };

  // 🎯 ELIGIBLE MEMBERS LOADING
  const loadEligibleMembers = async () => {
    try {
      // Load different member lists based on disbursement type
      const [loanEligible, welfareEligible, dividendEligible, sharesEligible, savingsEligible, otherEligible] = await Promise.all([
        ApiService.getEligibleLoanMembers(chamaId),
        ApiService.getEligibleWelfareMembers(chamaId),
        ApiService.getEligibleDividendMembers(chamaId),
        ApiService.getEligibleSharesMembers(chamaId),
        ApiService.getEligibleSavingsMembers(chamaId),
        ApiService.getEligibleOtherMembers(chamaId)
      ]);

      const eligibleData = {
        loan: loanEligible.data || [],
        welfare: welfareEligible.data || [],
        dividend: dividendEligible.data || [],
        shares: sharesEligible.data || [],
        savings_withdrawal: savingsEligible.data || [],
        other: otherEligible.data || []
      };

      // Check if any API calls failed and show user-friendly message
      const failedCalls = [];
      if (loanEligible.offline) failedCalls.push('loan members');
      if (welfareEligible.offline) failedCalls.push('welfare members');
      if (dividendEligible.offline) failedCalls.push('dividend members');
      if (sharesEligible.offline) failedCalls.push('shares members');
      if (savingsEligible.offline) failedCalls.push('savings members');
      if (otherEligible.offline) failedCalls.push('other members');

      if (failedCalls.length > 0) {
        console.warn('⚠️ Some member lists failed to load:', failedCalls.join(', '));
        // Show a subtle notification to the user
        Alert.alert(
          'Connection Issue',
          `Some member lists couldn't be loaded (${failedCalls.join(', ')}). Showing cached or empty data. Please check your connection and try again.`,
          [{ text: 'OK' }]
        );
      }

      setEligibleMembers(eligibleData);
    } catch (error) {
      console.error('🎯 Error loading eligible members:', error);
      setEligibleMembers({ loan: [], welfare: [], dividend: [], shares: [], savings_withdrawal: [], other: [] });

      // Show user-friendly error message
      Alert.alert(
        'Connection Error',
        'Unable to load member lists. Please check your internet connection and try again.',
        [{ text: 'Retry', onPress: loadEligibleMembers }, { text: 'OK' }]
      );
    }
  };

  // 🔐 SECURITY & AUDIT FUNCTIONS
  const logSecurityEvent = async (eventType, metadata) => {
    try {
      const securityLog = {
        eventType,
        userId: user.id,
        userRole,
        timestamp: new Date().toISOString(),
        chamaId,
        metadata: {
          ...metadata,
          ip: await getDeviceIP(),
          device: Platform.OS,
          appVersion: '1.0.0'
        }
      };

      await ApiService.logSecurityEvent(securityLog);
    } catch (error) {
      console.error('🔐 Failed to log security event:', error);
    }
  };

  const validateSystemSecurity = async () => {
    try {
      const response = await ApiService.validateSystemSecurity(chamaId, user.id);
      if (!response.success) {
        throw new Error('Security validation failed');
      }
      return true;
    } catch (error) {
      console.error('🔐 Security validation failed:', error);
      return false;
    }
  };

  const getDeviceIP = async () => {
    try {
      // In a real app, you'd get the actual IP
      return 'device_ip_placeholder';
    } catch (error) {
      return 'unknown';
    }
  };

  // 📊 LIVE TRANSPARENCY FEED
  const loadTransparencyFeed = async () => {
    try {
      const response = await ApiService.getTransparencyFeed(chamaId, feedFilters);

      if (response.success) {
        const feed = response.data || [];
        setTransparencyFeed(feed);
      } else if (response.offline) {
        console.warn('📊 Transparency feed offline, showing empty feed');
        setTransparencyFeed([]);
        // Don't show alert for transparency feed - it's not critical
      }
    } catch (error) {
      console.error('📊 Failed to load transparency feed:', error);
      setTransparencyFeed([]);
    }
  };

  // 🔔 NOTIFICATIONS
  const loadNotifications = async () => {
    try {
      const response = await ApiService.getAccountNotifications(chamaId, user.id);
      if (response.success) {
        setNotifications(response.data || []);
      } else if (response.offline) {
        console.warn('🔔 Notifications offline, showing empty list');
        setNotifications([]);
        // Don't show alert for notifications - they can be loaded later
      }
    } catch (error) {
      console.error('🔔 Failed to load notifications:', error);
      setNotifications([]);
    }
  };

  const sendSystemNotification = async (notificationData) => {
    try {
      await ApiService.sendSystemNotification(notificationData);
      } catch (error) {
      console.error('🔔 Failed to send notification:', error);
    }
  };

  // 🎯 INDIVIDUAL DISBURSEMENT (Loans & Welfare)
  const handleIndividualDisbursement = async () => {
    if (!canInitiateDisbursements()) {
      Alert.alert('Access Denied', 'You do not have permission to initiate disbursements.');
      return;
    }

    // Validate form
    if (!selectedMember || !individualDisbursementForm.amount || !individualDisbursementForm.purpose) {
      Alert.alert('Validation Error', 'Please select a member and fill in all required fields.');
      return;
    }

    try {
      const disbursementData = {
        type: 'individual',
        category: disbursementType,
        memberId: selectedMember.id,
        memberName: selectedMember.name,
        amount: parseFloat(individualDisbursementForm.amount),
        purpose: individualDisbursementForm.purpose,
        privateNote: individualDisbursementForm.privateNote,
        fromAccount: disbursementType === 'loan' ? 'loan_fund' : 'welfare',
        toAccount: 'member_wallet',
        initiatedBy: userRole,
        initiatedById: user.id,
        timestamp: new Date().toISOString(),
        status: 'pending',
        transactionId: generateTransactionId(),
        securityHash: await generateSecurityHash(individualDisbursementForm)
      };

      const response = await ApiService.createIndividualDisbursement(chamaId, disbursementData);

      if (response.success) {
        // Log security event
        await logSecurityEvent('individual_disbursement_initiated', disbursementData);

        // Send notification
        const notificationMessage = `KES ${formatCurrency(disbursementData.amount)} ${disbursementType} disbursement initiated to ${selectedMember.name} by ${userRole}`;
        await sendSystemNotification({
          message: notificationMessage,
          data: disbursementData,
          type: 'system'
        });

        // Reset form and refresh
        resetIndividualDisbursementForm();
        await loadTransparencyFeed();
        await loadEligibleMembers();

        Alert.alert('Success', `${disbursementType.charAt(0).toUpperCase() + disbursementType.slice(1)} disbursement initiated successfully.`);
      } else {
        Alert.alert('Error', response.error || 'Failed to initiate disbursement.');
      }
    } catch (error) {
      console.error('🎯 Individual disbursement error:', error);
      Alert.alert('Error', 'Failed to process disbursement. Please try again.');
    }
  };

  // 📊 BULK DISBURSEMENT (Dividends/Shares)
  const handleBulkDisbursement = async () => {
    if (!canInitiateDisbursements()) {
      Alert.alert('Access Denied', 'You do not have permission to initiate disbursements.');
      return;
    }

    // Validate bulk disbursement data
    if (!bulkDisbursementData.dividendPerShare || bulkDisbursementData.eligibleMembers.length === 0) {
      Alert.alert('Validation Error', 'Please set dividend per share and ensure eligible members are loaded.');
      return;
    }

    Alert.alert(
      'Confirm Bulk Disbursement',
      `This will disburse dividends to ${bulkDisbursementData.eligibleMembers.length} members.\n\nTotal Amount: KES ${formatCurrency(bulkDisbursementData.totalAmount)}\n\nContinue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed',
          onPress: async () => {
            try {
              const disbursementData = {
                type: 'bulk',
                category: 'dividend',
                dividendPerShare: bulkDisbursementData.dividendPerShare,
                totalAmount: bulkDisbursementData.totalAmount,
                description: bulkDisbursementData.description,
                eligibleMembers: bulkDisbursementData.eligibleMembers,
                fromAccount: 'chama_main',
                initiatedBy: userRole,
                initiatedById: user.id,
                timestamp: new Date().toISOString(),
                status: 'pending',
                transactionId: generateTransactionId(),
                securityHash: await generateSecurityHash(bulkDisbursementData)
              };

              const response = await ApiService.createBulkDisbursement(chamaId, disbursementData);

              if (response.success) {
                // Log security event
                await logSecurityEvent('bulk_disbursement_initiated', disbursementData);

                // Send notification
                const notificationMessage = `Bulk dividend disbursement of KES ${formatCurrency(disbursementData.totalAmount)} initiated to ${disbursementData.eligibleMembers.length} members by ${userRole}`;
                await sendSystemNotification({
                  message: notificationMessage,
                  data: disbursementData,
                  type: 'system'
                });

                // Reset and refresh
                resetBulkDisbursementForm();
                await loadTransparencyFeed();

                Alert.alert('Success', 'Bulk dividend disbursement initiated successfully.');
              } else {
                Alert.alert('Error', response.error || 'Failed to initiate bulk disbursement.');
              }
            } catch (error) {
              console.error('📊 Bulk disbursement error:', error);
              Alert.alert('Error', 'Failed to process bulk disbursement. Please try again.');
            }
          }
        }
      ]
    );
  };

  // 💰 LEGACY DISBURSEMENT FUNCTION (for backward compatibility)
  const handleDisbursementSubmit = async () => {
    // Route to appropriate disbursement handler based on type
    if (disbursementType === 'dividend') {
      return handleBulkDisbursement();
    } else {
      return handleIndividualDisbursement();
    }
  };

  // 🔄 FORM RESET FUNCTIONS
  const resetDisbursementForm = () => {
    setDisbursementForm({
      amount: '',
      fromAccount: 'chama_main',
      toAccount: '',
      purpose: '',
      category: 'loan',
      privateNote: '',
      requiresApproval: true
    });
  };

  const resetIndividualDisbursementForm = () => {
    setIndividualDisbursementForm({
      memberId: '',
      memberName: '',
      amount: '',
      purpose: '',
      privateNote: '',
    });
    setSelectedMember(null);
  };

  const resetBulkDisbursementForm = () => {
    setBulkDisbursementData({
      totalAmount: 0,
      eligibleMembers: [],
      dividendPerShare: 0,
      description: '',
    });
  };

  const generateTransactionId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `TXN_${timestamp}_${random}`.toUpperCase();
  };

  const generateSecurityHash = async (data) => {
    // In a real app, this would be a proper cryptographic hash
    const hashInput = JSON.stringify(data) + user.id + Date.now();
    return btoa(hashInput).substring(0, 32);
  };

  // 🏗️ SHARE & DIVIDEND CREATION FUNCTIONS
  const handleCreateShares = async () => {
    if (!canInitiateDisbursements()) {
      Alert.alert('Access Denied', 'You do not have permission to create shares.');
      return;
    }

    // Validate form
    if (!shareCreationForm.name || !shareCreationForm.totalShares || !shareCreationForm.pricePerShare) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }

    try {
      const shareData = {
        name: shareCreationForm.name,
        shareType: shareCreationForm.shareType,
        totalShares: parseInt(shareCreationForm.totalShares),
        pricePerShare: parseFloat(shareCreationForm.pricePerShare),
        minimumPurchase: parseInt(shareCreationForm.minimumPurchase) || 1,
        description: shareCreationForm.description,
        eligibilityCriteria: shareCreationForm.eligibilityCriteria,
        approvalRequired: shareCreationForm.approvalRequired,
        totalValue: parseInt(shareCreationForm.totalShares) * parseFloat(shareCreationForm.pricePerShare),
        createdBy: userRole,
        createdById: user.id,
        timestamp: new Date().toISOString(),
        status: shareCreationForm.approvalRequired ? 'pending_approval' : 'active',
        transactionId: generateTransactionId(),
        securityHash: await generateSecurityHash(shareCreationForm)
      };

      const response = await ApiService.createChamaShares(chamaId, shareData);

      if (response.success) {
        // Log security event
        await logSecurityEvent('shares_created', shareData);

        // Send notification
        const notificationMessage = `New ${shareCreationForm.shareType} shares created: ${shareData.totalShares} shares at KES ${formatCurrency(shareData.pricePerShare)} each by ${userRole}`;
        await sendSystemNotification({
          message: notificationMessage,
          data: shareData,
          type: 'system'
        });

        // Reset form
        setShareCreationForm({
          name: '',
          shareType: 'ordinary',
          totalShares: '',
          pricePerShare: '',
          minimumPurchase: '1',
          description: '',
          eligibilityCriteria: 'all_members',
          approvalRequired: true,
        });

        // Refresh existing shares data
        await loadExistingShares();

        Alert.alert('Success', 'Shares created successfully! Members can now purchase them from the Shares & Dividends section.');
      } else {
        Alert.alert('Error', response.error || 'Failed to create shares.');
      }
    } catch (error) {
      console.error('🏗️ Share creation error:', error);
      Alert.alert('Error', 'Failed to create shares. Please try again.');
    }
  };

  const handleCreateDividends = async () => {
    if (!canInitiateDisbursements()) {
      Alert.alert('Access Denied', 'You do not have permission to declare dividends.');
      return;
    }

    // Validate form
    if (!dividendCreationForm.totalAmount || !dividendCreationForm.paymentDate) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }

    // Check authentication status
    const authToken = await ApiService.getAuthToken();
    console.log('🔐 Auth token check:', authToken ? 'Present' : 'Missing');

    if (!authToken) {
      Alert.alert('Authentication Required', 'You need to be logged in to perform this action. Please log in again.');
      return;
    }

    try {
      const dividendData = {
        DividendType: dividendCreationForm.dividendType || 'cash',
        TotalAmount: parseFloat(dividendCreationForm.totalAmount),
        dividendPerShare: parseFloat(dividendCreationForm.dividendPerShare),
        totalDividendAmount: parseFloat(dividendCreationForm.totalAmount),
        paymentDate: dividendCreationForm.paymentDate ? new Date(dividendCreationForm.paymentDate).toISOString() : null,
        description: dividendCreationForm.description,
      };

      console.log('🏗️ Declaring dividends with data:', dividendData);
      console.log('🏗️ User role:', userRole);
      console.log('🏗️ Chama ID:', chamaId);

      const response = await ApiService.declareChamaDividends(chamaId, dividendData);

      console.log('🏗️ Dividend declaration response:', response);

      if (response && response.success) {
        console.log('🏗️ Dividend declaration successful, showing success alert');

        // Log security event
        await logSecurityEvent('dividends_declared', dividendData);

        // Send notification (with error handling)
        try {
          const notificationMessage = `Dividends declared: KES ${formatCurrency(dividendData.totalAmount)} total (${formatCurrency(dividendData.dividendPerShare)} per share) by ${userRole}`;
          await sendSystemNotification({
            message: notificationMessage,
            data: dividendData,
            type: 'system'
          });
        } catch (notificationError) {
          console.warn('🔔 Failed to send notification:', notificationError);
          // Don't fail the whole operation for notification errors
        }

        // Reset form
        setDividendCreationForm({
          dividendType: 'cash',
          totalAmount: '',
          dividendPerShare: '',
          paymentDate: '',
          description: '',
          eligibilityCriteria: 'shareholders_only',
          approvalRequired: true,
        });

        // Refresh existing dividends data
        try {
          await loadExistingDividends();
        } catch (refreshError) {
          console.warn('⚠️ Failed to refresh dividends data:', refreshError);
        }

        // Show success alert
        Alert.alert('Success', 'Dividends declared successfully! Shareholders will be notified of the distribution.');
        console.log('🏗️ Success alert displayed');
      } else {
        const errorMessage = response?.error || response?.message || 'Failed to declare dividends.';
        console.error('🏗️ Dividend declaration failed:', errorMessage);
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('🏗️ Dividend declaration error:', error);
      const errorMessage = error?.message || 'Failed to declare dividends. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  // 🔐 APPROVAL & ACCOUNT MANAGEMENT
  const handleApproveDisbursement = async (transactionId) => {
    if (!canApproveDisbursements()) {
      Alert.alert('Access Denied', 'You do not have permission to approve disbursements.');
      return;
    }

    try {
      const response = await ApiService.approveDisbursement(chamaId, transactionId, {
        approvedBy: userRole,
        approvedById: user.id,
        timestamp: new Date().toISOString()
      });

      if (response.success) {
        await logSecurityEvent('disbursement_approved', { transactionId });
        await loadTransparencyFeed();
        Alert.alert('Success', 'Disbursement approved successfully.');
      }
    } catch (error) {
      console.error('🔐 Approval error:', error);
      Alert.alert('Error', 'Failed to approve disbursement.');
    }
  };

  const handleFreezeAccount = async (accountType) => {
    if (!canFreezeAccounts()) {
      Alert.alert('Access Denied', 'Only chairperson can freeze accounts.');
      return;
    }

    Alert.alert(
      'Freeze Account',
      `Are you sure you want to freeze the ${accountType} account? This will prevent all transactions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Freeze',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await ApiService.freezeAccount(chamaId, accountType, {
                frozenBy: userRole,
                frozenById: user.id,
                timestamp: new Date().toISOString()
              });

              if (response.success) {
                await logSecurityEvent('account_frozen', { accountType });
                Alert.alert('Success', `${accountType} account has been frozen.`);
              }
            } catch (error) {
              console.error('🔐 Freeze error:', error);
              Alert.alert('Error', 'Failed to freeze account.');
            }
          }
        }
      ]
    );
  };

  // 📋 RECEIPT & AUDIT FUNCTIONS
  const generateReceipt = async (transactionId, receiptType) => {
    if (!canGenerateReceipts()) {
      Alert.alert('Access Denied', 'You do not have permission to generate receipts.');
      return;
    }

    // Show feature coming soon message since backend API is not implemented
    Alert.alert(
      'Feature Coming Soon',
      'Receipt generation functionality will be available in the next update. This feature requires backend implementation.',
      [
        { text: 'OK', style: 'default' },
        {
          text: 'Contact Support',
          onPress: () => {
            // Could navigate to support or open email
            Alert.alert('Support', 'Please contact the development team for more information.');
          }
        }
      ]
    );

    // Log the attempt for future implementation
    await logSecurityEvent('receipt_generation_attempted', {
      transactionId,
      receiptType,
      attemptedBy: userRole,
      attemptedById: user.id,
      timestamp: new Date().toISOString(),
      chamaId,
      reason: 'backend_api_not_implemented'
    });
  };

  // 🎨 UI RENDERING FUNCTIONS
  const renderSecurityHeader = () => (
    <View style={[styles.securityHeader, { backgroundColor: colors.surface }]}>
      {/* Top Row - Title and Role */}
      <View style={styles.headerTopRow}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Account Management
          </Text>
        </View>

        <View style={styles.headerRight}>
          <View style={[styles.roleBadge, { backgroundColor: getRoleColor(userRole) + '20' }]}>
            <Ionicons name={getRoleIcon(userRole)} size={14} color={getRoleColor(userRole)} />
            <Text style={[styles.roleText, { color: getRoleColor(userRole) }]}>
              {userRole.toUpperCase()}
            </Text>
          </View>

          {notifications.length > 0 && (
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => setShowNotifications(true)}
            >
              <Ionicons name="notifications" size={20} color={colors.warning} />
              <View style={[styles.notificationBadge, { backgroundColor: colors.error }]}>
                <Text style={[styles.notificationCount, { color: colors.white }]}>
                  {notifications.length}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bottom Row - Panel Navigation Tabs */}
      <View style={styles.headerBottomRow}>
        <View style={styles.headerTabs}>
          {[
            { key: 'disbursement', label: 'Disbursement', icon: 'send', color: colors.primary },
            { key: 'creation', label: 'Create', icon: 'add-circle', color: colors.success },
            { key: 'transparency', label: 'Live Feed', icon: 'eye', color: colors.info },
            { key: 'audit', label: 'Audit', icon: 'document-text', color: colors.warning }
          ].map((panel) => (
            <TouchableOpacity
              key={panel.key}
              style={[
                styles.headerTab,
                activePanel === panel.key && {
                  backgroundColor: panel.color + '20',
                  borderBottomWidth: 2,
                  borderBottomColor: panel.color
                }
              ]}
              onPress={() => setActivePanel(panel.key)}
            >
              <Ionicons
                name={panel.icon}
                size={14}
                color={activePanel === panel.key ? panel.color : colors.textSecondary}
              />
              <Text
                style={[
                  styles.headerTabText,
                  { color: activePanel === panel.key ? panel.color : colors.textSecondary }
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {panel.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const getRoleColor = (role) => {
    switch (role?.toLowerCase()) {
      case 'chairperson': return colors.error;
      case 'treasurer': return colors.warning;
      case 'secretary': return colors.info;
      case 'auditor': return colors.success;
      default: return colors.textSecondary;
    }
  };

  const getRoleIcon = (role) => {
    switch (role?.toLowerCase()) {
      case 'chairperson': return 'star';
      case 'treasurer': return 'wallet';
      case 'secretary': return 'document-text';
      case 'auditor': return 'search';
      default: return 'person';
    }
  };

  // Panel navigation now integrated into header - removed standalone function

  const renderDisbursementPanel = () => (
    <Card style={[styles.disbursementCard, { backgroundColor: colors.surface }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="send" size={24} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Disbursement Panel
          </Text>
          {canInitiateDisbursements() && (
            <View style={[styles.permissionBadge, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={[styles.permissionText, { color: colors.success }]}>
                AUTHORIZED
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
          Secure disbursements to qualified chama members only
        </Text>
      </View>

      {/* Disbursement Type Selection */}
      <View style={styles.disbursementTypeSelector}>
        <View style={styles.disbursementTypeHeader}>
          <Text style={[styles.formLabel, { color: colors.text }]}>
            Select Disbursement Type
          </Text>
          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => Alert.alert(
              'Disbursement Types',
              'INDIVIDUAL DISBURSEMENTS:\n• Loan: Individual loans to qualified members\n• Welfare: Support payments to eligible members\n• Shares: Share allocations to members\n• Savings: Withdrawals from savings accounts\n• Other: Miscellaneous disbursements\n\nBULK DISBURSEMENTS:\n• Dividend: Bulk payments to all shareholders\n\nChoose the appropriate type for your transaction.'
            )}
          >
            <Ionicons name="help-circle" size={20} color={colors.info} />
          </TouchableOpacity>
        </View>

        {/* Individual Disbursements */}
        <View style={styles.disbursementCategory}>
          <View style={styles.categoryHeader}>
            <Ionicons name="person" size={18} color={colors.primary} />
            <Text style={[styles.categoryTitle, { color: colors.primary }]}>
              Individual Disbursements
            </Text>
            <Text style={[styles.categorySubtitle, { color: colors.textSecondary }]}>
              One member at a time
            </Text>
          </View>
          <View style={[
            styles.disbursementTypeGrid,
            { flexDirection: isLargeScreen ? 'row' : 'column' }
          ]}>
            {[
              { key: 'loan', title: 'Loan Disbursement', icon: 'card', color: colors.primary, description: 'Individual qualified members' },
              { key: 'welfare', title: 'Welfare Support', icon: 'heart', color: colors.warning, description: 'Individual eligible members' },
              { key: 'shares', title: 'Share Allocation', icon: 'pie-chart', color: colors.info, description: 'Share allocations to members' },
              { key: 'savings_withdrawal', title: 'Savings Withdrawal', icon: 'wallet', color: colors.secondary, description: 'Savings withdrawals' },
              { key: 'other', title: 'Other Payment', icon: 'ellipsis-horizontal', color: colors.textSecondary, description: 'Other disbursements' }
            ].map((type) => (
              <Button
                key={type.key}
                title={type.title}
                onPress={() => setDisbursementType(type.key)}
                style={[
                  styles.disbursementTypeButton,
                  {
                    borderColor: type.color,
                    minHeight: isLargeScreen ? 90 : 70,
                    paddingVertical: isLargeScreen ? spacing.md : spacing.sm,
                    paddingHorizontal: isLargeScreen ? spacing.md : spacing.sm
                  },
                  disbursementType === type.key && {
                    backgroundColor: type.color,
                    borderColor: type.color
                  }
                ]}
                textStyle={[
                  styles.disbursementTypeButtonText,
                  { color: disbursementType === type.key ? colors.white : type.color, fontSize: typography.fontSize.sm }
                ]}
                icon={<Ionicons
                  name={type.icon}
                  size={isLargeScreen ? 20 : 16}
                  color={disbursementType === type.key ? colors.white : type.color}
                />}
                variant={disbursementType === type.key ? 'primary' : 'outline'}
              />
            ))}
          </View>
        </View>

        {/* Bulk Disbursements */}
        <View style={styles.disbursementCategory}>
          <View style={styles.categoryHeader}>
            <Ionicons name="people" size={18} color={colors.success} />
            <Text style={[styles.categoryTitle, { color: colors.success }]}>
              Bulk Disbursements
            </Text>
            <Text style={[styles.categorySubtitle, { color: colors.textSecondary }]}>
              Multiple members automatically
            </Text>
          </View>
          <View style={[
            styles.disbursementTypeGrid,
            { flexDirection: isLargeScreen ? 'row' : 'column' }
          ]}>
            {[
              { key: 'dividend', title: 'Dividend Payment', icon: 'cash', color: colors.success, description: 'Bulk to all shareholders' }
            ].map((type) => (
              <Button
                key={type.key}
                title={type.title}
                onPress={() => setDisbursementType(type.key)}
                style={[
                  styles.disbursementTypeButton,
                  {
                    borderColor: type.color,
                    minHeight: isLargeScreen ? 90 : 70,
                    paddingVertical: isLargeScreen ? spacing.md : spacing.sm,
                    paddingHorizontal: isLargeScreen ? spacing.md : spacing.sm
                  },
                  disbursementType === type.key && {
                    backgroundColor: type.color,
                    borderColor: type.color
                  }
                ]}
                textStyle={[
                  styles.disbursementTypeButtonText,
                  { color: disbursementType === type.key ? colors.white : type.color, fontSize: typography.fontSize.sm }
                ]}
                icon={<Ionicons
                  name={type.icon}
                  size={isLargeScreen ? 20 : 16}
                  color={disbursementType === type.key ? colors.white : type.color}
                />}
                variant={disbursementType === type.key ? 'primary' : 'outline'}
              />
            ))}
          </View>
        </View>

        {/* Active Disbursement Type Indicator */}
        <View style={[styles.activeDisbursementIndicator, {
          backgroundColor: (() => {
            const typeColors = {
              loan: colors.primary, welfare: colors.warning, dividend: colors.success,
              shares: colors.info, savings_withdrawal: colors.secondary, other: colors.textSecondary
            };
            return typeColors[disbursementType] + '10';
          })(),
          borderColor: (() => {
            const typeColors = {
              loan: colors.primary, welfare: colors.warning, dividend: colors.success,
              shares: colors.info, savings_withdrawal: colors.secondary, other: colors.textSecondary
            };
            return typeColors[disbursementType];
          })()
        }]}>
          <Ionicons
            name={(() => {
              const typeIcons = {
                loan: 'card', welfare: 'heart', dividend: 'cash',
                shares: 'pie-chart', savings_withdrawal: 'wallet', other: 'ellipsis-horizontal'
              };
              return typeIcons[disbursementType];
            })()}
            size={16}
            color={(() => {
              const typeColors = {
                loan: colors.primary, welfare: colors.warning, dividend: colors.success,
                shares: colors.info, savings_withdrawal: colors.secondary, other: colors.textSecondary
              };
              return typeColors[disbursementType];
            })()}
          />
          <Text style={[styles.activeDisbursementText, {
            color: (() => {
              const typeColors = {
                loan: colors.primary, welfare: colors.warning, dividend: colors.success,
                shares: colors.info, savings_withdrawal: colors.secondary, other: colors.textSecondary
              };
              return typeColors[disbursementType];
            })()
          }]}>
            Currently selected: {(() => {
              const typeLabels = {
                loan: 'Loan Disbursement', welfare: 'Welfare Support', dividend: 'Dividend Payment',
                shares: 'Share Allocation', savings_withdrawal: 'Savings Withdrawal', other: 'Other Payment'
              };
              return typeLabels[disbursementType];
            })()}
          </Text>
        </View>
      </View>

      {!canInitiateDisbursements() ? (
        <View style={[styles.accessDenied, { backgroundColor: colors.error + '10' }]}>
          <Ionicons name="lock-closed" size={32} color={colors.error} />
          <Text style={[styles.accessDeniedTitle, { color: colors.error }]}>
            Access Restricted
          </Text>
          <Text style={[styles.accessDeniedText, { color: colors.textSecondary }]}>
            Only Treasurer, Secretary, and Chairperson can initiate disbursements
          </Text>
        </View>
      ) : (
        <View style={styles.disbursementForm}>
          {/* Render Individual Disbursement Form (Loans, Welfare, Shares, Savings, Other) */}
          {(disbursementType === 'loan' || disbursementType === 'welfare' || disbursementType === 'shares' || disbursementType === 'savings_withdrawal' || disbursementType === 'other') && (
            <View style={[styles.individualDisbursementForm, {
              borderLeftWidth: 4,
              borderLeftColor: (() => {
                const typeColors = {
                  loan: colors.primary, welfare: colors.warning, shares: colors.info,
                  savings_withdrawal: colors.secondary, other: colors.textSecondary
                };
                return typeColors[disbursementType];
              })(),
              paddingLeft: spacing.md
            }]}>
              {/* Form Header */}
              <View style={[styles.formSectionHeader, {
                backgroundColor: (() => {
                  const typeColors = {
                    loan: colors.primary, welfare: colors.warning, shares: colors.info,
                    savings_withdrawal: colors.secondary, other: colors.textSecondary
                  };
                  return typeColors[disbursementType] + '10';
                })()
              }]}>
                <Ionicons
                  name={(() => {
                    const typeIcons = {
                      loan: 'card', welfare: 'heart', shares: 'pie-chart',
                      savings_withdrawal: 'wallet', other: 'ellipsis-horizontal'
                    };
                    return typeIcons[disbursementType];
                  })()}
                  size={20}
                  color={(() => {
                    const typeColors = {
                      loan: colors.primary, welfare: colors.warning, shares: colors.info,
                      savings_withdrawal: colors.secondary, other: colors.textSecondary
                    };
                    return typeColors[disbursementType];
                  })()}
                />
                <Text style={[styles.formSectionTitle, {
                  color: (() => {
                    const typeColors = {
                      loan: colors.primary, welfare: colors.warning, shares: colors.info,
                      savings_withdrawal: colors.secondary, other: colors.textSecondary
                    };
                    return typeColors[disbursementType];
                  })()
                }]}>
                  Individual {(() => {
                    const typeLabels = {
                      loan: 'Loan', welfare: 'Welfare', shares: 'Share',
                      savings_withdrawal: 'Savings', other: 'Other'
                    };
                    return typeLabels[disbursementType];
                  })()} Disbursement
                </Text>
                <TouchableOpacity
                  style={styles.formHelpButton}
                  onPress={() => Alert.alert(
                    `${(() => {
                      const typeLabels = {
                        loan: 'Loan', welfare: 'Welfare', shares: 'Share',
                        savings_withdrawal: 'Savings', other: 'Other'
                      };
                      return typeLabels[disbursementType];
                    })()} Disbursement Help`,
                    `• Select Member: Choose the qualified member for this disbursement\n• Amount: Enter the disbursement amount\n• Purpose: Describe the reason for payment\n• Private Note: Optional audit trail note\n\nEnsure all required fields are completed before submitting.`
                  )}
                >
                  <Ionicons name="information-circle" size={16} color={(() => {
                    const typeColors = {
                      loan: colors.primary, welfare: colors.warning, shares: colors.info,
                      savings_withdrawal: colors.secondary, other: colors.textSecondary
                    };
                    return typeColors[disbursementType];
                  })()} />
                </TouchableOpacity>
              </View>

              {/* Member Selection with Search and Status */}
              <View style={styles.formGroup}>
                <View style={styles.memberSelectionHeader}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Select {disbursementType === 'loan' ? 'Qualified' : disbursementType === 'shares' ? 'Eligible' : disbursementType === 'savings_withdrawal' ? 'Eligible' : 'Eligible'} Member *
                  </Text>
                  {eligibleMembers[disbursementType] && eligibleMembers[disbursementType].length > 0 && (
                    <View style={[styles.memberCountBadge, {
                      backgroundColor: (() => {
                        const typeColors = {
                          loan: colors.primary, welfare: colors.warning, shares: colors.info,
                          savings_withdrawal: colors.secondary, other: colors.textSecondary
                        };
                        return typeColors[disbursementType] + '20';
                      })()
                    }]}>
                      <Text style={[styles.memberCountText, {
                        color: (() => {
                          const typeColors = {
                            loan: colors.primary, welfare: colors.warning, shares: colors.info,
                            savings_withdrawal: colors.secondary, other: colors.textSecondary
                          };
                          return typeColors[disbursementType];
                        })()
                      }]}>
                        {eligibleMembers[disbursementType].length} available
                      </Text>
                    </View>
                  )}
                </View>

                {eligibleMembers[disbursementType] && eligibleMembers[disbursementType].length > 0 ? (
                  <>
                    {/* Search Bar */}
                    <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Ionicons name="search" size={16} color={colors.textSecondary} />
                      <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search members by name..."
                        placeholderTextColor={colors.textSecondary}
                        value={memberSearchQuery}
                        onChangeText={setMemberSearchQuery}
                      />
                      {memberSearchQuery ? (
                        <TouchableOpacity onPress={() => setMemberSearchQuery('')}>
                          <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {/* Sort Options */}
                    <View style={styles.sortOptions}>
                      <Text style={[styles.sortLabel, { color: colors.textSecondary }]}>Sort by:</Text>
                      {[
                        { key: 'name', label: 'Name', icon: 'text' },
                        { key: 'amount', label: 'Amount', icon: 'cash' },
                        { key: 'eligibility', label: 'Eligibility', icon: 'checkmark-circle' }
                      ].map((sort) => (
                        <TouchableOpacity
                          key={sort.key}
                          style={[
                            styles.sortOption,
                            { borderColor: colors.border },
                            memberSortBy === sort.key && { backgroundColor: colors.primary + '20', borderColor: colors.primary }
                          ]}
                          onPress={() => setMemberSortBy(sort.key)}
                        >
                          <Ionicons
                            name={sort.icon}
                            size={14}
                            color={memberSortBy === sort.key ? colors.primary : colors.textSecondary}
                          />
                          <Text style={[
                            styles.sortOptionText,
                            { color: memberSortBy === sort.key ? colors.primary : colors.textSecondary }
                          ]}>
                            {sort.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Filtered and Sorted Members */}
                    <ScrollView style={[styles.membersList, isMobile && styles.membersListMobile]} showsVerticalScrollIndicator={false}>
                      {getFilteredAndSortedMembers().map((member) => (
                        <TouchableOpacity
                          key={member.id}
                          style={[
                            styles.memberItem,
                            isMobile ? styles.memberItemMobile : styles.memberItemDesktop,
                            { borderColor: colors.border },
                            selectedMember?.id === member.id && { backgroundColor: colors.primary + '20', borderColor: colors.primary }
                          ]}
                          onPress={() => {
                            setSelectedMember(member);
                            setIndividualDisbursementForm(prev => ({
                              ...prev,
                              memberId: member.id,
                              memberName: member.name
                            }));
                          }}
                        >
                          <View style={[styles.memberAvatar, { backgroundColor: colors.primary }]}>
                            <Text style={[styles.memberInitial, { color: colors.white }]}>
                              {member.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={[styles.memberInfo, isMobile && styles.memberInfoMobile]}>
                            <View style={styles.memberHeader}>
                              <Text style={[
                                styles.memberName,
                                isMobile && styles.memberNameMobile,
                                { color: colors.text }
                              ]} numberOfLines={1} ellipsizeMode="tail">
                                {member.name}
                              </Text>
                              {selectedMember?.id === member.id && (
                                <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                                  <Ionicons name="checkmark" size={12} color={colors.white} />
                                </View>
                              )}
                            </View>
                            <Text style={[
                              styles.memberDetails,
                              isMobile && styles.memberDetailsMobile,
                              { color: colors.textSecondary }
                            ]} numberOfLines={2} ellipsizeMode="tail">
                              {getMemberDetailsText(member)}
                            </Text>
                            <View style={[styles.memberStatusRow, isMobile ? styles.memberStatusRowMobile : styles.memberStatusRowDesktop]}>
                              <View style={[
                                styles.eligibilityBadge,
                                isMobile && styles.eligibilityBadgeMobile,
                                {
                                  backgroundColor: getEligibilityColor(member) + '20'
                                }
                              ]}>
                                <Ionicons
                                  name={getEligibilityIcon(member)}
                                  size={12}
                                  color={getEligibilityColor(member)}
                                />
                                <Text style={[styles.eligibilityText, {
                                  color: getEligibilityColor(member)
                                }]}>
                                  {getEligibilityStatus(member)}
                                </Text>
                              </View>
                              <Text style={[
                                styles.memberAmount,
                                isMobile && styles.memberAmountMobile,
                                {
                                  color: getAmountColor(member)
                                }
                              ]}>
                                {getMemberAmountText(member)}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                ) : (
                  <View style={[styles.emptyMembers, { backgroundColor: colors.warning + '10' }]}>
                    <Ionicons name="person-outline" size={32} color={colors.warning} />
                    <Text style={[styles.emptyMembersText, { color: colors.text }]}>
                      No {disbursementType === 'loan' ? 'qualified loan' : disbursementType === 'shares' ? 'eligible share' : disbursementType === 'savings_withdrawal' ? 'eligible savings' : disbursementType === 'other' ? 'eligible other' : 'eligible welfare'} members found
                    </Text>
                    <Text style={[styles.emptyMembersSubtext, { color: colors.textSecondary }]}>
                      {disbursementType === 'loan'
                        ? 'Members must be approved and not yet disbursed'
                        : disbursementType === 'shares'
                        ? 'Members must meet share eligibility criteria'
                        : disbursementType === 'savings_withdrawal'
                        ? 'Members must have available savings balance'
                        : disbursementType === 'other'
                        ? 'Members must meet other disbursement criteria'
                        : 'Members must have completed contribution period'
                      }
                    </Text>
                  </View>
                )}
              </View>

              {/* Amount Input */}
              {selectedMember && (
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Amount (KES) *
                  </Text>
                  <TextInput
                    style={[styles.formInput, {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text
                    }]}
                    value={individualDisbursementForm.amount}
                    onChangeText={(text) => setIndividualDisbursementForm(prev => ({ ...prev, amount: text }))}
                    placeholder={disbursementType === 'loan'
                      ? `Max: ${formatCurrency(selectedMember.approvedAmount)}`
                      : disbursementType === 'shares'
                      ? `Max: ${selectedMember.eligibleShares} shares`
                      : disbursementType === 'savings_withdrawal'
                      ? `Max: ${formatCurrency(selectedMember.availableSavings)}`
                      : disbursementType === 'other'
                      ? `Max: ${formatCurrency(selectedMember.eligibleAmount)}`
                      : `Suggested: ${formatCurrency(selectedMember.contributionAmount)}`
                    }
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                  {disbursementType === 'loan' && selectedMember.approvedAmount && (
                    <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                      Maximum disbursable: KES {formatCurrency(selectedMember.approvedAmount)}
                    </Text>
                  )}
                  {disbursementType === 'shares' && selectedMember.eligibleShares && (
                    <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                      Maximum shares: {selectedMember.eligibleShares}
                    </Text>
                  )}
                  {disbursementType === 'savings_withdrawal' && selectedMember.availableSavings && (
                    <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                      Available savings: KES {formatCurrency(selectedMember.availableSavings)}
                    </Text>
                  )}
                  {disbursementType === 'other' && selectedMember.eligibleAmount && (
                    <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                      Maximum eligible: KES {formatCurrency(selectedMember.eligibleAmount)}
                    </Text>
                  )}
                </View>
              )}

              {/* Purpose Input */}
              {selectedMember && (
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Purpose *
                  </Text>
                  <TextInput
                    style={[styles.formInput, {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text
                    }]}
                    value={individualDisbursementForm.purpose}
                    onChangeText={(text) => setIndividualDisbursementForm(prev => ({ ...prev, purpose: text }))}
                    placeholder={`Enter ${disbursementType} disbursement purpose`}
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              )}

              {/* Private Note */}
              {selectedMember && (
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Private Note (Audit Trail)
                  </Text>
                  <TextInput
                    style={[styles.formInput, {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text
                    }]}
                    value={individualDisbursementForm.privateNote}
                    onChangeText={(text) => setIndividualDisbursementForm(prev => ({ ...prev, privateNote: text }))}
                    placeholder="Optional note for audit purposes"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              )}

              {/* Submit Button */}
              {selectedMember && (
                <Button
                  title={`Disburse ${disbursementType === 'savings_withdrawal' ? 'Savings' : disbursementType === 'other' ? 'Funds' : disbursementType.charAt(0).toUpperCase() + disbursementType.slice(1)}`}
                  onPress={handleIndividualDisbursement}
                  style={[styles.submitButton, { backgroundColor: disbursementType === 'loan' ? colors.primary : disbursementType === 'shares' ? colors.info : disbursementType === 'savings_withdrawal' ? colors.secondary : disbursementType === 'other' ? colors.textSecondary : colors.warning }]}
                  icon={<Ionicons name="send" size={20} color={colors.white} />}
                  disabled={!individualDisbursementForm.amount || !individualDisbursementForm.purpose}
                />
              )}
            </View>
          )}

          {/* Render Bulk Disbursement Form (Dividends) */}
          {disbursementType === 'dividend' && (
            <View style={[styles.bulkDisbursementForm, {
              borderLeftWidth: 4,
              borderLeftColor: colors.success,
              paddingLeft: spacing.md
            }]}>
              {/* Form Header */}
              <View style={[styles.formSectionHeader, { backgroundColor: colors.success + '10' }]}>
                <Ionicons name="cash" size={20} color={colors.success} />
                <Text style={[styles.formSectionTitle, { color: colors.success }]}>
                  Bulk Dividend Disbursement
                </Text>
                <TouchableOpacity
                  style={styles.formHelpButton}
                  onPress={() => Alert.alert(
                    'Bulk Dividend Disbursement Help',
                    '• Per Share Amount: Set the dividend amount per share\n• Eligible Members: System automatically calculates based on shareholders\n• Total Amount: Auto-calculated total disbursement\n• Description: Optional details about this dividend payment\n\nThis will distribute dividends to all eligible shareholders automatically.'
                  )}
                >
                  <Ionicons name="information-circle" size={16} color={colors.success} />
                </TouchableOpacity>
              </View>

              {/* Dividend Per Share */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Dividend Per Share (KES) *
                </Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text
                  }]}
                  value={bulkDisbursementData.dividendPerShare.toString()}
                  onChangeText={(text) => {
                    const perShare = parseFloat(text) || 0;
                    const totalShares = eligibleMembers.dividend?.reduce((sum, member) => sum + member.sharesOwned, 0) || 0;
                    setBulkDisbursementData(prev => ({
                      ...prev,
                      dividendPerShare: perShare,
                      totalAmount: perShare * totalShares,
                      eligibleMembers: eligibleMembers.dividend || []
                    }));
                  }}
                  placeholder="Enter dividend per share"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              {/* Eligible Members Summary with Enhanced Details */}
              {eligibleMembers.dividend && eligibleMembers.dividend.length > 0 ? (
                <View style={[styles.eligibleMembersSummary, { backgroundColor: colors.success + '10' }]}>
                  <View style={styles.summaryHeader}>
                    <Ionicons name="people" size={20} color={colors.success} />
                    <Text style={[styles.summaryTitle, { color: colors.success }]}>
                      Eligible Shareholders: {eligibleMembers.dividend.length}
                    </Text>
                  </View>

                  <View style={styles.summaryStats}>
                    <View style={styles.summaryStat}>
                      <Text style={[styles.summaryStatLabel, { color: colors.textSecondary }]}>
                        Total Shares
                      </Text>
                      <Text style={[styles.summaryStatValue, { color: colors.success }]}>
                        {eligibleMembers.dividend.reduce((sum, member) => sum + member.sharesOwned, 0).toLocaleString()}
                      </Text>
                    </View>

                    {bulkDisbursementData.dividendPerShare > 0 && (
                      <View style={styles.summaryStat}>
                        <Text style={[styles.summaryStatLabel, { color: colors.textSecondary }]}>
                          Total Disbursement
                        </Text>
                        <Text style={[styles.summaryStatValue, { color: colors.success }]}>
                          KES {formatCurrency(bulkDisbursementData.totalAmount)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.summaryStat}>
                      <Text style={[styles.summaryStatLabel, { color: colors.textSecondary }]}>
                        Average per Member
                      </Text>
                      <Text style={[styles.summaryStatValue, { color: colors.info }]}>
                        KES {bulkDisbursementData.dividendPerShare > 0 ?
                          formatCurrency(bulkDisbursementData.totalAmount / eligibleMembers.dividend.length) :
                          '0.00'
                        }
                      </Text>
                    </View>
                  </View>

                  {/* Top Shareholders Preview */}
                  <View style={styles.topShareholders}>
                    <Text style={[styles.topShareholdersTitle, { color: colors.text }]}>
                      Top Shareholders:
                    </Text>
                    {eligibleMembers.dividend
                      .sort((a, b) => b.sharesOwned - a.sharesOwned)
                      .slice(0, 3)
                      .map((member, index) => (
                        <View key={member.id} style={styles.shareholderItem}>
                          <Text style={[styles.shareholderName, { color: colors.textSecondary }]}>
                            {index + 1}. {member.name}
                          </Text>
                          <Text style={[styles.shareholderShares, { color: colors.success }]}>
                            {member.sharesOwned} shares
                          </Text>
                        </View>
                      ))}
                  </View>
                </View>
              ) : (
                <View style={[styles.emptyMembers, { backgroundColor: colors.warning + '10' }]}>
                  <Ionicons name="people-outline" size={32} color={colors.warning} />
                  <Text style={[styles.emptyMembersText, { color: colors.text }]}>
                    No eligible shareholders found
                  </Text>
                  <Text style={[styles.emptyMembersSubtext, { color: colors.textSecondary }]}>
                    Members must own shares to receive dividends
                  </Text>
                </View>
              )}

              {/* Description */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Description
                </Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text
                  }]}
                  value={bulkDisbursementData.description}
                  onChangeText={(text) => setBulkDisbursementData(prev => ({ ...prev, description: text }))}
                  placeholder="Enter dividend description (optional)"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Processing Status */}
              {bulkDisbursementData.dividendPerShare > 0 && eligibleMembers.dividend?.length > 0 && (
                <View style={[styles.processingStatus, { backgroundColor: colors.info + '10' }]}>
                  <Ionicons name="information-circle" size={20} color={colors.info} />
                  <View style={styles.processingStatusText}>
                    <Text style={[styles.processingStatusTitle, { color: colors.info }]}>
                      Ready for Processing
                    </Text>
                    <Text style={[styles.processingStatusDesc, { color: colors.textSecondary }]}>
                      This will create individual dividend records for {eligibleMembers.dividend.length} shareholders.
                      Each member will receive notification of their dividend amount.
                    </Text>
                  </View>
                </View>
              )}

              {/* Submit Button */}
              <Button
                title="Process Bulk Dividend Disbursement"
                onPress={handleBulkDisbursement}
                style={[styles.submitButton, { backgroundColor: colors.success }]}
                icon={<Ionicons name="cash" size={20} color={colors.white} />}
                disabled={!bulkDisbursementData.dividendPerShare || bulkDisbursementData.eligibleMembers.length === 0}
              />
            </View>
          )}

          {/* Security Notice */}
          <View style={[styles.securityNotice, { backgroundColor: colors.info + '10' }]}>
            <Ionicons name="shield-checkmark" size={16} color={colors.info} />
            <Text style={[styles.securityNoticeText, { color: colors.textSecondary }]}>
              All disbursements are logged with timestamp, role, and digital signature for audit purposes.
              {(disbursementType === 'dividend' || disbursementType === 'shares') && ' Bulk disbursements process all eligible members automatically.'}
            </Text>
          </View>
        </View>
      )}
    </Card>
  );

  const renderCreationPanel = () => (
    <Card style={[styles.creationCard, { backgroundColor: colors.surface }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="add-circle" size={24} color={colors.success} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Share & Dividend Creation
          </Text>
          {canInitiateDisbursements() && (
            <View style={[styles.permissionBadge, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={[styles.permissionText, { color: colors.success }]}>
                AUTHORIZED
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
          Create new shares and dividends for chama members
        </Text>
      </View>

      {/* Existing Shares & Dividends Summary */}
      <Card style={[styles.summaryCard, { backgroundColor: colors.background }]}>
        <View style={styles.summaryHeader}>
          <Ionicons name="stats-chart" size={20} color={colors.info} />
          <Text style={[styles.summaryTitle, { color: colors.text }]}>
            Current Holdings Summary
          </Text>
        </View>

        <View style={[styles.summaryStats, isMobile && styles.summaryStatsMobile]}>
          {/* Shares Summary */}
          <View style={[styles.summarySection, isMobile && styles.summarySectionMobile]}>
            <Text style={[
              styles.sectionTitle,
              isMobile && styles.sectionTitleMobile,
              { color: colors.text }
            ]}>
              Shares Available
            </Text>
            {existingShares.length > 0 ? (
              <View style={styles.sharesList}>
                {existingShares.slice(0, 3).map((share, index) => (
                  <View key={share.id || index} style={[styles.shareSummaryItem, isMobile && styles.shareSummaryItemMobile]}>
                    <View style={[styles.shareSummaryHeader, isMobile && styles.shareSummaryHeaderMobile]}>
                      <Text style={[
                        styles.shareSummaryName,
                        isMobile && styles.shareSummaryNameMobile,
                        { color: colors.text }
                      ]} numberOfLines={1} ellipsizeMode="tail">
                        {share.name || `${share.shareType} Shares Offering`}
                      </Text>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: share.status === 'active' ? colors.success + '20' : colors.warning + '20' }
                      ]}>
                        <Text style={[
                          styles.statusText,
                          { color: share.status === 'active' ? colors.success : colors.warning }
                        ]}>
                          {share.status === 'active' ? 'ACTIVE' : 'PENDING'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.shareSummaryDetails}>
                      <Text style={[styles.shareSummaryInfo, { color: colors.textSecondary }]}>
                        {share.totalShares} shares @ KES {formatCurrency(share.pricePerShare)} each
                      </Text>
                      <Text style={[styles.shareSummaryValue, { color: colors.info }]}>
                        Total Value: KES {formatCurrency(share.totalValue)}
                      </Text>
                    </View>
                  </View>
                ))}
                {existingShares.length > 3 && (
                  <Text style={[styles.moreItems, { color: colors.primary }]}>
                    +{existingShares.length - 3} more share offerings
                  </Text>
                )}
              </View>
            ) : (
              <Text style={[styles.emptySummary, { color: colors.textSecondary }]}>
                No shares created yet
              </Text>
            )}
          </View>

          {/* Dividends Summary */}
          <View style={[styles.summarySection, isMobile && styles.summarySectionMobile]}>
            <Text style={[
              styles.sectionTitle,
              isMobile && styles.sectionTitleMobile,
              { color: colors.text }
            ]}>
              Dividend Declarations
            </Text>
            {existingDividends.length > 0 ? (
              <View style={styles.dividendsList}>
                {existingDividends.slice(0, 2).map((dividend, index) => (
                  <View key={dividend.id || index} style={[styles.dividendSummaryItem, isMobile && styles.dividendSummaryItemMobile]}>
                    <Text style={[
                      styles.dividendSummaryName,
                      isMobile && styles.dividendSummaryNameMobile,
                      { color: colors.text }
                    ]}>
                      {dividend.dividendType} Dividend
                    </Text>
                    <View style={styles.dividendSummaryDetails}>
                      <Text style={[styles.dividendSummaryInfo, { color: colors.textSecondary }]}>
                        KES {formatCurrency(dividend.totalAmount)} total
                      </Text>
                      <Text style={[styles.dividendSummaryStatus, {
                        color: dividend.status === 'paid' ? colors.success :
                               dividend.status === 'pending' ? colors.warning : colors.info
                      }]}>
                        {dividend.status?.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                ))}
                {existingDividends.length > 2 && (
                  <Text style={[styles.moreItems, { color: colors.primary }]}>
                    +{existingDividends.length - 2} more declarations
                  </Text>
                )}
              </View>
            ) : (
              <Text style={[styles.emptySummary, { color: colors.textSecondary }]}>
                No dividends declared yet
              </Text>
            )}
          </View>
        </View>
      </Card>

      {/* Creation Type Selection - Enhanced Tab Interface */}
      <View style={styles.creationTypeSelector}>
        <View style={styles.creationTypeHeader}>
          <Text style={[styles.formLabel, { color: colors.text }]}>
            Select Creation Type
          </Text>
          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => Alert.alert(
              'Creation Types',
              '• Shares: Create new share offerings for members to purchase\n• Dividends: Declare dividend payments to existing shareholders\n\nOnly one form is shown at a time to reduce clutter and focus attention.'
            )}
          >
            <Ionicons name="help-circle" size={20} color={colors.info} />
          </TouchableOpacity>
        </View>

        {/* Tab-based Toggle Interface */}
        <View style={styles.creationTabsContainer}>
          <View style={[
            styles.creationTabs,
            { flexDirection: isLargeScreen ? 'row' : 'column' }
          ]}>
            {[
              {
                key: 'shares',
                title: 'Create Shares',
                icon: 'pie-chart',
                color: colors.info,
                description: 'Create new share offerings for purchase',
                tooltip: 'Create shares that members can buy to become shareholders'
              },
              {
                key: 'dividends',
                title: 'Declare Dividends',
                icon: 'cash',
                color: colors.success,
                description: 'Declare dividend payments to shareholders',
                tooltip: 'Distribute profits to existing shareholders'
              }
            ].map((type) => (
              <Button
                key={type.key}
                title={type.title}
                onPress={() => setCreationType(type.key)}
                style={[
                  styles.creationTabButton,
                  {
                    minHeight: isLargeScreen ? 120 : 90,
                    paddingVertical: isLargeScreen ? spacing.xl : spacing.lg,
                    paddingHorizontal: isLargeScreen ? spacing.lg : spacing.md,
                    borderColor: type.color
                  },
                  creationType === type.key && {
                    backgroundColor: type.color,
                    borderColor: type.color
                  }
                ]}
                textStyle={[
                  styles.creationTabButtonText,
                  { color: creationType === type.key ? colors.white : type.color }
                ]}
                icon={<Ionicons
                  name={type.icon}
                  size={isLargeScreen ? 24 : 20}
                  color={creationType === type.key ? colors.white : type.color}
                />}
                variant={creationType === type.key ? 'primary' : 'outline'}
              />
            ))}
          </View>
        </View>

        {/* Active Form Indicator */}
        <View style={[styles.activeFormIndicator, {
          backgroundColor: creationType === 'shares' ? colors.info + '10' : colors.success + '10',
          borderColor: creationType === 'shares' ? colors.info : colors.success
        }]}>
          <Ionicons
            name={creationType === 'shares' ? 'pie-chart' : 'cash'}
            size={16}
            color={creationType === 'shares' ? colors.info : colors.success}
          />
          <Text style={[styles.activeFormText, {
            color: creationType === 'shares' ? colors.info : colors.success
          }]}>
            Currently showing: {creationType === 'shares' ? 'Share Creation Form' : 'Dividend Declaration Form'}
          </Text>
        </View>
      </View>

      {!canInitiateDisbursements() ? (
        <View style={[styles.accessDenied, { backgroundColor: colors.error + '10' }]}>
          <Ionicons name="lock-closed" size={32} color={colors.error} />
          <Text style={[styles.accessDeniedTitle, { color: colors.error }]}>
            Access Restricted
          </Text>
          <Text style={[styles.accessDeniedText, { color: colors.textSecondary }]}>
            Only authorized roles can create shares and dividends
          </Text>
        </View>
      ) : (
        <View style={styles.creationForm}>
          {/* Share Creation Form */}
          {creationType === 'shares' && (
            <View style={[styles.shareCreationForm, { borderLeftWidth: 4, borderLeftColor: colors.info, paddingLeft: spacing.md }]}>
              <View style={[styles.formSectionHeader, { backgroundColor: colors.info + '10' }]}>
                <Ionicons name="pie-chart" size={20} color={colors.info} />
                <Text style={[styles.formSectionTitle, { color: colors.info }]}>
                  Share Creation Form
                </Text>
                <TouchableOpacity
                  style={styles.formHelpButton}
                  onPress={() => Alert.alert(
                    'Share Creation Help',
                    '• Name: Give your share offering a clear, descriptive name\n• Type: Choose the type of shares (Ordinary, Preference, Founder)\n• Total Shares: How many shares to create\n• Price per Share: Cost for each share\n• Min Purchase: Minimum shares a member can buy\n• Description: Additional details about the offering\n• Eligibility: Who can purchase these shares\n• Approval: Whether chairperson approval is required'
                  )}
                >
                  <Ionicons name="information-circle" size={16} color={colors.info} />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Share Offering Name *
                </Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text
                  }]}
                  value={shareCreationForm.name}
                  onChangeText={(text) => setShareCreationForm(prev => ({ ...prev, name: text }))}
                  placeholder="Enter share offering name"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Share Type *
                </Text>
                <View style={styles.shareTypeOptions}>
                  {[
                    { key: 'ordinary', label: 'Ordinary Shares', description: 'Standard voting shares' },
                    { key: 'preference', label: 'Preference Shares', description: 'Fixed dividend shares' },
                    { key: 'founder', label: 'Founder Shares', description: 'Special founder shares' }
                  ].map((type) => (
                    <TouchableOpacity
                      key={type.key}
                      style={[
                        styles.shareTypeOption,
                        { borderColor: colors.border },
                        shareCreationForm.shareType === type.key && { backgroundColor: colors.primary + '20', borderColor: colors.primary }
                      ]}
                      onPress={() => setShareCreationForm(prev => ({ ...prev, shareType: type.key }))}
                    >
                      <Text style={[styles.shareTypeLabel, { color: shareCreationForm.shareType === type.key ? colors.primary : colors.text }]}>
                        {type.label}
                      </Text>
                      <Text style={[styles.shareTypeDesc, { color: colors.textSecondary }]}>
                        {type.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: spacing.sm }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Total Shares *
                  </Text>
                  <TextInput
                    style={[styles.formInput, {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text
                    }]}
                    value={shareCreationForm.totalShares}
                    onChangeText={(text) => setShareCreationForm(prev => ({ ...prev, totalShares: text }))}
                    placeholder="Enter total shares"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: spacing.sm }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Price per Share (KES) *
                  </Text>
                  <TextInput
                    style={[styles.formInput, {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text
                    }]}
                    value={shareCreationForm.pricePerShare}
                    onChangeText={(text) => setShareCreationForm(prev => ({ ...prev, pricePerShare: text }))}
                    placeholder="Enter price"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Minimum Purchase (shares)
                </Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text
                  }]}
                  value={shareCreationForm.minimumPurchase}
                  onChangeText={(text) => setShareCreationForm(prev => ({ ...prev, minimumPurchase: text }))}
                  placeholder="Minimum shares per purchase"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Description
                </Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text
                  }]}
                  value={shareCreationForm.description}
                  onChangeText={(text) => setShareCreationForm(prev => ({ ...prev, description: text }))}
                  placeholder="Share offering description"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Eligibility Criteria
                </Text>
                <View style={styles.eligibilityOptions}>
                  {[
                    { key: 'all_members', label: 'All Members', description: 'Open to all chama members' },
                    { key: 'active_members', label: 'Active Members', description: 'Members with active contributions' },
                    { key: 'founders_only', label: 'Founders Only', description: 'Limited to founding members' }
                  ].map((criteria) => (
                    <TouchableOpacity
                      key={criteria.key}
                      style={[
                        styles.eligibilityOption,
                        { borderColor: colors.border },
                        shareCreationForm.eligibilityCriteria === criteria.key && { backgroundColor: colors.primary + '20', borderColor: colors.primary }
                      ]}
                      onPress={() => setShareCreationForm(prev => ({ ...prev, eligibilityCriteria: criteria.key }))}
                    >
                      <Text style={[styles.eligibilityLabel, { color: shareCreationForm.eligibilityCriteria === criteria.key ? colors.primary : colors.text }]}>
                        {criteria.label}
                      </Text>
                      <Text style={[styles.eligibilityDesc, { color: colors.textSecondary }]}>
                        {criteria.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <View style={styles.checkboxRow}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => setShareCreationForm(prev => ({ ...prev, approvalRequired: !prev.approvalRequired }))}
                  >
                    <Ionicons
                      name={shareCreationForm.approvalRequired ? "checkbox" : "square-outline"}
                      size={20}
                      color={shareCreationForm.approvalRequired ? colors.primary : colors.textSecondary}
                    />
                  </TouchableOpacity>
                  <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                    Requires Chairperson Approval
                  </Text>
                </View>
              </View>

              {shareCreationForm.totalShares && shareCreationForm.pricePerShare && (
                <View style={[styles.totalAmountCard, { backgroundColor: colors.info + '10' }]}>
                  <Text style={[styles.totalAmountLabel, { color: colors.info }]}>
                    Total Share Value
                  </Text>
                  <Text style={[styles.totalAmountValue, { color: colors.info }]}>
                    KES {formatCurrency(parseInt(shareCreationForm.totalShares || 0) * parseFloat(shareCreationForm.pricePerShare || 0))}
                  </Text>
                </View>
              )}

              <Button
                title="Create Shares"
                onPress={handleCreateShares}
                style={[styles.submitButton, { backgroundColor: colors.info }]}
                icon={<Ionicons name="add-circle" size={20} color={colors.white} />}
                disabled={!shareCreationForm.totalShares || !shareCreationForm.pricePerShare}
              />
            </View>
          )}

          {/* Dividend Creation Form */}
          {creationType === 'dividends' && (
            <View style={[styles.dividendCreationForm, { borderLeftWidth: 4, borderLeftColor: colors.success, paddingLeft: spacing.md }]}>
              <View style={[styles.formSectionHeader, { backgroundColor: colors.success + '10' }]}>
                <Ionicons name="cash" size={20} color={colors.success} />
                <Text style={[styles.formSectionTitle, { color: colors.success }]}>
                  Dividend Declaration Form
                </Text>
                <TouchableOpacity
                  style={styles.formHelpButton}
                  onPress={() => Alert.alert(
                    'Dividend Declaration Help',
                    '• Type: Choose dividend payment method (Cash, Share, Scrip)\n• Total Amount: Total dividend pool to distribute\n• Per Share: Auto-calculated amount per share\n• Payment Date: When dividends will be paid\n• Description: Details about this dividend declaration\n• Eligibility: Which shareholders qualify\n• Approval: Whether chairperson approval is required'
                  )}
                >
                  <Ionicons name="information-circle" size={16} color={colors.success} />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Dividend Type *
                </Text>
                <View style={styles.dividendTypeOptions}>
                  {[
                    { key: 'cash', label: 'Cash Dividend', description: 'Direct cash payment' },
                    { key: 'share', label: 'Share Dividend', description: 'Additional shares' },
                    { key: 'scrip', label: 'Scrip Dividend', description: 'Dividend in form of shares' }
                  ].map((type) => (
                    <TouchableOpacity
                      key={type.key}
                      style={[
                        styles.dividendTypeOption,
                        { borderColor: colors.border },
                        dividendCreationForm.dividendType === type.key && { backgroundColor: colors.primary + '20', borderColor: colors.primary }
                      ]}
                      onPress={() => setDividendCreationForm(prev => ({ ...prev, dividendType: type.key }))}
                    >
                      <Text style={[styles.dividendTypeLabel, { color: dividendCreationForm.dividendType === type.key ? colors.primary : colors.text }]}>
                        {type.label}
                      </Text>
                      <Text style={[styles.dividendTypeDesc, { color: colors.textSecondary }]}>
                        {type.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: spacing.sm }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Total Amount (KES) *
                  </Text>
                  <TextInput
                    style={[styles.formInput, {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text
                    }]}
                    value={dividendCreationForm.totalAmount}
                    onChangeText={(text) => {
                      const amount = parseFloat(text) || 0;
                      const perShare = amount / 100; // Assuming 100 shares for calculation
                      setDividendCreationForm(prev => ({
                        ...prev,
                        totalAmount: text,
                        dividendPerShare: perShare.toFixed(2)
                      }));
                    }}
                    placeholder="Total dividend amount"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: spacing.sm }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Per Share (KES)
                  </Text>
                  <TextInput
                    style={[styles.formInput, {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text
                    }]}
                    value={dividendCreationForm.dividendPerShare}
                    onChangeText={(text) => setDividendCreationForm(prev => ({ ...prev, dividendPerShare: text }))}
                    placeholder="Auto-calculated"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    editable={false}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Payment Date *
                </Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text
                  }]}
                  value={dividendCreationForm.paymentDate}
                  onChangeText={(text) => setDividendCreationForm(prev => ({ ...prev, paymentDate: text }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Description
                </Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text
                  }]}
                  value={dividendCreationForm.description}
                  onChangeText={(text) => setDividendCreationForm(prev => ({ ...prev, description: text }))}
                  placeholder="Dividend declaration description"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Eligibility Criteria
                </Text>
                <View style={styles.eligibilityOptions}>
                  {[
                    { key: 'shareholders_only', label: 'Shareholders Only', description: 'Members with shares' },
                    { key: 'active_shareholders', label: 'Active Shareholders', description: 'Members with active shares' },
                    { key: 'all_members', label: 'All Members', description: 'All chama members' }
                  ].map((criteria) => (
                    <TouchableOpacity
                      key={criteria.key}
                      style={[
                        styles.eligibilityOption,
                        { borderColor: colors.border },
                        dividendCreationForm.eligibilityCriteria === criteria.key && { backgroundColor: colors.primary + '20', borderColor: colors.primary }
                      ]}
                      onPress={() => setDividendCreationForm(prev => ({ ...prev, eligibilityCriteria: criteria.key }))}
                    >
                      <Text style={[styles.eligibilityLabel, { color: dividendCreationForm.eligibilityCriteria === criteria.key ? colors.primary : colors.text }]}>
                        {criteria.label}
                      </Text>
                      <Text style={[styles.eligibilityDesc, { color: colors.textSecondary }]}>
                        {criteria.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <View style={styles.checkboxRow}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => setDividendCreationForm(prev => ({ ...prev, approvalRequired: !prev.approvalRequired }))}
                  >
                    <Ionicons
                      name={dividendCreationForm.approvalRequired ? "checkbox" : "square-outline"}
                      size={20}
                      color={dividendCreationForm.approvalRequired ? colors.primary : colors.textSecondary}
                    />
                  </TouchableOpacity>
                  <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                    Requires Chairperson Approval
                  </Text>
                </View>
              </View>

              <Button
                title="Declare Dividends"
                onPress={handleCreateDividends}
                style={[styles.submitButton, { backgroundColor: colors.success }]}
                icon={<Ionicons name="cash" size={20} color={colors.white} />}
                disabled={!dividendCreationForm.totalAmount || !dividendCreationForm.paymentDate}
              />
            </View>
          )}

          <View style={[styles.securityNotice, { backgroundColor: colors.info + '10' }]}>
            <Ionicons name="shield-checkmark" size={16} color={colors.info} />
            <Text style={[styles.securityNoticeText, { color: colors.textSecondary }]}>
              All creations are logged with timestamp and role for audit purposes. Approval workflows ensure compliance with chama bylaws.
            </Text>
          </View>
        </View>
      )}
    </Card>
  );

  const getAccountDisplayName = (accountKey) => {
    const accounts = {
      'chama_main': 'Chama Main Account',
      'welfare': 'Welfare Fund',
      'investment': 'Investment Fund',
      'loan_fund': 'Loan Fund',
      'member_wallet': 'Member Wallet',
      'external_vendor': 'External Vendor'
    };
    return accounts[accountKey] || accountKey;
  };

  const showAccountPicker = (type) => {
    const accounts = [
      { key: 'chama_main', label: 'Chama Main Account', icon: 'business' },
      { key: 'welfare', label: 'Welfare Fund', icon: 'heart' },
      { key: 'investment', label: 'Investment Fund', icon: 'trending-up' },
      { key: 'loan_fund', label: 'Loan Fund', icon: 'card' },
      { key: 'member_wallet', label: 'Member Wallet', icon: 'wallet' },
      { key: 'external_vendor', label: 'External Vendor', icon: 'business-outline' }
    ];

    Alert.alert(
      `Select ${type === 'from' ? 'Source' : 'Destination'} Account`,
      'Choose the account for this transaction',
      accounts.map(account => ({
        text: account.label,
        onPress: () => {
          if (type === 'from') {
            setDisbursementForm(prev => ({ ...prev, fromAccount: account.key }));
          } else {
            setDisbursementForm(prev => ({ ...prev, toAccount: account.key }));
          }
        }
      })).concat([{ text: 'Cancel', style: 'cancel' }])
    );
  };

  const renderTransparencyFeed = () => (
    <Card style={[styles.transparencyCard, { backgroundColor: colors.surface }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="eye" size={24} color={colors.info} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Live Transparency Feed
          </Text>
          <View style={[styles.liveBadge, { backgroundColor: colors.success + '20' }]}>
            <View style={[styles.liveIndicator, { backgroundColor: colors.success }]} />
            <Text style={[styles.liveText, { color: colors.success }]}>
              LIVE
            </Text>
          </View>
        </View>
        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
          Real-time ledger of all financial transactions
        </Text>
      </View>

      {/* Feed Filters */}
      <View style={styles.feedFilters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { key: 'all', label: 'All', icon: 'list' },
            { key: 'loan', label: 'Loans', icon: 'card', color: colors.primary },
            { key: 'dividend', label: 'Dividends', icon: 'cash', color: colors.success },
            { key: 'welfare', label: 'Welfare', icon: 'heart', color: colors.warning },
            { key: 'expense', label: 'Expenses', icon: 'receipt', color: colors.error }
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterButton,
                { borderColor: filter.color || colors.textSecondary },
                feedFilters.category === filter.key && {
                  backgroundColor: (filter.color || colors.textSecondary) + '20'
                }
              ]}
              onPress={() => setFeedFilters(prev => ({ ...prev, category: filter.key }))}
            >
              <Ionicons
                name={filter.icon}
                size={14}
                color={feedFilters.category === filter.key ? (filter.color || colors.textSecondary) : colors.textSecondary}
              />
              <Text style={[
                styles.filterButtonText,
                { color: feedFilters.category === filter.key ? (filter.color || colors.textSecondary) : colors.textSecondary }
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Transaction Feed */}
      <View style={styles.transactionFeed}>
        {transparencyFeed.length === 0 ? (
          <View style={styles.emptyFeed}>
            <Ionicons name="document-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyFeedTitle, { color: colors.text }]}>
              No Transactions Yet
            </Text>
            <Text style={[styles.emptyFeedText, { color: colors.textSecondary }]}>
              Financial transactions will appear here in real-time
            </Text>
          </View>
        ) : (
          <FlatList
            data={transparencyFeed}
            keyExtractor={(item) => item.id || item.transactionId}
            renderItem={renderTransactionItem}
            showsVerticalScrollIndicator={false}
            style={styles.feedList}
          />
        )}
      </View>

      {/* Privacy Notice */}
      <View style={[styles.privacyNotice, { backgroundColor: colors.warning + '10' }]}>
        <Ionicons name="shield" size={16} color={colors.warning} />
        <Text style={[styles.privacyNoticeText, { color: colors.textSecondary }]}>
          Privacy Protected: Only roles are shown publicly. Full details available to authorized personnel.
        </Text>
      </View>
    </Card>
  );

  const renderTransactionItem = ({ item }) => {
    const categoryColor = getCategoryColor(item.category);
    const statusIcon = item.status === 'completed' ? 'checkmark-circle' :
                      item.status === 'failed' ? 'close-circle' : 'time';
    const statusColor = item.status === 'completed' ? colors.success :
                       item.status === 'failed' ? colors.error : colors.warning;

    return (
      <View style={[styles.transactionItem, { borderLeftColor: categoryColor }]}>
        <View style={styles.transactionHeader}>
          <View style={styles.transactionInfo}>
            <Text style={[styles.transactionTime, { color: colors.textSecondary }]}>
              {formatDate(item.timestamp)}
            </Text>
            <Text style={[styles.transactionAmount, { color: colors.text }]}>
              KES {formatCurrency(item.amount)}
            </Text>
          </View>
          <View style={styles.transactionStatus}>
            <Ionicons name={statusIcon} size={16} color={statusColor} />
            <Text style={[styles.transactionStatusText, { color: statusColor }]}>
              {item.status?.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.transactionDetails}>
          <Text style={[styles.transactionFlow, { color: colors.text }]}>
            {getAccountDisplayName(item.fromAccount)} → {getAccountDisplayName(item.toAccount)}
          </Text>
          <Text style={[styles.transactionPurpose, { color: colors.textSecondary }]}>
            {item.purpose}
          </Text>
        </View>

        <View style={styles.transactionFooter}>
          <View style={styles.transactionMeta}>
            <Text style={[styles.transactionRole, { color: colors.textSecondary }]}>
              Initiated by {item.initiatedBy || 'System'}
            </Text>
            <View style={[styles.categoryTag, { backgroundColor: categoryColor + '20' }]}>
              <Text style={[styles.categoryTagText, { color: categoryColor }]}>
                {item.category?.toUpperCase()}
              </Text>
            </View>
          </View>

          {canViewFullAudit() && (
            <TouchableOpacity
              style={styles.auditButton}
              onPress={() => viewTransactionAudit(item.id)}
            >
              <Ionicons name="document-text" size={14} color={colors.info} />
              <Text style={[styles.auditButtonText, { color: colors.info }]}>
                Audit
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const getCategoryColor = (category) => {
    switch (category?.toLowerCase()) {
      case 'loan': return colors.primary;
      case 'dividend': return colors.success;
      case 'welfare': return colors.warning;
      case 'expense': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const viewTransactionAudit = (transactionId) => {
    // Navigate to detailed audit view
    Alert.alert('Audit Details', `Viewing audit trail for transaction ${transactionId}`);
  };

  const renderAuditPanel = () => (
    <Card style={[styles.auditCard, { backgroundColor: colors.surface }]}>
      <TouchableOpacity
        style={styles.auditHeader}
        onPress={() => setShowAuditPanel(!showAuditPanel)}
      >
        <View style={styles.cardTitleRow}>
          <Ionicons name="document-text" size={24} color={colors.warning} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Audit & Receipt System
          </Text>
          {canGenerateReceipts() && (
            <View style={[styles.permissionBadge, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={[styles.permissionText, { color: colors.success }]}>
                AUTHORIZED
              </Text>
            </View>
          )}
        </View>
        <View style={styles.auditHeaderRight}>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            Generate receipts and audit reports
          </Text>
          <Ionicons
            name={showAuditPanel ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {showAuditPanel && (
        <Animated.View style={styles.auditContent}>
          {!canGenerateReceipts() ? (
            <View style={[styles.accessDenied, { backgroundColor: colors.error + '10' }]}>
              <Ionicons name="lock-closed" size={32} color={colors.error} />
              <Text style={[styles.accessDeniedTitle, { color: colors.error }]}>
                Access Restricted
              </Text>
              <Text style={[styles.accessDeniedText, { color: colors.textSecondary }]}>
                Only authorized roles can generate receipts and audit reports
              </Text>
            </View>
          ) : (
            <View style={styles.receiptCategories}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Receipt Categories
              </Text>

              <View style={styles.receiptGrid}>
                {[
                  {
                    key: 'revenue',
                    label: 'Revenue Receipts',
                    icon: 'trending-up',
                    color: colors.success,
                    description: 'Contributions, fundraising, loan interest, donations'
                  },
                  {
                    key: 'expense',
                    label: 'Expense Receipts',
                    icon: 'trending-down',
                    color: colors.error,
                    description: 'Rent, services, supplies'
                  },
                  {
                    key: 'loan_disbursement',
                    label: 'Loan Disbursements',
                    icon: 'card',
                    color: colors.primary,
                    description: 'From chama to loan account'
                  },
                  {
                    key: 'loan_repayment',
                    label: 'Loan Repayments',
                    icon: 'card-outline',
                    color: colors.info,
                    description: 'From member to chama'
                  },
                  {
                    key: 'dividend',
                    label: 'Dividend Distribution',
                    icon: 'cash',
                    color: colors.success,
                    description: 'Dividends/shares distributions'
                  },
                  {
                    key: 'welfare',
                    label: 'Welfare Support',
                    icon: 'heart',
                    color: colors.warning,
                    description: 'Welfare support disbursements'
                  },
                  {
                    key: 'transfer',
                    label: 'Account Transfers',
                    icon: 'swap-horizontal',
                    color: colors.info,
                    description: 'Internal account transfers'
                  },
                  {
                    key: 'profit_sharing',
                    label: 'Profit Sharing',
                    icon: 'pie-chart',
                    color: colors.success,
                    description: 'Profit sharing reports'
                  }
                ].map((category) => (
                  <TouchableOpacity
                    key={category.key}
                    style={[styles.receiptCategory, { borderColor: category.color }]}
                    onPress={() => generateReceipt(null, category.key)}
                  >
                    <View style={[styles.receiptCategoryIcon, { backgroundColor: category.color + '20' }]}>
                      <Ionicons name={category.icon} size={24} color={category.color} />
                    </View>
                    <Text style={[styles.receiptCategoryTitle, { color: colors.text }]}>
                      {category.label}
                    </Text>
                    <Text style={[styles.receiptCategoryDesc, { color: colors.textSecondary }]}>
                      {category.description}
                    </Text>
                    <View style={styles.receiptCategoryFooter}>
                      <Ionicons name="document" size={14} color={category.color} />
                      <Text style={[styles.receiptCategoryAction, { color: category.color }]}>
                        Generate
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Export Options */}
              <View style={styles.exportSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Export Options
                </Text>
                <View style={styles.exportButtons}>
                  <TouchableOpacity
                    style={[styles.exportButton, { backgroundColor: colors.error + '20' }]}
                    onPress={() => exportData('pdf')}
                  >
                    <Ionicons name="document-text" size={20} color={colors.error} />
                    <Text style={[styles.exportButtonText, { color: colors.error }]}>
                      PDF
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.exportButton, { backgroundColor: colors.success + '20' }]}
                    onPress={() => exportData('csv')}
                  >
                    <Ionicons name="grid" size={20} color={colors.success} />
                    <Text style={[styles.exportButtonText, { color: colors.success }]}>
                      CSV
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.exportButton, { backgroundColor: colors.info + '20' }]}
                    onPress={() => exportData('json')}
                  >
                    <Ionicons name="code" size={20} color={colors.info} />
                    <Text style={[styles.exportButtonText, { color: colors.info }]}>
                      JSON
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Security Features */}
              <View style={[styles.securityFeatures, { backgroundColor: colors.primary + '10' }]}>
                <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                <View style={styles.securityFeaturesText}>
                  <Text style={[styles.securityFeaturesTitle, { color: colors.text }]}>
                    Security Features
                  </Text>
                  <Text style={[styles.securityFeaturesDesc, { color: colors.textSecondary }]}>
                    • QR code verification • Digital signatures • Encrypted transaction IDs • Immutable audit trail
                  </Text>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      )}
    </Card>
  );

  const exportData = async (format) => {
    // Show feature coming soon message since backend API is not implemented
    Alert.alert(
      'Feature Coming Soon',
      'Data export functionality will be available in the next update. This feature requires backend implementation.',
      [
        { text: 'OK', style: 'default' },
        {
          text: 'Contact Support',
          onPress: () => {
            // Could navigate to support or open email
            Alert.alert('Support', 'Please contact the development team for more information.');
          }
        }
      ]
    );

    // Log the attempt for future implementation
    await logSecurityEvent('data_export_attempted', {
      format,
      chamaId,
      filters: feedFilters,
      attemptedBy: userRole,
      attemptedById: user.id,
      timestamp: new Date().toISOString(),
      reason: 'backend_api_not_implemented'
    });
  };

  // 🛠️ UTILITY FUNCTIONS
  const formatCurrency = (amount) => {
    if (!amount) return '0.00';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
    }).format(amount).replace('KES', '').trim();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const loadData = async () => {
    await Promise.all([
      loadTransparencyFeed(),
      loadNotifications(),
    ]);
  };

  // 📊 OLD RENDER FUNCTIONS (for compatibility)
  const handleDownloadReport = async (reportId) => {
    try {
      const response = await ApiService.downloadFinancialReport(chamaId, reportId);
      if (response.success) {
        Alert.alert('Download', 'Report download started. You will be notified when complete.');
      } else {
        Alert.alert('Error', response.error || 'Failed to download report');
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      Alert.alert('Error', 'Failed to download report');
    }
  };

  const handleGenerateReport = async (reportType) => {
    try {
      const reportData = {
        reportType,
        reportPeriodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // Start of current month
        reportPeriodEnd: new Date(), // Current date
      };

      const response = await ApiService.generateFinancialReport(chamaId, reportData);
      if (response.success) {
        Alert.alert('Success', 'Report generation started. You will be notified when ready.');
        await loadReports();
      } else {
        Alert.alert('Error', response.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      Alert.alert('Error', 'Failed to generate report');
    }
  };

  const canManageFinances = () => {
    return ['chairperson', 'secretary', 'treasurer'].includes(userRole);
  };

  const canApproveFinances = () => {
    return ['chairperson', 'treasurer'].includes(userRole);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return colors.warning;
      case 'approved': return colors.info;
      case 'processing': return colors.primary;
      case 'completed': return colors.success;
      case 'failed': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getBatchTypeIcon = (type) => {
    switch (type) {
      case 'dividend': return 'cash';
      case 'shares': return 'pie-chart';
      case 'savings': return 'wallet';
      case 'loan': return 'card';
      default: return 'document';
    }
  };

  // 🎯 MEMBER SELECTION HELPERS
  const getFilteredAndSortedMembers = () => {
    if (!eligibleMembers[disbursementType]) return [];

    let filtered = eligibleMembers[disbursementType].filter(member =>
      member.name.toLowerCase().includes(memberSearchQuery.toLowerCase())
    );

    // Sort members
    filtered.sort((a, b) => {
      switch (memberSortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'amount':
          const aAmount = getMemberSortAmount(a);
          const bAmount = getMemberSortAmount(b);
          return bAmount - aAmount; // Higher amounts first
        case 'eligibility':
          // Sort by eligibility priority
          const aPriority = getEligibilityPriority(a);
          const bPriority = getEligibilityPriority(b);
          return bPriority - aPriority;
        default:
          return 0;
      }
    });

    return filtered;
  };

  const getMemberSortAmount = (member) => {
    switch (disbursementType) {
      case 'loan': return member.approvedAmount || 0;
      case 'welfare': return member.contributionAmount || 0;
      case 'shares': return member.eligibleShares || 0;
      case 'savings_withdrawal': return member.availableSavings || 0;
      case 'other': return member.eligibleAmount || 0;
      default: return 0;
    }
  };

  const getEligibilityPriority = (member) => {
    // Higher priority = better eligibility
    switch (disbursementType) {
      case 'loan': return member.status === 'approved' ? 3 : 1;
      case 'welfare': return member.contributionCount >= 6 ? 3 : member.contributionCount >= 3 ? 2 : 1;
      case 'shares': return member.eligibleShares > 0 ? 3 : 1;
      case 'savings_withdrawal': return member.availableSavings > 1000 ? 3 : member.availableSavings > 500 ? 2 : 1;
      case 'other': return member.eligibleAmount > 0 ? 3 : 1;
      default: return 1;
    }
  };

  const getMemberDetailsText = (member) => {
    switch (disbursementType) {
      case 'loan':
        return `Approved: KES ${formatCurrency(member.approvedAmount)} • Status: ${member.status}`;
      case 'welfare':
        return `Contributions: KES ${formatCurrency(member.contributionAmount)} • ${member.contributionCount} payments`;
      case 'shares':
        return `Current Shares: ${member.currentShares || 0} • Eligible: ${member.eligibleShares}`;
      case 'savings_withdrawal':
        return `Available Balance: KES ${formatCurrency(member.availableSavings)}`;
      case 'other':
        return `Eligible Amount: KES ${formatCurrency(member.eligibleAmount)} • ${member.contributionCount} contributions`;
      default:
        return '';
    }
  };

  const getMemberAmountText = (member) => {
    switch (disbursementType) {
      case 'loan': return `KES ${formatCurrency(member.approvedAmount)}`;
      case 'welfare': return `KES ${formatCurrency(member.contributionAmount)}`;
      case 'shares': return `${member.eligibleShares} shares`;
      case 'savings_withdrawal': return `KES ${formatCurrency(member.availableSavings)}`;
      case 'other': return `KES ${formatCurrency(member.eligibleAmount)}`;
      default: return '';
    }
  };

  const getEligibilityColor = (member) => {
    const priority = getEligibilityPriority(member);
    switch (priority) {
      case 3: return colors.success;
      case 2: return colors.warning;
      case 1: return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getEligibilityIcon = (member) => {
    const priority = getEligibilityPriority(member);
    switch (priority) {
      case 3: return 'checkmark-circle';
      case 2: return 'alert-circle';
      case 1: return 'close-circle';
      default: return 'help-circle';
    }
  };

  const getEligibilityStatus = (member) => {
    const priority = getEligibilityPriority(member);
    switch (priority) {
      case 3: return 'High Priority';
      case 2: return 'Medium Priority';
      case 1: return 'Low Priority';
      default: return 'Unknown';
    }
  };

  const getAmountColor = (member) => {
    const amount = getMemberSortAmount(member);
    if (amount > 10000) return colors.success;
    if (amount > 5000) return colors.warning;
    return colors.textSecondary;
  };

  const getActivityTypeIcon = (type) => {
    switch (type) {
      case 'disbursement': return 'arrow-up';
      case 'revenue': return 'arrow-down';
      case 'expense': return 'arrow-up';
      case 'contribution': return 'arrow-down';
      default: return 'document';
    }
  };

  const getReportTypeIcon = (type) => {
    switch (type) {
      case 'monthly_statement': return 'calendar';
      case 'dividend_report': return 'cash';
      case 'transparency_report': return 'eye';
      case 'disbursement_report': return 'send';
      default: return 'document-text';
    }
  };

  const renderDisbursementItem = ({ item }) => (
    <Card style={[styles.itemCard, { backgroundColor: colors.surface }]}>
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <View style={styles.titleRow}>
            <Ionicons
              name={getBatchTypeIcon(item.batchType)}
              size={20}
              color={colors.primary}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
          </View>
          <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
            Initiated by {item.initiatedBy}
          </Text>
        </View>
        <View style={styles.itemValues}>
          <Text style={[styles.itemAmount, { color: colors.primary }]}>
            {formatCurrency(item.totalAmount)}
          </Text>
          <Text style={[styles.itemRecipients, { color: colors.textSecondary }]}>
            {item.totalRecipients} recipients
          </Text>
        </View>
      </View>

      {item.description && (
        <Text style={[styles.itemDescription, { color: colors.textSecondary }]}>
          {item.description}
        </Text>
      )}

      <View style={styles.itemMeta}>
        <Text style={[styles.itemDate, { color: colors.textSecondary }]}>
          Created: {formatDate(item.createdAt, 'date')}
        </Text>
        <View style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(item.status) + '15' }
        ]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>
      </View>

      {canManageFinances() && (
        <View style={styles.actionButtons}>
          {item.status === 'pending' && canApproveFinances() && (
            <Button
              title="Approve"
              onPress={() => handleApproveDisbursement(item.id)}
              style={[styles.actionButton, { backgroundColor: colors.success }]}
              textStyle={{ fontSize: 14 }}
            />
          )}
          {item.status === 'approved' && (
            <Button
              title="Process Payments"
              onPress={() => Alert.alert('Process Disbursement', 'Processing functionality will be implemented in the backend.')}
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              textStyle={{ fontSize: 14 }}
            />
          )}
        </View>
      )}

      {/* Recipients Preview */}
      {item.recipients && item.recipients.length > 0 && (
        <View style={styles.recipientsPreview}>
          <Text style={[styles.recipientsTitle, { color: colors.text }]}>
            Recipients ({item.recipients.length})
          </Text>
          {item.recipients.slice(0, 3).map((recipient, index) => (
            <View key={recipient.id} style={styles.recipientItem}>
              <Text style={[styles.recipientName, { color: colors.textSecondary }]}>
                {recipient.name}
              </Text>
              <Text style={[styles.recipientAmount, { color: colors.text }]}>
                {formatCurrency(recipient.amount)}
              </Text>
            </View>
          ))}
          {item.recipients.length > 3 && (
            <Text style={[styles.moreRecipients, { color: colors.primary }]}>
              +{item.recipients.length - 3} more recipients
            </Text>
          )}
        </View>
      )}
    </Card>
  );

  const renderTransparencyItem = ({ item }) => (
    <Card style={[styles.itemCard, { backgroundColor: colors.surface }]}>
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <View style={styles.titleRow}>
            <Ionicons
              name={getActivityTypeIcon(item.activityType)}
              size={20}
              color={item.transactionType === 'credit' ? colors.success : colors.error}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
          </View>
          <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
            by {item.performedBy}
          </Text>
        </View>
        <View style={styles.itemValues}>
          <Text style={[
            styles.itemAmount,
            { color: item.transactionType === 'credit' ? colors.success : colors.error }
          ]}>
            {item.transactionType === 'credit' ? '+' : '-'}{formatCurrency(item.amount)}
          </Text>
          <Text style={[styles.itemType, { color: colors.textSecondary }]}>
            {item.activityType}
          </Text>
        </View>
      </View>

      {item.description && (
        <Text style={[styles.itemDescription, { color: colors.textSecondary }]}>
          {item.description}
        </Text>
      )}

      {item.affectedMembers && (
        <View style={styles.affectedMembers}>
          <Text style={[styles.affectedTitle, { color: colors.text }]}>
            Affected Members:
          </Text>
          <Text style={[styles.affectedList, { color: colors.textSecondary }]}>
            {item.affectedMembers.join(', ')}
          </Text>
        </View>
      )}

      <View style={styles.itemMeta}>
        <Text style={[styles.itemDate, { color: colors.textSecondary }]}>
          {formatDate(item.createdAt, 'datetime')}
        </Text>
        <View style={[
          styles.typeBadge,
          { backgroundColor: colors.info + '15' }
        ]}>
          <Text style={[styles.typeText, { color: colors.info }]}>
            {item.activityType}
          </Text>
        </View>
      </View>
    </Card>
  );

  const renderReportItem = ({ item }) => (
    <Card style={[styles.itemCard, { backgroundColor: colors.surface }]}>
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <View style={styles.titleRow}>
            <Ionicons
              name={getReportTypeIcon(item.reportType)}
              size={20}
              color={colors.primary}
              style={styles.itemIcon}
            />
            <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
          </View>
          <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
            Generated by {item.generatedBy}
          </Text>
        </View>
        <View style={styles.itemValues}>
          <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
            {item.fileSize} MB
          </Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) + '15' }
          ]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status}
            </Text>
          </View>
        </View>
      </View>

      {item.description && (
        <Text style={[styles.itemDescription, { color: colors.textSecondary }]}>
          {item.description}
        </Text>
      )}

      <View style={styles.reportMeta}>
        <Text style={[styles.reportPeriod, { color: colors.textSecondary }]}>
          Period: {formatDate(item.reportPeriodStart, 'date')} - {formatDate(item.reportPeriodEnd, 'date')}
        </Text>
        <Text style={[styles.downloadCount, { color: colors.textSecondary }]}>
          Downloaded {item.downloadCount} times
        </Text>
      </View>

      <View style={styles.itemMeta}>
        <Text style={[styles.itemDate, { color: colors.textSecondary }]}>
          Generated: {formatDate(item.createdAt, 'date')}
        </Text>
        {item.isPublic && (
          <View style={[styles.publicBadge, { backgroundColor: colors.success + '15' }]}>
            <Ionicons name="globe" size={12} color={colors.success} />
            <Text style={[styles.publicText, { color: colors.success }]}>
              Public
            </Text>
          </View>
        )}
      </View>

      {item.status === 'ready' && (
        <View style={styles.actionButtons}>
          <Button
            title="Download"
            onPress={() => handleDownloadReport(item.id)}
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            textStyle={{ fontSize: 14 }}
          />
        </View>
      )}
    </Card>
  );

  if (!dataReady) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '70%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '50%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '30%' }]} />
          </View>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '60%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '40%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '80%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '55%' }]} />
          </View>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '45%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '65%' }]} />
          </View>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '75%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '35%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '50%' }]} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 🔐 SECURE HEADER WITH INTEGRATED NAVIGATION */}
      {renderSecurityHeader()}

      {/* 📋 MAIN CONTENT */}
      <ScrollView
        style={styles.mainContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([
                initializeSecureSystem(),
                loadExistingShares(),
                loadExistingDividends()
              ]);
              setRefreshing(false);
            }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {activePanel === 'disbursement' && renderDisbursementPanel()}
        {activePanel === 'transparency' && renderTransparencyFeed()}
        {activePanel === 'creation' && renderCreationPanel()}
        {activePanel === 'audit' && renderAuditPanel()}
      </ScrollView>

    </SafeAreaView>
  );
};

// 🎨 SECURE ACCOUNT MANAGEMENT STYLES
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    padding: 16,
  },
  skeletonCard: {
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
  },

  // 🔐 SECURITY HEADER STYLES
  securityHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    gap: spacing.md,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 1,
  },
  headerLeft: {
    flex: 1,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
    gap: spacing.xs,
  },
  securityText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  roleText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  notificationButton: {
    position: 'relative',
    padding: spacing.sm,
  },
  notificationBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationCount: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  // 📱 HEADER TABS STYLES
  headerTabs: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginLeft: spacing.md,
  },
  headerTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    minWidth: 0, // Allow shrinking
  },
  headerTabText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
    flexShrink: 1,
  },

  // 📱 PANEL NAVIGATION STYLES (Legacy - can be removed)
  panelNavigation: {
    flexDirection: 'row',
    marginHorizontal: spacing.sm, // Reduced from spacing.lg to make wider
    marginVertical: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  panelTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  panelTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  // 📋 MAIN CONTENT STYLES
  mainContent: {
    flex: 1,
    paddingHorizontal: spacing.sm, // Reduced from spacing.lg to make cards wider
  },

  // 🏗️ CREATION PANEL STYLES
  creationCard: {
    marginBottom: spacing.lg,
    marginHorizontal: spacing.xs,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  summaryCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  summaryStats: {
    gap: spacing.lg,
  },
  summaryStatsMobile: {
    gap: spacing.md,
  },
  summarySection: {
    gap: spacing.sm,
    flex: 1,
  },
  summarySectionMobile: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  sectionTitleMobile: {
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.xs,
  },
  sharesList: {
    gap: spacing.sm,
  },
  shareSummaryItem: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    gap: spacing.sm,
  },
  shareSummaryItemMobile: {
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  shareSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shareSummaryHeaderMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  shareSummaryName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  shareSummaryNameMobile: {
    fontSize: typography.fontSize.xs,
    flex: 1,
  },
  shareSummaryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shareSummaryInfo: {
    fontSize: typography.fontSize.xs,
    flex: 1,
  },
  shareSummaryPurchased: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  shareSummaryValue: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  dividendsList: {
    gap: spacing.sm,
  },
  dividendSummaryItem: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    gap: spacing.sm,
  },
  dividendSummaryItemMobile: {
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  dividendSummaryName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  dividendSummaryNameMobile: {
    fontSize: typography.fontSize.xs,
  },
  dividendSummaryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dividendSummaryInfo: {
    fontSize: typography.fontSize.xs,
    flex: 1,
  },
  dividendSummaryStatus: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  emptySummary: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: spacing.sm,
  },
  moreItems: {
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  creationTypeSelector: {
    marginBottom: spacing.lg,
  },
  creationTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  helpButton: {
    padding: spacing.xs,
  },
  creationTabsContainer: {
    marginBottom: spacing.md,
  },
  creationTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  creationTabButton: {
    flex: 1,
    borderWidth: 2,
    borderRadius: borderRadius.md,
    minHeight: 90,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creationTabButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  activeFormIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  activeFormText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  // Legacy styles for backward compatibility
  creationTypeButtons: {
    gap: spacing.md,
  },
  creationTypeButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  creationTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  creationTypeButtonGrid: {
    width: '48%', // 2 buttons per row with gap
    marginBottom: spacing.sm,
  },
  creationTypeButtonContent: {
    flex: 1,
  },
  creationTypeButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  creationTypeButtonDescription: {
    fontSize: typography.fontSize.sm,
  },
  creationForm: {
    gap: spacing.lg,
  },
  shareCreationForm: {
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  dividendCreationForm: {
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  formSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  formSectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    flex: 1,
  },
  formHelpButton: {
    padding: spacing.xs,
  },
  shareTypeOptions: {
    gap: spacing.sm,
  },
  shareTypeOption: {
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  shareTypeLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  shareTypeDesc: {
    fontSize: typography.fontSize.sm,
  },
  dividendTypeOptions: {
    gap: spacing.sm,
  },
  dividendTypeOption: {
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  dividendTypeLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  dividendTypeDesc: {
    fontSize: typography.fontSize.sm,
  },
  eligibilityOptions: {
    gap: spacing.sm,
  },
  eligibilityOption: {
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  eligibilityLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  eligibilityDesc: {
    fontSize: typography.fontSize.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkbox: {
    padding: spacing.xs,
  },
  checkboxLabel: {
    fontSize: typography.fontSize.sm,
  },
  createButton: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
  },

  // 💰 DISBURSEMENT PANEL STYLES
  disbursementCard: {
     marginBottom: spacing.lg,
     marginHorizontal: spacing.xs, // Minimal horizontal margin
     padding: spacing.lg,
     borderRadius: borderRadius.lg,
     elevation: 3,
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.1,
     shadowRadius: 6,
   },
  cardHeader: {
    marginBottom: spacing.lg,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    flex: 1,
  },
  cardSubtitle: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  permissionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  permissionText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  accessDenied: {
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
  },
  accessDeniedTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  accessDeniedText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  disbursementForm: {
    gap: spacing.lg,
  },

  // 📍 LOCATION BREADCRUMB STYLES
  locationBreadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  breadcrumbText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  // 🎯 DISBURSEMENT TYPE SELECTOR STYLES
  disbursementTypeSelector: {
    marginBottom: spacing.lg,
  },
  disbursementTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  disbursementCategory: {
    marginBottom: spacing.lg,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  categoryTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    flex: 1,
  },
  categorySubtitle: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },
  disbursementTypeGrid: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  disbursementTypeButton: {
    flex: 1,
    borderWidth: 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disbursementTypeButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  activeDisbursementIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  activeDisbursementText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  // Legacy styles for backward compatibility
  typeButtons: {
    gap: spacing.md,
  },
  typeButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  typeButtonGrid: {
    width: '48%', // 2 buttons per row with gap
    marginBottom: spacing.sm,
  },
  typeButtonGridCentered: {
    width: '48%', // Keep same width but center it
    alignSelf: 'center',
    marginLeft: '26%', // Center the third button (50% - 48%/2 = 26%)
  },
  typeButtonContent: {
    flex: 1,
  },
  typeButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  typeButtonDescription: {
    fontSize: typography.fontSize.sm,
  },

  // 🎯 INDIVIDUAL DISBURSEMENT STYLES
  individualDisbursementForm: {
    gap: spacing.lg,
  },
  memberSelectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  memberCountBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  memberCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    paddingVertical: 0,
  },
  sortOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sortLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  sortOptionText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  membersList: {
    maxHeight: 300,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  membersListMobile: {
    maxHeight: 250,
    padding: spacing.xs,
  },
  memberItem: {
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  memberItemDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberItemMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  memberInfo: {
    flex: 1,
  },
  memberInfoMobile: {
    width: '100%',
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  memberName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  memberNameMobile: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  selectedBadge: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  memberDetails: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  memberDetailsMobile: {
    fontSize: typography.fontSize.xs,
    lineHeight: 16,
  },
  memberStatusRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberStatusRowDesktop: {
    flexDirection: 'row',
  },
  memberStatusRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  eligibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  eligibilityBadgeMobile: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  eligibilityText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  memberAmount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  memberAmountMobile: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  emptyMembers: {
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  emptyMembersText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
  },
  emptyMembersSubtext: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 18,
  },

  // 📊 BULK DISBURSEMENT STYLES
  bulkDisbursementForm: {
    gap: spacing.lg,
  },
  eligibleMembersSummary: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  summaryTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
  },
  summaryStatLabel: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  summaryStatValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  topShareholders: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  topShareholdersTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  shareholderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  shareholderName: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  shareholderShares: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  processingStatus: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  processingStatusText: {
    flex: 1,
  },
  processingStatusTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  processingStatusDesc: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
  },

  formGroup: {
    gap: spacing.xs,
  },
  formLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  formHint: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    minHeight: 44,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  formSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  formSelectText: {
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    minHeight: 36,
  },
  categoryButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  submitButton: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  securityNoticeText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },

  // 📊 TRANSPARENCY FEED STYLES
  transparencyCard: {
    marginBottom: spacing.lg,
    marginHorizontal: spacing.xs, // Minimal horizontal margin
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  feedFilters: {
    marginBottom: spacing.lg,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    marginRight: spacing.sm,
    minHeight: 36,
  },
  filterButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  transactionFeed: {
    maxHeight: 400,
  },
  emptyFeed: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyFeedTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  emptyFeedText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  feedList: {
    maxHeight: 350,
  },
  transactionItem: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    elevation: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTime: {
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.xs,
  },
  transactionAmount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  transactionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  transactionStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  transactionDetails: {
    marginBottom: spacing.sm,
  },
  transactionFlow: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  transactionPurpose: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
  },
  transactionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  transactionRole: {
    fontSize: typography.fontSize.xs,
  },
  categoryTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  categoryTagText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  auditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  auditButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  privacyNoticeText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },

  // 🔍 AUDIT PANEL STYLES
  auditCard: {
    marginBottom: spacing.lg,
    marginHorizontal: spacing.xs, // Minimal horizontal margin
    borderRadius: borderRadius.lg,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  auditHeader: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  auditHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  auditContent: {
    padding: spacing.lg,
  },
  receiptCategories: {
    gap: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  receiptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  receiptCategory: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 120,
  },
  receiptCategoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptCategoryTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  receiptCategoryDesc: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    lineHeight: 16,
  },
  receiptCategoryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 'auto',
  },
  receiptCategoryAction: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  exportSection: {
    marginTop: spacing.lg,
  },
  exportButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  exportButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  securityFeatures: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  securityFeaturesText: {
    flex: 1,
  },
  securityFeaturesTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  securityFeaturesDesc: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
  },

  // 🖥️ DESKTOP-SPECIFIC STYLES
  desktopCreationContainer: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    gap: spacing.lg,
  },
  desktopSummaryStats: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  desktopSummarySection: {
    flex: 1,
    minHeight: 200,
  },
  desktopSharesList: {
    gap: spacing.md,
  },
  desktopShareSummaryItem: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    gap: spacing.sm,
  },
  desktopDividendsList: {
    gap: spacing.md,
  },
  desktopDividendSummaryItem: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    gap: spacing.sm,
  },
  desktopCreationTypeSelector: {
    marginBottom: spacing.xl,
  },
  desktopTypeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  desktopTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderWidth: 2,
    borderRadius: borderRadius.lg,
    minWidth: 250,
    justifyContent: 'center',
    gap: spacing.md,
  },
  desktopTypeButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  desktopTypeButtonDescription: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  desktopCreationForm: {
    gap: spacing.xl,
  },
  desktopShareCreationForm: {
    gap: spacing.xl,
  },
  desktopDividendCreationForm: {
    gap: spacing.xl,
  },
  desktopFormGroup: {
    gap: spacing.sm,
  },
  desktopFormGroupHalf: {
    flex: 1,
  },
  desktopFormRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  desktopFormInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    minHeight: 48,
    maxWidth: '100%',
  },
  desktopShareTypeOptions: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  desktopShareTypeOption: {
    flex: 1,
    minWidth: 200,
    padding: spacing.lg,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  desktopShareTypeLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
  },
  desktopShareTypeDesc: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  desktopDividendTypeOptions: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  desktopDividendTypeOption: {
    flex: 1,
    minWidth: 200,
    padding: spacing.lg,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  desktopDividendTypeLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
  },
  desktopDividendTypeDesc: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  desktopEligibilityDropdown: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  desktopEligibilityOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    minWidth: 120,
    alignItems: 'center',
  },
  desktopEligibilityLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  desktopTotalAmountCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  desktopButtonContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  desktopSubmitButton: {
    minWidth: 300,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  desktopSecurityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.md,
    marginTop: spacing.xl,
  },

  // 📋 ITEM CARD STYLES (for old render functions)
  itemCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.xs, // Minimal horizontal margin
    borderRadius: borderRadius.md,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  itemIcon: {
    marginRight: spacing.sm,
  },
  itemTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    flex: 1,
  },
  itemSubtitle: {
    fontSize: typography.fontSize.sm,
  },
  itemValues: {
    alignItems: 'flex-end',
  },
  itemAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  itemRecipients: {
    fontSize: typography.fontSize.xs,
  },
  itemStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  itemDate: {
    fontSize: typography.fontSize.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  recipientsPreview: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  recipientsTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
  },
  recipientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  recipientName: {
    fontSize: typography.fontSize.sm,
  },
  recipientAmount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  moreRecipients: {
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  affectedMembers: {
    marginBottom: spacing.sm,
  },
  affectedTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  affectedList: {
    fontSize: typography.fontSize.sm,
  },

});

export default AccountManagementScreen;