import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  PanResponder,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useApp } from '../../../context/AppContext';
import { getThemeColors } from '../../../utils/theme';
import api from '../../../services/api';
import Toast from 'react-native-toast-message';

const PhysicalMeetingScreen = ({ route, navigation }) => {
  const {
    meetingId,
    meetingTitle,
    userRole = 'member',
    isPreview = false,
    previewData = null,
    meetingData: initialMeetingData = null,
    chamaId
  } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  
  const [loading, setLoading] = useState(false);
  const [meetingData, setMeetingData] = useState(initialMeetingData);
  const [attendanceList, setAttendanceList] = useState([]);
  const [chamaMembers, setChamaMembers] = useState([]);
  const [memberAttendance, setMemberAttendance] = useState({}); // Track attendance status for each member
  const [notes, setNotes] = useState('');
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [hasBackendSchemaIssue, setHasBackendSchemaIssue] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [notesInputHeight, setNotesInputHeight] = useState(120);

  const notesPanResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // No continuous height update needed; using toggle on release
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dy) > 20) {
          setNotesExpanded(gestureState.dy < 0);
        }
      },
    })
  ).current;
  // Previous meeting/minutes state
  const [previousMeeting, setPreviousMeeting] = useState(null);
  const [previousMinutes, setPreviousMinutes] = useState(null);
  const [prevLoading, setPrevLoading] = useState(false);
  const [showPrevMinutes, setShowPrevMinutes] = useState(false);

  useEffect(() => {
    if (!hasLoadedData) {
      console.log('🏢 Loading PhysicalMeetingScreen data for the first time...');
      setHasLoadedData(true);
      loadMeetingData();
      loadChamaMembers();
      loadPersistedNotes();
      loadMeetingMinutes();

      // Try to load attendance list, but handle schema issues gracefully
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

  // Load existing meeting minutes for this meeting
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

  // Safe wrapper for loading attendance list
  const loadAttendanceListSafely = async () => {
    if (hasBackendSchemaIssue) {
      console.log('🔧 SKIPPING attendance list load - backend schema issue already detected');
      return;
    }

    console.log('📋 Attempting to load attendance list...');

    try {
      const response = await api.makeRequest(`/meetings/${meetingId}/attendance`);
      if (response.success && response.data) {
        setAttendanceList(response.data);
        console.log('📋 Loaded attendance list:', response.data.length, 'attendees');

        // Update memberAttendance state based on existing attendance records
        const attendanceMap = {};
        response.data.forEach(attendance => {
          if (attendance.userId && attendance.isPresent) {
            attendanceMap[attendance.userId] = true;
          }
        });
        setMemberAttendance(prev => ({ ...prev, ...attendanceMap }));
      } else {
        // console.log('📝 No attendance data available yet');
        setAttendanceList([]);
      }
    } catch (error) {
      console.error('❌ Failed to load attendance list:', error);
      setAttendanceList([]);

      // Handle specific database schema error
      if (error.message.includes('converting NULL to string is unsupported')) {
        console.log('🔧 BACKEND SCHEMA ISSUE DETECTED - Disabling future attendance list loads.');
        console.log('🔧 Attendance marking will still work, but list sync is disabled until backend is fixed.');
        setHasBackendSchemaIssue(true);

        // Show helpful message only once
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
        // After we have current meeting data, try to load previous meeting minutes
        try {
          await loadPreviousMeetingAndMinutes(response.data);
        } catch (e) {
          // Non-blocking
        }
      } else {
        // Use initial meeting data if API call fails
        console.log('📊 Using initial meeting data from navigation params');
        if (initialMeetingData) {
          try {
            await loadPreviousMeetingAndMinutes(initialMeetingData);
          } catch (e) {}
        }
      }
    } catch (error) {
      console.error('Failed to load meeting data:', error);
      // Don't show error toast for 404s - just use initial data
      if (error.message && error.message.includes('404')) {
        console.log('📊 Meeting endpoint not found (404), using initial data');
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

  // Load previous meeting for this chama and its minutes
  const loadPreviousMeetingAndMinutes = async (current) => {
    try {
      if (!current) return;
      const currentChamaId = chamaId || current.chamaId;
      if (!currentChamaId) return;
      setPrevLoading(true);
      // Fetch meetings for chama and pick the most recent strictly before current
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
        console.log('👥 No chamaId available, cannot load chama members');
        return;
      }

      const response = await api.makeRequest(`/chamas/${currentChamaId}/members`);
      if (response.success && response.data) {
        const members = response.data || [];
        console.log('👥 Loaded chama members:', members.length);
        setChamaMembers(members);

        // Initialize attendance tracking for all members
        const initialAttendance = {};
        members.forEach(member => {
          const userId = member.user_id || member.id;
          initialAttendance[userId] = false; // Default to not present
        });
        setMemberAttendance(initialAttendance);
      } else {
        console.log('👥 No chama members data received');
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
    // Don't make API call if we know there's a backend schema issue
    if (hasBackendSchemaIssue) {
      console.log('🔧 SKIPPING attendance list refresh - backend schema issue already detected');
      return;
    }

    console.log('📋 Attempting to refresh attendance list...');

    try {
      const response = await api.makeRequest(`/meetings/${meetingId}/attendance`);
      if (response.success && response.data) {
        setAttendanceList(response.data);
        console.log('📋 Loaded attendance list:', response.data.length, 'attendees');

        // Update memberAttendance state based on existing attendance records
        const attendanceMap = {};
        response.data.forEach(attendance => {
          if (attendance.userId && attendance.isPresent) {
            attendanceMap[attendance.userId] = true;
          }
        });
        setMemberAttendance(prev => ({ ...prev, ...attendanceMap }));
      } else {
        // console.log('📝 No attendance data available yet');
        setAttendanceList([]);
      }
    } catch (error) {
      console.error('Failed to load attendance list:', error);
      setAttendanceList([]);

      // Handle specific database schema error
      if (error.message.includes('converting NULL to string is unsupported')) {
        console.log('🔧 Backend database schema issue detected. Disabling future calls.');
        setHasBackendSchemaIssue(true);
      } else if (!error.message?.includes('404')) {
        // Show error for other unexpected issues
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
        console.log('📄 Loaded meeting documents:', documents.length);
        setUploadedDocuments(documents);
      } else {
        console.log('📄 No meeting documents found');
        setUploadedDocuments([]);
      }
    } catch (error) {
      console.error('Failed to load meeting documents:', error);
      setUploadedDocuments([]);
    }
  };



  // Authorized users (chairperson, treasurer, secretary) can toggle member attendance
  const toggleMemberAttendance = async (userId) => {
    if (!canMarkAttendance) {
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'Only chairperson, treasurer, or secretary can mark attendance',
      });
      return;
    }

    try {
      const currentStatus = memberAttendance[userId] || false;
      const newStatus = !currentStatus;

      // Update local state immediately for UI responsiveness
      setMemberAttendance(prev => ({
        ...prev,
        [userId]: newStatus
      }));

      // Save to backend immediately
      const response = await api.makeRequest(`/meetings/${meetingId}/attendance`, {
        method: 'POST',
        body: {
          userId: userId,
          attendanceType: 'physical',
          isPresent: newStatus,
        },
      });

      if (response.success) {
        console.log(`✅ Attendance updated for user ${userId}: ${newStatus ? 'Present' : 'Absent'}`);

        // Show subtle feedback
        Toast.show({
          type: 'success',
          text1: newStatus ? 'Marked Present' : 'Marked Absent',
          text2: `Attendance updated for member`,
          visibilityTime: 2000,
        });

        // Try to refresh attendance list, but don't fail if backend has issues
        if (!hasBackendSchemaIssue) {
          try {
            await loadAttendanceList();
          } catch (refreshError) {
            console.log('⚠️ Could not refresh attendance list, but attendance was saved:', refreshError.message);

            // If it's the database schema issue, don't keep trying to refresh
            if (refreshError.message.includes('converting NULL to string is unsupported')) {
              console.log('🔧 Detected backend schema issue, disabling future attendance list refreshes');
              setHasBackendSchemaIssue(true);
            }
            // Don't show error to user since the main action (marking attendance) succeeded
          }
        } else {
          console.log('🔧 Skipping attendance list refresh due to known backend schema issue');
        }
      } else {
        // Revert local state if backend save failed
        setMemberAttendance(prev => ({
          ...prev,
          [userId]: currentStatus
        }));

        Toast.show({
          type: 'error',
          text1: 'Save Failed',
          text2: 'Failed to save attendance. Please try again.',
        });
      }
    } catch (error) {
      console.error('Failed to update attendance:', error);

      // Revert local state on error
      const currentStatus = memberAttendance[userId] || false;
      setMemberAttendance(prev => ({
        ...prev,
        [userId]: currentStatus
      }));

      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: 'Failed to update attendance. Please check your connection.',
      });
    }
  };

  // Save meeting data including attendance
  const saveMeetingData = async () => {
    try {
      setIsSaving(true);
      let savedItems = [];

      // Since attendance is now saved immediately when marked,
      // we just need to ensure all current attendance is synced
      console.log('💾 Syncing final attendance data...');

      // Get all present members
      const presentMembers = Object.entries(memberAttendance)
        .filter(([, isPresent]) => isPresent)
        .map(([userId]) => userId);

      // Sync attendance for all members (present and absent)
      const attendancePromises = chamaMembers.map(async (member) => {
        const userId = member.user_id || member.id;
        const isPresent = memberAttendance[userId] || false;

        try {
          return await api.makeRequest(`/meetings/${meetingId}/attendance`, {
            method: 'POST',
            body: {
              userId: userId,
              attendanceType: 'physical',
              isPresent: isPresent,
            },
          });
        } catch (error) {
          console.log(`⚠️ Failed to sync attendance for user ${userId}:`, error.message);
          return null; // Don't fail the entire operation
        }
      });

      const attendanceResults = await Promise.all(attendancePromises);
      const successfulSaves = attendanceResults.filter(result => result !== null).length;

      if (successfulSaves > 0) {
        savedItems.push(`attendance (${successfulSaves}/${chamaMembers.length} members)`);
      }

      // Save meeting notes if any
      if (notes.trim() && canTakeNotes) {
        await api.makeRequest(`/meetings/${meetingId}/minutes`, {
          method: 'POST',
          body: {
            content: notes.trim(),
            status: 'draft',
            meetingId: meetingId,
            authorRole: userRole,
          },
        });
        savedItems.push('notes');
      }

      // Try to update meeting status (may fail if endpoint doesn't exist)
      try {
        await api.makeRequest(`/meetings/${meetingId}`, {
          method: 'PATCH',
          body: {
            status: 'completed', // Minimal payload to avoid schema issues
          },
        });
        savedItems.push('meeting status');
      } catch (statusError) {
        console.log('⚠️ Could not update meeting status (endpoint may not exist):', statusError.message);
        // Don't fail the entire save operation for this
      }

      Toast.show({
        type: 'success',
        text1: 'Meeting Data Saved',
        text2: `Successfully saved: ${savedItems.join(', ')}`,
      });

      // Refresh all data
      await Promise.all([
        loadAttendanceList(),
        loadMeetingDocuments(),
      ]);

    } catch (error) {
      console.error('Failed to save meeting data:', error);
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: 'Failed to save meeting data. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Removed unused exit functions - only Save and Save & Exit buttons are needed

  // Instant save and exit function (no confirmation)
  const instantSaveAndExit = async () => {
    try {
      setIsSaving(true);
      await saveMeetingData();

      Toast.show({
        type: 'success',
        text1: 'Meeting Saved',
        text2: 'Attendance and meeting data saved successfully',
      });

      // Exit immediately after saving
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save and exit:', error);
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: 'Failed to save meeting data. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };



   const uploadDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const document = result.assets[0];

        const uploadToast = Toast.show({
          type: 'info',
          text1: 'Uploading',
          text2: `Uploading ${document.name}...`,
          visibilityTime: 0,
        });

        try {
          const formData = new FormData();

          console.log('📄 Document details:', {
            uri: document.uri,
            type: document.mimeType,
            name: document.name,
            size: document.size,
          });

          let fileToUpload;
          if (document.uri.startsWith('data:')) {
            const response = await fetch(document.uri);
            const blob = await response.blob();
            fileToUpload = new File([blob], document.name, { type: document.mimeType });
          } else {
            fileToUpload = {
              uri: document.uri,
              type: document.mimeType,
              name: document.name,
            };
          }

          formData.append('file', fileToUpload);
          formData.append('meetingId', meetingId);
          formData.append('documentType', 'meeting_document');
          formData.append('description', `Document uploaded during physical meeting: ${meetingTitle}`);

          console.log('📄 FormData created, about to upload...');

          const response = await api.makeRequest(`/meetings/${meetingId}/documents`, {
            method: 'POST',
            body: formData,
          });

          Toast.hide(uploadToast);

          if (response.success) {
            const newDoc = {
              id: response.data.id || Date.now().toString(),
              name: document.name,
              size: document.size,
              type: document.mimeType,
              uri: document.uri,
              uploadedAt: new Date().toISOString(),
              url: response.data.url,
            };

            setUploadedDocuments(prev => [...prev, newDoc]);

            Toast.show({
              type: 'success',
              text1: 'Document Uploaded',
              text2: `${document.name} has been uploaded to the meeting`,
            });
          } else {
            throw new Error(response.error || 'Upload failed');
          }
        } catch (uploadError) {
          Toast.hide(uploadToast);
          console.error('Failed to upload document:', uploadError);
          Toast.show({
            type: 'error',
            text1: 'Upload Failed',
            text2: uploadError.message || 'Failed to upload document to server',
          });
        }
      }
    } catch (error) {
      console.error('Failed to pick or upload document:', error);
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: error.message || 'Failed to process document',
      });
    }
  };

  const removeDocument = (docId) => {
    Alert.alert(
      'Remove Document',
      'Are you sure you want to remove this document?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove from backend first
              const response = await api.makeRequest(`/meetings/${meetingId}/documents/${docId}`, {
                method: 'DELETE',
              });

              if (response.success) {
                // Remove from local state only if backend deletion succeeded
                setUploadedDocuments(prev => prev.filter(doc => doc.id !== docId));

                Toast.show({
                  type: 'success',
                  text1: 'Document Removed',
                  text2: 'Document has been deleted from the meeting',
                });
              } else {
                throw new Error(response.error || 'Failed to delete document');
              }
            } catch (error) {
              console.error('Failed to remove document:', error);
              Toast.show({
                type: 'error',
                text1: 'Delete Failed',
                text2: error.message || 'Failed to remove document from server',
              });
            }
          },
        },
      ]
    );
  };

  const saveNotes = async () => {
    if (!notes.trim()) {
      Toast.show({
        type: 'error',
        text1: 'No Notes',
        text2: 'Please enter some notes before saving',
      });
      return;
    }

    try {
      // Save notes to backend
      const response = await api.makeRequest(`/meetings/${meetingId}/minutes`, {
        method: 'POST',
        body: {
          content: notes.trim(),
          status: 'draft',
          meetingId: meetingId,
          authorRole: userRole,
        },
      });

      // Always persist to AsyncStorage regardless of backend success
      try {
        await AsyncStorage.setItem(`meeting_notes_${meetingId}`, notes);
      } catch (storageError) {
        console.error('Failed to persist notes to storage:', storageError);
      }

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Notes Saved',
          text2: 'Meeting notes have been saved to the database',
        });
      } else {
        Toast.show({
          type: 'success',
          text1: 'Notes Saved Locally',
          text2: 'Notes saved locally. Will sync when connection is available.',
        });
      }
    } catch (error) {
      console.error('Failed to save notes:', error);
      // Still try to save locally
      try {
        await AsyncStorage.setItem(`meeting_notes_${meetingId}`, notes);
      } catch (storageError) {
        console.error('Failed to persist notes to storage:', storageError);
      }
      Toast.show({
        type: 'success',
        text1: 'Notes Saved Locally',
        text2: 'Notes saved locally. Will sync when connection is available.',
      });
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Define role-based permissions at the top
  const canTakeNotes = userRole === 'secretary' || userRole === 'chairperson';
  const isChairperson = (userRole || '').toLowerCase() === 'chairperson';
  const canMarkAttendance = ['chairperson', 'treasurer', 'secretary'].includes(userRole.toLowerCase());
  const canEndMeeting = isChairperson;
  const canUploadDocuments = canMarkAttendance; // Same permissions as attendance marking

  // Helper functions for status display
  const getStatusColor = (status) => {
    const statusLower = (status || '').toLowerCase();
    switch (statusLower) {
      case 'scheduled':
        return colors.primary;
      case 'in_progress':
      case 'ongoing':
      case 'started':
        return colors.success;
      case 'completed':
      case 'ended':
        return colors.textSecondary;
      case 'cancelled':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusIcon = (status) => {
    const statusLower = (status || '').toLowerCase();
    switch (statusLower) {
      case 'scheduled':
        return 'calendar';
      case 'in_progress':
      case 'ongoing':
      case 'started':
        return 'radio-button-on';
      case 'completed':
      case 'ended':
        return 'checkmark-circle';
      case 'cancelled':
        return 'close-circle';
      default:
        return 'ellipse';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading meeting details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Meeting Header */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          {isPreview && (
            <View style={[styles.previewBadge, { backgroundColor: colors.warning + '20' }]}>
              <Ionicons name="eye" size={16} color={colors.warning} />
              <Text style={[styles.previewText, { color: colors.warning }]}>
                PREVIEW MODE
              </Text>
            </View>
          )}
          <Text style={[styles.meetingTitle, { color: colors.text }]}>
            {meetingTitle}
          </Text>
          <Text style={[styles.meetingType, { color: colors.textSecondary }]}>
            Physical Meeting
          </Text>

          {/* Meeting Status Indicator */}
          {meetingData?.status && (
            <View style={[styles.statusIndicator, {
              backgroundColor: getStatusColor(meetingData.status) + '20'
            }]}>
              <Ionicons
                name={getStatusIcon(meetingData.status)}
                size={16}
                color={getStatusColor(meetingData.status)}
              />
              <Text style={[styles.statusText, {
                color: getStatusColor(meetingData.status)
              }]}>
                {meetingData.status.toUpperCase()}
              </Text>
            </View>
          )}
          {meetingData?.location && (
            <View style={styles.locationContainer}>
              <Ionicons name="location" size={16} color={colors.primary} />
              <Text style={[styles.locationText, { color: colors.textSecondary }]}>
                {meetingData.location}
              </Text>
            </View>
          )}
        </View>

        {/* Previous Meeting Minutes Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.prevHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Previous Meeting Minutes</Text>
            {prevLoading && (
              <ActivityIndicator size="small" color={colors.primary} />
            )}
          </View>
          {previousMeeting ? (
            <>
              <Text style={[styles.prevMeta, { color: colors.textSecondary }]}>
                {`Last meeting: ${new Date(previousMeeting.scheduledAt || previousMeeting.date).toLocaleString()}`}
              </Text>
              {previousMinutes ? (
                <>
                  <TouchableOpacity
                    style={[styles.prevToggle, { borderColor: colors.border }]}
                    onPress={() => setShowPrevMinutes(!showPrevMinutes)}
                  >
                    <Ionicons name={showPrevMinutes ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text} />
                    <Text style={[styles.prevToggleText, { color: colors.text }]}>View last minutes</Text>
                  </TouchableOpacity>

                  {showPrevMinutes && (
                    <View style={styles.prevContent}>
                      <Text style={[styles.prevStatus, { color: colors.textSecondary }]}>
                        {`Status: ${(previousMinutes.status || 'draft').toUpperCase()}`}
                      </Text>
                      <Text style={[styles.prevBody, { color: colors.text }]}>
                        {previousMinutes.content || 'No content available.'}
                      </Text>
                      {isChairperson && (previousMinutes.status || 'draft').toLowerCase() !== 'approved' && (
                        <TouchableOpacity
                          style={[styles.approveButton, { backgroundColor: colors.success }]}
                          onPress={async () => {
                            try {
                              const updated = await api.updateMeetingMinutes(previousMeeting.id, {
                                status: 'approved',
                              });
                              if (updated?.success) {
                                Toast.show({ type: 'success', text1: 'Minutes Approved', text2: 'Previous minutes have been approved.' });
                                // Refresh previous minutes
                                try {
                                  const minutesResp = await api.getMeetingMinutes(previousMeeting.id);
                                  if (minutesResp?.success) setPreviousMinutes(minutesResp.data);
                                } catch {}
                              } else {
                                throw new Error(updated?.error || 'Approval failed');
                              }
                            } catch (e) {
                              Toast.show({ type: 'error', text1: 'Approval Failed', text2: e.message || 'Could not approve minutes.' });
                            }
                          }}
                        >
                          <Ionicons name="checkmark-done" size={18} color={'white'} />
                          <Text style={styles.approveButtonText}>Approve Minutes</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </>
              ) : (
                <Text style={[styles.prevMeta, { color: colors.textSecondary }]}>No minutes found for the previous meeting.</Text>
              )}
            </>
          ) : (
            <Text style={[styles.prevMeta, { color: colors.textSecondary }]}>No previous meeting found.</Text>
          )}
        </View>

        {/* Attendance Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.attendanceHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Meeting Attendance
            </Text>
            {canMarkAttendance && (
              <Text style={[styles.attendanceSubtitle, { color: colors.textSecondary }]}>
                Mark members as present by tapping their names
              </Text>
            )}
          </View>

          {/* Member List for Attendance */}
          {chamaMembers.length > 0 ? (
            <ScrollView style={styles.membersList} nestedScrollEnabled>
              {chamaMembers.map((member) => {
                const userData = member.user || member;
                const userId = member.user_id || member.id;
                const firstName = userData.first_name || member.first_name || '';
                const lastName = userData.last_name || member.last_name || '';
                const fullName = `${firstName} ${lastName}`.trim();
                const displayName = fullName || userData.name || member.name || userData.email?.split('@')[0] || `Member ${userId?.slice(-4)}`;
                const isPresent = memberAttendance[userId] || false;
                const memberRole = member.role || 'Member';

                return (
                  <TouchableOpacity
                    key={userId}
                    style={[
                      styles.memberItem,
                      {
                        backgroundColor: isPresent ? colors.success + '15' : colors.background,
                        borderColor: isPresent ? colors.success : colors.border,
                        borderWidth: isPresent ? 2 : 1,
                        shadowColor: isPresent ? colors.success : 'transparent',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isPresent ? 0.3 : 0,
                        shadowRadius: isPresent ? 4 : 0,
                        elevation: isPresent ? 4 : 1,
                      }
                    ]}
                    onPress={() => toggleMemberAttendance(userId)}
                    disabled={!canMarkAttendance}
                  >
                    <View style={styles.memberInfo}>
                      <View style={[styles.memberAvatar, { backgroundColor: colors.primary + '20' }]}>
                        <Text style={[styles.memberAvatarText, { color: colors.primary }]}>
                          {firstName?.[0]?.toUpperCase() || 'M'}{lastName?.[0]?.toUpperCase() || ''}
                        </Text>
                      </View>
                      <View style={styles.memberDetails}>
                        <Text style={[styles.memberName, { color: colors.text }]}>
                          {displayName}
                        </Text>
                        <Text style={[styles.memberRole, { color: colors.textSecondary }]}>
                          {memberRole}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.attendanceStatus}>
                      {isPresent ? (
                        <View style={[styles.presentIndicator, { backgroundColor: colors.success + '20' }]}>
                          <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                          <Text style={[styles.presentText, { color: colors.success, fontWeight: '600' }]}>Present</Text>
                        </View>
                      ) : (
                        <View style={styles.absentIndicator}>
                          <Ionicons name="ellipse-outline" size={28} color={colors.textSecondary} />
                          <View>
                            <Text style={[styles.absentText, { color: colors.textSecondary }]}>Absent</Text>
                            {canMarkAttendance && (
                              <Text style={[styles.tapHint, { color: colors.primary, fontSize: 10 }]}>
                                Tap to mark present
                              </Text>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                Loading chama members...
              </Text>
            </View>
          )}

          {/* Attendance Summary */}
          {chamaMembers.length > 0 && (
            <View style={[styles.attendanceSummary, { backgroundColor: colors.background }]}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Members:</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{chamaMembers.length}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Present:</Text>
                <Text style={[styles.summaryValue, { color: colors.success }]}>
                  {Object.values(memberAttendance).filter(Boolean).length}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Absent:</Text>
                <Text style={[styles.summaryValue, { color: colors.error }]}>
                  {chamaMembers.length - Object.values(memberAttendance).filter(Boolean).length}
                </Text>
              </View>
            </View>
          )}
        </View>



        {/* Notes Section (for Secretary/Chairperson) */}
        {canTakeNotes && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Meeting Notes
            </Text>
            
            <View style={styles.notesWrapper}>
              <TextInput
                style={[
                  styles.notesInput,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Enter meeting notes, decisions, and action items..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={notesExpanded ? 15 : 8}
                value={notes}
                onChangeText={(text) => {
                  setNotes(text);
                  AsyncStorage.setItem(`meeting_notes_${meetingId}`, text).catch((err) =>
                    console.error('Failed to auto-save notes:', err),
                  );
                }}
                textAlignVertical="top"
              />
              <View
                style={styles.resizeHandle}
                {...notesPanResponder.panHandlers}
              >
                <View style={[styles.resizeHandleBar, { backgroundColor: colors.textSecondary }]} />
              </View>
            </View>
            
            <TouchableOpacity
              style={[styles.saveNotesButton, { backgroundColor: colors.primary }]}
              onPress={saveNotes}
            >
              <Ionicons name="save" size={20} color="white" />
              <Text style={styles.saveNotesText}>Save Notes</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Documents Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Documents
          </Text>
          
          <TouchableOpacity
            style={[styles.uploadButton, { borderColor: colors.primary }]}
            onPress={uploadDocument}
          >
            <Ionicons name="cloud-upload" size={24} color={colors.primary} />
            <Text style={[styles.uploadButtonText, { color: colors.primary }]}>
              Upload Document
            </Text>
          </TouchableOpacity>

          {uploadedDocuments.length > 0 && (
            <View style={styles.documentsList}>
              {uploadedDocuments.map((doc) => (
                <View key={doc.id} style={[styles.documentItem, { borderBottomColor: colors.border }]}>
                  <View style={styles.documentInfo}>
                    <Ionicons name="document" size={20} color={colors.primary} />
                    <View style={styles.documentDetails}>
                      <Text style={[styles.documentName, { color: colors.text }]} numberOfLines={1}>
                        {doc.name}
                      </Text>
                      <Text style={[styles.documentSize, { color: colors.textSecondary }]}>
                        {formatFileSize(doc.size)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.removeDocButton}
                    onPress={() => removeDocument(doc.id)}
                  >
                    <Ionicons name="trash" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionButtons, { backgroundColor: colors.surface }]}>
        {/* Show save button for authorized users */}
        {canMarkAttendance && (
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={saveMeetingData}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="save" size={20} color="white" />
            )}
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Instant Save & Exit button for authorized users */}
        {canMarkAttendance && (
          <TouchableOpacity
            style={[styles.instantSaveButton, { backgroundColor: colors.success }]}
            onPress={instantSaveAndExit}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="checkmark-done" size={20} color="white" />
            )}
            <Text style={styles.instantSaveButtonText}>
              {isSaving ? 'Saving...' : 'Save & Exit'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Start Meeting - Chairperson only (if not already started) */}
        {canEndMeeting && meetingData && !['in_progress', 'ongoing', 'started'].includes((meetingData.status || '').toLowerCase()) && (
          <TouchableOpacity
            style={[styles.startMeetingButton, { backgroundColor: colors.warning }]}
            onPress={async () => {
              try {
                const res = await api.startMeeting(meetingId);
                if (res?.success) {
                  Toast.show({ type: 'success', text1: 'Meeting Started', text2: 'The meeting is now active.' });
                  // Refresh meeting data
                  loadMeetingData();
                } else {
                  throw new Error(res?.error || 'Failed to start meeting');
                }
              } catch (e) {
                Toast.show({ type: 'error', text1: 'Start Meeting Failed', text2: e.message || 'Unable to start meeting.' });
              }
            }}
            disabled={isSaving}
          >
            <Ionicons name="play" size={20} color={'white'} />
            <Text style={styles.startMeetingButtonText}>Start Meeting</Text>
          </TouchableOpacity>
        )}

        {/* End Meeting Now - Chairperson only */}
        {canEndMeeting && (
          <TouchableOpacity
            style={[styles.endMeetingButton, { backgroundColor: colors.error }]}
            onPress={async () => {
              try {
                // Save current notes as draft first (non-blocking if empty)
                if (notes.trim()) {
                  try {
                    await api.makeRequest(`/meetings/${meetingId}/minutes`, {
                      method: 'POST',
                      body: {
                        content: notes.trim(),
                        status: 'draft',
                        meetingId: meetingId,
                        authorRole: userRole,
                      },
                    });
                  } catch {}
                }
                // Ensure meeting is active before ending (some backends require active state)
                try {
                  const status = (meetingData?.status || '').toLowerCase();
                  if (!(status === 'in_progress' || status === 'ongoing' || status === 'started')) {
                    await api.startMeeting(meetingId);
                  }
                } catch {}

                // Complete the meeting using dedicated endpoint
                const res = await api.endMeeting(meetingId);
                if (!res?.success) {
                  throw new Error(res?.error || 'Failed to end meeting. Ensure the meeting is active.');
                }
                Toast.show({ type: 'success', text1: 'Meeting Ended', text2: 'The meeting has been marked as completed.' });
                navigation.goBack();
              } catch (e) {
                Toast.show({ type: 'error', text1: 'End Meeting Failed', text2: e.message || 'Unable to end meeting.' });
              }
            }}
            disabled={isSaving}
          >
            <Ionicons name="stop" size={20} color={'white'} />
            <Text style={styles.endMeetingButtonText}>End Meeting Now</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  previewText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  meetingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  meetingType: {
    fontSize: 16,
    marginBottom: 12,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    marginLeft: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  prevHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  prevMeta: {
    fontSize: 12,
    marginBottom: 8,
  },
  prevToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  prevToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  prevContent: {
    marginTop: 12,
  },
  prevStatus: {
    fontSize: 12,
    marginBottom: 8,
  },
  prevBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  approveButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  approveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  attendanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
  },
  attendanceButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  attendanceMarked: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
  },
  attendanceMarkedText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  attendanceList: {
    marginTop: 20,
  },
  attendanceListTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  attendanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  attendeeName: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
  },
  attendanceTime: {
    fontSize: 12,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 120,
    marginBottom: 0,
  },
  notesWrapper: {
    marginBottom: 16,
  },
  resizeHandle: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: -8,
  },
  resizeHandleBar: {
    width: 60,
    height: 5,
    borderRadius: 3,
    opacity: 0.6,
  },
  saveNotesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  saveNotesText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  documentsList: {
    marginTop: 16,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  documentDetails: {
    marginLeft: 12,
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '500',
  },
  documentSize: {
    fontSize: 12,
    marginTop: 2,
  },
  removeDocButton: {
    padding: 8,
  },
  // New attendance styles
  attendanceHeader: {
    marginBottom: 16,
  },
  attendanceSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  membersList: {
    maxHeight: 300,
  },
  membersScroll: {
    flex: 1,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
  },
  memberRole: {
    fontSize: 12,
    marginTop: 2,
  },
  attendanceStatus: {
    alignItems: 'center',
  },
  presentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  presentText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  absentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  absentText: {
    fontSize: 12,
    marginLeft: 4,
  },
  tapHint: {
    fontSize: 10,
    marginLeft: 4,
    fontStyle: 'italic',
    marginTop: 2,
  },
  attendanceSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  // Action buttons styles
  actionButtons: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
    minHeight: 40,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  instantSaveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
    minHeight: 40,
  },
  instantSaveButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  startMeetingButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
    minHeight: 40,
  },
  startMeetingButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  endMeetingButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
    minHeight: 40,
  },
  endMeetingButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  exitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PhysicalMeetingScreen;
