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
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [totalPollCount, setTotalPollCount] = useState(0);
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
      // Normalize field names from new polls API to match old votes API format
      const normalized = {
        ...poll,
        type: poll.poll_type || poll.type || 'general',
        ends_at: poll.end_date || poll.ends_at,
        created_by: poll.created_by_name || poll.created_by,
        description: poll.description || '',
      };

      const endsAt = normalized.ends_at ? new Date(normalized.ends_at).getTime() : null;
      const now = Date.now();
      let status = normalized.status || 'active';
      if (status === 'active' && endsAt && endsAt < now) {
        status = 'completed';
      }
      const totalVotes = getTotalVotesCast(normalized);
      const isFullyVoted = isPollFullyVoted(normalized, chamaMembers);
      let timeRemaining = null;
      if (endsAt && status === 'active') {
        timeRemaining = Math.max(0, Math.floor((endsAt - now) / 1000));
      }
      const voted =
        normalized.user_voted === 1 ||
        normalized.user_voted === true ||
        normalized.userVoted === true ||
        !!normalized.user_vote_option;
      const votedOption = normalized.user_vote_option || normalized.userVote || null;
      return {
        ...normalized,
        status,
        isFullyVoted,
        completionStatus: isFullyVoted ? 'All votes cast' : null,
        timeRemaining,
        totalVotes,
        userVoted: voted,
        user_voted: voted,
        user_has_voted: voted,
        userVote: votedOption,
        user_vote_option: votedOption,
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
      const completedItems = sorted.filter((item) => item.status !== 'active');

      setPolls(activeItems);
      setVotes(activeItems);
      setCompletedPolls(completedItems);
      setAllPolls(sorted);
      setTotalPollCount(sorted.length);
      setLastSyncedAt(Date.now());
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

        const response = await ApiService.createRegularPoll(chamaId, voteData);
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

  // Apply a transform to a poll across every list it might live in.
  const patchPollEverywhere = (pollId, patch) => {
    const apply = (arr) => arr.map((p) => (p.id === pollId ? patch(p) : p));
    setPolls(apply);
    setVotes(apply);
    setCompletedPolls(apply);
    setAllPolls(apply);
  };

  const applyOptimisticVote = (p, optionId) => ({
    ...p,
    userVoted: true,
    user_voted: true,
    user_has_voted: true,
    userVote: optionId,
    user_vote_option: optionId,
    user_can_vote: false,
    options: (p.options || []).map((opt) =>
      opt.id === optionId ? { ...opt, vote_count: (opt.vote_count || 0) + 1 } : opt
    ),
    total_votes: (p.total_votes || p.total_votes_cast || 0) + 1,
    total_votes_cast: (p.total_votes_cast || p.total_votes || 0) + 1,
    totalVotes: (p.totalVotes || 0) + 1,
  });

  const handleVote = async (pollId, optionId, poll) => {
    if (!pollId || !optionId || !chamaId) {
      Alert.alert('Error', 'Invalid vote parameters. Please try again.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to vote.');
      return;
    }
    // Guard against a double-tap while the request is in flight or after voting.
    const current = allPolls.find((p) => p.id === pollId);
    if (current && (current.userVoted || current.user_voted)) return;

    // 1. Update the UI immediately so the ballot disappears and the tally moves.
    patchPollEverywhere(pollId, (p) => applyOptimisticVote(p, optionId));

    try {
      let response;
      if (poll?.type === 'Election / Voting') {
        response = await ApiService.makeRequest(`/chamas/${chamaId}/votes/${pollId}/vote`, {
          method: 'POST',
          body: { optionId, option_id: optionId },
        });
      } else {
        response = await ApiService.castPollVote(chamaId, pollId, optionId);
      }

      if (response?.success) {
        // 2. Reconcile with the authoritative poll the server returned.
        if (response.data && response.data.id) {
          const [fresh] = normalizePolls([response.data]);
          if (fresh) patchPollEverywhere(pollId, () => fresh);
        }
        if (poll?.type === 'Election / Voting' && response.data?.pollCompleted) {
          const passed = response.data?.result === 'passed';
          setSuccessMessage(
            passed
              ? `${response.data?.candidateName || 'The candidate'} was elected to ${response.data?.newRole || 'the role'}.`
              : 'The role change vote closed without approval.'
          );
          setShowSuccessBanner(true);
        } else {
          setSuccessMessage('Your vote was recorded.');
          setShowSuccessBanner(true);
        }
        // 3. Pull the full list in the background for other polls / results.
        loadPolls();
      } else {
        // Real failure — undo the optimistic change.
        patchPollEverywhere(pollId, (p) => {
          const undoOpt = (p.options || []).map((opt) =>
            opt.id === optionId ? { ...opt, vote_count: Math.max(0, (opt.vote_count || 0) - 1) } : opt
          );
          return {
            ...p,
            userVoted: false,
            user_voted: false,
            user_has_voted: false,
            userVote: null,
            user_vote_option: null,
            user_can_vote: true,
            options: undoOpt,
            total_votes: Math.max(0, (p.total_votes || 1) - 1),
            total_votes_cast: Math.max(0, (p.total_votes_cast || 1) - 1),
            totalVotes: Math.max(0, (p.totalVotes || 1) - 1),
          };
        });
        Alert.alert('Could not vote', response?.error || 'Please try again.');
      }
    } catch (error) {
      // The backend now returns success for "already voted"; a thrown error is a
      // genuine network/other failure. Keep the optimistic state and refresh.
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('already voted')) {
        setSuccessMessage('You have already voted on this poll.');
        setShowSuccessBanner(true);
        loadPolls();
        return;
      }
      Alert.alert('Could not vote', 'Please check your connection and try again.');
      loadPolls();
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
    lastSyncedAt,
    totalPollCount,
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
