import React from 'react';
import UserDashboardLayout from '../user/UserDashboardLayout';

/**
 * Higher-Order Component that adds user dashboard footer to any screen
 * Uses UserDashboardLayout to provide proper scrolling behavior
 */
const withUserFooter = (WrappedComponent, currentTab = 'Home') => {
  return function WithUserFooterComponent(props) {
    return (
      <UserDashboardLayout navigation={props.navigation}>
        <WrappedComponent {...props} />
      </UserDashboardLayout>
    );
  };
};

export default withUserFooter;
