import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, shadows } from '../../../utils/theme';
import ApiService from '../../../services/api';
import { useFocusEffect } from '@react-navigation/native';
import ChamaLoansSearchCard from './ChamaLoansSearchCard';
import ChamaLoansTable from './ChamaLoansTable';
import ApplyForLoanScreen from './ApplyForLoanScreen';
import MessageBanner from '../../../components/common/MessageBanner';
import PageRefreshButton from '../../../components/common/PageRefreshButton';

const ChamaLoansScreen = ({ route, navigation, onRouteChange }) => {
  const { chamaId } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);

  const [loans, setLoans] = useState([]);
  const [filteredLoans, setFilteredLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalLoans, setTotalLoans] = useState(0);
  const [userRole, setUserRole] = useState('member'); // Track user role for security
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

        // Clear the success flag from route params so it doesn't reappear
        if (navigation?.setParams) {
          navigation.setParams({ loanApplicationSuccess: undefined });
        }

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
    // Filter loans based on search query
    const filtered = loans.filter(loan => {
      if (!searchQuery) return true;

      const searchableText = [
        loan.applicant?.firstName,
        loan.applicant?.lastName,
        loan.user?.firstName,
        loan.user?.lastName,
        loan.purpose,
        loan.amount?.toString(),
        loan.status
      ].filter(Boolean).join(' ').toLowerCase();

      return searchableText.includes(searchQuery.toLowerCase());
    });

    setFilteredLoans(filtered);
  }, [loans, searchQuery]);

  // Load user role for security purposes
  const loadUserRole = async () => {
    try {
      const response = await ApiService.getMemberRole(chamaId, user.id);
      if (response.success) {
        const role = response.data?.role || 'member';
        setUserRole(role);
      } else {
        setUserRole('left'); // User is not an active member
      }
    } catch (error) {
      const isNoisyError = /Invalid JSON response|Empty response/.test(error?.message || '');
      if (!isNoisyError) {
        console.error('🔐 Error loading user role:', error);
      }
      setUserRole('left'); // Default to left for security
    }
  };

  // Check if user can view all loans (leadership roles)
  const canViewAllLoans = () => {
    if (userRole === 'left') return false;
    const leadershipRoles = ['chairperson', 'secretary', 'treasurer'];
    return leadershipRoles.includes(userRole.toLowerCase());
  };

  // Check if user can approve/reject loans
  const canManageLoans = () => {
    if (userRole === 'left') return false;
    const managementRoles = ['chairperson', 'secretary', 'treasurer'];
    return managementRoles.includes(userRole.toLowerCase());
  };

  const loadLoans = async (page = currentPage) => {
    try {
      setLoading(true);

      // Calculate offset for pagination
      const offset = (page - 1) * pageSize;

      const response = await ApiService.getLoans(chamaId, pageSize, offset);

      if (response.success) {
        let filteredLoans = response.data || [];
        const totalCount = response.total || response.totalCount || filteredLoans.length;

        // 🔐 SECURITY: Filter loans based on user role
        if (!canViewAllLoans()) {
          // Regular members can only see their own loans
          filteredLoans = filteredLoans.filter(loan => {
            const loanUserId = loan.borrower_id || loan.borrowerId || loan.user_id || loan.applicant_id || loan.applicant?.id;
            return loanUserId === user.id;
          });
        }

        setLoans(filteredLoans);
        setFilteredLoans(filteredLoans);
        setTotalLoans(totalCount);
      } else {
        setLoans([]); // Set empty array for security
        setFilteredLoans([]);
      }
    } catch (error) {
      // Suppress noisy non-JSON/backend errors from loan endpoints that may not be configured
      const isNoisyLoanError = /Invalid JSON response|Empty response|Server returned HTML/.test(error?.message || '');
      if (!isNoisyLoanError) {
        console.error('❌ Failed to load loans:', error);
      }
      setLoans([]); // Set empty array for security
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
      const response = await ApiService.getLoanTypes(chamaId, 'active');
      if (response.success) {
        setLoanTypes(response.data || []);
      }
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
    // Option 2: Navigate to dedicated loan application form
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
        // Filter out current user and already selected guarantors
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
    if (newLoan.guarantors.length < 5) { // Limit to 5 guarantors
      setNewLoan(prev => ({
        ...prev,
        guarantors: [...prev.guarantors, guarantor]
      }));
      loadAvailableGuarantors(); // Refresh list to remove selected guarantor
    }
  };

  const removeGuarantor = (guarantorId) => {
    setNewLoan(prev => ({
      ...prev,
      guarantors: prev.guarantors.filter(g => g.id !== guarantorId)
    }));
    loadAvailableGuarantors(); // Refresh list to add back removed guarantor
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
        guarantors: newLoan.guarantors.map(g => g.id), // Send guarantor IDs
      };

      const response = await ApiService.createLoanApplication(loanData);
      if (response.success) {
        Alert.alert('Success', 'Loan application submitted successfully! Guarantors will be notified.');
        setShowCreateModal(false);
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

      // Default fallback for other actions
      const response = await ApiService.approveLoan(loan.id, { approved: true });
      if (response.success) {
        loadLoans();
      } else {
        Alert.alert('Error', `Failed to ${action} loan: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`❌ Failed to ${action} loan:`, error);
      setBanner({
        visible: true,
        message: `Failed to ${action} loan: ${error.message}`,
        type: 'error'
      });
    }
  };

  return (
    <SafeAreaView style={[styles.container, styles.containerBackground]}>
      <View style={{ flex: 1, position: 'relative' }}>
        {successBanner.visible && (
          <MessageBanner
            type="success"
            message={successBanner.message}
            onClose={() => setSuccessBanner({ visible: false, message: '' })}
          />
        )}

        <ChamaLoansSearchCard
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          theme={theme}
        />

        <ChamaLoansTable
          loans={filteredLoans}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          navigation={navigation}
          currentUser={user}
          canManageLoans={canManageLoans}
          onLoanAction={handleLoanAction}
          theme={theme}
        />

        <View style={{ position: 'absolute', right: spacing.md, bottom: 64, flexDirection: 'column', alignItems: 'center', gap: spacing.md, zIndex: 999 }}>
          <PageRefreshButton onRefresh={onRefresh} refreshing={refreshing} color={colors.primary} absolute={false} />
          <TouchableOpacity
            style={[styles.fab, styles.fabPrimary]}
            onPress={handleApplyForLoan}
          >
            <Ionicons name="add" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  containerBackground: {
    backgroundColor: colors.background,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  fabPrimary: {
    backgroundColor: colors.primary,
  },
});

export default ChamaLoansScreen;

