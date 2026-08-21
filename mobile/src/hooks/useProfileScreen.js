import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useApp } from '../context/AppContext';
import apiService from '../services/api';
import { getTransactions } from '../services/api/walletEndpoints';
import { getUserChamas, payMemberServiceFee } from '../services/api/chamaEndpoints';
import * as ImagePicker from 'expo-image-picker';
import KENYA_COUNTIES from '../utils/kenyaCounties';
import {
  resolveAvatarUrl,
  formatCurrency,
  getActivityColor,
  getActivityIcon,
  getActivityDescription,
  formatActivityDate,
  getTotalBalance,
} from '../utils/profileHelpers';

const useProfileScreen = ({ navigation }) => {
  const {
    theme,
    user,
    userRole,
    updateUser,
    wallets,
    chamas,
    logout,
    getCachedData,
    getLightningData,
    getCachedAvatarData,
  } = useApp();

  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    idNumber: user?.idNumber || '',
    phone: user?.phone || '',
    county: user?.county || '',
    town: user?.town || '',
    bio: user?.bio || '',
    occupation: user?.occupation || '',
    dateOfBirth: user?.dateOfBirth || '',
    gender: user?.gender || '',
  });

  const uploadBaseUrl = apiService.uploadBaseUrl || apiService.baseURL || '';

  const [profileImage, setProfileImage] = useState(() => {
    if (user?.avatar && user?.avatar !== 'avatar://cached-base64-image') {
      return resolveAvatarUrl(user?.avatar, uploadBaseUrl);
    }
    return null;
  });
  const [avatarData, setAvatarData] = useState(null);
  const [showCountyPicker, setShowCountyPicker] = useState(false);
  const [countySearch, setCountySearch] = useState('');

  const filteredCounties = KENYA_COUNTIES.filter((county) =>
    county.toLowerCase().includes(countySearch.toLowerCase())
  );

  const [recentActivities, setRecentActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const [userChamas, setUserChamas] = useState([]);
  const [chamasLoading, setChamasLoading] = useState(false);
  const [payingChamaFee, setPayingChamaFee] = useState(null);
  const [lastPayAttempt, setLastPayAttempt] = useState(null);
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const PAY_COOLDOWN_MS = 30000;

  const [chamasPage, setChamasPage] = useState(1);
  const CHAMAS_PER_PAGE = 10;

  const [imageExpanded, setImageExpanded] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  const updateProfileFromResponse = useCallback((response) => {
    if (response.success && response.data) {
      const userData = response.data.User || response.data.user || response.data;
      setProfileData({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email || '',
        idNumber: userData.idNumber || '',
        phone: userData.phone || '',
        county: userData.county || '',
        town: userData.town || '',
        bio: userData.bio || '',
        occupation: userData.occupation || '',
        dateOfBirth: userData.dateOfBirth || '',
        gender: userData.gender || '',
      });

      if (userData.avatar && userData.avatar !== 'avatar://cached-base64-image') {
        setProfileImage(resolveAvatarUrl(userData.avatar, uploadBaseUrl));
      }
    }
  }, [uploadBaseUrl]);

  const fetchProfileData = useCallback(async () => {
    try {
      const cachedResult = await getCachedData('profile');
      if (cachedResult && cachedResult.success) {
        updateProfileFromResponse(cachedResult);
      }

      const response = await apiService.getProfile();

      if (response.success && response.data) {
        updateProfileFromResponse(response);

        const userData = response.data.User || response.data.user || response.data;
        await updateUser(userData);

        const avatarUrl = userData.avatar || userData.profile_image;
        if (avatarUrl && avatarUrl !== 'avatar://cached-base64-image') {
          const fullAvatarUrl = resolveAvatarUrl(avatarUrl, uploadBaseUrl);
          setProfileImage(fullAvatarUrl);
        }
      } else {
        console.warn('Failed to fetch profile data:', response.error);
      }
    } catch (error) {
      console.warn('Error fetching profile data:', error);
      updateLocalProfileData().catch(console.error);
    }
  }, [getCachedData, updateProfileFromResponse, updateUser]);

  const updateLocalProfileData = useCallback(async () => {
    setProfileData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      idNumber: user?.idNumber || '',
      phone: user?.phone || '',
      county: user?.county || '',
      town: user?.town || '',
      bio: user?.bio || '',
      occupation: user?.occupation || '',
      dateOfBirth: user?.dateOfBirth || '',
      gender: user?.gender || '',
    });

    if (profileImage && (profileImage.startsWith('http') || profileImage.startsWith('file://') || profileImage.startsWith('blob:') || profileImage.startsWith('data:'))) {
      return;
    }

    const avatarUrl = user?.avatar || user?.profile_image;
    if (!avatarUrl || avatarUrl === 'avatar://cached-base64-image') {
      return;
    }

    const fullAvatarUrl = resolveAvatarUrl(avatarUrl, uploadBaseUrl);
    setProfileImage(fullAvatarUrl);
  }, [user, profileImage, uploadBaseUrl]);

  const fetchProfileDataRef = useRef(fetchProfileData);
  fetchProfileDataRef.current = fetchProfileData;

  useEffect(() => {
    let isMounted = true;
    fetchProfileDataRef.current().then(() => {
      if (isMounted) {
        // fetch complete
      }
    }).catch((error) => {
      if (isMounted) {
        console.warn('Error fetching profile data:', error);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    updateLocalProfileData().catch(console.error);
  }, [user, updateLocalProfileData]);

  const handleInputChange = useCallback((field, value) => {
    setProfileData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permission Required',
          text2: 'Please grant camera roll permissions to change your profile picture.',
        });
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
        setProfileImage(selectedAsset.uri);
        setAvatarData(null);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to pick image',
      });
    }
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setLoading(true);

      const hasImage = profileImage && (
        profileImage.startsWith('file://') ||
        profileImage.startsWith('blob:') ||
        profileImage.startsWith('data:') ||
        profileImage.includes('ImagePicker')
      );

      const updateData = {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        idNumber: profileData.idNumber,
        phone: profileData.phone,
        county: profileData.county,
        town: profileData.town,
        bio: profileData.bio,
        occupation: profileData.occupation,
        ...(profileData.dateOfBirth && profileData.dateOfBirth.trim() !== '' && {
          dateOfBirth: profileData.dateOfBirth,
        }),
        ...(profileData.gender && profileData.gender.trim() !== '' && {
          gender: profileData.gender,
        }),
        ...(hasImage && { profile_image: profileImage }),
      };

      const response = await apiService.updateProfile(updateData);

      if (response.success) {
        const userData = response.Data?.User || response.data?.User || response.data?.user || response.Data || response.data;
        await updateUser(userData);

        setProfileData((prevData) => ({
          ...prevData,
          firstName: userData.firstName || prevData.firstName,
          lastName: userData.lastName || prevData.lastName,
          idNumber: userData.idNumber || prevData.idNumber,
          phone: userData.phone || prevData.phone,
          county: userData.county || prevData.county,
          town: userData.town || prevData.town,
          bio: userData.bio || prevData.bio,
          occupation: userData.occupation || prevData.occupation,
          dateOfBirth: userData.dateOfBirth || prevData.dateOfBirth,
          gender: userData.gender || prevData.gender,
        }));

        const newAvatarUrl = userData?.avatar || userData?.profile_image;
        if (newAvatarUrl && newAvatarUrl !== 'avatar://cached-base64-image') {
          setProfileImage(resolveAvatarUrl(newAvatarUrl, uploadBaseUrl));
        }

        setEditing(false);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Profile updated successfully',
        });
      } else {
        throw new Error(response.error || response.Data?.Message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to update profile. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [profileData, profileImage, updateUser]);

  const handleCancel = useCallback(() => {
    setProfileData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      idNumber: user?.idNumber || '',
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
  }, [user]);

  const handleImagePress = useCallback(() => {
    if (editing) {
      pickImage();
    } else {
      setImageExpanded((prev) => !prev);
    }
  }, [editing, pickImage]);

  const loadRecentActivities = useCallback(async () => {
    try {
      setActivitiesLoading(true);
      const response = await getTransactions(50, 0);

      if (response.success && Array.isArray(response.data)) {
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

  const loadUserChamas = useCallback(async () => {
    try {
      setChamasLoading(true);
      const response = await getUserChamas(50, 0);
      if (response.success && response.data) {
        setUserChamas(response.data);
      }
    } catch (error) {
      console.warn('Failed to load user chamas:', error);
    } finally {
      setChamasLoading(false);
    }
  }, []);

  const handlePayChamaFee = useCallback(
    async (chama) => {
      if (!chama?.id) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Chama information is missing',
        });
        return;
      }

      const now = Date.now();
      if (lastPayAttempt && now - lastPayAttempt < PAY_COOLDOWN_MS) {
        const remaining = Math.ceil((PAY_COOLDOWN_MS - (Date.now() - lastPayAttempt)) / 1000);
        Toast.show({
          type: 'info',
          text1: 'Please wait',
          text2: `Cooldown active. Try again in ${remaining}s`,
        });
        return;
      }

      try {
        setPayingChamaFee(chama.id);
        setLastPayAttempt(Date.now());
        setCooldownActive(true);
        const response = await payMemberServiceFee(chama.id, user?.id);
        if (response.success) {
          Toast.show({
            type: 'success',
            text1: 'Payment Initiated',
            text2: 'STK push sent to your phone',
          });
          loadUserChamas();
        } else {
          throw new Error(response.error || 'Failed to initiate payment');
        }
      } catch (error) {
        if (error.message && error.message.includes('Service fee already paid')) {
          Toast.show({
            type: 'info',
            text1: 'Already Paid',
            text2: 'This service fee was already paid',
          });
          loadUserChamas();
          return;
        }
        Toast.show({
          type: 'error',
          text1: 'Payment Failed',
          text2: error.message || 'Failed to initiate payment',
        });
      } finally {
        setPayingChamaFee(null);
      }
    },
    [user?.id, lastPayAttempt, loadUserChamas]
  );

  const handleLogout = useCallback(async () => {
    setLoading(true);

    Toast.show({
      type: 'info',
      text1: 'Logging out...',
      text2: 'Please wait while we securely log you out',
    });

    try {
      try {
        await apiService.logout();
      } catch (apiError) {
        // ignore logout API errors
      }

      await logout();
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
  }, [logout]);

  // Cooldown timer
  useEffect(() => {
    let timer;
    if (lastPayAttempt && cooldownActive) {
      const updateCooldown = () => {
        const remaining = Math.ceil((PAY_COOLDOWN_MS - (Date.now() - lastPayAttempt)) / 1000);
        if (remaining <= 0) {
          setCooldownActive(false);
          setCooldownRemaining(0);
        } else {
          setCooldownRemaining(remaining);
        }
      };
      updateCooldown();
      timer = setInterval(updateCooldown, 1000);
    }
    return () => clearInterval(timer);
  }, [lastPayAttempt, cooldownActive]);

  // Load avatar data
  useEffect(() => {
    const loadAvatarData = async () => {
      if (user?.avatar === 'avatar://cached-base64-image' || user?.profile_image === 'avatar://cached-base64-image') {
        try {
          const cachedData = await getCachedAvatarData();
          if (cachedData) {
            setAvatarData(cachedData);
          }
        } catch (error) {
          // ignore
        }
      } else {
        setAvatarData(null);
      }
    };

    loadAvatarData();
  }, [user?.avatar, user?.profile_image, getCachedAvatarData]);

  useEffect(() => {
    loadRecentActivities();
  }, [loadRecentActivities]);

  useEffect(() => {
    loadUserChamas();
  }, [loadUserChamas]);

  const selectCounty = useCallback((county) => {
    setProfileData((prev) => ({
      ...prev,
      county: county,
    }));
    setShowCountyPicker(false);
    setCountySearch('');
  }, []);

  return {
    theme,
    user,
    userRole,
    colors: null, // computed in screen from theme
    loading,
    editing,
    profileData,
    profileImage,
    avatarData,
    showCountyPicker,
    countySearch,
    setCountySearch,
    filteredCounties,
    selectCounty,
    setShowCountyPicker,
    recentActivities,
    activitiesLoading,
    userChamas,
    chamasLoading,
    payingChamaFee,
    cooldownActive,
    cooldownRemaining,
    chamasPage,
    setChamasPage,
    CHAMAS_PER_PAGE,
    imageExpanded,
    imageLoading,
    setImageExpanded,
    setImageLoading,
    setEditing,
    handleInputChange,
    pickImage,
    handleSave,
    handleCancel,
    handleImagePress,
    loadRecentActivities,
    loadUserChamas,
    handlePayChamaFee,
    handleLogout,
    updateProfileFromResponse,
    fetchProfileData,
    updateLocalProfileData,
    // helpers
    formatCurrency,
    getActivityColor,
    getActivityIcon,
    getActivityDescription,
    formatActivityDate,
    getTotalBalance,
    resolveAvatarUrl,
  };
};

export default useProfileScreen;
