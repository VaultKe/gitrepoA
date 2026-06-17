import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import ApiService from '../../../services/api';

// Simple Avatar Component with fallback handling removed; renderMemberAvatar handles avatars inline with shared styles.

const ChamaMembersScreen = ({ route, navigation, onRouteChange }) => {
  const { chamaId } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);

  // Responsive layout logic
  const screenWidth = Dimensions.get('window').width;
  const isLargeScreen = screenWidth >= 768;

  // Calculate number of columns and card width
  const numColumns = isLargeScreen ? 2 : 1;
  const cardMargin = spacing.md;
  const availableWidth = screenWidth - (cardMargin * 2); // Account for container padding
  const cardWidth = numColumns > 1
    ? (availableWidth - (cardMargin * (numColumns - 1))) / numColumns
    : availableWidth;

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showMemberDetails, setShowMemberDetails] = useState(false);
  const [userRole, setUserRole] = useState('member');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [memberStats, setMemberStats] = useState({});
  const [userProfiles, setUserProfiles] = useState({}); // Cache for user profile data
  const [failedAvatars, setFailedAvatars] = useState(new Set()); // Track failed avatar loads
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Invitations tracking state
  const [activeTab, setActiveTab] = useState('members'); // 'members' or 'invitations'
  const [sentInvitations, setSentInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);

  // Real-time update interval
  const refreshIntervalRef = useRef(null);

  const roles = [
    { id: 'chairperson', name: 'Chairperson', icon: 'star', description: 'Full administrative access'},
    { id: 'treasurer', name: 'Treasurer', icon: 'wallet', description: 'Manages finances' },
    { id: 'secretary', name: 'Secretary', icon: 'document-text', description: 'Keeps records' },
    { id: 'assistant', name: 'Assistant', icon: 'person-add', description: 'Helps with operations' },
    { id: 'member', name: 'Member', icon: 'person', description: 'Regular member' },
  ];

  useEffect(() => {
    loadMembers();
    if (canManageMembers()) {
      loadSentInvitations();
    }

    // Set up real-time updates every 30 seconds
    refreshIntervalRef.current = setInterval(() => {
      loadMembers(true); // Silent refresh
      if (canManageMembers()) {
        loadSentInvitations(true);
      }
    }, 30000);

    // Cleanup interval on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // Load invitations when switching to invitations tab
  useEffect(() => {
    if (activeTab === 'invitations' && canManageMembers()) {
      loadSentInvitations();
    }
  }, [activeTab]);

  const loadMembers = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const response = await ApiService.getChamaMembers(chamaId);
      if (response.success) {
        const membersData = response.data || [];
        setMembers(membersData);
        setLastUpdated(new Date().toISOString());

        // Extract member stats from response meta
        if (response.meta) {
          setMemberStats(response.meta);
        }

        // Find current user's role
        const currentUser = membersData.find(m => m.user_id === user?.id);
        const detectedRole = currentUser?.role || 'member';
        setUserRole(detectedRole);
      }
      
    } catch (error) {
      console.error('Failed to load members:', error);
      if (!silent) {
        Alert.alert('Error', 'Failed to load chama members. Please try again.');
      }
    } finally {
      setLoading(false); // Always set loading to false
    }
  };

  const loadSentInvitations = async (silent = false) => {
    if (!canManageMembers()) return;

    try {
      if (!silent) setInvitationsLoading(true);

      const response = await ApiService.getChamaSentInvitations(chamaId);
      if (response.success) {
        setSentInvitations(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load sent invitations:', error);
      if (!silent) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load invitations',
        });
      }
    } finally {
      if (!silent) setInvitationsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadMembers(),
      activeTab === 'invitations' ? loadSentInvitations() : Promise.resolve()
    ]);
    setRefreshing(false);
  };

  const canManageMembers = () => {
    return ['chairperson', 'secretary', 'treasurer'].includes(userRole);
  };

  const canManageRoles = () => {
    return userRole === 'chairperson';
  };

  const handleChangeRole = async (memberId, newRole) => {
    try {
      const response = await ApiService.updateMemberRole(chamaId, memberId, newRole);
      if (response.success) {
        Alert.alert('Success', 'Member role updated successfully');
        await loadMembers();
        setShowRoleModal(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update member role');
    }
  };

  const handleRemoveMember = (member) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.user?.first_name} ${member.user?.last_name} from the chama?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => confirmRemoveMember(member.id) },
      ]
    );
  };

  const confirmRemoveMember = async (memberId) => {
    try {
      const response = await ApiService.removeChamaMember(chamaId, memberId);
      if (response.success) {
        Alert.alert('Success', 'Member removed successfully');
        await loadMembers();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to remove member');
    }
  };

  // Invitation management functions
  const handleCancelInvitation = async (invitationId) => {
    Alert.alert(
      'Cancel Invitation',
      'Are you sure you want to cancel this invitation?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await ApiService.cancelInvitation(invitationId);
              if (response.success) {
                Toast.show({
                  type: 'success',
                  text1: 'Invitation Cancelled',
                  text2: 'The invitation has been cancelled successfully',
                });
                await loadSentInvitations();
              } else {
                throw new Error(response.error || 'Failed to cancel invitation');
              }
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to cancel invitation',
              });
            }
          }
        },
      ]
    );
  };

  const handleResendInvitation = async (invitationId) => {
    try {
      const response = await ApiService.resendInvitation(invitationId);
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Invitation Resent',
          text2: 'The invitation has been sent again',
        });
        await loadSentInvitations();
      } else {
        throw new Error(response.error || 'Failed to resend invitation');
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to resend invitation',
      });
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getFilteredMembers = () => {
    if (!searchQuery) return members;

    return members.filter(member =>
      `${member.user?.first_name} ${member.user?.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getRoleIcon = (role) => {
    const roleData = roles.find(r => r.id === role);
    return roleData?.icon || 'person';
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'chairperson': return colors.warning;
      case 'treasurer': return colors.warning;
      case 'secretary': return colors.warning;
      case 'assistant': return colors.secondary;
      default: return colors.textSecondary;
    }
  };

  const getMemberRoleBadgeStyle = (role) => {
    switch (role) {
      case 'chairperson':
      case 'treasurer':
      case 'secretary':
        return [styles.roleBadge, styles.roleBadgeWarning];
      case 'assistant':
        return [styles.roleBadge, styles.roleBadgeSecondary];
      default:
        return [styles.roleBadge, styles.roleBadgeMuted];
    }
  };

  const getMemberRoleTextStyle = (role) => {
    switch (role) {
      case 'chairperson':
      case 'treasurer':
      case 'secretary':
        return [styles.roleText, styles.roleTextWarning];
      case 'assistant':
        return [styles.roleText, styles.roleTextSecondary];
      default:
        return [styles.roleText, styles.roleTextMuted];
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInvitationStatus = (invitation) => {
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);

    if (invitation.status === 'accepted') return { status: 'accepted', color: colors.success };
    if (invitation.status === 'rejected') return { status: 'rejected', color: colors.error };
    if (invitation.status === 'cancelled') return { status: 'cancelled', color: colors.textSecondary };
    if (expiresAt < now) return { status: 'expired', color: colors.warning };
    return { status: 'pending', color: colors.primary };
  };

  const getInvitationStatusBadgeStyle = (status) => {
    switch (status) {
      case 'accepted':
        return [styles.statusBadge, styles.statusBadgeSuccess];
      case 'rejected':
        return [styles.statusBadge, styles.statusBadgeError];
      case 'cancelled':
        return [styles.statusBadge, styles.statusBadgeMuted];
      case 'expired':
        return [styles.statusBadge, styles.statusBadgeWarning];
      default:
        return [styles.statusBadge, styles.statusBadgePrimary];
    }
  };

  const getInvitationStatusTextStyle = (status) => {
    switch (status) {
      case 'accepted':
        return [styles.statusText, styles.statusTextSuccess];
      case 'rejected':
        return [styles.statusText, styles.statusTextError];
      case 'cancelled':
        return [styles.statusText, styles.statusTextMuted];
      case 'expired':
        return [styles.statusText, styles.statusTextWarning];
      default:
        return [styles.statusText, styles.statusTextPrimary];
    }
  };

  const renderInvitationCard = ({ item }) => {
    const statusInfo = getInvitationStatus(item);
    const isExpired = statusInfo.status === 'expired';
    const isPending = statusInfo.status === 'pending';

    return (
      <Card variant="outlined" style={[styles.invitationCard, isExpired && styles.invitationCardExpired]}>
        <View style={styles.invitationHeader}>
          <View style={styles.invitationInfo}>
            <Text style={[styles.inviteeEmail, styles.inviteeEmailText]}>
              {item.email}
            </Text>
            {item.phone_number && (
              <Text style={[styles.inviteePhone, styles.inviteePhoneText]}>
                {item.phone_number}
              </Text>
            )}
            {item.role && (
              <View style={styles.invitationRole}>
                <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
                <Text style={[styles.roleText, styles.roleTextPrimary]}>
                  {item.role_name || item.role}
                </Text>
              </View>
            )}
          </View>

          <View style={getInvitationStatusBadgeStyle(statusInfo.status)}>
            <Text style={getInvitationStatusTextStyle(statusInfo.status)}>
              {statusInfo.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.invitationDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={16} color={colors.textSecondary} />
            <Text style={[styles.detailLabel, styles.detailLabelText]}>
              Sent:
            </Text>
            <Text style={[styles.detailValue, styles.detailValueText]}>
              {formatDate(item.created_at)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="time" size={16} color={colors.textSecondary} />
            <Text style={[styles.detailLabel, styles.detailLabelText]}>
              Expires:
            </Text>
            <Text style={[styles.detailValue, isExpired ? styles.detailValueTextError : styles.detailValueText]}>
              {formatDate(item.expires_at)}
            </Text>
          </View>

          {item.responded_at && (
            <View style={styles.detailRow}>
              <Ionicons name="checkmark-circle" size={16} color={statusInfo.color} />
              <Text style={[styles.detailLabel, styles.detailLabelText]}>
                Responded:
              </Text>
              <Text style={[styles.detailValue, styles.detailValueText]}>
                {formatDate(item.responded_at)}
              </Text>
            </View>
          )}
        </View>

        {item.message && (
          <View style={styles.messageContainer}>
            <Text style={[styles.messageLabel, styles.messageLabelText]}>
              Message:
            </Text>
            <Text style={[styles.messageText, styles.messageTextText]} numberOfLines={2}>
              {item.message}
            </Text>
          </View>
        )}

        {isPending && (
          <View style={styles.invitationActions}>
            <Button
              title="Resend"
              variant="outline"
              size="small"
              onPress={() => handleResendInvitation(item.id)}
              style={styles.actionButton}
              icon={<Ionicons name="refresh" size={16} color={colors.primary} />}
            />
            <Button
              title="Cancel"
              variant="outline"
              size="small"
              onPress={() => handleCancelInvitation(item.id)}
              style={[styles.actionButton, styles.actionButtonError]}
              textStyle={styles.errorButtonText}
              icon={<Ionicons name="close" size={16} color={colors.error} />}
            />
          </View>
        )}
      </Card>
    );
  };

  // Helper function to generate a consistent avatar URL from email
  const getAvatarFromEmail = (email, size = 50) => {
    if (!email) return null;

    // Use a more reliable avatar service that doesn't have CORS issues
    // Extract initials from email for better avatar generation
    const emailParts = email.split('@')[0];
    const initials = emailParts.substring(0, 2).toUpperCase();

    // Use ui-avatars.com which is more reliable and doesn't have CORS issues
    return `https://ui-avatars.com/api/?name=${initials}&size=${size}&background=00D4AA&color=fff&format=png&rounded=true&bold=true`;
  };

  // Helper function to render member avatar with real profile photo
  const renderMemberAvatar = (item) => {
    const user = item?.user || {};
    const firstName = user?.first_name || item?.firstName || item?.first_name;
    const lastName = user?.last_name || item?.lastName || item?.last_name;
    const email = user?.email || item?.email;
    const memberId = item?.user_id || item?.userId;

    // Try multiple avatar sources from user object
    const avatarUrl = user?.avatar_url || user?.avatar || user?.profile_image || item?.avatar || item?.avatarUrl;

    if (avatarUrl && !failedAvatars.has(avatarUrl)) {
      let fullAvatarUrl;
      if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) {
        fullAvatarUrl = avatarUrl;
      } else {
        fullAvatarUrl = `${ApiService.baseURL}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
      }

      return (
        <Image
          source={{ uri: fullAvatarUrl }}
          style={styles.memberAvatar}
          onError={(error) => {
            setFailedAvatars(prev => new Set([...prev, avatarUrl]));
          }}
        />
      );
    }

    // Try generated avatar as fallback if email is available and not failed before
    if (email && !failedAvatars.has(email)) {
      const generatedAvatarUrl = getAvatarFromEmail(email, 50);
      return (
        <Image
          source={{ uri: generatedAvatarUrl }}
          style={styles.memberAvatar}
          onError={(error) => {
            setFailedAvatars(prev => new Set([...prev, email]));
          }}
        />
      );
    }

    // Final fallback to initials
    return (
      <View style={[styles.memberAvatar, styles.memberAvatarPrimary]}>
        <Text style={[styles.memberInitials, styles.memberInitialsWhite]}>
          {firstName?.[0]?.toUpperCase() || 'U'}{lastName?.[0]?.toUpperCase() || ''}
        </Text>
      </View>
    );
  };

  // Helper function to get member name from various data structures
  const getMemberName = (item) => {
    // Access from nested user object (correct structure)
    const user = item?.user || {};
    const firstName = user?.first_name || item?.firstName || item?.first_name || '';
    const lastName = user?.last_name || item?.lastName || item?.last_name || '';
    const fullName = item?.fullName || `${firstName} ${lastName}`.trim();

    // Fallback to email or ID if no name
    if (!fullName) {
      return user?.email || item?.email || `Member ${(item?.user_id || item?.id || '').slice(-4)}`;
    }

    return fullName;
  };

  const getMemberShortName = (item) => {
    // Access from nested user object (correct structure)
    const user = item?.user || {};
    const firstName = user?.first_name || item?.firstName || item?.first_name || '';
    const lastName = user?.last_name || item?.lastName || item?.last_name || '';

    if (firstName && lastName) {
      return `${firstName} ${lastName.charAt(0)}.`;
    } else if (firstName) {
      return firstName;
    } else if (lastName) {
      return lastName;
    }

    // Fallback to email or ID if no name
    return user?.email || item?.email || `Member ${(item?.user_id || item?.id || '').slice(-4)}`;
  };

  // Helper function to get member join date
  const getMemberJoinDate = (item) => {
    const joinDate = item?.joined_at || item?.joinedAt || item?.created_at || item?.createdAt;
    if (joinDate) {
      return new Date(joinDate).toLocaleDateString();
    }
    return 'Recently joined';
  };

  const renderMemberRow = ({ item, index }) => (
    <View style={index % 2 === 0 ? styles.memberTableRowEven : styles.memberTableRowOdd}>
      <View style={styles.memberNameCell}>
        <Text style={styles.memberNameText}>{getMemberName(item)}</Text>
      </View>

      <View style={styles.roleCell}>
        <View style={getMemberRoleBadgeStyle(item.role)}>
          <Ionicons
            name={getRoleIcon(item.role)}
            size={10}
            color={getRoleColor(item.role)}
          />
          <Text style={getMemberRoleTextStyle(item.role)}>
            {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.centeredCell}>
        <Text style={styles.memberTableText}>
          {item.attendance_rate?.toFixed(1) || 0}%
        </Text>
      </View>

      <View style={styles.reputationCell}>
        <Ionicons name="star" size={12} color={colors.warning} />
        <Text style={styles.memberTableText}>{item.reputation_score?.toFixed(1) || 0}</Text>
      </View>

      <View style={styles.actionCell}>
        <TouchableOpacity
          style={styles.iconButtonPrimary}
          onPress={() => {
            navigation.navigate('ViewMember', {
              memberId: item.user_id,
              chamaId: chamaId,
              userRole: userRole,
            });
          }}
        >
          <Ionicons
            name={item.user_id === user?.id ? "person-circle" : "person"}
            size={12}
            color={colors.primary}
          />
        </TouchableOpacity>

        {item.user_id !== user?.id && (
          <TouchableOpacity
            style={styles.iconButtonSecondary}
            onPress={async () => {
              try {
                const recipientId = item.user_id;
                if (!recipientId) {
                  Alert.alert('Error', 'Cannot start chat: User ID not found');
                  return;
                }

                const response = await ApiService.createPrivateChat(recipientId);
                if (response.success) {
                  const roomName = item.user?.first_name && item.user?.last_name
                    ? `${item.user.first_name} ${item.user.last_name}`
                    : 'Chat';

                  navigation.navigate('ChatRoom', {
                    roomId: response.data.id,
                    roomName: roomName,
                    roomType: 'private'
                  });
                } else {
                  Alert.alert('Error', response.error || 'Failed to create chat room');
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to start chat: ' + error.message);
              }
            }}
          >
            <Ionicons name="chatbubble" size={12} color={colors.secondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderRoleModal = () => (
    <Modal
      visible={showRoleModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowRoleModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.modalContentSurface]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, styles.modalTitleText]}>
              Manage Member
            </Text>
            <TouchableOpacity onPress={() => setShowRoleModal(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {selectedMember && (
            <View style={styles.modalBody}>
              <Text style={[styles.memberNameModal, styles.memberNameModalText]}>
                {selectedMember.user?.first_name} {selectedMember.user?.last_name}
              </Text>

              {canManageRoles() && (
                <View style={styles.roleSection}>
                  <Text style={[styles.sectionTitle, styles.sectionTitleText]}>
                    Change Role
                  </Text>
                  {roles.map((role) => (
                    <TouchableOpacity
                      key={role.id}
                      style={[
                        styles.roleOption,
                        selectedMember.role === role.id ? styles.roleOptionSelected : styles.roleOptionDefault,
                      ]}
                      onPress={() => handleChangeRole(selectedMember.id, role.id)}
                    >
                      <Ionicons
                        name={role.icon}
                        size={20}
                        color={selectedMember.role === role.id ? colors.primary : colors.textSecondary}
                      />
                      <View style={styles.roleInfo}>
                        <Text style={[
                          styles.roleName,
                          selectedMember.role === role.id ? styles.roleNameSelected : styles.roleNameDefault,
                        ]}>
                          {role.name}
                        </Text>
                        <Text style={[styles.roleDescription, styles.roleDescriptionText]}>
                          {role.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.actionSection}>
                <Button
                  title="Remove from Chama"
                  variant="outline"
                  onPress={() => {
                    setShowRoleModal(false);
                    handleRemoveMember(selectedMember);
                  }}
                  style={[styles.removeButton, styles.removeButtonError]}
                  textStyle={styles.errorButtonText}
                />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name={activeTab === 'members' ? "people-outline" : "mail-outline"}
        size={64}
        color={colors.textTertiary}
      />
      <Text style={[styles.emptyTitle, styles.emptyTitleText]}>
        {activeTab === 'members' ? 'No members found' : 'No invitations sent'}
      </Text>
      <Text style={[styles.emptySubtitle, styles.emptySubtitleText]}>
        {activeTab === 'members'
          ? (searchQuery ? 'Try adjusting your search' : 'Invite people to join your chama')
          : 'Send invitations to grow your chama membership'
        }
      </Text>
    </View>
  );

  const renderTabNavigation = () => (
    <View style={[styles.tabContainer, styles.tabContainerSurface]}>
      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'members' ? styles.tabActive : styles.tabInactive,
        ]}
        onPress={() => setActiveTab('members')}
      >
        <Ionicons
          name="people"
          size={20}
          color={activeTab === 'members' ? colors.primary : colors.textSecondary}
        />
        <Text style={[
          styles.tabText,
          activeTab === 'members' ? styles.tabTextActive : styles.tabTextInactive,
        ]}>
          Members ({filteredMembers.length})
        </Text>
      </TouchableOpacity>

      {canManageMembers() && (
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'invitations' ? styles.tabActive : styles.tabInactive,
          ]}
          onPress={() => setActiveTab('invitations')}
        >
          <Ionicons
            name="mail"
            size={20}
            color={activeTab === 'invitations' ? colors.primary : colors.textSecondary}
          />
          <Text style={[
            styles.tabText,
            activeTab === 'invitations' ? styles.tabTextActive : styles.tabTextInactive,
          ]}>
            Invitations ({sentInvitations.length})
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const filteredMembers = getFilteredMembers();

  // Get paginated members for current page
  const getCurrentPageMembers = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredMembers.slice(startIndex, endIndex);
  };

  // Calculate total pages
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.containerBackground]}>
        <View style={styles.loadingContainer}>
          <View style={[styles.skeletonCard, styles.skeletonCardSurface]}>
            <View style={[styles.skeletonLine, styles.skeletonLine70]} />
            <View style={[styles.skeletonLine, styles.skeletonLine50]} />
          </View>
          <View style={[styles.skeletonCard, styles.skeletonCardSurface]}>
            <View style={[styles.skeletonLine, styles.skeletonLine60]} />
            <View style={[styles.skeletonLine, styles.skeletonLine40]} />
          </View>
          <View style={[styles.skeletonCard, styles.skeletonCardSurface]}>
            <View style={[styles.skeletonLine, styles.skeletonLine80]} />
            <View style={[styles.skeletonLine, styles.skeletonLine30]} />
          </View>
          <View style={[styles.skeletonCard, styles.skeletonCardSurface]}>
            <View style={[styles.skeletonLine, styles.skeletonLine55]} />
            <View style={[styles.skeletonLine, styles.skeletonLine65]} />
          </View>
          <View style={[styles.skeletonCard, styles.skeletonCardSurface]}>
            <View style={[styles.skeletonLine, styles.skeletonLine45]} />
            <View style={[styles.skeletonLine, styles.skeletonLine75]} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, styles.containerBackground]}>
      {/* Header Card */}
      <Card variant="outlined" padding="none" style={styles.headerCard}>
        <Input
          placeholder={activeTab === 'members' ? "Search members..." : "Search invitations..."}
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon="search"
          style={styles.searchInput}
        />

        {/* Compact Tab Navigation */}
        <View style={styles.compactTabContainer}>
          <TouchableOpacity
            style={[
              styles.compactTab,
              activeTab === 'members' ? styles.compactTabActive : styles.compactTabInactive,
            ]}
            onPress={() => setActiveTab('members')}
          >
            <Ionicons
              name="people"
              size={16}
              color={activeTab === 'members' ? colors.primary : colors.textSecondary}
            />
            <Text style={[
              styles.compactTabText,
              activeTab === 'members' ? styles.compactTabTextActive : styles.compactTabTextInactive,
            ]}>
              Members ({filteredMembers.length})
            </Text>
          </TouchableOpacity>

          {canManageMembers() && (
            <TouchableOpacity
              style={[
                styles.compactTab,
                activeTab === 'invitations' ? styles.compactTabActive : styles.compactTabInactive,
              ]}
              onPress={() => setActiveTab('invitations')}
            >
              <Ionicons
                name="mail"
                size={16}
                color={activeTab === 'invitations' ? colors.primary : colors.textSecondary}
              />
              <Text style={[
                styles.compactTabText,
                activeTab === 'invitations' ? styles.compactTabTextActive : styles.compactTabTextInactive,
              ]}>
                Invitations ({sentInvitations.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>

      {/* Content based on active tab */}
      {activeTab === 'members' ? (
        <View style={styles.membersTableContainer}>
          <Card variant="outlined" padding="none" style={styles.membersTableCard}>
            <View style={styles.membersTableHeader}>
              <Text style={styles.tableHeaderName}>Name</Text>
              <Text style={styles.tableHeaderCenter}>Role</Text>
              <Text style={styles.tableHeaderCenter}>Attendance</Text>
              <Text style={styles.tableHeaderCenter}>Reputation</Text>
              <Text style={styles.tableHeaderCenter}>Actions</Text>
            </View>

            <FlatList
              style={styles.membersTableList}
              data={getCurrentPageMembers()}
              renderItem={renderMemberRow}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.membersList}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                />
              }
              ListEmptyComponent={!loading && filteredMembers.length === 0 && renderEmptyState()}
              showsVerticalScrollIndicator={false}
            />

            {filteredMembers.length > itemsPerPage && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    currentPage === 1 ? styles.paginationButtonDisabled : styles.paginationButtonActive,
                  ]}
                  onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={currentPage === 1 ? colors.textSecondary : colors.white}
                  />
                </TouchableOpacity>

                <Text style={styles.paginationText}>
                  Page {currentPage} of {totalPages}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    currentPage === totalPages ? styles.paginationButtonDisabled : styles.paginationButtonActive,
                  ]}
                  onPress={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={currentPage === totalPages ? colors.textSecondary : colors.white}
                  />
                </TouchableOpacity>
              </View>
            )}
          </Card>
        </View>
      ) : (
        <FlatList
          data={sentInvitations.filter(inv =>
            !searchQuery ||
            inv.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inv.status.toLowerCase().includes(searchQuery.toLowerCase())
          )}
          renderItem={renderInvitationCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.membersList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={!invitationsLoading && renderEmptyState()}
          showsVerticalScrollIndicator={false}
        />
      )}

      {canManageMembers() && (
        <TouchableOpacity
          style={[styles.fab, styles.fabPrimary]}
          onPress={() => {
            if (onRouteChange) {
              // Use route change to stay within ChamaLayoutProvider
              onRouteChange('invite-members', 'InviteMembers', {
                userRole: userRole,
              });
            } else {
              // Fallback to direct navigation if not in ChamaLayoutProvider
              navigation.navigate('InviteMembers', {
                chamaId: chamaId,
                chamaName: route.params?.chamaName || 'Chama',
                userRole: userRole,
              });
            }
          }}
        >
          <Ionicons name="person-add" size={24} color={colors.white} />
        </TouchableOpacity>
      )}

      {renderRoleModal()}
    </SafeAreaView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  containerBackground: {
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    padding: spacing.md,
  },
  skeletonCard: {
    height: 120,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  skeletonCardSurface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    marginBottom: spacing.sm,
    backgroundColor: colors.border,
  },
  skeletonLine70: {
    width: '70%',
  },
  skeletonLine50: {
    width: '50%',
  },
  skeletonLine60: {
    width: '60%',
  },
  skeletonLine40: {
    width: '40%',
  },
  skeletonLine80: {
    width: '80%',
  },
  skeletonLine30: {
    width: '30%',
  },
  skeletonLine55: {
    width: '55%',
  },
  skeletonLine65: {
    width: '65%',
  },
  skeletonLine45: {
    width: '45%',
  },
  skeletonLine75: {
    width: '75%',
  },
  searchInput: {
    marginBottom: spacing.sm,
  },
  membersList: {
    padding: spacing.md,
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.backgroundTertiary,
  },
  memberAvatarPrimary: {
    backgroundColor: colors.primary,
  },
  memberInitials: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  memberInitialsWhite: {
    color: colors.white,
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
  },
  modalContentSurface: {
    backgroundColor: colors.surface,
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
  modalTitleText: {
    color: colors.text,
  },
  modalBody: {
    gap: spacing.lg,
  },
  memberNameModal: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  memberNameModalText: {
    color: colors.text,
  },
  roleSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  sectionTitleText: {
    color: colors.text,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  roleOptionSelected: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  roleOptionDefault: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  roleInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  roleName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  roleNameSelected: {
    color: colors.primary,
  },
  roleNameDefault: {
    color: colors.text,
  },
  roleDescription: {
    fontSize: typography.fontSize.sm,
  },
  roleDescriptionText: {
    color: colors.textSecondary,
  },
  actionSection: {
    gap: spacing.md,
  },
  removeButton: {
    marginTop: spacing.md,
  },
  removeButtonError: {
    borderColor: colors.error,
  },
  errorButtonText: {
    color: colors.error,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyTitleText: {
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  emptySubtitleText: {
    color: colors.textSecondary,
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
  fabPrimary: {
    backgroundColor: colors.primary,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabContainerSurface: {
    backgroundColor: colors.surface,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    backgroundColor: colors.primary + '15',
    borderBottomColor: colors.primary,
  },
  tabInactive: {
    backgroundColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabTextInactive: {
    color: colors.textSecondary,
  },
  invitationCard: {
    marginBottom: spacing.md,
  },
  invitationCardExpired: {
    opacity: 0.7,
  },
  invitationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  invitationInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  inviteeEmail: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  inviteeEmailText: {
    color: colors.text,
  },
  inviteePhone: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  inviteePhoneText: {
    color: colors.textSecondary,
  },
  invitationRole: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  roleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  roleTextPrimary: {
    color: colors.primary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  statusBadgePrimary: {
    backgroundColor: colors.primary + '20',
  },
  statusBadgeSuccess: {
    backgroundColor: colors.success + '20',
  },
  statusBadgeError: {
    backgroundColor: colors.error + '20',
  },
  statusBadgeMuted: {
    backgroundColor: colors.textSecondary + '20',
  },
  statusBadgeWarning: {
    backgroundColor: colors.warning + '20',
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'capitalize',
  },
  statusTextPrimary: {
    color: colors.primary,
  },
  statusTextSuccess: {
    color: colors.success,
  },
  statusTextError: {
    color: colors.error,
  },
  statusTextMuted: {
    color: colors.textSecondary,
  },
  statusTextWarning: {
    color: colors.warning,
  },
  invitationDetails: {
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    minWidth: 80,
  },
  detailLabelText: {
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  detailValueText: {
    color: colors.text,
  },
  detailValueTextError: {
    color: colors.error,
  },
  messageContainer: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.md,
  },
  messageLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  messageLabelText: {
    color: colors.textSecondary,
  },
  messageText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  messageTextText: {
    color: colors.text,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  actionButtonError: {
    borderColor: colors.error,
  },
  headerCard: {
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: 8,
  },
  compactTabContainer: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
  compactTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginHorizontal: spacing.xs,
    borderRadius: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  compactTabActive: {
    backgroundColor: colors.primary + '15',
    borderBottomColor: colors.primary,
  },
  compactTabInactive: {
    backgroundColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  compactTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  compactTabTextActive: {
    color: colors.primary,
  },
  compactTabTextInactive: {
    color: colors.textSecondary,
  },
  membersTableContainer: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  membersTableCard: {
    flex: 1,
    borderRadius: borderRadius.md,
  },
  membersTableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tableHeaderName: {
    flex: 3,
    fontSize: 9,
    fontWeight: 'semibold',
    color: colors.text,
  },
  tableHeaderCenter: {
    flex: 1.5,
    fontSize: 9,
    fontWeight: 'semibold',
    color: colors.text,
    textAlign: 'center',
  },
  membersTableList: {
    flex: 1,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paginationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
  },
  paginationButtonDisabled: {
    backgroundColor: colors.border,
  },
  paginationButtonActive: {
    backgroundColor: colors.primary,
  },
  paginationText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    minWidth: 80,
    textAlign: 'center',
    color: colors.text,
  },
  memberTableRowEven: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  memberTableRowOdd: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  memberNameCell: {
    flex: 3,
    justifyContent: 'center',
  },
  memberNameText: {
    fontSize: 8.5,
    fontWeight: 'medium',
    color: colors.text,
  },
  roleCell: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeWarning: {
    backgroundColor: colors.warning + '20',
  },
  roleBadgeSecondary: {
    backgroundColor: colors.secondary + '20',
  },
  roleBadgeMuted: {
    backgroundColor: colors.textSecondary + '20',
  },
  roleTextWarning: {
    color: colors.warning,
  },
  roleTextSecondary: {
    color: colors.secondary,
  },
  roleTextMuted: {
    color: colors.textSecondary,
  },
  centeredCell: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberTableText: {
    fontSize: 8.5,
    fontWeight: 'medium',
    color: colors.text,
  },
  reputationCell: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  actionCell: {
    flex: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  iconButtonPrimary: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSecondary: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.secondary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChamaMembersScreen;
