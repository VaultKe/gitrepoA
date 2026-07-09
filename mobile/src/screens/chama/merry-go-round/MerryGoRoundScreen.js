import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Dimensions,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import { useFocusEffect } from '@react-navigation/native';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import BorderedButton from '../../../components/BorderedButton';
import { ButtonGrid } from '../../../components/ButtonGroup';
import ApiService from '../../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const MerryGoRoundScreen = ({ route, navigation, onRouteChange }) => {
  const { chamaId: routeChamaId, newMerryGoRound, refresh } = route.params || {};
  const { theme, user } = useApp();
  const { currentChamaId, selectedChama } = useChamaContext();
  const colors = getThemeColors(theme);

  const chamaId = routeChamaId || currentChamaId;

  // Cache-first loader (mirrors MyChamasScreen): show cached merry-go-rounds instantly, then refresh.
  const MGR_CACHE_KEY = `cached_merry_gorounds_${chamaId}`;
  const MGR_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  const loadCachedMerryGoRounds = async () => {
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
  };

  const cacheMerryGoRounds = async (rounds) => {
    try {
      await AsyncStorage.setItem(MGR_CACHE_KEY, JSON.stringify({
        rounds,
        timestamp: Date.now(),
      }));
    } catch (error) {
      // Silent fail for cache write
    }
  };

const [merryGoRounds, setMerryGoRounds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRound, setSelectedRound] = useState(null);
  const selectedRoundRef = useRef(selectedRound);
  useEffect(() => { selectedRoundRef.current = selectedRound; }, [selectedRound]);

  const [contributorFilter, setContributorFilter] = useState('all');
  const [contributorSearch, setContributorSearch] = useState('');
  const [roundContributions, setRoundContributions] = useState([]);

  // When set (1-based position), the Contributors table is reused to show who has paid that recipient
  const [selectedRecipientPosition, setSelectedRecipientPosition] = useState(null);
  const selectedRecipientRef = useRef(selectedRecipientPosition);
  useEffect(() => { selectedRecipientRef.current = selectedRecipientPosition; }, [selectedRecipientPosition]);

  const loadMerryGoRounds = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
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
        // Persist for instant display on next visit (cache-first loader)
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
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const hadCache = await loadCachedMerryGoRounds();
      await loadMerryGoRounds(hadCache);
    };
    initialize();
  }, [chamaId]);

  // Reload once when screen regains focus so stat card picks up backend advances without continuous polling
  useFocusEffect(
    React.useCallback(() => {
      loadMerryGoRounds();
    }, [chamaId])
  );

  useEffect(() => {
    if (selectedRound) {
      loadRoundContributions();
    }
  }, [selectedRound]);

  const loadRoundContributions = async () => {
    const currentRound = selectedRoundRef.current;
    if (!currentRound) return;
    try {
      let allContributions = [];

      const contribResponse = await ApiService.getContributions(chamaId);
      if (contribResponse.success && contribResponse.data) {
        allContributions = [...allContributions, ...(contribResponse.data || [])];
      }

      const paymentsResponse = await ApiService.makeRequest(`/merry-go-rounds/${currentRound.id}/payments`);
      if (paymentsResponse.success && paymentsResponse.data) {
        allContributions = [...allContributions, ...(paymentsResponse.data || [])];
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

      console.log('[MGR] Loaded', allContributions.length, 'contributions for round', currentRound.id);
      setRoundContributions(allContributions);
    } catch (error) {
      console.error('Failed to load round contributions:', error);
    }
  };

const onRefresh = async () => {
    setRefreshing(true);
    await loadMerryGoRounds();
    if (selectedRoundRef.current) {
      await loadRoundContributions();
    }
    setRefreshing(false);
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return 'KES 0';
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);
  };

  const getMemberName = (item) => {
    const userObj = item?.user || item || {};
    const firstName = userObj?.first_name || userObj?.firstName || item?.first_name || item?.firstName || '';
    const lastName = userObj?.last_name || userObj?.lastName || item?.last_name || item?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    if (!fullName) return userObj?.email || item?.email || `Member ${(item?.user_id || item?.id || '').slice(-4)}`;
    return fullName;
  };

  const getMemberShortName = (item) => {
    const userObj = item?.user || item || {};
    const firstName = userObj?.first_name || userObj?.firstName || item?.first_name || item?.firstName || '';
    const lastName = userObj?.last_name || userObj?.lastName || item?.last_name || item?.lastName || '';
    if (firstName && lastName) return `${firstName} ${lastName.charAt(0)}.`;
    return firstName || lastName || `Member ${(item?.user_id || item?.id || '').slice(-4)}`;
  };

  const getTargetRecipient = () => {
    if (!selectedRound) return null;
    const participants = selectedRound.members || selectedRound.participants || [];
    const currentParticipant = participants.find(p => (p.status || 'pending') === 'current');
    const currentPosition = currentParticipant ? participants.indexOf(currentParticipant) + 1 : (selectedRound.current_position || selectedRound.currentRound || 1);

    // When a recipient position is tapped, use it; otherwise fall back to the current recipient
    const position = selectedRecipientRef.current || currentPosition;
    const targetParticipant = participants[position - 1];
    const recipientMember = targetParticipant ? (targetParticipant.user || targetParticipant) : null;
    const recipientId = recipientMember ? (targetParticipant.user_id || (targetParticipant.user && targetParticipant.user.id)) : null;

    return {
      position,
      recipientId,
      recipientName: recipientMember ? getMemberName(recipientMember) : '',
      isRecipientView: selectedRecipientRef.current !== null,
    };
  };

  const renderMemberOrderList = () => {
    if (!selectedRound) return null;

    const participants = selectedRound.members || selectedRound.participants || [];
    const currentPosition = selectedRound.current_position || selectedRound.currentRound || 1;

    if (participants.length === 0) {
      return (
      <Card style={styles.statsCard} variant="outlined">
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Member Order
          </Text>
          <View style={styles.emptyMembersList}>
            <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyMembersText, { color: colors.textSecondary }]}>
              No participants added yet
            </Text>
          </View>
        </Card>
      );
    }

    return (
      <Card style={styles.statsCard} variant="outlined">
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Member Order ({participants.length} participants)
          </Text>
          <Ionicons name="hand-left-outline" size={18} color={colors.textTertiary} />
        </View>
        <Text style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.sm }}>
          Tap a member to see who has paid them
        </Text>
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 260 }}>
          <View style={styles.memberOrderList}>
            {participants.map((participant, index) => {
              const position = index + 1;
              const participantStatus = participant.status || 'pending';
              const isCurrent = participantStatus === 'current';
              const isCompleted = participantStatus === 'completed';
              const isPending = participantStatus === 'pending';

              const member = participant.user || participant;
              const firstName = member.first_name || member.firstName || '';
              const lastName = member.last_name || member.lastName || '';
              const fullName = `${firstName} ${lastName}`.trim() || `Member ${position}`;
              const initials = `${firstName[0] || 'M'}${lastName[0] || position}`.toUpperCase();

              const isSelectedRecipient = selectedRecipientPosition === position;

              return (
                <TouchableOpacity
                  key={participant.id || index}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedRecipientPosition(isSelectedRecipient ? null : position);
                    setContributorFilter('all');
                    setContributorSearch('');
                  }}
                  style={[
                    styles.memberOrderItem,
                    isSelectedRecipient && {
                      backgroundColor: colors.primary + '12',
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <View style={styles.memberRow}>
                    <View style={styles.avatarContainer}>
                      {index > 0 && (
                        <View style={[
                          styles.connectorLineTop,
                          { backgroundColor: isCompleted || isCurrent ? colors.primary : colors.border }
                        ]} />
                      )}

                      <View style={[
                        styles.memberAvatar,
                        {
                          backgroundColor: isCurrent ? colors.primary :
                                         isCompleted ? colors.success : colors.backgroundSecondary,
                          borderColor: isSelectedRecipient ? colors.primary :
                                       isCurrent ? colors.primary :
                                       isCompleted ? colors.success : colors.border,
                        }
                      ]}>
                        <Text style={[
                          styles.avatarText,
                          { color: isCurrent || isCompleted ? colors.white : colors.textSecondary }
                        ]}>
                          {initials}
                        </Text>
                      </View>

                      {index < participants.length - 1 && (
                        <View style={[
                          styles.connectorLineBottom,
                          { backgroundColor: isCompleted ? colors.primary : colors.border }
                        ]} />
                      )}

                      <View style={[
                        styles.statusIndicator,
                        {
                          backgroundColor: isCurrent ? colors.primary :
                                         isCompleted ? colors.success : colors.border
                        }
                      ]}>
                        {isCompleted && (
                          <Ionicons name="checkmark" size={12} color={colors.white} />
                        )}
                      </View>
                    </View>

                    <View style={styles.memberInfo}>
                      <Text style={[
                        styles.memberName,
                        {
                          color: isCurrent ? colors.primary : colors.text,
                          fontWeight: isCurrent ? 'bold' : 'normal'
                        }
                      ]}>
                        {fullName}
                      </Text>
                      <Text style={[styles.memberPosition, { color: colors.textSecondary }]}>
                        Position {position}
                      </Text>
                    </View>

                    {isSelectedRecipient ? (
                      <View style={[styles.statusBadge, { backgroundColor: colors.primary }]}>
                        <Ionicons name="eye" size={12} color={colors.white} />
                        <Text style={[styles.statusBadgeText, { color: colors.white }]}>
                          Viewing
                        </Text>
                      </View>
                    ) : (
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={colors.textTertiary}
                        style={{ marginLeft: spacing.sm }}
                      />
                    )}

                    {isCurrent && !isSelectedRecipient && (
                      <View style={[styles.statusBadge, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.statusBadgeText, { color: colors.white }]}>
                          Current
                        </Text>
                      </View>
                    )}

                    {isCompleted && !isSelectedRecipient && (
                      <View style={[styles.statusBadge, { backgroundColor: colors.success }]}>
                        <Text style={[styles.statusBadgeText, { color: colors.white }]}>
                          Completed
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </Card>
    );
  };

  const StatTile = ({ icon, label, value, color, subtext }) => (
    <View style={{ flex: 1, marginHorizontal: spacing.xs }}>
      <View style={{ padding: spacing.md, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
            <Ionicons name={icon} size={20} color={color} />
          </View>
          <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, flex: 1 }}>{label}</Text>
        </View>
        <Text style={{ fontSize: typography.fontSize.lg, fontWeight: 'bold', color: colors.text }}>{value}</Text>
        {subtext && <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs }}>{subtext}</Text>}
      </View>
    </View>
  );

  const renderCompactTop = () => {
    if (!selectedRound) return null;
    const participants = selectedRound.members || selectedRound.participants || [];
    const amountPerRound = selectedRound.amount_per_round || selectedRound.amountPerRound || 0;
    const totalPayoutPerPerson = amountPerRound * participants.length;

    // Find the actual current recipient from participant statuses, matching Member Order logic
    const currentParticipant = participants.find(p => (p.status || 'pending') === 'current');
    const currentMember = currentParticipant ? (currentParticipant.user || currentParticipant) : participants[0];

    return (
      <Card style={styles.statsCard} variant="outlined">
        <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <Text style={{ fontSize: typography.fontSize.lg, fontWeight: 'semibold', color: colors.text, flex: 1 }}>
              {selectedRound.name} Overview
            </Text>
            <TouchableOpacity
              onPress={async () => {
                await loadMerryGoRounds();
                if (selectedRoundRef.current) {
                  await loadRoundContributions();
                }
              }}
              style={{ padding: spacing.xs }}
            >
              <Ionicons name="refresh" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
            <StatTile icon="cash" label="Amount Per Period" value={formatCurrency(amountPerRound)} color={colors.primary} />
            <StatTile icon="people" label="Members" value={participants.length} color={colors.secondary} />
          </View>
          <View style={{ flexDirection: 'row' }}>
            <StatTile icon="wallet" label="Total Payout" value={formatCurrency(totalPayoutPerPerson)} color={colors.success} />
            <StatTile icon="person" label="Current Recipient" value={getMemberShortName(currentMember)} color={colors.warning} />
          </View>
        </View>
      </Card>
    );
  };

const getRowData = () => {
    if (!selectedRound) return [];
    const participants = selectedRound.members || selectedRound.participants || [];
    const amountPerRound = selectedRound.amount_per_round || selectedRound.amountPerRound || 0;

    // Find the actual current recipient from participant statuses, matching Member Order logic
    const currentParticipant = participants.find(p => (p.status || 'pending') === 'current');
    const currentPosition = currentParticipant ? participants.indexOf(currentParticipant) + 1 : (selectedRound.current_position || selectedRound.currentRound || 1);
    const roundComplete = selectedRound.roundComplete || false;

    // When a Member Order position is tapped, the table shows payments TO that recipient.
    // Otherwise it falls back to the current recipient (default behaviour).
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

    // Filter contributions to only this specific merry-go-round round
    const thisRoundContributions = roundContributions.filter(c => {
      const roundIdMatch = c.roundId === selectedRound.id ||
                          c.merry_go_round_id === selectedRound.id ||
                          c.merryGoRoundId === selectedRound.id ||
                          c.metadata?.roundId === selectedRound.id ||
                          c.metadata?.merryGoRoundId === selectedRound.id;
      return roundIdMatch;
    });

    // Build a map of user IDs whose contribution obligation is fulfilled for THIS ROUND
    const fulfilledUserIds = new Set(
      thisRoundContributions
        .flatMap(c => {
          const userIds = [];
          // For transactions: initiated_by is the contributor
          if (c.initiated_by) userIds.push(c.initiated_by);
          // Also check recipient_id
          if (c.recipient_id) userIds.push(c.recipient_id);
          // For regular contributions: user_id is the contributor
          if (c.user_id) userIds.push(c.user_id);
          // For pay_for contributions: contributorId is who was paid for (their obligation is fulfilled)
          if (c.contributorId) userIds.push(c.contributorId);
          if (c.contributor_id) userIds.push(c.contributor_id);
          if (c.metadata?.contributorId) userIds.push(c.metadata.contributorId);
          // Also check for participant ID in merry-go-round transactions
          if (c.participant_id) userIds.push(c.participant_id);
          if (c.metadata?.participantId) userIds.push(c.metadata.participantId);
          if (c.metadata?.recipientId) userIds.push(c.metadata.recipientId);
          // Check participant.user_id for nested participant structure
          if (c.participant?.user_id) userIds.push(c.participant.user_id);
          if (c.participant?.id) userIds.push(c.participant.id);
          // For merry_go_round_payments endpoint response
          if (c.contributorUserId) userIds.push(c.contributorUserId);
          if (c.payerUserId) userIds.push(c.payerUserId);
          if (c.payeeUserId) userIds.push(c.payeeUserId);
          return userIds;
        })
        .filter(id => id)
    );

    // Build a set of user IDs who contributed specifically to the target recipient in this round
    const paidToRecipientUserIds = new Set(
      thisRoundContributions
        .filter(c => {
          // Only contributions for the target round that were paid to the target recipient
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
          // For merry_go_round_payments endpoint response
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

      // hasContributed: either flagged by backend OR found in actual contributions, OR already passed their turn
      const hasContributed = p.has_contributed_this_cycle ||
                            p.has_contributed ||
                            fulfilledUserIds.has(userId) ||
                            (!roundComplete && position < currentPosition);

      // paidToCurrent: contributed specifically to the target recipient in this round
      const paidToCurrent = paidToRecipientUserIds.has(userId);

      // hasBeenPaidOut: disbursement completed for this member in this round
      const hasBeenPaidOut = position < currentPosition && hasReceivedDisbursement;

      // In recipient view, the "Recipient" column shows the selected recipient for members who paid them.
      // Otherwise show the current recipient when this member has paid.
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
      };
    });
  };

  const renderContributorsTable = () => {
    if (!selectedRound) return null;

    const target = getTargetRecipient();
    const isRecipientView = !!(target && target.isRecipientView);
    const amountPerRound = selectedRound.amount_per_round || selectedRound.amountPerRound || 0;

    let rows = getRowData();

    if (contributorFilter === 'contributed') rows = rows.filter(r => r.contributed);
    if (contributorFilter === 'paid_to_current') rows = rows.filter(r => r.paidToRecipient);
    if (contributorFilter === 'pending') rows = rows.filter(r => !r.contributed);
    if (contributorSearch.trim()) {
      const q = contributorSearch.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q));
    }

    const totalContributed = rows.filter(r => r.contributed).length;
    const totalAmount = rows.filter(r => r.contributed).reduce((sum, r) => sum + r.amount, 0);
    const totalPaidToRecipient = rows.filter(r => r.paidToRecipient).length;
    const totalPaidToRecipientAmount = rows.filter(r => r.paidToRecipient).reduce((sum, r) => sum + (isRecipientView ? amountPerRound : r.amount), 0);

    const getFilterSummary = () => {
      if (isRecipientView) {
        if (contributorFilter === 'paid_to_current') return `${totalPaidToRecipient} paid to ${target.recipientName} • ${formatCurrency(totalPaidToRecipientAmount)}`;
        if (contributorFilter === 'pending') return `${rows.length} yet to pay ${target.recipientName}`;
        return `${totalPaidToRecipient} of ${rows.length} paid ${target.recipientName} • ${formatCurrency(totalPaidToRecipientAmount)}`;
      }
      if (contributorFilter === 'all') return `${totalContributed} paid • ${formatCurrency(totalAmount)} raised`;
      if (contributorFilter === 'contributed') return `${totalContributed} paid • ${formatCurrency(totalAmount)} raised`;
      if (contributorFilter === 'paid_to_current') return `${totalPaidToRecipient} paid to current recipient • ${formatCurrency(totalPaidToRecipientAmount)}`;
      if (contributorFilter === 'pending') return `${rows.length} pending payments`;
      return `${totalContributed} paid • ${formatCurrency(totalAmount)} raised`;
    };

    const getPayoutDate = (row) => {
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
      return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const showBanner = isRecipientView || contributorFilter === 'paid_to_current';

    return (

      <Card variant="outlined" style={styles.statsCard,{ borderRadius: 8, overflow: 'hidden' }}>
        <View style={styles.tableSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
             <View style={{ minWidth: width - 32 }}>
                {showBanner && (
                  <View style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.success + '12', borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: typography.fontSize.sm, color: colors.success, fontWeight: 'medium', flex: 1 }}>
                      {isRecipientView
                        ? `Showing who has paid ${target.recipientName} (Position ${target.position})`
                        : 'Showing members who have paid to the current recipient'}
                    </Text>
                    {isRecipientView && (
                      <TouchableOpacity onPress={() => { setSelectedRecipientPosition(null); setContributorFilter('all'); }}>
                        <Ionicons name="close-circle" size={18} color={colors.success} />
                      </TouchableOpacity>
                    )}
                  </View>
                 )}
                    <View style={[styles.tableHeaderRow, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.tableHeaderText, { color: colors.primary, textAlign: 'center' }, { flex: 0.8 }]}>#</Text>
                      <Text style={[styles.tableHeaderText, { color: colors.primary }, { flex: 2.5 }]}>Member</Text>
                      <Text style={[styles.tableHeaderText, { color: colors.primary, textAlign: 'center' }, { flex: 1.8 }]}>Status</Text>
                      <Text style={[styles.tableHeaderText, { color: colors.primary, textAlign: 'right' }, { flex: 1.2 }]}>Amount</Text>
                      <Text style={[styles.tableHeaderText, { color: colors.primary, textAlign: 'right' }, { flex: 2 }]}>Recipient</Text>
                      <Text style={[styles.tableHeaderText, { color: colors.primary, textAlign: 'right' }, { flex: 1.5 }]}>Payout Date</Text>
                      <Text style={[styles.tableHeaderText, { color: colors.primary, textAlign: 'right' }, { flex: 1 }]}>Receive</Text>
                    </View>
                 {rows.map(row => {
                    const paidStatus = isRecipientView ? row.paidToRecipient : row.contributed;
                    const statusAmount = isRecipientView ? (row.paidToRecipient ? amountPerRound : 0) : row.amount;
                    return (
                    <View key={row.id} style={styles.tableRow}>
                      <Text style={[styles.tableCell, { color: colors.text, textAlign: 'center', flex: 0.8 }]}>{row.position}</Text>
                      <Text style={[styles.tableCell, { color: colors.text, flex: 2.5 }]} numberOfLines={1}>{row.name}</Text>
                      <View style={[
                        styles.statusBadgeCell,
                        { backgroundColor: paidStatus ? colors.success + '20' : colors.warning + '20', flex: 1.8 }
                      ]}>
                        <Ionicons
                          name={paidStatus ? 'checkmark-circle' : 'time'}
                          size={10}
                          color={paidStatus ? colors.success : colors.warning}
                        />
                        <Text style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: paidStatus ? colors.success : colors.warning,
                        }}>
                          {paidStatus ? 'Paid' : 'Pending'}
                        </Text>
                      </View>
                      <Text style={[styles.tableCell, { color: colors.text, textAlign: 'right', flex: 1.2 }]}>{formatCurrency(statusAmount)}</Text>
                      <Text style={[styles.tableCell, { color: colors.textSecondary, textAlign: 'right', flex: 2 }]} numberOfLines={1}>{row.recipientDisplay || '-'}</Text>
                      <Text style={[styles.tableCell, { color: colors.textSecondary, textAlign: 'right', flex: 1.5 }]}>{getPayoutDate(row)}</Text>
                      <Text style={[styles.tableCell, { color: row.hasBeenPaidOut ? colors.success : row.eligibleToContributeToAll ? colors.warning : colors.textTertiary, textAlign: 'right', flex: 1 }]}>
                        {row.hasBeenPaidOut ? 'Yes' : row.eligibleToContributeToAll ? 'Eligible' : 'Partial'}
                      </Text>
                    </View>
                    );
                  })}
               {!rows.length && (
                <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary }}>No members match this filter.</Text>
                </View>
              )}
            </View>
          </ScrollView>
          <View style={[styles.tableFooter, { borderTopColor: colors.border }]}>
            <Text style={[styles.tableFooterText, { color: colors.textSecondary }]}>
              {getFilterSummary()}
            </Text>
          </View>
        </View>
      </Card>
    );
  };

  const cardStyle = { marginHorizontal: spacing.md, marginVertical: spacing.xs };

  const renderRoundSelector = () => (
    <Card style={styles.statsCard} variant="outlined">
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Merry-Go-Rounds</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing.xs }}>
        {merryGoRounds.map((round) => (
          <TouchableOpacity
            key={round.id}
            style={[
              styles.roundChip,
              {
                backgroundColor: selectedRound?.id === round.id ? colors.primary + '18' : colors.backgroundSecondary,
                borderColor: selectedRound?.id === round.id ? colors.primary : colors.border,
              },
            ]}
            onPress={() => { setSelectedRound(round); setContributorSearch(''); setContributorFilter('all'); setSelectedRecipientPosition(null); }}
          >
            <Text style={[styles.roundName, { color: selectedRound?.id === round.id ? colors.primary : colors.text }]}>
              {round.name}
            </Text>
            <Text style={[styles.roundMeta, { color: colors.textSecondary }]}>
              {formatCurrency(round.amount_per_round || round.amountPerRound || round.contribution_amount || 0)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Card>
  );

  const renderCurrentRoundInfo = () => {
    if (!selectedRound) return null;
    const participants = selectedRound.members || selectedRound.participants || [];
    const totalParticipants = participants.length || selectedRound.total_participants || 0;
    const currentPosition = selectedRound.current_position || selectedRound.currentRound || 1;
    const currentMember = participants[currentPosition - 1];
    const roundComplete = selectedRound.roundComplete || false;
    const amountPerRound = selectedRound.amount_per_round || selectedRound.amountPerRound || 0;
    const totalPayoutPerPerson = amountPerRound * totalParticipants;
    const progressPercentage = totalParticipants > 0 ? Math.round((currentPosition / totalParticipants) * 100) : 0;
    const nextPayoutDate = new Date(selectedRound.next_payout_date || selectedRound.nextPayoutDate);
    const daysUntilPayout = Math.ceil((nextPayoutDate - new Date()) / (1000 * 60 * 60 * 24));

    const StatTile = ({ icon, label, value, color, subtext }) => (
      <View style={{ flex: 1, marginHorizontal: spacing.xs }}>
        <View style={{ padding: spacing.md, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
              <Ionicons name={icon} size={20} color={color} />
            </View>
            <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, flex: 1 }}>{label}</Text>
          </View>
          <Text style={{ fontSize: typography.fontSize.lg, fontWeight: 'bold', color: colors.text }}>{value}</Text>
          {subtext && <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs }}>{subtext}</Text>}
        </View>
      </View>
    );
  };

  const renderActions = () => {
    if (!selectedRound) return null;
    const userMembership = selectedRound.members?.find(m => m.user_id === user?.id);
    const canContribute = userMembership && !userMembership.has_contributed_this_cycle;
    const isCurrentRecipient = selectedRound.current_position === selectedRound.members?.findIndex(m => m.user_id === user?.id);

    return (
      <Card style={styles.statsCard} variant="outlined">
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Actions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.actionsRow}>
            {canContribute && (
              <BorderedButton
                title="Contribute"
                onPress={() => {
                  const navParams = {
                    chamaId: selectedRound.chamaId,
                    roundId: selectedRound.id,
                    roundName: selectedRound.name,
                    contributionType: 'merry-go-round',
                    amountPerRound: selectedRound.amount_per_round || selectedRound.amountPerRound,
                  };
                  if (onRouteChange) onRouteChange('contributions', 'ContributeScreen', navParams);
                  else if (navigation && navigation.navigate) navigation.navigate('ContributeScreen', navParams);
                  else Alert.alert('Navigation Error', 'Unable to navigate to contribution screen. Please try again.');
                }}
                variant="primary"
                size="medium"
                icon="wallet"
                theme={theme}
              />
            )}
            {isCurrentRecipient && (
              <BorderedButton
                title="Claim Payout"
                onPress={() => {
                  Toast.show({ type: 'info', text1: 'Claim Payout', text2: 'Payout claiming feature coming soon!', position: 'top' });
                }}
                variant="success"
                size="medium"
                icon="cash"
                theme={theme}
              />
            )}
            <BorderedButton
              title="Calendar"
              onPress={async () => {
                try {
                  const response = await ApiService.getMerryGoRoundCalendarEventURL(selectedRound.id);
                  if (response.success && response.data?.url) {
                    const { Linking } = require('react-native');
                    await Linking.openURL(response.data.url);
                    Toast.show({ type: 'success', text1: 'Opening Calendar', position: 'top', visibilityTime: 3000 });
                  } else {
                    Toast.show({ type: 'error', text1: 'Calendar Error', text2: response.error || 'Failed to generate link', position: 'top' });
                  }
                } catch (error) {
                  Toast.show({ type: 'error', text1: 'Calendar Error', text2: 'Failed to open calendar', position: 'top' });
                }
              }}
              variant="primary"
              size="medium"
              icon="calendar"
              theme={theme}
            />
            <BorderedButton
              title="Rules"
              onPress={() => navigation.navigate('MerryGoRoundRulesScreen')}
              variant="primary"
              size="medium"
              icon="document-text"
              theme={theme}
            />
          </View>
        </ScrollView>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="refresh-circle-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Merry-Go-Rounds</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Create or join a merry-go-round to start rotating savings</Text>
      <Button
        title="Create Merry-Go-Round"
        onPress={() => {
          if (onRouteChange) onRouteChange('create-merry-go-round', 'CreateMerryGoRound');
          else navigation.navigate('CreateMerryGoRound', { chamaId });
        }}
        style={styles.createButton}
        icon={<Ionicons name="add" size={20} color={colors.white} />}
      />
    </View>
  );

  if (merryGoRounds.length === 0 && !loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {renderEmptyState()}
      </SafeAreaView>
    );
  }

  const recipientTarget = getTargetRecipient();
  const isRecipientView = !!(recipientTarget && recipientTarget.isRecipientView);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderRoundSelector()}
        {selectedRound && (
          <>
            {renderCompactTop()}
            {renderCurrentRoundInfo()}
            {renderMemberOrderList()}

            <View style={styles.statsCard,styles.contributorsSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Contributors</Text>
              </View>
              <View style={styles.contributorFilters}>
                <View style={[styles.searchBox, { borderColor: colors.border }]}>
                  <Ionicons name="search" size={16} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search members"
                    placeholderTextColor={colors.textSecondary}
                    value={contributorSearch}
                    onChangeText={setContributorSearch}
                  />
                  {contributorSearch ? (
                    <TouchableOpacity onPress={() => setContributorSearch('')}>
                      <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                </View> 

                <View style={styles.statsCard,{ flexDirection: 'row' }}>
                  {['all', 'contributed', 'paid_to_current', 'pending'].map(tab => (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.filterTab, { borderColor: contributorFilter === tab ? colors.primary : colors.border, backgroundColor: contributorFilter === tab ? colors.primary + '18' : colors.backgroundSecondary }]}
                      onPress={() => { setContributorFilter(tab); }}
                    >
                      <Text style={[styles.filterTabText, { color: contributorFilter === tab ? colors.primary : colors.textSecondary }]}>
                         {tab === 'all' ? 'All' : tab === 'contributed' ? 'Paid' : tab === 'paid_to_current' ? (isRecipientView ? 'Paid to Recipient' : 'Paid to Current') : 'Pending'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {renderContributorsTable()}
            </View>

            {renderActions()}
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => {
          if (onRouteChange) onRouteChange('create-merry-go-round', 'CreateMerryGoRound');
          else navigation.navigate('CreateMerryGoRound', { chamaId });
        }}
      >
        <Ionicons name="add" size={24} color={colors.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
   container: { flex: 1 },
   scrollView: { flex: 1 },
   section: { margin: spacing.md },
   sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
   sectionTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm },
   statusHalfCard: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1 },
   roundChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.lg, borderWidth: 1, marginRight: spacing.sm, alignItems: 'center', minWidth: 110 },
   roundName: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.xs, textAlign: 'center' },
   roundMeta: { fontSize: typography.fontSize.xs },
   statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.md },
   statusItem: { flex: 1, minWidth: '45%', alignItems: 'center' },
   statusLabel: { fontSize: typography.fontSize.sm, marginBottom: spacing.xs },
   statusValue: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, textAlign: 'center' },
   statusSubtext: { fontSize: typography.fontSize.xs, textAlign: 'center', marginTop: spacing.xs, fontStyle: 'italic' },
   progressBar: { height: 8, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 4, overflow: 'hidden' },
   progressFill: { height: '100%', borderRadius: 4 },
   roundCompleteNotice: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: borderRadius.sm, flexDirection: 'row', alignItems: 'center' },
   roundCompleteText: { fontSize: typography.fontSize.sm, marginLeft: spacing.xs },
   actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: spacing.sm },
   emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
   emptyTitle: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, marginTop: spacing.lg, marginBottom: spacing.sm },
   emptySubtitle: { fontSize: typography.fontSize.base, textAlign: 'center', marginBottom: spacing.xl },
   createButton: { marginTop: spacing.md },
    fab: { position: 'absolute', bottom: spacing.xl, right: spacing.xl, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...shadows.lg },

   emptyMembersList: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyMembersText: { fontSize: typography.fontSize.base, marginTop: spacing.md, textAlign: 'center' },
  memberOrderList: { paddingVertical: spacing.sm },
  memberOrderItem: { position: 'relative', borderWidth: 1, borderColor: 'transparent', borderRadius: 10, marginVertical: 2, paddingHorizontal: spacing.xs },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  avatarContainer: { position: 'relative', marginRight: spacing.md, alignItems: 'center', justifyContent: 'center' },
  connectorLineTop: { position: 'absolute', top: -spacing.sm, left: 23, width: 2, height: spacing.sm, zIndex: 1 },
  connectorLineBottom: { position: 'absolute', bottom: -spacing.sm, left: 23, width: 2, height: spacing.sm, zIndex: 1 },
  memberAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', zIndex: 2 },
  avatarText: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold },
  statusIndicator: { position: 'absolute', bottom: -3, right: -3, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', zIndex: 3 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: typography.fontSize.base, marginBottom: spacing.xs },
  memberPosition: { fontSize: typography.fontSize.sm },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  statusBadgeText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, textTransform: 'uppercase' },

  contributorsSection: { marginHorizontal: spacing.md, marginBottom: spacing.md },
  contributorFilters: { marginBottom: spacing.md },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, marginBottom: spacing.sm },
  searchInput: { flex: 1, fontSize: typography.fontSize.sm },
  filterTab: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs, borderRadius: borderRadius.sm, borderWidth: 1, marginHorizontal: 2 },
  filterTabText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold },
  tableSection: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: borderRadius.md },
  tableHeaderRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 2, alignItems: 'center' },
  tableHeaderText: { flex: 1, fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  tableCell: { flex: 1, fontSize: 12 },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 0, 0, 0.05)', alignItems: 'center' },
  statusBadgeCell: { flex: 1, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  tableFooter: { paddingVertical: 8, paddingHorizontal: 12, borderTopWidth: 1 },
  tableFooterText: { fontSize: 12, fontWeight: '500' },
  statsCard: { marginHorizontal: spacing.md, marginVertical: spacing.xs, },
});

export default MerryGoRoundScreen;
