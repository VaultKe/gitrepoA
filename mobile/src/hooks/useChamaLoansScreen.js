import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import { getThemeColors, spacing, shadows } from '../utils/theme';
import ApiService from '../services/api';
import { useFocusEffect } from '@react-navigation/native';

const useChamaLoansScreen = ({ route, navigation, onRouteChange }) => {
  const { chamaId } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  const [loans, setLoans] = useState([]);
  const [filteredLoans, setFilteredLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalLoans, setTotalLoans] = useState(0);
  const [userRole, setUserRole] = useState('member');
  const [successBanner, setSuccessBanner] = useState({ visible: false, message: '' });
  const [newLoan, setNewLoan] = useState({
    amount: '',
    purpose: '',
    repaymentPeriod: '12',
    interestRate: '5',
    guarantors: [],
    businessPlan: '',
    monthlyIncome: '',
    otherLoans: '',
    security: {},
  });
  const [availableGuarantors, setAvailableGuarantors] = useState([]);
  const [guarantorSearch, setGuarantorSearch] = useState('');
  const [showGuarantorSearch, setShowGuarantorSearch] = useState(false);
  const [loanTypes, setLoanTypes] = useState([]);
  const [showLoanTypePicker, setShowLoanTypePicker] = useState(false);

  useEffect(() => {
    loadUserRole();
    loadLoans();
  }, [chamaId]);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.loanApplicationSuccess) {
        setSuccessBanner({
          visible: true,
          message: 'Loan application submitted successfully!',
        });
        if (navigation?.setParams) {
          navigation.setParams({ loanApplicationSuccess: undefined });
        }
        // The just-submitted loan won't be in the (short-lived) GET cache yet.
        try { ApiService.invalidateCache?.('/loans/'); } catch (e) {}
        loadLoans(1);
        setCurrentPage(1);
        const timeoutId = setTimeout(() => {
          setSuccessBanner({ visible: false, message: '' });
        }, 5000);
        return () => clearTimeout(timeoutId);
      }
    }, [route.params?.loanApplicationSuccess, navigation])
  );

  useEffect(() => {
    loadLoans(currentPage);
  }, [currentPage]);

  useEffect(() => {
    const filtered = loans.filter(loan => {
      if (!searchQuery) return true;
      const searchableText = [
        loan.applicant?.firstName,
        loan.applicant?.lastName,
        loan.user?.firstName,
        loan.user?.lastName,
        loan.purpose,
        loan.amount?.toString(),
        loan.status,
      ].filter(Boolean).join(' ').toLowerCase();
      return searchableText.includes(searchQuery.toLowerCase());
    });
    setFilteredLoans(filtered);
  }, [loans, searchQuery]);

  const loadUserRole = async () => {
    try {
      const response = await ApiService.getMemberRole(chamaId, user.id);
      if (response.success) {
        setUserRole(response.data?.role || 'member');
      } else {
        setUserRole('left');
      }
    } catch (error) {
      const isNoisyError = /Invalid JSON response|Empty response/.test(error?.message || '');
      if (!isNoisyError) {
        console.error('🔐 Error loading user role:', error);
      }
      setUserRole('left');
    }
  };

  const canViewAllLoans = () => {
    if (userRole === 'left') return false;
    const leadershipRoles = ['chairperson', 'secretary', 'treasurer'];
    return leadershipRoles.includes(userRole.toLowerCase());
  };

  const canManageLoans = () => {
    if (userRole === 'left') return false;
    const managementRoles = ['chairperson', 'secretary', 'treasurer'];
    return managementRoles.includes(userRole.toLowerCase());
  };

  const loadLoans = async (page = currentPage) => {
    try {
      setLoading(true);
      const offset = (page - 1) * pageSize;
      const response = await ApiService.getLoans(chamaId, pageSize, offset);
      if (response.success) {
        let filteredLoans = response.data || [];
        const totalCount = response.total || response.totalCount || filteredLoans.length;
        if (!canViewAllLoans()) {
          filteredLoans = filteredLoans.filter(loan => {
            const loanUserId = loan.borrower_id || loan.borrowerId || loan.user_id || loan.applicant_id || loan.applicant?.id;
            return loanUserId === user.id;
          });
        }
        setLoans(filteredLoans);
        setFilteredLoans(filteredLoans);
        setTotalLoans(totalCount);
      } else {
        setLoans([]);
        setFilteredLoans([]);
      }
    } catch (error) {
      const isNoisyLoanError = /Invalid JSON response|Empty response|Server returned HTML/.test(error?.message || '');
      if (!isNoisyLoanError) {
        console.error('❌ Failed to load loans:', error);
      }
      setLoans([]);
      setFilteredLoans([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLoans();
    setRefreshing(false);
  };

  const handleApplyForLoan = () => {
    if (!user || !user.id) {
      Alert.alert('Authentication Required', 'Please log in to apply for a loan.', [{ text: 'OK' }]);
      return;
    }
    const chamaName = route.params?.chamaName || route.params?.name || '';
    navigation.navigate('ApplyForLoanScreen', { chamaId, chamaName });
  };

  const loadLoanTypesForForm = async () => {
    try {
      if (!chamaId) return;
      const response = await ApiService.getLoanTypes(chamaId, 'active');
      if (response.success) setLoanTypes(response.data || []);
    } catch (error) {
      console.error('Failed to load loan types for form:', error);
    }
  };

  const handleSelectLoanType = (loanType) => {
    setNewLoan(prev => ({
      ...prev,
      loanTypeId: loanType.id,
      loanTypeName: loanType.name,
      repaymentPeriod: String(loanType.termMonths || prev.repaymentPeriod),
      interestRate: String(loanType.interestRate || prev.interestRate),
    }));
    setShowLoanTypePicker(false);
  };

  const handleNavigateToLoanForm = () => {
    if (onRouteChange) {
      onRouteChange('loan-application', 'LoanApplication');
    } else {
      navigation.navigate('LoanApplication', { chamaId });
    }
  };

  const loadAvailableGuarantors = async () => {
    try {
      const response = await ApiService.searchUsers(guarantorSearch || '');
      if (response.success) {
        const filteredUsers = (response.data || []).filter(searchUser =>
          searchUser.id !== user?.id &&
          !newLoan.guarantors.some(g => g.id === searchUser.id)
        );
        setAvailableGuarantors(filteredUsers);
      }
    } catch (error) {
      console.error('Failed to load guarantors:', error);
    }
  };

  const addGuarantor = (guarantor) => {
    if (newLoan.guarantors.length < 5) {
      setNewLoan(prev => ({
        ...prev,
        guarantors: [...prev.guarantors, guarantor]
      }));
      loadAvailableGuarantors();
    }
  };

  const removeGuarantor = (guarantorId) => {
    setNewLoan(prev => ({
      ...prev,
      guarantors: prev.guarantors.filter(g => g.id !== guarantorId)
    }));
    loadAvailableGuarantors();
  };

  const handleCreateLoan = async () => {
    if (!newLoan.amount || !newLoan.purpose || !newLoan.monthlyIncome) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }
    if (newLoan.guarantors.length < 2) {
      Alert.alert('Guarantors Required', 'Please select at least 2 guarantors for your loan application');
      return;
    }
    try {
      const loanData = {
        ...newLoan,
        chamaId,
        amount: parseFloat(newLoan.amount),
        repaymentPeriod: parseInt(newLoan.repaymentPeriod),
        interestRate: parseFloat(newLoan.interestRate),
        monthlyIncome: parseFloat(newLoan.monthlyIncome),
        guarantors: newLoan.guarantors.map(g => g.id),
      };
      const response = await ApiService.createLoanApplication(loanData);
      if (response.success) {
        Alert.alert('Success', 'Loan application submitted successfully! Guarantors will be notified.');
        setShowGuarantorSearch(false);
        setNewLoan({
          amount: '',
          purpose: '',
          repaymentPeriod: '12',
          interestRate: '5',
          guarantors: [],
          businessPlan: '',
          monthlyIncome: '',
          otherLoans: '',
          security: {},
        });
        await loadLoans();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to submit loan application');
    }
  };

  const handleLoanAction = async (loan, action) => {
    try {
      if (action === 'approve') {
        const comment = await new Promise((resolve) => {
          Alert.prompt(
            'Approval Comment',
            'Please enter your approval comment (required):',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
              { text: 'Continue', onPress: resolve },
            ],
            'plain-text'
          );
        });
        if (!comment || !comment.trim()) {
          Alert.alert('Comment Required', 'Approval comment is required.');
          return;
        }
        const response = await ApiService.initiateLoanApproval(loan.id, comment.trim());
        if (response?.success) {
          Alert.alert('OTP Sent', response.message || 'Please enter the OTP sent to your phone to complete approval.');
          const otp = await new Promise((resolve) => {
            Alert.prompt(
              'Enter OTP',
              'Enter the 6-digit OTP sent to your phone:',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
                { text: 'Verify', onPress: resolve },
              ],
              'plain-text'
            );
          });
          if (!otp || otp.trim().length !== 6) {
            Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP.');
            return;
          }
          const confirmResponse = await ApiService.confirmLoanApproval(loan.id, otp.trim(), comment.trim());
          if (confirmResponse?.success) {
            Alert.alert('Success', confirmResponse.message || 'Loan approved successfully');
            loadLoans();
          } else {
            Alert.alert('Error', confirmResponse?.error || 'Failed to confirm approval');
          }
        } else {
          Alert.alert('Error', response?.error || 'Failed to initiate approval');
        }
        return;
      }

      if (action === 'reject') {
        const reason = await new Promise((resolve) => {
          Alert.prompt(
            'Rejection Reason',
            'Please enter the reason for rejection (required):',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
              { text: 'Reject', onPress: resolve },
            ],
            'plain-text'
          );
        });
        if (!reason || !reason.trim()) {
          Alert.alert('Reason Required', 'Rejection reason is required.');
          return;
        }
        const response = await ApiService.rejectLoan(loan.id, reason.trim());
        if (response?.success) {
          Alert.alert('Success', 'Loan rejected successfully');
          loadLoans();
        } else {
          Alert.alert('Error', response?.error || 'Failed to reject loan');
        }
        return;
      }

      const response = await ApiService.approveLoan(loan.id, { approved: true });
      if (response.success) {
        loadLoans();
      } else {
        Alert.alert('Error', `Failed to ${action} loan: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`❌ Failed to ${action} loan:`, error);
      setSuccessBanner({
        visible: true,
        message: `Failed to ${action} loan: ${error.message}`,
        type: 'error'
      });
    }
  };

  return {
    // State
    loans,
    filteredLoans,
    loading,
    refreshing,
    searchQuery,
    currentPage,
    pageSize,
    totalLoans,
    userRole,
    successBanner,
    newLoan,
    availableGuarantors,
    guarantorSearch,
    showGuarantorSearch,
    loanTypes,
    showLoanTypePicker,
    // Handlers
    setSearchQuery,
    setCurrentPage,
    setGuarantorSearch,
    setShowGuarantorSearch,
    setShowLoanTypePicker,
    setNewLoan,
    setAvailableGuarantors,
    setSuccessBanner,
    onRefresh,
    loadUserRole,
    canViewAllLoans,
    canManageLoans,
    loadLoans,
    handleApplyForLoan,
    loadLoanTypesForForm,
    handleSelectLoanType,
    handleNavigateToLoanForm,
    loadAvailableGuarantors,
    addGuarantor,
    removeGuarantor,
    handleCreateLoan,
    handleLoanAction,
    // Navigation
    navigation,
    onRouteChange,
    route,
  };
};

export default useChamaLoansScreen;
