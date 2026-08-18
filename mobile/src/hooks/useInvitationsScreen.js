import { useState, useEffect } from 'react';
import { Toast } from 'react-native';
import { useApp } from '../context/AppContext';
import { getThemeColors } from '../utils/theme';
import api from '../services/api';

const useInvitationsScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingTo, setRespondingTo] = useState(null);

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      const response = await api.getUserInvitations();

      if (response.success) {
        setInvitations(response.data || []);
      } else {
        throw new Error(response.error || 'Failed to load invitations');
      }
    } catch (error) {
      console.error('Error loading invitations:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load invitations',
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInvitations();
    setRefreshing(false);
  };

  const handleRespondToInvitation = async (invitationId, response) => {
    try {
      setRespondingTo(invitationId);

      const invitation = invitations.find(inv => inv.id === invitationId);
      const chamaId = invitation?.chama?.id;

      const apiResponse = await api.respondToInvitation(invitationId, response, chamaId);

      if (apiResponse.success) {
        Toast.show({
          type: 'success',
          text1: response === 'accept' ? 'Invitation Accepted' : 'Invitation Declined',
          text2: apiResponse.message || `You have ${response}ed the invitation`,
        });

        setInvitations(prev => prev.filter(inv => inv.id !== invitationId));

        if (response === 'accept') {
          const invitation = invitations.find(inv => inv.id === invitationId);
          if (invitation?.chama) {
            setTimeout(() => {
              navigation.navigate('ChamaDashboard', {
                chamaId: invitation.chama.id,
                chamaName: invitation.chama.name,
              });
            }, 1500);
          }
        }
      } else {
        throw new Error(apiResponse.error || 'Failed to respond to invitation');
      }
    } catch (error) {
      console.error('Error responding to invitation:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to respond to invitation',
      });
    } finally {
      setRespondingTo(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'KES 0';
    return `KES ${Number(amount).toLocaleString()}`;
  };

  const isExpired = (expiresAt) => {
    return new Date(expiresAt) < new Date();
  };

  return {
    invitations,
    loading,
    refreshing,
    respondingTo,
    loadInvitations,
    onRefresh,
    handleRespondToInvitation,
    formatDate,
    formatCurrency,
    isExpired,
    colors,
    theme,
  };
};

export default useInvitationsScreen;
