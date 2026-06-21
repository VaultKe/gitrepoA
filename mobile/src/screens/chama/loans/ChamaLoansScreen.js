import React, { useState, useEffect } from 'react';
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
import ChamaLoansSearchCard from './ChamaLoansSearchCard';
import ChamaLoansTable from './ChamaLoansTable';
import ApplyForLoanScreen from './ApplyForLoanScreen';

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
      console.log('🔐 Loading user role for security check');
      const response = await ApiService.getMemberRole(chamaId, user.id);
      if (response.success) {
        const role = response.data?.role || 'member';
        setUserRole(role);
        console.log('🔐 User role loaded:', role);
      } else {
        setUserRole('member'); // Default to member for security
        console.log('🔐 Failed to load role, defaulting to member');
      }
    } catch (error) {
      console.error('🔐 Error loading user role:', error);
      setUserRole('member'); // Default to member for security
    }
  };

  // Check if user can view all loans (leadership roles)
  const canViewAllLoans = () => {
    const leadershipRoles = ['chairperson', 'secretary', 'treasurer'];
    return leadershipRoles.includes(userRole.toLowerCase());
  };

  // Check if user can approve/reject loans
  const canManageLoans = () => {
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
      console.error('❌ Failed to load loans:', error);
      setLoans([]); // Set empty array for security
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
      let response;

      switch (action) {
        case 'approve':
          response = await ApiService.approveLoan(loan.id, { approved: true });
          break;
        case 'reject':
          response = await ApiService.approveLoan(loan.id, { approved: false });
          break;
        case 'guarantee':
          response = await ApiService.respondToGuaranteeRequest(loan.id, { accepted: true });
          break;
        default:
          return;
      }

      console.log(`🔍 API response for ${action}:`, response);

      if (response.success) {
        console.log(`✅ Loan ${action} successful`);
        loadLoans();
      } else {
        console.log(`❌ Loan ${action} failed with response:`, response);
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

      <TouchableOpacity
        style={[styles.fab, styles.fabPrimary]}
        onPress={handleApplyForLoan}
      >
        <Ionicons name="add" size={24} color={colors.white} />
      </TouchableOpacity>
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
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
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

