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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { useApp } from '../../context/AppContext';
import { useChamaContext } from '../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import BorderedButton from '../../components/BorderedButton';
import { ButtonGrid } from '../../components/ButtonGroup';
import ApiService from '../../services/api';

const { width } = Dimensions.get('window');

const MerryGoRoundScreen = ({ route, navigation, onRouteChange }) => {
  const { chamaId: routeChamaId, newMerryGoRound, refresh } = route.params || {};
  const { theme, user } = useApp();
  const { currentChamaId, selectedChama } = useChamaContext();
  const colors = getThemeColors(theme);

  // Use chamaId from route params or from context
  const chamaId = routeChamaId || currentChamaId;

  const [merryGoRounds, setMerryGoRounds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRound, setSelectedRound] = useState(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(null);


  useEffect(() => {
    loadMerryGoRounds();
  }, [chamaId]);

  // Auto-refresh when merry-go-rounds are loaded
  useEffect(() => {
    if (merryGoRounds.length > 0) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }

    // Cleanup on unmount
    return () => {
      stopAutoRefresh();
    };
  }, [merryGoRounds.length]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopAutoRefresh();
    };
  }, []);

  // Handle new merry-go-round data from navigation
  useEffect(() => {
    if (newMerryGoRound && refresh) {
      // Check if this is the first merry-go-round
      const isFirstRound = merryGoRounds.length === 0;

      // Add the new merry-go-round to the current list immediately
      setMerryGoRounds(prevRounds => {
        const updatedRounds = [newMerryGoRound, ...prevRounds];
        return updatedRounds;
      });

      // Set the new round as selected
      setSelectedRound(newMerryGoRound);

      // Show success toast with celebration
      const toastMessage = isFirstRound
        ? `🎉 Your first merry-go-round "${newMerryGoRound.name}" is now active!`
        : `${newMerryGoRound.name} is now active and ready for contributions`;

      Toast.show({
        type: 'success',
        text1: isFirstRound ? 'First Merry-Go-Round! 🎯' : 'Merry-Go-Round Created! 🎯',
        text2: toastMessage,
        position: 'top',
        visibilityTime: isFirstRound ? 5000 : 4000,
        topOffset: 60,
      });



      // Clear the navigation params to prevent re-adding
      navigation.setParams({ newMerryGoRound: null, refresh: false });

      // Optionally refresh the full list from server after a short delay
      setTimeout(() => {
        loadMerryGoRounds();
      }, 1000);
    }
  }, [newMerryGoRound, refresh, navigation, merryGoRounds.length]);

  const loadMerryGoRounds = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getMerryGoRounds(chamaId);
      if (response.success) {
        let rounds = response.data || [];

        // Filter rounds to only include those the user is a member of
        const userId = user?.id;
        if (userId) {
          rounds = rounds.filter(round => {
            const participants = round.members || round.participants || [];
            return participants.some(p => (p.user_id || p.user?.id) === userId);
          });
        }

        // Check for round advancement and show notifications
        rounds.forEach(round => {
          const participants = round.members || round.participants || [];
          const currentPosition = round.current_position || round.currentRound || 1;
          const currentMember = participants[currentPosition - 1];

          // Find the previous state of this round
          const previousRound = merryGoRounds.find(r => r.id === round.id);
          const previousPosition = previousRound ? (previousRound.current_position || previousRound.currentRound || 1) : currentPosition;

          // Detect round advancement
          if (previousRound && previousPosition < currentPosition) {
            const previousMember = participants[previousPosition - 1];
            const newMember = currentMember;

            // Show round advancement notification
            Toast.show({
              type: 'success',
              text1: '🎯 Round Advanced!',
              text2: `${round.name}: Round ${previousPosition} → ${currentPosition}`,
              position: 'top',
              visibilityTime: 5000,
            });
          }
        });

        setMerryGoRounds(rounds);
        if (rounds.length > 0) {
          setSelectedRound(rounds[0]);
        } else {
          setSelectedRound(null);
        }
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

  // Start automatic refresh for real-time round advancement detection
  const startAutoRefresh = () => {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }

    // Refresh every 10 seconds to detect round advancement
    const interval = setInterval(async () => {
      try {
        await loadMerryGoRounds();
      } catch (error) {
        console.error('❌ Auto-refresh failed:', error);
      }
    }, 10000); // 10 seconds

    setAutoRefreshInterval(interval);
  };

  // Stop automatic refresh
  const stopAutoRefresh = () => {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      setAutoRefreshInterval(null);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
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

        <View style={styles.memberOrderList}>
          {participants.map((participant, index) => {
            const position = index + 1;
            const participantStatus = participant.status || 'pending';
            const isCurrent = participantStatus === 'current';
            const isCompleted = participantStatus === 'completed';
            const isPending = participantStatus === 'pending';

            // Get member info
            const member = participant.user || participant;
            const firstName = member.first_name || member.firstName || '';
            const lastName = member.last_name || member.lastName || '';
            const fullName = `${firstName} ${lastName}`.trim() || `Member ${position}`;
            const initials = `${firstName[0] || 'M'}${lastName[0] || position}`.toUpperCase();

            return (
              <View key={participant.id || index} style={styles.memberOrderItem}>
                {/* Member Row */}
                <View style={styles.memberRow}>
                  {/* Avatar with Status Indicator and Connector Lines */}
                  <View style={styles.avatarContainer}>
                    {/* Connector Line from Previous Member */}
                    {index > 0 && (
                      <View style={[
                        styles.connectorLineTop,
                        { backgroundColor: isCompleted || isCurrent ? colors.primary : colors.border }
                      ]} />
                    )}

                    {/* Avatar */}
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
                        {
                          color: isCurrent || isCompleted ? colors.white : colors.textSecondary
                        }
                      ]}>
                        {initials}
                      </Text>
                    </View>

                    {/* Connector Line to Next Member */}
                    {index < participants.length - 1 && (
                      <View style={[
                        styles.connectorLineBottom,
                        { backgroundColor: isCompleted ? colors.primary : colors.border }
                      ]} />
                    )}

                    {/* Status Indicator */}
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

                  {/* Member Info */}
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

                  {/* Status Badge */}
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
      </Card>
    );
  };

  const renderRoundSelector = () => (
    <Card style={styles.section} variant="outlined">
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Active Merry-Go-Rounds1
        </Text>
        {autoRefreshInterval && (
          <View style={styles.autoRefreshIndicator}>
            <Ionicons name="refresh-circle" size={16} color={colors.primary} />
            <Text style={[styles.autoRefreshText, { color: colors.primary }]}>
              Auto-refreshing
            </Text>
          </View>
        )}
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {merryGoRounds.map((round) => (
          <TouchableOpacity
            key={round.id}
            style={[
              styles.roundCard,
              {
                backgroundColor: selectedRound?.id === round.id ? colors.primary + '20' : colors.backgroundSecondary,
                borderColor: selectedRound?.id === round.id ? colors.primary : colors.border,
              }
            ]}
            onPress={() => setSelectedRound(round)}
          >
            <Text style={[
              styles.roundName,
              { color: selectedRound?.id === round.id ? colors.primary : colors.text }
            ]}>
              {round.name}
            </Text>
            <Text style={[styles.roundAmount, { color: colors.textSecondary }]}>
              {formatCurrency(round.amount_per_round || round.amountPerRound || round.contribution_amount || 0)}
            </Text>
            <Text style={[styles.roundFrequency, { color: colors.textTertiary }]}>
              {round.frequency} • {(round.members?.length || round.participants?.length || round.total_participants || 0)} members
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Card>
  );

  const renderCurrentRoundInfo = () => {
    if (!selectedRound) return null;

    // Get participants from either members or participants array
    const participants = selectedRound.members || selectedRound.participants || [];
    const totalParticipants = participants.length || selectedRound.total_participants || 0;
    const currentPosition = selectedRound.current_position || selectedRound.currentRound || 1;
    const currentMember = participants[currentPosition - 1]; // Convert to 0-based index
    const roundComplete = selectedRound.roundComplete || false;

    // Calculate amounts
    const amountPerRound = selectedRound.amount_per_round || selectedRound.amountPerRound || 0;
    const totalPayoutPerPerson = amountPerRound * totalParticipants;

    // Calculate progress percentage (for progress bar)
    const progressPercentage = totalParticipants > 0 ? Math.round((currentPosition / totalParticipants) * 100) : 0;

    const nextPayoutDate = new Date(selectedRound.next_payout_date || selectedRound.nextPayoutDate);
    const daysUntilPayout = Math.ceil((nextPayoutDate - new Date()) / (1000 * 60 * 60 * 24));

    // Check contribution status for current recipient
    const currentRecipientId = currentMember?.user_id || currentMember?.user?.id || currentMember?.id;
    if (currentRecipientId) {
      // Count how many members have contributed to current recipient
      const contributedCount = participants.filter(p => {
        const memberId = p.user_id || p.user?.id || p.id;
        // In a real implementation, you'd check actual contribution records
        // For now, we'll simulate based on some logic
        return memberId !== currentRecipientId; // All other members should contribute
      }).length;

      const contributionPercentage = totalParticipants > 1 ? Math.round((contributedCount / (totalParticipants - 1)) * 100) : 0;

    }

    return (
      <Card style={styles.section} variant="outlined">
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Current Round Status
        </Text>
        
        <View style={styles.statusGrid}>
          <View style={styles.statusItem}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
              Amount Per Period
            </Text>
            <Text style={[styles.statusValue, { color: colors.primary }]}>
              {formatCurrency(amountPerRound)}
            </Text>
            <Text style={[styles.statusSubtext, { color: colors.textSecondary }]}>
              {selectedRound.frequency || 'monthly'}
            </Text>
          </View>

          <View style={styles.statusItem}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
              Total Payout Per Person
            </Text>
            <Text style={[styles.statusValue, { color: colors.success }]}>
              {formatCurrency(totalPayoutPerPerson)}
            </Text>
            <Text style={[styles.statusSubtext, { color: colors.textSecondary }]}>
              per round winner
            </Text>
          </View>

          <View style={styles.statusItem}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
              Circle Progress
            </Text>
            <Text style={[styles.statusValue, { color: colors.text }]}>
              Round {currentPosition} of {totalParticipants}
            </Text>
            <Text style={[styles.statusSubtext, { color: colors.textSecondary }]}>
              {totalParticipants > 0 ? `${totalParticipants - currentPosition} rounds remaining` : 'No participants'}
            </Text>
          </View>

          <View style={styles.statusItem}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
              Current Recipient
            </Text>
            <Text style={[styles.statusValue, { color: colors.text }]}>
              {currentMember?.user?.first_name || currentMember?.first_name || 'Round ' + currentPosition} {currentMember?.user?.last_name || currentMember?.last_name || ''}
            </Text>
            <Text style={[styles.statusSubtext, { color: colors.textSecondary }]}>
              Next: {daysUntilPayout > 0 ? `${daysUntilPayout} days` : 'Today'}
            </Text>
          </View>
        </View>
        
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: roundComplete ? colors.success : colors.primary,
                width: roundComplete ? '100%' : `${progressPercentage}%`,
              }
            ]}
          />
        </View>

        {/* Round Completion Notice */}
        {roundComplete && (
          <View style={[styles.roundCompleteNotice, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
            <Ionicons name="trophy" size={16} color={colors.success} />
            <Text style={[styles.roundCompleteText, { color: colors.success }]}>
              🎉 Round {currentPosition} Complete! All members have contributed. The merry-go-round will advance automatically.
            </Text>
          </View>
        )}
      </Card>
    );
  };

  const renderContributionHistory = () => {
    if (!selectedRound?.contributions) return null;

    return (
      <Card style={styles.section} variant="outlined">
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Recent Contributions
        </Text>
        
        {selectedRound.contributions.slice(0, 5).map((contribution, index) => (
          <View key={index} style={styles.contributionItem}>
            <View style={styles.contributionInfo}>
              <Text style={[styles.contributorName, { color: colors.text }]}>
                {contribution.member?.user?.first_name} {contribution.member?.user?.last_name}
              </Text>
              <Text style={[styles.contributionDate, { color: colors.textSecondary }]}>
                {new Date(contribution.date).toLocaleDateString()}
              </Text>
            </View>
            
            <View style={styles.contributionAmount}>
              <Text style={[styles.amountText, { color: colors.primary }]}>
                {formatCurrency(contribution.amount)}
              </Text>
              <Ionicons 
                name={contribution.status === 'paid' ? 'checkmark-circle' : 'time'} 
                size={16} 
                color={contribution.status === 'paid' ? colors.success : colors.warning} 
              />
            </View>
          </View>
        ))}
        
        <Button
          title="View All Contributions"
          variant="outline"
          onPress={() => {
            Toast.show({
              type: 'info',
              text1: 'Contribution History',
              text2: 'Detailed contribution history coming soon!',
              position: 'top',
            });
          }}
          style={styles.viewAllButton}
        />
      </Card>
    );
  };

  const renderActions = () => {
    if (!selectedRound) return null;

    const userMembership = selectedRound.members?.find(m => m.user_id === user?.id);
    const canContribute = userMembership && !userMembership.has_contributed_this_cycle;
    const isCurrentRecipient = selectedRound.current_position === selectedRound.members?.findIndex(m => m.user_id === user?.id);

    return (
      <Card style={styles.section} variant="outlined">
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Actions
        </Text>
        
        <ButtonGrid style={styles.actionsGrid}>
          {canContribute && (
            <BorderedButton
              title="Contribute"
              onPress={() => {
         
                const navParams = {
                  chamaId: selectedRound.chamaId,
                  roundId: selectedRound.id,
                  roundName: selectedRound.name,
                  contributionType: 'merry-go-round',
                  amountPerRound: selectedRound.amount_per_round || selectedRound.amountPerRound
                };

                if (onRouteChange) {
                  console.log('📱 Using onRouteChange navigation');
                  onRouteChange('contributions', 'ContributeScreen', navParams);
                } else if (navigation && navigation.navigate) {
                  navigation.navigate('ContributeScreen', navParams);
                } else {
                  console.error('❌ No navigation method available');
                  Alert.alert('Navigation Error', 'Unable to navigate to contribution screen. Please try again.');
                }
              }}
              variant="primary"
              size="medium"
              icon="wallet"
              theme={theme}
              style={styles.gridButton}
            />
          )}

          {isCurrentRecipient && (
            <BorderedButton
              title="Claim Payout"
              onPress={() => {
                Toast.show({
                  type: 'info',
                  text1: 'Claim Payout',
                  text2: 'Payout claiming feature coming soon!',
                  position: 'top',
                });
              }}
              variant="success"
              size="medium"
              icon="cash"
              theme={theme}
              style={styles.gridButton}
            />
          )}

          <BorderedButton
            title="Add to Calendar"
            onPress={async () => {
          
              try {
                const response = await ApiService.getMerryGoRoundCalendarEventURL(selectedRound.id);

                if (response.success && response.data?.url) {
                  // Open the Google Calendar URL in the user's browser
                  // In React Native, we can use Linking to open URLs
                  const { Linking } = require('react-native');
                  await Linking.openURL(response.data.url);

                  Toast.show({
                    type: 'success',
                    text1: 'Opening Calendar',
                    text2: 'Google Calendar opened with pre-filled event details',
                    position: 'top',
                    visibilityTime: 3000,
                  });
                } else {
                  Toast.show({
                    type: 'error',
                    text1: 'Calendar Error',
                    text2: response.error || 'Failed to generate calendar link',
                    position: 'top',
                  });
                }
              } catch (error) {
                console.error('Calendar integration error:', error);
                Toast.show({
                  type: 'error',
                  text1: 'Calendar Error',
                  text2: 'Failed to open calendar',
                  position: 'top',
                });
              }
            }}
            variant="primary"
            size="medium"
            icon="calendar"
            theme={theme}
            style={styles.gridButton}
          />

          <BorderedButton
            title="Rules"
            onPress={() => {
              navigation.navigate('MerryGoRoundRulesScreen');
            }}
            variant="primary"
            size="medium"
            icon="document-text"
            theme={theme}
            style={styles.gridButton}
          />
        </ButtonGrid>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="refresh-circle-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Merry-Go-Rounds
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Create or join a merry-go-round to start rotating savings
      </Text>
      
      <Button
        title="Create Merry-Go-Round"
        onPress={() => {
          if (onRouteChange) {
            onRouteChange('create-merry-go-round', 'CreateMerryGoRound');
          } else {
            navigation.navigate('CreateMerryGoRound', { chamaId });
          }
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
        {renderRoundSelector()}

        {selectedRound && (
          <>
            {renderCurrentRoundInfo()}
            {renderMemberOrderList()}
            {renderContributionHistory()}
            {renderActions()}
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => {
          if (onRouteChange) {
            onRouteChange('create-merry-go-round', 'CreateMerryGoRound');
          } else {
            navigation.navigate('CreateMerryGoRound', { chamaId });
          }
        }}
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
  scrollView: {
    flex: 1,
  },
  section: {
    margin: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  autoRefreshIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  autoRefreshText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  roundCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginRight: spacing.md,
    minWidth: 120,
    alignItems: 'center',
  },
  roundName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  roundAmount: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  roundFrequency: {
    fontSize: typography.fontSize.xs,
  },
  visualSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  circleContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  animatedCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentIndicator: {
    position: 'absolute',
    top: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statusItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  statusValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
  },
  statusSubtext: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  contributionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  contributionInfo: {
    flex: 1,
  },
  contributorName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  contributionDate: {
    fontSize: typography.fontSize.sm,
  },
  contributionAmount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginRight: spacing.sm,
  },
  viewAllButton: {
    marginTop: spacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  gridButton: {
    width: '48%', // 2 buttons per row with small gap
    marginBottom: spacing.sm,
  },
  actionButton: {
    marginBottom: spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  createButton: {
    marginTop: spacing.md,
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
  // Member Order List Styles
  emptyMembersList: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyMembersText: {
    fontSize: typography.fontSize.base,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  memberOrderList: {
    paddingVertical: spacing.sm,
  },
  memberOrderItem: {
    position: 'relative',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectorLineTop: {
    position: 'absolute',
    top: -spacing.sm,
    left: 23, // Center of 48px avatar (24px from left edge)
    width: 2,
    height: spacing.sm,
    zIndex: 1,
  },
  connectorLineBottom: {
    position: 'absolute',
    bottom: -spacing.sm,
    left: 23, // Center of 48px avatar (24px from left edge)
    width: 2,
    height: spacing.sm,
    zIndex: 1,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    zIndex: 2, // Ensure avatar is above connector lines
  },
  avatarText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 3, // Ensure indicator is above everything
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.xs,
  },
  memberPosition: {
    fontSize: typography.fontSize.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
  },
});

export default MerryGoRoundScreen;
