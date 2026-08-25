import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NotesSection = ({
  notes,
  onNotesChange,
  onSaveNotes,
  canTakeNotes,
  colors,
  meetingId,
  isReadOnly = false,
}) => {
  if (!canTakeNotes && !isReadOnly) {
    return null;
  }

  if (isReadOnly) {
    return (
      <View style={[styles.section, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Meeting Notes
        </Text>
        <View style={[styles.notesInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.notesText, { color: colors.text }]}>
            {notes || 'No notes recorded for this meeting.'}
          </Text>
        </View>
      </View>
    );
  }

  const handleNotesChange = (text) => {
    onNotesChange(text);
    AsyncStorage.setItem(`meeting_notes_${meetingId}`, text).catch((err) =>
      console.error('Failed to auto-save notes:', err),
    );
  };

  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
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
          numberOfLines={8}
          value={notes}
          onChangeText={handleNotesChange}
          textAlignVertical="top"
        />
        <View style={styles.resizeHandle}>
          <View style={[styles.resizeHandleBar, { backgroundColor: colors.textSecondary }]} />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveNotesButton, { backgroundColor: colors.primary }]}
        onPress={onSaveNotes}
      >
        <Ionicons name="save" size={20} color="white" />
        <Text style={styles.saveNotesText}>Save Notes</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = {
  section: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  notesWrapper: {
    marginBottom: 16,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 120,
    marginBottom: 0,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
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
};

export default NotesSection;
