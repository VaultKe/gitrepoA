import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';

/**
 * Smart Navigation Hook
 * Provides intelligent navigation that respects user's navigation history
 * and allows seamless movement between different dashboard contexts
 */
export const useSmartNavigation = () => {
  const navigation = useNavigation();
  const { currentDashboard } = useApp();

  /**
   * Get current dashboard context based on navigation state
   */
  const getCurrentDashboard = () => {
    try {
      const state = navigation.getState();
      const currentRoute = state?.routes?.[state?.index];
      const routeName = currentRoute?.name;

      // Detect dashboard based on route name or navigation structure
      if (routeName?.includes('Admin') || currentDashboard === 'admin') {
        return 'admin';
      } else if (routeName?.includes('Chama') || currentDashboard === 'chama') {
        return 'chama';
      } else {
        return 'user';
      }
    } catch (error) {
      console.warn('Failed to detect current dashboard:', error);
      return currentDashboard || 'user';
    }
  };

  /**
   * Smart back navigation that intelligently handles navigation history
   * Provides smooth navigation experience based on user's actual journey
   */
  const goBack = () => {
    try {
      const state = navigation.getState();
      const currentRoute = state?.routes?.[state?.index];
      const routeHistory = state?.routes || [];

      const currentRouteName = currentRoute?.name;

      // Special handling for learning screens to maintain proper flow
      if (currentRouteName && isLearningScreen(currentRouteName)) {
        const learningBackNavigation = getLearningBackNavigation(currentRouteName, currentRoute?.params, routeHistory);
        if (learningBackNavigation) {
          navigation.navigate(learningBackNavigation.screen, learningBackNavigation.params);
          return;
        }
      }

      // PRIORITY 1: ALWAYS use React Navigation's natural back functionality
      // This ensures: Home → Wallet → Deposit → Back → Wallet → Back → Home
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }

      // PRIORITY 2: If we can't go back, check if we have navigation history
      const hasNavigationHistory = routeHistory.length > 1;
      if (hasNavigationHistory) {
        try {
          navigation.goBack();
          return;
        } catch (error) {
        }
      }

      // PRIORITY 3: Only use smart navigation as LAST RESORT when natural navigation fails
      // Only handle main dashboard screens that have no navigation history
      const mainDashboardScreens = ['Learn', 'Wallet', 'Chat', 'AIAssistant', 'MyChamas', 'Reminders', 'Meetings', 'BuyAirtime', 'PayBills'];
      if (mainDashboardScreens.includes(currentRouteName) && routeHistory.length <= 1) {
        navigation.navigate('Home');
        return;
      }
      // PRIORITY 4: Handle specific screen contexts intelligently
      if (currentRouteName) {
        const intelligentFallback = getIntelligentFallback(currentRouteName, currentRoute?.params);
        if (intelligentFallback && isLogicalFallback(currentRouteName, intelligentFallback)) {
          navigation.navigate(intelligentFallback.screen, intelligentFallback.params);
          return;
        }
      }

      // PRIORITY 5: Dashboard-specific screens fallback
      if (isScreenSpecificToDashboard(currentRouteName, currentDashboard)) {
        switch (currentDashboard) {
          case 'admin':
            navigation.navigate('AdminDashboard', { screen: 'AdminTabs' });
            break;
          case 'chama':
            navigation.navigate('ChamaDashboard', { screen: 'ChamaTabs' });
            break;
          case 'user':
          default:
            navigation.navigate('UserTabs', { screen: 'Home' });
            break;
        }
      } else {
      }
    } catch (error) {
      console.warn(' Navigation error in goBack:', error);
      // Last resort: navigate to user home
      try {
        navigation.navigate('UserTabs', { screen: 'Home' });
      } catch (fallbackError) {
        console.error(' Failed to navigate back:', fallbackError);
      }
    }
  };

  /**
   * Get intelligent fallback navigation based on current screen context
   * Analyzes the current screen and provides the most logical back destination
   */
  const getIntelligentFallback = (currentRouteName, routeParams) => {
    // Chama-specific screens should go back to the chama they came from
    if (routeParams?.chamaId) {
      return {
        screen: 'ChamaDashboard',
        params: {
          chamaId: routeParams.chamaId,
          chama: routeParams.chama
        }
      };
    }

    // User dashboard screens should go back to appropriate user tab
    const userDashboardScreens = {
      'Wallet': { screen: 'UserTabs', params: { screen: 'Home' } },
      'AIAssistant': { screen: 'UserTabs', params: { screen: 'Home' } },
      'MyChamas': { screen: 'UserTabs', params: { screen: 'Home' } },
      'ChamaList': { screen: 'UserTabs', params: { screen: 'Home' } },
      'Chat': { screen: 'UserTabs', params: { screen: 'Home' } },
      'ChatRoom': { screen: 'UserTabs', params: { screen: 'Home' } },
      'Meetings': { screen: 'UserTabs', params: { screen: 'Home' } },
      // Learning screens - use correct screen names and smart navigation
      'CourseDetail': { screen: 'UserTabs', params: { screen: 'Learn' } },
      'CourseDetailScreen': { screen: 'UserTabs', params: { screen: 'Learn' } },
      'QuizTaking': { screen: 'CourseDetail' },
      'QuizTakingScreen': { screen: 'CourseDetail' },
      'VideoPlayer': { screen: 'CourseDetail' },
      'VideoPlayerScreen': { screen: 'CourseDetail' },
      'ArticleReader': { screen: 'CourseDetail' },
      'ArticleReaderScreen': { screen: 'CourseDetail' },
      'CourseNavigation': { screen: 'CourseDetail' },
      'CourseNavigationScreen': { screen: 'CourseDetail' },
    };

    if (userDashboardScreens[currentRouteName]) {
      return userDashboardScreens[currentRouteName];
    }

    // Admin screens should go back to admin dashboard
    const adminScreens = [
      'UserManagementScreen', 'ChamaManagementScreen', 'LearningManagementScreen',
      'SystemAnalyticsScreen', 'AdminSettingsScreen', 'SecurityCenterScreen',
      'PaymentSystemScreen', 'BackupMaintenanceScreen', 'CreateLearningCourseScreen',
      'CreateLearningCategoryScreen', 'EditLearningCourse', 'EditLearningCategory'
    ];

    if (adminScreens.includes(currentRouteName)) {
      return { screen: 'AdminDashboard', params: { screen: 'AdminTabs' } };
    }

    // If coming from user dashboard with fromUserDashboard flag
    if (routeParams?.fromUserDashboard) {
      return { screen: 'UserTabs', params: { screen: 'Home' } };
    }

    return null; // No intelligent fallback found
  };

  /**
   * Navigate to a screen with smart routing
   * Prioritizes direct navigation within current navigator, then falls back to cross-navigator routing
   */
  const navigateTo = (screenName, params = {}) => {
    try {
      // First, try direct navigation within current navigator
      navigation.navigate(screenName, params);
    } catch (error) {
      console.warn(` Direct navigation to ${screenName} failed, trying alternative routes:`, error.message);

      // First, try intelligent navigation for common screens within current navigator
      const currentDashboard = getCurrentDashboard();
      // Common screens that exist in all navigators - try current navigator first
      const commonScreens = ['Profile', 'Settings', 'Notifications', 'SecuritySettings', 'HelpCenter', 'TransactionHistory', 'Invitations'];

      if (commonScreens.includes(screenName)) {
        // Since we've added these screens to all navigators, direct navigation should work
        // If it failed, it means the screen might not be properly configured
        return; // Don't try cross-navigator routing for common screens
      }

      // Try cross-dashboard navigation for specific screens
      const alternativeRoutes = {
        // User dashboard screens - all should go through UserDashboard stack
        'Profile': 'UserDashboard',
        'Settings': 'UserDashboard',
        'Wallet': 'UserDashboard',
        'Chat': 'UserDashboard',
        'AIAssistant': 'UserDashboard',
        'MyChamas': 'UserDashboard',
        'ChamaList': 'UserDashboard',
        'UserTabs': 'UserDashboard',
        'Home': 'UserDashboard',

        // Admin dashboard screens
        'AdminMain': 'AdminDashboard',
        'AdminTabs': 'AdminDashboard',
        'AdminHomepage': 'AdminDashboard',
        'UserManagementScreen': 'AdminDashboard',
        'ChamaManagementScreen': 'AdminDashboard',
        'LearningManagementScreen': 'AdminDashboard',
        'SystemAnalyticsScreen': 'AdminDashboard',
        'AdminSettingsScreen': 'AdminDashboard',
        'SecurityCenterScreen': 'AdminDashboard',
        'PaymentSystemScreen': 'AdminDashboard',
        'BackupMaintenanceScreen': 'AdminDashboard',
        'CreateLearningCourseScreen': 'AdminDashboard',
        'CreateLearningCategoryScreen': 'AdminDashboard',
        'EditLearningCourse': 'AdminDashboard',
        'EditLearningCategory': 'AdminDashboard',

        // Learning content screens - should go through UserDashboard
        'CourseDetail': 'UserDashboard',
        'QuizTaking': 'UserDashboard',
        'VideoPlayer': 'UserDashboard',
        'ArticleReader': 'UserDashboard',
        'CourseNavigation': 'UserDashboard',

        // Chama dashboard screens
        'ChamaMain': 'ChamaDashboard',
        'ChamaTabs': 'ChamaDashboard',
        'ChamaMembersScreen': 'ChamaDashboard',
        'ContributeScreen': 'ChamaDashboard',
        'ChamaLoansScreen': 'ChamaDashboard',
        'ChamaMeetingsScreen': 'ChamaDashboard',
        'ChamaTransactionsScreen': 'ChamaDashboard',
        'MerryGoRoundScreen': 'ChamaDashboard',
        'WelfareScreen': 'ChamaDashboard',
        'ChamaSettings': 'ChamaDashboard',
        'LoanApplication': 'ChamaDashboard',
        'CreateMeeting': 'ChamaDashboard',
        'CreateMerryGoRound': 'ChamaDashboard',
        'MeetingSummary': 'ChamaDashboard',
        'InviteMembers': 'ChamaDashboard',
        'ChatRoom': 'ChamaDashboard',
      };

      const dashboardRoute = alternativeRoutes[screenName];
      if (dashboardRoute) {
        navigation.navigate(dashboardRoute, { 
          screen: screenName, 
          params 
        });
      } else {
        console.error(`❌ Could not navigate to ${screenName}`);
      }
    }
  };

  /**
   * Enhanced navigation with context preservation
   * Navigates while preserving important context like chamaId
   */
  const navigateWithContext = (screenName, params = {}, preserveContext = true) => {
    if (preserveContext) {
      const state = navigation.getState();
      const currentRoute = state?.routes?.[state?.index];
      const currentParams = currentRoute?.params || {};

      // Preserve important context parameters
      const contextParams = {};
      if (currentParams.chamaId) contextParams.chamaId = currentParams.chamaId;
      if (currentParams.chama) contextParams.chama = currentParams.chama;
      if (currentParams.fromUserDashboard) contextParams.fromUserDashboard = currentParams.fromUserDashboard;

      // Merge context with new params (new params take precedence)
      const mergedParams = { ...contextParams, ...params };
      navigateTo(screenName, mergedParams);
    } else {
      navigateTo(screenName, params);
    }
  };

  /**
   * Get the current navigation state for debugging and context analysis
   */
  const getNavigationState = () => {
    const state = navigation.getState();
    const currentRoute = state?.routes?.[state?.index];

    return {
      canGoBack: navigation.canGoBack(),
      currentRoute: currentRoute?.name,
      currentParams: currentRoute?.params,
      routeHistory: state?.routes?.map(route => ({
        name: route.name,
        key: route.key,
        params: route.params
      })) || [],
      currentDashboard,
      stackDepth: state?.routes?.length || 0,
    };
  };

  /**
   * Check if we're currently in a specific context (e.g., within a chama)
   */
  const getCurrentContext = () => {
    const state = navigation.getState();
    const currentRoute = state?.routes?.[state?.index];
    const params = currentRoute?.params || {};

    return {
      isInChama: !!params.chamaId,
      chamaId: params.chamaId,
      chama: params.chama,
      fromUserDashboard: params.fromUserDashboard,
      routeName: currentRoute?.name,
    };
  };

  /**
   * Check if a screen is a learning-related screen
   */
  const isLearningScreen = (screenName) => {
    const learningScreens = [
      'CourseDetail', 'CourseDetailScreen',
      'QuizTaking', 'QuizTakingScreen',
      'VideoPlayer', 'VideoPlayerScreen',
      'ArticleReader', 'ArticleReaderScreen',
      'CourseNavigation', 'CourseNavigationScreen',
    ];
    return learningScreens.includes(screenName);
  };

  /**
   * Check if a fallback navigation is logical (has a clear parent-child relationship)
   */
  const isLogicalFallback = (currentScreen, fallback) => {
    // Define screens that have clear logical parent screens
    const logicalFallbacks = {
      // Learning content screens clearly belong to CourseDetail
      'QuizTaking': ['CourseDetail'],
      'QuizTakingScreen': ['CourseDetail'],
      'VideoPlayer': ['CourseDetail'],
      'VideoPlayerScreen': ['CourseDetail'],
      'ArticleReader': ['CourseDetail'],
      'ArticleReaderScreen': ['CourseDetail'],
      'CourseNavigation': ['CourseDetail'],
      'CourseNavigationScreen': ['CourseDetail'],

      // Chama screens with clear parents
      'LoanApplication': ['ChamaLoansScreen'],
      'CreateMeeting': ['ChamaMeetingsScreen'],
      'InviteMembers': ['ChamaMembersScreen'],
      'ViewMember': ['ChamaMembersScreen'],
    };

    const validParents = logicalFallbacks[currentScreen];
    if (!validParents) return false;

    const fallbackScreen = fallback.screen;
    return validParents.includes(fallbackScreen);
  };

  /**
   * Check if a screen is specific to a particular dashboard context
   */
  const isScreenSpecificToDashboard = (screenName, dashboard) => {
    const adminSpecificScreens = [
      'UserManagementScreen', 'ChamaManagementScreen', 'LearningManagementScreen',
      'SystemAnalyticsScreen', 'AdminSettingsScreen', 'SecurityCenterScreen',
      'PaymentSystemScreen', 'BackupMaintenanceScreen', 'CreateLearningCourseScreen',
      'CreateLearningCategoryScreen', 'EditLearningCourse', 'EditLearningCategory'
    ];

    const chamaSpecificScreens = [
      'ChamaMembersScreen', 'ContributeScreen', 'ChamaLoansScreen', 'ChamaMeetingsScreen',
      'ChamaTransactionsScreen', 'MerryGoRoundScreen', 'WelfareScreen', 'ChamaSettings',
      'LoanApplication', 'CreateMeeting', 'CreateMerryGoRound', 'InviteMembers',
      'ViewMember', 'PhysicalMeeting', 'OnlineMeeting'
    ];

    if (dashboard === 'admin' && adminSpecificScreens.includes(screenName)) return true;
    if (dashboard === 'chama' && chamaSpecificScreens.includes(screenName)) return true;

    return false;
  };

  /**
   * Get learning-specific back navigation based on common user flows
   */
  const getLearningBackNavigation = (currentScreen, routeParams, routeHistory) => {
    // Helper function to find course data from current params or route history
    const findCourseData = () => {
      // First check current route params
      if (routeParams?.courseId) {
        return { courseId: routeParams.courseId, course: routeParams.course };
      }
      if (routeParams?.course) {
        return { courseId: routeParams.course.id, course: routeParams.course };
      }

      // Then check route history for course data
      for (let i = routeHistory.length - 1; i >= 0; i--) {
        const historyRoute = routeHistory[i];
        if (historyRoute?.params?.courseId) {
          return { courseId: historyRoute.params.courseId, course: historyRoute.params.course };
        }
        if (historyRoute?.params?.course) {
          return { courseId: historyRoute.params.course.id, course: historyRoute.params.course };
        }
      }

      return { courseId: null, course: null };
    };

    const { courseId, course } = findCourseData();
    // Define common learning navigation flows
    const learningFlows = {
      // Course flow: Learning Hub → CourseDetail → QuizTaking/VideoPlayer/ArticleReader/CourseNavigation
      'CourseDetail': { screen: 'UserTabs', params: { screen: 'Learn' } },
      'CourseDetailScreen': { screen: 'UserTabs', params: { screen: 'Learn' } },

      // Content flow: CourseDetail → QuizTaking/VideoPlayer/ArticleReader/CourseNavigation
      // These need courseId to navigate back to CourseDetail
      'QuizTaking': courseId ? {
        screen: 'CourseDetail',
        params: course ? { courseId, course } : { courseId }
      } : { screen: 'UserTabs', params: { screen: 'Learn' } },

      'QuizTakingScreen': courseId ? {
        screen: 'CourseDetail',
        params: course ? { courseId, course } : { courseId }
      } : { screen: 'UserTabs', params: { screen: 'Learn' } },

      'VideoPlayer': courseId ? {
        screen: 'CourseDetail',
        params: course ? { courseId, course } : { courseId }
      } : { screen: 'UserTabs', params: { screen: 'Learn' } },

      'VideoPlayerScreen': courseId ? {
        screen: 'CourseDetail',
        params: course ? { courseId, course } : { courseId }
      } : { screen: 'UserTabs', params: { screen: 'Learn' } },

      'ArticleReader': courseId ? {
        screen: 'CourseDetail',
        params: course ? { courseId, course } : { courseId }
      } : { screen: 'UserTabs', params: { screen: 'Learn' } },

      'ArticleReaderScreen': courseId ? {
        screen: 'CourseDetail',
        params: course ? { courseId, course } : { courseId }
      } : { screen: 'UserTabs', params: { screen: 'Learn' } },

      'CourseNavigation': courseId ? {
        screen: 'CourseDetail',
        params: course ? { courseId, course } : { courseId }
      } : { screen: 'UserTabs', params: { screen: 'Learn' } },

      'CourseNavigationScreen': courseId ? {
        screen: 'CourseDetail',
        params: course ? { courseId, course } : { courseId }
      } : { screen: 'UserTabs', params: { screen: 'Learn' } },
    };

    // Check if we have a specific flow for this screen
    const flow = learningFlows[currentScreen];
    if (flow) {
      return flow;
    }

    // Fallback to learning hub main screen
    return { screen: 'UserTabs', params: { screen: 'Learn' } };
  };

  return {
    goBack,
    navigateTo,
    navigateWithContext,
    getNavigationState,
    getCurrentContext,
    // Expose original navigation for advanced use cases
    navigation,
  };
};

export default useSmartNavigation;