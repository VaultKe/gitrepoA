import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useApp } from '../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../utils/theme';
import api from '../services/api';
import { meetingApi, setMeetingAuthToken } from '../services/meetingApi';
import { getAuthToken as getMainAuthToken } from '../services/api/auth';
import Toast from 'react-native-toast-message';

const isOnlineMeeting = (meeting) =>
  ['virtual', 'hybrid', 'online'].includes(String(meeting?.meetingType || meeting?.type || '').toLowerCase());

// An online meeting's attendance is held by the meeting service, which is what
// the meeting room itself reports and so the only accurate record of who was
// actually there. The chama's main API only knows about attendance that was
// marked for a physical meeting, so for a virtual one it comes back empty --
// which is why these summaries showed nobody present.
const buildOnlineAttendance = (attendanceResponse, members) => {
  const attendees = attendanceResponse?.attendees || [];
  const attendedIds = new Set(attendees.map(a => a.userId).filter(Boolean));

  const present = attendees.map((entry, index) => ({
    id: entry.userId || `online-attendee-${index}`,
    userId: entry.userId,
    userName: entry.displayName || entry.name || '',
    isPresent: true,
    attendanceType: 'Online',
    joinedAt: entry.joinedAt,
  }));

  // Anyone still on the roster who never joined is absent. Members who have
  // since left the chama aren't counted against the meeting.
  const absent = (members || [])
    .filter(member => member.is_active !== false)
    .map((member) => {
      const userId = member.user_id || member.userId || member.user?.id;
      const fullName = `${member.user?.first_name || member.first_name || ''} ${member.user?.last_name || member.last_name || ''}`.trim();
      return {
        id: userId || `online-absentee-${fullName}`,
        userId,
        userName: fullName || member.name || member.displayName || '',
        isPresent: false,
        attendanceType: 'Online',
      };
    })
    .filter(member => member.userId && !attendedIds.has(member.userId));

  return [...present, ...absent];
};

const createTableStyles = (colors, spacing, typography, shadows) => ({
  tableContainer: { flex: 1 },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  nameCell: { flex: 2, alignItems: 'flex-start' },
  statusCell: { flex: 1.5 },
  tableHeaderText: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    fontSize: 12,
    textAlign: 'center',
  },
  tableCellText: {
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  nameText: {
    fontWeight: typography.fontWeight.medium,
    textAlign: 'left',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 2,
  },
});

const useMeetingSummaryScreen = ({ route, navigation }) => {
  const { meetingId, meetingData, chamaId, chamaName, fromUserDashboard, showAllMeetings } = route.params || {};
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const tableStyles = createTableStyles(colors, spacing, typography, shadows);

  const isHistoryMode = fromUserDashboard && showAllMeetings;

  const [loading, setLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [meetingDetails, setMeetingDetails] = useState(meetingData || null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [allAttendanceData, setAllAttendanceData] = useState([]);
  const [meetingMinutes, setMeetingMinutes] = useState(null);
  const [meetingDocuments, setMeetingDocuments] = useState([]);
  const [chamaMembers, setChamaMembers] = useState([]);
  const [allMeetings, setAllMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [downloadingDocId, setDownloadingDocId] = useState(null);

  console.log('MeetingSummaryScreen state init:', { meetingId, chamaId, hasMeetingData: !!meetingData, isHistoryMode });

  const [attendancePage, setAttendancePage] = useState(1);
  const [totalAttendancePages, setTotalAttendancePages] = useState(1);
  const [totalAttendanceItems, setTotalAttendanceItems] = useState(0);
  const attendancePageSize = 10;

  const handleDocumentPress = async (document) => {
    if (!document || !document.url) {
      Toast.show({ type: 'info', text1: 'Document URL Missing' });
      return;
    }

    try {
      let fileUrl;
      if (document.url.startsWith('http')) {
        fileUrl = document.url;
      } else {
        const baseUrl = api.getApiBaseUrl();
        if (!baseUrl) {
          throw new Error('API base URL is not configured');
        }
        const normalizedBaseUrl = baseUrl.replace('/api/v1', '').replace(/\/$/, '');
        const docUrl = document.url.startsWith('/') ? document.url : `/${document.url}`;
        fileUrl = `${normalizedBaseUrl}${docUrl}`;
      }

      const fileName = document.name || fileUrl.split('/').pop() || 'document';
      if (Platform.OS === 'web') {
        window.open(fileUrl, '_blank');
        Toast.show({
          type: 'success',
          text1: 'Document Opened',
          text2: 'Document opened in new tab.',
        });
      } else {
        if (downloadingDocId) return;
        setDownloadingDocId(document.id);

        try {
          const localUri = FileSystem.documentDirectory + fileName;
          Toast.show({ type: 'info', text1: 'Starting Download', text2: `Downloading ${fileName}...` });

          const { uri } = await FileSystem.downloadAsync(fileUrl, localUri);
          Toast.show({ type: 'success', text1: 'Download Complete', text2: `${fileName} saved.` });

          if (await Sharing.isAvailableAsync()) {
            Alert.alert('Open Document', `Would you like to open ${fileName}?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open', onPress: () => Sharing.shareAsync(uri) },
            ]);
          }
        } catch (downloadError) {
          console.error('Download failed:', downloadError);
          Toast.show({
            type: 'error',
            text1: 'Download Failed',
            text2: downloadError.message || 'Unable to download document'
          });
        } finally {
          setDownloadingDocId(null);
        }
      }
    } catch (error) {
      console.error('Document handling error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Unable to process document request'
      });
    }
  };

  const getRecorderName = useCallback((minutes) => {
    if (!minutes || !minutes.takenBy) {
      return 'Unknown';
    }

    if (minutes.takenByName && minutes.takenByName.length < 30 && !minutes.takenByName.includes('-')) {
      return minutes.takenByName;
    }

    const member = chamaMembers.find(m =>
      m.user_id === minutes.takenBy ||
      m.id === minutes.takenBy ||
      m.userId === minutes.takenBy
    );

    if (member) {
      const name = member.name ||
                   member.user_name ||
                   member.username ||
                   member.displayName ||
                   member.user?.name ||
                   member.user?.username ||
                   member.user?.user_name ||
                   `${member.first_name || member.user?.first_name || ''} ${member.last_name || member.user?.last_name || ''}`.trim() ||
                   member.user?.email?.split('@')[0];

      if (name && name !== ' ') {
        return name;
      }
    }

    return `Member ${minutes.takenBy.slice(-4)}`;
  }, [chamaMembers]);

  const getAttendeeName = useCallback((attendance) => {
    const providedName = attendance.userName || attendance.user_name;
    if (providedName && providedName.length < 30 && !providedName.includes('-')) {
      return providedName;
    }

    const member = chamaMembers.find(m =>
      m.user_id === attendance.userId ||
      m.id === attendance.userId ||
      m.userId === attendance.userId
    );

    if (member) {
      const name = member.name ||
                   member.user_name ||
                   member.username ||
                   member.displayName ||
                   member.user?.name ||
                   member.user?.username ||
                   member.user?.user_name ||
                   `${member.first_name || member.user?.first_name || ''} ${member.last_name || member.user?.last_name || ''}`.trim() ||
                   member.user?.email?.split('@')[0];

      if (name && name !== ' ') {
        return name;
      }
    }

    return `Member ${attendance.userId?.slice(-4) || 'Unknown'}`;
  }, [chamaMembers]);

  const loadMeetingHistory = async () => {
    try {
      setLoading(true);
      const response = await api.getUserMeetings(100, 0);
      if (response.success && response.data) {
        const completedMeetings = response.data.filter(meeting =>
          meeting.status === 'completed' || meeting.status === 'ended'
        );
        completedMeetings.sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));
        setAllMeetings(completedMeetings);

        if (completedMeetings.length > 0) {
          const firstMeeting = completedMeetings[0];
          setSelectedMeeting(firstMeeting);
          setMeetingDetails(firstMeeting);
          if (firstMeeting.chamaId) {
            await loadChamaMembers(firstMeeting.chamaId);
          }
          await loadMeetingSummaryData();
        }
      } else {
        setAllMeetings([]);
      }
    } catch (error) {
      console.error('Failed to load meeting history:', error);
      setAllMeetings([]);
    } finally {
      setLoading(false);
      setDataReady(true);
    }
  };

  useEffect(() => {
    console.log('MeetingSummaryScreen useEffect:', { meetingId, isHistoryMode, hasMeetingData: !!meetingData, chamaId });
    if (isHistoryMode) {
      console.log('Running loadMeetingHistory');
      loadMeetingHistory();
    } else {
      if (chamaId) {
        loadChamaMembers();
      }
      if (meetingId && !meetingData) {
        loadMeetingSummaryData();
      } else if (meetingData) {
        setMeetingDetails(meetingData);
        setLoading(false);
        setDataReady(true);
        if (meetingId) {
          loadMeetingSummaryData();
        }
      } else {
        setLoading(false);
        setDataReady(true);
      }
    }
  }, [meetingId, isHistoryMode]);

  useEffect(() => {
    if (meetingData && !meetingDetails) {
      console.log('MeetingSummaryScreen: meetingData arrived after mount, updating meetingDetails');
      setMeetingDetails(meetingData);
      setLoading(false);
      setDataReady(true);
    }
  }, [meetingData]);

  useEffect(() => {
    if (allAttendanceData.length > 0) {
      const startIndex = (attendancePage - 1) * attendancePageSize;
      const endIndex = startIndex + attendancePageSize;
      setAttendanceData(allAttendanceData.slice(startIndex, endIndex));
    }
  }, [attendancePage, allAttendanceData]);

  const loadChamaMembers = async () => {
    try {
      const response = await api.getChamaMembers(chamaId);
      if (response.success && response.data) {
        setChamaMembers(response.data);
      } else {
        setChamaMembers([]);
      }
    } catch (error) {
      console.error('Failed to load chama members:', error);
      setChamaMembers([]);
    }
  };

  const loadMeetingSummaryData = async () => {
    console.log('loadMeetingSummaryData called with:', { meetingId, chamaId, hasMeetingData: !!meetingData });
    try {
      setLoading(true);
      const summaryPromises = [
        api.getMeetingDetails(meetingId),
        api.getMeetingAttendance(meetingId),
        api.getMeetingMinutes(meetingId),
        api.getMeetingDocuments(meetingId),
      ];

      if (chamaId) {
        summaryPromises.push(api.getChamaMembers(chamaId));
      }

      const results = await Promise.allSettled(summaryPromises);

      const [
        detailsResult,
        attendanceResult,
        minutesResult,
        documentsResult,
        membersResult,
      ] = results;

      if (detailsResult.status === 'fulfilled' && detailsResult.value.success && detailsResult.value.data) {
        setMeetingDetails(detailsResult.value.data);
      } else if (!meetingData) {
        console.warn('Failed to load meeting details from API:', detailsResult.status === 'fulfilled' ? detailsResult.value : detailsResult.reason);
      }

      const resolvedMeeting =
        (detailsResult.status === 'fulfilled' && detailsResult.value?.data) || meetingData || meetingDetails;
      const members =
        (membersResult && membersResult.status === 'fulfilled' && membersResult.value?.data) || chamaMembers || [];

      let attendance =
        attendanceResult.status === 'fulfilled' && attendanceResult.value.success
          ? attendanceResult.value.data || []
          : [];

      if (!attendance.length && isOnlineMeeting(resolvedMeeting)) {
        // Fall back to the meeting service's own record of who joined the
        // room -- the same data the meeting screen shows once it has ended.
        try {
          const token = await getMainAuthToken();
          if (token) await setMeetingAuthToken(token);
          const onlineAttendance = await meetingApi.getAttendance(meetingId);
          attendance = buildOnlineAttendance(onlineAttendance, members);
        } catch (error) {
          console.warn('Online attendance load failed:', error?.message || error);
        }
      }

      if (attendance.length || attendanceResult.status === 'fulfilled') {
        setAllAttendanceData(attendance);
        setTotalAttendanceItems(attendance.length);
        setTotalAttendancePages(Math.max(1, Math.ceil(attendance.length / attendancePageSize)));
        setAttendanceData(attendance.slice(0, attendancePageSize));
        setAttendancePage(1);
      } else {
        console.warn('Attendance load failed:', attendanceResult.status === 'fulfilled' ? attendanceResult.value : attendanceResult.reason);
      }
      if (minutesResult.status === 'fulfilled' && minutesResult.value.success) {
        setMeetingMinutes(minutesResult.value.data);
      } else {
        console.warn('Minutes load failed:', minutesResult.status === 'fulfilled' ? minutesResult.value : minutesResult.reason);
      }
      if (documentsResult.status === 'fulfilled' && documentsResult.value.success) {
        setMeetingDocuments(documentsResult.value.data || []);
      } else {
        console.warn('Documents load failed:', documentsResult.status === 'fulfilled' ? documentsResult.value : documentsResult.reason);
      }
      if (membersResult && membersResult.status === 'fulfilled' && membersResult.value.success) {
        setChamaMembers(membersResult.value.data || []);
      } else if (membersResult) {
        console.warn('Members load failed:', membersResult.status === 'fulfilled' ? membersResult.value : membersResult.reason);
      }
    } catch (error) {
      console.error('Failed to load meeting summary data:', error);
      if (!meetingData) {
        Toast.show({ type: 'error', text1: 'Failed to Load Meeting Data' });
      }
    } finally {
      setLoading(false);
      setDataReady(true);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadMeetingSummaryData();
    } catch (error) {
      console.warn('Meeting summary refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const formatTime = (dateString) => {
    try {
      return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return 'Invalid Time';
    }
  };

  const getMeetingTypeIcon = (type) => {
    switch (type) {
      case 'virtual': return 'videocam';
      case 'physical': return 'location';
      case 'hybrid': return 'globe';
      default: return 'calendar';
    }
  };

  // Counts the whole attendance record, not the page of it currently on
  // screen. This used to read `attendanceData`, which is the paginated slice
  // -- so a chama with more than ten members could never report more than ten
  // present, and the rate was wrong by however much the rest of the list held.
  const getAttendanceStats = useCallback(() => {
    const records = Array.isArray(allAttendanceData) ? allAttendanceData : [];
    const present = records.filter(att => att && att.isPresent).length;

    // The roster is the truth about how many people *could* attend. Falling
    // back to the attendance rows only matters when members haven't loaded,
    // and those rows already cover everyone who was invited.
    const totalMembers = chamaMembers.length || records.length;
    const absent = Math.max(0, totalMembers - present);

    return { present, absent, total: totalMembers };
  }, [chamaMembers.length, allAttendanceData]);

  return {
    isHistoryMode,
    loading,
    dataReady,
    refreshing,
    meetingDetails,
    attendanceData,
    allAttendanceData,
    meetingMinutes,
    meetingDocuments,
    chamaMembers,
    allMeetings,
    selectedMeeting,
    downloadingDocId,
    attendancePage,
    totalAttendancePages,
    totalAttendanceItems,
    colors,
    tableStyles,
    handleDocumentPress,
    getRecorderName,
    getAttendeeName,
    loadMeetingSummaryData,
    loadChamaMembers,
    onRefresh,
    formatDate,
    formatTime,
    getMeetingTypeIcon,
    getAttendanceStats,
    setAttendancePage,
  };
};

export default useMeetingSummaryScreen;
