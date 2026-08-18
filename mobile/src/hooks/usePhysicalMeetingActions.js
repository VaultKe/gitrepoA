import { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { getThemeColors } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import api from '../services/api';
import Toast from 'react-native-toast-message';

const usePhysicalMeetingActions = ({
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
}) => {
  const toggleMemberAttendance = async (userId) => {
    if (!canMarkAttendance) {
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'Only chairperson, treasurer, or secretary can mark attendance',
      });
      return;
    }

    console.log('toggleMemberAttendance called for userId:', userId, 'canMarkAttendance:', canMarkAttendance);

    try {
      const currentStatus = memberAttendance[userId] || false;
      const newStatus = !currentStatus;

      setMemberAttendance(prev => ({
        ...prev,
        [userId]: newStatus
      }));

      const response = await api.makeRequest(`/meetings/${meetingId}/attendance`, {
        method: 'POST',
        body: {
          userId: userId,
          attendanceType: 'physical',
          isPresent: newStatus,
        },
      });

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: newStatus ? 'Marked Present' : 'Marked Absent',
          text2: `Attendance updated for member`,
          visibilityTime: 2000,
        });

        if (!hasBackendSchemaIssue) {
          try {
            await loadAttendanceList();
          } catch (refreshError) {
            if (refreshError.message.includes('converting NULL to string is unsupported')) {
              setHasBackendSchemaIssue(true);
            }
          }
        }
      } else {
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

  const saveMeetingData = async () => {
    console.log('saveMeetingData called, canMarkAttendance:', canMarkAttendance, 'chamaMembers count:', chamaMembers?.length);
    try {
      setIsSaving(true);
      let savedItems = [];

      const presentMembers = Object.entries(memberAttendance)
        .filter(([, isPresent]) => isPresent)
        .map(([userId]) => userId);

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
          return null;
        }
      });

      const attendanceResults = await Promise.all(attendancePromises);
      const successfulSaves = attendanceResults.filter(result => result !== null).length;

      if (successfulSaves > 0) {
        savedItems.push(`attendance (${successfulSaves}/${chamaMembers.length} members)`);
      }

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

      try {
        await api.makeRequest(`/meetings/${meetingId}`, {
          method: 'PATCH',
          body: {
            status: 'completed',
          },
        });
        savedItems.push('meeting status');
      } catch (statusError) {
        // Don't fail the entire save operation for this
      }

      Toast.show({
        type: 'success',
        text1: 'Meeting Data Saved',
        text2: `Successfully saved: ${savedItems.join(', ')}`,
      });

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

  const instantSaveAndExit = async () => {
    try {
      setIsSaving(true);
      await saveMeetingData();

      Toast.show({
        type: 'success',
        text1: 'Meeting Saved',
        text2: 'Attendance and meeting data saved successfully',
      });

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
              const response = await api.makeRequest(`/meetings/${meetingId}/documents/${docId}`, {
                method: 'DELETE',
              });

              if (response.success) {
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
    console.log('saveNotes called, notes length:', notes?.length, 'canTakeNotes:', canTakeNotes);
    if (!notes.trim()) {
      Toast.show({
        type: 'error',
        text1: 'No Notes',
        text2: 'Please enter some notes before saving',
      });
      return;
    }

    try {
      const response = await api.makeRequest(`/meetings/${meetingId}/minutes`, {
        method: 'POST',
        body: {
          content: notes.trim(),
          status: 'draft',
          meetingId: meetingId,
          authorRole: userRole,
        },
      });

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

  const startMeeting = async (loadMeetingData) => {
    try {
      const res = await api.startMeeting(meetingId);
      if (res?.success) {
        Toast.show({ type: 'success', text1: 'Meeting Started', text2: 'The meeting is now active.' });
        loadMeetingData();
      } else {
        throw new Error(res?.error || 'Failed to start meeting');
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Start Meeting Failed', text2: e.message || 'Unable to start meeting.' });
    }
  };

  const endMeeting = async () => {
    try {
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

      try {
        const status = (meetingData?.status || '').toLowerCase();
        if (!(status === 'in_progress' || status === 'ongoing' || status === 'started')) {
          await api.startMeeting(meetingId);
        }
      } catch {}

      const res = await api.endMeeting(meetingId);
      if (!res?.success) {
        throw new Error(res?.error || 'Failed to end meeting. Ensure the meeting is active.');
      }
      Toast.show({ type: 'success', text1: 'Meeting Ended', text2: 'The meeting has been marked as completed.' });
      navigation.goBack();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'End Meeting Failed', text2: e.message || 'Unable to end meeting.' });
    }
  };

  const approvePreviousMinutes = async () => {
    try {
      const updated = await api.updateMeetingMinutes(previousMeeting.id, {
        status: 'approved',
      });
      if (updated?.success) {
        Toast.show({ type: 'success', text1: 'Minutes Approved', text2: 'Previous minutes have been approved.' });
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
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return {
    toggleMemberAttendance,
    saveMeetingData,
    instantSaveAndExit,
    uploadDocument,
    removeDocument,
    saveNotes,
    startMeeting,
    endMeeting,
    approvePreviousMinutes,
    formatFileSize,
  };
};

export default usePhysicalMeetingActions;
