import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import { toEAT, formatDate, nowEAT } from '../../../utils/dateUtils';
import Button from '../../../components/common/Button';
import ApiService from '../../../services/api';
import ChamaMeetingsTable from './ChamaMeetingsTable';

const ChamaMeetingsScreen = ({ route, navigation }) => {
  const { chamaId, chamaName, newMeeting, refresh, fromUserDashboard } = route.params || {};
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

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

  useEffect(() => {
    loadMeetings();
  }, [chamaId]);

  useEffect(() => {
    if (newMeeting && refresh) {
      loadMeetings();
      navigation.setParams({ newMeeting: null, refresh: false });
    }
  }, [newMeeting, refresh]);

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
    await loadMeetings();
    setRefreshing(false);
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'SCHEDULED': return colors.primary;
      case 'ONGOING': return colors.warning;
      case 'ENDED': return colors.success;
      case 'cancelled': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const formatMeetingDate = (dateString) => {
    const eatDate = toEAT(dateString);
    if (!eatDate) return 'Invalid Date';
    const day = eatDate.getDate();
    const month = eatDate.toLocaleString('en-KE', { month: 'short', timeZone: 'Africa/Nairobi' });
    const year = eatDate.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const renderTable = () => {
    const { meetings: filteredMeetings, totalCount, totalPages } = getFilteredMeetings();

    return (
      <ChamaMeetingsTable
        meetings={filteredMeetings}
        totalCount={totalCount}
        totalPages={totalPages}
        loading={loading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        renderEmptyState={renderEmptyState}
        formatMeetingDate={formatMeetingDate}
        getDynamicStatus={getDynamicStatus}
        getStatusColor={getStatusColor}
        onViewSummary={handleViewSummary}
        onAttend={handleAttend}
        onDelete={handleDelete}
      />
    );
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

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Meetings Found</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {isUserMeetingsView
          ? 'No meetings found from your chamas'
          : 'No meetings have been scheduled yet'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <View style={styles.tableControls}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Search meetings..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            style={[styles.filterButton, { borderColor: colors.border }]}
            onPress={() => setShowFilterDropdown(!showFilterDropdown)}
          >
            <Text style={[styles.filterButtonText, { color: colors.text }]}>
              {filterOptions.find(opt => opt.id === filterStatus)?.name || 'All'}
            </Text>
            <Ionicons name={showFilterDropdown ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {showFilterDropdown && (
        <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setShowFilterDropdown(false)} />
      )}

      {showFilterDropdown && (
        <View style={[styles.dropdownContainer, {
          position: 'absolute',
          top: 100,
          right: 20,
          zIndex: 10000,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.text,
        }]}>
          {filterOptions.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[styles.dropdownItem, filterStatus === filter.id && { backgroundColor: colors.primary }]}
              onPress={() => {
                setFilterStatus(filter.id);
                setShowFilterDropdown(false);
                setCurrentPage(1);
              }}
            >
              <Text style={[styles.dropdownItemText, { color: filterStatus === filter.id ? colors.white : colors.text }]}>
                {filter.name}
              </Text>
              {filterStatus === filter.id && (
                <Ionicons name="checkmark" size={14} color={colors.white} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ flex: 1 }}>
        {renderTable()}
      </View>

      {!isUserMeetingsView && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={handleScheduleMeeting}
        >
          <Ionicons name="add" size={24} color={colors.white} />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...shadows.sm },
  tableControls: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.md },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, height: 40 },
  searchIcon: { marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: typography.fontSize.base, paddingVertical: spacing.xs },
  filterButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minWidth: 100, justifyContent: 'space-between' },
  filterButtonText: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl },
  emptyTitle: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, marginTop: spacing.lg, marginBottom: spacing.sm },
  emptySubtitle: { fontSize: typography.fontSize.base, textAlign: 'center', marginBottom: spacing.xl },
  fab: { position: 'absolute', bottom: spacing.lg, right: spacing.lg, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', ...shadows.lg },
  dropdownOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 },
  dropdownContainer: { minWidth: 200, maxWidth: 250, borderRadius: borderRadius.md, borderWidth: 1, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 20 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, justifyContent: 'space-between' },
  dropdownItemText: { flex: 1, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium },
});

export default ChamaMeetingsScreen;
