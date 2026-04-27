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

// Simple Avatar Component with fallback handling
const AvatarWithFallback = ({ uri, firstName, lastName, size = 50, backgroundColor, textColor }) => {
  const [imageError, setImageError] = useState(false);

  const initials = `${firstName?.[0]?.toUpperCase() || 'U'}${lastName?.[0]?.toUpperCase() || ''}`;

  if (imageError || !uri) {
    return (
      <View style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: backgroundColor || '#00D4AA',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Text style={{
          color: textColor || '#FFFFFF',
          fontSize: size * 0.4,
          fontWeight: 'bold'
        }}>
          {initials}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2
      }}
      onError={() => setImageError(true)}
    />
  );
};

const ChamaMembersScreen = ({ route, navigation, onRouteChange }) => {
  const { chamaId } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

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

        console.log('🔍 User role detection:', {
          currentUserId: user?.id,
          foundUser: !!currentUser,
          detectedRole: detectedRole,
          canManage: ['chairperson', 'secretary', 'treasurer'].includes(detectedRole),
          allMemberRoles: membersData.map(m => ({ id: m.user_id, role: m.role }))
        });
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
        console.log(`Loaded ${response.data?.length || 0} sent invitations for chama ${chamaId}`);
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

  const renderInvitationCard = ({ item }) => {
    const statusInfo = getInvitationStatus(item);
    const isExpired = statusInfo.status === 'expired';
    const isPending = statusInfo.status === 'pending';

    return (
      <Card variant="outlined" style={[styles.invitationCard, { opacity: isExpired ? 0.7 : 1 }]}>
        <View style={styles.invitationHeader}>
          <View style={styles.invitationInfo}>
            <Text style={[styles.inviteeEmail, { color: colors.text }]}>
              {item.email}
            </Text>
            {item.phone_number && (
              <Text style={[styles.inviteePhone, { color: colors.textSecondary }]}>
                {item.phone_number}
              </Text>
            )}
            {item.role && (
              <View style={styles.invitationRole}>
                <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
                <Text style={[styles.roleText, { color: colors.primary }]}>
                  {item.role_name || item.role}
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.invitationDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={16} color={colors.textSecondary} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Sent:
            </Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {formatDate(item.created_at)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="time" size={16} color={colors.textSecondary} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Expires:
            </Text>
            <Text style={[styles.detailValue, { color: isExpired ? colors.error : colors.text }]}>
              {formatDate(item.expires_at)}
            </Text>
          </View>

          {item.responded_at && (
            <View style={styles.detailRow}>
              <Ionicons name="checkmark-circle" size={16} color={statusInfo.color} />
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Responded:
              </Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {formatDate(item.responded_at)}
              </Text>
            </View>
          )}
        </View>

        {item.message && (
          <View style={styles.messageContainer}>
            <Text style={[styles.messageLabel, { color: colors.textSecondary }]}>
              Message:
            </Text>
            <Text style={[styles.messageText, { color: colors.text }]} numberOfLines={2}>
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
              style={[styles.actionButton, { borderColor: colors.error }]}
              textStyle={{ color: colors.error }}
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
    // Debug member data structure
    // console.log('🔍 Member item data:', item);

    // Access data from nested user object (correct structure)
    const user = item?.user || {};
    const firstName = user?.first_name || item?.firstName || item?.first_name;
    const lastName = user?.last_name || item?.lastName || item?.last_name;
    const email = user?.email || item?.email;
    const memberId = item?.user_id || item?.userId;

    // Try multiple avatar sources from user object
    const avatarUrl = user?.avatar_url || user?.avatar || user?.profile_image || item?.avatar || item?.avatarUrl;

    // console.log('🖼️ Avatar data:', { firstName, lastName, memberId, email, avatarUrl });

    // Try to use provided avatar URL first (if not failed before)
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
            console.log('Member avatar load error for:', fullAvatarUrl);
            // Mark this URL as failed to avoid repeated attempts
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
            // console.log('Generated avatar load error for:', email);
            // Mark this email as failed to avoid repeated attempts
            setFailedAvatars(prev => new Set([...prev, email]));
          }}
        />
      );
    }

    // Final fallback to initials
    return (
      <View style={[styles.memberAvatar, { backgroundColor: colors.primary }]}>
        <Text style={[styles.memberInitials, { color: colors.white }]}>
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

  const renderMemberRow = ({ item, index }) => {
    // Zebra design: alternate background colors
    const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;

    return (
      <View style={{
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: rowBackgroundColor,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        alignItems: 'center',
      }}>
        {/* Name */}
        <View style={{ flex: 3, justifyContent: 'center' }}>
            <Text style={{
              fontSize: 8.5,
              fontWeight: 'medium',
              color: colors.text,
            }}>
              {(item.role.charAt(0).toUpperCase() + item.role.slice(1)).length > 5
                ? (item.role.charAt(0).toUpperCase() + item.role.slice(1)).substring(0, 5) + '...'
                : item.role.charAt(0).toUpperCase() + item.role.slice(1)
              }
            </Text>
        </View>

        {/* Role */}
        <View style={{ flex: 1.5, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 4,
            paddingVertical: 2,
            borderRadius: 4,
            backgroundColor: getRoleColor(item.role) + '20',
          }}>
            <Ionicons
              name={getRoleIcon(item.role)}
              size={10}
              color={getRoleColor(item.role)}
            />
            <Text style={{
              fontSize: 8.5,
              fontWeight: 'medium',
              color: getRoleColor(item.role),
              marginLeft: 2,
            }}>
              {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
            </Text>
          </View>
        </View>

        {/* Attendance Rate */}
        <View style={{ flex: 1.5, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{
            fontSize: 8.5,
            fontWeight: 'medium',
            color: colors.text,
          }}>
            {item.attendance_rate?.toFixed(1) || 0}%
          </Text>
        </View>

        {/* Reputation */}
        <View style={{ flex: 1.5, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
          <Ionicons name="star" size={12} color={colors.warning} />
          <Text style={{
            fontSize: 8.5,
            fontWeight: 'medium',
            color: colors.text,
            marginLeft: 2,
          }}>
            {item.reputation_score?.toFixed(1) || 0}
          </Text>
        </View>

        {/* Actions */}
        <View style={{ flex: 1.5, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: colors.primary + '20',
              alignItems: 'center',
              justifyContent: 'center',
            }}
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
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: colors.secondary + '20',
                alignItems: 'center',
                justifyContent: 'center',
              }}
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
  };

  const renderRoleModal = () => (
    <Modal
      visible={showRoleModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowRoleModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Manage Member
            </Text>
            <TouchableOpacity onPress={() => setShowRoleModal(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {selectedMember && (
            <View style={styles.modalBody}>
              <Text style={[styles.memberNameModal, { color: colors.text }]}>
                {selectedMember.user?.first_name} {selectedMember.user?.last_name}
              </Text>

              {canManageRoles() && (
                <View style={styles.roleSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Change Role
                  </Text>
                  {roles.map((role) => (
                    <TouchableOpacity
                      key={role.id}
                      style={[
                        styles.roleOption,
                        {
                          backgroundColor: selectedMember.role === role.id ? colors.primary + '20' : 'transparent',
                          borderColor: colors.border,
                        }
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
                          { color: selectedMember.role === role.id ? colors.primary : colors.text }
                        ]}>
                          {role.name}
                        </Text>
                        <Text style={[styles.roleDescription, { color: colors.textSecondary }]}>
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
                  style={[styles.removeButton, { borderColor: colors.error }]}
                  textStyle={{ color: colors.error }}
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
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {activeTab === 'members' ? 'No members found' : 'No invitations sent'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {activeTab === 'members'
          ? (searchQuery ? 'Try adjusting your search' : 'Invite people to join your chama')
          : 'Send invitations to grow your chama membership'
        }
      </Text>
    </View>
  );

  const renderTabNavigation = () => (
    <View style={[styles.tabContainer, { backgroundColor: colors.surface }]}>
      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'members' && { backgroundColor: colors.primary + '15', borderBottomColor: colors.primary }
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
          { color: activeTab === 'members' ? colors.primary : colors.textSecondary }
        ]}>
          Members ({filteredMembers.length})
        </Text>
      </TouchableOpacity>

      {canManageMembers() && (
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'invitations' && { backgroundColor: colors.primary + '15', borderBottomColor: colors.primary }
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
            { color: activeTab === 'invitations' ? colors.primary : colors.textSecondary }
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '70%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '50%' }]} />
          </View>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '60%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '40%' }]} />
          </View>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '80%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '30%' }]} />
          </View>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '55%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '65%' }]} />
          </View>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '45%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '75%' }]} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Card */}
      <View style={[styles.headerCard, {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        marginBottom: spacing.sm
      }]}>
        <Input
          placeholder={activeTab === 'members' ? "Search members..." : "Search invitations..."}
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon="search"
          style={[styles.searchInput, { marginBottom: spacing.sm }]}
        />

        {/* Compact Tab Navigation */}
        <View style={[styles.tabContainer, { backgroundColor: 'transparent', paddingHorizontal: 0 }]}>
          <TouchableOpacity
            style={[
              styles.compactTab,
              activeTab === 'members' && { backgroundColor: colors.primary + '15', borderBottomColor: colors.primary }
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
              { color: activeTab === 'members' ? colors.primary : colors.textSecondary }
            ]}>
              Members ({filteredMembers.length})
            </Text>
          </TouchableOpacity>

          {canManageMembers() && (
            <TouchableOpacity
              style={[
                styles.compactTab,
                activeTab === 'invitations' && { backgroundColor: colors.primary + '15', borderBottomColor: colors.primary }
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
                { color: activeTab === 'invitations' ? colors.primary : colors.textSecondary }
              ]}>
                Invitations ({sentInvitations.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content based on active tab */}
      {activeTab === 'members' ? (
        <View style={{ flex: 1 }}>
          {/* Table Header */}
          <View style={{
            flexDirection: 'row',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            backgroundColor: colors.surface,
            borderBottomWidth: 2,
            borderBottomColor: colors.primary,
          }}>
            <Text style={{
              flex: 3,
              fontSize: 9,
              fontWeight: 'semibold',
              color: colors.text,
            }}>Name</Text>
            <Text style={{
              flex: 1.5,
              fontSize: 9,
              fontWeight: 'semibold',
              color: colors.text,
              textAlign: 'center',
            }}>Role</Text>
            <Text style={{
              flex: 1.5,
              fontSize: 9,
              fontWeight: 'semibold',
              color: colors.text,
              textAlign: 'center',
            }}>Attendance</Text>
            <Text style={{
              flex: 1.5,
              fontSize: 9,
              fontWeight: 'semibold',
              color: colors.text,
              textAlign: 'center',
            }}>Reputation</Text>
            <Text style={{
              flex: 1.5,
              fontSize: 9,
              fontWeight: 'semibold',
              color: colors.text,
              textAlign: 'center',
            }}>Actions</Text>
          </View>

          {/* Table Body */}
          <FlatList
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

          {/* Pagination Controls */}
          {filteredMembers.length > itemsPerPage && (
            <View style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              paddingVertical: spacing.lg,
              paddingHorizontal: spacing.md,
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}>
              <TouchableOpacity
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginHorizontal: spacing.sm,
                  backgroundColor: currentPage === 1 ? colors.border : colors.primary
                }}
                onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <Ionicons
                  name="chevron-back"
                  size={16}
                  color={currentPage === 1 ? colors.textSecondary : colors.white}
                />
              </TouchableOpacity>

              <Text style={{
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.medium,
                minWidth: 80,
                textAlign: 'center',
                color: colors.text
              }}>
                Page {currentPage} of {totalPages}
              </Text>

              <TouchableOpacity
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginHorizontal: spacing.sm,
                  backgroundColor: currentPage === totalPages ? colors.border : colors.primary
                }}
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
          style={[styles.fab, { backgroundColor: colors.primary }]}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    marginBottom: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  searchInput: {
    marginBottom: spacing.sm,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberCount: {
    alignItems: 'flex-start',
  },
  countText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  statsText: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  lastUpdated: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lastUpdatedText: {
    fontSize: typography.fontSize.xs,
  },
  membersList: {
    padding: spacing.md,
  },
  row: {
    justifyContent: 'space-around',
    marginHorizontal: -spacing.md / 2,
  },
  memberCard: {
    marginBottom: spacing.md,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  memberAvatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // Ensures image stays within circular bounds
    backgroundColor: '#f0f0f0', // Light background for loading state
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  memberInitials: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  memberName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  memberDetails: {
    gap: spacing.xs,
  },
  memberRole: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  roleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'capitalize',
  },
  memberJoined: {
    fontSize: typography.fontSize.sm,
  },
  reputationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  financialSummary: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: spacing.sm,
  },
  financialItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  financialLabel: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  financialValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'right',
  },
  activitySummary: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activityTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  activityGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  activityItem: {
    alignItems: 'center',
  },
  activityValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  activityLabel: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
  menuButton: {
    padding: spacing.sm,
  },
  memberStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  memberActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  memberActionButton: {
    flex: 1,
  },
  fullWidthButton: {
    flex: 0,
    width: '100%',
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
  modalBody: {
    gap: spacing.lg,
  },
  memberNameModal: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  roleSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
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
  roleDescription: {
    fontSize: typography.fontSize.sm,
  },
  actionSection: {
    gap: spacing.md,
  },
  removeButton: {
    marginTop: spacing.md,
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
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
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
  // Tab navigation styles
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
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
  tabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  // Invitation card styles
  invitationCard: {
    marginBottom: spacing.md,
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
  inviteePhone: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  invitationRole: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
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
  detailValue: {
    fontSize: typography.fontSize.sm,
    flex: 1,
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
  messageText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  // Compact Header Styles
  headerCard: {
    padding: spacing.md,
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
  compactTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
});

export default ChamaMembersScreen;
