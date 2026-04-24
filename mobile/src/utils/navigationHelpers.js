/**
 * Navigation Helpers
 * Utilities for cross-dashboard navigation and smart routing
 */

/**
 * Get the appropriate dashboard route for a screen
 */
export const getDashboardForScreen = (screenName) => {
  const screenToDashboard = {
    // User Dashboard Screens
    'Home': 'user',
    'Profile': 'user',
    'Settings': 'user',
    'Notifications': 'user',
    'Wallet': 'user',
    'Deposit': 'user',
    'Withdraw': 'user',
    'Transfer': 'user',
    'TransactionHistory': 'user',
    'RequestMoney': 'user',
    'BuyAirtime': 'user',
    'PayBills': 'user',
    
    'Invitations': 'user',
    'Learn': 'user',
    'CourseDetail': 'user',
    'QuizTaking': 'user',
    'VideoPlayer': 'user',
    'ArticleReader': 'user',
    'CourseNavigation': 'user',
    'Meetings': 'user',
    'AIAssistant': 'user',
    'Chat': 'user',
    'MyChamas': 'user',
    'ChamaList': 'user',
    'CreateChama': 'user',

    // Admin Dashboard Screens
    'AdminMain': 'admin',
    'UserManagement': 'admin',
    'ChamaManagement': 'admin',
    'LearningManagement': 'admin',
    'SystemAnalytics': 'admin',
    'SecurityCenter': 'admin',
    'PaymentSystem': 'admin',
    'BackupMaintenance': 'admin',
    'AdminSettings': 'admin',
    'CreateLearningCategory': 'admin',
    'CreateLearningCourse': 'admin',

    // Chama Dashboard Screens
    'ChamaMain': 'chama',
    'ChamaDashboard': 'chama',
    'ChamaMembers': 'chama',
    'ChamaTransactions': 'chama',
    'ChamaLoans': 'chama',
    'ChamaMeetings': 'chama',
    'ChamaSettings': 'chama',
    'ContributeScreen': 'chama',
    'MerryGoRound': 'chama',
    'Welfare': 'chama',
    'LoanApplication': 'chama',
    'CreateMeeting': 'chama',
    'InviteMembers': 'chama',
    'ViewMember': 'chama',

    // Auth Screens
    'Login': 'auth',
    'Register': 'auth',
    'ForgotPassword': 'auth',
  };

  return screenToDashboard[screenName] || 'user';
};

/**
 * Get the root navigator name for a dashboard
 */
export const getDashboardNavigator = (dashboard) => {
  const dashboardNavigators = {
    'user': 'UserDashboard',
    'admin': 'AdminDashboard', 
    'chama': 'ChamaDashboard',
    'auth': 'AuthStack',
  };

  return dashboardNavigators[dashboard] || 'UserDashboard';
};

/**
 * Check if navigation between two screens requires dashboard switching
 */
export const requiresDashboardSwitch = (fromScreen, toScreen) => {
  const fromDashboard = getDashboardForScreen(fromScreen);
  const toDashboard = getDashboardForScreen(toScreen);
  
  return fromDashboard !== toDashboard;
};

/**
 * Get navigation params for cross-dashboard navigation
 */
export const getCrossDashboardNavParams = (screenName, params = {}) => {
  const dashboard = getDashboardForScreen(screenName);
  const navigator = getDashboardNavigator(dashboard);
  
  return {
    navigator,
    screen: screenName,
    params,
    dashboard,
  };
};

/**
 * Common screen titles for consistent naming
 */
export const getScreenTitle = (screenName) => {
  const screenTitles = {
    // User Dashboard
    'Home': 'Dashboard',
    'Profile': 'My Profile',
    'Settings': 'Settings',
    'Notifications': 'Notifications',
    'Wallet': 'My Wallet',
    'Deposit': 'Deposit Money',
    'Withdraw': 'Withdraw Money',
    'Transfer': 'Transfer Money',
    'TransactionHistory': 'Transaction History',
    'RequestMoney': 'Request Money',
    'BuyAirtime': 'Buy Airtime',
    'PayBills': 'Pay Bills',
    
    'Learn': 'Learning Hub',
    'Meetings': 'Meetings',
    'AIAssistant': 'AI Assistant',
    'Chat': 'Messages',
    'MyChamas': 'My Chamas',
    'ChamaList': 'Browse Chamas',
    'CreateChama': 'Create New Chama',

    // Admin Dashboard
    'AdminMain': 'Admin Dashboard',
    'UserManagement': 'User Management',
    'ChamaManagement': 'Chama Management',
    'LearningManagement': 'Learning Management',
    'SystemAnalytics': 'System Analytics',
    'SecurityCenter': 'Security Center',
    'PaymentSystem': 'Payment System',
    'BackupMaintenance': 'Backup & Maintenance',
    'AdminSettings': 'Admin Settings',
    'CreateLearningCategory': 'Create Category',
    'CreateLearningCourse': 'Create Course',

    // Chama Dashboard
    'ChamaMain': 'Chama Dashboard',
    'ChamaDashboard': 'Chama Overview',
    'ChamaMembers': 'Members',
    'ChamaTransactions': 'Transactions',
    'ChamaLoans': 'Loans',
    'ChamaMeetings': 'Meetings',
    'ChamaSettings': 'Chama Settings',
    'ContributeScreen': 'Contribute',
    'MerryGoRound': 'Merry-Go-Round',
    'Welfare': 'Welfare',
    'LoanApplication': 'Apply for Loan',
    'CreateMeeting': 'Create Meeting',
    'InviteMembers': 'Invite Members',
    'ViewMember': 'Member Details',

    // Auth
    'Login': 'Sign In',
    'Register': 'Create Account',
    'ForgotPassword': 'Reset Password',
  };

  return screenTitles[screenName] || screenName;
};
