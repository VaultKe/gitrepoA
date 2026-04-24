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
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Rect, Text as SvgText, G, Line } from 'react-native-svg';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';
import { formatDate, formatTimeRemaining } from '../../utils/formatters';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ApiService from '../../services/api';

const PollsVotingScreen = ({ route, navigation }) => {
  const { chamaId } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  // Responsive layout detection
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [isDesktop, setIsDesktop] = useState(Dimensions.get('window').width >= 768);
  const [numColumns, setNumColumns] = useState(Dimensions.get('window').width >= 768 ? 2 : 1);

  useEffect(() => {
    const updateLayout = ({ window }) => {
      const width = window.width;
      const height = window.height;
      const desktop = width >= 768;
      setScreenWidth(width);
      setIsDesktop(desktop);
      setNumColumns(desktop ? (width >= 1200 ? 3 : 2) : 1);

      // Update floating button position on screen size change
      setFloatingButtonPosition(prev => ({
        x: Math.min(prev.x, width - 60),
        y: Math.min(prev.y, height - 60)
      }));
    };

    const subscription = Dimensions.addEventListener('change', updateLayout);
    return () => subscription?.remove();
  }, []);

  const [dataReady, setDataReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'completed', 'role-escalation'
  const [polls, setPolls] = useState([]);
  const [votes, setVotes] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [chamaDetails, setChamaDetails] = useState(null);
  const [completedPolls, setCompletedPolls] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);
  const modalAnimation = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = visible
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [userRole, setUserRole] = useState('member');
  const [chamaMembers, setChamaMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [floatingButtonPosition, setFloatingButtonPosition] = useState({ x: Dimensions.get('window').width - 80, y: Dimensions.get('window').height - 160 });

  // Success banner states
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Visualization states
  const [expandedPoll, setExpandedPoll] = useState(null);
  const [showVisualizationModal, setShowVisualizationModal] = useState(false);
  const [selectedVisualizationPoll, setSelectedVisualizationPoll] = useState(null);

  // Real-time update states
  const [autoRefreshEnabled] = useState(true);

  // Form data for creating polls
  const [pollForm, setPollForm] = useState({
    title: '',
    description: '',
    type: 'general',
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    options: ['', ''],
    isAnonymous: true,
    requiresMajority: true,
    majorityPercentage: 50,
  });

  // Form data for role escalation
  const [roleForm, setRoleForm] = useState({
    candidateIds: [], // Changed to array to support multiple candidates
    requestedRole: 'chairperson',
    justification: '',
    selectedCandidates: [], // Changed to array to support multiple candidates
  });

  useEffect(() => {
    if (chamaId) {
      // If initial data hasn't been loaded yet, this is the first load
      // Otherwise, it's a tab switch
      const isTabSwitch = initialDataLoaded;
      loadData(isTabSwitch);
    }
  }, [chamaId, activeTab, initialDataLoaded]);

  // Auto-hide success banner after 5 seconds
  useEffect(() => {
    if (showSuccessBanner) {
      const timer = setTimeout(() => {
        setShowSuccessBanner(false);
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessBanner]);

  // Real-time updates - refresh data every 30 seconds
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      loadVotes();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [chamaId, activeTab, autoRefreshEnabled]);

  // PanResponder for draggable floating button
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Optional: Add visual feedback
      },
      onPanResponderMove: (evt, gestureState) => {
        const newX = floatingButtonPosition.x + gestureState.dx;
        const newY = floatingButtonPosition.y + gestureState.dy;
        // Constrain to screen bounds
        const screenWidth = Dimensions.get('window').width;
        const screenHeight = Dimensions.get('window').height;
        const constrainedX = Math.max(0, Math.min(newX, screenWidth - 60)); // 60 is button size
        const constrainedY = Math.max(0, Math.min(newY, screenHeight - 60));
        setFloatingButtonPosition({ x: constrainedX, y: constrainedY });
      },
      onPanResponderRelease: () => {
        // Optional: Snap to edge or something
      },
    })
  ).current;

  const loadData = async (isTabSwitch = false) => {
    try {
      if (!isTabSwitch) {
        setLoading(true);
      }
      await Promise.all([
        loadPolls(),
        loadUserRole(),
        loadChamaMembers(),
        loadChamaDetails(),
      ]);
      if (!isTabSwitch) {
        setDataReady(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load data');
    } finally {
      if (!isTabSwitch) {
        setLoading(false);
        setInitialDataLoaded(true);
      }
    }
  };

  const loadVotes = async () => {
    try {
      // Security: Verify chamaId is valid and user has access
      if (!chamaId || typeof chamaId !== 'string') {
        Alert.alert('Error', 'Invalid chama access. Please try again.');
        return;
      }

          // Always fetch both active and completed polls to ensure we have all data for processing
      const [activeResponse, completedResponse] = await Promise.all([
        ApiService.getActiveVotes(chamaId),
        ApiService.getVoteResults(chamaId)
      ]);
      const allPolls = [];
      const pollMap = new Map();

      // Add active polls first
      if (activeResponse.success && activeResponse.data) {
        activeResponse.data.forEach(poll => pollMap.set(poll.id, poll));
      }

      // Add completed polls (these will override active ones if they exist)
      if (completedResponse.success && completedResponse.data) {
        completedResponse.data.forEach(poll => pollMap.set(poll.id, poll));
      }

      allPolls.push(...pollMap.values());
      if (allPolls.length > 0) {
      }
      response = { success: true, data: allPolls };

      if (response.success) {
        const validVotes = (response.data || []).filter(vote => {
          if (!vote.id || !vote.id.includes('vote-')) {
            return false;
          }
          return true;
        });

        // Process polls for completion status
        const processedVotes = validVotes.map(vote => {
          const totalVotesCast = getTotalVotesCast(vote);
          const totalEligibleVoters = getTotalEligibleVoters(vote);
          const isFullyVoted = totalVotesCast >= totalEligibleVoters;

          // If fully voted and still active, mark as completed and adjust end time
          if (isFullyVoted && vote.status === 'active') {
            return {
              ...vote,
              status: 'completed',
              result: 'completed_early',
              endsAt: new Date().toISOString(), // Set end time to now
              isFullyVoted: true,
              completionStatus: 'Completed (100% participation)'
            };
          }

          return {
            ...vote,
            isFullyVoted,
            completionStatus: isFullyVoted ? 'All votes cast' : null
          };
        });

        // Separate completed polls for table view
        const allCompletedPolls = processedVotes.filter(vote => vote.status === 'completed');
        setCompletedPolls(allCompletedPolls);

        // Filter polls based on current tab after processing completion status
        let filteredVotes;
        if (activeTab === 'active') {
          filteredVotes = processedVotes.filter(vote => vote.status === 'active');
        } else if (activeTab === 'completed') {
          filteredVotes = processedVotes.filter(vote => vote.status === 'completed');
        } else {
          // For role escalation tab, show all
          filteredVotes = processedVotes;
        }

        setVotes(filteredVotes);
        setPolls(filteredVotes); // Keep setPolls for backward compatibility
      } else {
        setVotes([]);
        setPolls([]);

        // Check if it's an access denied error
        if (response.error?.includes('Access denied') || response.error?.includes('not a member')) {
          Alert.alert('Access Denied', 'You do not have permission to view votes for this chama.');
        }
      }
    } catch (error) {
      setPolls([]);
    }
  };

  // Keep old function name for compatibility but redirect to new one
  const loadPolls = loadVotes;


  const loadUserRole = async () => {
    try {
      const response = await ApiService.getMemberRole(chamaId, user.id);
      if (response.success) {
        setUserRole(response.data?.role || 'member');
      } else {
        setUserRole('member'); // Default to member if role fetch fails
      }
    } catch (error) {
      setUserRole('member'); // Default to member on error
    }
  };

  const loadChamaMembers = async () => {
    try {
      const response = await ApiService.getChamaMembers(chamaId);
      if (response.success) {
        setChamaMembers(response.data || []);
        setFilteredMembers(response.data || []);
      } else {
      }
    } catch (error) {
    }
  };

  const loadChamaDetails = async () => {
    try {
      const response = await ApiService.getChamaById(chamaId);
      if (response.success) {
        setChamaDetails(response.data);
      } else {
      }
    } catch (error) {
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true); // Always treat refresh as a tab switch (subtle loading)
    setRefreshing(false);
  }, [activeTab]);

  // Pagination helpers
  const getPaginatedCompletedPolls = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return completedPolls.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    return Math.ceil(completedPolls.length / pageSize);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Visualization modal handlers
  const openVisualizationModal = (poll) => {
    setSelectedVisualizationPoll(poll);
    setShowVisualizationModal(true);
  };

  const closeVisualizationModal = () => {
    setShowVisualizationModal(false);
    setSelectedVisualizationPoll(null);
  };

  // Modal animation functions
  const openCreateModal = () => {
    setShowCreateModal(true);
    Animated.timing(modalAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeCreateModal = () => {
    Animated.timing(modalAnimation, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowCreateModal(false);
    });
  };

  // Helper functions to get member data from nested structure
  const getMemberName = (member) => {
    const user = member.user || {};
    const firstName = user.first_name || member.firstName || '';
    const lastName = user.last_name || member.lastName || '';
    return `${firstName} ${lastName}`.trim() || 'Unknown Member';
  };

  const getMemberEmail = (member) => {
    const user = member.user || {};
    return user.email || member.email || 'No email';
  };

  const handleCreatePoll = async () => {
    if (pollForm.type === 'Election / Voting') {
      if (!roleForm.candidateIds || roleForm.candidateIds.length === 0 || !roleForm.requestedRole || !roleForm.selectedCandidates || roleForm.selectedCandidates.length === 0) {
        Alert.alert('Error', 'Please select at least one candidate and specify the requested role for role escalation');
        return;
      }

      if (roleForm.candidateIds.length !== roleForm.selectedCandidates.length) {
        Alert.alert('Error', 'Candidate selection mismatch. Please try again.');
        return;
      }
    } else {
      if (!pollForm.title || pollForm.options.some(opt => !opt.trim())) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }
    }

    try {
      if (pollForm.type === 'Election / Voting') {
        // Handle multiple candidates for role escalation
        const candidateNames = roleForm.selectedCandidates.map(candidate => getMemberName(candidate)).join(', ');

        // Create a single poll with multiple candidates
        const pollTitle = `${roleForm.requestedRole.charAt(0).toUpperCase() + roleForm.requestedRole.slice(1)} Election`;
        const pollDescription = `Election for ${roleForm.requestedRole} position. ${roleForm.selectedCandidates.length} candidate(s): ${candidateNames}`;

        const pollData = {
          title: pollTitle,
          description: pollDescription,
          type: 'Election / Voting',
          ends_at: pollForm.endDate,
          options: roleForm.selectedCandidates.map(candidate => ({
            option_text: getMemberName(candidate),
            candidateId: candidate.user_id || candidate.userId,
            candidateInfo: candidate
          })),
          isAnonymous: true,
          requiresMajority: true,
          majorityPercentage: 50,
          requestedRole: roleForm.requestedRole,
          justification: roleForm.justification || `Election for ${roleForm.requestedRole} position with ${roleForm.selectedCandidates.length} candidates`
        };

        const response = await ApiService.createVote(chamaId, pollData);
        if (response.success) {
          setSuccessMessage(`Role election poll created successfully with ${roleForm.selectedCandidates.length} candidates! Members can now vote for their preferred candidate.`);
          setShowSuccessBanner(true);
          closeCreateModal();
          resetPollForm();
          loadVotes();
        } else {
          Alert.alert('Error', response.error || 'Failed to create role election poll');
        }
      } else {
        // Handle regular vote creation
        const voteData = {
          title: pollForm.title,
          description: pollForm.description,
          type: pollForm.type,
          ends_at: pollForm.endDate,
          options: pollForm.options.map(optionText => ({ option_text: optionText.trim() })),
        };

        const response = await ApiService.createVote(chamaId, voteData);
        if (response.success) {
          setSuccessMessage('Poll created successfully! Members can now vote.');
          setShowSuccessBanner(true);
          closeCreateModal();
          resetPollForm();
          await loadVotes();
        } else {
          Alert.alert('Error', response.error || 'Failed to create vote');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create vote');
    }
  };

  const handleCreateRoleEscalation = async () => {
    if (!roleForm.candidateId || !roleForm.requestedRole || !roleForm.selectedCandidate) {
      Alert.alert('Error', 'Please select a candidate and specify the role');
      return;
    }

    const candidateName = roleForm.selectedCandidate.fullName;
    const currentRole = roleForm.selectedCandidate.role;

    // Check if candidate is applying for the same role they already have
    if (currentRole === roleForm.requestedRole) {
      Alert.alert(
        'Confirm Role Retention',
        `${candidateName} is already a ${currentRole}. This vote will confirm their continuation in this role. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => proceedWithRoleEscalation() }
        ]
      );
    } else {
      Alert.alert(
        'Confirm Role Change',
        `This will create a vote to change ${candidateName} from ${currentRole} to ${roleForm.requestedRole}. If approved, the role change will take effect immediately. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => proceedWithRoleEscalation() }
        ]
      );
    }
  };

  const proceedWithRoleEscalation = async () => {
    try {
      const escalationData = {
        candidateId: roleForm.candidateId,
        requestedRole: roleForm.requestedRole,
        justification: roleForm.justification,
      };

      const response = await ApiService.createRoleEscalationPoll(chamaId, escalationData);
      if (response.success) {
        Alert.alert(
          'Success',
          'Role escalation poll created successfully! Members can now vote on this role change.',
          [{ text: 'OK', onPress: () => {
            setShowRoleModal(false);
            resetRoleForm();
            loadPolls();
          }}]
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to create role escalation poll');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create role escalation poll');
    }
  };

  const handleVote = async (pollId, optionId, poll) => {
    // Security: Validate vote parameters
    if (!pollId || !optionId || !chamaId) {
      Alert.alert('Error', 'Invalid vote parameters. Please try again.');
      return;
    }

    // Security: Verify user is authenticated
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to vote.');
      return;
    }

    // Security: Verify vote belongs to current chama
    if (!pollId.includes('vote-')) {
      Alert.alert('Error', 'Invalid vote format.');
      return;
    }

    try {
              // Immediately update UI to show vote was cast (optimistic update)
              setVotes(prevVotes =>
                prevVotes.map(vote =>
                  vote.id === pollId
                    ? { ...vote, userVoted: true }
                    : vote
                )
              );

              const response = await ApiService.castVote(chamaId, pollId, voteData);
              if (response.success) {
                // Check if this vote completed the poll and it's a role escalation
                if (poll.type === 'Election / Voting' && response.data?.pollCompleted) {
                  if (response.data?.result === 'passed') {
                    // Get the winning candidate info
                    const candidateName = response.data?.candidateName || 'the candidate';
                    const newRole = response.data?.newRole || 'new role';

                    Alert.alert(
                      '🎉 Congratulations!',
                      `${candidateName} has been successfully elected to the ${newRole} position! The role change has taken effect immediately.`,
                      [{ text: 'OK', onPress: () => loadPolls() }]
                    );
                  } else {
                    Alert.alert(
                      'Vote Complete',
                      'The role escalation vote has been completed. The role change was not approved.',
                      [{ text: 'OK', onPress: () => loadVotes() }]
                    );
                  }
                } else {
                  // Vote state already updated optimistically above

                  // Update vote counts in local state
                  setVotes(prevVotes =>
                    prevVotes.map(vote => {
                      if (vote.id === pollId) {
                        return {
                          ...vote,
                          options: vote.options.map(opt =>
                            opt.id === optionId
                              ? { ...opt, voteCount: opt.voteCount + 1 }
                              : opt
                          ),
                          totalVotes: (vote.totalVotes || 0) + 1
                        };
                      }
                      return vote;
                    })
                  );

                  // Also update polls state for backward compatibility
                  setPolls(prevPolls =>
                    prevPolls.map(poll => {
                      if (poll.id === pollId) {
                        return {
                          ...poll,
                          options: poll.options.map(opt =>
                            opt.id === optionId
                              ? { ...opt, voteCount: opt.voteCount + 1 }
                              : opt
                          ),
                          totalVotes: (poll.totalVotes || 0) + 1
                        };
                      }
                      return poll;
                    })
                  );

                  Alert.alert(
                    'Vote Cast Successfully! 🎉',
                    'Your vote has been recorded and vote counts updated!',
                    [{ text: 'OK' }]
                  );
                }
              } else {
                // Revert optimistic update on failure
                setVotes(prevVotes =>
                  prevVotes.map(vote =>
                    vote.id === pollId
                      ? { ...vote, userVoted: false }
                      : vote
                  )
                );
                Alert.alert('Error', response.error || 'Failed to cast vote');
              }
            } catch (error) {
              // Revert optimistic update on error
              setVotes(prevVotes =>
                prevVotes.map(vote =>
                  vote.id === pollId
                    ? { ...vote, userVoted: false }
                    : vote
                )
              );
              Alert.alert('Error', 'Failed to cast vote');
            }
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

    // Also reset role form and member search
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

    const filtered = chamaMembers.filter(member => {
      // Get member name and email using helper functions
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

    setRoleForm(prev => {
      const isAlreadySelected = prev.candidateIds.includes(memberId);

      if (isAlreadySelected) {
        // Remove candidate if already selected
        return {
          ...prev,
          candidateIds: prev.candidateIds.filter(id => id !== memberId),
          selectedCandidates: prev.selectedCandidates.filter(candidate =>
            (candidate.user_id || candidate.userId) !== memberId
          ),
        };
      } else {
        // Add candidate if not selected
        return {
          ...prev,
          candidateIds: [...prev.candidateIds, memberId],
          selectedCandidates: [...prev.selectedCandidates, member],
        };
      }
    });

    // Clear search query and filtered members after selection
    setMemberSearchQuery('');
    setFilteredMembers([]);
  };

  const addPollOption = () => {
    if (pollForm.options.length < 10) {
      setPollForm(prev => ({
        ...prev,
        options: [...prev.options, '']
      }));
    }
  };

  const removePollOption = (index) => {
    if (pollForm.options.length > 2) {
      setPollForm(prev => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index)
      }));
    }
  };

  const updatePollOption = (index, value) => {
    setPollForm(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }));
  };

  const canCreatePolls = () => {
    return true; // Any member can create general polls
  };

  const canCreateRoleEscalation = () => {
    return ['chairperson', 'secretary'].includes(userRole);
  };

  const getVotePercentage = (voteCount, totalVotes) => {
    if (totalVotes === 0) return 0;
    return Math.round((voteCount / totalVotes) * 100);
  };

  const getTotalVotesCast = (poll) => {
    if (!poll.options || !Array.isArray(poll.options)) return 0;
    return poll.options.reduce((total, option) => total + (option.voteCount || 0), 0);
  };

  const getTotalEligibleVoters = (poll) => {
    // For now, use chama members count as eligible voters
    // This could be refined to exclude members who can't vote
    return chamaMembers.length;
  };

  const getStatusColor = (status, result) => {
    if (status === 'completed') {
      return result === 'passed' ? colors.success : colors.error;
    }
    return colors.warning;
  };

  // Format date for table display
  const formatTableDate = (dateString) => {
    if (!dateString) return 'Unknown Date';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return 'Unknown Date';
    }
  };

  // Render completed polls table
  const renderCompletedPollsTable = () => {
    const paginatedPolls = getPaginatedCompletedPolls();
    const totalPages = getTotalPages();

    return (
      <View style={{ flex: 1 }}>
        {/* Table Header */}
        <View style={[styles.tableHeader, {
          backgroundColor: colors.primary + '15',
          borderBottomWidth: 2,
          borderBottomColor: colors.primary
        }]}>
          <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Title</Text>
          <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Type</Text>
          <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Total</Text>
          <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Ended</Text>
          <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Action</Text>
        </View>

        {/* Table Rows */}
        {paginatedPolls.map((poll, index) => (
          <View key={poll.id} style={[styles.tableRow, { borderBottomColor: colors.border }, index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }]}>
            <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={2}>{(poll.title || '').length > 10 ? (poll.title || '').substring(0, 10) + '...' : (poll.title || '')}</Text>
            <Text style={[styles.tableCell, { color: colors.textSecondary }]}>{(poll.type || 'General').length > 7 ? (poll.type || 'General').substring(0, 7) + '...' : (poll.type || 'General')}</Text>
            <Text style={[styles.tableCell, { color: colors.textSecondary }]}>
              {getTotalVotesCast(poll)}/{getTotalEligibleVoters(poll)}
            </Text>
            <Text style={[styles.tableCell, { color: colors.textSecondary }]}>{formatTableDate(poll.endsAt)}</Text>
            <TouchableOpacity
              style={[styles.actionCell, { backgroundColor: colors.primary + '15' }]}
              onPress={() => openVisualizationModal(poll)}
            >
              <Ionicons name="eye" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ))}

        {/* Pagination */}
        {totalPages > 1 && (
          <View style={styles.paginationContainer}>
            <TouchableOpacity
              style={[styles.paginationButton, {
                backgroundColor: colors.surface,
                borderColor: colors.border
              }, currentPage === 1 && styles.paginationButtonDisabled]}
              onPress={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <Ionicons name="chevron-back" size={20} color={currentPage === 1 ? colors.textSecondary : colors.primary} />
            </TouchableOpacity>

            <Text style={[styles.paginationText, { color: colors.textSecondary }]}>
              Page {currentPage} of {totalPages}
            </Text>

            <TouchableOpacity
              style={[styles.paginationButton, {
                backgroundColor: colors.surface,
                borderColor: colors.border
              }, currentPage === totalPages && styles.paginationButtonDisabled]}
              onPress={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <Ionicons name="chevron-forward" size={20} color={currentPage === totalPages ? colors.textSecondary : colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {completedPolls.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
              No completed polls yet
            </Text>
            <Text style={[styles.emptyText, { fontSize: 14, marginTop: 8 }]}>
              Completed polls will appear here
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Visualization Components
  const PieChart = ({ data, size = 120 }) => {
    if (!data || data.length === 0) return null;

    const total = data.reduce((sum, item) => sum + item.value, 0);
    let cumulativeAngle = 0;
    const center = size / 2;
    const radius = (size - 20) / 2;

    const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];

    return (
      <Svg width={size} height={size}>
        {data.map((item, index) => {
          const percentage = item.value / total;
          const angle = percentage * 360;
          const startAngle = cumulativeAngle;
          const endAngle = cumulativeAngle + angle;

          const x1 = center + radius * Math.cos((startAngle * Math.PI) / 180);
          const y1 = center + radius * Math.sin((startAngle * Math.PI) / 180);
          const x2 = center + radius * Math.cos((endAngle * Math.PI) / 180);
          const y2 = center + radius * Math.sin((endAngle * Math.PI) / 180);

          const largeArcFlag = angle > 180 ? 1 : 0;

          cumulativeAngle = endAngle;

          return (
            <G key={index}>
              <Circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={colors[index % colors.length]}
                strokeWidth="20"
                strokeDasharray={`${(angle / 360) * 2 * Math.PI * radius} ${(1 - angle / 360) * 2 * Math.PI * radius}`}
                strokeDashoffset={-(startAngle / 360) * 2 * Math.PI * radius}
              />
            </G>
          );
        })}
        <Circle cx={center} cy={center} r={radius - 10} fill="white" />
      </Svg>
    );
  };

  const BarChart = ({ data, width = 200, height = 100 }) => {
    if (!data || data.length === 0) return null;

    const maxValue = Math.max(...data.map(item => item.value));
    const barWidth = width / data.length - 10;
    const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];

    return (
      <Svg width={width} height={height}>
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * (height - 20);
          const x = index * (barWidth + 10) + 5;
          const y = height - barHeight - 5;

          return (
            <G key={index}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={colors[index % colors.length]}
                rx="2"
              />
              <SvgText
                x={x + barWidth / 2}
                y={y - 5}
                fontSize="10"
                fill="#666"
                textAnchor="middle"
              >
                {item.value}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    );
  };

  const ProgressChart = ({ completed, total, width = 200, height = 40 }) => {
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    return (
      <View style={{ width, height, justifyContent: 'center' }}>
        <View style={[styles.progressBar, { backgroundColor: colors.border, height: 8, borderRadius: 4 }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${percentage}%`,
                backgroundColor: colors.primary,
                height: 8,
                borderRadius: 4
              }
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: colors.textSecondary, fontSize: 12, marginTop: 4 }]}>
          {completed}/{total} votes ({percentage.toFixed(1)}%)
        </Text>
      </View>
    );
  };

  const renderPollVisualizations = (poll) => {
    if (!poll.options || poll.options.length === 0) return null;

    const totalVotes = getTotalVotesCast(poll);
    const chartData = poll.options.map((option, index) => ({
      label: option.text || `Option ${index + 1}`,
      value: option.voteCount || 0,
    }));

    return (
      <View style={[
        styles.visualizationsContainer,
        isDesktop && styles.visualizationsContainerDesktop
      ]}>
        <Text style={[
          styles.visualizationTitle,
          { color: colors.text },
          isDesktop && styles.visualizationTitleDesktop
        ]}>
          Poll Results Analysis
        </Text>

        <View style={[
          styles.chartsContainer,
          isDesktop && styles.chartsContainerDesktop
        ]}>
          {/* Pie Chart */}
          <View style={[styles.chartItem, isDesktop && styles.chartItemDesktop]}>
            <Text style={[
              styles.chartTitle,
              { color: colors.text },
              isDesktop && styles.chartTitleDesktop
            ]}>
              Vote Distribution
            </Text>
            <View style={styles.pieChartContainer}>
              <PieChart data={chartData} size={isDesktop ? 160 : 120} />
            </View>
          </View>

          {/* Bar Chart */}
          <View style={[styles.chartItem, isDesktop && styles.chartItemDesktop]}>
            <Text style={[
              styles.chartTitle,
              { color: colors.text },
              isDesktop && styles.chartTitleDesktop
            ]}>
              Vote Counts
            </Text>
            <BarChart
              data={chartData}
              width={isDesktop ? 300 : 200}
              height={isDesktop ? 120 : 100}
            />
          </View>

          {/* Progress Chart */}
          <View style={[styles.chartItem, isDesktop && styles.chartItemDesktop]}>
            <Text style={[
              styles.chartTitle,
              { color: colors.text },
              isDesktop && styles.chartTitleDesktop
            ]}>
              Participation
            </Text>
            <ProgressChart
              completed={totalVotes}
              total={getTotalEligibleVoters(poll)}
              width={isDesktop ? 300 : 200}
              height={isDesktop ? 50 : 40}
            />
          </View>
        </View>

        {/* Legend */}
        <View style={[
          styles.legendContainer,
          isDesktop && styles.legendContainerDesktop
        ]}>
          {chartData.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'][index % 6] }]} />
              <Text style={[
                styles.legendText,
                { color: colors.textSecondary },
                isDesktop && styles.legendTextDesktop
              ]}>
                {item.label}: {item.value} votes ({totalVotes > 0 ? Math.round((item.value / totalVotes) * 100) : 0}%)
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderPollItem = ({ item, index }) => {
    const cardStyle = [
      styles.pollCard,
      { backgroundColor: colors.surface },
      isDesktop && [
        styles.pollCardDesktop,
        {
          marginHorizontal: 8,
          marginBottom: 16,
          flex: 1,
          maxWidth: (screenWidth - 32 - (numColumns - 1) * 16) / numColumns,
        }
      ]
    ];

    return (
      <Card
        style={cardStyle}
        accessibilityLabel={`${item.title} poll. ${item.status} status. ${getTotalVotesCast(item)} out of ${getTotalEligibleVoters(item)} votes cast.`}
        accessibilityRole="button"
      >
      <View style={styles.pollHeader}>
        <View style={styles.pollInfo}>
          <Text style={[
            styles.pollTitle,
            { color: colors.text },
            isDesktop && styles.pollTitleDesktop
          ]}>
            {item.title}
          </Text>
          <Text style={[styles.pollCreator, { color: colors.textSecondary }]}>
            by {item.createdBy}
          </Text>
        </View>
        <View style={[
          styles.pollTypeBadge,
          { backgroundColor: getPollTypeColor(item.type) + '15' }
        ]}>
          <Text style={[styles.pollTypeText, { color: getPollTypeColor(item.type) }]}>
            {item.type.replace('_', ' ')}
          </Text>
        </View>
      </View>

      {item.description && (
        <Text style={[
          styles.pollDescription,
          { color: colors.textSecondary },
          isDesktop && styles.pollDescriptionDesktop
        ]}>
          {item.description}
        </Text>
      )}

      <View style={[
        styles.pollStats,
        isDesktop && styles.pollStatsDesktop
      ]}>
        <View style={styles.statItem}>
          <Text style={[
            styles.statValue,
            { color: colors.primary },
            isDesktop && styles.statValueDesktop
          ]}>
            {getTotalVotesCast(item)}/{getTotalEligibleVoters(item)}
          </Text>
          <Text style={[
            styles.statLabel,
            { color: colors.textSecondary },
            isDesktop && styles.statLabelDesktop
          ]}>
            Votes Cast
          </Text>
        </View>

        {item.status === 'active' && item.timeRemaining && (
          <View style={styles.statItem}>
            <Text style={[
              styles.statValue,
              { color: item.isFullyVoted ? colors.success : colors.warning },
              isDesktop && styles.statValueDesktop
            ]}>
              {item.isFullyVoted ? 'All Votes Cast' : formatTimeRemaining(item.timeRemaining)}
            </Text>
            <Text style={[
              styles.statLabel,
              { color: colors.textSecondary },
              isDesktop && styles.statLabelDesktop
            ]}>
              {item.isFullyVoted ? 'Effectively Complete' : 'Time Left'}
            </Text>
          </View>
        )}

        {item.status === 'completed' && (
          <View style={styles.statItem}>
            <Text style={[
              styles.statValue,
              { color: getStatusColor(item.status, item.result) },
              isDesktop && styles.statValueDesktop
            ]}>
              {item.result === 'completed_early' ? 'Completed Early' : item.result}
            </Text>
            <Text style={[
              styles.statLabel,
              { color: colors.textSecondary },
              isDesktop && styles.statLabelDesktop
            ]}>
              Result
            </Text>
          </View>
        )}
      </View>

      {/* Voting Status Message */}
      {item.userVoted && (
        <View style={[styles.votingStatusMessage, { backgroundColor: colors.success + '10', borderColor: colors.success, borderWidth: 1 }]}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={[styles.votingStatusText, { color: colors.success, fontSize: 13, fontWeight: '600' }]}>
            ✓ You have voted on this item
          </Text>
        </View>
      )}

      {item.status === 'completed' && !item.userVoted && (
        <View style={[styles.votingStatusMessage, { backgroundColor: colors.textSecondary + '10', borderColor: colors.textSecondary, borderWidth: 1 }]}>
          <Ionicons name="time" size={18} color={colors.textSecondary} />
          <Text style={[styles.votingStatusText, { color: colors.textSecondary, fontSize: 13 }]}>
            Vote ended - You did not participate
          </Text>
        </View>
      )}

      {/* Poll Options */}
      <View style={[
        styles.optionsContainer,
        isDesktop && styles.optionsContainerDesktop
      ]}>
        {item.options.map((option, index) => {
          const totalVotesCast = getTotalVotesCast(item);
          const percentage = getVotePercentage(option.voteCount, totalVotesCast);
          const canVote = item.status === 'active' && !item.userVoted;
          const showVotingInterface = item.status === 'active' && !item.userVoted;

          return (
            <View
              key={option.id || index}
              style={[
                styles.optionItem,
                { backgroundColor: colors.surface },
                isDesktop && styles.optionItemDesktop,
                canVote && {
                  borderColor: colors.primary,
                  borderWidth: 2,
                  backgroundColor: colors.primary + '08'
                },
                item.userVoted && {
                  borderColor: colors.success,
                  backgroundColor: colors.success + '08'
                },
                item.status === 'completed' && {
                  borderColor: colors.textSecondary,
                  backgroundColor: colors.textSecondary + '05'
                }
              ]}
              onPress={showVotingInterface ? () => {
                handleVote(item.id, option.id, item);
              } : undefined}
              disabled={!showVotingInterface}
              activeOpacity={showVotingInterface ? 0.8 : 1}
            >
              {/* Voting Interface - Only show when user can vote */}
              {showVotingInterface && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                  {/* Simple Vote Button */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: colors.warning,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      marginRight: 8,
                      minWidth: 80,
                      alignItems: 'center'
                    }}
                    onPress={() => {
                      handleVote(item.id, option.id, item);
                    }}
                    activeOpacity={0.8}
                    accessibilityLabel={`Vote for ${option.text}`}
                    accessibilityRole="button"
                    accessibilityHint="Double tap to cast your vote for this option"
                  >
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>
                      VOTE
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* User Already Voted Icon - Smaller and cleaner */}
              {item.userVoted && (
                <View style={[styles.voteIconContainer, { backgroundColor: colors.success + '15', borderRadius: 12, padding: 6 }]}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={colors.success}
                  />
                </View>
              )}

              {/* Completed Vote Icon - Smaller */}
              {item.status === 'completed' && !item.userVoted && (
                <View style={[styles.voteIconContainer, { backgroundColor: colors.textSecondary + '15', borderRadius: 12, padding: 6 }]}>
                  <Ionicons
                    name="time"
                    size={16}
                    color={colors.textSecondary}
                  />
                </View>
              )}

              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionText,
                  { color: colors.text },
                  isDesktop && styles.optionTextDesktop
                ]}>
                  {option.text}
                </Text>
                {/* Show vote count for all polls */}
                <Text style={[
                  styles.optionVotes,
                  { color: colors.textSecondary },
                  isDesktop && styles.optionVotesDesktop
                ]}>
                  {option.voteCount} votes ({percentage}%)
                </Text>
              </View>

              {/* Vote Action Indicator */}
              {showVotingInterface && (
                <View style={[styles.actionIndicator, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.actionText, { color: colors.surface }]}>
                    TAP TO VOTE
                  </Text>
                </View>
              )}

              {/* Voted Indicator - Compact */}
              {item.userVoted && (
                <View style={[styles.actionIndicator, { backgroundColor: colors.success, paddingHorizontal: 6, paddingVertical: 2 }]}>
                  <Text style={[styles.actionText, { color: colors.surface, fontSize: 9 }]}>
                    VOTED
                  </Text>
                </View>
              )}

              {/* Completed Indicator - Compact */}
              {item.status === 'completed' && !item.userVoted && (
                <View style={[styles.actionIndicator, { backgroundColor: colors.textSecondary, paddingHorizontal: 6, paddingVertical: 2 }]}>
                  <Text style={[styles.actionText, { color: colors.surface, fontSize: 9 }]}>
                    ENDED
                  </Text>
                </View>
              )}

              {/* Anonymous Voting Indicator */}
              {item.isAnonymous && (
                <View style={[styles.anonymousIndicator, { backgroundColor: colors.warning + '15', borderRadius: 12, padding: 4 }]}>
                  <Ionicons
                    name="eye-off"
                    size={16}
                    color={colors.warning}
                  />
                </View>
              )}
              
              {item.status === 'completed' && (
                <View style={[
                  styles.progressBar,
                  { backgroundColor: colors.border }
                ]}>
                  <View style={[
                    styles.progressFill,
                    {
                      width: `${percentage}%`,
                      backgroundColor: colors.primary
                    }
                  ]} />
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Only show "You have voted" badge for active polls */}
      {item.userVoted && item.status === 'active' && (
        <View style={[styles.votedBadge, { backgroundColor: colors.success + '15' }]}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[styles.votedText, { color: colors.success }]}>
            You have voted
          </Text>
        </View>
      )}

      {/* Fully voted indicator for active polls */}
      {item.status === 'active' && item.isFullyVoted && (
        <View style={[styles.fullyVotedBadge, { backgroundColor: colors.success + '15', borderColor: colors.success }]}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={[styles.fullyVotedText, { color: colors.success }]}>
            All Eligible Votes Cast
          </Text>
        </View>
      )}

      {/* Visualizations toggle for completed polls */}
      {item.status === 'completed' && (
        <TouchableOpacity
          style={[styles.visualizationToggle, { backgroundColor: colors.primary + '15' }]}
          onPress={() => openVisualizationModal(item)}
        >
          <Ionicons
            name="bar-chart"
            size={16}
            color={colors.primary}
          />
          <Text style={[styles.visualizationToggleText, { color: colors.primary }]}>
            View Results Analysis
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.pollMeta}>
        <Text style={[styles.pollDate, { color: colors.textSecondary }]}>
          {item.status === 'active' ? 'Ends' : 'Ended'}: {formatDate(item.endsAt, 'datetime')}
        </Text>

        <View style={styles.pollBadges}>
          {item.isAnonymous && (
            <View style={[styles.anonymousBadge, { backgroundColor: colors.warning + '20', borderColor: colors.warning, borderWidth: 1 }]}>
              <Ionicons name="eye-off" size={12} color={colors.warning} />
              <Text style={[styles.anonymousText, { color: colors.warning }]}>
                Anonymous
              </Text>
            </View>
          )}

          {item.userVoted && (
            <View style={[styles.votedBadge, { backgroundColor: colors.success + '15', borderColor: colors.success, borderWidth: 1 }]}>
              <Ionicons name="checkmark-circle" size={10} color={colors.success} />
              <Text style={[styles.votedText, { color: colors.success, fontSize: 9 }]}>
                VOTED
              </Text>
            </View>
          )}

          {item.status === 'active' && !item.userVoted && (
            <View style={[styles.canVoteBadge, { backgroundColor: colors.primary + '15', borderColor: colors.primary, borderWidth: 1 }]}>
              <Ionicons name="radio-button-off" size={10} color={colors.primary} />
              <Text style={[styles.canVoteText, { color: colors.primary, fontSize: 9 }]}>
                CAN VOTE
              </Text>
            </View>
          )}

          {item.status === 'completed' && (
            <View style={[styles.completedBadge, { backgroundColor: colors.textSecondary + '15', borderColor: colors.textSecondary, borderWidth: 1 }]}>
              <Ionicons name="time" size={10} color={colors.textSecondary} />
              <Text style={[styles.completedText, { color: colors.textSecondary, fontSize: 9 }]}>
                ENDED
              </Text>
            </View>
          )}
        </View>
      </View>
    </Card>
    );
  };

  const getPollTypeColor = (type) => {
    switch (type) {
      case 'general': return colors.info;
      case 'Election / Voting': return colors.warning;
      case 'financial_decision': return colors.success;
      default: return colors.textSecondary;
    }
  };

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


      {/* Success Banner */}
      {showSuccessBanner && (
        <View style={[{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          borderRadius: 8,
          marginBottom: 8,
          marginHorizontal: 16,
          marginTop: 16,
          backgroundColor: colors.success + '15',
          borderColor: colors.success,
          borderWidth: 1,
        }]}>
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={colors.success}
            style={{ marginRight: 8 }}
          />
          <Text style={[{ flex: 1, fontSize: 14, fontWeight: '500', color: colors.text }]}>
            {successMessage}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setShowSuccessBanner(false);
              setSuccessMessage('');
            }}
            style={{ padding: 4, marginLeft: 8 }}
          >
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Tab Navigation */}
      <View style={[
        styles.tabContainer,
        { backgroundColor: colors.surface },
        isDesktop && styles.tabContainerDesktop
      ]}>
        <View style={[styles.buttonGroup, { backgroundColor: colors.border + '20', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.groupButton,
              activeTab === 'active' && styles.groupButtonActive,
              { backgroundColor: activeTab === 'active' ? colors.primary : 'transparent' },
              isDesktop && styles.groupButtonDesktop
            ]}
            onPress={() => setActiveTab('active')}
            accessibilityLabel={`View active polls. ${activeTab === 'active' ? 'Currently selected' : 'Not selected'}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'active' }}
          >
            <Ionicons
              name="time"
              size={isDesktop ? 20 : 16}
              color={activeTab === 'active' ? colors.surface : colors.textSecondary}
            />
            <Text style={[
              styles.groupButtonText,
              { color: activeTab === 'active' ? colors.surface : colors.textSecondary },
              isDesktop && styles.groupButtonTextDesktop
            ]}>
              Active Polls
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.groupButton,
              activeTab === 'completed' && styles.groupButtonActive,
              { backgroundColor: activeTab === 'completed' ? colors.primary : 'transparent' },
              isDesktop && styles.groupButtonDesktop
            ]}
            onPress={() => setActiveTab('completed')}
            accessibilityLabel={`View completed polls. ${activeTab === 'completed' ? 'Currently selected' : 'Not selected'}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'completed' }}
          >
            <Ionicons
              name="checkmark-circle"
              size={isDesktop ? 20 : 16}
              color={activeTab === 'completed' ? colors.surface : colors.textSecondary}
            />
            <Text style={[
              styles.groupButtonText,
              { color: activeTab === 'completed' ? colors.surface : colors.textSecondary },
              isDesktop && styles.groupButtonTextDesktop
            ]}>
              Completed
            </Text>
          </TouchableOpacity>

          {canCreatePolls() && (
            <TouchableOpacity
              style={[
                styles.groupButton,
                { backgroundColor: colors.primary, borderRadius: 8 },
                isDesktop && styles.groupButtonDesktop
              ]}
              onPress={openCreateModal}
              activeOpacity={0.8}
              accessibilityLabel="Create new poll"
              accessibilityRole="button"
            >
              <Ionicons
                name="add"
                size={isDesktop ? 20 : 16}
                color={colors.surface}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>


      {/* Content */}
      {activeTab === 'completed' ? (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <View style={{ padding: 16 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Completed Polls - {chamaDetails?.name || `Chama ${chamaId?.slice(-8) || 'Unknown'}`}
            </Text>
            {renderCompletedPollsTable()}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={polls}
          renderItem={renderPollItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            isDesktop && styles.listContentDesktop
          ]}
          numColumns={numColumns}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={[
              styles.emptyContainer,
              isDesktop && styles.emptyContainerDesktop
            ]}>
              <Ionicons
                name="checkmark-circle-outline"
                size={isDesktop ? 80 : 64}
                color={colors.textSecondary}
              />
              <Text style={[
                styles.emptyText,
                { color: colors.textSecondary },
                isDesktop && styles.emptyTextDesktop
              ]}>
                No {activeTab} polls found
              </Text>
            </View>
          }
        />
      )}

      {/* Create Poll Modal Overlay */}
      {showCreateModal && (
        <>
          {/* Backdrop */}
          <Animated.View
            style={[
              styles.modalBackdrop,
              {
                opacity: modalAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.5],
                }),
              },
            ]}
          >
            <TouchableOpacity
              style={styles.modalBackdropTouchable}
              onPress={closeCreateModal}
              activeOpacity={1}
            />
          </Animated.View>

          {/* Modal Content */}
          <Animated.View
            style={[
              styles.modalContainer,
              { backgroundColor: colors.surface },
              {
                transform: [
                  {
                    scale: modalAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
                opacity: modalAnimation,
              },
            ]}
          >
            <View style={[
              styles.modalHeader,
              { backgroundColor: colors.surface },
              isDesktop && styles.modalHeaderDesktop
            ]}>
              <View style={styles.modalCloseButton} />
              <Text style={[
                styles.modalTitle,
                { color: colors.text },
                isDesktop && styles.modalTitleDesktop
              ]}>
                Create New Poll
              </Text>
              <TouchableOpacity
                onPress={closeCreateModal}
                style={[styles.modalCloseButton, isDesktop && styles.modalCloseButtonDesktop]}
              >
                <Ionicons name={isDesktop ? "close-circle" : "close"} size={isDesktop ? 28 : 24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}
              contentContainerStyle={[
                styles.modalContentContainer,
                isDesktop && styles.modalContentContainerDesktop
              ]}
            >
            {/* Title field - only for non-role-escalation votes */}
            {pollForm.type !== 'Election / Voting' && (
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Title *
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    { backgroundColor: colors.surface, color: colors.text },
                    isDesktop && styles.formInputDesktop
                  ]}
                  value={pollForm.title}
                  onChangeText={(text) => setPollForm(prev => ({ ...prev, title: text }))}
                  placeholder="Enter poll title"
                  placeholderTextColor={colors.textSecondary}
                  accessibilityLabel="Poll title input"
                  accessibilityHint="Enter the title for your poll"
                />
              </View>
            )}

            {/* Description field - optional for all vote types */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Description {pollForm.type === 'Election / Voting' ? '(Auto-generated)' : '(Optional)'}
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  styles.textArea,
                  { backgroundColor: colors.surface, color: colors.text },
                  isDesktop && styles.formInputDesktop
                ]}
                value={pollForm.description}
                onChangeText={(text) => setPollForm(prev => ({ ...prev, description: text }))}
                placeholder={pollForm.type === 'Election / Voting' ? 'Justification will be used as description' : 'Enter poll description (optional)'}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={isDesktop ? 4 : 3}
                editable={pollForm.type !== 'Election / Voting'}
                accessibilityLabel="Poll description input"
                accessibilityHint="Enter an optional description for your poll"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Poll Type *
              </Text>
              <View style={[styles.radioGroup, isDesktop && styles.radioGroupDesktop]}>
                {[
                  { value: 'general', label: 'General Poll', description: 'For general opinions and decisions' },
                  { value: 'financial_decision', label: 'Financial Decision', description: 'For financial matters requiring approval' },
                  { value: 'Election / Voting', label: 'Role Change', description: 'For changing member roles (Chair only)' },
                ].map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.radioOption,
                      isDesktop && styles.radioOptionDesktop,
                      type.value === 'Election / Voting' && userRole !== 'chairperson' && styles.disabledOption
                    ]}
                    onPress={() => {
                      if (type.value === 'Election / Voting' && userRole !== 'chairperson') {
                        Alert.alert('Access Denied', 'Only the chairperson can create role escalation polls');
                        return;
                      }
                      setPollForm(prev => ({ ...prev, type: type.value }));
                    }}
                    disabled={type.value === 'Election / Voting' && userRole !== 'chairperson'}
                    accessibilityLabel={`${type.label} poll type`}
                    accessibilityHint={type.description}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: pollForm.type === type.value }}
                  >
                    <View style={[
                      styles.radioCircle,
                      isDesktop && styles.radioCircleDesktop,
                      { borderColor: colors.primary },
                      pollForm.type === type.value && { backgroundColor: colors.primary },
                      type.value === 'Election / Voting' && userRole !== 'chairperson' && { borderColor: colors.textTertiary }
                    ]}>
                      {pollForm.type === type.value && (
                        <View style={[styles.radioInner, { backgroundColor: colors.surface }]} />
                      )}
                    </View>
                    <View style={[styles.radioContent, isDesktop && styles.radioContentDesktop]}>
                      <Text style={[
                        styles.radioLabel,
                        isDesktop && styles.radioLabelDesktop,
                        { color: colors.text },
                        type.value === 'Election / Voting' && userRole !== 'chairperson' && { color: colors.textTertiary }
                      ]}>
                        {type.label}
                      </Text>
                      <Text style={[
                        styles.radioDescription,
                        isDesktop && styles.radioDescriptionDesktop,
                        { color: colors.textSecondary },
                        type.value === 'Election / Voting' && userRole !== 'chairperson' && { color: colors.textTertiary }
                      ]}>
                        {type.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Role Escalation Fields */}
            {pollForm.type === 'Election / Voting' && (
              <>
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Select Candidate Member *
                  </Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      { backgroundColor: colors.surface, color: colors.text },
                      isDesktop && styles.formInputDesktop
                    ]}
                    value={memberSearchQuery}
                    onChangeText={handleMemberSearch}
                    placeholder="Search members by name, email, or role"
                    placeholderTextColor={colors.textSecondary}
                    accessibilityLabel="Member search input"
                    accessibilityHint="Type to search for chama members"
                  />

                  {/* Member Search Results */}
                  {filteredMembers.length > 0 && memberSearchQuery && (
                    <View style={[
                      styles.searchResults,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      isDesktop && styles.searchResultsDesktop
                    ]}>
                      {filteredMembers.slice(0, isDesktop ? 8 : 5).map((member) => {
                        const memberId = member.user_id || member.userId;
                        const isSelected = roleForm.candidateIds.includes(memberId);

                        return (
                          <TouchableOpacity
                            key={memberId || member.id}
                            style={[
                              styles.searchResultItem,
                              { borderBottomColor: colors.border },
                              isDesktop && styles.searchResultItemDesktop
                            ]}
                            onPress={() => handleSelectCandidate(member)}
                            disabled={isSelected}
                            accessibilityLabel={`Select ${getMemberName(member)}`}
                            accessibilityHint={isSelected ? 'Already selected' : 'Tap to select this member'}
                          >
                            <View style={styles.memberInfo}>
                              <Text style={[
                                styles.memberName,
                                isDesktop && styles.memberNameDesktop,
                                { color: isSelected ? colors.textSecondary : colors.text }
                              ]}>
                                {getMemberName(member)}
                                {isSelected && ' ✓'}
                              </Text>
                              <Text style={[
                                styles.memberDetails,
                                isDesktop && styles.memberDetailsDesktop,
                                { color: colors.textSecondary }
                              ]}>
                                {member.role} • {getMemberEmail(member)}
                              </Text>
                            </View>
                            {isSelected && (
                              <View style={[styles.selectedIndicator, { backgroundColor: colors.success }]}>
                                <Ionicons name="checkmark" size={16} color={colors.surface} />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {/* Selected Candidates Display */}
                  {roleForm.selectedCandidates.length > 0 && (
                    <View style={styles.selectedCandidatesContainer}>
                      <Text style={[styles.selectedCandidatesTitle, { color: colors.text }]}>
                        Selected Candidates ({roleForm.selectedCandidates.length}):
                      </Text>
                      {roleForm.selectedCandidates.map((candidate, index) => (
                        <View key={candidate.user_id || candidate.userId || index} style={[styles.selectedCandidate, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                          <Text style={[styles.selectedCandidateText, { color: colors.text }]}>
                            {getMemberName(candidate)} ({candidate.role})
                          </Text>
                          <TouchableOpacity
                            onPress={() => {
                              const memberId = candidate.user_id || candidate.userId;
                              setRoleForm(prev => ({
                                ...prev,
                                candidateIds: prev.candidateIds.filter(id => id !== memberId),
                                selectedCandidates: prev.selectedCandidates.filter(c =>
                                  (c.user_id || c.userId) !== memberId
                                ),
                              }));
                            }}
                          >
                            <Ionicons name="close-circle" size={20} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Requested Role *
                  </Text>
                  <View style={styles.radioGroup}>
                    {[
                      { value: 'chairperson', label: 'Chairperson' },
                      { value: 'secretary', label: 'Secretary' },
                      { value: 'treasurer', label: 'Treasurer' },
                      { value: 'member', label: 'Member (Demotion)' },
                    ].map((role) => (
                      <TouchableOpacity
                        key={role.value}
                        style={styles.radioOption}
                        onPress={() => setRoleForm(prev => ({ ...prev, requestedRole: role.value }))}
                      >
                        <View style={[
                          styles.radioCircle,
                          { borderColor: colors.primary },
                          roleForm.requestedRole === role.value && { backgroundColor: colors.primary }
                        ]}>
                          {roleForm.requestedRole === role.value && (
                            <View style={[styles.radioInner, { backgroundColor: colors.surface }]} />
                          )}
                        </View>
                        <Text style={[styles.radioLabel, { color: colors.text }]}>
                          {role.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Justification
                  </Text>
                  <TextInput
                    style={[styles.formInput, styles.textArea, { backgroundColor: colors.surface, color: colors.text }]}
                    value={roleForm.justification}
                    onChangeText={(text) => setRoleForm(prev => ({ ...prev, justification: text }))}
                    placeholder="Explain why this role change is needed"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={4}
                  />
                </View>
              </>
            )}

            {/* Regular Poll Options */}
            {pollForm.type !== 'Election / Voting' && (
              <View style={styles.formGroup}>
                <Text style={[
                  styles.formLabel,
                  { color: colors.text },
                  isDesktop && styles.formLabelDesktop
                ]}>
                  Poll Options *
                </Text>
                <View style={[styles.optionsContainer, isDesktop && styles.optionsContainerDesktop]}>
                  {pollForm.options.map((option, index) => (
                    <View key={index} style={[
                      styles.optionInputContainer,
                      isDesktop && styles.optionInputContainerDesktop
                    ]}>
                      <TextInput
                        style={[
                          styles.formInput,
                          styles.optionInput,
                          { backgroundColor: colors.surface, color: colors.text },
                          isDesktop && styles.formInputDesktop
                        ]}
                        value={option}
                        onChangeText={(text) => updatePollOption(index, text)}
                        placeholder={`Option ${index + 1}`}
                        placeholderTextColor={colors.textSecondary}
                        accessibilityLabel={`Poll option ${index + 1}`}
                        accessibilityHint="Enter text for this poll option"
                      />
                      {pollForm.options.length > 2 && (
                        <TouchableOpacity
                          onPress={() => removePollOption(index)}
                          style={styles.removeOptionButton}
                          accessibilityLabel={`Remove option ${index + 1}`}
                          accessibilityHint="Tap to remove this poll option"
                        >
                          <Ionicons name="close-circle" size={24} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>

                {pollForm.options.length < 10 && (
                  <TouchableOpacity
                    onPress={addPollOption}
                    style={[
                      styles.addOptionButton,
                      { borderColor: colors.primary },
                      isDesktop && styles.addOptionButtonDesktop
                    ]}
                    accessibilityLabel="Add poll option"
                    accessibilityHint="Tap to add another option to your poll"
                  >
                    <Ionicons name="add" size={20} color={colors.primary} />
                    <Text style={[styles.addOptionText, { color: colors.primary }]}>
                      Add Option
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <Button
              title="Create Poll"
              onPress={handleCreatePoll}
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                isDesktop && styles.submitButtonDesktop
              ]}
              accessibilityLabel="Create poll button"
              accessibilityHint="Tap to create your poll with the entered information"
            />
          </ScrollView>
        </Animated.View>
      </>
    )}

      {/* Role Escalation Modal */}
      <Modal
        visible={showRoleModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              onPress={() => setShowRoleModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Election/Voting
            </Text>
            <View style={styles.modalCloseButton} />
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Select Candidate Member *
              </Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.surface, color: colors.text }]}
                value={memberSearchQuery}
                onChangeText={handleMemberSearch}
                placeholder="Search members by name, email, or role"
                placeholderTextColor={colors.textSecondary}
              />

              {/* Member Search Results */}
              {filteredMembers.length > 0 && memberSearchQuery && (
                <View style={[styles.searchResults, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {filteredMembers.slice(0, 5).map((member) => (
                    <TouchableOpacity
                      key={member.user_id || member.userId || member.id}
                      style={[styles.searchResultItem, { borderBottomColor: colors.border }]}
                      onPress={() => handleSelectCandidate(member)}
                    >
                      <View style={styles.memberInfo}>
                        <Text style={[styles.memberName, { color: colors.text }]}>
                          {getMemberName(member)}
                        </Text>
                        <Text style={[styles.memberDetails, { color: colors.textSecondary }]}>
                          {member.role} • {getMemberEmail(member)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Selected Candidate Display */}
              {roleForm.selectedCandidate && (
                <View style={[styles.selectedCandidate, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                  <Text style={[styles.selectedCandidateText, { color: colors.text }]}>
                    Selected: {getMemberName(roleForm.selectedCandidate)} ({roleForm.selectedCandidate.role})
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setRoleForm(prev => ({ ...prev, candidateId: '', selectedCandidate: null }));
                      setMemberSearchQuery('');
                      setFilteredMembers(chamaMembers);
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Requested Role *
              </Text>
              <View style={styles.radioGroup}>
                {[
                  { value: 'chairperson', label: 'Chairperson' },
                  { value: 'secretary', label: 'Secretary' },
                  { value: 'treasurer', label: 'Treasurer' },
                  { value: 'member', label: 'Member (Demotion)' },
                ].map((role) => (
                  <TouchableOpacity
                    key={role.value}
                    style={styles.radioOption}
                    onPress={() => setRoleForm(prev => ({ ...prev, requestedRole: role.value }))}
                  >
                    <View style={[
                      styles.radioCircle,
                      { borderColor: colors.primary },
                      roleForm.requestedRole === role.value && { backgroundColor: colors.primary }
                    ]}>
                      {roleForm.requestedRole === role.value && (
                        <View style={[styles.radioInner, { backgroundColor: colors.surface }]} />
                      )}
                    </View>
                    <Text style={[styles.radioLabel, { color: colors.text }]}>
                      {role.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Justification
              </Text>
              <TextInput
                style={[styles.formInput, styles.textArea, { backgroundColor: colors.surface, color: colors.text }]}
                value={roleForm.justification}
                onChangeText={(text) => setRoleForm(prev => ({ ...prev, justification: text }))}
                placeholder="Explain why this role change is needed"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
              />
            </View>

            <Button
              title="Create Role Escalation Poll"
              onPress={handleCreateRoleEscalation}
              style={[styles.submitButton, { backgroundColor: colors.warning }]}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Visualization Modal */}
      {showVisualizationModal && (
        <>
          {/* Backdrop */}
          <View style={styles.modalBackdrop}>
            <TouchableOpacity
              style={styles.modalBackdropTouchable}
              onPress={closeVisualizationModal}
              activeOpacity={1}
            />
          </View>

          {/* Modal Content */}
          <View style={[styles.visualizationModalContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { backgroundColor: colors.surface }]}>
              <View style={styles.modalCloseButton} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Poll Details & Results
              </Text>
              <TouchableOpacity
                onPress={closeVisualizationModal}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
              {selectedVisualizationPoll && (
                <View>
                  {/* Poll Header Info */}
                  <View style={styles.pollDetailHeader}>
                    <Text style={[styles.pollDetailTitle, { color: colors.text }]}>
                      {selectedVisualizationPoll.title}
                    </Text>
                    <View style={[styles.pollTypeBadge, { backgroundColor: getPollTypeColor(selectedVisualizationPoll.type) + '15' }]}>
                      <Text style={[styles.pollTypeText, { color: getPollTypeColor(selectedVisualizationPoll.type) }]}>
                        {selectedVisualizationPoll.type.replace('_', ' ')}
                      </Text>
                    </View>
                  </View>

                  {selectedVisualizationPoll.description && (
                    <Text style={[styles.pollDetailDescription, { color: colors.textSecondary }]}>
                      {selectedVisualizationPoll.description}
                    </Text>
                  )}

                  {/* Poll Stats */}
                  <View style={[styles.pollDetailStats, !isDesktop && { flexDirection: 'column', alignItems: 'stretch' }]}>
                    <View style={[styles.statItem, !isDesktop && { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        Total Votes:
                      </Text>
                      <Text style={[styles.statValue, { color: colors.primary }]}>
                        {getTotalVotesCast(selectedVisualizationPoll)}/{getTotalEligibleVoters(selectedVisualizationPoll)}
                      </Text>
                    </View>
                    <View style={[styles.statItem, !isDesktop && { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        Ended:
                      </Text>
                      <Text style={[styles.statValue, { color: colors.textSecondary }]}>
                        {formatDate(selectedVisualizationPoll.endsAt, 'datetime')}
                      </Text>
                    </View>
                    <View style={[styles.statItem, !isDesktop && { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        Status:
                      </Text>
                      <Text style={[styles.statValue, { color: getStatusColor(selectedVisualizationPoll.status, selectedVisualizationPoll.result) }]}>
                        {selectedVisualizationPoll.result === 'completed_early' ? 'Completed Early' : selectedVisualizationPoll.result || 'Completed'}
                      </Text>
                    </View>
                  </View>

                  {/* Visualizations */}
                  {renderPollVisualizations(selectedVisualizationPoll)}

                  {/* Poll Options with Vote Counts */}
                  <View style={styles.pollOptionsDetail}>
                    <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 16 }]}>
                      Voting Options
                    </Text>
                    {selectedVisualizationPoll.options.map((option, index) => {
                      const totalVotes = getTotalVotesCast(selectedVisualizationPoll);
                      const percentage = getVotePercentage(option.voteCount, totalVotes);
                      return (
                        <View key={option.id || index} style={[styles.optionDetailItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <View style={styles.optionDetailContent}>
                            <Text style={[styles.optionDetailText, { color: colors.text }]}>
                              {option.text || option.option_text}
                            </Text>
                            <Text style={[styles.optionDetailVotes, { color: colors.textSecondary }]}>
                              {option.voteCount || 0} votes ({percentage}%)
                            </Text>
                          </View>
                          <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                              <View style={[styles.progressFill, {
                                width: `${percentage}%`,
                                backgroundColor: colors.primary
                              }]} />
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingButtonContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  floatingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  addButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
  },
  groupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 100,
    marginHorizontal: 2,
  },
  groupButtonActive: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  groupButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tabText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '500',
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginLeft: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  roleButtonText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '500',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  pollCard: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  pollInfo: {
    flex: 1,
    marginRight: 12,
  },
  pollTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  pollCreator: {
    fontSize: 14,
  },
  pollTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pollTypeText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  pollDescription: {
    fontSize: 14,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  pollStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
  },
  optionsContainer: {
    marginBottom: 12,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  votableOption: {
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  voteIconContainer: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    minHeight: 40,
  },
  anonymousIndicator: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIndicator: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  optionContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionText: {
    fontSize: 14,
    flex: 1,
  },
  optionVotes: {
    fontSize: 12,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  votedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  votedText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  pollMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pollDate: {
    fontSize: 12,
  },
  pollBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  anonymousBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  anonymousText: {
    marginLeft: 4,
    fontSize: 10,
    fontWeight: '500',
  },

  canVoteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  canVoteText: {
    marginLeft: 4,
    fontSize: 10,
    fontWeight: '500',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedText: {
    marginLeft: 4,
    fontSize: 10,
    fontWeight: '500',
  },
  votingStatusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  votingStatusText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 24,
  },
  modalContainer: {
    position: 'absolute',
    top: '5%',
    bottom: '5%',
    left: 20,
    right: 20,
    zIndex: 1001,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  visualizationModalContainer: {
    position: 'absolute',
    top: '10%',
    bottom: '10%',
    left: 20,
    right: 20,
    zIndex: 1002,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  modalContainerMobile: {
    right: 0,
    width: '100%',
  },
  modalContainerDesktop: {
    right: 0,
    width: 480,
    maxWidth: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalCloseButton: {
    padding: 8,
    width: 40,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 16,
  },
  // Modal overlay styles
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  modalBackdropTouchable: {
    flex: 1,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 44, // Ensure proper touch targets
  },
  formInputDesktop: {
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  radioGroup: {
    gap: 12,
  },
  radioGroupDesktop: {
    gap: 16,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  radioLabel: {
    fontSize: 16,
  },
  optionInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionInput: {
    flex: 1,
    marginRight: 8,
  },
  removeOptionButton: {
    padding: 4,
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    marginTop: 8,
  },
  addOptionText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    marginTop: 24,
  },
  submitButtonDesktop: {
    marginTop: 32,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  disabledOption: {
    opacity: 0.5,
  },
  radioContent: {
    flex: 1,
    marginLeft: 8,
  },
  radioDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  searchResults: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 200,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberDetails: {
    fontSize: 14,
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCandidatesContainer: {
    marginTop: 8,
  },
  selectedCandidatesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  selectedCandidate: {
    marginTop: 4,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedCandidateText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  // Visualization styles
  visualizationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  visualizationToggleText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  fullyVotedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  fullyVotedText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  visualizationsContainer: {
    marginTop: 8,
    marginBottom: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  visualizationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  chartsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  chartItem: {
    alignItems: 'center',
    marginBottom: 12,
    minWidth: 120,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  pieChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
  },
  progressText: {
    fontSize: 10,
    textAlign: 'center',
  },
  // Desktop-specific styles
  listContentDesktop: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  emptyContainerDesktop: {
    paddingVertical: 80,
  },
  emptyTextDesktop: {
    fontSize: 18,
    marginTop: 20,
    marginBottom: 32,
  },
  emptyButtonDesktop: {
    paddingHorizontal: 32,
    minWidth: 200,
  },
  // Desktop header styles
  headerDesktop: {
    paddingHorizontal: 32,
    paddingVertical: 20,
    minHeight: 80,
  },
  backButtonDesktop: {
    padding: 12,
  },
  headerCenterDesktop: {
    flex: 1,
    marginHorizontal: 24,
  },
  headerTitleDesktop: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitleDesktop: {
    fontSize: 13,
    marginTop: 4,
  },
  addButtonDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Desktop tab styles
  tabContainerDesktop: {
    borderRadius: 12,
    padding: 8,
  },
  groupButtonDesktop: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 120,
  },
  groupButtonTextDesktop: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  tabDesktop: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  tabTextDesktop: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
  // Desktop modal styles
  modalHeaderDesktop: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  modalCloseButtonDesktop: {
    padding: 12,
  },
  modalTitleDesktop: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalContentDesktop: {
    maxHeight: '80vh',
  },
  modalContentContainerDesktop: {
    padding: 24,
  },
  // Desktop visualization styles
  visualizationsContainerDesktop: {
    marginTop: 16,
    marginBottom: 20,
    padding: 24,
    borderRadius: 12,
  },
  visualizationTitleDesktop: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  chartsContainerDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  chartItemDesktop: {
    marginBottom: 24,
    minWidth: 280,
    flex: 1,
    marginHorizontal: 8,
  },
  chartTitleDesktop: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  legendContainerDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
  },
  legendTextDesktop: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Desktop poll card styles
  pollCardDesktop: {
    padding: 24,
    marginBottom: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  pollTitleDesktop: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  pollDescriptionDesktop: {
    fontSize: 15,
    marginBottom: 16,
  },
  pollStatsDesktop: {
    paddingVertical: 16,
    marginBottom: 20,
  },
  statValueDesktop: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabelDesktop: {
    fontSize: 13,
    marginTop: 4,
  },
  optionsContainerDesktop: {
    marginBottom: 16,
  },
  optionItemDesktop: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  optionTextDesktop: {
    fontSize: 15,
    flex: 1,
  },
  optionVotesDesktop: {
    fontSize: 13,
  },
  // Desktop form styles
  radioGroupDesktop: {
    gap: 16,
  },
  radioOptionDesktop: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  radioCircleDesktop: {
    width: 24,
    height: 24,
    marginRight: 16,
  },
  radioContentDesktop: {
    flex: 1,
  },
  radioLabelDesktop: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  radioDescriptionDesktop: {
    fontSize: 14,
  },
  // Desktop search styles
  searchResultsDesktop: {
    maxHeight: 300,
  },
  searchResultItemDesktop: {
    padding: 16,
  },
  memberNameDesktop: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  memberDetailsDesktop: {
    fontSize: 14,
  },
  // Desktop form label styles
  formLabelDesktop: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionsContainerDesktop: {
    gap: 12,
  },
  optionInputContainerDesktop: {
    marginBottom: 0,
  },
  addOptionButtonDesktop: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalCloseButton: {
    padding: 8,
    width: 40,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 16,
  },
  // Table styles for completed polls
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  tableCell: {
    flex: 1,
    fontSize: 8.5,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  actionCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  paginationButton: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Poll Detail Modal Styles
  pollDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  pollDetailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 12,
  },
  pollDetailDescription: {
    fontSize: 14,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  pollDetailStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  pollOptionsDetail: {
    marginTop: 20,
  },
  optionDetailItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  optionDetailContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionDetailText: {
    fontSize: 14,
    flex: 1,
  },
  optionDetailVotes: {
    fontSize: 12,
  },
  statValue: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  progressBarContainer: {
    marginTop: 8,
  },
});

export default PollsVotingScreen;
