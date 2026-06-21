import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import api from '../../../services/api';

const ChamaSettings = ({ route, navigation, onRouteChange }) => {
  const { chamaId } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chamaData, setChamaData] = useState(null);
  const [userRole, setUserRole] = useState('member');

  const [chamaInfo, setChamaInfo] = useState({
    name: '',
    description: '',
    isPublic: false,
    requiresApproval: false,
    maxMembers: 50,
    contributionAmount: 0,
    contributionFrequency: 'monthly',
  });

  const [permissions, setPermissions] = useState({
    memberCanInvite: true,
    memberCanCreateMeetings: false,
    memberCanViewAllTransactions: true,
    memberCanRequestLoans: true,
    requireApprovalForWithdrawals: true,
    allowMerryGoRound: true,
    allowWelfare: true,
  });

  const [notifications, setNotifications] = useState({
    newMemberJoined: true,
    contributionReminders: true,
    meetingReminders: true,
    loanApplications: true,
    transactionAlerts: true,
    emergencyAlerts: true,
  });

  useEffect(() => {
    fetchChamaSettings();
  }, [chamaId]);

  const fetchChamaSettings = async () => {
    try {
      setLoading(true);

      // Fetch chama details
      const chamaResponse = await api.makeRequest(`/chamas/${chamaId}`);
      if (chamaResponse.success && chamaResponse.data) {
        const chama = chamaResponse.data;
        setChamaData(chama);

        // Update chama info state
        setChamaInfo({
          name: chama.name || '',
          description: chama.description || '',
          isPublic: chama.is_public || false,
          requiresApproval: chama.requires_approval || false,
          maxMembers: chama.max_members || 50,
          contributionAmount: chama.contribution_amount || 0,
          contributionFrequency: chama.contribution_frequency || 'monthly',
        });
      }

      // Fetch user's role in this chama
      const membersResponse = await api.makeRequest(`/chamas/${chamaId}/members`);
      if (membersResponse.success && membersResponse.data) {
        const currentUserMember = membersResponse.data.find(member =>
          member.user_id === user.id || member.id === user.id
        );
        if (currentUserMember) {
          setUserRole(currentUserMember.role || 'member');
        }
      }

    } catch (error) {
      console.error('Error fetching chama settings:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load chama settings',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (userRole !== 'chairperson') {
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'Only chairperson can update chama settings',
      });
      return;
    }

    try {
      setSaving(true);

      // Prepare update payload
      const updatePayload = {
        name: chamaInfo.name,
        description: chamaInfo.description,
        is_public: chamaInfo.isPublic,
        requires_approval: chamaInfo.requiresApproval,
        max_members: chamaInfo.maxMembers,
        contribution_amount: chamaInfo.contributionAmount,
        contribution_frequency: chamaInfo.contributionFrequency,
        permissions: permissions,
        notifications: notifications,
      };

      // Make API call to update chama settings
      const response = await api.makeRequest(`/chamas/${chamaId}`, {
        method: 'PUT',
        body: updatePayload,
      });

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Settings Updated',
          text2: 'Chama settings have been updated successfully',
        });

        // Refresh chama data
        await fetchChamaSettings();
      } else {
        throw new Error(response.error || 'Failed to update settings');
      }

    } catch (error) {
      console.error('Error updating chama settings:', error);
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: error.message || 'Failed to update chama settings',
      });
    } finally {
      setSaving(false);
    }
  };

  // Real-time setting update function
  const updateSettingRealTime = async (settingType, settingKey, value) => {
    if (userRole !== 'chairperson') {
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'Only chairperson can update settings',
      });
      return;
    }

    try {
      let updatePayload = {};

      if (settingType === 'chamaInfo') {
        updatePayload[settingKey] = value;
      } else if (settingType === 'permissions') {
        updatePayload.permissions = { ...permissions, [settingKey]: value };
      } else if (settingType === 'notifications') {
        updatePayload.notifications = { ...notifications, [settingKey]: value };
      }

      // Make API call for real-time update
      const response = await api.makeRequest(`/chamas/${chamaId}`, {
        method: 'PUT',
        body: updatePayload,
      });

      if (response.success) {
        // Update local state
        if (settingType === 'chamaInfo') {
          setChamaInfo(prev => ({ ...prev, [settingKey]: value }));
        } else if (settingType === 'permissions') {
          setPermissions(prev => ({ ...prev, [settingKey]: value }));
        } else if (settingType === 'notifications') {
          setNotifications(prev => ({ ...prev, [settingKey]: value }));
        }

        Toast.show({
          type: 'success',
          text1: 'Setting Updated',
          text2: 'Setting has been updated in real-time',
          visibilityTime: 2000,
        });
      } else {
        throw new Error(response.error || 'Failed to update setting');
      }

    } catch (error) {
      console.error('Error updating setting:', error);
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: 'Failed to update setting',
      });
    }
  };

  const handleLeaveChama = () => {
    if (userRole === 'chairperson') {
      Alert.alert(
        'Cannot Leave Chama',
        'As chairperson, you cannot leave the chama. Please transfer the chairperson role to another member first, or delete the chama if you want to disband it.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Leave Chama',
      'Are you sure you want to leave this chama? You will lose access to all chama activities and data.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: confirmLeaveChama },
      ]
    );
  };

  const confirmLeaveChama = async () => {
    try {
      setSaving(true);

      const response = await api.makeRequest(`/chamas/${chamaId}/leave`, {
        method: 'POST',
      });

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Left Chama',
          text2: 'You have successfully left the chama',
        });

        // Navigate back to chama list or home
        if (onRouteChange) {
          onRouteChange('overview', 'ChamaDashboard');
        } else {
          navigation.navigate('ChamaList');
        }
      } else {
        throw new Error(response.error || 'Failed to leave chama');
      }
    } catch (error) {
      console.error('Error leaving chama:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to Leave',
        text2: error.message || 'Failed to leave chama',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChama = () => {
    if (userRole !== 'chairperson') {
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'Only chairperson can delete the chama',
      });
      return;
    }

    Alert.alert(
      'Delete Chama',
      'Are you sure you want to permanently delete this chama?\n\nThis will delete:\n• All members and their data\n• All contributions and transactions\n• All meetings and documents\n• All loans and welfare records\n\nThis action cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Forever', style: 'destructive', onPress: confirmDeleteChama },
      ]
    );
  };

  const confirmDeleteChama = async () => {
    try {
      setSaving(true);

      const response = await api.makeRequest(`/chamas/${chamaId}`, {
        method: 'DELETE',
      });

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Chama Deleted',
          text2: 'The chama has been permanently deleted',
        });

        // Navigate back to chama list or home
        if (onRouteChange) {
          onRouteChange('overview', 'ChamaDashboard');
        } else {
          navigation.navigate('ChamaList');
        }
      } else {
        throw new Error(response.error || 'Failed to delete chama');
      }
    } catch (error) {
      console.error('Error deleting chama:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to Delete',
        text2: error.message || 'Failed to delete chama',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderSettingItem = (title, description, value, onValueChange, type = 'switch', disabled = false) => (
    <View style={[styles.settingItem, disabled && styles.settingItemDisabled]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingTitle, { color: disabled ? colors.textSecondary : colors.text }]}>
          {title}
        </Text>
        {description && (
          <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
            {description}
          </Text>
        )}
      </View>

      {type === 'switch' ? (
        <Switch
          value={value}
          onValueChange={disabled ? undefined : onValueChange}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
          disabled={disabled}
        />
      ) : (
        <TouchableOpacity onPress={disabled ? undefined : onValueChange} disabled={disabled}>
          <View style={styles.settingValue}>
            <Text style={[styles.settingValueText, { color: disabled ? colors.textSecondary : colors.text }]}>
              {value}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSection = (title, children) => (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (onRouteChange) {
                onRouteChange('overview', 'ChamaDashboard');
              } else {
                navigation.goBack();
              }
            }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Chama Settings
          </Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading chama settings...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isAdmin = userRole === 'chairperson' || userRole === 'treasurer';
  const isChairperson = userRole === 'chairperson';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Basic Information */}
        {isAdmin && renderSection('Basic Information', (
          <>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Chama Name</Text>
              <TextInput
                style={[styles.textInput, { 
                  backgroundColor: colors.backgroundSecondary,
                  color: colors.text,
                  borderColor: colors.border 
                }]}
                value={chamaInfo.name}
                onChangeText={(text) => setChamaInfo(prev => ({ ...prev, name: text }))}
                placeholder="Enter chama name"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { 
                  backgroundColor: colors.backgroundSecondary,
                  color: colors.text,
                  borderColor: colors.border 
                }]}
                value={chamaInfo.description}
                onChangeText={(text) => setChamaInfo(prev => ({ ...prev, description: text }))}
                placeholder="Enter chama description"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>

            {renderSettingItem(
              'Public Chama',
              'Allow others to discover and request to join',
              chamaInfo.isPublic,
              (value) => updateSettingRealTime('chamaInfo', 'is_public', value),
              'switch',
              !isChairperson
            )}

            {renderSettingItem(
              'Requires Approval',
              'New members need approval to join',
              chamaInfo.requiresApproval,
              (value) => updateSettingRealTime('chamaInfo', 'requires_approval', value),
              'switch',
              !isChairperson
            )}
          </>
        ))}

        {/* Member Permissions */}
        {isAdmin && renderSection('Member Permissions', (
          <>
            {renderSettingItem(
              'Members Can Invite Others',
              'Allow members to invite new people',
              permissions.memberCanInvite,
              (value) => updateSettingRealTime('permissions', 'memberCanInvite', value),
              'switch',
              !isChairperson
            )}

            {renderSettingItem(
              'Members Can Create Meetings',
              'Allow members to schedule meetings',
              permissions.memberCanCreateMeetings,
              (value) => updateSettingRealTime('permissions', 'memberCanCreateMeetings', value),
              'switch',
              !isChairperson
            )}

            {renderSettingItem(
              'View All Transactions',
              'Members can see all chama transactions',
              permissions.memberCanViewAllTransactions,
              (value) => updateSettingRealTime('permissions', 'memberCanViewAllTransactions', value),
              'switch',
              !isChairperson
            )}

            {renderSettingItem(
              'Allow Loan Requests',
              'Members can request loans from chama funds',
              permissions.memberCanRequestLoans,
              (value) => updateSettingRealTime('permissions', 'memberCanRequestLoans', value),
              'switch',
              !isChairperson
            )}
          </>
        ))}

        {/* Features */}
        {isAdmin && renderSection('Features', (
          <>
            {renderSettingItem(
              'Merry-Go-Round',
              'Enable rotating savings feature',
              permissions.allowMerryGoRound,
              (value) => updateSettingRealTime('permissions', 'allowMerryGoRound', value),
              'switch',
              !isChairperson
            )}

            {renderSettingItem(
              'Welfare Support',
              'Enable welfare and emergency support',
              permissions.allowWelfare,
              (value) => updateSettingRealTime('permissions', 'allowWelfare', value),
              'switch',
              !isChairperson
            )}
          </>
        ))}

        {/* Notifications */}
        {renderSection('Notifications', (
          <>
            {renderSettingItem(
              'New Member Notifications',
              'Get notified when someone joins',
              notifications.newMemberJoined,
              (value) => updateSettingRealTime('notifications', 'newMemberJoined', value)
            )}

            {renderSettingItem(
              'Contribution Reminders',
              'Reminders for upcoming contributions',
              notifications.contributionReminders,
              (value) => updateSettingRealTime('notifications', 'contributionReminders', value)
            )}

            {renderSettingItem(
              'Meeting Reminders',
              'Notifications for scheduled meetings',
              notifications.meetingReminders,
              (value) => updateSettingRealTime('notifications', 'meetingReminders', value)
            )}

            {renderSettingItem(
              'Transaction Alerts',
              'Notifications for all transactions',
              notifications.transactionAlerts,
              (value) => updateSettingRealTime('notifications', 'transactionAlerts', value)
            )}
          </>
        ))}

        {/* Actions */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {isChairperson && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
              onPress={handleSaveSettings}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="save" size={20} color={colors.white} />
              )}
              <Text style={[styles.actionButtonText, { color: colors.white }]}>
                {saving ? 'Saving...' : 'Save All Settings'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.leaveButton,
              {
                borderColor: userRole === 'chairperson' ? colors.textSecondary : colors.warning,
                opacity: saving ? 0.7 : 1
              }
            ]}
            onPress={handleLeaveChama}
            disabled={saving}
          >
            <Ionicons
              name="exit"
              size={20}
              color={userRole === 'chairperson' ? colors.textSecondary : colors.warning}
            />
            <Text style={[
              styles.actionButtonText,
              { color: userRole === 'chairperson' ? colors.textSecondary : colors.warning }
            ]}>
              {userRole === 'chairperson' ? 'Cannot Leave (Chairperson)' : 'Leave Chama'}
            </Text>
          </TouchableOpacity>

          {isChairperson && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.deleteButton,
                { borderColor: colors.error, opacity: saving ? 0.7 : 1 }
              ]}
              onPress={handleDeleteChama}
              disabled={saving}
            >
              <Ionicons name="trash" size={20} color={colors.error} />
              <Text style={[styles.actionButtonText, { color: colors.error }]}>
                Delete Chama Forever
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    ...shadows.sm,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  roleIndicator: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  section: {
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingItemDisabled: {
    opacity: 0.6,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  settingDescription: {
    fontSize: typography.fontSize.sm,
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValueText: {
    fontSize: typography.fontSize.base,
    marginRight: spacing.sm,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  leaveButton: {
    borderWidth: 1,
  },
  deleteButton: {
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
  },
});

export default ChamaSettings;
