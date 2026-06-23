import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import apiService from '../../../services/api';
import { getTransactions } from '../../../services/api/walletEndpoints';

const ProfileScreen = ({ navigation }) => {
  const { theme, setTheme, user, userRole, updateUser, wallets, chamas, logout, getCachedData, getLightningData, getCachedAvatarData } = useApp();
  const colors = getThemeColors(theme);

  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    county: user?.county || '',
    town: user?.town || '',
    bio: user?.bio || '',
    occupation: user?.occupation || '',
    dateOfBirth: user?.dateOfBirth || '',
    gender: user?.gender || '',
  });
  const [profileImage, setProfileImage] = useState(
    user?.profile_image && user?.profile_image !== 'avatar://cached-base64-image'
      ? user?.profile_image
      : null
  );
  const [avatarData, setAvatarData] = useState(null);

  // Recent Activities state
  const [recentActivities, setRecentActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Helper: format currency
  useEffect(() => {  
  }, [user, profileImage]);

  // Handle cached avatar data
  useEffect(() => {
    const loadAvatarData = async () => {
      if (user?.avatar === 'avatar://cached-base64-image' || user?.profile_image === 'avatar://cached-base64-image') {
        try {
          const cachedData = await getCachedAvatarData();
          if (cachedData) {
            setAvatarData(cachedData);
          }
        } catch (error) {
        }
      } else {
        setAvatarData(null);
      }
    };

    loadAvatarData();
  }, [user?.avatar, user?.profile_image, getCachedAvatarData]);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  // Helper function to update profile from API response
  const updateProfileFromResponse = (response) => {
    if (response.success && response.data) {
      const userData = response.data.User || response.data.user || response.data;
      setProfileData({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email || '',
        phone: userData.phone || '',
        county: userData.county || '',
        town: userData.town || '',
        bio: userData.bio || '',
        occupation: userData.occupation || '',
        dateOfBirth: userData.dateOfBirth || '',
        gender: userData.gender || '',
      });

      if (userData.avatar && userData.avatar !== 'avatar://cached-base64-image') {
        setProfileImage(userData.avatar.startsWith('http') ? userData.avatar : `${apiService.baseURL}/${userData.avatar.startsWith('/') ? '' : '/'}${userData.avatar}`);
      }
    }
  };

  // Fetch fresh profile data from backend with lightning-fast caching
  const fetchProfileData = async () => {
    try {
      const cachedResult = await getCachedData('profile');
      if (cachedResult && cachedResult.success) {
        updateProfileFromResponse(cachedResult);
      }

      // Then fetch fresh data from API
      const response = await apiService.getProfile();

      if (response.success && response.data) {
        updateProfileFromResponse(response);

        // Update context with fresh data
        const userData = response.data.User || response.data.user || response.data;
        await updateUser(userData);

        // Set profile image with proper URL handling
        const avatarUrl = userData.avatar || userData.profile_image;
        if (avatarUrl) {
          let fullAvatarUrl;

          // Check if it's already a complete URL (http/https) or data URL
          if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) {
            fullAvatarUrl = avatarUrl;
          } else {
            // If it's a relative path, make it absolute
            fullAvatarUrl = `${apiService.baseURL}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
          }
          setProfileImage(fullAvatarUrl);
        } else {
           setProfileImage(null);
        }
      } else {
        console.warn('Failed to fetch profile data:', response.error);
      }
    } catch (error) {
      console.warn('Error fetching profile data:', error);
      // Fall back to using existing user data
      updateLocalProfileData().catch(console.error);
    }
  };

  const updateLocalProfileData = async () => {
    setProfileData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      county: user?.county || '',
      town: user?.town || '',
      bio: user?.bio || '',
      occupation: user?.occupation || '',
      dateOfBirth: user?.dateOfBirth || '',
      gender: user?.gender || '',
    });

    // Handle profile image URL - check user context first, then preserve existing component state
    const avatarUrl = user?.avatar || user?.profile_image;
    if (avatarUrl && avatarUrl !== 'avatar://cached-base64-image') {
      let fullAvatarUrl;

      // Check if it's already a complete URL (http/https) or data URL
      if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) {
        fullAvatarUrl = avatarUrl;
      } else {
        // If it's a relative path, make it absolute
        fullAvatarUrl = `${apiService.baseURL}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
      }
      setProfileImage(fullAvatarUrl);
    } else if (avatarUrl === 'avatar://cached-base64-image') {
      setProfileImage(null);
    } else if (!profileImage) {
      setProfileImage(null);
    } else {
    }
  };

  useEffect(() => {
    // Fetch fresh profile data when component mounts
    fetchProfileData();
  }, []);

  useEffect(() => {
    // Update local state when user context changes
    updateLocalProfileData().catch(console.error);
  }, [user]);

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to change your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const selectedAsset = result.assets[0];

        // Set profile image - validation happens at backend during upload
        setProfileImage(selectedAsset.uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const updateData = {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phone: profileData.phone,
        county: profileData.county,
        town: profileData.town,
        bio: profileData.bio,
        occupation: profileData.occupation,
        ...(profileData.dateOfBirth && profileData.dateOfBirth.trim() !== '' && {
          dateOfBirth: profileData.dateOfBirth
        }),
        ...(profileData.gender && profileData.gender.trim() !== '' && {
          gender: profileData.gender
        }),
        profile_image: profileImage,
      };

      console.log('Updating profile with data:', {
        ...updateData,
        profile_image: profileImage ? 'Image selected' : 'No image'
      });

      try {
        const response = await apiService.updateProfile(updateData);
        if (response.success) {
          const updatedUserData = response.data?.user || response.data;
          await updateUser(updatedUserData);

          setProfileData(prevData => ({
            ...prevData,
            firstName: updatedUserData.firstName || prevData.firstName,
            lastName: updatedUserData.lastName || prevData.lastName,
            phone: updatedUserData.phone || prevData.phone,
            county: updatedUserData.county || prevData.county,
            town: updatedUserData.town || prevData.town,
            bio: updatedUserData.bio || prevData.bio,
            occupation: updatedUserData.occupation || prevData.occupation,
            dateOfBirth: updatedUserData.dateOfBirth || prevData.dateOfBirth,
            gender: updatedUserData.gender || prevData.gender,
          }));

          setTimeout(() => {
            if (updatedUserData) {
              setProfileData(prevData => ({
                ...prevData,
                firstName: updatedUserData.firstName || prevData.firstName,
                lastName: updatedUserData.lastName || prevData.lastName,
                phone: updatedUserData.phone || prevData.phone,
                county: updatedUserData.county || prevData.county,
                town: updatedUserData.town || prevData.town,
                bio: updatedUserData.bio || prevData.bio,
                occupation: updatedUserData.occupation || prevData.occupation,
                dateOfBirth: updatedUserData.dateOfBirth || prevData.dateOfBirth,
                gender: updatedUserData.gender || prevData.gender,
              }));
            }
          }, 100);

          const newAvatarUrl = updatedUserData?.avatar || updatedUserData?.profile_image;
          if (newAvatarUrl) {
            let fullAvatarUrl;
            if (newAvatarUrl.startsWith('http') || newAvatarUrl.startsWith('data:')) {
              fullAvatarUrl = newAvatarUrl;
            } else {
              fullAvatarUrl = `${apiService.baseURL}${newAvatarUrl.startsWith('/') ? '' : '/'}${newAvatarUrl}`;
            }
            setProfileImage(fullAvatarUrl);
          } else {
            // If no new avatar URL, preserve the existing one
          }

          setEditing(false);
          Alert.alert('Success', 'Profile updated successfully');
          return;
        } else {
          throw new Error(response.error || 'Failed to update profile');
        }
      } catch (apiError) {
        console.warn('API profile update failed, using offline mode:', apiError);

        // Fallback: Update locally for offline mode
        const updatedUserData = {
          ...user,
          ...profileData,
          avatar: profileImage,
          firstName: profileData.firstName,
          lastName: profileData.lastName,
        };

        await updateUser(updatedUserData);

        // Update offline users storage
        try {
          const existingUsers = await AsyncStorage.getItem('offlineUsers');
          if (existingUsers) {
            const users = JSON.parse(existingUsers);
            const userIndex = users.findIndex(u => u.id === user.id || u.email === user.email);

            if (userIndex !== -1) {
              users[userIndex] = { ...users[userIndex], ...updatedUserData };
              await AsyncStorage.setItem('offlineUsers', JSON.stringify(users));
            }
          }
        } catch (storageError) {
          console.warn('Failed to update offline users storage:', storageError);
        }

        setEditing(false);
        Alert.alert('Success', 'Profile updated successfully (Offline Mode)');
      }
    } catch (error) {
      console.error('Profile update failed:', error);
      Alert.alert('Error', error.message || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setProfileData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      county: user?.county || '',
      town: user?.town || '',
      bio: user?.bio || '',
      occupation: user?.occupation || '',
      dateOfBirth: user?.dateOfBirth || '',
      gender: user?.gender || '',
    });
    setProfileImage(user?.avatar || null);
    setEditing(false);
  };

  const handleImagePress = () => {
    if (editing) {
      // If in editing mode, open image picker
      pickImage();
    } else {
      // If not editing, toggle image expansion
      setImageExpanded(!imageExpanded);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Load all recent activities (transactions) for the current user across all chamas
  const loadRecentActivities = useCallback(async () => {
    try {
      setActivitiesLoading(true);
      const response = await getTransactions(50, 0);

      if (response.success && Array.isArray(response.data)) {
        // Sort by created_at descending (most recent first)
        const sorted = [...response.data].sort(
          (a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0)
        );
        setRecentActivities(sorted);
      } else {
        setRecentActivities([]);
      }
    } catch (error) {
      console.warn('Failed to load recent activities:', error);
      setRecentActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecentActivities();
  }, [loadRecentActivities]);

  const getActivityColor = (type, paymentMethod) => {
    const t = (type || '').toLowerCase();
    switch (t) {
      case 'contribution':
      case 'deposit':
        return colors.success;
      case 'withdrawal':
      case 'loan':
        return colors.error;
      case 'transfer':
        return colors.primary;
      case 'fee':
        return colors.warning;
      case 'loan_repayment':
        return colors.info || colors.primary;
      case 'purchase':
      case 'refund':
        return colors.textTertiary || colors.textSecondary;
      default:
        // Fall back to payment method
        const pm = (paymentMethod || '').toLowerCase();
        if (pm === 'wallet' || pm === 'cash') return colors.primary;
        if (pm === 'mpesa') return colors.success;
        return colors.text;
    }
  };

  const getActivityIcon = (type) => {
    const t = (type || '').toLowerCase();
    switch (t) {
      case 'contribution': return 'people';
      case 'deposit': return 'arrow-down-circle';
      case 'withdrawal': return 'arrow-up-circle';
      case 'transfer': return 'swap-horizontal';
      case 'loan': return 'card';
      case 'loan_repayment': return 'card';
      case 'fee': return 'receipt';
      case 'purchase': return 'cart';
      case 'refund': return 'refresh';
      default: return 'ellipsis-horizontal-circle';
    }
  };

  const getActivityDescription = (tx) => {
    const desc = tx.description || '';
    const type = tx.type || 'transaction';
    const paymentMethod = tx.paymentMethod || '';

    if (desc.trim()) {
      // Clean up auto-generated M-Pesa deposit descriptions
      if (desc.includes('Auto-generated')) return `${type.charAt(0).toUpperCase() + type.slice(1)}`;
      return desc;
    }

    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
    const methodLabel = paymentMethod ? ` via ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}` : '';
    return `${typeLabel}${methodLabel}`;
  };

  const formatActivityDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTotalBalance = () => {
    return wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
  };

  // Renders the user's recent activity across all chamas
  const renderRecentActivity = () => {
    if (activitiesLoading) {
      return (
        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ marginTop: 8, color: colors.textSecondary }}>Loading activities…</Text>
        </View>
      );
    }

    if (recentActivities.length === 0) {
      return (
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: spacing.md, marginBottom: 0 }]}>
            Recent Activity
          </Text>
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Ionicons name="time-outline" size={40} color={colors.textTertiary || colors.textSecondary} />
            <Text style={{ marginTop: 8, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 }}>
              No activities yet. Your contributions and transactions will appear here.{'\n'}
              Tap a chama on the Home tab to make your first contribution.
            </Text>
          </View>
        </View>
      );
    }

    const displayActivities = recentActivities.slice(0, 10); // Top 10 most recent

    return (
      <View>
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: spacing.md, marginBottom: 0 }]}>
          Recent Activity
        </Text>

        <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
          {/* Activity Table Header */}
          <View style={[styles.activityTableHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.activityHeaderText, { color: colors.textSecondary }]}>Date</Text>
            <Text style={[styles.activityHeaderText, { color: colors.textSecondary }]}>Type</Text>
            <Text style={[styles.activityHeaderText, { color: colors.textSecondary }]}>Amount</Text>
            <Text style={[styles.activityHeaderText, { flex: 2, color: colors.textSecondary }]}>Description</Text>
          </View>

          {/* Activity Table Body */}
          <View style={[styles.activityTableBody, { borderBottomColor: colors.border }]}>
            {displayActivities.map((activity, index) => {
              const isAlt = index % 2 !== 0;
              return (
                <View
                  key={activity.id || index}
                  style={[
                    styles.activityRow,
                    { backgroundColor: isAlt ? colors.surface : colors.background },
                    { borderBottomColor: colors.border },
                  ]}
                >
                  {/* Date */}
                  <View style={styles.activityCell}>
                    <Ionicons name="calendar-outline" size={11} color={colors.textTertiary || colors.textSecondary} />
                    <Text style={[styles.activityCellText, { color: colors.textSecondary, fontSize: 11, marginLeft: 3 }]}>
                      {formatActivityDate(activity.createdAt || activity.created_at)}
                    </Text>
                  </View>

                  {/* Type badge */}
                  <View style={styles.activityTypeCell}>
                    <View style={[styles.activityTypeBadge, { backgroundColor: getActivityColor(activity.type, activity.paymentMethod) + '18' }]}>
                      <Ionicons
                        name={getActivityIcon(activity.type)}
                        size={12}
                        color={getActivityColor(activity.type, activity.paymentMethod)}
                      />
                      <Text style={[styles.activityTypeText, { color: getActivityColor(activity.type, activity.paymentMethod) }]}>
                        {(activity.type || 'Transaction').replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </View>

                  {/* Amount */}
                  <Text
                    style={[
                      styles.activityAmountText,
                      {
                        color:
                          (activity.type || '').toLowerCase() === 'withdrawal' || (activity.type || '').toLowerCase() === 'loan'
                            ? colors.error
                            : colors.success || colors.primary,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {typeof activity.amount === 'number'
                      ? formatCurrency(activity.amount)
                      : formatCurrency(parseFloat(activity.amount) || 0)}
                  </Text>

                  {/* Description */}
                  <Text
                    style={[styles.activityDescText, { color: colors.textSecondary }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {getActivityDescription(activity)}
                  </Text>
                </View>
              );
            })}
          </View>

          {recentActivities.length > 10 && (
            <View style={[styles.activityFooter, { borderTopColor: colors.border }]}>
              <Text style={{ color: colors.textTertiary || colors.textSecondary, fontSize: 12 }}>
                Showing 10 of {recentActivities.length} activities
              </Text>
            </View>
          )}
        </Card>
      </View>
    );
  };

  const handleLogout = async () => {
    setLoading(true);

    // Show immediate feedback
    Toast.show({
      type: 'info',
      text1: 'Logging out...',
      text2: 'Please wait while we securely log you out',
    });

    try {
      // Call API logout if available
      try {
        await apiService.logout();
      } catch (apiError) {
      }

      // Clear local data and logout
      await logout();
      // Show success message
      Toast.show({
        type: 'success',
        text1: 'Logged out successfully',
        text2: 'You have been securely logged out',
      });

    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Logout Failed',
        text2: error.message || 'Please try again',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderProfileHeader = () => (
    <Card style={[styles.section, imageExpanded && styles.framelessCard]}>
      {imageExpanded ? (
        // Expanded layout: Frameless image at top, then info below
        <View style={styles.framelessProfileLayout}>
          {/* Minimize button positioned absolutely */}
          <TouchableOpacity onPress={handleImagePress} style={styles.minimizeButton}>
            <Ionicons name="close" size={24} color={colors.white} />
          </TouchableOpacity>

          {/* Frameless Image Section - touches top, left, and right edges */}
          <View style={styles.framelessImageContainer}>
            {(profileImage || avatarData) ? (
              <Image
                source={{ uri: profileImage || avatarData }}
                style={styles.framelessImage}
                onError={(error) => {
                }}
              />
            ) : (
              <View style={[styles.framelessPlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={[styles.framelessPlaceholderText, { color: colors.white }]}>
                  {(user?.first_name || user?.firstName)?.[0]}{(user?.last_name || user?.lastName)?.[0]}
                </Text>
              </View>
            )}
          </View>

          {/* Profile Info Section - Below the image */}
          <View style={styles.framelessProfileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>
              {(user?.first_name || user?.firstName)} {(user?.last_name || user?.lastName)}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
              {user?.email}
            </Text>
            <Text style={[styles.profileLocation, { color: colors.textTertiary }]}>
              {user?.town}, {user?.county}
            </Text>

            <Text style={[styles.minimizeHint, { color: colors.textSecondary }]}>
              Tap the × to minimize
            </Text>
          </View>

          {/* Action Buttons - Below info */}
          <View style={styles.framelessHeaderActions}>
            {/* Single Theme Toggle Button */}
            <TouchableOpacity
              style={[
                styles.themeButton,
                {
                  backgroundColor: colors.primary + '20',
                  borderColor: colors.primary,
                }
              ]}
              onPress={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={theme === 'light' ? "moon" : "sunny"}
                size={22}
                color={colors.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: colors.error + '20' },
                loading && { opacity: 0.6 }
              ]}
              onPress={handleLogout}
              disabled={loading}
            >
              <Ionicons
                name="log-out-outline"
                size={22}
                color={colors.error}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
              onPress={() => navigation.navigate('Settings')}
            >
              <Ionicons
                name="settings"
                size={22}
                color={colors.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
              onPress={() => setEditing(!editing)}
            >
              <Ionicons
                name={editing ? "close" : "pencil"}
                size={22}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Normal layout: Side-by-side
        <View style={styles.profileHeader}>
          <TouchableOpacity
            style={styles.imageContainer}
            onPress={handleImagePress}
          >
            {(profileImage && profileImage !== 'avatar://cached-base64-image') ? (
              <Image
                source={{ uri: profileImage }}
                style={styles.profileImage}
                onError={(error) => {
                  setImageLoading(false);
                  // Don't immediately set to null, let user manually refresh or try different image
                  // setProfileImage(null); // Fallback to placeholder
                }}
                onLoadStart={() => {
                  setImageLoading(true);
                }}
                onLoadEnd={() => {
                  setImageLoading(false);
                }}
              />
            ) : avatarData ? (
              <Image
                source={{ uri: avatarData }}
                style={styles.profileImage}
                onError={(error) => {
                  setImageLoading(false);
                  setAvatarData(null); // Clear invalid cached data
                }}
                onLoadStart={() => {
                  setImageLoading(true);
                }}
                onLoadEnd={() => {
                  setImageLoading(false);
                }}
              />
            ) : (
              <View style={[styles.placeholderImage, { backgroundColor: colors.primary }]}>
                <Text style={[styles.placeholderText, { color: colors.white }]}>
                  {(user?.first_name || user?.firstName)?.[0]}{(user?.last_name || user?.lastName)?.[0]}
                </Text>
              </View>
            )}

            {editing && (
              <View style={[styles.editImageOverlay, { backgroundColor: colors.primary }]}>
                <Ionicons name="camera" size={20} color={colors.white} />
              </View>
            )}

            {!editing && (
              <View style={[styles.expandImageOverlay, { backgroundColor: colors.info + '90' }]}>
                <Ionicons name="expand" size={16} color={colors.white} />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>
              {(user?.first_name || user?.firstName)} {(user?.last_name || user?.lastName)}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
              {user?.email}
            </Text>

            {/* Action Icons under name and email */}
            <View style={styles.profileActionIcons}>
              {/* Single Theme Toggle Button */}
              <TouchableOpacity
                style={[
                  styles.themeButton,
                  {
                    backgroundColor: colors.primary + '20',
                    borderColor: colors.primary,
                  }
                ]}
                onPress={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={theme === 'light' ? "moon" : "sunny"}
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.profileActionButton,
                  { backgroundColor: colors.error + '20' },
                  loading && { opacity: 0.6 }
                ]}
                onPress={handleLogout}
                disabled={loading}
              >
                <Ionicons
                  name="log-out-outline"
                  size={20}
                  color={colors.error}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.profileActionButton, { backgroundColor: colors.primary + '20' }]}
                onPress={() => navigation.navigate('Settings')}
              >
                <Ionicons
                  name="settings"
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.profileActionButton, { backgroundColor: colors.primary + '20' }]}
                onPress={() => setEditing(!editing)}
              >
                <Ionicons
                  name={editing ? "close" : "pencil"}
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>

            <Text style={[styles.profileLocation, { color: colors.textTertiary }]}>
              {user?.town}, {user?.county}
            </Text>
          </View>


        </View>
      )}
    </Card>
  );

  const renderPersonalInfo = () => (
    <Card style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Personal Information
      </Text>

      <View style={styles.row}>
        <Input
          label="First Name"
          value={profileData.firstName}
          onChangeText={(text) => handleInputChange('firstName', text)}
          editable={editing}
          style={styles.halfInput}
        />

        <Input
          label="Last Name"
          value={profileData.lastName}
          onChangeText={(text) => handleInputChange('lastName', text)}
          editable={editing}
          style={styles.halfInput}
        />
      </View>

      <Input
        label="Email"
        value={profileData.email}
        onChangeText={(text) => handleInputChange('email', text)}
        editable={editing}
        keyboardType="email-address"
      />

      <Input
        label="Phone Number"
        value={profileData.phone}
        onChangeText={(text) => handleInputChange('phone', text)}
        editable={editing}
        keyboardType="phone-pad"
      />

      <View style={styles.row}>
        <Input
          label="County"
          value={profileData.county}
          onChangeText={(text) => handleInputChange('county', text)}
          editable={editing}
          style={styles.halfInput}
        />

        <Input
          label="Town"
          value={profileData.town}
          onChangeText={(text) => handleInputChange('town', text)}
          editable={editing}
          style={styles.halfInput}
        />
      </View>

      <Input
        label="Occupation"
        value={profileData.occupation}
        onChangeText={(text) => handleInputChange('occupation', text)}
        editable={editing}
        placeholder="Your job title or profession"
      />

      <Input
        label="Date of Birth"
        value={profileData.dateOfBirth}
        onChangeText={(text) => handleInputChange('dateOfBirth', text)}
        editable={editing}
        placeholder="YYYY-MM-DD (e.g., 1990-01-15)"
        keyboardType="numeric"
      />

      {/* Gender Field */}
      <View style={styles.fieldContainer}>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>
          Gender (Optional)
        </Text>
        {editing ? (
          <View style={[styles.genderContainer, { borderColor: colors.border }]}>
            {[
              { value: 'male', label: 'Male', icon: 'male' },
              { value: 'female', label: 'Female', icon: 'female' },
              { value: 'other', label: 'Other', icon: 'transgender' },
              { value: 'prefer_not_to_say', label: 'Prefer not to say', icon: 'help-circle-outline' }
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.genderOption,
                  { backgroundColor: colors.surface },
                  profileData.gender === option.value && {
                    backgroundColor: colors.primary + '20',
                    borderColor: colors.primary,
                    borderWidth: 2
                  }
                ]}
                onPress={() => handleInputChange('gender', option.value)}
              >
                <Ionicons
                  name={option.icon}
                  size={20}
                  color={profileData.gender === option.value ? colors.primary : colors.textSecondary}
                />
                <Text style={[
                  styles.genderOptionText,
                  { color: profileData.gender === option.value ? colors.primary : colors.textSecondary }
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={[styles.readOnlyField, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.readOnlyText, { color: colors.text }]}>
              {profileData.gender ?
                (['male', 'female', 'other', 'prefer_not_to_say'].find(g => g === profileData.gender) ?
                  profileData.gender.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) :
                  profileData.gender) :
                'Not specified'
              }
            </Text>
          </View>
        )}
      </View>

      <Input
        label="Bio"
        value={profileData.bio}
        onChangeText={(text) => handleInputChange('bio', text)}
        editable={editing}
        multiline
        numberOfLines={3}
        placeholder="Tell us about yourself..."
      />

      {editing && (
        <View style={styles.editActions}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={handleCancel}
            style={styles.editButton}
          />

          <Button
            title="Save Changes"
            onPress={handleSave}
            loading={loading}
            style={styles.editButton}
          />
        </View>
      )}
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderProfileHeader()}
        {renderPersonalInfo()}
        <View style={{ marginHorizontal: spacing.md, marginBottom: spacing.lg }}>
          {renderRecentActivity()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  section: {
    margin: spacing.md,
  },
  framelessCard: {
    padding: 0, // Remove padding for frameless design
    overflow: 'hidden', // Ensure image touches edges
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },

  // ── Recent Activity table (pure, no-card) ──
  activityTableHeader: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.ss,
    borderBottomWidth: 1,
  },
  activityHeaderText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityTableBody: {
    borderBottomWidth: 1,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    minHeight: 44,
  },
  activityCell: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 85,
    marginRight: spacing.xs,
  },
  activityCellText: {
    flex: 1,
  },
  activityTypeCell: {
    width: 105,
    marginRight: spacing.xs,
  },
  activityTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  activityTypeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.medium,
    marginLeft: 3,
    flexShrink: 1,
  },
  activityAmountText: {
    fontSize: 12,
    width: 80,
    textAlign: 'right',
    marginRight: spacing.xs,
    flexShrink: 0,
  },
  activityDescText: {
    fontSize: 12,
    flexShrink: 1,
  },
  activityFooter: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },

  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  placeholderImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
  },
  editImageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Frameless layout styles - within the same card
  framelessProfileLayout: {
    position: 'relative',
    overflow: 'hidden',
  },
  minimizeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: spacing.sm,
  },
  framelessImageContainer: {
    width: '100%',
    alignItems: 'center',
  },
  framelessImage: {
    width: '100%',
    height: 400, // Fixed height for consistency
    borderTopLeftRadius: borderRadius.xl, // Only top corners rounded to match card
    borderTopRightRadius: borderRadius.xl,
    borderBottomLeftRadius: 0, // No bottom rounding for frameless effect
    borderBottomRightRadius: 0,
  },
  framelessPlaceholder: {
    width: '100%',
    height: 400,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  framelessPlaceholderText: {
    fontSize: 80,
    fontWeight: typography.fontWeight.bold,
  },
  framelessProfileInfo: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: 'transparent',
  },
  minimizeHint: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  framelessHeaderActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  profileEmail: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.xs,
  },
  profileLocation: {
    fontSize: typography.fontSize.sm,
  },
  profileActionIcons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  profileActionButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },

  actionButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    marginLeft: spacing.xs,
  },
  themeButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  summaryItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  summaryValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  actionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  // Gender picker styles
  fieldContainer: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  genderContainer: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  genderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  genderOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  readOnlyField: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  readOnlyText: {
    fontSize: typography.fontSize.base,
  },
});

export default ProfileScreen;