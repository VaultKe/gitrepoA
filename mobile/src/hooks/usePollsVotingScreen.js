import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import ApiService from '../services/api';
import { useApp } from '../context/AppContext';
import {
  getMemberName,
  getMemberEmail,
  formatTableDate,
  getPollTypeColor,
  getStatusColor,
  getTotalVotesCast,
  getTotalEligibleVoters,
  getVotePercentage,
  isPollFullyVoted,
} from '../utils/pollsVotingHelpers';

const usePollsVotingScreen = ({ route, navigation, onCreateSuccess }) => {
  const { chamaId } = route.params;
  const { theme, user } = useApp();
  const colors = theme;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [polls, setPolls] = useState([]);
  const [votes, setVotes] = useState([]);
  const [chamaDetails, setChamaDetails] = useState(null);
  const [completedPolls, setCompletedPolls] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);
  const [userRole, setUserRole] = useState('member');
  const [chamaMembers, setChamaMembers] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showVisualizationModal, setShowVisualizationModal] = useState(false);
  const [selectedVisualizationPoll, setSelectedVisualizationPoll] = useState(null);
  const [autoRefreshEnabled] = useState(true);
  const [pollForm, setPollForm] = useState({
    title: '',
    description: '',
    type: 'general',
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    options: ['', ''],
    isAnonymous: true,
    requiresMajority: true,
    majorityPercentage: 50,
  });
  const [roleForm, setRoleForm] = useState({
    candidateIds: [],
    requestedRole: 'chairperson',
    justification: '',
    selectedCandidates: [],
  });
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [allPolls, setAllPolls] = useState([]);

  const isRefreshingRef = useRef(false);

  const normalizePolls = (items) => {
    if (!Array.isArray(items)) return [];
    return items.map((poll) => {
      const endsAt = poll.ends_at ? new Date(poll.ends_at).getTime() : null;
      const now = Date.now();
      let status = poll.status || 'active';
      if (status === 'active' && endsAt && endsAt < now) {
        status = 'completed';
      }
      const totalVotes = getTotalVotesCast(poll);
      const isFullyVoted = isPollFullyVoted(poll, chamaMembers);
      let timeRemaining = null;
      if (endsAt && status === 'active') {
        timeRemaining = Math.max(0, Math.floor((endsAt - now) / 1000));
      }
      return {
        ...poll,
        status,
        isFullyVoted,
        completionStatus: isFullyVoted ? 'All votes cast' : null,
        timeRemaining,
        totalVotes,
        userVoted: poll.user_voted === 1 || poll.user_voted === true,
        user_has_voted: poll.user_voted === 1 || poll.user_voted === true,
      };
    });
  };

  const loadPolls = useCallback(async () => {
    if (!chamaId || typeof chamaId !== 'string') {
      Alert.alert('Error', 'Invalid chama access. Please try again.');
      return;
    }

    try {
      const votesResponse = await ApiService.getChamaVotes(chamaId, 50, 0);

      const allItems = [];

      if (votesResponse?.success && Array.isArray(votesResponse?.data)) {
        allItems.push(...votesResponse.data);
      }

      const uniqueById = new Map();
      allItems.forEach((item) => {
        if (item && item.id) {
          uniqueById.set(item.id, item);
        }
      });

      const merged = Array.from(uniqueById.values());
      const normalized = normalizePolls(merged);

      const sorted = normalized.sort((a, b) => {
        const aActive = a.status === 'active';
        const bActive = b.status === 'active';
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        const aTime = a.ends_at ? new Date(a.ends_at).getTime() : 0;
        const bTime = b.ends_at ? new Date(b.ends_at).getTime() : 0;
        return aTime - bTime;
      });

      const activeItems = sorted.filter((item) => item.status === 'active');
      const completedItems = sorted.filter((item) => item.status === 'completed');

      setPolls(activeItems);
      setVotes(activeItems);
      setCompletedPolls(completedItems);
      setAllPolls(sorted);
      setLoadError(null);
    } catch (error) {
      setLoadError(error?.message || 'Failed to load polls and votes');
    }
  }, [chamaId, chamaMembers]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const interval = setInterval(loadPolls, 30000);
    return () => clearInterval(interval);
  }, [chamaId, autoRefreshEnabled, loadPolls]);

  useEffect(() => {
    if (showSuccessBanner) {
      const timer = setTimeout(() => {
        setShowSuccessBanner(false);
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessBanner]);

  const loadUserRole = async () => {
    try {
      const response = await ApiService.getMemberRole(chamaId, user.id);
      if (response.success) setUserRole(response.data?.role || 'member');
    } catch {
      setUserRole('member');
    }
  };

  const loadChamaMembers = async () => {
    try {
      const response = await ApiService.getChamaMembers(chamaId);
      if (response.success) {
        setChamaMembers(response.data || []);
        setFilteredMembers(response.data || []);
      }
    } catch {}
  };

  const loadChamaDetails = async () => {
    try {
      const response = await ApiService.getChamaById(chamaId);
      if (response.success) setChamaDetails(response.data);
    } catch {}
  };

  const loadData = async (isTabSwitch = false) => {
    try {
      if (!isTabSwitch) setLoading(true);
      setLoadError(null);
      await loadPolls();
      Promise.all([loadUserRole(), loadChamaMembers(), loadChamaDetails()]).catch(() => {});
    } catch (error) {
      setLoadError(error?.message || 'Failed to load polls and votes');
    } finally {
      if (!isTabSwitch) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (chamaId) loadData(false);
  }, [chamaId, activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setLoadError(null);
    await loadData(true);
    setRefreshing(false);
  }, [activeTab, chamaId]);

  const handleRetry = useCallback(async () => {
    setLoadError(null);
    setRetryCount(prev => prev + 1);
    await loadData(false);
  }, [chamaId, activeTab]);

  const getPaginatedCompletedPolls = () => {
    const startIndex = (currentPage - 1) * pageSize;
    return completedPolls.slice(startIndex, startIndex + pageSize);
  };

  const getTotalPages = () => Math.ceil(completedPolls.length / pageSize);

  const handlePageChange = (page) => setCurrentPage(page);

  const openVisualizationModal = (poll) => {
    setSelectedVisualizationPoll(poll);
    setShowVisualizationModal(true);
  };

  const closeVisualizationModal = () => {
    setShowVisualizationModal(false);
    setSelectedVisualizationPoll(null);
  };

  const resetPollForm = () => {
    setPollForm({
      title: '',
      description: '',
      type: 'general',
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      options: ['', ''],
      isAnonymous: true,
      requiresMajority: true,
      majorityPercentage: 50,
    });
    resetRoleForm();
    setMemberSearchQuery('');
    setFilteredMembers(chamaMembers);
  };

  const resetRoleForm = () => {
    setRoleForm({
      candidateIds: [],
      requestedRole: 'chairperson',
      justification: '',
      selectedCandidates: [],
    });
    setMemberSearchQuery('');
    setFilteredMembers(chamaMembers);
  };

  const handleMemberSearch = (query) => {
    setMemberSearchQuery(query);
    if (!query.trim()) {
      setFilteredMembers(chamaMembers);
      return;
    }
    const filtered = chamaMembers.filter((member) => {
      const fullName = getMemberName(member);
      const email = getMemberEmail(member);
      const role = member.role || '';
      return fullName.toLowerCase().includes(query.toLowerCase()) ||
             email.toLowerCase().includes(query.toLowerCase()) ||
             role.toLowerCase().includes(query.toLowerCase());
    });
    setFilteredMembers(filtered);
  };

  const handleSelectCandidate = (member) => {
    const memberId = member.user_id || member.userId;
    setRoleForm((prev) => {
      const isAlreadySelected = prev.candidateIds.includes(memberId);
      if (isAlreadySelected) {
        return {
          ...prev,
          candidateIds: prev.candidateIds.filter((id) => id !== memberId),
          selectedCandidates: prev.selectedCandidates.filter((candidate) =>
            (candidate.user_id || candidate.userId) !== memberId
          ),
        };
      }
      return {
        ...prev,
        candidateIds: [...prev.candidateIds, memberId],
        selectedCandidates: [...prev.selectedCandidates, member],
      };
    });
    setMemberSearchQuery('');
    setFilteredMembers([]);
  };

  const addPollOption = () => {
    if (pollForm.options.length < 10) {
      setPollForm((prev) => ({ ...prev, options: [...prev.options, ''] }));
    }
  };

  const removePollOption = (index) => {
    if (pollForm.options.length > 2) {
      setPollForm((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
    }
  };

  const updatePollOption = (index, value) => {
    setPollForm((prev) => ({ ...prev, options: prev.options.map((opt, i) => (i === index ? value : opt)) }));
  };

  const handleCreatePoll = async () => {
    if (pollForm.type === 'Election / Voting') {
      if (!roleForm.candidateIds?.length || !roleForm.requestedRole || !roleForm.selectedCandidates?.length) {
        Alert.alert('Error', 'Please select at least one candidate and specify the requested role for role escalation');
        return;
      }
      if (roleForm.candidateIds.length !== roleForm.selectedCandidates.length) {
        Alert.alert('Error', 'Candidate selection mismatch. Please try again.');
        return;
      }
    } else {
      if (!pollForm.title || pollForm.options.some((opt) => !opt.trim())) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }
    }

    try {
      if (pollForm.type === 'Election / Voting') {
        const candidateNames = roleForm.selectedCandidates.map((candidate) => getMemberName(candidate)).join(', ');
        const pollTitle = `${roleForm.requestedRole.charAt(0).toUpperCase() + roleForm.requestedRole.slice(1)} Election`;
        const pollDescription = `Election for ${roleForm.requestedRole} position. ${roleForm.selectedCandidates.length} candidate(s): ${candidateNames}`;

        const pollData = {
          title: pollTitle,
          description: pollDescription,
          type: 'Election / Voting',
          ends_at: pollForm.endDate,
          options: roleForm.selectedCandidates.map((candidate) => ({
            option_text: getMemberName(candidate),
            candidateId: candidate.user_id || candidate.userId,
            candidateInfo: candidate,
          })),
          isAnonymous: true,
          requiresMajority: true,
          majorityPercentage: 50,
          requestedRole: roleForm.requestedRole,
          justification: roleForm.justification || `Election for ${roleForm.requestedRole} position with ${roleForm.selectedCandidates.length} candidates`,
        };

        const response = await ApiService.createPoll(chamaId, pollData);
        if (response.success) {
          setSuccessMessage(`Role election poll created successfully with ${roleForm.selectedCandidates.length} candidates! Members can now vote for their preferred candidate.`);
          setShowSuccessBanner(true);
          resetPollForm();
          loadPolls();
          if (typeof onCreateSuccess === 'function') onCreateSuccess();
        } else {
          Alert.alert('Error', response.error || 'Failed to create role election poll');
        }
      } else {
        const voteData = {
          title: pollForm.title,
          description: pollForm.description,
          type: pollForm.type,
          ends_at: pollForm.endDate,
          options: pollForm.options.map((optionText) => ({ option_text: optionText.trim() })),
        };

        const response = await ApiService.createPoll(chamaId, voteData);
        if (response.success) {
          setSuccessMessage('Poll created successfully! Members can now vote.');
          setShowSuccessBanner(true);
          resetPollForm();
          await loadPolls();
          if (typeof onCreateSuccess === 'function') onCreateSuccess();
        } else {
          Alert.alert('Error', response.error || 'Failed to create vote');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create vote');
    }
  };

  const handleVote = async (pollId, optionId, poll) => {
    if (!pollId || !optionId || !chamaId) {
      Alert.alert('Error', 'Invalid vote parameters. Please try again.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to vote.');
      return;
    }
    if (!pollId.includes('vote-')) {
      Alert.alert('Error', 'Invalid vote format.');
      return;
    }

    try {
      setVotes((prevVotes) => prevVotes.map((vote) => (vote.id === pollId ? { ...vote, userVoted: true } : vote)));

      const response = await ApiService.castPollVote(chamaId, pollId, optionId);

      if (response.success) {
        if (poll.type === 'Election / Voting' && response.data?.pollCompleted) {
          if (response.data?.result === 'passed') {
            const candidateName = response.data?.candidateName || 'the candidate';
            const newRole = response.data?.newRole || 'new role';
            Alert.alert(
              'Congratulations!',
              `${candidateName} has been successfully elected to the ${newRole} position!`,
              [{ text: 'OK', onPress: () => loadPolls() }]
            );
          } else {
            Alert.alert('Vote Complete', 'The role escalation vote has been completed. The role change was not approved.', [
              { text: 'OK', onPress: () => loadPolls() },
            ]);
          }
        } else {
          setVotes((prevVotes) =>
            prevVotes.map((vote) => {
              if (vote.id === pollId) {
                return {
                  ...vote,
                  options: vote.options.map((opt) => (opt.id === optionId ? { ...opt, voteCount: opt.voteCount + 1 } : opt)),
                  totalVotes: (vote.totalVotes || 0) + 1,
                };
              }
              return vote;
            })
          );
          setPolls((prevPolls) =>
            prevPolls.map((poll) => {
              if (poll.id === pollId) {
                return {
                  ...poll,
                  options: poll.options.map((opt) => (opt.id === optionId ? { ...opt, voteCount: opt.voteCount + 1 } : opt)),
                  totalVotes: (poll.totalVotes || 0) + 1,
                };
              }
              return poll;
            })
          );
          Alert.alert('Vote Cast Successfully!', 'Your vote has been recorded and vote counts updated!', [{ text: 'OK' }]);
        }
      } else {
        setVotes((prevVotes) => prevVotes.map((vote) => (vote.id === pollId ? { ...vote, userVoted: false } : vote)));
        Alert.alert('Error', response.error || 'Failed to cast vote');
      }
    } catch (error) {
      setVotes((prevVotes) => prevVotes.map((vote) => (vote.id === pollId ? { ...vote, userVoted: false } : vote)));
      Alert.alert('Error', 'Failed to cast vote');
    }
  };

  const canCreatePolls = () => true;
  const canCreateRoleEscalation = () => ['chairperson', 'secretary'].includes(userRole);

  return {
    chamaId,
    theme,
    user,
    colors,
    loading,
    refreshing,
    activeTab,
    setActiveTab,
    polls,
    votes,
    allPolls,
    chamaDetails,
    completedPolls,
    currentPage,
    setCurrentPage,
    pageSize,
    userRole,
    chamaMembers,
    filteredMembers,
    memberSearchQuery,
    loadError,
    retryCount,
    showSuccessBanner,
    successMessage,
    showVisualizationModal,
    selectedVisualizationPoll,
    pollForm,
    setPollForm,
    roleForm,
    setRoleForm,
    onRefresh,
    handleRetry,
    getPaginatedCompletedPolls,
    getTotalPages,
    handlePageChange,
    openVisualizationModal,
    closeVisualizationModal,
    handleCreatePoll,
    handleVote,
    resetPollForm,
    resetRoleForm,
    handleMemberSearch,
    handleSelectCandidate,
    addPollOption,
    removePollOption,
    updatePollOption,
    canCreatePolls,
    canCreateRoleEscalation,
    getMemberName,
    getMemberEmail,
    formatTableDate,
    getPollTypeColor,
    getStatusColor,
    getTotalVotesCast,
    getTotalEligibleVoters,
    getVotePercentage,
    isPollFullyVoted,
  };
};

export default usePollsVotingScreen;
