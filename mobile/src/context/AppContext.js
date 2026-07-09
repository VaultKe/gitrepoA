import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import webSocketService from '../services/websocket';
import lightningDataService from '../services/cacheDataService';
import { setAppLogout } from '../utils/authLogout';

// Initial state
const initialState = {
  // Auth state
  isAuthenticated: false,
  user: null,
  userRole: 'user',
  authToken: null,

  // App state
  isLoading: true,
  isOnline: false,
  isSyncing: false,

  // Data state
  wallets: [],
  chamas: [],
  transactions: [],
  notifications: [],
  chatRooms: [],
  loans: [],

  // UI state
  theme: 'dark',
  language: 'en',
  currentDashboard: 'user', // 'user', 'chama', 'admin'
  selectedChama: null,
  pendingUserRoute: null,

  // Error state
  error: null,
  networkError: false,
};

// Action types
const ActionTypes = {
  // Auth actions
  SET_LOADING: 'SET_LOADING',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGOUT: 'LOGOUT',
  UPDATE_USER: 'UPDATE_USER',

  // Network actions
  SET_ONLINE_STATUS: 'SET_ONLINE_STATUS',
  SET_SYNC_STATUS: 'SET_SYNC_STATUS',

  // Data actions
  SET_WALLETS: 'SET_WALLETS',
  SET_CHAMAS: 'SET_CHAMAS',
  SET_TRANSACTIONS: 'SET_TRANSACTIONS',
  SET_NOTIFICATIONS: 'SET_NOTIFICATIONS',
  SET_CHAT_ROOMS: 'SET_CHAT_ROOMS',
  SET_LOANS: 'SET_LOANS',

  // UI actions
  SET_THEME: 'SET_THEME',
  SET_LANGUAGE: 'SET_LANGUAGE',
  SET_CURRENT_DASHBOARD: 'SET_CURRENT_DASHBOARD',
  SET_SELECTED_CHAMA: 'SET_SELECTED_CHAMA',
  SET_PENDING_USER_ROUTE: 'SET_PENDING_USER_ROUTE',
  CLEAR_PENDING_USER_ROUTE: 'CLEAR_PENDING_USER_ROUTE',

  // Error actions
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_NETWORK_ERROR: 'SET_NETWORK_ERROR',

  // Bulk actions
  RESET_STATE: 'RESET_STATE',
  HYDRATE_STATE: 'HYDRATE_STATE',
};

// Reducer
function appReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_LOADING:
      return { ...state, isLoading: action.payload };

    case ActionTypes.LOGIN_SUCCESS:
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        userRole: action.payload.user?.role || 'user',
        authToken: action.payload.token,
        isLoading: false,
        error: null,
      };

    case ActionTypes.LOGOUT:
      return {
        ...initialState,
        isLoading: false,
        theme: state.theme,
        language: state.language,
      };

    case ActionTypes.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };

    case ActionTypes.SET_ONLINE_STATUS:
      return {
        ...state,
        isOnline: action.payload,
        networkError: !action.payload,
      };

    case ActionTypes.SET_SYNC_STATUS:
      return { ...state, isSyncing: action.payload };

    case ActionTypes.SET_WALLETS:
      return { ...state, wallets: action.payload };

    case ActionTypes.SET_CHAMAS:
      return { ...state, chamas: action.payload };

    case ActionTypes.SET_TRANSACTIONS:
      return { ...state, transactions: action.payload };

    case ActionTypes.SET_NOTIFICATIONS:
      return { ...state, notifications: action.payload };

    case ActionTypes.SET_CHAT_ROOMS:
      return { ...state, chatRooms: action.payload };

    case ActionTypes.SET_LOANS:
      return { ...state, loans: action.payload };

    case ActionTypes.SET_THEME:
      return { ...state, theme: action.payload };

    case ActionTypes.SET_LANGUAGE:
      return { ...state, language: action.payload };

    case ActionTypes.SET_CURRENT_DASHBOARD:
      return { ...state, currentDashboard: action.payload };

    case ActionTypes.SET_SELECTED_CHAMA:
      return { ...state, selectedChama: action.payload };

    case ActionTypes.SET_PENDING_USER_ROUTE:
      return { ...state, pendingUserRoute: action.payload };

    case ActionTypes.CLEAR_PENDING_USER_ROUTE:
      return { ...state, pendingUserRoute: null };

    case ActionTypes.SET_ERROR:
      return { ...state, error: action.payload };

    case ActionTypes.CLEAR_ERROR:
      return { ...state, error: null };

    case ActionTypes.SET_NETWORK_ERROR:
      return { ...state, networkError: action.payload };

    case ActionTypes.RESET_STATE:
      return { ...initialState, isLoading: false };

    case ActionTypes.HYDRATE_STATE:
      return { ...state, ...action.payload, isLoading: false };

    default:
      return state;
  }
}

// Create context
const AppContext = createContext();

  // Provider component
  export function AppProvider({ children }) {
    const [state, dispatch] = useReducer(appReducer, initialState);

    // Initialize app
    useEffect(() => {
      initializeApp();
    }, []);


  const initializeApp = async () => {
    try {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });

      // Set a much shorter timeout to prevent long loading screens
      const timeoutId = setTimeout(() => {
        console.warn('App initialization timeout, proceeding without database');
        dispatch({ type: ActionTypes.SET_LOADING, payload: false });
      }, 1500); // Reduced from 10s to 1.5s


      // Check for existing auth token (parallel for speed)
      const [authToken, userData, theme, language] = await Promise.all([
        AsyncStorage.getItem('authToken'),
        AsyncStorage.getItem('userData'),
        AsyncStorage.getItem('theme'),
        AsyncStorage.getItem('language'),
      ]);

      // Set theme and language
      if (theme) {
        dispatch({ type: ActionTypes.SET_THEME, payload: theme });
      }
      if (language) {
        dispatch({ type: ActionTypes.SET_LANGUAGE, payload: language });
      }

      // If we have auth data, try to restore session
      if (authToken && userData) {
        try {
          const user = JSON.parse(userData);

          // Ultra-minimal user data to prevent storage quota errors
          const compressedUser = {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            avatar: user.avatar,
            status: user.status,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
          };
  
          dispatch({
            type: ActionTypes.LOGIN_SUCCESS,
            payload: { user: compressedUser, token: authToken },
          });
  
          // Re-store compressed data to prevent future quota errors
          const compressedSize = JSON.stringify(compressedUser).length;
          if (compressedSize > 1024) {
            console.warn('⚠️ Session restore data too large (', compressedSize, 'bytes), using ultra-minimal fallback');
            // Ultra-minimal data - only absolutely essential fields
            const ultraMinimalUserData = {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              role: user.role,
              // Remove avatar and all other fields to prevent storage quota issues
            };

            // Final check - if even this is too large, use absolute minimum
            const ultraMinimalSize = JSON.stringify(ultraMinimalUserData).length;
            if (ultraMinimalSize > 512) {
              console.warn('⚠️ Even ultra-minimal data too large (session restore) (', ultraMinimalSize, 'bytes), using absolute minimum');
              const absoluteMinimalData = {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
              };
              await AsyncStorage.setItem('userData', JSON.stringify(absoluteMinimalData));
            } else {
              await AsyncStorage.setItem('userData', JSON.stringify(ultraMinimalUserData));
            }
          } else {
            await AsyncStorage.setItem('userData', JSON.stringify(compressedUser));
          }

          // Load data in background to speed up app initialization
          setTimeout(async () => {
            try {
              await loadLocalData();
            } catch (loadError) {
              console.warn('Failed to load local data during app init:', loadError);
            }
          }, 100);
        } catch (error) {
          console.error('Failed to restore session:', error);
          // Don't call logout here as it might cause issues, just clear auth
          await AsyncStorage.removeItem('authToken');
          await AsyncStorage.removeItem('userData');
        }
      } else {
      }

      clearTimeout(timeoutId);

      // Stop loading immediately after essential operations
      dispatch({ type: ActionTypes.SET_LOADING, payload: false });
    } catch (error) {
      console.error('App initialization failed:', error);
      dispatch({ type: ActionTypes.SET_ERROR, payload: 'Failed to initialize app' });
    } finally {
      // Ensure loading is always stopped
      dispatch({ type: ActionTypes.SET_LOADING, payload: false });
    }
  };

  const loadLocalData = async () => {
    // With no SQLite, we rely entirely on backend server
    // Data will be fetched fresh from API when needed
    dispatch({ type: ActionTypes.SET_WALLETS, payload: [] });
    dispatch({ type: ActionTypes.SET_CHAMAS, payload: [] });
    dispatch({ type: ActionTypes.SET_TRANSACTIONS, payload: [] });
    dispatch({ type: ActionTypes.SET_NOTIFICATIONS, payload: [] });
    dispatch({ type: ActionTypes.SET_CHAT_ROOMS, payload: [] });
    dispatch({ type: ActionTypes.SET_LOANS, payload: [] });
  };

  // Update context with preloaded data
  const updateContextWithPreloadedData = (preloadedData) => {
    // Update wallets
    if (preloadedData.wallet?.success && preloadedData.wallet.data) {
      dispatch({ type: ActionTypes.SET_WALLETS, payload: [preloadedData.wallet.data] });
    }

    // Update chamas
    if (preloadedData.chamas?.success && preloadedData.chamas.data) {
      dispatch({ type: ActionTypes.SET_CHAMAS, payload: preloadedData.chamas.data });
    }

    // Update transactions
    if (preloadedData.transactions?.success && preloadedData.transactions.data) {
      dispatch({ type: ActionTypes.SET_TRANSACTIONS, payload: preloadedData.transactions.data });
    }

    // Update notifications
    if (preloadedData.notifications?.success && preloadedData.notifications.data) {
      dispatch({ type: ActionTypes.SET_NOTIFICATIONS, payload: preloadedData.notifications.data });
    }

    // Update chat rooms
    if (preloadedData.chatRooms?.success && preloadedData.chatRooms.data) {
      dispatch({ type: ActionTypes.SET_CHAT_ROOMS, payload: preloadedData.chatRooms.data });
    }
  };
  // Initialize lightning data service for user
  const initializeLightningDataForUser = async (userId) => {
    // Initialize real-time handlers for lightning service (single source, wired through cacheManagerService -> websocket)
    lightningDataService.registerRealtimeHandler('notifications', (update) => {
      handleLightningDataUpdate('notifications', update);
    });

    lightningDataService.registerRealtimeHandler('wallet', (update) => {
      handleLightningDataUpdate('wallet', update);
    });

    lightningDataService.registerRealtimeHandler('transactions', (update) => {
      handleLightningDataUpdate('transactions', update);
    });

    lightningDataService.registerRealtimeHandler('chamas', (update) => {
      handleLightningDataUpdate('chamas', update);
    });
  };

  // Update context with lightning data
  const updateContextWithLightningData = (lightningData) => {
    // Update all data types from lightning service
    Object.entries(lightningData).forEach(([dataType, result]) => {
      if (result.success && result.data) {
        switch (dataType) {
          case 'wallet':
            dispatch({ type: ActionTypes.SET_WALLETS, payload: [result.data] });
            break;
          case 'chamas':
            dispatch({ type: ActionTypes.SET_CHAMAS, payload: result.data });
            break;
          case 'transactions':
            dispatch({ type: ActionTypes.SET_TRANSACTIONS, payload: result.data });
            break;
          case 'notifications':
            dispatch({ type: ActionTypes.SET_NOTIFICATIONS, payload: result.data });
            break;
          case 'chat-rooms':
            dispatch({ type: ActionTypes.SET_CHAT_ROOMS, payload: result.data });
            break;
        }
      }
    });
  };

  // Handle lightning data updates
  const handleLightningDataUpdate = (dataType, update) => {
    const { action, data } = update;

    switch (dataType) {
      case 'notifications':
        if (action === 'new') {
          dispatch({ type: ActionTypes.SET_NOTIFICATIONS, payload: [data, ...state.notifications] });
        } else if (action === 'update') {
          const updatedNotifications = state.notifications.map(n =>
            n.id === data.id ? { ...n, ...data } : n
          );
          dispatch({ type: ActionTypes.SET_NOTIFICATIONS, payload: updatedNotifications });
        } else if (action === 'remove') {
          const filteredNotifications = state.notifications.filter(n => n.id !== data.id);
          dispatch({ type: ActionTypes.SET_NOTIFICATIONS, payload: filteredNotifications });
        }
        break;

      case 'wallet':
        dispatch({ type: ActionTypes.SET_WALLETS, payload: [data] });
        break;

      case 'transactions':
        if (action === 'new') {
          dispatch({ type: ActionTypes.SET_TRANSACTIONS, payload: [data, ...state.transactions] });
        }
        break;

      case 'chamas':
        const updatedChamas = state.chamas.map(c =>
          c.id === data.id ? { ...c, ...data } : c
        );
        dispatch({ type: ActionTypes.SET_CHAMAS, payload: updatedChamas });
        break;
    }
  };

  // Auth actions
  const login = async (credentials) => {
    try {
      // Clear any cached data that might cause quota issues
      await clearStorageCache();

      dispatch({ type: ActionTypes.SET_LOADING, payload: true });
      dispatch({ type: ActionTypes.CLEAR_ERROR });

      const response = await ApiService.login(credentials);

      if (response.success) {
        // Compress user data before storing to prevent storage quota errors
        const rawUserData = response.data.user;

        // Ultra-minimal user data - only essential fields
        const compressedUserData = {
          id: rawUserData.id,
          firstName: rawUserData.firstName,
          lastName: rawUserData.lastName,
          email: rawUserData.email,
          phone: rawUserData.phone,
          role: rawUserData.role,
          avatar: rawUserData.avatar,
          status: rawUserData.status,
          isEmailVerified: rawUserData.isEmailVerified,
          isPhoneVerified: rawUserData.isPhoneVerified,
          // Remove all other fields to prevent storage quota issues
        };

        // Ensure data is under 1KB limit (ultra conservative)
        const compressedSize = JSON.stringify(compressedUserData).length;
        if (compressedSize > 1024) {
          console.warn('⚠️ User data still too large (', compressedSize, 'bytes), using ultra-minimal fallback');
          // Ultra-minimal data - only absolutely essential fields
          const ultraMinimalUserData = {
            id: rawUserData.id,
            firstName: rawUserData.firstName,
            lastName: rawUserData.lastName,
            email: rawUserData.email,
            role: rawUserData.role,
            // Remove avatar and all other fields to prevent storage quota issues
          };

          // Final check - if even this is too large, use absolute minimum
          const ultraMinimalSize = JSON.stringify(ultraMinimalUserData).length;
          if (ultraMinimalSize > 512) {
            console.warn('⚠️ Even ultra-minimal data too large (', ultraMinimalSize, 'bytes), using absolute minimum');
            const absoluteMinimalData = {
              id: rawUserData.id,
              firstName: rawUserData.firstName,
              lastName: rawUserData.lastName,
              email: rawUserData.email,
              role: rawUserData.role,
            };
            await AsyncStorage.setItem('userData', JSON.stringify(absoluteMinimalData));
            await AsyncStorage.setItem('userRole', absoluteMinimalData.role || 'user');
          } else {
            await AsyncStorage.setItem('userData', JSON.stringify(ultraMinimalUserData));
            await AsyncStorage.setItem('userRole', ultraMinimalUserData.role || 'user');
          }
        } else {
          await AsyncStorage.setItem('userData', JSON.stringify(compressedUserData));
          await AsyncStorage.setItem('userRole', compressedUserData.role || 'user');
        }

        // Store compressed user data
        const loginPayload = {
          ...response.data,
          user: compressedUserData,
        };

        // Immediately dispatch login success to show dashboard
        dispatch({
          type: ActionTypes.LOGIN_SUCCESS,
          payload: loginPayload,
        });

        // Store compressed data in AsyncStorage
        try {
          await AsyncStorage.setItem('userData', JSON.stringify(compressedUserData));
          await AsyncStorage.setItem('userRole', compressedUserData.role || 'user');
        } catch (storageError) {
          console.warn('⚠️ Failed to store compressed userData:', storageError.message);

          // Fallback to ultra-minimal user data
          const ultraMinimalUserData = {
            id: rawUserData.id,
            firstName: rawUserData.firstName,
            lastName: rawUserData.lastName,
            email: rawUserData.email,
            role: rawUserData.role,
            // Remove avatar and all other fields to prevent storage quota issues
          };

          // Final check - if even this is too large, use absolute minimum
          const ultraMinimalSize = JSON.stringify(ultraMinimalUserData).length;
          if (ultraMinimalSize > 512) {
            console.warn('⚠️ Even ultra-minimal data too large (login fallback) (', ultraMinimalSize, 'bytes), using absolute minimum');
            const absoluteMinimalData = {
              id: rawUserData.id,
              firstName: rawUserData.firstName,
              lastName: rawUserData.lastName,
              email: rawUserData.email,
              role: rawUserData.role,
            };
            await AsyncStorage.setItem('userData', JSON.stringify(absoluteMinimalData));
            await AsyncStorage.setItem('userRole', absoluteMinimalData.role || 'user');
          } else {
            await AsyncStorage.setItem('userData', JSON.stringify(ultraMinimalUserData));
            await AsyncStorage.setItem('userRole', ultraMinimalUserData.role || 'user');
          }
        }

        // Stop loading immediately to show dashboard
        dispatch({ type: ActionTypes.SET_LOADING, payload: false });

        // Load data in background (non-blocking) with lightning-fast preloading
        setTimeout(async () => {
          try {
            // Initialize lightning data service for the user
            await initializeLightningDataForUser(response.data.user.id);

            // Start comprehensive data preload using lightning service
            const preloadResult = await lightningDataService.preloadAllData(response.data.user.id, false);

            if (preloadResult.success) {
              // Update context with preloaded data
              if (preloadResult.data) {
                updateContextWithLightningData(preloadResult.data);
              }
            } else {
              console.warn('⚠️ Lightning preload failed, using fallback:', preloadResult.error);

              // Fallback to individual loading
              await loadLocalData();
              await loadUserChamas();
            }

            // Start WebSocket connection with real-time updates (wired via cacheManagerService -> websocket)
            webSocketService.connect().then(() => {
            }).catch((wsError) => {
              console.warn('WebSocket connection failed, using polling fallback:', wsError);
            });
          } catch (error) {
            console.warn('Background data loading failed:', error);
          }
        }, 100); // Small delay to ensure UI renders first

        return { success: true };
      } else {
        throw new Error(response.error || 'Login failed');
      }
    } catch (error) {
      dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
      return { success: false, error: error.message };
    } finally {
      // Ensure loading is stopped even if there's an error
      dispatch({ type: ActionTypes.SET_LOADING, payload: false });
    }
  };

  const register = async (userData) => {
    try {
      // Clear any cached data that might cause quota issues
      await clearStorageCache();

      dispatch({ type: ActionTypes.SET_LOADING, payload: true });
      dispatch({ type: ActionTypes.CLEAR_ERROR });

      const response = await ApiService.register(userData);

      if (response.success) {
        // Compress user data before storing to prevent storage quota errors
        const rawUserData = response.data.user;

        // Ultra-minimal user data - only essential fields
        const compressedUserData = {
          id: rawUserData.id,
          firstName: rawUserData.firstName,
          lastName: rawUserData.lastName,
          email: rawUserData.email,
          phone: rawUserData.phone,
          role: rawUserData.role,
          avatar: rawUserData.avatar,
          status: rawUserData.status,
          isEmailVerified: rawUserData.isEmailVerified,
          isPhoneVerified: rawUserData.isPhoneVerified,
          // Remove all other fields to prevent storage quota issues
        };

        // Ensure data is under 1KB limit (ultra conservative)
        const compressedSize = JSON.stringify(compressedUserData).length;
        if (compressedSize > 1024) {
          console.warn('⚠️ User data still too large (registration) (', compressedSize, 'bytes), using ultra-minimal fallback');
          // Ultra-minimal data - only absolutely essential fields
          const ultraMinimalUserData = {
            id: rawUserData.id,
            firstName: rawUserData.firstName,
            lastName: rawUserData.lastName,
            email: rawUserData.email,
            role: rawUserData.role,
            // Remove avatar and all other fields to prevent storage quota issues
          };

          // Final check - if even this is too large, use absolute minimum
          const ultraMinimalSize = JSON.stringify(ultraMinimalUserData).length;
          if (ultraMinimalSize > 512) {
            console.warn('⚠️ Even ultra-minimal data too large (registration) (', ultraMinimalSize, 'bytes), using absolute minimum');
            const absoluteMinimalData = {
              id: rawUserData.id,
              firstName: rawUserData.firstName,
              lastName: rawUserData.lastName,
              email: rawUserData.email,
              role: rawUserData.role,
            };
            await AsyncStorage.setItem('userData', JSON.stringify(absoluteMinimalData));
            await AsyncStorage.setItem('userRole', absoluteMinimalData.role || 'user');
          } else {
            await AsyncStorage.setItem('userData', JSON.stringify(ultraMinimalUserData));
            await AsyncStorage.setItem('userRole', ultraMinimalUserData.role || 'user');
          }
        } else {
          await AsyncStorage.setItem('userData', JSON.stringify(compressedUserData));
          await AsyncStorage.setItem('userRole', compressedUserData.role || 'user');
        }

        // Store compressed user data
        const registerPayload = {
          ...response.data,
          user: compressedUserData,
        };

        // Immediately dispatch login success to show dashboard
        dispatch({
          type: ActionTypes.LOGIN_SUCCESS,
          payload: registerPayload,
        });

        // Store compressed data in AsyncStorage
        try {
          await AsyncStorage.setItem('userData', JSON.stringify(compressedUserData));
          await AsyncStorage.setItem('userRole', compressedUserData.role || 'user');
        } catch (storageError) {
          console.warn('⚠️ Failed to store compressed userData during registration:', storageError.message);

          // Fallback to ultra-minimal user data
          const ultraMinimalUserData = {
            id: rawUserData.id,
            firstName: rawUserData.firstName,
            lastName: rawUserData.lastName,
            email: rawUserData.email,
            role: rawUserData.role,
            // Remove avatar and all other fields to prevent storage quota issues
          };

          // Final check - if even this is too large, use absolute minimum
          const ultraMinimalSize = JSON.stringify(ultraMinimalUserData).length;
          if (ultraMinimalSize > 512) {
            console.warn('⚠️ Even ultra-minimal data too large (register fallback) (', ultraMinimalSize, 'bytes), using absolute minimum');
            const absoluteMinimalData = {
              id: rawUserData.id,
              firstName: rawUserData.firstName,
              lastName: rawUserData.lastName,
              email: rawUserData.email,
              role: rawUserData.role,
            };
            await AsyncStorage.setItem('userData', JSON.stringify(absoluteMinimalData));
            await AsyncStorage.setItem('userRole', absoluteMinimalData.role || 'user');
          } else {
            await AsyncStorage.setItem('userData', JSON.stringify(ultraMinimalUserData));
            await AsyncStorage.setItem('userRole', ultraMinimalUserData.role || 'user');
          }
        }

        // Stop loading immediately to show dashboard
        dispatch({ type: ActionTypes.SET_LOADING, payload: false });

        // Load data in background (non-blocking)
        setTimeout(async () => {
          try {
            // Load local data first (faster)
            await loadLocalData();

            // Then load remote data
            await loadUserChamas();

            // Initialize WebSocket connection (non-critical)
            webSocketService.connect().then(() => {
            }).catch((wsError) => {
              console.warn('WebSocket connection failed after registration:', wsError);
            });
          } catch (error) {
            console.warn('Background data loading after registration failed:', error);
          }
        }, 100); // Small delay to ensure UI renders first

        return { success: true };
      } else {
        throw new Error(response.error || 'Registration failed');
      }
    } catch (error) {
      dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
      return { success: false, error: error.message };
    } finally {
      dispatch({ type: ActionTypes.SET_LOADING, payload: false });
    }
  };

  // Get cached avatar data for display
  const getCachedAvatarData = async () => {
    try {
      const cachedData = await AsyncStorage.getItem('cached_avatar_data');
      return cachedData;
    } catch (error) {
      console.warn('Failed to get cached avatar data:', error);
      return null;
    }
  };

  const updateUser = async (userData) => {
    try {
      const filteredUserData = { ...userData };

      // Preserve avatar URLs but remove large base64 data
      let preservedAvatarUrl = null;

      if (filteredUserData.avatar && typeof filteredUserData.avatar === 'string') {
        if (filteredUserData.avatar.startsWith('http') || filteredUserData.avatar.startsWith('/uploads/') || filteredUserData.avatar.startsWith('/api/')) {
          preservedAvatarUrl = filteredUserData.avatar;
        } else if (filteredUserData.avatar.startsWith('data:') && filteredUserData.avatar.length > 50000) {
          preservedAvatarUrl = 'avatar://cached-base64-image';
          try {
            await AsyncStorage.setItem('cached_avatar_data', filteredUserData.avatar);
          } catch (error) {
            console.warn('Failed to cache avatar data:', error);
            preservedAvatarUrl = null;
          }
          delete filteredUserData.avatar;
        } else {
          preservedAvatarUrl = filteredUserData.avatar;
        }
      }

      if (filteredUserData.profile_image && typeof filteredUserData.profile_image === 'string' && filteredUserData.profile_image.length > 50000) {
        delete filteredUserData.profile_image;
      }

      if (preservedAvatarUrl) {
        filteredUserData.avatar = preservedAvatarUrl;
      }
      dispatch({ type: ActionTypes.UPDATE_USER, payload: filteredUserData });

      const updatedUser = { ...state.user, ...filteredUserData };

      const userDataForStorage = { ...updatedUser };
      if (userDataForStorage.profile_image && typeof userDataForStorage.profile_image === 'string' && userDataForStorage.profile_image.length > 50000) {
        delete userDataForStorage.profile_image;
      }
      if (userDataForStorage.avatar && typeof userDataForStorage.avatar === 'string' && userDataForStorage.avatar.length > 50000) {
        userDataForStorage.avatar = state.user?.avatar || null;
      }

      const compressedUserData = {
        id: userDataForStorage.id,
        firstName: userDataForStorage.firstName,
        lastName: userDataForStorage.lastName,
        email: userDataForStorage.email,
        phone: userDataForStorage.phone,
        role: userDataForStorage.role,
        avatar: userDataForStorage.avatar,
        status: userDataForStorage.status,
        isEmailVerified: userDataForStorage.isEmailVerified,
        isPhoneVerified: userDataForStorage.isPhoneVerified,
      };

      const compressedSize = JSON.stringify(compressedUserData).length;
      if (compressedSize > 1024) {
        const ultraMinimalUserData = {
          id: userDataForStorage.id,
          firstName: userDataForStorage.firstName,
          lastName: userDataForStorage.lastName,
          email: userDataForStorage.email,
          role: userDataForStorage.role,
        };

        const ultraMinimalSize = JSON.stringify(ultraMinimalUserData).length;
        if (ultraMinimalSize > 512) {
          const absoluteMinimalData = {
            id: userDataForStorage.id,
            firstName: userDataForStorage.firstName,
            lastName: userDataForStorage.lastName,
            email: userDataForStorage.email,
            role: userDataForStorage.role,
          };
          await AsyncStorage.setItem('userData', JSON.stringify(absoluteMinimalData));
        } else {
          await AsyncStorage.setItem('userData', JSON.stringify(ultraMinimalUserData));
        }
      } else {
        await AsyncStorage.setItem('userData', JSON.stringify(compressedUserData));
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to update user:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      try {
        webSocketService.disconnect();
      } catch (wsError) {
        console.warn('WebSocket disconnect failed during logout:', wsError);
      }

      try {
        await ApiService.logout();
      } catch (apiError) {
        console.warn('API logout failed, continuing with local logout:', apiError);
      }

      await AsyncStorage.multiRemove([
        'authToken',
        'userData',
        'userRole'
      ]);

      dispatch({ type: ActionTypes.LOGOUT });
    } catch (error) {
      console.error('Logout error:', error);

      try {
        await AsyncStorage.multiRemove([
          'authToken',
          'userData',
          'userRole'
        ]);
      } catch (storageError) {
        console.error('Failed to clear AsyncStorage during logout:', storageError);
      }

      dispatch({ type: ActionTypes.LOGOUT });
    }
  };

  setAppLogout(logout);

  // Load user chamas from API
  const loadUserChamas = async () => {
    try {
      if (!state.user?.id) {
        return;
      }

      const response = await ApiService.getUserChamas(50, 0);

       if (response.success) {
         dispatch({ type: ActionTypes.SET_CHAMAS, payload: response.data || [] });

         // Database service removed per requirement - app works without SQLite DB in frontend
         // Local database updates disabled
       }
    } catch (error) {
      console.error('Failed to load user chamas:', error);
    }
  };

  // Lightning-fast data refresh
  const refreshData = async (forceRefresh = false) => {
    try {
      if (state.user?.id) {
        // Use lightning data service for instant refresh (fetches real data via ApiService)
        const lightningResult = await lightningDataService.preloadAllData(state.user.id, forceRefresh);

        if (lightningResult.success && lightningResult.data) {
          updateContextWithLightningData(lightningResult.data);
        } else {
          console.warn('⚠️ Lightning refresh failed, using fallback');
          await loadLocalData();
          await loadUserChamas();
        }
      } else {
        // No user, just load local data
        await loadLocalData();
      }
    } catch (error) {
      console.error('❌ Lightning refresh failed:', error);
    }
  };

  // Get cached data instantly without waiting (Lightning version)
  const getCachedData = async (dataType) => {
    // Try lightning service first for instant access
    const lightningResult = await lightningDataService.getData(dataType, { skipAPI: true });
    if (lightningResult.success) {
      return lightningResult;
    }
    return null;
  };

  // Get lightning data with performance metrics
  const getLightningData = async (dataType, options = {}) => {
    return await lightningDataService.getData(dataType, options);
  };

  // Prefetch data for page navigation
  const prefetchForPage = async (pageName, priority = 'normal') => {
    // Also use lightning service for immediate data
    const dependencies = lightningDataService.dataDependencies[pageName] || [];
    const prefetchPromises = dependencies.map(dataType =>
      lightningDataService.getData(dataType)
    );

    if (priority === 'high') {
      await Promise.all(prefetchPromises);
    } else {
      Promise.all(prefetchPromises).catch(() => {});
    }
  };

  // Force refresh specific data type
  const refreshSpecificData = async (dataType) => {
    try {
      let response;
      switch (dataType) {
        case 'notifications':
          response = await ApiService.getNotifications(100, 0);
          if (response.success) {
            dispatch({ type: ActionTypes.SET_NOTIFICATIONS, payload: response.data });
          }
          break;
        case 'wallet':
          response = await ApiService.getWalletBalance();
          if (response.success) {
            dispatch({ type: ActionTypes.SET_WALLETS, payload: [response.data] });
          }
          break;
        case 'chamas':
          response = await ApiService.getUserChamas(50, 0);
          if (response.success) {
            dispatch({ type: ActionTypes.SET_CHAMAS, payload: response.data });
          }
          break;
        case 'transactions':
          response = await ApiService.getTransactions(100, 0);
          if (response.success) {
            dispatch({ type: ActionTypes.SET_TRANSACTIONS, payload: response.data });
          }
          break;
        default:
          console.warn(`Unknown data type for refresh: ${dataType}`);
      }
    } catch (error) {
      console.error(`Failed to refresh ${dataType} data:`, error);
    }
  };

  // Theme and language actions
  const setTheme = async (theme) => {
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    dispatch({ type: ActionTypes.SET_THEME, payload: nextTheme });
    await AsyncStorage.setItem('theme', nextTheme);
  };

  const toggleTheme = async () => {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    dispatch({ type: ActionTypes.SET_THEME, payload: nextTheme });
    await AsyncStorage.setItem('theme', nextTheme);
  };

  const setLanguage = async (language) => {
    dispatch({ type: ActionTypes.SET_LANGUAGE, payload: language });
    await AsyncStorage.setItem('language', language);
  };

  // Dashboard navigation
  const setCurrentDashboard = (dashboard) => {
    dispatch({ type: ActionTypes.SET_CURRENT_DASHBOARD, payload: dashboard });
  };

  // Dashboard switching functions
  const switchToUserDashboard = (targetRoute = null) => {
    dispatch({ type: ActionTypes.SET_CURRENT_DASHBOARD, payload: 'user' });
    dispatch({ type: ActionTypes.SET_SELECTED_CHAMA, payload: null });
    if (targetRoute) {
      dispatch({ type: ActionTypes.SET_PENDING_USER_ROUTE, payload: targetRoute });
    }
  };

  const switchToAdminDashboard = () => {
    dispatch({ type: ActionTypes.SET_CURRENT_DASHBOARD, payload: 'admin' });
    dispatch({ type: ActionTypes.SET_SELECTED_CHAMA, payload: null });

    // Note: RootNavigator will automatically render AdminDashboardStack when currentDashboard changes to 'admin'
    // No manual navigation needed since we use conditional rendering
  };

  const switchToChamaDashboard = (chamaIdOrData = null, chamaData = null) => {
    dispatch({ type: ActionTypes.SET_CURRENT_DASHBOARD, payload: 'chama' });

    // Handle different parameter formats
    if (chamaData) {
      // Called with (chamaId, chamaData)
      dispatch({ type: ActionTypes.SET_SELECTED_CHAMA, payload: chamaData });
    } else if (chamaIdOrData && typeof chamaIdOrData === 'object') {
      // Called with (chamaObject) - this is the common case from chama lists
      dispatch({ type: ActionTypes.SET_SELECTED_CHAMA, payload: chamaIdOrData });
    } else if (chamaIdOrData && typeof chamaIdOrData === 'string') {
      // Called with just chamaId string
      dispatch({ type: ActionTypes.SET_SELECTED_CHAMA, payload: { id: chamaIdOrData } });
    }

    // Note: RootNavigator will automatically render ChamaDashboardStack when currentDashboard changes to 'chama'
    // No manual navigation needed since we use conditional rendering
  };

  const switchToAuthFlow = () => {
    dispatch({ type: ActionTypes.LOGOUT });
  };

  const setSelectedChama = (chama) => {
    dispatch({ type: ActionTypes.SET_SELECTED_CHAMA, payload: chama });
  };

  const clearPendingUserRoute = () => {
    dispatch({ type: ActionTypes.CLEAR_PENDING_USER_ROUTE });
  };

  // Error handling
  const setError = (error) => {
    dispatch({ type: ActionTypes.SET_ERROR, payload: error });
  };

  const clearError = () => {
    dispatch({ type: ActionTypes.CLEAR_ERROR });
  };

  // Clear all auth data (for testing)
  const clearAuthData = async () => {
    try {
      await AsyncStorage.multiRemove([
        'authToken',
        'userData',
        'userRole',
        'cached_avatar_data' // Also clear cached avatar data
      ]);
      dispatch({ type: ActionTypes.LOGOUT });
    } catch (error) {
      console.error('Failed to clear auth data:', error);
    }
  };

  // Clear storage cache to fix quota issues
  const clearStorageCache = async () => {
    try {
      // Get all keys
      const keys = await AsyncStorage.getAllKeys();

      // Clear any large data items and old user data
      const largeDataKeys = keys.filter(key =>
        key.includes('userData') ||
        key.includes('cached') ||
        key.includes('avatar') ||
        key.includes('offlineUsers') ||
        key.includes('authToken')
      );

      if (largeDataKeys.length > 0) {
        await AsyncStorage.multiRemove(largeDataKeys);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

    } catch (error) {
      console.error('Failed to clear storage cache:', error);
    }
  };


  // Context value
  const value = {
    // State
    ...state,

    // Actions
    login,
    register,
    updateUser,
    logout,
    refreshData,
    getCachedData,
    getLightningData,
    prefetchForPage,
    refreshSpecificData,
    loadUserChamas,
    setTheme,
    toggleTheme,
    setLanguage,
    setCurrentDashboard,
    setSelectedChama,
    clearPendingUserRoute,
    setError,
    clearError,
    clearAuthData,
    clearStorageCache,
    loadLocalData,
    getCachedAvatarData,

    // Dashboard switching
    switchToUserDashboard,
    switchToAdminDashboard,
    switchToChamaDashboard,
    switchToAuthFlow,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

// Hook to use the context
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export default AppContext;