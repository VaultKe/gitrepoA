import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import ApiService from '../services/api';
import { toEAT, nowEAT } from '../utils/dateUtils';

// A meeting's start is whichever of these the record carries, and it runs for
// `duration` minutes from there. Everything that reasons about status goes
// through these two so the badge, the filter and the ordering can never
// disagree about when a meeting is.
const getMeetingStart = (meeting) => toEAT(meeting?.startTime || meeting?.scheduledAt || meeting?.date);

const getMeetingEnd = (meeting) => {
  const start = getMeetingStart(meeting);
  if (!start) return null;
  return new Date(start.getTime() + (meeting?.duration || 60) * 60000);
};

const getMeetingStatus = (meeting) => {
  const start = getMeetingStart(meeting);
  const end = getMeetingEnd(meeting);
  const now = nowEAT();
  const markedOver = ['completed', 'ended', 'cancelled'].includes(String(meeting?.status || '').toLowerCase());

  if (markedOver || (end && end <= now)) return 'ENDED';
  if (start && start <= now && end && end > now) return 'ONGOING';
  return 'SCHEDULED';
};

// What is happening now matters more than what is happening in March. Sorting
// purely by date let meetings scheduled months ahead fill the top of the
// table and push the live one out of sight.
const STATUS_ORDER = { ONGOING: 0, SCHEDULED: 1, ENDED: 2 };

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
      // Filtering off the same status the badge shows, so "Ongoing" can never
      // list a meeting whose row reads SCHEDULED.
      const wanted = filterStatus.toUpperCase();
      filtered = filtered.filter(m => getMeetingStatus(m) === wanted);
    }

    // Ongoing first, then what's coming up, then what's finished -- ordered
    // before paging so the grouping holds across the whole list rather than
    // just within the current page.
    const sorted = [...filtered].sort((a, b) => {
      const statusA = getMeetingStatus(a);
      const statusB = getMeetingStatus(b);
      if (STATUS_ORDER[statusA] !== STATUS_ORDER[statusB]) {
        return STATUS_ORDER[statusA] - STATUS_ORDER[statusB];
      }

      const timeA = getMeetingStart(a)?.getTime() ?? 0;
      const timeB = getMeetingStart(b)?.getTime() ?? 0;
      // Finished meetings read newest first; anything still to come reads
      // soonest first, so the next thing to join is always at the top.
      return statusA === 'ENDED' ? timeB - timeA : timeA - timeB;
    });

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = sorted.slice(startIndex, endIndex);

    return {
      meetings: paginated,
      totalCount: sorted.length,
      totalPages: Math.ceil(sorted.length / itemsPerPage),
    };
  };

  const getDynamicStatus = (meeting) => getMeetingStatus(meeting);

  const formatMeetingDate = (dateString) => {
    const eatDate = toEAT(dateString);
    if (!eatDate) return 'Invalid Date';
    const day = eatDate.getDate();
    const month = eatDate.toLocaleString('en-KE', { month: 'short', timeZone: 'Africa/Nairobi' });
    const year = eatDate.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const handleViewSummary = (meeting) => {
    if (!meeting) return;
    try {
      navigation.navigate('MeetingSummary', {
        meetingId: meeting.id,
        meetingData: meeting,
        chamaId: chamaId || meeting.chamaId,
        chamaName: chamaName || meeting.chamaName || 'Chama',
      });
    } catch (error) {
      console.error('Failed to view meeting summary:', error);
      Alert.alert('Navigation Error', `Failed to open meeting summary: ${error.message}`);
    }
  };

  const handleAttend = (meeting) => {
    try {
      console.log('Attend button pressed for meeting:', meeting?.id, meeting?.title, meeting);
      const meetingType = meeting?.meetingType || meeting?.type || 'virtual';
      const meetingTypeLower = String(meetingType).toLowerCase();
      const screenName = meetingTypeLower === 'virtual' || meetingTypeLower === 'hybrid' ? 'OnlineMeeting' : 'PhysicalMeeting';

      const meetingDate = toEAT(meeting?.startTime || meeting?.scheduledAt || meeting?.date);
      const now = nowEAT();
      const end = meetingDate ? new Date(meetingDate.getTime() + (meeting?.duration || 60) * 60000) : null;

      const statusLower = String(meeting?.status || '').toLowerCase();
      const isEnded = statusLower === 'completed' || statusLower === 'ended';

      const params = {
        meetingId: meeting?.id,
        meetingTitle: meeting?.title,
        userRole: userRole,
        meetingData: meeting,
        isReadOnly: isEnded,
      };

      // Every meeting type carries its chama now: the online meeting screen
      // sends it on join so the service can hold a chama to one live online
      // meeting at a time.
      params.chamaId = chamaId || meeting?.chamaId;

      console.log('Navigating to:', screenName, 'isEnded:', isEnded, 'status:', meeting?.status, 'params:', params);
      navigation.navigate(screenName, params);
    } catch (error) {
      console.error('Failed to attend meeting:', error);
      Alert.alert('Navigation Error', `Failed to open meeting: ${error.message}`);
    }
  };

  const handleDelete = (meeting) => {
    if (!meeting) return;
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
