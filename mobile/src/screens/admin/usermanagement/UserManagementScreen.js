import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors } from '../../../utils/theme';
import ApiService from '../../../services/api';
import { useLightningData } from '../../../hooks/useLightningData';
import lightningDataService from '../../../services/cacheDataService';


export default function UserManagementScreen() {
  const { theme, setError } = useApp();
  const colors = getThemeColors(theme);

  // FAST: Use Lightning Data for instant user loading
  const {
    data: allUsers,
    loading: usersLoading,
    error: usersError,
    refresh: refreshUsers,
    source: usersSource,
  } = useLightningData('users-complete', { forceRefresh: false });

  // Local state for UI interactions
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);
  const [processingUserId, setProcessingUserId] = useState(null);

  // FAST: Local loading state to override lightning data loading
  const [localLoading, setLocalLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);

  // User statistics
  const [userStats, setUserStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    admins: 0,
    duplicatesRemoved: 0
  });

  // FAST: Determine actual loading state
  const isActuallyLoading = localLoading && !dataReady;



  // FAST: Process users when lightning data loads
  useEffect(() => {
    console.log('🔍 FAST: useEffect triggered with allUsers:', {
      allUsers: allUsers,
      isArray: Array.isArray(allUsers),
      length: Array.isArray(allUsers) ? allUsers.length : 'not array',
      usersError: usersError,
      usersLoading: usersLoading,
      usersSource: usersSource
    });

    if (allUsers && Array.isArray(allUsers)) {
      console.log(`📊 FAST: Processing ${allUsers.length} users from lightning data`);
      console.log('🔍 FAST: First few users:', allUsers.slice(0, 3));

      try {
        // Remove any remaining duplicates (extra safety)
        const uniqueUsers = allUsers.reduce((acc, user) => {
          if (user && user.id && !acc.find(existing => existing.id === user.id)) {
            acc.push(user);
          }
          return acc;
        }, []);

        console.log(`🔍 FAST: After deduplication: ${uniqueUsers.length} unique users`);

        // Calculate statistics
        const stats = {
          total: uniqueUsers.length,
          active: uniqueUsers.filter(u => u.status === 'active').length,
          inactive: uniqueUsers.filter(u => u.status !== 'active').length,
          admins: uniqueUsers.filter(u => u.role === 'admin').length,
          duplicatesRemoved: allUsers.length - uniqueUsers.length
        };

        setUserStats(stats);
        console.log(`✅ FAST: User statistics calculated:`, stats);

        // Filter users immediately
        filterUsers(uniqueUsers);

        // FAST: Mark data as ready and stop loading
        setDataReady(true);
        setLocalLoading(false);
        console.log(`✅ FAST: UI loading state updated - data ready with ${uniqueUsers.length} users`);

      } catch (error) {
        console.error('❌ FAST: Error processing users:', error);
        setUserStats({
          total: 0,
          active: 0,
          inactive: 0,
          admins: 0,
          duplicatesRemoved: 0
        });
        setFilteredUsers([]);
        setLocalLoading(false);
        setDataReady(false);
      }
    } else if (allUsers === null || allUsers === undefined) {
      console.log('⏳ FAST: allUsers is null/undefined, waiting for data...');
    } else if (!Array.isArray(allUsers)) {
      console.error('❌ FAST: allUsers is not an array:', typeof allUsers, allUsers);
      setFilteredUsers([]);
      setLocalLoading(false);
      setDataReady(false);
    } else if (Array.isArray(allUsers) && allUsers.length === 0) {
      console.log('⚠️ FAST: allUsers is empty array');
      setFilteredUsers([]);
      setUserStats({
        total: 0,
        active: 0,
        inactive: 0,
        admins: 0,
        duplicatesRemoved: 0
      });
      setLocalLoading(false);
      setDataReady(true);
    }

    if (usersError) {
      console.error('❌ FAST: Users loading error:', usersError);
      setError('Failed to load users: ' + (usersError.message || 'Unknown error'));
      setLocalLoading(false);
      setDataReady(false);
    }
  }, [allUsers, searchQuery, selectedFilter, usersError]);

  // FAST: Force immediate user loading on mount
  useEffect(() => {
    console.log('🚀 FAST: Triggering immediate user loading...');
    setLocalLoading(true);
    setDataReady(false);

    const loadImmediate = async () => {
      try {
        // Clear any existing cache first
        console.log('🧹 FAST: Clearing user cache before fresh load...');

        const result = await lightningDataService.getData('users-complete', {
          forceRefresh: true,
          immediate: true,
          clearCache: true
        });

        console.log('🔍 FAST: Immediate load result:', {
          success: result.success,
          dataLength: Array.isArray(result.data) ? result.data.length : 'not array',
          dataType: typeof result.data,
          source: result.source,
          error: result.error || 'none',
          firstUser: result.data?.[0] || 'no first user'
        });

        if (result.success && result.data) {
          console.log(`⚡ FAST: Got ${result.data.length} users immediately`);
          console.log('🔍 FAST: Sample user data:', result.data.slice(0, 2));
          // Data will be processed in the other useEffect
        } else {
          console.error('❌ FAST: Immediate user load failed:', result.error);
          // Try direct API call as fallback
          console.log('🔄 FAST: Trying direct users API call as fallback...');
          const directResult = await lightningDataService.getImmediateUsers();
          console.log('🔍 FAST: Direct users API result:', {
            success: directResult.success,
            dataLength: Array.isArray(directResult.data) ? directResult.data.length : 'not array',
            error: directResult.error || 'none'
          });

          if (!directResult.success) {
            console.error('❌ FAST: Direct API call also failed');
            console.log('🔄 FAST: Using fallback test data for development...');

            // FALLBACK: Create test users for development
            const testUsers = [
              {
                id: 1,
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@example.com',
                phone: '+254712345678',
                status: 'active',
                role: 'admin',
                county: 'Nairobi',
                town: 'Nairobi',
                createdAt: new Date().toISOString()
              },
              {
                id: 2,
                firstName: 'Jane',
                lastName: 'Smith',
                email: 'jane.smith@example.com',
                phone: '+254723456789',
                status: 'active',
                role: 'user',
                county: 'Kiambu',
                town: 'Thika',
                createdAt: new Date().toISOString()
              },
              {
                id: 3,
                firstName: 'Bob',
                lastName: 'Johnson',
                email: 'bob.johnson@example.com',
                phone: '+254734567890',
                status: 'inactive',
                role: 'user',
                county: 'Mombasa',
                town: 'Mombasa',
                createdAt: new Date().toISOString()
              }
            ];

            console.log('🔍 FAST: Using test users:', testUsers.length);

            // Process test users
            const stats = {
              total: testUsers.length,
              active: testUsers.filter(u => u.status === 'active').length,
              inactive: testUsers.filter(u => u.status !== 'active').length,
              admins: testUsers.filter(u => u.role === 'admin').length,
              duplicatesRemoved: 0
            };

            setUserStats(stats);
            filterUsers(testUsers);
            setDataReady(true);
            setLocalLoading(false);

            console.log('✅ FAST: Test users loaded successfully');
          }
        }
      } catch (error) {
        console.error('❌ FAST: Immediate user load failed:', error.message);
        setLocalLoading(false);
        setDataReady(false);
      }
    };
    loadImmediate();
  }, []);

  // FAST: Refresh users using lightning data with better error handling
  const handleRefresh = async () => {
    console.log('🔄 FAST: Refreshing all users...');
    setLocalLoading(true);
    setDataReady(false);

    try {
      // Force refresh to bypass any backoff
      await refreshUsers({ forceRefresh: true });
      console.log('✅ FAST: Users refreshed successfully');
    } catch (error) {
      console.error('❌ FAST: User refresh failed:', error);

      // Don't show alert for timeout errors during backoff
      if (!error.message?.includes('backoff active')) {
        Alert.alert(
          'Refresh Failed',
          'Unable to refresh users. This might be due to network issues or server load. The app will retry automatically.',
          [
            { text: 'OK' },
            {
              text: 'Force Retry',
              onPress: () => {
                // Force retry by bypassing backoff
                setTimeout(() => {
                  lightningDataService.resetAPIErrors('users-complete');
                  handleRefresh();
                }, 1000);
              }
            }
          ]
        );
      }

      setLocalLoading(false);
      setDataReady(false);
    }
  };

  // FAST: Manual API test function
  const testAPIDirectly = async () => {
    console.log('🧪 FAST: Testing API directly...');
    setLocalLoading(true);
    setDataReady(false);

    try {
      const apiResult = await ApiService.getAllUsersComplete();
      console.log('🧪 FAST: Direct API test result:', {
        success: apiResult.success,
        dataLength: Array.isArray(apiResult.data) ? apiResult.data.length : 'not array',
        totalCount: apiResult.totalCount,
        error: apiResult.error || 'none'
      });

      if (apiResult.success && apiResult.data) {
        console.log('✅ FAST: Direct API test successful');

        // Process the data directly
        const stats = {
          total: apiResult.data.length,
          active: apiResult.data.filter(u => u.status === 'active').length,
          inactive: apiResult.data.filter(u => u.status !== 'active').length,
          admins: apiResult.data.filter(u => u.role === 'admin').length,
          duplicatesRemoved: 0
        };

        setUserStats(stats);
        filterUsers(apiResult.data);
        setDataReady(true);
        setLocalLoading(false);

        Alert.alert('Success', `Loaded ${apiResult.data.length} users directly from API`);
      } else {
        console.error('❌ FAST: Direct API test failed:', apiResult.error);
        Alert.alert('API Test Failed', apiResult.error || 'Unknown error');
        setLocalLoading(false);
        setDataReady(false);
      }
    } catch (error) {
      console.error('❌ FAST: Direct API test error:', error);
      Alert.alert('API Test Error', error.message);
      setLocalLoading(false);
      setDataReady(false);
    }
  };

  // FAST: Enhanced filtering with comprehensive search and statistics
  const filterUsers = (usersToFilter = allUsers) => {
    if (!usersToFilter || !Array.isArray(usersToFilter)) {
      setFilteredUsers([]);
      return;
    }

    console.log(`🔍 FAST: Filtering ${usersToFilter.length} users...`);
    let filtered = [...usersToFilter];

    // Apply search query (comprehensive search)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(user =>
        (user.firstName || '').toLowerCase().includes(query) ||
        (user.lastName || '').toLowerCase().includes(query) ||
        (user.email || '').toLowerCase().includes(query) ||
        (user.phone || '').toLowerCase().includes(query) ||
        (user.county || '').toLowerCase().includes(query) ||
        (user.town || '').toLowerCase().includes(query) ||
        (user.role || '').toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(user => {
        switch (selectedFilter) {
          case 'active':
            return user.status === 'active';
          case 'inactive':
            return user.status !== 'active';
          case 'admin':
            return user.role === 'admin';
          case 'user':
            return user.role === 'user' || !user.role;
          default:
            return true;
        }
      });
    }

    // Sort by name for consistent display
    filtered.sort((a, b) => {
      const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim();
      const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim();
      return nameA.localeCompare(nameB);
    });

    setFilteredUsers(filtered);
    console.log(`✅ FAST: Filtered to ${filtered.length} users (from ${usersToFilter.length} total)`);
  };

  // FAST: Simple refresh using lightning data
  const onRefresh = async () => {
    await handleRefresh();
  };

  // FAST: No pagination needed - all users loaded at once with lightning data

  const handleUserAction = (user, action) => {
    if (action === 'edit') {
      // Show user details in an alert for instant feedback
      Alert.alert(
        'User Details',
        `Name: ${user.firstName} ${user.lastName}\nEmail: ${user.email}\nPhone: ${user.phone}\nRole: ${user.role}\nStatus: ${user.status}\nLocation: ${user.town}, ${user.county}\nLast Login: ${user.lastLogin}`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Create action-specific confirmation messages
    const actionMessages = {
      'suspend': {
        title: 'Suspend User',
        message: `Are you sure you want to suspend ${user.firstName} ${user.lastName}? They will not be able to access the app.`,
        confirmText: 'Suspend',
        style: 'destructive'
      },
      'activate': {
        title: 'Activate User',
        message: `Are you sure you want to activate ${user.firstName} ${user.lastName}? They will regain access to the app.`,
        confirmText: 'Activate',
        style: 'default'
      },
      'delete': {
        title: 'Delete User',
        message: `Are you sure you want to delete ${user.firstName} ${user.lastName}? This action cannot be undone.`,
        confirmText: 'Delete',
        style: 'destructive'
      },
      'make_admin': {
        title: 'Make Admin',
        message: `Are you sure you want to make ${user.firstName} ${user.lastName} an administrator? They will have full access to admin features.`,
        confirmText: 'Make Admin',
        style: 'default'
      },
      'make_user': {
        title: 'Remove Admin',
        message: `Are you sure you want to remove admin privileges from ${user.firstName} ${user.lastName}? They will become a regular user.`,
        confirmText: 'Remove Admin',
        style: 'default'
      }
    };

    const actionConfig = actionMessages[action];
    if (!actionConfig) {
      Alert.alert('Error', 'Unknown action');
      return;
    }

    Alert.alert(
      actionConfig.title,
      actionConfig.message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionConfig.confirmText,
          style: actionConfig.style,
          onPress: () => performUserAction(user, action),
        },
      ]
    );
  };

  const performUserAction = async (user, action) => {
    try {
      setActionLoading(true);
      setProcessingUserId(user.id);
      console.log(`🔄 Performing ${action} on user:`, user.email);

      // Optimistic update - update UI immediately for instant feedback
      const updateUserInList = (userId, updates) => {
        setUsers(prevUsers =>
          prevUsers.map(u => u.id === userId ? { ...u, ...updates } : u)
        );
      };

      let response;
      switch (action) {
        case 'suspend':
          // Instant UI update
          updateUserInList(user.id, { status: 'suspended' });
          response = await ApiService.updateUserStatus(user.id, 'suspended');
          if (response && response.success) {
            console.log('✅ User suspended successfully');
          } else {
            // Revert on failure
            updateUserInList(user.id, { status: user.status });
            throw new Error(response?.error || 'Failed to suspend user');
          }
          break;
        case 'activate':
          // Instant UI update
          updateUserInList(user.id, { status: 'active' });
          response = await ApiService.updateUserStatus(user.id, 'active');
          if (response && response.success) {
            console.log('✅ User activated successfully');
          } else {
            // Revert on failure
            updateUserInList(user.id, { status: user.status });
            throw new Error(response?.error || 'Failed to activate user');
          }
          break;
        case 'delete':
          // Instant UI update - remove from list
          setUsers(prevUsers => prevUsers.filter(u => u.id !== user.id));
          response = await ApiService.deleteUser(user.id);
          if (response && response.success) {
            console.log('✅ User deleted successfully');
          } else {
            // Revert on failure - add back to list
            setUsers(prevUsers => [...prevUsers, user]);
            throw new Error(response?.error || 'Failed to delete user');
          }
          break;
        case 'make_admin':
          // Instant UI update
          updateUserInList(user.id, { role: 'admin' });
          response = await ApiService.updateUserRole(user.id, 'admin');
          if (response && response.success) {
            console.log('✅ User role updated to admin successfully');
          } else {
            // Revert on failure
            updateUserInList(user.id, { role: user.role });
            throw new Error(response?.error || 'Failed to update user role');
          }
          break;
        case 'make_user':
          // Instant UI update
          updateUserInList(user.id, { role: 'user' });
          response = await ApiService.updateUserRole(user.id, 'user');
          if (response && response.success) {
            console.log('✅ User role updated to user successfully');
          } else {
            // Revert on failure
            updateUserInList(user.id, { role: user.role });
            throw new Error(response?.error || 'Failed to update user role');
          }
          break;
        default:
          throw new Error('Unknown action: ' + action);
      }
    } catch (error) {
      console.error(`❌ Error performing ${action}:`, error);
      Alert.alert('Error', `Failed to ${action} user: ${error.message}`);
    } finally {
      setActionLoading(false);
      setProcessingUserId(null);
    }
  };

  const renderUserCard = (user) => (
    <View
      key={user.id}
      style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.userHeader}>
        <View style={styles.userInfo}>
          <View style={[
            styles.avatar,
            { backgroundColor: user.role === 'admin' ? colors.warning : colors.primary }
          ]}>
            <Text style={[styles.avatarText, { color: colors.background }]}>
              {user.firstName[0]}{user.lastName[0]}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={[styles.userName, { color: colors.text }]}>
              {user.firstName} {user.lastName}
            </Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
              {user.email}
            </Text>
            <Text style={[styles.userPhone, { color: colors.textSecondary }]}>
              {user.phone}
            </Text>
          </View>
        </View>
        <View style={styles.userStatus}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: user.status === 'active' ? colors.success : colors.error }
          ]}>
            <Text style={[styles.statusText, { color: colors.background }]}>
              {user.status.toUpperCase()}
            </Text>
          </View>
          {user.role === 'admin' && (
            <View style={[styles.roleBadge, { backgroundColor: colors.warning }]}>
              <Text style={[styles.roleText, { color: colors.background }]}>
                ADMIN
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.userMeta}>
        <View style={styles.verificationStatus}>
          <Ionicons
            name={user.isEmailVerified ? 'mail' : 'mail-outline'}
            size={16}
            color={user.isEmailVerified ? colors.success : colors.textSecondary}
          />
          <Ionicons
            name={user.isPhoneVerified ? 'call' : 'call-outline'}
            size={16}
            color={user.isPhoneVerified ? colors.success : colors.textSecondary}
            style={{ marginLeft: 8 }}
          />
        </View>
        <Text style={[styles.lastLogin, { color: colors.textSecondary }]}>
          Last login: {user.lastLogin}
        </Text>
      </View>

      <View style={styles.userActions}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: colors.info + '20' },
            processingUserId === user.id && { opacity: 0.5 }
          ]}
          onPress={() => handleUserAction(user, 'edit')}
          activeOpacity={0.6}
          disabled={processingUserId === user.id}
        >
          <Ionicons name="create" size={16} color={colors.info} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: colors.primary + '20' },
            processingUserId === user.id && { opacity: 0.5 }
          ]}
          onPress={() => handleUserAction(user, user.role === 'admin' ? 'make_user' : 'make_admin')}
          activeOpacity={0.6}
          disabled={processingUserId === user.id}
        >
          <Ionicons
            name={user.role === 'admin' ? 'person' : 'shield'}
            size={16}
            color={colors.primary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: colors.warning + '20' },
            processingUserId === user.id && { opacity: 0.5 }
          ]}
          onPress={() => handleUserAction(user, user.status === 'active' ? 'suspend' : 'activate')}
          activeOpacity={0.6}
          disabled={processingUserId === user.id}
        >
          <Ionicons
            name={user.status === 'active' ? 'pause' : 'play'}
            size={16}
            color={colors.warning}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: colors.error + '20' },
            processingUserId === user.id && { opacity: 0.5 }
          ]}
          onPress={() => handleUserAction(user, 'delete')}
          activeOpacity={0.6}
          disabled={processingUserId === user.id}
        >
          <Ionicons name="trash" size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const filterOptions = [
    { key: 'all', label: 'All Users' },
    { key: 'active', label: 'Active' },
    { key: 'suspended', label: 'Suspended' },
    { key: 'pending', label: 'Pending' },
  ];

  // Render skeleton loading cards instead of full screen loading
  const renderSkeletonCard = (index) => (
    <View
      key={`skeleton-${index}`}
      style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.userHeader}>
        <View style={styles.userInfo}>
          <View style={[styles.avatar, { backgroundColor: colors.border }]} />
          <View style={styles.userDetails}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '60%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '80%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '40%' }]} />
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Ultra Compact Controls */}
        <View style={styles.ultraCompactSection}>
          <View style={[styles.ultraSearchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={14} color={colors.textSecondary} />
            <TextInput
              style={[styles.ultraSearchInput, { color: colors.text }]}
              placeholder="Search..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Text style={[styles.ultraCount, { color: colors.textSecondary }]}>
              {isActuallyLoading ? '...' : filteredUsers.length}
            </Text>
          </View>

          {/* FAST: User Statistics Display */}
          <View style={[styles.statsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.primary }]}>{userStats.total}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.success }]}>{userStats.active}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.warning }]}>{userStats.inactive}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Inactive</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.info }]}>{userStats.admins}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Admins</Text>
              </View>
              {userStats.duplicatesRemoved > 0 && (
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: colors.error }]}>{userStats.duplicatesRemoved}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Dupes</Text>
                </View>
              )}
            </View>
            <Text style={[styles.sourceInfo, { color: colors.textSecondary }]}>
              Source: {usersSource || 'loading'} • {isActuallyLoading ? 'Loading...' : `Ready (${userStats.total} users)`}
            </Text>
          </View>

          <View style={styles.ultraFilterRow}>
            {filterOptions.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.ultraFilterButton,
                  {
                    backgroundColor: selectedFilter === option.key ? colors.primary : colors.surface,
                    borderColor: colors.border,
                  }
                ]}
                onPress={() => setSelectedFilter(option.key)}
              >
                <Text style={[
                  styles.ultraFilterText,
                  { color: selectedFilter === option.key ? colors.background : colors.text }
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Users List - Using FlatList for better performance */}
        <FlatList
          style={styles.usersList}
          data={isActuallyLoading ? Array.from({ length: 5 }, (_, index) => ({ id: `skeleton-${index}`, isSkeleton: true })) : filteredUsers}
          keyExtractor={(item, index) => item.isSkeleton ? item.id : `user-${item.id}-${index}`}
          renderItem={({ item }) => item.isSkeleton ? renderSkeletonCard(item.id) : renderUserCard(item)}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isActuallyLoading}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            !isActuallyLoading ? (
              <View style={[styles.emptyState, styles.centered]}>
                {usersError ? (
                  <>
                    <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
                    <Text style={[styles.emptyTitle, { color: colors.error }]}>
                      Error Loading Users
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                      {usersError.message || 'Failed to load users from server'}
                    </Text>
                    <TouchableOpacity
                      style={[styles.clearFiltersButton, { backgroundColor: colors.primary }]}
                      onPress={handleRefresh}
                    >
                      <Text style={[styles.clearFiltersText, { color: colors.background }]}>
                        Retry
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                      {searchQuery ? 'No Users Match Search' : 'No Users Found'}
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                      {searchQuery ? `No users found for "${searchQuery}"` : 'No users available in the system'}
                    </Text>
                  </>
                )}
                <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
                  {searchQuery || selectedFilter !== 'all'
                    ? 'No users match your current filters. Try adjusting your search or filter criteria.'
                    : 'There are no users in the system yet.'
                  }
                </Text>
                {(searchQuery || selectedFilter !== 'all') && (
                  <TouchableOpacity
                    style={[styles.clearFiltersButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      setSearchQuery('');
                      setSelectedFilter('all');
                    }}
                  >
                    <Text style={[styles.clearFiltersText, { color: colors.background }]}>
                      Clear Filters
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null
          }
          // Performance optimizations like chama listing
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={10}
          windowSize={10}
          getItemLayout={(data, index) => ({
            length: 120, // Approximate height of user card
            offset: 120 * index,
            index,
          })}
          // FAST: No pagination needed - all users loaded at once
          ListFooterComponent={
            isActuallyLoading ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
                  Loading users...
                </Text>
              </View>
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {filteredUsers.length > 0 ? `Showing ${filteredUsers.length} of ${userStats.total} users` : 'No users to display'}
                </Text>
              </View>
            )
          }
        />

        {/* Action Loading Overlay */}
        {actionLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.white }]}>
              Processing...
            </Text>
          </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  ultraCompactSection: {
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  ultraSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginBottom: 4,
    height: 32,
  },
  ultraSearchInput: {
    flex: 1,
    marginLeft: 4,
    fontSize: 12,
    paddingVertical: 0,
  },
  ultraCount: {
    fontSize: 10,
    fontWeight: '600',
    minWidth: 16,
    textAlign: 'right',
  },
  ultraFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  ultraFilterButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 4,
    marginBottom: 2,
    minHeight: 20,
    justifyContent: 'center',
  },
  ultraFilterText: {
    fontSize: 10,
    fontWeight: '500',
  },
  usersList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  userCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  userPhone: {
    fontSize: 14,
    marginTop: 2,
  },
  userStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  userMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  verificationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastLogin: {
    fontSize: 12,
  },
  userActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    // Add subtle shadow for better visual feedback
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  clearFiltersButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
  },
  clearFiltersText: {
    fontSize: 16,
    fontWeight: '600',
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  // FAST: Statistics display styles
  statsContainer: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  sourceInfo: {
    fontSize: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 4,
  },
});
