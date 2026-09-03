import { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import ApiService from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isMemberLeft,
  getMemberName,
  getMemberShortName,
  formatCurrency,
} from '../utils/merryGoRoundHelpers';

const useMerryGoRoundScreen = ({ route }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const { chamaId: routeChamaId, newMerryGoRound, refresh } = route.params || {};

  const chamaId = routeChamaId || currentChamaId;

  // Cache config
  const MGR_CACHE_KEY = `cached_merry_gorounds_${chamaId}`;
  const MGR_CACHE_TTL = 5 * 60 * 1000;

  // State
  const [merryGoRounds, setMerryGoRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRound, setSelectedRound] = useState(null);
  const [contributorFilter, setContributorFilter] = useState('all');
  const [contributorSearch, setContributorSearch] = useState('');
  const [roundContributions, setRoundContributions] = useState([]);
  const [selectedRecipientPosition, setSelectedRecipientPosition] = useState(null);

  // Refs
  const selectedRoundRef = useRef(selectedRound);
  const selectedRecipientPositionRef = useRef(selectedRecipientPosition);

  useEffect(() => { selectedRoundRef.current = selectedRound; }, [selectedRound]);
  useEffect(() => { selectedRecipientPositionRef.current = selectedRecipientPosition; }, [selectedRecipientPosition]);

  // --- Cache helpers ---
  const loadCachedMerryGoRounds = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem(MGR_CACHE_KEY);
      if (cached) {
        const { rounds, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < MGR_CACHE_TTL) {
          if (Array.isArray(rounds) && rounds.length) setMerryGoRounds(rounds);
          return true;
        }
      }
    } catch (error) {
      // Silent fail for cache read
    }
    return false;
  }, [chamaId]);

  const cacheMerryGoRounds = useCallback(async (rounds) => {
    try {
      await AsyncStorage.setItem(MGR_CACHE_KEY, JSON.stringify({
        rounds,
        timestamp: Date.now(),
      }));
    } catch (error) {
      // Silent fail for cache write
    }
  }, [chamaId]);

  // --- Data loading ---
  const loadMerryGoRounds = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ApiService.getMerryGoRounds(chamaId);
      if (response.success) {
        let rounds = response.data || [];
        const userId = user?.id;
        if (userId) {
          rounds = rounds.filter(round => {
            const participants = round.members || round.participants || [];
            return participants.some(p => (p.user_id || p.user?.id) === userId);
          });
        }
        setMerryGoRounds(rounds);
        cacheMerryGoRounds(rounds);
        if (rounds.length > 0) {
          const current = selectedRoundRef.current;
          const updated = rounds.find(r => r.id === (current && current.id));
          setSelectedRound(updated || rounds[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load merry-go-rounds:', error);
    } finally {
      setLoading(false);
    }
  }, [chamaId, user?.id, cacheMerryGoRounds]);

  const loadRoundContributions = useCallback(async () => {
    const currentRound = selectedRoundRef.current;
    if (!currentRound) return;
    try {
      let allContributions = [];

      const contribResponse = await ApiService.getContributions(chamaId);
      if (contribResponse.success && contribResponse.data) {
        allContributions = [...allContributions, ...(contribResponse.data || [])];
      }

      // Optional payments endpoint: silently ignore 404s and other non-critical failures.
      try {
        const paymentsResponse = await ApiService.makeRequest(`/merry-go-rounds/${currentRound.id}/payments`);
        if (paymentsResponse.success && paymentsResponse.data) {
          allContributions = [...allContributions, ...(paymentsResponse.data || [])];
        }
      } catch (paymentsError) {
        const msg = (paymentsError.message || '').toLowerCase();
        const is404 = msg.includes('404') || msg.includes('not found');
        if (!is404) {
          console.error('Unexpected error loading merry-go-round payments:', paymentsError);
        }
      }

      const txResponse = await ApiService.getChamaTransactions(chamaId, 100, 0);
      if (txResponse.success && txResponse.data) {
        const merryTx = (txResponse.data || []).filter(item => {
          const isContribution = item.type === 'contribution' || item.transaction_type === 'contribution';
          const isMgr = item.metadata?.contributionType === 'merry-go-round'
            || item.metadata?.type === 'merry-go-round'
            || item.transaction_type === 'merry-go-round';
          return isContribution && isMgr;
        });
        allContributions = [...allContributions, ...merryTx];
      }

      setRoundContributions(allContributions);
    } catch (error) {
      console.error('Failed to load round contributions:', error);
    }
  }, [chamaId]);

  // --- Effects ---
  useEffect(() => {
    const initialize = async () => {
      await loadCachedMerryGoRounds();
      await loadMerryGoRounds();
    };
    initialize();
  }, [chamaId, loadCachedMerryGoRounds, loadMerryGoRounds]);

  useFocusEffect(
    useCallback(() => {
      loadMerryGoRounds();
    }, [chamaId, loadMerryGoRounds])
  );

  useEffect(() => {
    if (selectedRound) {
      loadRoundContributions();
    }
  }, [selectedRound, loadRoundContributions]);

  // --- Handlers ---
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMerryGoRounds();
    if (selectedRoundRef.current) {
      await loadRoundContributions();
    }
    setRefreshing(false);
  }, [loadMerryGoRounds, loadRoundContributions]);

  const handleSelectRound = useCallback((round) => {
    setSelectedRound(round);
    setContributorSearch('');
    setContributorFilter('all');
    setSelectedRecipientPosition(null);
  }, []);

  // --- Helpers ---
  const getTargetRecipient = useCallback(() => {
    if (!selectedRound) return null;
    const participants = selectedRound.members || selectedRound.participants || [];
    const currentPosition = selectedRound.current_position || selectedRound.currentRound || 1;
    const currentParticipant = participants.find(p => (p.status || 'pending') === 'current');
    const currentPositionFromStatus = currentParticipant ? participants.indexOf(currentParticipant) + 1 : currentPosition;

    const position = selectedRecipientPositionRef.current || currentPositionFromStatus;
    const targetParticipant = participants[position - 1];
    const recipientMember = targetParticipant ? (targetParticipant.user || targetParticipant) : null;
    const recipientId = recipientMember ? (targetParticipant.user_id || (targetParticipant.user && targetParticipant.user.id)) : null;

    return {
      position,
      recipientId,
      recipientName: recipientMember ? getMemberName(recipientMember) : '',
      isRecipientView: selectedRecipientPositionRef.current !== null,
    };
  }, [selectedRound]);

  const getRowData = useCallback(() => {
    if (!selectedRound) return [];
    const participants = selectedRound.members || selectedRound.participants || [];
    const amountPerRound = selectedRound.amount_per_round || selectedRound.amountPerRound || 0;

    const currentParticipant = participants.find(p => (p.status || 'pending') === 'current');
    const currentPosition = currentParticipant ? participants.indexOf(currentParticipant) + 1 : (selectedRound.current_position || selectedRound.currentRound || 1);
    const roundComplete = selectedRound.roundComplete || false;

    const target = getTargetRecipient() || {
      position: currentPosition,
      recipientId: participants[currentPosition - 1]
        ? (participants[currentPosition - 1].user_id || (participants[currentPosition - 1].user && participants[currentPosition - 1].user.id))
        : null,
      recipientName: '',
      isRecipientView: false,
    };
    const currentRecipientId = target.recipientId;
    const currentRecipientName = target.recipientName;

    const thisRoundContributions = roundContributions.filter(c => {
      const roundIdMatch = c.roundId === selectedRound.id ||
                          c.merry_go_round_id === selectedRound.id ||
                          c.merryGoRoundId === selectedRound.id ||
                          c.metadata?.roundId === selectedRound.id ||
                          c.metadata?.merryGoRoundId === selectedRound.id;
      return roundIdMatch;
    });

    const fulfilledUserIds = new Set(
      thisRoundContributions
        .flatMap(c => {
          const userIds = [];
          if (c.initiated_by) userIds.push(c.initiated_by);
          if (c.recipient_id) userIds.push(c.recipient_id);
          if (c.user_id) userIds.push(c.user_id);
          if (c.contributorId) userIds.push(c.contributorId);
          if (c.contributor_id) userIds.push(c.contributor_id);
          if (c.metadata?.contributorId) userIds.push(c.metadata.contributorId);
          if (c.participant_id) userIds.push(c.participant_id);
          if (c.metadata?.participantId) userIds.push(c.metadata.participantId);
          if (c.metadata?.recipientId) userIds.push(c.metadata.recipientId);
          if (c.participant?.user_id) userIds.push(c.participant.user_id);
          if (c.participant?.id) userIds.push(c.participant.id);
          if (c.contributorUserId) userIds.push(c.contributorUserId);
          if (c.payerUserId) userIds.push(c.payerUserId);
          if (c.payeeUserId) userIds.push(c.payeeUserId);
          return userIds;
        })
        .filter(id => id)
    );

    const paidToRecipientUserIds = new Set(
      thisRoundContributions
        .filter(c => {
          const roundMatches = c.roundNumber === target.position || c.round_number === target.position || c.metadata?.roundNumber === target.position;
          const recipientMatches = c.payeeUserId === target.recipientId || c.payee_user_id === target.recipientId || c.metadata?.recipientId === target.recipientId;
          return roundMatches && recipientMatches;
        })
        .flatMap(c => {
          const userIds = [];
          if (c.initiated_by) userIds.push(c.initiated_by);
          if (c.user_id) userIds.push(c.user_id);
          if (c.contributorId) userIds.push(c.contributorId);
          if (c.contributor_id) userIds.push(c.contributor_id);
          if (c.metadata?.contributorId) userIds.push(c.metadata.contributorId);
          if (c.participant_id) userIds.push(c.participant_id);
          if (c.metadata?.participantId) userIds.push(c.metadata.participantId);
          if (c.participant?.user_id) userIds.push(c.participant.user_id);
          if (c.participant?.id) userIds.push(c.participant.id);
          if (c.contributorUserId) userIds.push(c.contributorUserId);
          if (c.payerUserId) userIds.push(c.payerUserId);
          return userIds;
        })
        .filter(id => id)
    );

    return participants.map((p, idx) => {
      const position = idx + 1;
      const member = p.user || p;
      const userId = p.user_id || (p.user && p.user.id);
      const hasReceivedDisbursement = p.has_received === true || p.hasReceived === true;
      const memberLeft = isMemberLeft(p);

      const hasContributed = p.has_contributed_this_cycle ||
                            p.has_contributed ||
                            fulfilledUserIds.has(userId) ||
                            (!roundComplete && position < currentPosition);

      const paidToCurrent = paidToRecipientUserIds.has(userId);
      const hasBeenPaidOut = position < currentPosition && hasReceivedDisbursement;

      const recipientName = target.isRecipientView
        ? (paidToCurrent ? target.recipientName : '')
        : (hasContributed && getMemberName(member) !== currentRecipientName ? currentRecipientName : '');
      const recipientDisplay = hasBeenPaidOut ? '—' : recipientName;

      const eligibleToContributeToAll = position <= currentPosition || roundComplete;

      return {
        id: p.id || `${selectedRound.id}-${position}`,
        name: getMemberName(member),
        position,
        role: hasBeenPaidOut ? 'Paid' : position === currentPosition ? 'Current' : position < currentPosition ? 'Completed' : 'Pending',
        contributed: hasContributed,
        amount: hasContributed ? amountPerRound : 0,
        eligibleToContributeToAll,
        paidToCurrent,
        paidToRecipient: paidToCurrent,
        isRecipientView: target.isRecipientView,
        recipientPosition: target.position,
        recipientName: target.recipientName,
        hasReceivedDisbursement,
        hasBeenPaidOut,
        recipientDisplay,
        memberLeft,
      };
    });
  }, [selectedRound, roundContributions, getTargetRecipient]);

  const getPayoutDate = useCallback((row) => {
    if (!selectedRound) return '—';
    const participants = selectedRound.members || selectedRound.participants || [];
    const currentParticipant = participants.find(p => (p.status || 'pending') === 'current');
    const currentPos = currentParticipant ? participants.indexOf(currentParticipant) + 1 : (selectedRound.current_position || selectedRound.currentRound || 1);
    const frequency = selectedRound.frequency || 'monthly';
    const cyclesAway = row.position >= currentPos ? (row.position - currentPos) : 0;

    const date = new Date();
    if (frequency === 'weekly') date.setDate(date.getDate() + cyclesAway * 7);
    else if (frequency === 'biweekly') date.setDate(date.getDate() + cyclesAway * 14);
    else date.setMonth(date.getMonth() + cyclesAway);

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [selectedRound]);

  return {
    theme,
    user,
    chamaId,
    merryGoRounds,
    loading,
    refreshing,
    selectedRound,
    selectedRoundRef,
    contributorFilter,
    setContributorFilter,
    contributorSearch,
    setContributorSearch,
    roundContributions,
    selectedRecipientPosition,
    setSelectedRecipientPosition,
    selectedRecipientPositionRef,
    onRefresh,
    handleSelectRound,
    loadMerryGoRounds,
    loadRoundContributions,
    formatCurrency,
    getMemberName,
    getMemberShortName,
    isMemberLeft,
    getTargetRecipient,
    getRowData,
    getPayoutDate,
  };
};

export default useMerryGoRoundScreen;
