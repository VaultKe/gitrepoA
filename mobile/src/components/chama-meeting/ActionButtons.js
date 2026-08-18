import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ActionButtons = ({
  canMarkAttendance,
  canEndMeeting,
  isSaving,
  meetingData,
  onSave,
  onSaveAndExit,
  onStartMeeting,
  onEndMeeting,
  colors,
  isReadOnly = false,
}) => {
  console.log('ActionButtons render, isReadOnly:', isReadOnly, 'canMarkAttendance:', canMarkAttendance);

  if (isReadOnly) {
    return null;
  }

  return (
    <View style={[styles.actionButtons, { backgroundColor: colors.surface }]}>
      {canMarkAttendance && (
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={onSave}
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

      {canMarkAttendance && (
        <TouchableOpacity
          style={[styles.instantSaveButton, { backgroundColor: colors.success }]}
          onPress={onSaveAndExit}
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

      {canEndMeeting && meetingData && !['in_progress', 'ongoing', 'started'].includes((meetingData.status || '').toLowerCase()) && (
        <TouchableOpacity
          style={[styles.startMeetingButton, { backgroundColor: colors.warning }]}
          onPress={onStartMeeting}
          disabled={isSaving}
        >
          <Ionicons name="play" size={20} color={'white'} />
          <Text style={styles.startMeetingButtonText}>Start Meeting</Text>
        </TouchableOpacity>
      )}

      {canEndMeeting && (
        <TouchableOpacity
          style={[styles.endMeetingButton, { backgroundColor: colors.error }]}
          onPress={onEndMeeting}
          disabled={isSaving}
        >
          <Ionicons name="stop" size={20} color={'white'} />
          <Text style={styles.endMeetingButtonText}>End Meeting Now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = {
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
};

export default ActionButtons;
