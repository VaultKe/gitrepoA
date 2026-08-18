import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import ApiService from '../services/api';
import { toEAT, nowEAT } from '../utils/dateUtils';

const useChamaMeetingsScreen = ({ route, navigation }) => {
  const { chamaId, chamaName, newMeeting, refresh, fromUserDashboard } = route.params || {};
  const { theme, user } = useApp();

  const isUserMeetingsView = fromUserDashboard || !chamaId;
  const userRole = user?.role || 'member';

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const filterOptions = [
    { id: 'all', name: 'All' },
    { id: 'scheduled', name: 'Upcoming' },
    { id: 'ongoing', name: 'Ongoing' },
    { id: 'ended', name: 'Past' },
  ];

  const loadMeetings = async () => {
    try {
      setLoading(true);
      const response = isUserMeetingsView
        ? await ApiService.getUserMeetings(50, 0)
        : await ApiService.getMeetings(chamaId);

      if (response.success) {
        let filteredMeetings = response.data || [];
        const now = nowEAT();

        if (selectedTab === 'upcoming') {
          filteredMeetings = filteredMeetings.filter(m => {
            if (m.status === 'completed' || m.status === 'ended') return false;
            const meetingDate = toEAT(m.scheduledAt || m.date);
            return meetingDate > now;
          });
        } else if (selectedTab === 'ongoing') {
          filteredMeetings = filteredMeetings.filter(m => {
            if (m.status === 'completed' || m.status === 'ended') return false;
            const meetingDate = toEAT(m.scheduledAt || m.date);
            const end = new Date(meetingDate.getTime() + (m.duration || 60) * 60000);
            return meetingDate <= now && end > now;
          });
        } else if (selectedTab === 'past') {
          filteredMeetings = filteredMeetings.filter(m => {
            if (m.status === 'completed' || m.status === 'ended') return true;
            const meetingDate = toEAT(m.scheduledAt || m.date);
            const end = new Date(meetingDate.getTime() + (m.duration || 60) * 60000);
            return end <= now;
          });
        }

        setMeetings(filteredMeetings);
      }
    } catch (error) {
      console.error('Failed to load meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadMeetings();
    } catch (error) {
      console.warn('Meetings refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getFilteredMeetings = () => {
    let filtered = meetings;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.title?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.location?.toLowerCase().includes(q)
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(m => {
        const meetingDate = toEAT(m.scheduledAt || m.date);
        const now = nowEAT();
        const end = new Date(meetingDate.getTime() + (m.duration || 60) * 60000);
        const isActive = meetingDate <= now && end > now;
        const isEnded = end <= now || m.status === 'completed' || m.status === 'ended';
        if (filterStatus === 'ongoing') return isActive;
        if (filterStatus === 'ended') return isEnded;
        if (filterStatus === 'scheduled') return !isEnded && !isActive;
        return true;
      });
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = filtered.slice(startIndex, endIndex);

    return {
      meetings: paginated,
      totalCount: filtered.length,
      totalPages: Math.ceil(filtered.length / itemsPerPage),
    };
  };

  const getDynamicStatus = (meeting) => {
    const meetingDate = toEAT(meeting.scheduledAt || meeting.date);
    const now = nowEAT();
    const end = new Date(meetingDate.getTime() + (meeting.duration || 60) * 60000);
    if (end <= now || meeting.status === 'completed' || meeting.status === 'ended') return 'ENDED';
    if (meetingDate <= now && end > now) return 'ONGOING';
    return 'SCHEDULED';
  };

  const formatMeetingDate = (dateString) => {
    const eatDate = toEAT(dateString);
    if (!eatDate) return 'Invalid Date';
    const day = eatDate.getDate();
    const month = eatDate.toLocaleString('en-KE', { month: 'short', timeZone: 'Africa/Nairobi' });
    const year = eatDate.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const handleViewSummary = (meeting) => {
    navigation.navigate('MeetingSummary', {
      meetingId: meeting.id,
      meetingData: meeting,
      chamaId: chamaId || meeting.chamaId,
      chamaName: chamaName || meeting.chamaName || 'Chama',
    });
  };

  const handleAttend = (meeting) => {
    const meetingType = meeting.meetingType || meeting.type || 'virtual';
    const meetingDate = toEAT(meeting.scheduledAt || meeting.date);
    const now = nowEAT();
    const end = new Date(meetingDate.getTime() + (meeting.duration || 60) * 60000);
    const isActive = now >= meetingDate && now <= end;

    if (isActive) {
      if (meetingType === 'virtual' || meetingType === 'hybrid') {
        navigation.navigate('OnlineMeeting', {
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          userRole: userRole,
          meetingData: meeting,
        });
      } else {
        navigation.navigate('PhysicalMeeting', {
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          userRole: userRole,
          meetingData: meeting,
          chamaId: chamaId || meeting.chamaId,
        });
      }
    } else if (end < now) {
      Alert.alert('Meeting Ended', 'This meeting has already ended.');
    } else {
      Alert.alert('Meeting Not Started', 'This meeting has not started yet.');
    }
  };

  const handleDelete = (meeting) => {
    Alert.alert(
      'Delete Meeting',
      `Are you sure you want to delete "${meeting.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await ApiService.makeRequest(`/meetings/${meeting.id}`, { method: 'DELETE' });
              if (response.success) {
                loadMeetings();
              } else {
                Alert.alert('Error', 'Failed to delete meeting');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete meeting');
            }
          },
        },
      ]
    );
  };

  const handleScheduleMeeting = () => {
    navigation.navigate('CreateMeeting', { chamaId });
  };

  useEffect(() => {
    loadMeetings();
  }, [chamaId]);

  useEffect(() => {
    if (newMeeting && refresh) {
      loadMeetings();
      navigation.setParams({ newMeeting: null, refresh: false });
    }
  }, [newMeeting, refresh]);

  return {
    // State
    meetings,
    loading,
    refreshing,
    selectedTab,
    searchQuery,
    filterStatus,
    currentPage,
    showFilterDropdown,
    filterOptions,
    isUserMeetingsView,
    userRole,
    chamaId,
    chamaName,
    // Handlers
    loadMeetings,
    onRefresh,
    setSearchQuery,
    setFilterStatus,
    setCurrentPage,
    setShowFilterDropdown,
    getFilteredMeetings,
    getDynamicStatus,
    formatMeetingDate,
    handleViewSummary,
    handleAttend,
    handleDelete,
    handleScheduleMeeting,
    // Navigation
    navigation,
  };
};

export default useChamaMeetingsScreen;
