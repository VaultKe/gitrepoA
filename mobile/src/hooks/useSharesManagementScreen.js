import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import ApiService from '../services/api';

const useSharesManagementScreen = ({ route }) => {
  const { theme } = useApp();
  const { currentChamaId } = useChamaContext();
  const chamaId = currentChamaId || route?.params?.chamaId;

  const [offerings, setOfferings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({ name: '', totalShares: '', pricePerShare: '', openDate: '', closeDate: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchOfferings = useCallback(async () => {
    if (!chamaId) return;
    try {
      const response = await ApiService.getChamaShareOfferings(chamaId);
      if (response.success) {
        setOfferings(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching shares:', error);
    } finally {
      setLoading(false);
    }
  }, [chamaId]);

  useEffect(() => {
    fetchOfferings();
  }, [fetchOfferings]);

  const handleCreateOffering = async () => {
    if (!form.name || !form.totalShares || !form.pricePerShare) {
      Alert.alert('Validation', 'Please fill all required fields.');
      return;
    }

    if (!chamaId) {
      Alert.alert('Error', 'Missing chama ID.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        totalShares: parseFloat(form.totalShares),
        pricePerShare: parseFloat(form.pricePerShare),
        availableShares: parseFloat(form.totalShares),
        openDate: form.openDate || new Date().toISOString(),
        closeDate: form.closeDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'open',
      };

      const response = await ApiService.createChamaShares(chamaId, payload);

      if (response.success) {
        Alert.alert('Success', 'Share offering created successfully.');
        setShowCreateModal(false);
        setForm({ name: '', totalShares: '', pricePerShare: '', openDate: '', closeDate: '' });
        fetchOfferings();
      } else {
        Alert.alert('Error', response.error || 'Failed to create share offering.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create share offering. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    const val = amount || 0;
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(val);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '-';
    }
  };

  return {
    chamaId,
    offerings,
    loading,
    showCreateModal,
    form,
    submitting,
    setShowCreateModal,
    setForm,
    handleCreateOffering,
    fetchOfferings,
    formatCurrency,
    formatDate,
  };
};

export default useSharesManagementScreen;
