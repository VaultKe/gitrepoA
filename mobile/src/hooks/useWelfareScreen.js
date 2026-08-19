import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import ApiService from '../services/api';
import { getThemeColors, spacing, typography, borderRadius } from '../utils/theme';

const useWelfareScreen = ({ route, navigation }) => {
  const { chamaId: routeChamaId, defaultTab } = route.params || {};
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);

  const tableStyles = {
    tableContainer: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxxl,
    },
    tableHeader: {
      flexDirection: 'row',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.primary + '10',
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    tableRow: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    tableCell: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.sm, minWidth: 100 },
    nameCell: { flex: 1.5, alignItems: 'flex-start', minWidth: 120 },
    amountCell: { flex: 1.5, minWidth: 100 },
    dateCell: { flex: 1.5, minWidth: 100 },
    typeCell: { flex: 1.2, minWidth: 100 },
    actionsCell: { flex: 1, minWidth: 80 },
    tableHeaderText: { fontWeight: typography.fontWeight.bold, color: colors.primary, fontSize: 10, textAlign: 'center' },
    tableCellText: { fontSize: 12, color: colors.text, textAlign: 'center' },
    nameContainer: { flexDirection: 'row', alignItems: 'center' },
    typeIcon: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: spacing.xs },
    nameText: { fontWeight: typography.fontWeight.medium, textAlign: 'left' },
    statusBadge: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs / 2, borderRadius: borderRadius.sm },
    statusText: { fontSize: 11, fontWeight: typography.fontWeight.bold, textTransform: 'capitalize' },
    actionButton: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  };

  const chamaId = routeChamaId || currentChamaId;
  const [welfareRequests, setWelfareRequests] = useState([]);
  const [approvedWelfareRequests, setApprovedWelfareRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [votingInProgress, setVotingInProgress] = useState({});
  const [totalMembers, setTotalMembers] = useState(10);
  const [activeTab, setActiveTab] = useState(defaultTab || 'requests');
  const [newRequest, setNewRequest] = useState({ title: '', description: '', amount: '', category: 'medical', urgency: 'medium', beneficiaryIds: [] });
  const [chamaMembers, setChamaMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showBeneficiaryPicker, setShowBeneficiaryPicker] = useState(false);
  const [beneficiarySearch, setBeneficiarySearch] = useState('');
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [requestsCurrentPage, setRequestsCurrentPage] = useState(1);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedTableItem, setSelectedTableItem] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewModalItem, setViewModalItem] = useState(null);
  const itemsPerPage = 12;

  const welfareCategories = [
    { id: 'medical', name: 'Medical Emergency', icon: 'medical', color: colors.error },
    { id: 'education', name: 'Education Support', icon: 'school', color: colors.info },
    { id: 'funeral', name: 'Funeral Expenses', icon: 'flower', color: colors.textSecondary },
    { id: 'family', name: 'Family Support', icon: 'home', color: colors.warning },
    { id: 'business', name: 'Business Emergency', icon: 'briefcase', color: colors.success },
    { id: 'other', name: 'Other', icon: 'help-circle', color: colors.purple },
  ];

  const urgencyLevels = [
    { id: 'low', name: 'Low', color: colors.success },
    { id: 'medium', name: 'Medium', color: colors.warning },
    { id: 'high', name: 'High', color: colors.error },
  ];

  const hasValidChama = Boolean(chamaId);

  useEffect(() => {
    if (chamaId) {
      loadChamaDetails();
      loadWelfareRequests();
    }
  }, [chamaId]);

  useEffect(() => {
    if (showCreateModal || chamaMembers.length === 0) {
      loadChamaMembers();
    }
  }, [showCreateModal]);

  useFocusEffect(
    useCallback(() => {
      if (chamaId && activeTab === 'contributions') {
      }
    }, [chamaId, activeTab])
  );

  const loadChamaDetails = async () => {
    try {
      const response = await ApiService.getChamaById(chamaId);
      if (response.success) {
        setTotalMembers(response.data.member_count || 10);
      }
    } catch (error) {
      console.error('Failed to load chama details:', error);
    }
  };

  const loadWelfareRequests = async (page = requestsCurrentPage) => {
    try {
      setLoading(true);
      const offset = (page - 1) * itemsPerPage;
      const response = await ApiService.getWelfareRequests(chamaId, itemsPerPage, offset);
      if (response.success) {
        const allRequests = response.data || [];
        const pendingRequests = allRequests.filter(request => request.status === 'pending' || request.status === 'voting');
        const approvedRequests = allRequests.filter(request => request.status === 'approved');
        setWelfareRequests(pendingRequests);
        setApprovedWelfareRequests(approvedRequests);
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load welfare requests' });
    } finally {
      setLoading(false);
    }
  };

  const loadChamaMembers = async () => {
    try {
      setLoadingMembers(true);
      const response = await ApiService.getChamaMembers(chamaId, { include_inactive: 'true' });
      if (response.success) {
        const members = response.data || [];
        setChamaMembers(members);
        const eligibleMembers = members.filter(member => {
          const memberUserId = member.user_id || member.id;
          return memberUserId !== user.id;
        });
        setFilteredMembers(eligibleMembers);
      } else {
        console.error('Failed to load chama members:', response.error);
      }
    } catch (error) {
      console.error('Error loading chama members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleBeneficiarySearch = (searchText) => {
    setBeneficiarySearch(searchText);
    if (!searchText.trim()) {
      const eligibleMembers = chamaMembers.filter(member => {
        const memberUserId = member.user_id || member.id;
        return memberUserId !== user.id;
      });
      setFilteredMembers(eligibleMembers);
      return;
    }
    const searchTerm = searchText.toLowerCase().trim();
    const filtered = chamaMembers.filter(member => {
      const memberUserId = member.user_id || member.id;
      if (memberUserId === user.id) return false;
      const userData = member.user || member;
      const firstName = (userData.first_name || member.first_name || userData.firstName || member.firstName || '').toLowerCase();
      const lastName = (userData.last_name || member.last_name || userData.lastName || member.lastName || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();
      const memberName = (userData.name || member.name || '').toLowerCase();
      const email = (userData.email || member.email || '').toLowerCase();
      const role = (member.role || userData.role || member.position || '').toLowerCase();
      return firstName.includes(searchTerm) || lastName.includes(searchTerm) || fullName.includes(searchTerm) || memberName.includes(searchTerm) || email.includes(searchTerm) || role.includes(searchTerm);
    });
    setFilteredMembers(filtered);
  };

  const isMemberLeft = (member) => {
    const isActive = member?.is_active;
    return isActive === false || isActive === 0 || isActive === '0' || isActive === 'false';
  };

  const isUserIdLeft = (userId) => {
    if (!userId) return false;
    const member = chamaMembers.find(m => (m.user_id || m.id || m.user?.id) === userId);
    if (!member) return false;
    return isMemberLeft(member);
  };

  const toggleBeneficiary = (member) => {
    if (isMemberLeft(member)) return;
    setNewRequest(prev => {
      const isSelected = prev.beneficiaryIds.includes(member.id);
      if (isSelected) {
        return { ...prev, beneficiaryIds: prev.beneficiaryIds.filter(id => id !== member.id) };
      }
      return { ...prev, beneficiaryIds: [...prev.beneficiaryIds, member.id] };
    });
  };

  const getSelectedBeneficiaries = () => {
    if (newRequest.beneficiaryIds.length === 0) return [];
    return chamaMembers.filter(m => {
      const memberUserId = m.user_id || m.id;
      return newRequest.beneficiaryIds.includes(memberUserId);
    });
  };

  const removeBeneficiary = (memberId) => {
    setNewRequest(prev => ({ ...prev, beneficiaryIds: prev.beneficiaryIds.filter(id => id !== memberId) }));
  };

  const clearAllBeneficiaries = () => {
    setNewRequest(prev => ({ ...prev, beneficiaryIds: [] }));
  };

  const validateForm = () => {
    const errors = {};
    if (!newRequest.title.trim()) {
      errors.title = 'Title is required';
    } else if (newRequest.title.trim().length < 5) {
      errors.title = 'Title must be at least 5 characters long';
    } else if (newRequest.title.trim().length > 100) {
      errors.title = 'Title must be less than 100 characters';
    }
    if (!newRequest.description.trim()) {
      errors.description = 'Description is required';
    } else if (newRequest.description.trim().length < 10) {
      errors.description = 'Description must be at least 10 characters long';
    } else if (newRequest.description.trim().length > 500) {
      errors.description = 'Description must be less than 500 characters';
    }
    if (!newRequest.amount.trim()) {
      errors.amount = 'Amount is required';
    } else {
      const amount = parseFloat(newRequest.amount);
      if (isNaN(amount)) {
        errors.amount = 'Amount must be a valid number';
      } else if (amount <= 0) {
        errors.amount = 'Amount must be greater than 0';
      } else if (amount > 1000000) {
        errors.amount = 'Amount cannot exceed KES 1,000,000';
      } else if (amount < 100) {
        errors.amount = 'Minimum amount is KES 100';
      }
    }
    if (!newRequest.category) {
      errors.category = 'Please select a category';
    }
    if (!newRequest.urgency) {
      errors.urgency = 'Please select a priority level';
    }
    if (newRequest.beneficiaryIds.length > 0) {
      const invalidBeneficiaries = newRequest.beneficiaryIds.filter(
        id => !chamaMembers.find(member => {
          const memberUserId = member.user_id || member.id;
          return memberUserId === id && !isMemberLeft(member);
        })
      );
      if (invalidBeneficiaries.length > 0) {
        errors.beneficiaries = 'Some selected beneficiaries are no longer available. Please reselect.';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const clearFieldError = (fieldName) => {
    if (formErrors[fieldName]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadWelfareRequests()]);
    setRefreshing(false);
  };

  const handleCreateRequest = async () => {
    if (!validateForm()) {
      Toast.show({ type: 'error', text1: 'Form Validation Failed', text2: 'Please fix the errors below and try again' });
      return;
    }
    try {
      const requestData = {
        ...newRequest,
        chamaId,
        amount: parseFloat(newRequest.amount),
        requesterId: user.id,
        status: 'pending',
        beneficiaryId: newRequest.beneficiaryIds.length > 0 ? newRequest.beneficiaryIds[0] : null,
        beneficiaryIds: newRequest.beneficiaryIds,
      };
      const response = await ApiService.createWelfareRequest(requestData);
      if (response.success) {
        Toast.show({ type: 'success', text1: 'Request Submitted', text2: 'Your welfare request has been submitted for member voting' });
        setShowCreateModal(false);
        setNewRequest({ title: '', description: '', amount: '', category: 'medical', urgency: 'medium', beneficiaryIds: [] });
        setFormErrors({});
        await loadWelfareRequests();
      } else {
        Toast.show({ type: 'error', text1: 'Submission Failed', text2: response.message || 'Failed to submit welfare request' });
      }
    } catch (error) {
      console.error('Failed to create welfare request:', error);
      Toast.show({ type: 'error', text1: 'Submission Failed', text2: 'Failed to submit welfare request. Please try again.' });
    }
  };

  const handleVote = async (requestId, vote) => {
    try {
      setVotingInProgress(prev => ({ ...prev, [requestId]: true }));
      const request = welfareRequests.find(r => r.id === requestId);
      if (request?.userVote) {
        Toast.show({ type: 'error', text1: 'Already Voted', text2: 'You have already voted on this proposal. No re-voting allowed.' });
        return;
      }
      const voteData = { vote: vote === 'for' ? 'yes' : 'no' };
      const response = await ApiService.voteOnWelfareRequest(requestId, voteData.vote);
      if (response && response.success) {
        setWelfareRequests(prev => {
          return prev.map(req => {
            if (req.id === requestId) {
              const updatedVotes = {
                yes: req.votes?.yes || req.votes_for || 0,
                no: req.votes?.no || req.votes_against || 0,
                total: req.votes?.total || req.total_votes || 0
              };
              const voteType = vote === 'for' ? 'yes' : 'no';
              updatedVotes[voteType] += 1;
              updatedVotes.total += 1;
              const allMembersVoted = updatedVotes.total >= totalMembers;
              const majorityThreshold = Math.floor(totalMembers / 2) + 1;
              const hasYesMajority = updatedVotes.yes >= majorityThreshold;
              const hasNoMajority = updatedVotes.no >= majorityThreshold;
              let newStatus = req.status;
              if (allMembersVoted) {
                newStatus = hasYesMajority ? 'approved' : 'rejected';
              } else if (hasYesMajority) {
                newStatus = 'approved';
              } else if (hasNoMajority) {
                newStatus = 'rejected';
              }
              return { ...req, votes: updatedVotes, votes_for: updatedVotes.yes, votes_against: updatedVotes.no, total_votes: updatedVotes.total, userVote: voteType, status: newStatus };
            }
            return req;
          }).filter(req => req.status !== 'rejected');
        });
        Toast.show({ type: 'success', text1: 'Vote Recorded', text2: `Your vote ${vote === 'for' ? 'in support' : 'against'} has been recorded successfully` });
        const updatedRequest = welfareRequests.find(r => r.id === requestId);
        if (updatedRequest) {
          const currentYesVotes = (updatedRequest.votes?.yes || updatedRequest.votes_for || 0);
          const currentNoVotes = (updatedRequest.votes?.no || updatedRequest.votes_against || 0);
          const currentTotalVotes = (updatedRequest.votes?.total || updatedRequest.total_votes || 0);
          const newYesVotes = currentYesVotes + (vote === 'for' ? 1 : 0);
          const newNoVotes = currentNoVotes + (vote === 'against' ? 1 : 0);
          const newTotalVotes = currentTotalVotes + 1;
          const majorityThreshold = Math.floor(totalMembers / 2) + 1;
          const allMembersVoted = newTotalVotes >= totalMembers;
          if (newYesVotes >= majorityThreshold) {
            setTimeout(() => Toast.show({ type: 'success', text1: 'Proposal Approved!', text2: 'The welfare proposal has been approved by majority vote. It will move to the Contributions section.' }), 1000);
          } else if (newNoVotes >= majorityThreshold) {
            setTimeout(() => Toast.show({ type: 'info', text1: 'Proposal Rejected', text2: 'The welfare proposal has been rejected by majority vote and will be removed.' }), 1000);
          } else if (allMembersVoted) {
            if (newYesVotes > newNoVotes) {
              setTimeout(() => Toast.show({ type: 'success', text1: 'Proposal Approved!', text2: 'All members have voted. The proposal is approved and will move to Contributions.' }), 1000);
            } else {
              setTimeout(() => Toast.show({ type: 'info', text1: 'Proposal Rejected', text2: 'All members have voted. The proposal is rejected and will be removed.' }), 1000);
            }
          }
        }
        await Promise.all([loadWelfareRequests()]);
      } else {
        Toast.show({ type: 'error', text1: 'Vote Failed', text2: response?.message || response?.error || 'Failed to record your vote. Please try again.' });
      }
    } catch (error) {
      console.error('Failed to vote:', error);
      let errorMessage = 'Failed to record your vote. Please try again.';
      if (error.message) {
        if (error.message.includes('400')) errorMessage = 'Invalid vote data. Please try again.';
        else if (error.message.includes('401')) errorMessage = 'You are not authorized to vote. Please log in again.';
        else if (error.message.includes('403')) errorMessage = 'You do not have permission to vote on this proposal.';
        else if (error.message.includes('404')) errorMessage = 'Welfare proposal not found.';
      }
      Toast.show({ type: 'error', text1: 'Vote Failed', text2: errorMessage });
    } finally {
      setVotingInProgress(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown Date';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.warn('Date formatting error:', error);
      return 'Invalid Date';
    }
  };

  const getCategoryIcon = (category) => {
    const cat = welfareCategories.find(c => c.id === category);
    return cat?.icon || 'help-circle';
  };

  const getCategoryColor = (category) => {
    const cat = welfareCategories.find(c => c.id === category);
    return cat?.color || colors.textSecondary;
  };

  const getUrgencyColor = (urgency) => {
    const level = urgencyLevels.find(l => l.id === urgency);
    return level?.color || colors.textSecondary;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return colors.success;
      case 'rejected': return colors.error;
      case 'pending': return colors.warning;
      default: return colors.textSecondary;
    }
  };

  const handleViewContributionDetails = (requestId) => {
    navigation.navigate('WelfareContributions', { welfareRequestId: requestId, chamaId });
  };

  const getBeneficiaryDisplayName = (request) => {
    if (request.beneficiary && request.beneficiaryId !== request.requesterId) {
      const beneficiary = request.beneficiary;
      const userData = beneficiary.user || beneficiary;
      const firstName = userData.first_name || beneficiary.first_name || userData.firstName || '';
      const lastName = userData.last_name || beneficiary.last_name || userData.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || userData.name || beneficiary.name || beneficiary.email?.split('@')[0] || beneficiary.email?.split('@')[0] || 'Unknown Member';
    }
    return getRequesterDisplayName(request);
  };

  const getRequesterDisplayName = (request) => {
    if (!request.requester) return 'Unknown Requester';
    const requester = request.requester;
    const userData = requester.user || requester;
    const firstName = userData.first_name || requester.first_name || userData.firstName || '';
    const lastName = userData.last_name || requester.last_name || userData.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || userData.name || requester.name || requester.email?.split('@')[0] || requester.email?.split('@')[0] || 'Unknown Requester';
  };

  return {
    welfareRequests,
    approvedWelfareRequests,
    loading,
    refreshing,
    showCreateModal,
    setShowCreateModal,
    votingInProgress,
    setVotingInProgress,
    totalMembers,
    activeTab,
    setActiveTab,
    newRequest,
    setNewRequest,
    chamaMembers,
    loadingMembers,
    showBeneficiaryPicker,
    setShowBeneficiaryPicker,
    beneficiarySearch,
    setBeneficiarySearch,
    filteredMembers,
    formErrors,
    setFormErrors,
    requestsCurrentPage,
    setRequestsCurrentPage,
    showActionModal,
    setShowActionModal,
    selectedTableItem,
    setSelectedTableItem,
    showViewModal,
    setShowViewModal,
    viewModalItem,
    setViewModalItem,
    welfareCategories,
    urgencyLevels,
    itemsPerPage,
    hasValidChama,
    chamaId,
    tableStyles,
    loadChamaDetails,
    loadWelfareRequests,
    loadChamaMembers,
    handleBeneficiarySearch,
    isMemberLeft,
    isUserIdLeft,
    toggleBeneficiary,
    getSelectedBeneficiaries,
    removeBeneficiary,
    clearAllBeneficiaries,
    validateForm,
    clearFieldError,
    onRefresh,
    handleCreateRequest,
    handleVote,
    handleViewContributionDetails,
    formatCurrency,
    formatDate,
    getCategoryIcon,
    getCategoryColor,
    getUrgencyColor,
    getStatusColor,
    getBeneficiaryDisplayName,
    getRequesterDisplayName,
  };
};

export default useWelfareScreen;
