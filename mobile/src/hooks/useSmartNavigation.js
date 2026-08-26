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
   * Go back to the previous screen using navigation.goBack() (navigate(-1)).
   * Falls back to the parent navigator when the current navigator (e.g. Tab)
   * has no back history. No smart fallbacks or Home redirects.
   */
  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    // Delegate to parent navigator (e.g. Tab inside Stack)
    const parent = navigation.getParent();
    if (parent && typeof parent.canGoBack === 'function' && parent.canGoBack()) {
      parent.goBack();
    }
  };

  /**
   * Navigate to a screen with smart routing
   * Uses navigation.navigate() directly — React Navigation will resolve the
   * route within the current navigator or delegate to a parent navigator.
   * No cross-navigator routing hacks that break stack history.
   */
  const navigateTo = (screenName, params = {}) => {
    navigation.navigate(screenName, params);
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