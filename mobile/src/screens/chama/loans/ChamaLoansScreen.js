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
  const [showCreateModal, setShowCreateModal] = useState(false);
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
    setShowCreateModal(true);
    loadAvailableGuarantors();
    loadLoanTypesForForm();
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
      {/* Create Loan Application Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Apply for Loan
              </Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Loan Details Section */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Loan Details
                </Text>
              </View>

              <Input
                label="Loan Amount (KES) *"
                value={newLoan.amount}
                onChangeText={(text) => setNewLoan(prev => ({ ...prev, amount: text }))}
                placeholder="Enter loan amount"
                keyboardType="numeric"
              />

              <Input
                label="Purpose *"
                value={newLoan.purpose}
                onChangeText={(text) => setNewLoan(prev => ({ ...prev, purpose: text }))}
                placeholder="What will you use this loan for?"
                multiline
                numberOfLines={3}
              />

              <Input
                label="Monthly Income (KES) *"
                value={newLoan.monthlyIncome}
                onChangeText={(text) => setNewLoan(prev => ({ ...prev, monthlyIncome: text }))}
                placeholder="Your monthly income"
                keyboardType="numeric"
              />

              {/* Loan Type Selection */}
              <TouchableOpacity
                style={[styles.formGroup, { marginBottom: spacing.md }]}
                onPress={() => setShowLoanTypePicker(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Loan Type {newLoan.loanTypeName ? `(${newLoan.loanTypeName})` : '*'}
                </Text>
                <View style={[styles.formInput, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                  <Text style={{ color: newLoan.loanTypeName ? colors.text : colors.textSecondary, flex: 1 }}>
                    {newLoan.loanTypeName || 'Select a loan type'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>

              {/* Loan Terms Section */}
              <View style={styles.sectionHeader}>
                <Ionicons name="calculator" size={20} color={colors.secondary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Loan Terms
                </Text>
              </View>

              <Input
                label="Repayment Period (Months)"
                value={newLoan.repaymentPeriod}
                onChangeText={(text) => setNewLoan(prev => ({ ...prev, repaymentPeriod: text }))}
                placeholder="12"
                keyboardType="numeric"
              />

              <Input
                label="Interest Rate (%)"
                value={newLoan.interestRate}
                onChangeText={(text) => setNewLoan(prev => ({ ...prev, interestRate: text }))}
                placeholder="5"
                keyboardType="numeric"
              />

              {/* Additional Information Section */}
              <View style={styles.sectionHeader}>
                <Ionicons name="information-circle" size={20} color={colors.info} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Additional Information
                </Text>
              </View>

              <Input
                label="Business Plan (Optional)"
                value={newLoan.businessPlan}
                onChangeText={(text) => setNewLoan(prev => ({ ...prev, businessPlan: text }))}
                placeholder="Describe your business plan..."
                multiline
                numberOfLines={4}
              />

              <Input
                label="Other Loans (Optional)"
                value={newLoan.otherLoans}
                onChangeText={(text) => setNewLoan(prev => ({ ...prev, otherLoans: text }))}
                placeholder="Do you have any other loans?"
                multiline
                numberOfLines={2}
              />

              {/* Guarantors Section */}
              <View style={styles.sectionHeader}>
                <Ionicons name="people" size={20} color={colors.warning} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Guarantors ({newLoan.guarantors.length}/5) *
                </Text>
              </View>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                Select at least 2 guarantors for your loan application
              </Text>

              {/* Selected Guarantors */}
              {newLoan.guarantors.map((guarantor, index) => (
                <View key={guarantor.id} style={[styles.guarantorItem, { backgroundColor: colors.backgroundSecondary }]}>
                  <View style={styles.guarantorInfo}>
                    <Text style={[styles.guarantorName, { color: colors.text }]}>
                      {guarantor.firstName} {guarantor.lastName}
                    </Text>
                    <Text style={[styles.guarantorEmail, { color: colors.textSecondary }]}>
                      {guarantor.email}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeGuarantor(guarantor.id)}
                    style={[styles.removeGuarantorBtn, { backgroundColor: colors.error }]}
                  >
                    <Ionicons name="close" size={16} color={colors.white} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add Guarantor Button */}
              {newLoan.guarantors.length < 5 && (
                <TouchableOpacity
                  style={[styles.addGuarantorBtn, { borderColor: colors.primary }]}
                  onPress={() => setShowGuarantorSearch(true)}
                >
                  <Ionicons name="add" size={20} color={colors.primary} />
                  <Text style={[styles.addGuarantorText, { color: colors.primary }]}>
                    Add Guarantor
                  </Text>
                </TouchableOpacity>
              )}

              {/* Guarantor Search Modal */}
              <Modal
                visible={showGuarantorSearch}
                transparent
                animationType="fade"
                onRequestClose={() => setShowGuarantorSearch(false)}
              >
                <View style={styles.searchModalOverlay}>
                  <View style={[styles.searchModalContent, { backgroundColor: colors.surface }]}>
                    {/* Header with Counter */}
                    <View style={styles.searchModalHeader}>
                      <View style={styles.headerLeft}>
                        <Ionicons name="people" size={24} color={colors.primary} />
                        <View>
                          <Text style={[styles.searchModalTitle, { color: colors.text }]}>
                            Select Guarantors
                          </Text>
                          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                            {newLoan.guarantors.length}/5 selected • Need {Math.max(0, 2 - newLoan.guarantors.length)} more
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => setShowGuarantorSearch(false)}
                        style={styles.closeButton}
                      >
                        <Ionicons name="close" size={24} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>

                    {/* Search Input */}
                    <View style={styles.searchSection}>
                      <View style={[styles.searchInputContainer, { backgroundColor: colors.backgroundSecondary }]}>
                        <Ionicons name="search" size={20} color={colors.textSecondary} />
                        <TextInput
                          style={[styles.searchInput, { color: colors.text }]}
                          value={guarantorSearch}
                          onChangeText={(text) => {
                            setGuarantorSearch(text);
                            loadAvailableGuarantors();
                          }}
                          placeholder="Search by name, email, or phone..."
                          placeholderTextColor={colors.textSecondary}
                        />
                        {guarantorSearch.length > 0 && (
                          <TouchableOpacity onPress={() => {
                            setGuarantorSearch('');
                            loadAvailableGuarantors();
                          }}>
                            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Guarantor List */}
                    <FlatList
                      data={availableGuarantors}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => {
                        const isAlreadySelected = newLoan.guarantors.some(g => g.id === item.id);
                        const isLimitReached = newLoan.guarantors.length >= 5;

                        return (
                          <TouchableOpacity
                            style={[
                              styles.guarantorCard,
                              {
                                backgroundColor: isAlreadySelected ? colors.primary + '10' : colors.backgroundSecondary,
                                borderColor: isAlreadySelected ? colors.primary : colors.border,
                                opacity: isAlreadySelected || isLimitReached ? 0.6 : 1,
                              }
                            ]}
                            onPress={() => {
                              if (!isAlreadySelected && !isLimitReached) {
                                addGuarantor(item);
                              }
                            }}
                            disabled={isAlreadySelected || isLimitReached}
                          >
                            <View style={styles.guarantorCardContent}>
                              <View style={[styles.avatar, { backgroundColor: isAlreadySelected ? colors.primary : colors.secondary }]}>
                                <Text style={[styles.avatarText, { color: colors.white }]}>
                                  {item.firstName?.[0]}{item.lastName?.[0]}
                                </Text>
                              </View>

                              <View style={styles.guarantorDetails}>
                                <Text style={[styles.guarantorName, { color: colors.text }]}>
                                  {item.firstName} {item.lastName}
                                </Text>
                                <Text style={[styles.guarantorEmail, { color: colors.textSecondary }]}>
                                  {item.email}
                                </Text>
                              </View>

                              <View style={styles.selectionIndicator}>
                                {isAlreadySelected ? (
                                  <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                                    <Ionicons name="checkmark" size={14} color={colors.white} />
                                  </View>
                                ) : (
                                  <View style={[styles.selectBadge, { borderColor: isLimitReached ? colors.textSecondary : colors.primary }]}>
                                    <Ionicons
                                      name="add"
                                      size={16}
                                      color={isLimitReached ? colors.textSecondary : colors.primary}
                                    />
                                  </View>
                                )}
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      }}
                      ListEmptyComponent={
                        <View style={styles.emptyState}>
                          <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
                          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                            {guarantorSearch ? 'No users found' : 'No available guarantors'}
                          </Text>
                          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                            {guarantorSearch
                              ? 'Try a different search term'
                              : 'All eligible members are already selected'
                            }
                          </Text>
                        </View>
                      }
                      style={styles.guarantorsList}
                      showsVerticalScrollIndicator={false}
                    />

                    {/* Footer with Done Button */}
                    <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                      <TouchableOpacity
                        style={[styles.doneButton, { backgroundColor: colors.primary }]}
                        onPress={() => setShowGuarantorSearch(false)}
                      >
                        <Text style={[styles.doneButtonText, { color: colors.white }]}>
                          Done ({newLoan.guarantors.length}/5)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>

              {/* Security Notice */}
              <View style={[styles.privacyNotice, { backgroundColor: colors.info + '15', marginTop: spacing.md }]}>
                <Ionicons name="shield-checkmark" size={16} color={colors.info} />
                <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                  Your application will be reviewed by chama leaders. All information is kept secure and confidential.
                </Text>
              </View>

              <Button
                title="Submit Application"
                onPress={handleCreateLoan}
                style={styles.submitButton}
                icon={<Ionicons name="send" size={20} color={colors.white} />}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {showLoanTypePicker && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowLoanTypePicker(false)}>
          <View style={styles.searchModalOverlay}>
            <View style={[styles.searchModalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.searchModalHeader}>
                <View>
                  <Text style={[styles.searchModalTitle, { color: colors.text }]}>Select Loan Type</Text>
                  <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Choose a loan type to prefill your application</Text>
                </View>
                <TouchableOpacity onPress={() => setShowLoanTypePicker(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={loanTypes}
                keyExtractor={(item) => item.id}
                style={styles.guarantorsList}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.guarantorCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, marginBottom: spacing.sm }]}
                    onPress={() => handleSelectLoanType(item)}
                  >
                    <View style={styles.guarantorCardContent}>
                      <View style={{ alignItems: 'center' }}>
                        <Ionicons name="cash" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.guarantorDetails}>
                        <Text style={[styles.guarantorName, { color: colors.text }]}>{item.name}</Text>
                        <Text style={[styles.guarantorEmail, { color: colors.textSecondary }]}>
                          KES {item.maxAmount ? item.maxAmount.toLocaleString() : '-'} • {item.interestRate}% • {item.termMonths} months
                        </Text>
                      </View>
                      <View style={styles.selectionIndicator}>
                        <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                          <Ionicons name="checkmark" size={14} color={colors.white} />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Ionicons name="cash-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No active loan types</Text>
                  </View>
                }
              />
              <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.doneButton, { backgroundColor: colors.textSecondary }]}
                  onPress={() => setShowLoanTypePicker(false)}
                >
                  <Text style={[styles.doneButtonText, { color: colors.white }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
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

