import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import apiService from '../../../services/api';

const ProfileScreen = ({ navigation }) => {
  const { theme, setTheme, user, userRole, updateUser, wallets, chamas, logout, getCachedData, getLightningData, getCachedAvatarData } = useApp();
  const colors = getThemeColors(theme);

  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    first_name: user?.first_name || user?.firstName || '',
    last_name: user?.last_name || user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    county: user?.county || '',
    town: user?.town || '',
    bio: user?.bio || '',
    occupation: user?.occupation || '',
    date_of_birth: user?.date_of_birth || '',
    gender: user?.gender || '',
  });
  const [profileImage, setProfileImage] = useState(
    user?.profile_image && user?.profile_image !== 'avatar://cached-base64-image'
      ? user?.profile_image
      : null
  );
  const [avatarData, setAvatarData] = useState(null);

  // Debug current user avatar data
  useEffect(() => {
    // console.log('🖼️ ProfileScreen - Current user data:', {
    //   avatar: user?.avatar,
    //   profile_image: user?.profile_image,
    //   profileImageState: profileImage
    // });
  }, [user, profileImage]);

  // Handle cached avatar data
  useEffect(() => {
    const loadAvatarData = async () => {
      if (user?.avatar === 'avatar://cached-base64-image' || user?.profile_image === 'avatar://cached-base64-image') {
        console.log('🖼️ ProfileScreen: Loading cached avatar data');
        try {
          const cachedData = await getCachedAvatarData();
          if (cachedData) {
            console.log('🖼️ ProfileScreen: Found cached avatar data');
            setAvatarData(cachedData);
          }
        } catch (error) {
          console.log('🖼️ ProfileScreen: Failed to load cached avatar data:', error);
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
      const userData = response.data;
      setProfileData({
        first_name: userData.first_name || userData.firstName || '',
        last_name: userData.last_name || userData.lastName || '',
        email: userData.email || '',
        phone: userData.phone || '',
        county: userData.county || '',
        town: userData.town || '',
        bio: userData.bio || '',
        occupation: userData.occupation || '',
        date_of_birth: userData.date_of_birth || '',
        gender: userData.gender || '',
      });

      if (userData.profile_image && userData.profile_image !== 'avatar://cached-base64-image') {
        setProfileImage(userData.profile_image);
      } else if (userData.profile_image === 'avatar://cached-base64-image') {
        // Don't set the cached identifier as profileImage, let the useEffect handle it
        setProfileImage(null);
      }
    }
  };

  // Fetch fresh profile data from backend with lightning-fast caching
  const fetchProfileData = async () => {
    try {
      // console.log('⚡ Fetching profile data with lightning caching...');

      // Try to get cached data first for instant loading
      const cachedResult = await getCachedData('profile');
      if (cachedResult && cachedResult.success) {
        // console.log('⚡ Using cached profile data for instant load');
        updateProfileFromResponse(cachedResult);
      }

      // Then fetch fresh data from API
      const response = await apiService.getProfile();

      if (response.success && response.data) {
        // console.log('📊 Fresh profile data received from API');
        // console.log('🔍 Full API response:', response);

        // Use helper function to update profile data
        updateProfileFromResponse(response);

        // Update context with fresh data
        const userData = response.data.User || response.data.user || response.data;
        // console.log('👤 Extracted user data:', userData);
        // console.log('🖼️ Avatar in user data:', userData.avatar);
        // console.log('🖼️ Profile image in user data:', userData.profile_image);

        await updateUser(userData);

        // Set profile image with proper URL handling
        const avatarUrl = userData.avatar || userData.profile_image;
        // console.log('🖼️ Final avatar URL for display:', avatarUrl);


        if (avatarUrl) {
          let fullAvatarUrl;

          // Check if it's already a complete URL (http/https) or data URL
          if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) {
            fullAvatarUrl = avatarUrl;
          } else {
            // If it's a relative path, make it absolute
            fullAvatarUrl = `${apiService.baseURL}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
          }

          // console.log('🖼️ Setting profile image from API response:', fullAvatarUrl);

          // Set image URL - error handling will be done by Image component
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
      first_name: user?.first_name || user?.firstName || '',
      last_name: user?.last_name || user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      county: user?.county || '',
      town: user?.town || '',
      bio: user?.bio || '',
      occupation: user?.occupation || '',
      date_of_birth: user?.date_of_birth || '',
      gender: user?.gender || '',
    });

    // Handle profile image URL - check user context first, then preserve existing component state
    const avatarUrl = user?.avatar || user?.profile_image;
    // console.log('🖼️ updateLocalProfileData - Avatar URL from user context:', avatarUrl);
    // console.log('🖼️ updateLocalProfileData - Current profileImage state:', profileImage);

    if (avatarUrl && avatarUrl !== 'avatar://cached-base64-image') {
      let fullAvatarUrl;

      // Check if it's already a complete URL (http/https) or data URL
      if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) {
        fullAvatarUrl = avatarUrl;
      } else {
        // If it's a relative path, make it absolute
        fullAvatarUrl = `${apiService.baseURL}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
      }
      // console.log('🖼️ updateLocalProfileData - Setting profile image from user context:', fullAvatarUrl);
      setProfileImage(fullAvatarUrl);
    } else if (avatarUrl === 'avatar://cached-base64-image') {
      // Don't set the cached identifier as profileImage, let the useEffect handle it
      // console.log('🖼️ updateLocalProfileData - Found cached avatar identifier, not setting as profileImage');
      setProfileImage(null);
    } else if (!profileImage) {
      // Only set to null if we don't already have a profile image
      // console.log('🖼️ updateLocalProfileData - No avatar in user context and no existing profileImage, setting to null');
      setProfileImage(null);
    } else {
      // console.log('🖼️ updateLocalProfileData - No avatar in user context, but preserving existing profileImage:', profileImage);
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
        setProfileImage(result.assets[0].uri);
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
        // Map frontend field names to backend field names
        firstName: profileData.first_name,
        lastName: profileData.last_name,
        phone: profileData.phone,
        county: profileData.county,
        town: profileData.town,
        bio: profileData.bio,
        occupation: profileData.occupation,
        // Only include dateOfBirth if it's not empty
        ...(profileData.date_of_birth && profileData.date_of_birth.trim() !== '' && {
          dateOfBirth: profileData.date_of_birth
        }),
        // Only include gender if it's not empty
        ...(profileData.gender && profileData.gender.trim() !== '' && {
          gender: profileData.gender
        }),
        // Send profile_image field for proper image upload detection
        profile_image: profileImage,
        avatar: profileImage, // Keep both for compatibility
      };

      console.log('Updating profile with data:', {
        ...updateData,
        avatar: profileImage ? 'Image selected' : 'No image'
      });

      // Try API update first
      try {
        const response = await apiService.updateProfile(updateData);
        if (response.success) {
          // Extract user data from response (API returns { data: { user: {...} } })
          const updatedUserData = response.data?.user || response.data;
          await updateUser(updatedUserData);

          // Update local profileData state with the new values
          setProfileData(prevData => ({
            ...prevData,
            first_name: updateData.firstName || prevData.first_name,
            last_name: updateData.lastName || prevData.last_name,
            phone: updateData.phone || prevData.phone,
            county: updateData.county || prevData.county,
            town: updateData.town || prevData.town,
            bio: updateData.bio || prevData.bio,
            occupation: updateData.occupation || prevData.occupation,
            gender: updateData.gender || prevData.gender,
          }));

          // Force refresh profile data from updated user context after a short delay
          setTimeout(() => {
            if (updatedUserData) {
              setProfileData(prevData => ({
                ...prevData,
                first_name: updatedUserData.firstName || updatedUserData.first_name || prevData.first_name,
                last_name: updatedUserData.lastName || updatedUserData.last_name || prevData.last_name,
                phone: updatedUserData.phone || prevData.phone,
                county: updatedUserData.county || prevData.county,
                town: updatedUserData.town || prevData.town,
                bio: updatedUserData.bio || prevData.bio,
                occupation: updatedUserData.occupation || prevData.occupation,
                gender: updatedUserData.gender || prevData.gender,
              }));
            }
          }, 100);

          // Update profile image display immediately
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
          profile_image: profileImage, // Keep both for compatibility
          // Ensure both naming conventions are updated
          firstName: profileData.first_name,
          lastName: profileData.last_name,
          first_name: profileData.first_name,
          last_name: profileData.last_name,
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
      first_name: user?.first_name || user?.firstName || '',
      last_name: user?.last_name || user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      county: user?.county || '',
      town: user?.town || '',
      bio: user?.bio || '',
      occupation: user?.occupation || '',
      date_of_birth: user?.date_of_birth || '',
      gender: user?.gender || '',
    });
    setProfileImage(user?.profile_image || null);
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

  const getTotalBalance = () => {
    return wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
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
          value={profileData.first_name}
          onChangeText={(text) => handleInputChange('first_name', text)}
          editable={editing}
          style={styles.halfInput}
        />

        <Input
          label="Last Name"
          value={profileData.last_name}
          onChangeText={(text) => handleInputChange('last_name', text)}
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
        value={profileData.date_of_birth}
        onChangeText={(text) => handleInputChange('date_of_birth', text)}
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