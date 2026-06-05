import React, { useState, useEffect } from 'react';
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
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import BorderedButton from '../../../components/BorderedButton';
import { ButtonGrid } from '../../../components/ButtonGroup';
import ApiService from '../../../services/api';

const { width } = Dimensions.get('window');

const MerryGoRoundScreen = ({ route, navigation, onRouteChange }) => {
  const { chamaId: routeChamaId, newMerryGoRound, refresh } = route.params || {};
  const { theme, user } = useApp();
  const { currentChamaId, selectedChama } = useChamaContext();
  const colors = getThemeColors(theme);

  const chamaId = routeChamaId || currentChamaId;

  const [merryGoRounds, setMerryGoRounds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRound, setSelectedRound] = useState(null);

  const [contributorFilter, setContributorFilter] = useState('all');
  const [contributorSearch, setContributorSearch] = useState('');

  useEffect(() => { loadMerryGoRounds(); }, [chamaId]);

  useEffect(() => {
    return () => {};
  }, []);

  useEffect(() => {
    if (newMerryGoRound && refresh) {
      const isFirstRound = merryGoRounds.length === 0;
      setMerryGoRounds(prevRounds => [newMerryGoRound, ...prevRounds]);
      setSelectedRound(newMerryGoRound);

      const toastMessage = isFirstRound
        ? `Your first merry-go-round "${newMerryGoRound.name}" is now active!`
        : `${newMerryGoRound.name} is now active and ready for contributions`;

      Toast.show({
        type: 'success',
        text1: isFirstRound ? 'First Merry-Go-Round! 🎯' : 'Merry-Go-Round Created! 🎯',
        text2: toastMessage,
        position: 'top',
        visibilityTime: isFirstRound ? 5000 : 4000,
        topOffset: 60,
      });

      setTimeout(() => loadMerryGoRounds(), 1000);
    }
  }, [newMerryGoRound, refresh]);

  const loadMerryGoRounds = async () => {
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
        if (rounds.length > 0 && !selectedRound) setSelectedRound(rounds[0]);
      }
    } catch (error) {
      console.error('Failed to load merry-go-rounds:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMerryGoRounds();
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

  const renderMemberOrderList = () => {
    if (!selectedRound) return null;

    const participants = selectedRound.members || selectedRound.participants || [];
    const currentPosition = selectedRound.current_position || selectedRound.currentRound || 1;

    if (participants.length === 0) {
      return (
        <Card style={styles.section} variant="outlined">
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
      <Card style={styles.section} variant="outlined">
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Member Order ({participants.length} participants)
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

              return (
                <View key={participant.id || index} style={styles.memberOrderItem}>
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
                          borderColor: isCurrent ? colors.primary :
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

                    {isCurrent && (
                      <View style={[styles.statusBadge, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.statusBadgeText, { color: colors.white }]}>
                          Current
                        </Text>
                      </View>
                    )}

                    {isCompleted && (
                      <View style={[styles.statusBadge, { backgroundColor: colors.success }]}>
                        <Text style={[styles.statusBadgeText, { color: colors.white }]}>
                          Completed
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </Card>
    );
  };

  const renderCompactTop = () => {
    if (!selectedRound) return null;
    const participants = selectedRound.members || selectedRound.participants || [];
    const currentPosition = selectedRound.current_position || selectedRound.currentRound || 1;
    const currentMember = participants[currentPosition - 1];
    const amountPerRound = selectedRound.amount_per_round || selectedRound.amountPerRound || 0;
    const totalPayoutPerPerson = amountPerRound * participants.length;

    return (
      <View style={styles.compactTopRow}>
        <Card style={[styles.compactCard, { marginRight: spacing.sm }]} variant="outlined">
          <Text style={[styles.compactLabel, { color: colors.textSecondary }]}>Active Round</Text>
          <Text style={[styles.compactValue, { color: colors.text }]} numberOfLines={1}>{selectedRound.name}</Text>
          <Text style={[styles.compactSub, { color: colors.textSecondary }]}>{participants.length} members</Text>
        </Card>
        <Card style={[styles.compactCard, { marginLeft: spacing.sm }]} variant="outlined">
          <Text style={[styles.compactLabel, { color: colors.textSecondary }]}>Current Recipient</Text>
          <Text style={[styles.compactValue, { color: colors.primary }]} numberOfLines={1}>{getMemberShortName(currentMember)}</Text>
          <Text style={[styles.compactSub, { color: colors.textSecondary }]}>Round {currentPosition}</Text>
        </Card>
      </View>
    );
  };

  const getRowData = () => {
    if (!selectedRound) return [];
    const participants = selectedRound.members || selectedRound.participants || [];
    const currentPosition = selectedRound.current_position || selectedRound.currentRound || 1;
    const roundComplete = selectedRound.roundComplete || false;
    const amountPerRound = selectedRound.amount_per_round || selectedRound.amountPerRound || 0;

    return participants.map((p, idx) => {
      const position = idx + 1;
      const member = p.user || p;
      const hasContributed = p.has_contributed_this_cycle || p.has_contributed || (!roundComplete && position < currentPosition);
      const eligibleToContributeToAll = position <= currentPosition || roundComplete;
      return {
        id: p.id || `${selectedRound.id}-${position}`,
        name: getMemberName(member),
        position,
        role: position === currentPosition ? 'Current' : position < currentPosition ? 'Completed' : 'Pending',
        contributed: hasContributed,
        amount: hasContributed ? amountPerRound : 0,
        eligibleToContributeToAll,
      };
    });
  };

  const renderContributorsTable = () => {
    if (!selectedRound) return null;

    let rows = getRowData();

    if (contributorFilter === 'contributed') rows = rows.filter(r => r.contributed);
    if (contributorFilter === 'pending') rows = rows.filter(r => !r.contributed);
    if (contributorSearch.trim()) {
      const q = contributorSearch.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q));
    }

    const totalContributed = rows.filter(r => r.contributed).length;
    const totalAmount = rows.filter(r => r.contributed).reduce((sum, r) => sum + r.amount, 0);

    const getPayoutDate = (row) => {
      if (!selectedRound) return '—';
      const frequency = selectedRound.frequency || 'monthly';
      const currentPos = selectedRound.current_position || selectedRound.currentRound || 1;
      const cyclesAway = row.position >= currentPos ? (row.position - currentPos) : 0;
      const date = new Date();
      if (frequency === 'weekly') date.setDate(date.getDate() + cyclesAway * 7);
      else if (frequency === 'biweekly') date.setDate(date.getDate() + cyclesAway * 14);
      else date.setMonth(date.getMonth() + cyclesAway);
      return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
      <View style={styles.tableSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: width - 32 }}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderText, { color: colors.textSecondary }, { flex: 0.5 }]}>#</Text>
              <Text style={[styles.tableHeaderText, { color: colors.textSecondary }, { flex: 3 }]}>Member</Text>
              <Text style={[styles.tableHeaderText, { color: colors.textSecondary }, { flex: 1.5 }]}>Status</Text>
              <Text style={[styles.tableHeaderText, { color: colors.textSecondary }, { flex: 1.5 }]}>Amount</Text>
              <Text style={[styles.tableHeaderText, { color: colors.textSecondary }, { flex: 1.5 }]}>Payout Date</Text>
              <Text style={[styles.tableHeaderText, { color: colors.textSecondary }, { flex: 1.5 }]}>Receive</Text>
            </View>
            {rows.map(row => (
              <View key={row.id} style={{ flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' }}>
                <Text style={[styles.tableCell, { color: colors.text }, { flex: 0.5 }]}>{row.position}</Text>
                <Text style={[styles.tableCell, { color: colors.text }, { flex: 3 }]} numberOfLines={1}>{row.name}</Text>
                <View style={[
                  { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
                  { backgroundColor: row.contributed ? colors.success + '20' : colors.warning + '20' }
                ]}>
                  <Ionicons
                    name={row.contributed ? 'checkmark-circle' : 'time'}
                    size={10}
                    color={row.contributed ? colors.success : colors.warning}
                  />
                  <Text style={{
                    fontSize: 8.5,
                    fontWeight: 'medium',
                    color: row.contributed ? colors.success : colors.warning,
                    marginLeft: 2,
                  }}>
                    {row.contributed ? 'Paid' : 'Pending'}
                  </Text>
                </View>
                <Text style={[styles.tableCell, { color: colors.text }, { flex: 1.5 }]}>{formatCurrency(row.amount)}</Text>
                <Text style={[styles.tableCell, { color: colors.textSecondary }, { flex: 1.5 }]}>{getPayoutDate(row)}</Text>
                <Text style={[styles.tableCell, { color: row.eligibleToContributeToAll ? colors.success : colors.textTertiary }, { flex: 1.5 }]}>
                  {row.eligibleToContributeToAll ? 'Yes' : 'Partial'}
                </Text>
              </View>
            ))}
            {!rows.length && (
              <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary }}>No members match this filter.</Text>
              </View>
            )}
          </View>
        </ScrollView>
        <View style={[styles.tableFooter, { borderTopColor: colors.border }]}>
          <Text style={[styles.tableFooterText, { color: colors.textSecondary }]}>
            {totalContributed} paid • {formatCurrency(totalAmount)} raised
          </Text>
        </View>
      </View>
    );
  };

  const renderRoundSelector = () => (
    <Card style={styles.section} variant="outlined">
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
            onPress={() => { setSelectedRound(round); setContributorSearch(''); setContributorFilter('all'); }}
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

    return (
      <View>
        <View style={styles.statusRowCards}>
          <Card style={[styles.statusHalfCard, { marginRight: spacing.sm }]} variant="outlined">
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Amount Per Period</Text>
            <Text style={[styles.statusValue, { color: colors.primary }]}>{formatCurrency(amountPerRound)}</Text>
            <Text style={[styles.statusSubtext, { color: colors.textSecondary }]}>{selectedRound.frequency || 'monthly'}</Text>

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />

            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Total Payout Per Person</Text>
            <Text style={[styles.statusValue, { color: colors.success }]}>{formatCurrency(totalPayoutPerPerson)}</Text>
            <Text style={[styles.statusSubtext, { color: colors.textSecondary }]}>per round winner</Text>
          </Card>

          <Card style={[styles.statusHalfCard, { marginLeft: spacing.sm }]} variant="outlined">
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Circle Progress</Text>
            <Text style={[styles.statusValue, { color: colors.text }]}>Round {currentPosition} of {totalParticipants}</Text>
            <Text style={[styles.statusSubtext, { color: colors.textSecondary }]}>
              {totalParticipants > 0 ? `${totalParticipants - currentPosition} rounds remaining` : 'No participants'}
            </Text>

            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { backgroundColor: roundComplete ? colors.success : colors.primary, width: roundComplete ? '100%' : `${progressPercentage}%` }]} />
            </View>

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />

            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Current Recipient</Text>
            <Text style={[styles.statusValue, { color: colors.text }]}>{currentMember?.user?.first_name || currentMember?.first_name || 'Round ' + currentPosition} {currentMember?.user?.last_name || currentMember?.last_name || ''}</Text>
            <Text style={[styles.statusSubtext, { color: colors.textSecondary }]}>Next: {daysUntilPayout > 0 ? `${daysUntilPayout} days` : 'Today'}</Text>
          </Card>
        </View>

        {roundComplete && (
          <View style={[styles.roundCompleteNotice, { backgroundColor: colors.success + '20', borderColor: colors.success, marginTop: spacing.sm }]}>
            <Ionicons name="trophy" size={16} color={colors.success} />
            <Text style={[styles.roundCompleteText, { color: colors.success }]}>
              🎉 Round {currentPosition} Complete! All members have contributed. The merry-go-round will advance automatically.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderActions = () => {
    if (!selectedRound) return null;
    const userMembership = selectedRound.members?.find(m => m.user_id === user?.id);
    const canContribute = userMembership && !userMembership.has_contributed_this_cycle;
    const isCurrentRecipient = selectedRound.current_position === selectedRound.members?.findIndex(m => m.user_id === user?.id);

    return (
      <Card style={styles.section} variant="outlined">
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

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '70%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '50%' }]} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

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

            <View style={styles.contributorsSection}>
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
                <View style={{ flexDirection: 'row' }}>
                  {['all', 'contributed', 'pending'].map(tab => (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.filterTab, { borderColor: contributorFilter === tab ? colors.primary : colors.border, backgroundColor: contributorFilter === tab ? colors.primary + '18' : colors.backgroundSecondary }]}
                      onPress={() => { setContributorFilter(tab); }}
                    >
                      <Text style={[styles.filterTabText, { color: contributorFilter === tab ? colors.primary : colors.textSecondary }]}>
                        {tab === 'all' ? 'All' : tab === 'contributed' ? 'Paid' : 'Pending'}
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
  compactTopRow: { flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: spacing.md },
  compactCard: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1 },
  compactLabel: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium },
  compactValue: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, marginTop: spacing.xs },
  compactSub: { fontSize: typography.fontSize.xs, marginTop: spacing.xs, color: 'gray' },
  statusRowCards: { flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: spacing.md },
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
  loadingContainer: { flex: 1, padding: 16 },
  skeletonCard: { height: 120, borderRadius: 8, borderWidth: 1, marginBottom: 16, padding: 16 },
  skeletonLine: { height: 12, borderRadius: 6, marginBottom: 8 },

  emptyMembersList: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyMembersText: { fontSize: typography.fontSize.base, marginTop: spacing.md, textAlign: 'center' },
  memberOrderList: { paddingVertical: spacing.sm },
  memberOrderItem: { position: 'relative' },
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
  tableHeaderRow: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, backgroundColor: 'rgba(0,0,0,0.03)', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)' },
  tableHeaderText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, textTransform: 'uppercase' },
  tableCell: { fontSize: typography.fontSize.sm },
  statusBadgeCell: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2, borderRadius: borderRadius.sm, flex: 1.5, alignItems: 'center' },
  tableFooter: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderTopWidth: 1 },
  tableFooterText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium },
});

export default MerryGoRoundScreen;
