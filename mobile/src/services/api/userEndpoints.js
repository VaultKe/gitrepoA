import { makeRequest, makeRequestWithRetry } from './client';
import { Platform } from 'react-native';
import { getAllKeys } from '@react-native-async-storage/async-storage';

const getProfile = async () => {
  return await makeRequest('/users/profile');
};

const updateProfile = async (profileData) => {
  const imageField = profileData.profile_image || profileData.avatar;
  if (imageField && (imageField.startsWith('file://') || imageField.startsWith('blob:') || imageField.startsWith('data:') || imageField.includes('ImagePicker'))) {
    return await updateProfileWithImage(profileData);
  }
  return await makeRequest('/users/profile', {
    method: 'PUT',
    body: profileData,
  });
};

const updateProfileWithImage = async (profileData) => {
  const formData = new FormData();
  const imageUri = profileData.profile_image || profileData.avatar;

  if (imageUri) {
    if (imageUri instanceof File) {
      formData.append('profile_image', imageUri, imageUri.name);
    } else if (imageUri.startsWith('data:')) {
      // Handle base64 data URIs (e.g. from Expo ImagePicker on web)
      const mimeTypeMatch = imageUri.match(/^data:(image\/\w+);base64,/);
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
      const ext = mimeType.split('/')[1] || 'jpg';
      const filename = `profile_${Date.now()}.${ext}`;

      if (Platform.OS === 'web') {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append('profile_image', blob, filename);
      } else {
        formData.append('profile_image', {
          uri: imageUri,
          name: filename,
          type: mimeType,
        });
      }
    } else {
      const filename = imageUri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      if (Platform.OS === 'web') {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append('profile_image', blob, filename);
      } else {
        formData.append('profile_image', {
          uri: imageUri,
          name: filename,
          type: type,
        });
      }
    }
  }

  Object.keys(profileData).forEach(key => {
    if (key !== 'profile_image' && key !== 'avatar' && profileData[key] !== null && profileData[key] !== undefined) {
      formData.append(key, profileData[key]);
    }
  });

  return await makeRequest('/users/profile', {
    method: 'PUT',
    body: formData,
  });
};

const uploadAvatar = async (imageUri) => {
  try {
    const formData = new FormData();

    if (imageUri) {
      if (imageUri instanceof File) {
        formData.append('avatar', imageUri, imageUri.name);
      } else if (imageUri.startsWith('data:')) {
        // Handle base64 data URIs
        const mimeTypeMatch = imageUri.match(/^data:(image\/\w+);base64,/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
        const ext = mimeType.split('/')[1] || 'jpg';
        const filename = `avatar_${Date.now()}.${ext}`;

        if (Platform.OS === 'web') {
          const response = await fetch(imageUri);
          const blob = await response.blob();
          formData.append('avatar', blob, filename);
        } else {
          formData.append('avatar', {
            uri: imageUri,
            name: filename,
            type: mimeType,
          });
        }
      } else {
        const filename = imageUri.split('/').pop() || 'profile.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        if (Platform.OS === 'web') {
          const response = await fetch(imageUri);
          const blob = await response.blob();
          formData.append('avatar', blob, filename);
        } else {
          formData.append('avatar', {
            uri: imageUri,
            name: filename,
            type: type,
          });
        }
      }
    }

    return await makeRequest('/users/avatar', {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    console.error('uploadAvatar error:', error);
    throw error;
  }
};

const getUsers = async (limit = 50, offset = 0, query = '') => {
  let url = `/users/?limit=${limit}&offset=${offset}`;
  if (query) {
    url += `&q=${encodeURIComponent(query)}`;
  }
  return await makeRequest(url);
};

const searchUserByCredentials = async (phone, nationalId) => {
  return await makeRequest(`/users/search-by-credentials?phone=${encodeURIComponent(phone)}&nationalId=${encodeURIComponent(nationalId)}`);
};

const searchUserByIdNumber = async (nationalId) => {
  return await makeRequest(`/users/search-by-national-id?nationalId=${encodeURIComponent(nationalId)}`);
};

const searchUserByPhone = async (phone) => {
  return await makeRequest(`/users/search-by-phone?phone=${encodeURIComponent(phone)}`);
};

const searchUsers = async (query) => {
  return await makeRequest(`/users/search?q=${encodeURIComponent(query)}`);
};

const getAllUsersForAdmin = async (limit = 15, offset = 0, query = '') => {
  let url = `/users/admin/all?limit=${limit}&offset=${offset}`;
  if (query) {
    url += `&q=${encodeURIComponent(query)}`;
  }
  return await makeRequest(url);
};

const getAllUsersComplete = async (query = '') => {
  try {
    let url = `/users/admin/all?limit=1000&offset=0`;
    if (query) {
      url += `&q=${encodeURIComponent(query)}`;
    }

    let response = await makeRequest(url);

    if (!response.success && response.status === 404) {
      const fallbackUrl = `/users?limit=1000&offset=0${query ? `&q=${encodeURIComponent(query)}` : ''}`;
      response = await makeRequest(fallbackUrl);
    }

    if (!response.success && response.status === 404) {
      const apiUrl = `/api/users?limit=1000&offset=0${query ? `&q=${encodeURIComponent(query)}` : ''}`;
      response = await makeRequest(apiUrl);
    }

    if (!response.success) {
      try {
        const basicResponse = await makeRequest('/users');
        if (basicResponse.success && basicResponse.data) {
          response = basicResponse;
        }
      } catch (basicError) {
      }
    }

    if (response.success && response.data) {
      const uniqueUsers = response.data.reduce((acc, user) => {
        if (user && user.id && !acc.find(existing => existing.id === user.id)) {
          acc.push(user);
        }
        return acc;
      }, []);

      return {
        success: true,
        data: uniqueUsers,
        totalCount: uniqueUsers.length,
        hasDuplicates: response.data.length !== uniqueUsers.length
      };
    }

    return response;
  } catch (error) {
    return { success: false, error: error.message, data: [] };
  }
};

const getUserStatistics = async () => {
  return await makeRequest('/users/statistics');
};

const getAdminStatistics = async () => {
  return await makeRequest('/users/admin/statistics');
};

const getSystemAnalytics = async (period = '7d') => {
  try {
    let response = await makeRequest(`/admin/analytics?period=${period}`);
    if (!response.success && response.status === 404) {
      response = await buildSystemAnalytics(period);
    }
    return response;
  } catch (error) {
    return { success: false, error: error.message, data: null };
  }
};

const buildSystemAnalytics = async (period = '7d') => {
  try {
    const [usersResponse, chamasResponse, transactionsResponse] = await Promise.all([
      getAllUsersComplete(),
      (await import('./chamaEndpoints')).getChamas(1000, 0),
      (await import('./walletEndpoints')).getTransactions(1000, 0)
    ]);

    const analytics = calculateSystemAnalytics(
      usersResponse.data || [],
      chamasResponse.data || [],
      transactionsResponse.data || [],
      period
    );

    return {
      success: true,
      data: analytics,
      source: 'calculated',
      period: period
    };
  } catch (error) {
    return { success: false, error: error.message, data: null };
  }
};

const calculateSystemAnalytics = (users, chamas, transactions, period) => {
  const now = new Date();
  const periodDays = parseInt(period.replace('d', '')) || 7;
  const periodStart = new Date(now.getTime() - (periodDays * 24 * 60 * 60 * 1000));

  const recentTransactions = transactions.filter(t =>
    new Date(t.createdAt || t.created_at) >= periodStart
  );
  const recentUsers = users.filter(u =>
    new Date(u.createdAt || u.created_at) >= periodStart
  );
  const recentChamas = chamas.filter(c =>
    new Date(c.createdAt || c.created_at) >= periodStart
  );

  const userMetrics = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    inactive: users.filter(u => u.status !== 'active').length,
    newUsers: recentUsers.length,
    adminUsers: users.filter(u => u.role === 'admin').length
  };

  const chamaMetrics = {
    total: chamas.length,
    active: chamas.filter(c => c.isActive !== false).length,
    newChamas: recentChamas.length,
    totalMembers: chamas.reduce((sum, c) => sum + (c.memberCount || 0), 0)
  };

  const transactionMetrics = {
    total: transactions.length,
    recentCount: recentTransactions.length,
    totalVolume: transactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0),
    recentVolume: recentTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0),
    avgTransaction: transactions.length > 0 ?
      transactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) / transactions.length : 0
  };

  const growthRates = {
    userGrowth: users.length > 0 ? (recentUsers.length / users.length) * 100 : 0,
    chamaGrowth: chamas.length > 0 ? (recentChamas.length / chamas.length) * 100 : 0,
    transactionGrowth: transactions.length > 0 ? (recentTransactions.length / transactions.length) * 100 : 0
  };

  const systemHealth = {
    activeUserRate: users.length > 0 ? (userMetrics.active / users.length) * 100 : 0,
    activeChamaRate: chamas.length > 0 ? (chamaMetrics.active / chamas.length) * 100 : 0,
    avgMembersPerChama: chamas.length > 0 ? chamaMetrics.totalMembers / chamas.length : 0
  };

  return {
    period: period,
    generatedAt: now.toISOString(),
    users: userMetrics,
    chamas: chamaMetrics,
    transactions: transactionMetrics,
    growth: growthRates,
    health: systemHealth,
    summary: {
      totalUsers: userMetrics.total,
      totalChamas: chamaMetrics.total,
      totalTransactions: transactionMetrics.total,
      totalVolume: transactionMetrics.totalVolume,
      healthScore: Math.round((systemHealth.activeUserRate + systemHealth.activeChamaRate) / 2)
    }
  };
};

const searchUserByPhoneAndNationalId = async (phone, nationalId) => {
  return await makeRequest(`/users/search?phone=${encodeURIComponent(phone)}&nationalId=${encodeURIComponent(nationalId)}`);
};

const sendOnboardingTOTP = async (phone, userId) => {
  return await makeRequest('/auth/send-onboarding-totp', {
    method: 'POST',
    body: { phone, userId },
  });
};

const verifyOnboardingTOTP = async (code, userId) => {
  return await makeRequest('/auth/verify-onboarding-totp', {
    method: 'POST',
    body: { code, userId },
  });
};

const onboardUser = async (userData) => {
  return await makeRequest('/users/onboard', {
    method: 'POST',
    body: userData,
  });
};

const updateUserPhoneVerified = async (userId, verified) => {
  return await makeRequest(`/users/${userId}/phone-verified`, {
    method: 'PUT',
    body: { verified },
  });
};

const updateUserPaymentStatus = async (userId, hasPaid) => {
  return await makeRequest(`/users/${userId}/registration-payment`, {
    method: 'PUT',
    body: { hasPaid },
  });
};

export {
  getProfile,
  updateProfile,
  uploadAvatar,
  getUsers,
  searchUsers,
  searchUserByCredentials,
  searchUserByIdNumber,
  searchUserByPhone,
  getAllUsersForAdmin,
  getAllUsersComplete,
  getUserStatistics,
  getAdminStatistics,
  getSystemAnalytics,
  buildSystemAnalytics,
  calculateSystemAnalytics,
  sendOnboardingTOTP,
  verifyOnboardingTOTP,
  onboardUser,
  updateUserPhoneVerified,
  updateUserPaymentStatus,
};