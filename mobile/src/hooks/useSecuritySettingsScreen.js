import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import ApiService from '../services/api';

const useSecuritySettingsScreen = ({ navigation }) => {
  const { theme, user } = useApp();
  const nav = useNavigation();

  const [securitySettings, setSecuritySettings] = useState({
    biometric_login: false,
    two_factor_auth: false,
    auto_logout: true,
    login_notifications: true,
    suspicious_activity_alerts: true,
    device_management: true,
  });

  const handleSettingChange = useCallback((setting, value) => {
    setSecuritySettings(prev => ({ ...prev, [setting]: value }));
    ApiService.updateSecuritySettings({ [setting]: value }).catch((error) => {
      console.error('Failed to update security setting:', error);
      Alert.alert('Error', 'Failed to update security setting');
    });
  }, []);

  const handleChangePassword = useCallback(() => {
    navigation.navigate('ChangePassword');
  }, [navigation]);

  const handleViewLoginHistory = useCallback(() => {
    navigation.navigate('LoginHistory');
  }, [navigation]);

  const handleWhatsAppLink = useCallback(() => {
    nav.navigate('WhatsAppLink');
  }, [nav]);

  return {
    theme,
    user,
    securitySettings,
    handleSettingChange,
    handleChangePassword,
    handleViewLoginHistory,
    handleWhatsAppLink,
  };
};

export default useSecuritySettingsScreen;
