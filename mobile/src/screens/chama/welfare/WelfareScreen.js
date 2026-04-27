import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import ApiService from '../../../services/api';
import Toast from 'react-native-toast-message';

const WelfareScreen = ({ route, navigation }) => {
  const { chamaId: routeChamaId, defaultTab } = route.params || {};
  const { theme, user } = useApp();
  const { currentChamaId, selectedChama } = useChamaContext();
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
    paddingHorizontal: spacing.sm,
    minWidth: 100,
  },
  nameCell: {
    flex: 3,
    alignItems: 'flex-start',
    minWidth: 120,
  },
  amountCell: {
    flex: 1.5,
    minWidth: 100,
  },
  dateCell: {
    flex: 1.5,
    minWidth: 100,
  },
  typeCell: {
    flex: 1.2,
    minWidth: 100,
  },
  actionsCell: {
    flex: 1,
    minWidth: 80,
  },
  tableHeaderText: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    fontSize: 10,
    textAlign: 'center',
  },
  tableCellText: {
    fontSize: 9,
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
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
  };

  // Use chamaId from route params or from context
  const chamaId = routeChamaId || currentChamaId;

  // State declarations (must be before any early returns)
  const [welfareRequests, setWelfareRequests] = useState([]);
  const [welfareContributions, setWelfareContributions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [votingInProgress, setVotingInProgress] = useState({});
  const [totalMembers, setTotalMembers] = useState(10);
  const [activeTab, setActiveTab] = useState(defaultTab || 'requests'); // 'requests' or 'contributions' // Default, should be loaded from chama data
  const [newRequest, setNewRequest] = useState({
    title: '',
    description: '',
    amount: '',
    category: 'medical',
    urgency: 'medium',
    beneficiaryIds: [] // empty array means self (requester), array of IDs for multiple beneficiaries
  });
  const [chamaMembers, setChamaMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showBeneficiaryPicker, setShowBeneficiaryPicker] = useState(false);
  const [beneficiarySearch, setBeneficiarySearch] = useState('');
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [formErrors, setFormErrors] = useState({});

  // Pagination states
  const [requestsCurrentPage, setRequestsCurrentPage] = useState(1);
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

  // Check if we have a valid chama
  const hasValidChama = Boolean(chamaId);

  useEffect(() => {
    if (chamaId) {
      loadChamaDetails();
      loadWelfareRequests();
      loadWelfareContributions();
    }
  }, [chamaId]);

  // Load chama members when create modal opens
  useEffect(() => {
    if (showCreateModal) {
      loadChamaMembers();
    }
  }, [showCreateModal]);

  const loadChamaDetails = async () => {
    try {
      const response = await ApiService.getChamaById(chamaId);
      if (response.success) {
        // Set total members for majority calculation
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
      console.log('🔍 Welfare requests API response:', response);

      if (response.success) {
        const allRequests = response.data || [];
        console.log('🔍 All welfare requests:', allRequests);
        console.log('🔍 Sample welfare request structure:', allRequests[0]);

        // Filter requests for the "Requests" tab:
        // - Show requests that are still in voting process (pending status)
        // - Show requests where voting hasn't completed yet
        const pendingRequests = allRequests.filter(request => {
          console.log('🔍 Processing request:', request);

          // Show pending requests (still in voting process)
          if (request.status === 'pending') {
            console.log('🔍 Including pending request for voting:', request.title);
            return true;
          }

          // Also show requests that might be in voting but not yet processed
          // (in case backend hasn't updated status yet)
          if (request.status === 'voting') {
            console.log('🔍 Including request in voting process:', request.title);
            return true;
          }

          console.log('🔍 Filtering out completed request:', request.status, request.title);
          return false;
        });

        console.log('🔍 Filtered pending requests:', pendingRequests);
        setWelfareRequests(pendingRequests);
      } else {
        console.error('🔍 Welfare requests API failed:', response);
      }
    } catch (error) {
      console.error('Failed to load welfare requests:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load welfare requests',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadWelfareContributions = async () => {
    try {
      // Load all welfare requests and filter for approved ones
      const response = await ApiService.getWelfareRequests(chamaId);
      if (response.success) {
        const allRequests = response.data || [];

        // Filter for approved requests that passed majority voting
        const approvedRequests = allRequests.filter(request => {
          console.log('🔍 Processing contribution request:', request);

          // Only show approved requests
          if (request.status !== 'approved') {
            console.log('🔍 Filtering out non-approved request:', request.status);
            return false;
          }

          // For now, show all approved requests
          // TODO: Add proper voting validation when voting is fully implemented
          console.log('🔍 Including approved request for contributions:', request.title);
          return true;
        });

        setWelfareContributions(approvedRequests);
      }
    } catch (error) {
      console.error('Failed to load welfare contributions:', error);
    }
  };



  const loadChamaMembers = async () => {
    try {
      setLoadingMembers(true);
      const response = await ApiService.getChamaMembers(chamaId);

      if (response.success) {
        const members = response.data || [];
        console.log('🔍 Loaded chama members:', members);
        console.log('🔍 Sample member structure:', members[0]);
        setChamaMembers(members);
        // Filter out current user from initial display
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
      // Show all members except the current user when no search term
      const eligibleMembers = chamaMembers.filter(member => {
        const memberUserId = member.user_id || member.id;
        return memberUserId !== user.id;
      });
      setFilteredMembers(eligibleMembers);
      return;
    }

    const searchTerm = searchText.toLowerCase().trim();
    const filtered = chamaMembers.filter(member => {
      // Exclude current user from search results
      const memberUserId = member.user_id || member.id;
      if (memberUserId === user.id) return false;

      // Handle nested user data structure from backend
      const userData = member.user || member;
      const firstName = (userData.first_name || member.first_name || userData.firstName || member.firstName || '').toLowerCase();
      const lastName = (userData.last_name || member.last_name || userData.lastName || member.lastName || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();
      const memberName = (userData.name || member.name || '').toLowerCase();
      const email = (userData.email || member.email || '').toLowerCase();
      const role = (member.role || userData.role || member.position || '').toLowerCase();

      // Search in multiple fields for better matching
      return firstName.includes(searchTerm) ||
             lastName.includes(searchTerm) ||
             fullName.includes(searchTerm) ||
             memberName.includes(searchTerm) ||
             email.includes(searchTerm) ||
             role.includes(searchTerm);
    });

    setFilteredMembers(filtered);
  };

  const toggleBeneficiary = (member) => {
    setNewRequest(prev => {
      const isSelected = prev.beneficiaryIds.includes(member.id);
      if (isSelected) {
        // Remove from selection
        return {
          ...prev,
          beneficiaryIds: prev.beneficiaryIds.filter(id => id !== member.id)
        };
      } else {
        // Add to selection
        return {
          ...prev,
          beneficiaryIds: [...prev.beneficiaryIds, member.id]
        };
      }
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
    setNewRequest(prev => ({
      ...prev,
      beneficiaryIds: prev.beneficiaryIds.filter(id => id !== memberId)
    }));
  };

  const clearAllBeneficiaries = () => {
    setNewRequest(prev => ({ ...prev, beneficiaryIds: [] }));
  };

  const validateForm = () => {
    const errors = {};

    // Title validation
    if (!newRequest.title.trim()) {
      errors.title = 'Title is required';
    } else if (newRequest.title.trim().length < 5) {
      errors.title = 'Title must be at least 5 characters long';
    } else if (newRequest.title.trim().length > 100) {
      errors.title = 'Title must be less than 100 characters';
    }

    // Description validation
    if (!newRequest.description.trim()) {
      errors.description = 'Description is required';
    } else if (newRequest.description.trim().length < 10) {
      errors.description = 'Description must be at least 10 characters long';
    } else if (newRequest.description.trim().length > 500) {
      errors.description = 'Description must be less than 500 characters';
    }

    // Amount validation
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

    // Category validation
    if (!newRequest.category) {
      errors.category = 'Please select a category';
    }

    // Urgency validation
    if (!newRequest.urgency) {
      errors.urgency = 'Please select a priority level';
    }

    // Beneficiary validation
    if (newRequest.beneficiaryIds.length === 0) {
      // This is valid (self-request), no error
    } else {
      // Validate that selected beneficiaries still exist in the member list
      const invalidBeneficiaries = newRequest.beneficiaryIds.filter(
        id => !chamaMembers.find(member => (member.user_id || member.id) === id)
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
    await Promise.all([
      loadWelfareRequests(),
      loadWelfareContributions()
    ]);
    setRefreshing(false);
  };

  const handleCreateRequest = async () => {
    // Validate form
    if (!validateForm()) {
      Toast.show({
        type: 'error',
        text1: 'Form Validation Failed',
        text2: 'Please fix the errors below and try again',
      });
      return;
    }

    try {
      const requestData = {
        ...newRequest,
        chamaId,
        amount: parseFloat(newRequest.amount),
        requesterId: user.id,
        status: 'pending', // All new requests start as pending
        // For backend compatibility: send first beneficiary or null
        beneficiaryId: newRequest.beneficiaryIds.length > 0 ? newRequest.beneficiaryIds[0] : null,
        // Also send the full list for future multi-beneficiary support
        beneficiaryIds: newRequest.beneficiaryIds,
      };

      const response = await ApiService.createWelfareRequest(requestData);
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Request Submitted',
          text2: 'Your welfare request has been submitted for member voting',
        });
        setShowCreateModal(false);
        setNewRequest({
          title: '',
          description: '',
          amount: '',
          category: 'medical',
          urgency: 'medium',
          beneficiaryIds: [],
        });
        setFormErrors({});
        await loadWelfareRequests();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Submission Failed',
          text2: response.message || 'Failed to submit welfare request',
        });
      }
    } catch (error) {
      console.error('Failed to create welfare request:', error);
      Toast.show({
        type: 'error',
        text1: 'Submission Failed',
        text2: 'Failed to submit welfare request. Please try again.',
      });
    }
  };

  const handleVote = async (requestId, vote) => {
    console.log('🗳️ === STARTING VOTE PROCESS ===');
    console.log('🗳️ Request ID:', requestId);
    console.log('🗳️ Vote:', vote);
    console.log('🗳️ User:', user);
    console.log('🗳️ Chama ID:', chamaId);

    try {
      setVotingInProgress(prev => ({ ...prev, [requestId]: true }));

      // Check if user has already voted
      const request = welfareRequests.find(r => r.id === requestId);
      console.log('🗳️ Found request:', request);

      if (request?.userVote) {
        console.log('🗳️ User has already voted:', request.userVote);
        Toast.show({
          type: 'error',
          text1: 'Already Voted',
          text2: 'You have already voted on this proposal. No re-voting allowed.',
        });
        return;
      }

      console.log('🗳️ User has not voted yet, proceeding...');

      // Backend expects { vote: "yes" } or { vote: "no" }
      const voteData = { vote: vote === 'for' ? 'yes' : 'no' };

      console.log('🗳️ Sending vote data:', voteData);

      const response = await ApiService.voteOnWelfareRequest(requestId, voteData);

      console.log('🗳️ === PROCESSING RESPONSE ===');
      console.log('🗳️ Final vote response:', response);
      console.log('🗳️ Response success:', response?.success);
      console.log('🗳️ Response error:', response?.error);
      console.log('🗳️ Response data:', response?.data);

      if (response && response.success) {
        console.log('🗳️ Vote was successful, updating UI...');
        // Update local state immediately for better UX
        setWelfareRequests(prev => {
          return prev.map(req => {
            if (req.id === requestId) {
              const updatedVotes = {
                yes: req.votes?.yes || req.votes_for || 0,
                no: req.votes?.no || req.votes_against || 0,
                total: req.votes?.total || req.total_votes || 0
              };

              // Add the new vote
              const voteType = vote === 'for' ? 'yes' : 'no';
              updatedVotes[voteType] += 1;
              updatedVotes.total += 1;

              // Check if all members have voted
              const allMembersVoted = updatedVotes.total >= totalMembers;
              const majorityThreshold = Math.floor(totalMembers / 2) + 1;
              const hasYesMajority = updatedVotes.yes >= majorityThreshold;
              const hasNoMajority = updatedVotes.no >= majorityThreshold;

              let newStatus = req.status;

              if (allMembersVoted) {
                // All members have voted, determine final status
                if (hasYesMajority) {
                  newStatus = 'approved';
                } else {
                  newStatus = 'rejected';
                }
              } else if (hasYesMajority) {
                // Majority reached before all voted
                newStatus = 'approved';
              } else if (hasNoMajority) {
                // Majority rejection reached before all voted
                newStatus = 'rejected';
              }

              return {
                ...req,
                votes: updatedVotes,
                votes_for: updatedVotes.yes,
                votes_against: updatedVotes.no,
                total_votes: updatedVotes.total,
                userVote: voteType,
                status: newStatus
              };
            }
            return req;
          }).filter(req => {
            // Remove rejected requests from the requests list
            // They should disappear automatically
            return req.status !== 'rejected';
          });
        });

        const voteText = vote === 'for' ? 'in support' : 'against';
        Toast.show({
          type: 'success',
          text1: 'Vote Recorded',
          text2: `Your vote ${voteText} has been recorded successfully`,
        });

        // Check if this vote resulted in approval or rejection
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
            setTimeout(() => {
              Toast.show({
                type: 'success',
                text1: 'Proposal Approved!',
                text2: 'The welfare proposal has been approved by majority vote. It will move to the Contributions section.',
              });
            }, 1000);
          } else if (newNoVotes >= majorityThreshold) {
            setTimeout(() => {
              Toast.show({
                type: 'info',
                text1: 'Proposal Rejected',
                text2: 'The welfare proposal has been rejected by majority vote and will be removed.',
              });
            }, 1000);
          } else if (allMembersVoted) {
            // All voted but no majority reached
            if (newYesVotes > newNoVotes) {
              setTimeout(() => {
                Toast.show({
                  type: 'success',
                  text1: 'Proposal Approved!',
                  text2: 'All members have voted. The proposal is approved and will move to Contributions.',
                });
              }, 1000);
            } else {
              setTimeout(() => {
                Toast.show({
                  type: 'info',
                  text1: 'Proposal Rejected',
                  text2: 'All members have voted. The proposal is rejected and will be removed.',
                });
              }, 1000);
            }
          }
        }

        // Refresh data from server to ensure consistency
        console.log('🗳️ Refreshing welfare data...');
        await Promise.all([
          loadWelfareRequests(),
          loadWelfareContributions()
        ]);
        console.log('🗳️ Vote process completed successfully');
      } else {
        console.error('🗳️ === VOTE FAILED ===');
        console.error('🗳️ Vote failed response:', response);
        console.error('🗳️ Response type:', typeof response);
        console.error('🗳️ Response keys:', response ? Object.keys(response) : 'null/undefined');

        Toast.show({
          type: 'error',
          text1: 'Vote Failed',
          text2: response?.message || response?.error || 'Failed to record your vote. Please try again.',
        });
      }
    } catch (error) {
      console.error('🗳️ Failed to vote:', error);
      console.error('🗳️ Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response
      });

      let errorMessage = 'Failed to record your vote. Please try again.';

      // Try to extract more specific error message
      if (error.message) {
        if (error.message.includes('400')) {
          errorMessage = 'Invalid vote data. Please try again.';
        } else if (error.message.includes('401')) {
          errorMessage = 'You are not authorized to vote. Please log in again.';
        } else if (error.message.includes('403')) {
          errorMessage = 'You do not have permission to vote on this proposal.';
        } else if (error.message.includes('404')) {
          errorMessage = 'Welfare proposal not found.';
        }
      }

      Toast.show({
        type: 'error',
        text1: 'Vote Failed',
        text2: errorMessage,
      });
    } finally {
      setVotingInProgress(prev => ({ ...prev, [requestId]: false }));
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
    if (!dateString) return 'Unknown Date';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }

      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
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

  const ErrorText = ({ error }) => {
    if (!error) return null;
    return (
      <Text style={[styles.errorText, { color: colors.error }]}>
        {error}
      </Text>
    );
  };



  // Table action modal states
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedTableItem, setSelectedTableItem] = useState(null);

  // View details modal states
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewModalItem, setViewModalItem] = useState(null);



  const handleViewContributionDetails = (requestId) => {
    navigation.navigate('WelfareContributions', { welfareRequestId: requestId, chamaId });
  };



  // Helper function to get beneficiary display name
  const getBeneficiaryDisplayName = (request) => {
    // If there's a specific beneficiary (different from requester)
    if (request.beneficiary && request.beneficiaryId !== request.requesterId) {
      const beneficiary = request.beneficiary;
      const userData = beneficiary.user || beneficiary;
      const firstName = userData.first_name || beneficiary.first_name || userData.firstName || '';
      const lastName = userData.last_name || beneficiary.last_name || userData.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || userData.name || beneficiary.name || userData.email?.split('@')[0] || beneficiary.email?.split('@')[0] || 'Unknown Member';
    }

    // Otherwise, it's for the requester themselves
    return getRequesterDisplayName(request);
  };

  // Helper function to get requester display name
  const getRequesterDisplayName = (request) => {
    if (!request.requester) return 'Unknown Requester';

    const requester = request.requester;
    const userData = requester.user || requester;
    const firstName = userData.first_name || requester.first_name || userData.firstName || '';
    const lastName = userData.last_name || requester.last_name || userData.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || userData.name || requester.name || userData.email?.split('@')[0] || requester.email?.split('@')[0] || 'Unknown Requester';
  };

  const renderWelfareRequestTableRow = ({ item, index }) => {
    const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;

    return (
      <View style={[tableStyles.tableRow, { backgroundColor: rowBackgroundColor }]}>
        {/* Title Column */}
        <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
          <View style={tableStyles.nameContainer}>
            <View style={[tableStyles.typeIcon, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
              <Ionicons
                name={getCategoryIcon(item.category)}
                size={12}
                color={getCategoryColor(item.category)}
              />
            </View>
            <Text style={[tableStyles.tableCellText, tableStyles.nameText]} numberOfLines={1}>
              {item.title.length > 5 ? item.title.substring(0, 5) + '...' : item.title}
            </Text>
          </View>
        </View>

        {/* Category Column */}
        <View style={[tableStyles.tableCell, tableStyles.typeCell]}>
          <View style={[tableStyles.statusBadge, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
            <Text style={[tableStyles.statusText, { color: getCategoryColor(item.category) }]}>
              {welfareCategories.find(c => c.id === item.category)?.name || item.category}
            </Text>
          </View>
        </View>

        {/* Amount Column */}
        <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
          <Text style={[
            tableStyles.tableCellText,
            { color: colors.primary, fontWeight: typography.fontWeight.medium }
          ]}>
            {formatCurrency(item.amount)}
          </Text>
        </View>

        {/* Urgency Column */}
        <View style={[tableStyles.tableCell, tableStyles.typeCell]}>
          <View style={[tableStyles.statusBadge, { backgroundColor: getUrgencyColor(item.urgency) + '20' }]}>
            <Text style={[tableStyles.statusText, { color: getUrgencyColor(item.urgency) }]}>
              {urgencyLevels.find(l => l.id === item.urgency)?.name || item.urgency}
            </Text>
          </View>
        </View>

        {/* Requester Column */}
        <View style={[tableStyles.tableCell, tableStyles.typeCell]}>
          <Text style={tableStyles.tableCellText} numberOfLines={1}>
            {getRequesterDisplayName(item)}
          </Text>
        </View>

        {/* Date Column */}
        <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
          <Text style={tableStyles.tableCellText}>
            {formatDate(item.createdAt || item.created_at)}
          </Text>
        </View>

        {/* Votes Column */}
        <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
          <Text style={tableStyles.tableCellText}>
            {item.votes?.yes || item.votes_for || 0}/{item.votes?.no || item.votes_against || 0}
          </Text>
        </View>

        {/* Actions Column */}
        <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
          <TouchableOpacity
            style={[tableStyles.actionButton, { backgroundColor: colors.primary + '20' }]}
            onPress={() => {
              setSelectedTableItem(item);
              setShowActionModal(true);
            }}
          >
            <Ionicons
              name="ellipsis-vertical"
              size={12}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };



  const renderTableRow = ({ item, index }) => {
    const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;

    return (
      <View style={[tableStyles.tableRow, { backgroundColor: rowBackgroundColor }]}>
        {/* Name/Beneficiary Column */}
        <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
          <View style={tableStyles.nameContainer}>
            <View style={[tableStyles.typeIcon, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
              <Ionicons
                name={getCategoryIcon(item.category)}
                size={12}
                color={getCategoryColor(item.category)}
              />
            </View>
            <Text style={[tableStyles.tableCellText, tableStyles.nameText]} numberOfLines={1}>
              {getBeneficiaryDisplayName(item)}
            </Text>
          </View>
        </View>

        {/* Title Column */}
        <View style={[tableStyles.tableCell, { flex: 2 }]}>
          <Text style={tableStyles.tableCellText} numberOfLines={1}>
            {item.title.length > 5 ? item.title.substring(0, 5) + '...' : item.title}
          </Text>
        </View>

        {/* Amount Needed Column */}
        <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
          <Text style={[
            tableStyles.tableCellText,
            { color: colors.primary, fontWeight: typography.fontWeight.medium }
          ]}>
            {formatCurrency(item.amount)}
          </Text>
        </View>

        {/* Amount Raised Column */}
        <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
          <Text style={[
            tableStyles.tableCellText,
            { color: colors.success, fontWeight: typography.fontWeight.medium }
          ]}>
            {formatCurrency(item.totalContributions || 0)}
          </Text>
        </View>

        {/* Progress Column */}
        <View style={[tableStyles.tableCell, tableStyles.typeCell]}>
          <View style={[tableStyles.statusBadge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[tableStyles.statusText, { color: colors.primary }]}>
              {Math.min(Math.round(((item.totalContributions || 0) / item.amount) * 100), 100)}%
            </Text>
          </View>
        </View>

        {/* Actions Column */}
        <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
          <TouchableOpacity
            style={[tableStyles.actionButton, { backgroundColor: colors.primary + '20' }]}
            onPress={() => {
              setSelectedTableItem(item);
              setShowActionModal(true);
            }}
          >
            <Ionicons
              name="ellipsis-vertical"
              size={12}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderWelfareContribution = (request) => (
    <Card key={request.id} style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestInfo}>
          <View style={styles.categoryBadge}>
            <Ionicons
              name={welfareCategories.find(c => c.id === request.category)?.icon || 'help-circle'}
              size={16}
              color={colors.primary}
            />
            <Text style={[styles.categoryText, { color: colors.primary }]}>
              {welfareCategories.find(c => c.id === request.category)?.name || request.category}
            </Text>
          </View>

          <Text style={[styles.requestTitle, { color: colors.text }]}>
            {request.title}
          </Text>

          <Text style={[styles.requestAmount, { color: colors.success }]}>
            {formatCurrency(request.amount)} needed
          </Text>

          <View style={styles.beneficiaryInfo}>
            <Text style={[styles.beneficiaryLabel, { color: colors.textSecondary }]}>
              Support for:
            </Text>
            <Text style={[styles.beneficiaryName, { color: colors.text }]}>
              {getBeneficiaryDisplayName(request)}
            </Text>
          </View>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: colors.success + '20' }]}>
          <Text style={[styles.statusText, { color: colors.success }]}>
            APPROVED
          </Text>
        </View>
      </View>

      <Text style={[styles.requestDescription, { color: colors.textSecondary }]}>
        {request.description}
      </Text>

      <View style={styles.contributionProgress}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
            Contribution Progress
          </Text>
          <Text style={[styles.progressAmount, { color: colors.text }]}>
            {formatCurrency(request.totalContributions || 0)} / {formatCurrency(request.amount)}
          </Text>
        </View>

        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                width: `${Math.min(((request.totalContributions || 0) / request.amount) * 100, 100)}%`
              }
            ]}
          />
        </View>

        {/* Real-time Progress Info */}
        <View style={styles.progressDetails}>
          <View style={styles.progressDetailRow}>
            <View style={styles.progressDetailItem}>
              <Text style={[styles.progressDetailLabel, { color: colors.textSecondary }]}>
                Remaining
              </Text>
              {(request.totalContributions || 0) >= request.amount ? (
                <Text style={[styles.progressDetailValue, { color: colors.success }]}>
                  ✓ Fully Funded
                </Text>
              ) : (
                <Text style={[styles.progressDetailValue, { color: colors.error }]}>
                  {formatCurrency(Math.max(0, request.amount - (request.totalContributions || 0)))}
                </Text>
              )}
            </View>
            <View style={styles.progressDetailItem}>
              <Text style={[styles.progressDetailLabel, { color: colors.textSecondary }]}>
                Progress
              </Text>
              <Text style={[styles.progressDetailValue, { color: colors.primary }]}>
                {Math.min(Math.round(((request.totalContributions || 0) / request.amount) * 100), 100)}%
              </Text>
            </View>
            <View style={styles.progressDetailItem}>
              <Text style={[styles.progressDetailLabel, { color: colors.textSecondary }]}>
                Contributors
              </Text>
              <Text style={[styles.progressDetailValue, { color: colors.text }]}>
                {request.contributionCount || 0}
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.progressPercentage, { color: colors.textSecondary }]}>
          {Math.round(((request.totalContributions || 0) / request.amount) * 100)}% funded
        </Text>
      </View>

      <View style={styles.requestActions}>
        <Button
          title="Contribute"
          onPress={() => navigation.navigate('ContributeScreen', {
            chamaId: chamaId,
            contributionType: 'welfare',
            proposalId: request.id,
            proposalTitle: request.title,
            requestedAmount: request.amount
          })}
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          textStyle={{ color: colors.white }}
          icon={<Ionicons name="wallet" size={16} color={colors.white} />}
        />

        <Button
          title="Contribute"
          onPress={() => navigation.navigate('ContributeScreen', {
            chamaId: chamaId,
            contributionType: 'welfare',
            proposalId: request.id,
            proposalTitle: request.title,
            requestedAmount: request.amount
          })}
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          textStyle={{ color: colors.white }}
          icon={<Ionicons name="wallet" size={16} color={colors.white} />}
        />
      </View>
    </Card>
  );

  const renderWelfareRequest = (request) => (
    <Card key={request.id} style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestInfo}>
          <View style={styles.categoryBadge}>
            <Ionicons
              name={getCategoryIcon(request.category)}
              size={16}
              color={getCategoryColor(request.category)}
            />
            <Text style={[styles.categoryText, { color: getCategoryColor(request.category) }]}>
              {welfareCategories.find(c => c.id === request.category)?.name}
            </Text>
          </View>

          <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(request.urgency) + '20' }]}>
            <Text style={[styles.urgencyText, { color: getUrgencyColor(request.urgency) }]}>
              {urgencyLevels.find(l => l.id === request.urgency)?.name} Priority
            </Text>
          </View>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
          </Text>
        </View>
      </View>

      <Text style={[styles.requestTitle, { color: colors.text }]}>
        {request.title}
      </Text>

      <Text style={[styles.requestDescription, { color: colors.textSecondary }]}>
        {request.description}
      </Text>

      <View style={styles.requestDetails}>
        <View style={styles.amountContainer}>
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
            Amount Requested:
          </Text>
          <Text style={[styles.amountValue, { color: colors.primary }]}>
            {formatCurrency(request.amount)}
          </Text>
        </View>

        <View style={styles.requesterInfo}>
          <Text style={[styles.requesterLabel, { color: colors.textSecondary }]}>
            Requested by:
          </Text>
          <Text style={[styles.requesterName, { color: colors.text }]}>
            {getRequesterDisplayName(request)}
          </Text>
        </View>

        {/* Always show beneficiary information */}
        <View style={styles.beneficiaryInfo}>
          <Text style={[styles.beneficiaryLabel, { color: colors.textSecondary }]}>
            Support for:
          </Text>
          <Text style={[styles.beneficiaryName, { color: colors.primary }]}>
            {getBeneficiaryDisplayName(request)}
          </Text>
        </View>
      </View>

      {/* Voting Section for Pending Requests */}
      {request.status === 'pending' && (
        <View style={styles.votingSection}>
          <Text style={[styles.votingTitle, { color: colors.text }]}>
            members' votes
          </Text>

          <View style={styles.votingStats}>
            <View style={styles.voteStatItem}>
              <Ionicons name="thumbs-up" size={16} color={colors.success} />
              <Text style={[styles.voteStatText, { color: colors.success }]}>
                {request.votes?.yes || request.votes_for || 0} Support
              </Text>
            </View>
            <View style={styles.voteStatItem}>
              <Ionicons name="thumbs-down" size={16} color={colors.error} />
              <Text style={[styles.voteStatText, { color: colors.error }]}>
                {request.votes?.no || request.votes_against || 0} Oppose
              </Text>
            </View>
            <View style={styles.voteStatItem}>
              <Ionicons name="people" size={16} color={colors.textSecondary} />
              <Text style={[styles.voteStatText, { color: colors.textSecondary }]}>
                {request.votes?.total || request.total_votes || 0} Total
              </Text>
            </View>
          </View>

          {/* Voting Buttons - Only show if user hasn't voted */}
          {!request.userVote && (
            <View style={styles.votingButtons}>
              <Button
                title="Support"
                variant="outline"
                size="small"
                onPress={() => handleVote(request.id, 'for')}
                style={[styles.voteButton, { borderColor: colors.success }]}
                textStyle={{ color: colors.success }}
                icon={votingInProgress[request.id] ?
                  <ActivityIndicator size={16} color={colors.success} /> :
                  <Ionicons name="thumbs-up" size={16} color={colors.success} />
                }
                disabled={votingInProgress[request.id]}
              />

              <Button
                title="Oppose"
                variant="outline"
                size="small"
                onPress={() => handleVote(request.id, 'against')}
                style={[styles.voteButton, { borderColor: colors.error }]}
                textStyle={{ color: colors.error }}
                icon={votingInProgress[request.id] ?
                  <ActivityIndicator size={16} color={colors.error} /> :
                  <Ionicons name="thumbs-down" size={16} color={colors.error} />
                }
                disabled={votingInProgress[request.id]}
              />
            </View>
          )}

          {/* User Vote Status */}
          {request.userVote && (
            <View style={[
              styles.userVoteStatus,
              {
                backgroundColor: request.userVote === 'yes'
                  ? colors.success + '20'
                  : colors.error + '20'
              }
            ]}>
              {/* <Ionicons
                name={request.userVote === 'yes' ? 'thumbs-up' : 'thumbs-down'}
                size={16}
                color={request.userVote === 'yes' ? colors.success : colors.error}
              /> */}
              {/* <Text style={[
                styles.userVoteText,
                {
                  color: request.userVote === 'yes' ? colors.success : colors.error
                }
              ]}>
                You voted {request.userVote === 'yes' ? 'in support' : 'against'} this proposal
              </Text> */}
            </View>
          )}
        </View>
      )}

      {/* Contribution Section for Approved Requests */}
      {request.status === 'approved' && (
        <View style={styles.contributionSection}>
          <Text style={[styles.contributionTitle, { color: colors.success }]}>
            ✅ Approved by Community
          </Text>
          <Text style={[styles.contributionSubtitle, { color: colors.textSecondary }]}>
            This welfare request has been approved. You can now contribute to support this cause.
          </Text>

          <Button
            title="Contribute Now"
            onPress={() => {
              if (navigation) {
                navigation.navigate('ContributeScreen', {
                  chamaId: chamaId,
                  contributionType: 'welfare',
                  proposalId: request.id,
                  proposalTitle: request.title,
                  requestedAmount: request.amount
                });
              }
            }}
            style={[styles.contributeButton, { backgroundColor: colors.primary }]}
            icon={<Ionicons name="wallet" size={18} color={colors.white} />}
          />
        </View>
      )}
    </Card>
  );

  // Show error state if no chama is selected
  if (!chamaId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContainer}>
          <Ionicons name="business" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No Chama Selected
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Please select a chama from the dashboard to view welfare
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backButtonText, { color: colors.white }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tab Navigation */}
      <View style={[styles.tabContainer, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'requests' && { ...styles.activeTab, borderBottomColor: colors.primary }
          ]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'requests' ? colors.primary : colors.textSecondary }
          ]}>
            Welfare Requests
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'contributions' && { ...styles.activeTab, borderBottomColor: colors.primary }
          ]}
          onPress={() => setActiveTab('contributions')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'contributions' ? colors.primary : colors.textSecondary }
          ]}>
            Contributions
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {activeTab === 'requests' ? (
            <>
              {/* Table Container */}
              <View style={tableStyles.tableContainer}>
                {/* Table Header */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <View style={tableStyles.tableHeader}>
                      <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
                        <Text style={[tableStyles.tableHeaderText, { textAlign: 'left' }]}>Title</Text>
                      </View>
                      <View style={[tableStyles.tableCell, tableStyles.typeCell]}>
                        <Text style={tableStyles.tableHeaderText}>Category</Text>
                      </View>
                      <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
                        <Text style={tableStyles.tableHeaderText}>Amount</Text>
                      </View>
                      <View style={[tableStyles.tableCell, tableStyles.typeCell]}>
                        <Text style={tableStyles.tableHeaderText}>Priority</Text>
                      </View>
                      <View style={[tableStyles.tableCell, tableStyles.typeCell]}>
                        <Text style={tableStyles.tableHeaderText}>Requester</Text>
                      </View>
                      <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
                        <Text style={tableStyles.tableHeaderText}>Date</Text>
                      </View>
                      <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
                        <Text style={tableStyles.tableHeaderText}>Votes</Text>
                      </View>
                      <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
                        <Text style={tableStyles.tableHeaderText}>Actions</Text>
                      </View>
                    </View>

                    {/* Table Body */}
                    {welfareRequests.map((item, index) => (
                      <View key={item.id}>
                        {renderWelfareRequestTableRow({ item, index })}
                      </View>
                    ))}
                  </View>
                </ScrollView>

                {welfareRequests.length === 0 && !loading && (
                  <View style={styles.emptyState}>
                    <Ionicons name="heart-outline" size={64} color={colors.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                      No welfare requests
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                      Be the first to create a welfare request for your community
                    </Text>
                  </View>
                )}

                {/* Pagination */}
                {welfareRequests.length > itemsPerPage && (
                  <View style={styles.pagination}>
                    <TouchableOpacity
                      style={[
                        styles.pageButton,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                        requestsCurrentPage === 1 && styles.pageButtonDisabled
                      ]}
                      onPress={() => requestsCurrentPage > 1 && setRequestsCurrentPage(requestsCurrentPage - 1)}
                      disabled={requestsCurrentPage === 1}
                    >
                      <Ionicons name="chevron-back" size={16} color={requestsCurrentPage === 1 ? colors.textSecondary : colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.pageText, { color: colors.text }]}>
                      {requestsCurrentPage} of {Math.ceil(welfareRequests.length / itemsPerPage)}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.pageButton,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                        requestsCurrentPage === Math.ceil(welfareRequests.length / itemsPerPage) && styles.pageButtonDisabled
                      ]}
                      onPress={() => requestsCurrentPage < Math.ceil(welfareRequests.length / itemsPerPage) && setRequestsCurrentPage(requestsCurrentPage + 1)}
                      disabled={requestsCurrentPage === Math.ceil(welfareRequests.length / itemsPerPage)}
                    >
                      <Ionicons name="chevron-forward" size={16} color={requestsCurrentPage === Math.ceil(welfareRequests.length / itemsPerPage) ? colors.textSecondary : colors.text} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          ) : (
            <>
              {/* Table Container */}
              <View style={tableStyles.tableContainer}>
                {/* Table Header */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <View style={tableStyles.tableHeader}>
                      <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
                        <Text style={[tableStyles.tableHeaderText, { textAlign: 'left' }]}>Beneficiary</Text>
                      </View>
                      <View style={[tableStyles.tableCell, { flex: 2 }]}>
                        <Text style={tableStyles.tableHeaderText}>Title</Text>
                      </View>
                      <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
                        <Text style={tableStyles.tableHeaderText}>Needed</Text>
                      </View>
                      <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
                        <Text style={tableStyles.tableHeaderText}>Raised</Text>
                      </View>
                      <View style={[tableStyles.tableCell, tableStyles.typeCell]}>
                        <Text style={tableStyles.tableHeaderText}>Progress</Text>
                      </View>
                      <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
                        <Text style={tableStyles.tableHeaderText}>Actions</Text>
                      </View>
                    </View>

                    {/* Table Body */}
                    {welfareContributions.map((item, index) => (
                      <View key={item.id}>
                        {renderTableRow({ item, index })}
                      </View>
                    ))}
                  </View>
                </ScrollView>

                {welfareContributions.length === 0 && !loading && (
                  <View style={styles.emptyState}>
                    <Ionicons name="wallet-outline" size={64} color={colors.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                      No approved welfare requests
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                      Approved welfare requests will appear here for contributions
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => setShowCreateModal(true)}
      >
        <Ionicons name="add" size={24} color={colors.white} />
      </TouchableOpacity>

      {/* Create Welfare Request Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Create Welfare Request
              </Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Input
                  label="Title *"
                  value={newRequest.title}
                  onChangeText={(text) => {
                    setNewRequest(prev => ({ ...prev, title: text }));
                    clearFieldError('title');
                  }}
                  placeholder="Brief description of your request"
                  style={formErrors.title ? styles.inputError : null}
                />
                <ErrorText error={formErrors.title} />
              </View>

              <View style={styles.inputContainer}>
                <Input
                  label="Description *"
                  value={newRequest.description}
                  onChangeText={(text) => {
                    setNewRequest(prev => ({ ...prev, description: text }));
                    clearFieldError('description');
                  }}
                  placeholder="Detailed explanation of your situation..."
                  multiline
                  numberOfLines={4}
                  style={formErrors.description ? styles.inputError : null}
                />
                <ErrorText error={formErrors.description} />
              </View>

              <View style={styles.inputContainer}>
                <Input
                  label="Amount Needed (KES) *"
                  value={newRequest.amount}
                  onChangeText={(text) => {
                    setNewRequest(prev => ({ ...prev, amount: text }));
                    clearFieldError('amount');
                  }}
                  placeholder="Enter amount (e.g., 5000)"
                  keyboardType="numeric"
                />
                <ErrorText error={formErrors.amount} />
              </View>

              <Text style={[styles.sectionTitle, { color: colors.text }]}>Who is this support for?</Text>
              <View style={[
                styles.beneficiarySection,
                formErrors.beneficiaries ? styles.sectionError : null
              ]}>
                <TouchableOpacity
                  style={[
                    styles.beneficiaryOption,
                    {
                      backgroundColor: newRequest.beneficiaryIds.length === 0 ? colors.primary + '20' : colors.background,
                      borderColor: newRequest.beneficiaryIds.length === 0 ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => clearAllBeneficiaries()}
                >
                  <Ionicons
                    name="person"
                    size={20}
                    color={newRequest.beneficiaryIds.length === 0 ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[
                    styles.beneficiaryOptionText,
                    { color: newRequest.beneficiaryIds.length === 0 ? colors.primary : colors.text }
                  ]}>
                    For myself
                  </Text>
                </TouchableOpacity>

                {getSelectedBeneficiaries().map(member => (
                  <View key={member.id} style={styles.selectedBeneficiary}>
                    <View style={styles.beneficiaryInfo}>
                      <View style={[styles.beneficiaryAvatar, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.beneficiaryAvatarText, { color: colors.white }]}>
                          {member.first_name?.charAt(0) || member.name?.charAt(0) || '?'}
                        </Text>
                      </View>
                      <View style={styles.beneficiaryDetails}>
                        <Text style={[styles.beneficiaryName, { color: colors.text }]}>
                          {member.first_name} {member.last_name}
                        </Text>
                        <Text style={[styles.beneficiaryRole, { color: colors.textSecondary }]}>
                          {member.role || 'Member'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeBeneficiary(member.id)}
                      style={styles.removeBeneficiaryButton}
                    >
                      <Ionicons name="close" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.addBeneficiaryButton, { borderColor: colors.primary }]}
                  onPress={() => setShowBeneficiaryPicker(true)}
                >
                  <Ionicons name="add" size={20} color={colors.primary} />
                  <Text style={[styles.addBeneficiaryText, { color: colors.primary }]}>
                    Add Beneficiary
                  </Text>
                </TouchableOpacity>
              </View>
              <ErrorText error={formErrors.beneficiaries} />

              <View style={styles.categorySection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Category *</Text>
                <View style={styles.categoryOptions}>
                  {welfareCategories.map(category => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryOption,
                        {
                          backgroundColor: newRequest.category === category.id ? category.color + '20' : colors.background,
                          borderColor: newRequest.category === category.id ? category.color : colors.border,
                        }
                      ]}
                      onPress={() => {
                        setNewRequest(prev => ({ ...prev, category: category.id }));
                        clearFieldError('category');
                      }}
                    >
                      <Ionicons name={category.icon} size={20} color={newRequest.category === category.id ? category.color : colors.textSecondary} />
                      <Text style={[
                        styles.categoryOptionText,
                        { color: newRequest.category === category.id ? category.color : colors.text }
                      ]}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <ErrorText error={formErrors.category} />
              </View>

              <View style={styles.urgencySection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Priority Level *</Text>
                <View style={styles.urgencyOptions}>
                  {urgencyLevels.map(level => (
                    <TouchableOpacity
                      key={level.id}
                      style={[
                        styles.urgencyOption,
                        {
                          backgroundColor: newRequest.urgency === level.id ? level.color + '20' : colors.background,
                          borderColor: newRequest.urgency === level.id ? level.color : colors.border,
                        }
                      ]}
                      onPress={() => {
                        setNewRequest(prev => ({ ...prev, urgency: level.id }));
                        clearFieldError('urgency');
                      }}
                    >
                      <Text style={[
                        styles.urgencyOptionText,
                        { color: newRequest.urgency === level.id ? level.color : colors.text }
                      ]}>
                        {level.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <ErrorText error={formErrors.urgency} />
              </View>

              {Object.keys(formErrors).length > 0 && (
                <View style={styles.errorSummary}>
                  <View style={styles.errorSummaryHeader}>
                    <Ionicons name="warning" size={20} color={colors.error} />
                    <Text style={[styles.errorSummaryTitle, { color: colors.error }]}>
                      Please fix the following errors:
                    </Text>
                  </View>
                  {Object.entries(formErrors).map(([field, error]) => (
                    <Text key={field} style={[styles.errorSummaryItem, { color: colors.error }]}>
                      • {error}
                    </Text>
                  ))}
                </View>
              )}

              <Button
                title="Submit Request"
                onPress={handleCreateRequest}
                style={[
                  styles.submitButton,
                  Object.keys(formErrors).length > 0 ? styles.submitButtonDisabled : null
                ]}
                textStyle={Object.keys(formErrors).length > 0 ? styles.submitButtonTextDisabled : null}
                icon={<Ionicons name="send" size={20} color={colors.white} />}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Beneficiary Picker Modal */}
      <Modal
        visible={showBeneficiaryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBeneficiaryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Select Beneficiaries
              </Text>
              <TouchableOpacity onPress={() => setShowBeneficiaryPicker(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search members..."
                placeholderTextColor={colors.textSecondary}
                value={beneficiarySearch}
                onChangeText={handleBeneficiarySearch}
              />
            </View>

            <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
              {loadingMembers ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                    Loading members...
                  </Text>
                </View>
              ) : filteredMembers.length === 0 ? (
                <View style={styles.emptyMembers}>
                  <Ionicons name="people" size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyMembersText, { color: colors.textSecondary }]}>
                    {beneficiarySearch ? 'No members found' : 'No eligible members'}
                  </Text>
                  <Text style={[styles.emptyMembersSubtext, { color: colors.textSecondary }]}>
                    {beneficiarySearch ? 'Try a different search term' : 'All members are already selected'}
                  </Text>
                </View>
              ) : (
                filteredMembers.map(member => {
                  const isSelected = newRequest.beneficiaryIds.includes(member.id);
                  return (
                    <TouchableOpacity
                      key={member.id}
                      style={[
                        styles.memberOption,
                        isSelected && { backgroundColor: colors.primary + '10' }
                      ]}
                      onPress={() => toggleBeneficiary(member)}
                    >
                      <View style={styles.memberInfo}>
                        <View style={[styles.memberAvatar, { backgroundColor: isSelected ? colors.primary : colors.surface }]}>
                          <Text style={[styles.memberAvatarText, { color: isSelected ? colors.white : colors.text }]}>
                            {member.first_name?.charAt(0) || member.name?.charAt(0) || '?'}
                          </Text>
                        </View>
                        <View style={styles.memberDetails}>
                          <Text style={[styles.memberName, { color: colors.text }]}>
                            {member.first_name} {member.last_name}
                          </Text>
                          <Text style={[styles.memberEmail, { color: colors.textSecondary }]}>
                            {member.email}
                          </Text>
                          <Text style={[styles.memberRole, { color: colors.textSecondary }]}>
                            {member.role || 'Member'}
                          </Text>
                        </View>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* View Details Modal */}
      <Modal
        visible={showViewModal && viewModalItem !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowViewModal(false)}
      >
        <View style={styles.viewModalOverlay}>
          <View style={[styles.viewModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.viewModalHeader}>
              <Text style={[styles.viewModalTitle, { color: colors.text }]}>
                {activeTab === 'requests' ? 'Welfare Request Details' : 'Contribution Details'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowViewModal(false)}
                style={styles.viewModalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.viewModalBody} showsVerticalScrollIndicator={false}>
              {viewModalItem && (
                <View style={styles.viewModalItem}>
                  <View style={styles.viewModalSection}>
                    <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                      Title
                    </Text>
                    <Text style={[styles.viewModalSectionContent, { color: colors.textSecondary }]}>
                      {viewModalItem.title}
                    </Text>
                  </View>

                  <View style={styles.viewModalSection}>
                    <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                      Description
                    </Text>
                    <Text style={[styles.viewModalSectionContent, { color: colors.textSecondary }]}>
                      {viewModalItem.description.length > 100
                        ? viewModalItem.description.substring(0, 100) + '...'
                        : viewModalItem.description
                      }
                    </Text>
                  </View>

                  {activeTab === 'requests' ? (
                    <>
                      <View style={styles.viewModalRow}>
                        <View style={styles.viewModalHalf}>
                          <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                            Category
                          </Text>
                          <Text style={[styles.viewModalSectionContent, { color: colors.textSecondary }]}>
                            {welfareCategories.find(c => c.id === viewModalItem.category)?.name || viewModalItem.category}
                          </Text>
                        </View>
                        <View style={styles.viewModalHalf}>
                          <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                            Priority
                          </Text>
                          <Text style={[styles.viewModalSectionContent, { color: colors.textSecondary }]}>
                            {urgencyLevels.find(l => l.id === viewModalItem.urgency)?.name || viewModalItem.urgency}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.viewModalRow}>
                        <View style={styles.viewModalHalf}>
                          <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                            Amount Needed
                          </Text>
                          <Text style={[styles.viewModalSectionContent, { color: colors.primary }]}>
                            {formatCurrency(viewModalItem.amount)}
                          </Text>
                        </View>
                        <View style={styles.viewModalHalf}>
                          <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                            Votes
                          </Text>
                          <Text style={[styles.viewModalSectionContent, { color: colors.textSecondary }]}>
                            {viewModalItem.votes?.yes || viewModalItem.votes_for || 0} / {viewModalItem.votes?.no || viewModalItem.votes_against || 0}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.viewModalSection}>
                        <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                          Requester
                        </Text>
                        <Text style={[styles.viewModalSectionContent, { color: colors.textSecondary }]}>
                          {getRequesterDisplayName(viewModalItem)}
                        </Text>
                      </View>

                      <View style={styles.viewModalSection}>
                        <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                          Date Created
                        </Text>
                        <Text style={[styles.viewModalSectionContent, { color: colors.textSecondary }]}>
                          {formatDate(viewModalItem.createdAt || viewModalItem.created_at)}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.viewModalRow}>
                        <View style={styles.viewModalHalf}>
                          <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                            Amount Needed
                          </Text>
                          <Text style={[styles.viewModalSectionContent, { color: colors.primary }]}>
                            {formatCurrency(viewModalItem.amount)}
                          </Text>
                        </View>
                        <View style={styles.viewModalHalf}>
                          <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                            Amount Raised
                          </Text>
                          <Text style={[styles.viewModalSectionContent, { color: colors.success }]}>
                            {formatCurrency(viewModalItem.totalContributions || 0)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.viewModalSection}>
                        <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                          Beneficiary
                        </Text>
                        <Text style={[styles.viewModalSectionContent, { color: colors.textSecondary }]}>
                          {getBeneficiaryDisplayName(viewModalItem)}
                        </Text>
                      </View>

                      <View style={styles.viewModalSection}>
                        <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                          Progress
                        </Text>
                        <Text style={[styles.viewModalSectionContent, { color: colors.textSecondary }]}>
                          {Math.min(Math.round(((viewModalItem.totalContributions || 0) / viewModalItem.amount) * 100), 100)}% funded
                        </Text>
                      </View>

                      <View style={styles.viewModalSection}>
                        <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                          Contributors
                        </Text>
                        <Text style={[styles.viewModalSectionContent, { color: colors.textSecondary }]}>
                          {viewModalItem.contributionCount || 0} people
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>



      {/* Action Modal */}
      <Modal
        visible={showActionModal && selectedTableItem !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowActionModal(false)}
      >
        <TouchableOpacity
          style={styles.actionModalOverlay}
          activeOpacity={1}
          onPress={() => setShowActionModal(false)}
        >
          <View style={[styles.actionModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.actionModalHeader}>
              <Text style={[styles.actionModalTitle, { color: colors.text }]}>
                Actions for {selectedTableItem?.title || 'Request'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowActionModal(false)}
                style={styles.actionModalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.actionModalBody}>
              {activeTab === 'contributions' ? (
                // Actions for approved contributions
                <>
                  <TouchableOpacity
                    style={[styles.actionModalButton, { backgroundColor: colors.info + '10' }]}
                    onPress={() => {
                      setShowActionModal(false);
                      navigation.navigate('WelfareContributions', { welfareRequestId: selectedTableItem.id, chamaId });
                    }}
                  >
                    <Ionicons name="list" size={18} color={colors.info} />
                    <View style={styles.actionModalButtonText}>
                      <Text style={[styles.actionModalButtonTitle, { color: colors.info }]}>
                        View Contributions
                      </Text>
                      <Text style={[styles.actionModalButtonSubtitle, { color: colors.textSecondary }]}>
                        See all contributions to this request
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionModalButton, { backgroundColor: colors.success + '10' }]}
                    onPress={() => {
                      setShowActionModal(false);
                      navigation.navigate('ContributeScreen', {
                        chamaId: chamaId,
                        contributionType: 'welfare',
                        proposalId: selectedTableItem.id,
                        proposalTitle: selectedTableItem.title,
                        requestedAmount: selectedTableItem.amount
                      });
                    }}
                  >
                    <Ionicons name="wallet" size={18} color={colors.success} />
                    <View style={styles.actionModalButtonText}>
                      <Text style={[styles.actionModalButtonTitle, { color: colors.success }]}>
                        Go to Contribute
                      </Text>
                      <Text style={[styles.actionModalButtonSubtitle, { color: colors.textSecondary }]}>
                        Make a contribution to this request
                      </Text>
                    </View>
                  </TouchableOpacity>


                </>
              ) : (
                // Actions for pending requests
                <>
                  {selectedTableItem && !selectedTableItem.userVote && (
                    <TouchableOpacity
                      style={[styles.actionModalButton, { backgroundColor: colors.success + '10' }]}
                      onPress={() => {
                        setShowActionModal(false);
                        handleVote(selectedTableItem.id, 'for');
                      }}
                    >
                      <Ionicons name="thumbs-up" size={18} color={colors.success} />
                      <View style={styles.actionModalButtonText}>
                        <Text style={[styles.actionModalButtonTitle, { color: colors.success }]}>
                          Support
                        </Text>
                        <Text style={[styles.actionModalButtonSubtitle, { color: colors.textSecondary }]}>
                          Vote in favor of this request
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {selectedTableItem && !selectedTableItem.userVote && (
                    <TouchableOpacity
                      style={[styles.actionModalButton, { backgroundColor: colors.error + '10' }]}
                      onPress={() => {
                        setShowActionModal(false);
                        handleVote(selectedTableItem.id, 'against');
                      }}
                    >
                      <Ionicons name="thumbs-down" size={18} color={colors.error} />
                      <View style={styles.actionModalButtonText}>
                        <Text style={[styles.actionModalButtonTitle, { color: colors.error }]}>
                          Oppose
                        </Text>
                        <Text style={[styles.actionModalButtonSubtitle, { color: colors.textSecondary }]}>
                          Vote against this request
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {selectedTableItem && (
                    <TouchableOpacity
                      style={[styles.actionModalButton, { backgroundColor: colors.info + '10' }]}
                      onPress={() => {
                        setShowActionModal(false);
                        setViewModalItem(selectedTableItem);
                        setShowViewModal(true);
                      }}
                    >
                      <Ionicons name="information-circle" size={18} color={colors.info} />
                      <View style={styles.actionModalButtonText}>
                        <Text style={[styles.actionModalButtonTitle, { color: colors.info }]}>
                          View Details
                        </Text>
                        <Text style={[styles.actionModalButtonSubtitle, { color: colors.textSecondary }]}>
                          See full request information
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  requestCard: {
    marginBottom: spacing.md,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  requestInfo: {
    flex: 1,
    gap: spacing.sm,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  categoryText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  urgencyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  urgencyText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  requestTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  requestDescription: {
    fontSize: typography.fontSize.base,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  requestDetails: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  amountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: typography.fontSize.sm,
  },
  amountValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  requesterInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requesterLabel: {
    fontSize: typography.fontSize.sm,
  },
  requesterName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  beneficiaryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  beneficiaryLabel: {
    fontSize: typography.fontSize.sm,
  },
  beneficiaryName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  votingSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: spacing.md,
  },
  votingTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  votingStats: {
    marginBottom: spacing.md,
  },
  votingText: {
    fontSize: typography.fontSize.sm,
  },
  votingButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  voteButton: {
    flex: 1,
  },
  voteStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  voteStatText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  userVoteStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  userVoteText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
  },
  contributionSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  contributionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  contributionSubtitle: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  contributeButton: {
    alignSelf: 'stretch',
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
    maxWidth: 500,
    alignSelf: 'center',
    width: '95%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  selectionIndicator: {
    marginLeft: spacing.sm,
  },
  modalBody: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.xs,
    minWidth: '45%',
  },
  categoryOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  urgencyGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  urgencyOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  urgencyOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  beneficiarySection: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  beneficiaryOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  beneficiaryOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  beneficiaryOptionContent: {
    flex: 1,
  },
  beneficiaryCount: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  selectedBeneficiariesContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    padding: spacing.md,
  },
  selectedBeneficiariesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  selectedBeneficiariesTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  clearAllButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  clearAllText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  selectedBeneficiariesList: {
    gap: spacing.sm,
  },
  selectedBeneficiaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.sm,
  },
  beneficiaryAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  beneficiaryAvatarText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  selectedBeneficiaryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  selectedBeneficiaryDetails: {
    flex: 1,
  },
  selectedBeneficiaryLabel: {
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.xs,
  },
  selectedBeneficiaryName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  selectedBeneficiaryEmail: {
    fontSize: typography.fontSize.sm,
  },
  removeBeneficiaryButton: {
    padding: spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    paddingVertical: spacing.sm,
  },
  membersList: {
    maxHeight: 400,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    gap: spacing.md,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  memberEmail: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  memberRole: {
    fontSize: typography.fontSize.xs,
    textTransform: 'capitalize',
  },
  emptyMembers: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.md,
  },
  emptyMembersText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  emptyMembersSubtext: {
    fontSize: typography.fontSize.sm,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  // Removed red border styling
  errorText: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
  },
  // Removed red border styling
  errorSummary: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.md,
  },
  errorSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  errorSummaryTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  errorSummaryItem: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.md,
    marginBottom: spacing.xs,
  },

  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
  submitButtonTextDisabled: {
    color: '#6B7280',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  beneficiaryInfo: {
    marginTop: spacing.sm,
  },
  beneficiaryLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  beneficiaryName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  contributionProgress: {
    marginVertical: spacing.md,
    padding: spacing.md,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: borderRadius.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  progressAmount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressDetails: {
    marginTop: spacing.sm,
  },
  progressDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressDetailItem: {
    flex: 1,
    alignItems: 'center',
  },
  progressDetailLabel: {
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.xs / 2,
  },
  progressDetailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  progressPercentage: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },

  contributionRequestTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  contributionRequestDescription: {
    fontSize: typography.fontSize.base,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  contributionProgressInfo: {
    gap: spacing.sm,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: typography.fontSize.sm,
  },
  progressValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  contributionSummary: {
    backgroundColor: 'rgba(34, 197, 94, 0.05)',
    borderRadius: borderRadius.md,
    padding: spacing.lg, // Increased padding
    marginVertical: spacing.lg, // Increased margin
    minHeight: 80, // Ensure minimum height
  },
  contributionSummaryTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md, // Increased margin
    lineHeight: 22, // Better line height
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm, // Increased margin
    minHeight: 24, // Ensure minimum height
    paddingVertical: spacing.xs, // Add vertical padding
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
    flex: 1,
    marginRight: spacing.sm, // Add margin to prevent overlap
    lineHeight: 18,
  },
  summaryValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'right',
    flexShrink: 0, // Prevent shrinking
    minWidth: 80, // Ensure minimum width
    lineHeight: 18,
  },
  selfContributionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  selfContributionText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
  // Error state styles
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  // Action Modal Styles
  actionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  actionModalContent: {
    width: '90%',
    maxWidth: 320,
    maxHeight: '50%',
    borderRadius: borderRadius.lg,
    paddingBottom: spacing.md,
  },
  actionModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  actionModalContent: {
    width: '100%',
    maxWidth: 350,
    maxHeight: '40%',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.lg,
  },
  actionModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  actionModalTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
    marginRight: spacing.sm,
  },
  actionModalCloseButton: {
    padding: spacing.xs,
  },
  actionModalBody: {
    flex: 1,
    padding: spacing.sm,
  },
  actionModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  actionModalButtonText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  actionModalButtonTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs / 4,
  },
  actionModalButtonSubtitle: {
    fontSize: typography.fontSize.xs,
  },
  // View Modal Styles
  viewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  viewModalContent: {
    width: '95%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: borderRadius.lg,
    ...shadows.lg,
  },
  viewModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  viewModalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
    marginRight: spacing.md,
  },
  viewModalCloseButton: {
    padding: spacing.xs,
  },
  viewModalBody: {
    padding: spacing.lg,
  },
  viewModalItem: {
    gap: spacing.md,
  },
  viewModalSection: {
    marginBottom: spacing.md,
  },
  viewModalSectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  viewModalSectionContent: {
    fontSize: typography.fontSize.base,
    lineHeight: 22,
  },
  viewModalRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  viewModalHalf: {
    flex: 1,
    marginRight: spacing.sm,
  },
  // Pagination Styles
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  pageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pageButtonDisabled: {
    opacity: 0.5,
  },
  pageText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginHorizontal: spacing.md,
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
});

export default WelfareScreen;
