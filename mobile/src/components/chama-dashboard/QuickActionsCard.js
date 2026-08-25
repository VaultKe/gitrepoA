import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import Card from '../common/Card';
import ApiService from '../../services/api';

const QuickActionsCard = ({ selectedChama, chamaFeatures, onRouteChange, navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  // Determine if current chama is a contribution group
  const isContributionGroup = selectedChama?.category === 'contribution';

  const actions = [
    {
      id: 'members',
      title: 'Members',
      icon: 'people',
      color: colors.secondary,
      onPress: () => {
        if (selectedChama) {
          if (onRouteChange) {
            onRouteChange('members', 'ChamaMembersScreen');
          } else {
            navigation.navigate('ChamaMembersScreen', {
              chamaId: selectedChama.id,
              chama: selectedChama
            });
          }
        } else {
          Alert.alert('No Chama Selected', 'Please select a chama first');
        }
      },
    },
    {
      id: 'contributions',
      title: isContributionGroup ? 'Contribute' : 'Pay',
      icon: 'wallet',
      color: colors.primary,
      onPress: () => {
        if (selectedChama) {
          if (onRouteChange) {
            onRouteChange('contributions', 'ContributeScreen');
          } else {
            navigation.navigate('ContributeScreen', {
              chamaId: selectedChama.id,
              chama: selectedChama
            });
          }
        } else {
          Alert.alert('No Chama Selected', 'Please select a chama first');
        }
      },
    },
    {
      id: 'savings',
      title: 'Savings',
      icon: 'cash',
      color: '#10B981',
      onPress: () => {
        if (selectedChama) {
          if (onRouteChange) {
            onRouteChange('savings', 'SavingsOverview');
          } else {
            navigation.navigate('SavingsOverview', {
              chamaId: selectedChama.id,
              chama: selectedChama,
            });
          }
        } else {
          Alert.alert('No Chama Selected', 'Please select a chama first');
        }
      },
    },
    {
      id: 'transactions',
      title: 'Transactions',
      icon: 'receipt',
      color: colors.success,
      onPress: () => {
        if (selectedChama) {
          if (onRouteChange) {
            onRouteChange('transactions', 'ChamaTransactionsScreen');
          } else {
            navigation.navigate('ChamaTransactionsScreen', {
              chamaId: selectedChama.id,
              chama: selectedChama
            });
          }
        } else {
          Alert.alert('No Chama Selected', 'Please select a chama first');
        }
      },
    },
    {
      id: 'shares',
      title: 'Shares',
      icon: 'cube',
      color: '#8B5CF6',
      onPress: () => {
        if (selectedChama) {
          if (onRouteChange) {
            onRouteChange('shares', 'SharesScreen');
          } else {
            navigation.navigate('SharesScreen', {
              chamaId: selectedChama.id,
              chama: selectedChama,
            });
          }
        } else {
          Alert.alert('No Chama Selected', 'Please select a chama first');
        }
      },
    },
    {
      id: 'dividends',
      title: 'Dividends',
      icon: 'cash',
      color: colors.success,
      onPress: () => {
        if (selectedChama) {
          if (onRouteChange) {
            onRouteChange('dividends', 'DividendsScreen');
          } else {
            navigation.navigate('DividendsScreen', {
              chamaId: selectedChama.id,
              chama: selectedChama,
            });
          }
        } else {
          Alert.alert('No Chama Selected', 'Please select a chama first');
        }
      },
    },
    {
      id: 'loans',
      title: 'Loans',
      icon: 'card',
      color: '#6366F1', // Indigo color
      onPress: () => {
        if (selectedChama) {
          if (onRouteChange) {
            onRouteChange('loans', 'ChamaLoansScreen');
          } else {
            navigation.navigate('ChamaLoansScreen', {
              chamaId: selectedChama.id,
              chama: selectedChama
            });
          }
        } else {
          Alert.alert('No Chama Selected', 'Please select a chama first');
        }
      },
    },
    {
      id: 'meetings',
      title: 'Meetings',
      icon: 'calendar',
      color: '#8B5CF6', // Purple color
      onPress: () => {
        if (selectedChama) {
          if (onRouteChange) {
            onRouteChange('meetings', 'ChamaMeetingsScreen');
          } else {
            navigation.navigate('ChamaMeetingsScreen', {
              chamaId: selectedChama.id,
              chama: selectedChama
            });
          }
        } else {
          Alert.alert('No Chama Selected', 'Please select a chama first');
        }
      },
    },
    {
      id: 'merry-go-round',
      title: 'Merry-Go-Round',
      icon: 'refresh-circle',
      color: '#F59E0B', // Amber color
      onPress: () => {
        if (selectedChama) {
          if (onRouteChange) {
            onRouteChange('merry-go-round', 'MerryGoRoundScreen');
          } else {
            navigation.navigate('MerryGoRoundScreen', {
              chamaId: selectedChama.id,
              chama: selectedChama
            });
          }
        } else {
          Alert.alert('No Chama Selected', 'Please select a chama first');
        }
      },
    },
    {
      id: 'welfare',
      title: 'Welfare',
      icon: 'heart',
      color: '#EC4899', // Pink color
      onPress: () => {
        if (selectedChama) {
          if (onRouteChange) {
            onRouteChange('welfare', 'WelfareScreen');
          } else {
            navigation.navigate('WelfareScreen', {
              chamaId: selectedChama.id,
              chama: selectedChama
            });
          }
        } else {
          Alert.alert('No Chama Selected', 'Please select a chama first');
        }
      },
    },
    {
      id: 'polls-voting',
      title: 'Polls & Voting',
      icon: 'checkmark-circle',
      color: '#8B5CF6', // Violet color
      onPress: () => {
        if (selectedChama) {
          if (onRouteChange) {
            onRouteChange('polls-voting', 'PollsVotingScreen');
          } else {
            navigation.navigate('PollsVotingScreen', { chamaId: selectedChama.id });
          }
        } else {
          Alert.alert('No Chama Selected', 'Please select a chama first');
        }
      },
    },
    {
      id: 'account-management',
      title: 'Account Management',
      icon: 'business',
      color: '#F59E0B', // Amber color
      onPress: () => {
        if (selectedChama) {
          if (onRouteChange) {
            onRouteChange('account-management', 'AccountManagementScreen');
          } else {
            navigation.navigate('AccountManagementScreen', { chamaId: selectedChama.id });
          }
        } else {
          Alert.alert('No Chama Selected', 'Please select a chama first');
        }
      },
    },
    {
      id: 'chat',
      title: 'Group Chat',
      icon: 'chatbubbles',
      color: '#3B82F6', // Blue color
      onPress: async () => {
        if (selectedChama) {
          if (onRouteChange) {
            onRouteChange('chat', 'ChatRoom');
          } else {
            try {
              // Use the chama-specific endpoint so the backend enforces a
              // single chat room per chama and avoids duplicate rooms.
              const response = await ApiService.createChamaChatRoom(selectedChama.id);

              if (response.success) {
                const room = response.data;
                navigation.navigate('ChatRoom', {
                  roomId: room.id,
                  roomName: room.name || `${selectedChama.name} Group Chat`,
                  roomType: 'group',
                  chamaId: selectedChama.id
                });
              } else {
                Alert.alert('Error', response.error || 'Failed to access group chat');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to access group chat');
            }
          }
        } else {
          Alert.alert('No Chama Selected', 'Please select a chama first');
        }
      },
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: 'settings',
      color: '#6B7280', // Gray color
      onPress: () => {
        if (selectedChama) {
          if (onRouteChange) {
            onRouteChange('settings', 'ChamaSettings');
          } else {
            navigation.navigate('ChamaSettings', { chamaId: selectedChama.id });
          }
        } else {
          Alert.alert('No Chama Selected', 'Please select a chama first');
        }
      },
    },
  ];

  // Filter actions based on feature toggles and chama type
  const activeWalletTypes = chamaFeatures.activeWalletTypes && chamaFeatures.activeWalletTypes.length > 0
    ? chamaFeatures.activeWalletTypes
    : ['merry-go-round', 'welfare', 'savings', 'shares', 'dividends', 'loans'];

  const filteredActions = actions.filter(action => {
    // For contribution groups, only show specific actions
    if (isContributionGroup) {
      const allowedForContributionGroups = [
        'contributions', // Contribute
        'transactions',  // Transactions
        'members',       // Members
        'meetings'       // Meetings
      ];
      return allowedForContributionGroups.includes(action.id);
    }

    // For regular chamas, apply wallet type filters
    const walletTypeMap = {
      'savings': 'savings',
      'shares': 'shares',
      'dividends': 'dividends',
      'loans': 'loans',
      'merry-go-round': 'merry-go-round',
      'welfare': 'welfare',
    };

    if (walletTypeMap[action.id]) {
      return activeWalletTypes.includes(walletTypeMap[action.id]);
    }

    // Legacy permission checks for backward compatibility
    switch (action.id) {
      case 'merry-go-round':
        return chamaFeatures.allowMerryGoRound;
      case 'welfare':
        return chamaFeatures.allowWelfare;
      default:
        return true; // Show all other actions
    }
  });

  const mainActions = filteredActions;

  const isDisabled = !selectedChama;

  return (
    <Card style={[styles.actionsCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginVertical: spacing.xs }]} variant="outlined">
      <Text style={[styles.cardTitle, { color: colors.text }]}>
        Quick Actions
      </Text>

      <View style={styles.actionsGrid}>
        {mainActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[styles.actionItem, isDisabled && { opacity: 0.4 }]}
            onPress={() => {
              action.onPress();
            }}
            disabled={isDisabled}
            activeOpacity={isDisabled ? 1 : 0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
              <Ionicons name={action.icon} size={24} color={action.color} />
            </View>
            <Text style={[styles.actionText, { color: colors.text }]}>
              {action.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  actionsCard: {
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
  },
  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.lg,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionItem: {
    width: `${100 / 4 - 2}%`,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  actionText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
});

export default QuickActionsCard;
