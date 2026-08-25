import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { getThemeColors } from '../utils/theme';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import usePhysicalMeetingActions from './usePhysicalMeetingActions';

const usePhysicalMeetingScreen = ({ route, navigation }) => {
  const {
    meetingId,
    meetingTitle,
    userRole = 'member',
    isPreview = false,
    previewData = null,
    meetingData: initialMeetingData = null,
    chamaId,
    isReadOnly = false,
  } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  const [loading, setLoading] = useState(false);
  const [meetingData, setMeetingData] = useState(initialMeetingData);
  const [attendanceList, setAttendanceList] = useState([]);
  const [chamaMembers, setChamaMembers] = useState([]);
  const [memberAttendance, setMemberAttendance] = useState({});
  const [notes, setNotes] = useState('');
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [hasBackendSchemaIssue, setHasBackendSchemaIssue] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [notesInputHeight, setNotesInputHeight] = useState(120);

  const notesPanResponder = useRef(null);

  const [previousMeeting, setPreviousMeeting] = useState(null);
  const [previousMinutes, setPreviousMinutes] = useState(null);
  const [prevLoading, setPrevLoading] = useState(false);
  const [showPrevMinutes, setShowPrevMinutes] = useState(false);

  useEffect(() => {
    if (!hasLoadedData) {
      setHasLoadedData(true);
      loadMeetingData();
      loadChamaMembers();
      loadPersistedNotes();
      loadMeetingMinutes();
      loadAttendanceListSafely();
      loadMeetingDocuments();
    }
  }, [hasLoadedData]);

  const loadPersistedNotes = async () => {
    try {
      const savedNotes = await AsyncStorage.getItem(`meeting_notes_${meetingId}`);
      if (savedNotes !== null) {
        setNotes(savedNotes);
      }
    } catch (error) {
      console.error('Failed to load persisted notes:', error);
    }
  };

  const loadMeetingMinutes = async () => {
    try {
      const response = await api.getMeetingMinutes(meetingId);
      if (response?.success && response?.data?.content) {
        setNotes(response.data.content);
      }
    } catch (error) {
      console.error('Failed to load meeting minutes:', error);
    }
  };

  const loadAttendanceListSafely = async () => {
    if (hasBackendSchemaIssue) {
      return;
    }

    try {
      const response = await api.makeRequest(`/meetings/${meetingId}/attendance`);
      if (response.success && response.data) {
        setAttendanceList(response.data);
        const attendanceMap = {};
        response.data.forEach(attendance => {
          if (attendance.userId && attendance.isPresent) {
            attendanceMap[attendance.userId] = true;
          }
        });
        setMemberAttendance(prev => ({ ...prev, ...attendanceMap }));
      } else {
        setAttendanceList([]);
      }
    } catch (error) {
      console.error('Failed to load attendance list:', error);
      setAttendanceList([]);

      if (error.message.includes('converting NULL to string is unsupported')) {
        setHasBackendSchemaIssue(true);

        Toast.show({
          type: 'error',
          text1: 'Backend Database Issue Detected',
          text2: 'Attendance marking still works. List sync disabled until backend fix.',
          visibilityTime: 6000,
        });
      }
    }
  };

  const loadMeetingData = async () => {
    try {
      setLoading(true);
      const response = await api.makeRequest(`/meetings/${meetingId}`);
      if (response.success && response.data) {
        setMeetingData(response.data);
        try {
          await loadPreviousMeetingAndMinutes(response.data);
        } catch (e) {
          // Non-blocking
        }
      } else {
        if (initialMeetingData) {
          try {
            await loadPreviousMeetingAndMinutes(initialMeetingData);
          } catch (e) {}
        }
      }
    } catch (error) {
      console.error('Failed to load meeting data:', error);
      if (error.message && error.message.includes('404')) {
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load meeting details',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPreviousMeetingAndMinutes = async (current) => {
    try {
      if (!current) return;
      const currentChamaId = chamaId || current.chamaId;
      if (!currentChamaId) return;
      setPrevLoading(true);
      const listResp = await api.getMeetings(currentChamaId);
      if (listResp?.success && Array.isArray(listResp.data)) {
        const currentDate = new Date(current.scheduledAt || current.date || current.createdAt || Date.now());
        const previous = listResp.data
          .filter(m => new Date(m.scheduledAt || m.date || 0) < currentDate)
          .sort((a, b) => new Date(b.scheduledAt || b.date || 0) - new Date(a.scheduledAt || a.date || 0))[0];
        if (previous) {
          setPreviousMeeting(previous);
          try {
            const minutesResp = await api.getMeetingMinutes(previous.id);
            if (minutesResp?.success) {
              setPreviousMinutes(minutesResp.data);
            } else {
              setPreviousMinutes(null);
            }
          } catch (e) {
            setPreviousMinutes(null);
          }
        } else {
          setPreviousMeeting(null);
          setPreviousMinutes(null);
        }
      }
    } finally {
      setPrevLoading(false);
    }
  };

  const loadChamaMembers = async () => {
    try {
      const currentChamaId = chamaId || meetingData?.chamaId;
      if (!currentChamaId) {
        return;
      }

      const response = await api.makeRequest(`/chamas/${currentChamaId}/members`);
      if (response.success && response.data) {
        const activeMembers = (response.data || []).filter((m) => {
          const isActive = m?.is_active;
          return !(isActive === false || isActive === 0 || isActive === '0' || isActive === 'false');
        });
        setChamaMembers(activeMembers);

        const initialAttendance = {};
        activeMembers.forEach((member) => {
          const userId = member.user_id || member.id;
          initialAttendance[userId] = false;
        });
        setMemberAttendance(initialAttendance);
      } else {
        setChamaMembers([]);
        setMemberAttendance({});
      }
    } catch (error) {
      console.error('Failed to load chama members:', error);
      setChamaMembers([]);
      setMemberAttendance({});
    }
  };

  const loadAttendanceList = async () => {
    if (hasBackendSchemaIssue) {
      return;
    }
    try {
      const response = await api.makeRequest(`/meetings/${meetingId}/attendance`);
      if (response.success && response.data) {
        setAttendanceList(response.data);
        const attendanceMap = {};
        response.data.forEach(attendance => {
          if (attendance.userId && attendance.isPresent) {
            attendanceMap[attendance.userId] = true;
          }
        });
        setMemberAttendance(prev => ({ ...prev, ...attendanceMap }));
      } else {
        setAttendanceList([]);
      }
    } catch (error) {
      console.error('Failed to load attendance list:', error);
      setAttendanceList([]);

      if (error.message.includes('converting NULL to string is unsupported')) {
        setHasBackendSchemaIssue(true);
      } else if (!error.message?.includes('404')) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load attendance list',
        });
      }
    }
  };

  const loadMeetingDocuments = async () => {
    try {
      const response = await api.makeRequest(`/meetings/${meetingId}/documents`);
      if (response.success && response.data) {
        const documents = response.data || [];
        setUploadedDocuments(documents);
      } else {
        setUploadedDocuments([]);
      }
    } catch (error) {
      console.error('Failed to load meeting documents:', error);
      setUploadedDocuments([]);
    }
  };

  const canTakeNotes = !isReadOnly;
  const isChairperson = (userRole || '').toLowerCase() === 'chairperson';
  const canMarkAttendance = !isReadOnly;
  const canEndMeeting = !isReadOnly && isChairperson;
  const canUploadDocuments = canMarkAttendance;

  console.log('usePhysicalMeetingScreen computed permissions:', {
    userRole,
    canTakeNotes,
    canMarkAttendance,
    canEndMeeting,
    isReadOnly,
    meetingStatus: meetingData?.status,
  });

  const getStatusColor = (status) => {
    const statusLower = (status || '').toLowerCase();
    switch (statusLower) {
      case 'scheduled': return colors.primary;
      case 'in_progress':
      case 'ongoing':
      case 'started': return colors.success;
      case 'completed':
      case 'ended': return colors.textSecondary;
      case 'cancelled': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status) => {
    const statusLower = (status || '').toLowerCase();
    switch (statusLower) {
      case 'scheduled': return 'calendar';
      case 'in_progress':
      case 'ongoing':
      case 'started': return 'radio-button-on';
      case 'completed':
      case 'ended': return 'checkmark-circle';
      case 'cancelled': return 'close-circle';
      default: return 'ellipse';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const actions = usePhysicalMeetingActions({
    meetingId,
    meetingTitle,
    userRole,
    chamaId,
    navigation,
    notes,
    setNotes,
    memberAttendance,
    setMemberAttendance,
    chamaMembers,
    uploadedDocuments,
    setUploadedDocuments,
    isSaving,
    setIsSaving,
    hasBackendSchemaIssue,
    setHasBackendSchemaIssue,
    loadAttendanceList,
    loadMeetingDocuments,
    canTakeNotes,
    isChairperson,
    canMarkAttendance,
    canEndMeeting,
    canUploadDocuments,
    previousMeeting,
    previousMinutes,
    setPreviousMinutes,
    meetingData,
    loadMeetingData,
    isReadOnly,
  });

  const wrappedStartMeeting = async () => {
    if (!isReadOnly) {
      return actions.startMeeting(loadMeetingData);
    }
  };

  return {
    loading,
    meetingData,
    attendanceList,
    chamaMembers,
    memberAttendance,
    notes,
    setNotes,
    uploadedDocuments,
    isSaving,
    hasLoadedData,
    hasBackendSchemaIssue,
    notesExpanded,
    setNotesExpanded,
    previousMeeting,
    previousMinutes,
    prevLoading,
    showPrevMinutes,
    setShowPrevMinutes,
    isPreview,
    isReadOnly,
    loadMeetingData,
    loadChamaMembers,
    loadAttendanceList,
    loadMeetingDocuments,
    loadPersistedNotes,
    loadMeetingMinutes,
    loadAttendanceListSafely,
    canTakeNotes,
    isChairperson,
    canMarkAttendance,
    canEndMeeting,
    canUploadDocuments,
    getStatusColor,
    getStatusIcon,
    formatFileSize,
    colors,
    theme,
    meetingId,
    meetingTitle,
    userRole,
    chamaId,
    navigation,
    ...actions,
    startMeeting: wrappedStartMeeting,
  };
};

export default usePhysicalMeetingScreen;
