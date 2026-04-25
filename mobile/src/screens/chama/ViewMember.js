import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing } from '../../utils/theme';
import api from '../../services/api';

const ViewMember = ({ route, navigation }) => {
  const { memberId, chamaId, userRole } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  const [loading, setLoading] = useState(true);
  const [memberData, setMemberData] = useState(null);
  const [memberStats, setMemberStats] = useState(null);
  const [imageExpanded, setImageExpanded] = useState(false);

  useEffect(() => {
    loadMemberDetails();
  }, [memberId]);

  const loadMemberDetails = async () => {
    try {
      setLoading(true);

      // Load member details
      const memberResponse = await api.makeRequest(`/chamas/${chamaId}/members`);
      if (memberResponse.success && memberResponse.data) {
        const member = memberResponse.data.find(m => m.id === memberId || m.user_id === memberId);
        if (member) {
          setMemberData(member);
        } else {
          throw new Error('Member not found');
        }
      }

      // Load member statistics (contributions, loans, etc.)
      try {
        const statsResponse = await api.makeRequest(`/chamas/${chamaId}/members/${memberId}/stats`);
        if (statsResponse.success && statsResponse.data) {
          setMemberStats(statsResponse.data);
        }
      } catch (error) {
        console.log('Member stats not available:', error);
        // Stats are optional, don't fail if not available
      }

    } catch (error) {
      console.error('Error loading member details:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load member details',
      });
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = () => {
    if (userRole !== 'chairperson') {
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'Only chairperson can remove members',
      });
      return;
    }

    if (memberData?.user_id === user.id) {
      Toast.show({
        type: 'error',
        text1: 'Cannot Remove Self',
        text2: 'You cannot remove yourself from the chama',
      });
      return;
    }

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberData?.first_name} ${memberData?.last_name} from the chama?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: confirmRemoveMember },
      ]
    );
  };

  const confirmRemoveMember = async () => {
    try {
      const response = await api.makeRequest(`/chamas/${chamaId}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Member Removed',
          text2: 'Member has been removed from the chama',
        });
        navigation.goBack();
      } else {
        throw new Error(response.error || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to Remove',
        text2: error.message || 'Failed to remove member',
      });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'KES 0';
    return `KES ${Number(amount).toLocaleString()}`;
  };

  const handleImagePress = () => {
    setImageExpanded(!imageExpanded);
  };

  // Helper function to render member avatar with real profile photo
  const renderMemberAvatar = (isExpanded = false) => {
    console.log('🔍 ViewMember memberData:', memberData);

    // Access avatar from nested user object (correct structure)
    const user = memberData?.user || {};
    const avatarUrl = user?.avatar_url || user?.avatar || user?.profile_image || memberData?.avatar_url || memberData?.avatar;
    const firstName = user?.first_name || memberData?.first_name;
    const lastName = user?.last_name || memberData?.last_name;

    // console.log('🖼️ ViewMember avatar data:', { avatarUrl, firstName, lastName });

    const avatarStyle = isExpanded ? styles.expandedAvatar : styles.avatar;
    const placeholderStyle = isExpanded ? styles.expandedAvatarPlaceholder : styles.avatarPlaceholder;
    const textStyle = isExpanded ? styles.expandedAvatarText : styles.avatarText;

    if (avatarUrl) {
      // Process avatar URL similar to ProfileScreen
      let fullAvatarUrl;
      if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) {
        fullAvatarUrl = avatarUrl;
      } else {
        fullAvatarUrl = `${api.baseURL}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
      }

      return (
        <Image
          source={{ uri: fullAvatarUrl }}
          style={avatarStyle}
          onError={(error) => {
            console.log('Member avatar load error:', error);
            // Fallback to initials if image fails to load
          }}
        />
      );
    }

    // Fallback to initials if no avatar
    return (
      <View style={[placeholderStyle, { backgroundColor: colors.primary }]}>
        <Text style={[textStyle, { color: colors.white }]}>
          {firstName?.[0]?.toUpperCase() || 'M'}{lastName?.[0]?.toUpperCase() || ''}
        </Text>
      </View>
    );
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'chairperson':
        return colors.warning;
      case 'secretary':
        return colors.warning;
      case 'treasurer':
        return colors.warning;
      default:
        return colors.textSecondary;
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'chairperson':
        return 'star';
      case 'secretary':
        return 'document-text';
      case 'treasurer':
        return 'wallet';
      default:
        return 'person';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Member Details
          </Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading member details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!memberData) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Member Details
          </Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Member Not Found
          </Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            The member you're looking for could not be found.
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Member Details
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Member Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface }, imageExpanded && styles.framelessCard]}>
          {imageExpanded ? (
            // Expanded layout: Frameless image at top, then info below
            <View style={styles.framelessProfileLayout}>
              {/* Minimize button positioned absolutely */}
              <TouchableOpacity onPress={handleImagePress} style={styles.minimizeButton}>
                <Ionicons name="close" size={24} color={colors.white} />
              </TouchableOpacity>

              {/* Frameless Image Section - touches top, left, and right edges */}
              <View style={styles.framelessImageContainer}>
                {renderMemberAvatar(true)}
              </View>

              {/* Profile Info Section - Below the image */}
              <View style={styles.framelessProfileInfo}>
                <Text style={[styles.memberName, { color: colors.text }]}>
                  {memberData.user?.first_name || memberData.first_name} {memberData.user?.last_name || memberData.last_name}
                </Text>
                <Text style={[styles.memberEmail, { color: colors.textSecondary }]}>
                  {memberData.user?.email || memberData.email}
                </Text>

                <View style={[styles.roleBadge, { backgroundColor: getRoleColor(memberData.role) + '20' }]}>
                  <Ionicons
                    name={getRoleIcon(memberData.role)}
                    size={16}
                    color={getRoleColor(memberData.role)}
                  />
                  <Text style={[styles.roleText, { color: getRoleColor(memberData.role) }]}>
                    {memberData.role?.charAt(0).toUpperCase() + memberData.role?.slice(1)}
                  </Text>
                </View>

                <Text style={[styles.minimizeHint, { color: colors.textSecondary }]}>
                  Tap the × to minimize
                </Text>
              </View>
            </View>
          ) : (
            // Normal layout: Side-by-side
            <View style={styles.profileHeader}>
              <TouchableOpacity
                style={styles.avatarContainer}
                onPress={handleImagePress}
              >
                {renderMemberAvatar()}

                {/* Expand icon overlay */}
                <View style={[styles.expandImageOverlay, { backgroundColor: colors.info + '90' }]}>
                  <Ionicons name="expand" size={16} color={colors.white} />
                </View>
              </TouchableOpacity>

              <View style={styles.profileInfo}>
                <Text style={[styles.memberName, { color: colors.text }]}>
                  {memberData.user?.first_name || memberData.first_name} {memberData.user?.last_name || memberData.last_name}
                </Text>
                <Text style={[styles.memberEmail, { color: colors.textSecondary }]}>
                  {memberData.user?.email || memberData.email}
                </Text>

                <View style={[styles.roleBadge, { backgroundColor: getRoleColor(memberData.role) + '20' }]}>
                  <Ionicons
                    name={getRoleIcon(memberData.role)}
                    size={16}
                    color={getRoleColor(memberData.role)}
                  />
                  <Text style={[styles.roleText, { color: getRoleColor(memberData.role) }]}>
                    {memberData.role?.charAt(0).toUpperCase() + memberData.role?.slice(1)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.memberDetails}>
            {/* Join Date */}
            <View style={styles.detailRow}>
              <Ionicons name="calendar" size={16} color={colors.textSecondary} />
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Joined:
              </Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {formatDate(memberData.joined_at)}
              </Text>
            </View>

            {/* Phone Number */}
            {(memberData.user?.phone || memberData.phone_number) && (
              <View style={styles.detailRow}>
                <Ionicons name="call" size={16} color={colors.textSecondary} />
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Phone:
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {memberData.user?.phone || memberData.phone_number}
                </Text>
              </View>
            )}

            {/* Business Type */}
            {memberData.business_type && (
              <View style={styles.detailRow}>
                <Ionicons name="business" size={16} color={colors.textSecondary} />
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Business:
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {memberData.business_type}
                </Text>
              </View>
            )}

            {/* Location */}
            {memberData.location && (
              <View style={styles.detailRow}>
                <Ionicons name="location" size={16} color={colors.textSecondary} />
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Location:
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {memberData.location}
                </Text>
              </View>
            )}

            {/* Bio/Occupation */}
            {(memberData.user?.bio || memberData.user?.occupation) && (
              <View style={styles.detailRow}>
                <Ionicons name="person" size={16} color={colors.textSecondary} />
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  {memberData.user?.occupation ? 'Occupation:' : 'Bio:'}
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {memberData.user?.occupation || memberData.user?.bio}
                </Text>
              </View>
            )}

            {/* Verification Status */}
            <View style={styles.verificationRow}>
              <View style={styles.verificationItem}>
                <Ionicons
                  name={memberData.email_verified ? "checkmark-circle" : "close-circle"}
                  size={16}
                  color={memberData.email_verified ? colors.success : colors.error}
                />
                <Text style={[styles.verificationText, { color: colors.textSecondary }]}>
                  Email {memberData.email_verified ? 'Verified' : 'Unverified'}
                </Text>
              </View>

              <View style={styles.verificationItem}>
                <Ionicons
                  name={memberData.phone_verified ? "checkmark-circle" : "close-circle"}
                  size={16}
                  color={memberData.phone_verified ? colors.success : colors.error}
                />
                <Text style={[styles.verificationText, { color: colors.textSecondary }]}>
                  Phone {memberData.phone_verified ? 'Verified' : 'Unverified'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Member Details Table */}
        <View style={[styles.detailsCard, { backgroundColor: colors.surface, marginTop: 16 }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 16 }]}>
            Member Details
          </Text>

          <View style={styles.detailsTable}>
            {/* Row 1: Role */}
            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>Role</Text>
              <View style={styles.tableValue}>
                <Ionicons
                  name={getRoleIcon(memberData.role)}
                  size={16}
                  color={getRoleColor(memberData.role)}
                />
                <Text style={[styles.tableValueText, { color: colors.text, marginLeft: 8 }]}>
                  {memberData.role?.charAt(0).toUpperCase() + memberData.role?.slice(1)}
                </Text>
              </View>
            </View>

            {/* Row 2: Join Date */}
            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>Join Date</Text>
              <Text style={[styles.tableValueText, { color: colors.text }]}>
                {formatDate(memberData.joined_at)}
              </Text>
            </View>

            {/* Row 3: Attendance Rate */}
            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>Attendance Rate</Text>
              <Text style={[styles.tableValueText, { color: colors.primary }]}>
                {memberData.attendance_rate?.toFixed(1) || 0}%
              </Text>
            </View>

            {/* Row 4: Reputation Score */}
            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>Reputation</Text>
              <View style={styles.tableValue}>
                <Ionicons name="star" size={16} color={colors.warning} />
                <Text style={[styles.tableValueText, { color: colors.text, marginLeft: 4 }]}>
                  {memberData.reputation_score?.toFixed(1) || 0}
                </Text>
              </View>
            </View>

            {/* Row 5: Total Contributions */}
            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>Total Contributions</Text>
              <Text style={[styles.tableValueText, { color: colors.success }]}>
                {formatCurrency(memberData.total_contributions || 0)}
              </Text>
            </View>

            {/* Row 6: Savings Balance */}
            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>Savings Balance</Text>
              <Text style={[styles.tableValueText, { color: colors.primary }]}>
                {formatCurrency(memberData.savings_balance || 0)}
              </Text>
            </View>

            {/* Row 7: Loan Balance */}
            {memberData.loan_balance > 0 && (
              <View style={styles.tableRow}>
                <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>Loan Balance</Text>
                <Text style={[styles.tableValueText, { color: colors.error }]}>
                  {formatCurrency(memberData.loan_balance)}
                </Text>
              </View>
            )}

            {/* Row 8: Business Type */}
            {memberData.business_type && (
              <View style={styles.tableRow}>
                <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>Business Type</Text>
                <Text style={[styles.tableValueText, { color: colors.text }]}>
                  {memberData.business_type}
                </Text>
              </View>
            )}

            {/* Row 9: Location */}
            {memberData.location && (
              <View style={styles.tableRow}>
                <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>Location</Text>
                <Text style={[styles.tableValueText, { color: colors.text }]}>
                  {memberData.location}
                </Text>
              </View>
            )}

            {/* Row 10: Phone Number */}
            {(memberData.user?.phone || memberData.phone_number) && (
              <View style={styles.tableRow}>
                <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>Phone</Text>
                <Text style={[styles.tableValueText, { color: colors.text }]}>
                  {memberData.user?.phone || memberData.phone_number}
                </Text>
              </View>
            )}

            {/* Row 11: Email Verification */}
            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>Email Verified</Text>
              <View style={styles.tableValue}>
                <Ionicons
                  name={memberData.email_verified ? "checkmark-circle" : "close-circle"}
                  size={16}
                  color={memberData.email_verified ? colors.success : colors.error}
                />
                <Text style={[styles.tableValueText, {
                  color: memberData.email_verified ? colors.success : colors.error,
                  marginLeft: 4
                }]}>
                  {memberData.email_verified ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>

            {/* Row 12: Phone Verification */}
            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>Phone Verified</Text>
              <View style={styles.tableValue}>
                <Ionicons
                  name={memberData.phone_verified ? "checkmark-circle" : "close-circle"}
                  size={16}
                  color={memberData.phone_verified ? colors.success : colors.error}
                />
                <Text style={[styles.tableValueText, {
                  color: memberData.phone_verified ? colors.success : colors.error,
                  marginLeft: 4
                }]}>
                  {memberData.phone_verified ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>

            {/* Row 13: Bio/Occupation */}
            {(memberData.user?.bio || memberData.user?.occupation) && (
              <View style={styles.tableRow}>
                <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>
                  {memberData.user?.occupation ? 'Occupation' : 'Bio'}
                </Text>
                <Text style={[styles.tableValueText, { color: colors.text }]}>
                  {memberData.user?.occupation || memberData.user?.bio}
                </Text>
              </View>
            )}

            {/* Row 14: Last Contribution */}
            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: colors.textSecondary }]}>Last Contribution</Text>
              <Text style={[styles.tableValueText, { color: colors.text }]}>
                {memberData.last_contribution_date
                  ? `${formatCurrency(memberData.last_contribution_amount || 0)} on ${new Date(memberData.last_contribution_date).toLocaleDateString()}`
                  : 'None'
                }
              </Text>
            </View>
          </View>
        </View>

        {/* Member Statistics */}
        {memberStats && (
          <View style={[styles.statsCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Member Statistics
            </Text>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {formatCurrency(memberStats.total_contributions)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Total Contributions
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.success }]}>
                  {memberStats.loans_count || 0}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Loans Taken
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.warning }]}>
                  {memberStats.meetings_attended || 0}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Meetings Attended
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {memberStats.rating || 0}/5
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Member Rating
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Actions */}
        {userRole === 'chairperson' && memberData.user_id !== user.id && (
          <View style={[styles.actionsCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Actions
            </Text>

            <TouchableOpacity
              style={[styles.actionButton, styles.removeButton, { borderColor: colors.error }]}
              onPress={handleRemoveMember}
            >
              <Ionicons name="person-remove" size={20} color={colors.error} />
              <Text style={[styles.actionButtonText, { color: colors.error }]}>
                Remove from Chama
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  profileCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  framelessCard: {
    padding: 0, // Remove padding for frameless design
    overflow: 'hidden', // Ensure image touches edges
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 32,
    fontWeight: '600',
  },
  expandImageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Expanded layout styles - within the same card
  framelessProfileLayout: {
    position: 'relative',
    overflow: 'hidden',
  },
  minimizeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 12,
  },
  framelessImageContainer: {
    width: '100%',
    alignItems: 'center',
  },
  expandedAvatar: {
    width: '100%',
    height: 350,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  expandedAvatarPlaceholder: {
    width: '100%',
    height: 350,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedAvatarText: {
    fontSize: 120,
    fontWeight: '600',
  },
  framelessProfileInfo: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'transparent',
  },
  minimizeHint: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 12,
  },
  expandImageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Note: Frameless styles are defined above - these old expanded styles are removed to avoid conflicts
  profileInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  memberDetails: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    marginLeft: 8,
    marginRight: 8,
    minWidth: 60,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  statsCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  actionsCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  removeButton: {
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  verificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  verificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  verificationText: {
    fontSize: 12,
    marginLeft: 4,
  },
  // Details Table Styles
  detailsCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  detailsTable: {
    marginTop: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
  },
  tableLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  tableValue: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableValueText: {
    fontSize: 14,
    flex: 1,
  },
});

export default ViewMember;
