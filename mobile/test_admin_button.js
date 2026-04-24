// Test script to verify admin button implementation
console.log('🔍 Testing Admin Button Implementation');

// Check if EnhancedUserDashboard has admin button
const fs = require('fs');
const path = require('path');

const enhancedDashboardPath = path.join(__dirname, 'src/screens/user/EnhancedUserDashboard.js');
const regularDashboardPath = path.join(__dirname, 'src/screens/user/UserDashboard.js');

console.log('\n📁 Checking file contents...');

// Read EnhancedUserDashboard
if (fs.existsSync(enhancedDashboardPath)) {
  const enhancedContent = fs.readFileSync(enhancedDashboardPath, 'utf8');
  const hasAdminPanel = enhancedContent.includes('Admin Panel');
  const hasShieldIcon = enhancedContent.includes('shield-checkmark');
  const hasAlert = enhancedContent.includes('Alert.alert');
  const hasNavigation = enhancedContent.includes("navigation.navigate('MainTabs', { screen: 'Admin' })");
  
  console.log('✅ EnhancedUserDashboard.js:');
  console.log(`   - Has "Admin Panel" text: ${hasAdminPanel ? '✅' : '❌'}`);
  console.log(`   - Has shield-checkmark icon: ${hasShieldIcon ? '✅' : '❌'}`);
  console.log(`   - Has Alert dialog: ${hasAlert ? '✅' : '❌'}`);
  console.log(`   - Has correct navigation: ${hasNavigation ? '✅' : '❌'}`);
  
  // Count quickActions
  const quickActionsMatch = enhancedContent.match(/const quickActions = \[([\s\S]*?)\];/);
  if (quickActionsMatch) {
    const quickActionsContent = quickActionsMatch[1];
    const actionCount = (quickActionsContent.match(/id: \d+/g) || []).length;
    console.log(`   - Total quick actions: ${actionCount}`);
  }
} else {
  console.log('❌ EnhancedUserDashboard.js not found');
}

// Read UserDashboard
if (fs.existsSync(regularDashboardPath)) {
  const regularContent = fs.readFileSync(regularDashboardPath, 'utf8');
  const hasAdminPanel = regularContent.includes('Admin Panel');
  const hasShieldIcon = regularContent.includes('shield-checkmark');
  
  console.log('\n✅ UserDashboard.js:');
  console.log(`   - Has "Admin Panel" text: ${hasAdminPanel ? '✅' : '❌'}`);
  console.log(`   - Has shield-checkmark icon: ${hasShieldIcon ? '✅' : '❌'}`);
} else {
  console.log('❌ UserDashboard.js not found');
}

// Check navigation configuration
const appPath = path.join(__dirname, 'EnhancedApp.js');
if (fs.existsSync(appPath)) {
  const appContent = fs.readFileSync(appPath, 'utf8');
  const hasAdminRoute = appContent.includes('name="Admin"');
  const hasAdminComponent = appContent.includes('component={AdminDashboard}');
  const hasRoleCheck = appContent.includes("userRole === 'admin'");
  
  console.log('\n✅ EnhancedApp.js Navigation:');
  console.log(`   - Has Admin route: ${hasAdminRoute ? '✅' : '❌'}`);
  console.log(`   - Has AdminDashboard component: ${hasAdminComponent ? '✅' : '❌'}`);
  console.log(`   - Has role-based access: ${hasRoleCheck ? '✅' : '❌'}`);
} else {
  console.log('❌ EnhancedApp.js not found');
}

console.log('\n🎯 Summary:');
console.log('The admin button should be visible in the Quick Actions section of both dashboards.');
console.log('If users cannot see it, the issue might be:');
console.log('1. App cache - try restarting the app');
console.log('2. Dashboard selection - check which dashboard is being used');
console.log('3. Component rendering - check for JavaScript errors');
console.log('\n✅ Test completed!');
