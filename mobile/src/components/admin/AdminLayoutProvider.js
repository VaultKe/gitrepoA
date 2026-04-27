import React, { useState } from 'react';
import AdminLayout from './AdminLayout';

// Import all admin screens
import AdminHomepage from '../../screens/admin/dashboard/AdminHomepage';
import UserManagementScreen from '../../screens/admin/usermanagement/UserManagementScreen';
import ChamaManagementScreen from '../../screens/admin/chamamanagement/ChamaManagementScreen';
import LearningManagementScreen from '../../screens/admin/learning/LearningManagementScreen';
import SystemAnalyticsScreen from '../../screens/admin/analytics/SystemAnalyticsScreen';
import SecurityCenterScreen from '../../screens/admin/security/SecurityCenterScreen';
import PaymentSystemScreen from '../../screens/admin/payments/PaymentSystemScreen';
import BackupMaintenanceScreen from '../../screens/admin/maintenance/BackupMaintenanceScreen';
import AdminSettingsScreen from '../../screens/admin/settings/AdminSettingsScreen';
import CreateLearningCourseScreen from '../../screens/admin/learning/CreateLearningCourseScreen';
import CreateLearningCategoryScreen from '../../screens/admin/learning/CreateLearningCategoryScreen';
import FinancialReportsScreen from '../../screens/admin/financial/FinancialReportsScreen';
import SystemHealthScreen from '../../screens/admin/system/SystemHealthScreen';
import APIManagementScreen from '../../screens/admin/system/APIManagementScreen';
import ContentModerationScreen from '../../screens/admin/content/ContentModerationScreen';
import NotificationManagementScreen from '../../screens/admin/notifications/NotificationManagementScreen';
import AuditLogsScreen from '../../screens/admin/audit/AuditLogsScreen';
import AdminSupportScreen from '../../screens/admin/support/AdminSupportScreen';

const AdminLayoutProvider = ({ route, navigation }) => {
  const { initialRoute = 'dashboard', ...routeParams } = route.params || {};
  const [activeRoute, setActiveRoute] = useState(initialRoute);
  const [currentComponent, setCurrentComponent] = useState(initialRoute);
  const [componentParams, setComponentParams] = useState(routeParams);

  // Route mapping
  const routeComponents = {
    dashboard: AdminHomepage,
    UserManagementScreen: UserManagementScreen,
    ChamaManagementScreen: ChamaManagementScreen,
    LearningManagementScreen: LearningManagementScreen,
    SystemAnalyticsScreen: SystemAnalyticsScreen,
    SecurityCenterScreen: SecurityCenterScreen,
    PaymentSystemScreen: PaymentSystemScreen,
    BackupMaintenanceScreen: BackupMaintenanceScreen,
    AdminSettingsScreen: AdminSettingsScreen,
    FinancialReportsScreen: FinancialReportsScreen,
    SystemHealthScreen: SystemHealthScreen,
    APIManagementScreen: APIManagementScreen,
    ContentModerationScreen: ContentModerationScreen,
    NotificationManagementScreen: NotificationManagementScreen,
    AuditLogsScreen: AuditLogsScreen,
    AdminSupportScreen: AdminSupportScreen,
    'create-course': CreateLearningCourseScreen,
    'create-category': CreateLearningCategoryScreen,
  };

  const handleRouteChange = (routeId, routeName, params = {}) => {
    setActiveRoute(routeId);
    setCurrentComponent(routeId);
    setComponentParams(params);
  };

  const renderCurrentComponent = () => {
    const Component = routeComponents[currentComponent];

    if (!Component) {
      return routeComponents.dashboard;
    }

    // Render the component with proper props
    return (
      <Component
        route={{
          params: {
            activeRoute: currentComponent,
            ...componentParams
          }
        }}
        navigation={navigation}
        onRouteChange={handleRouteChange}
      />
    );
  };

  return (
    <AdminLayout
      navigation={navigation}
      activeRoute={activeRoute}
      onRouteChange={handleRouteChange}
    >
      {renderCurrentComponent()}
    </AdminLayout>
  );
};

export default AdminLayoutProvider;
