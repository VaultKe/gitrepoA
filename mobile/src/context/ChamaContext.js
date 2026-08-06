import React, { createContext, useContext, useState, useEffect } from 'react';
import { useApp } from './AppContext';
import ApiService from '../services/api';

const ChamaContext = createContext();

export const useChamaContext = () => {
  const context = useContext(ChamaContext);
  if (!context) {
    throw new Error('useChamaContext must be used within a ChamaProvider');
  }
  return context;
};

export const ChamaProvider = ({ children, chamaId, chama }) => {
  const { user, selectedChama, setSelectedChama } = useApp();
  const [chamaData, setChamaData] = useState({});
  const [userRole, setUserRole] = useState('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Set the selected chama from props when the provider is initialized
  useEffect(() => {
    // Prevent setting a chama where the user has left
    if (chama?.membershipIsActive === false) {
      setSelectedChama(null);
      return;
    }
    if (chama) {
      setSelectedChama(chama);
    } else if (chamaId && !selectedChama) {
      // Create a basic chama object if we only have the ID
      const basicChama = { id: chamaId };
      setSelectedChama(basicChama);
    }
  }, [chama, chamaId, setSelectedChama]);

  // Load chama-specific data when selectedChama changes
  useEffect(() => {
    if (selectedChama?.id) {
      loadChamaData(selectedChama.id);
    } else {
      // Clear data when no chama is selected
      setChamaData({});
      setUserRole('member');
      setError(null);
    }
  }, [selectedChama?.id, user?.id]);

  const loadChamaData = async (chamaId) => {
    if (!chamaId || !user?.id) {
      console.warn('Missing chamaId or user.id:', { chamaId, userId: user?.id });
      return;
    }

    // Ensure chamaId is a string
    const cleanChamaId = String(chamaId);
    try {
      setLoading(true);
      setError(null);

      // Load user role in this chama
      try {
        const roleResponse = await ApiService.getMemberRole(cleanChamaId, user.id);
        if (roleResponse.success) {
          setUserRole(roleResponse.data.role || 'member');
        }
      } catch (error) {
        console.warn('Could not fetch user role:', error);
        setUserRole('member'); // Default to member if role fetch fails
      }

      // Load additional chama data if needed
      const chamaDetails = selectedChama || {};
      setChamaData({
        ...chamaDetails,
        id: chamaId,
        userRole: userRole,
      });

    } catch (error) {
      console.error('Error loading chama data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const switchChama = async (chama) => {
    // Prevent switching to a chama where the user has left
    if (chama?.membershipIsActive === false) {
      return;
    }
    setSelectedChama(chama);
  };

  const isLeadershipRole = (role = userRole) => {
    return ['chairperson', 'secretary', 'treasurer'].includes(role?.toLowerCase());
  };

  const canViewGroupRecords = () => {
    return isLeadershipRole(userRole);
  };

  const canManageChama = () => {
    return ['chairperson', 'secretary'].includes(userRole?.toLowerCase());
  };

  const canManageFinances = () => {
    return ['chairperson', 'treasurer'].includes(userRole?.toLowerCase());
  };

  const refreshChamaData = () => {
    if (selectedChama?.id) {
      loadChamaData(selectedChama.id);
    }
  };

  const contextValue = {
    // State
    selectedChama,
    chamaData,
    userRole,
    loading,
    error,

    // Actions
    switchChama,
    refreshChamaData,

    // Permissions
    isLeadershipRole,
    canViewGroupRecords,
    canManageChama,
    canManageFinances,

    // Computed values
    currentChamaId: selectedChama?.id,
    currentChamaName: selectedChama?.name || chamaData?.name,
    hasValidChama: Boolean(selectedChama?.id),
  };

  return (
    <ChamaContext.Provider value={contextValue}>
      {children}
    </ChamaContext.Provider>
  );
};

export default ChamaContext;
