import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import ApiService from '../services/api';
import { useApp } from '../context/AppContext';
import {
  formatCurrency,
  isMemberLeft,
  getMemberName,
} from '../utils/merryGoRoundHelpers';

const useCreateMerryGoRound = ({ route, navigation }) => {
  const { chamaId } = route.params;
  const { theme, user } = useApp();

  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [chamaMembers, setChamaMembers] = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [participantOrder, setParticipantOrder] = useState('automatic');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amountPerRound: '',
    totalParticipants: '',
    frequency: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
  });

  const frequencies = [
    { id: 'weekly', name: 'Weekly', description: 'Every week' },
    { id: 'monthly', name: 'Monthly', description: 'Every month' },
  ];

  const orderOptions = [
    { id: 'automatic', name: 'Automatic', description: 'Random order generated automatically' },
    { id: 'alphabetical', name: 'Alphabetical', description: 'Order by member names A-Z' },
    { id: 'manual', name: 'Manual', description: 'Choose the order manually' },
  ];

  useEffect(() => {
    loadChamaMembers();
  }, [chamaId]);

  const loadChamaMembers = async () => {
    try {
      setLoadingMembers(true);
      const response = await ApiService.getChamaMembers(chamaId, { include_inactive: 'true' });
      if (response.success) {
        setChamaMembers(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load chama members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleParticipant = (member) => {
    if (isMemberLeft(member)) {
      return;
    }
    setSelectedParticipants(prev => {
      const memberId = member.user_id || member.id;
      const isSelected = prev.find(p => (p.user_id || p.id) === memberId);
      if (isSelected) {
        return prev.filter(p => (p.user_id || p.id) !== memberId);
      } else {
        return [...prev, member];
      }
    });
  };

  const moveParticipant = (fromIndex, toIndex) => {
    setSelectedParticipants(prev => {
      const newOrder = [...prev];
      const [movedItem] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, movedItem);
      return newOrder;
    });
  };

  const getOrderedParticipants = () => {
    if (participantOrder === 'alphabetical') {
      return [...selectedParticipants].sort((a, b) => {
        const nameA = `${a.user?.first_name || a.first_name || ''} ${a.user?.last_name || a.last_name || ''}`.trim();
        const nameB = `${b.user?.first_name || b.first_name || ''} ${b.user?.last_name || b.last_name || ''}`.trim();
        return nameA.localeCompare(nameB);
      });
    } else if (participantOrder === 'automatic') {
      return [...selectedParticipants].sort(() => Math.random() - 0.5);
    }
    return selectedParticipants;
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Please enter a name for the merry-go-round');
      return false;
    }
    if (!formData.amountPerRound || parseFloat(formData.amountPerRound) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount per round');
      return false;
    }
    const activeParticipants = selectedParticipants.filter(p => !isMemberLeft(p));
    if (activeParticipants.length !== selectedParticipants.length) {
      Alert.alert('Validation Error', 'Some selected participants have left the chama and were removed.');
      return false;
    }
    if (selectedParticipants.length < 2) {
      Alert.alert('Validation Error', 'Please select at least 2 participants');
      return false;
    }
    if (!formData.startDate.trim()) {
      Alert.alert('Validation Error', 'Please enter a start date');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      let formattedStartDate = formData.startDate.trim();
      if (formattedStartDate.includes(' ')) {
        formattedStartDate = formattedStartDate.split(' ')[0];
      }

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(formattedStartDate)) {
        Alert.alert('Invalid Date Format', 'Please enter date in YYYY-MM-DD format (e.g., 2025-06-09)');
        return;
      }

      const orderedParticipants = getOrderedParticipants().filter(p => !isMemberLeft(p));

      const merryGoRoundData = {
        chamaId,
        name: formData.name.trim(),
        description: formData.description.trim(),
        amountPerRound: parseFloat(formData.amountPerRound),
        totalParticipants: orderedParticipants.length,
        frequency: formData.frequency,
        startDate: formattedStartDate,
        participants: orderedParticipants.map((participant, index) => ({
          userId: participant.user_id || participant.id,
          position: index + 1,
          name: `${participant.user?.first_name || participant.first_name || ''} ${participant.user?.last_name || participant.last_name || ''}`.trim(),
          email: participant.user?.email || participant.email || '',
        })),
        participantOrder: participantOrder,
      };

      const response = await ApiService.createMerryGoRound(merryGoRoundData);

      if (response.success) {
        navigation.navigate('MerryGoRoundScreen', {
          chamaId,
          newMerryGoRound: response.data,
          refresh: true
        });
      } else {
        Alert.alert('Error', response.error || 'Failed to create merry-go-round');
      }
    } catch (error) {
      console.error('Error creating merry-go-round:', error);
      Alert.alert('Error', 'Failed to create merry-go-round. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return {
    chamaId,
    theme,
    user,
    loading,
    loadingMembers,
    chamaMembers,
    selectedParticipants,
    setSelectedParticipants,
    participantOrder,
    setParticipantOrder,
    formData,
    frequencies,
    orderOptions,
    handleInputChange,
    toggleParticipant,
    moveParticipant,
    getOrderedParticipants,
    validateForm,
    handleSubmit,
    isMemberLeft,
    getMemberName,
  };
};

export default useCreateMerryGoRound;
