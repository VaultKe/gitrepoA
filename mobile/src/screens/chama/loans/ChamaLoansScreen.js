import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows, createThemedStyles } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';

import ApiService from '../../../services/api';
import ApplyForLoanScreen from './ApplyForLoanScreen';

const createTableStyles = createThemedStyles((colors, spacing, typography, shadows) => ({
  tableContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  nameCell: {
    flex: 2,
    alignItems: 'flex-start',
  },
  amountCell: {
    flex: 1.2,
  },
  statusCell: {
    flex: 1,
  },
  dateCell: {
    flex: 1.2,
  },
  actionsCell: {
    flex: 1.2,
  },
  tableHeaderText: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    fontSize: 9,
    textAlign: 'center',
  },
  tableCellText: {
    fontSize: 8.5,
    color: colors.text,
    textAlign: 'center',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  nameText: {
    fontWeight: typography.fontWeight.medium,
    textAlign: 'left',
  },
  subText: {
    fontSize: 7,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: 7,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'capitalize',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  actionButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text,
    paddingVertical: 0,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
}));

const ChamaLoansScreen = ({ route, navigation, onRouteChange }) => {
  const { chamaId } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const themedStyles = createTableStyles(theme);

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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date not available';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';

      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      console.warn('Error formatting date:', dateString, error);
      return 'Date error';
    }
  };

  const getUserRole = (item) => {
    // For loans, we determine role based on user permissions
    // This is a simplified version - in reality you'd check against user roles
    if (canManageLoans()) {
      return 'chairperson'; // Can manage loans
    }
    return 'member'; // Regular member
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return colors.warning;
      case 'approved':
        return colors.info;
      case 'active':
        return colors.primary;
      case 'completed':
        return colors.success;
      case 'rejected':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const renderTableRow = ({ item, index }) => {
    const userRole = getUserRole(item);
    const isContributionGroup = item.category === 'contribution';

    const typeConfig = isContributionGroup ? {
      color: colors.success,
      icon: 'heart',
      label: 'Contribution',
    } : {
      color: colors.primary,
      icon: 'people',
      label: 'Chama',
    };

    const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;

    return (
      
      <View style={[themedStyles.tableRow, { backgroundColor: rowBackgroundColor }]}>
        <View style={[themedStyles.tableCell, themedStyles.nameCell]}>
          <Text style={[themedStyles.tableCellText, themedStyles.nameText]} numberOfLines={1}>
            {(() => {
              const borrowerName = item.borrower?.firstName || item.borrower?.lastName
                ? `${item.borrower.firstName || ''} ${item.borrower.lastName || ''}`.trim()
                : item.borrower?.fullName;

              if (borrowerName) return borrowerName;

              const applicantName = item.applicant?.first_name || item.applicant?.firstName || item.user?.first_name || item.user?.firstName || item.applicant?.name || item.user?.name || item.applicant_name || item.user_name;

              if (applicantName) return applicantName;

              if (item.borrower_id === user.id) {
                const userName = `${user.firstName || user.first_name || user.name || 'You'} ${user.lastName || user.last_name || ''}`.trim();
                return userName || 'You';
              }

              return 'Loading...';
            })()}
          </Text>
        </View>

        <View style={[themedStyles.tableCell, themedStyles.amountCell]}>
          <Text style={themedStyles.tableCellText}>
            {formatCurrency(item.amount)}
          </Text>
        </View>

        <View style={[themedStyles.tableCell, themedStyles.statusCell]}>
          <View style={[themedStyles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[themedStyles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <View style={[themedStyles.tableCell, themedStyles.dateCell]}>
          <Text style={themedStyles.tableCellText}>
            {formatDate(item.created_at || item.createdAt)}
          </Text>
        </View>

        <View style={[themedStyles.tableCell, themedStyles.actionsCell]}>
          <View style={themedStyles.actionButtons}>
            <TouchableOpacity
              style={[themedStyles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('LoanDetails', { loanId: item.id })}
            >
              <Ionicons name="eye" size={10} color={colors.white} />
            </TouchableOpacity>
            {canManageLoans() && item.status === 'pending' && (
              <>
                <TouchableOpacity
                  style={[themedStyles.actionButton, { backgroundColor: colors.success }]}
                  onPress={() => handleLoanAction(item, 'approve')}
                >
                  <Ionicons name="checkmark" size={10} color={colors.white} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[themedStyles.actionButton, { backgroundColor: colors.error }]}
                  onPress={() => handleLoanAction(item, 'reject')}
                >
                  <Ionicons name="close" size={10} color={colors.white} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    );
  };
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {canViewAllLoans()
          ? 'No loans are available'
          : 'You have no loan applications yet.'
        }
      </Text>

      {/* 🔐 Security Privacy Notice */}
      <View style={[styles.privacyNotice, { backgroundColor: colors.info + '10' }]}>
        <Ionicons name="shield-checkmark" size={16} color={colors.info} />
        <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
          {canViewAllLoans()
            ? 'As a chama leader, you can view all member loan records.'
            : 'Your loan information is secure.'
          }
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Bar */}
      <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <Card style={{ marginBottom: 0 }}>
          <View style={themedStyles.searchContainer}>
            <Ionicons name="search" size={14} color={colors.textSecondary} style={themedStyles.searchIcon} />
            <TextInput
              style={themedStyles.searchInput}
              placeholder="Search loans..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </Card>
      </View>

      {/* Table Container */}
      <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
        {/* Table Header */}
        <View style={themedStyles.tableHeader}>
          <View style={[themedStyles.tableCell, themedStyles.nameCell]}>
            <Text style={themedStyles.tableHeaderText}>Name</Text>
          </View>
          <View style={[themedStyles.tableCell, themedStyles.amountCell]}>
            <Text style={themedStyles.tableHeaderText}>Amount</Text>
          </View>
          <View style={[themedStyles.tableCell, themedStyles.statusCell]}>
            <Text style={themedStyles.tableHeaderText}>Status</Text>
          </View>
          <View style={[themedStyles.tableCell, themedStyles.dateCell]}>
            <Text style={themedStyles.tableHeaderText}>Date</Text>
          </View>
          <View style={[themedStyles.tableCell, themedStyles.actionsCell]}>
            <Text style={themedStyles.tableHeaderText}>Actions</Text>
          </View>
        </View>

        {/* Table Body */}
        <FlatList
          data={filteredLoans}
          renderItem={renderTableRow}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={!loading && renderEmptyState()}
        />
      </View>
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={handleApplyForLoan}
      >
        <Ionicons name="add" size={24} color={colors.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    ...shadows.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.base,
  },
  tabContainer: {
    paddingVertical: spacing.md,
    backgroundColor: 'transparent',
  },
  tabsContent: {
    paddingHorizontal: spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    marginRight: spacing.sm,
    borderWidth: 1,
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  loansList: {
    padding: spacing.md,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  privacyText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: borderRadius.xl,
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    ...shadows.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: 'black',
  },
  modalBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
    paddingBottom: spacing.lg,
    maxHeight: 500,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
    color: 'gray',
  },
  submitButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },

  // Improved Guarantor Selection Modal Styles
  searchModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  searchModalContent: {
    borderRadius: borderRadius.xl,
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    ...shadows.xl,
  },
  searchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  searchModalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginLeft: spacing.sm,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs / 2,
  },
  closeButton: {
    padding: spacing.xs,
    marginTop: -spacing.xs,
    marginRight: -spacing.xs,
  },
  searchSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
  },
  guarantorsList: {
    maxHeight: 350,
    paddingHorizontal: spacing.lg,
  },
  guarantorCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    ...shadows.sm,
  },
  guarantorCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  guarantorDetails: {
    flex: 1,
  },
  selectionIndicator: {
    marginLeft: spacing.md,
  },
  selectedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  modalFooter: {
    padding: spacing.lg,
    borderTopWidth: 1,
    marginTop: spacing.md,
  },
  doneButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ChamaLoansScreen;

