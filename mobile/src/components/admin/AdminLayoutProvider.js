import React, { useState } from 'react';
import AdminLayout from './AdminLayout';

// Import all admin screens
import AdminHomepage from '../../screens/admin/AdminHomepage';
import UserManagementScreen from '../../screens/admin/UserManagementScreen';
import ChamaManagementScreen from '../../screens/admin/ChamaManagementScreen';
import LearningManagementScreen from '../../screens/admin/LearningManagementScreen';
import SystemAnalyticsScreen from '../../screens/admin/SystemAnalyticsScreen';
import SecurityCenterScreen from '../../screens/admin/SecurityCenterScreen';
import PaymentSystemScreen from '../../screens/admin/PaymentSystemScreen';
import BackupMaintenanceScreen from '../../screens/admin/BackupMaintenanceScreen';
import AdminSettingsScreen from '../../screens/admin/AdminSettingsScreen';
import CreateLearningCourseScreen from '../../screens/admin/CreateLearningCourseScreen';
import CreateLearningCategoryScreen from '../../screens/admin/CreateLearningCategoryScreen';
import FinancialReportsScreen from '../../screens/admin/FinancialReportsScreen';
import SystemHealthScreen from '../../screens/admin/SystemHealthScreen';
import APIManagementScreen from '../../screens/admin/APIManagementScreen';
import ContentModerationScreen from '../../screens/admin/ContentModerationScreen';
import NotificationManagementScreen from '../../screens/admin/NotificationManagementScreen';
import AuditLogsScreen from '../../screens/admin/AuditLogsScreen';
import AdminSupportScreen from '../../screens/admin/AdminSupportScreen';

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
