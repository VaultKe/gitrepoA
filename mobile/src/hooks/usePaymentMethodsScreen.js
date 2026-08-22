import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useApp } from '../context/AppContext';

const usePaymentMethodsScreen = ({ navigation }) => {
  const { theme, user } = useApp();
  
  const [loading, setLoading] = useState(false);
  const mpesaPhone = user?.phone || '';

  return {
    theme,
    user,
    paymentMethods: [],
    loading,
    mpesaPhone,
    handleSetDefault: () => {},
    handleToggleActive: () => {},
    handleDeleteMethod: () => {},
    loadPaymentMethods: () => {},
  };
};

export default usePaymentMethodsScreen;
