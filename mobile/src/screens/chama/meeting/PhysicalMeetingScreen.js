import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, TextInput, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import usePhysicalMeetingScreen from '../../../hooks/usePhysicalMeetingScreen';
import PhysicalMeetingHeader from '../../../components/chama-meeting/PhysicalMeetingHeader';
import PreviousMinutesSection from '../../../components/chama-meeting/PreviousMinutesSection';
import AttendanceSection from '../../../components/chama-meeting/AttendanceSection';
import NotesSection from '../../../components/chama-meeting/NotesSection';
import DocumentsSection from '../../../components/chama-meeting/DocumentsSection';
import ActionButtons from '../../../components/chama-meeting/ActionButtons';

const PhysicalMeetingScreen = ({ route, navigation }) => {
  const { theme } = useApp();
  const { isReadOnly = false } = route.params || {};
  const screen = usePhysicalMeetingScreen({ route, navigation });

  const {
    loading,
    meetingData,
    chamaMembers,
    memberAttendance,
    notes,
    setNotes,
    uploadedDocuments,
    isSaving,
    isPreview,
    previousMeeting,
    previousMinutes,
    prevLoading,
    showPrevMinutes,
    setShowPrevMinutes,
    canTakeNotes,
    isChairperson,
    canMarkAttendance,
    canEndMeeting,
    canUploadDocuments,
    getStatusColor,
    getStatusIcon,
    loadMeetingData,
    loadChamaMembers,
    loadAttendanceList,
    loadMeetingDocuments,
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
    colors,
  } = screen;

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
        <PhysicalMeetingHeader
          meetingTitle={screen.meetingTitle}
          isPreview={isPreview}
          meetingData={meetingData}
          getStatusColor={getStatusColor}
          getStatusIcon={getStatusIcon}
          colors={colors}
        />

        {isReadOnly && (
          <View style={[styles.readOnlyBanner, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
            <Ionicons name="lock-closed" size={20} color={colors.warning} />
            <Text style={[styles.readOnlyText, { color: colors.warning }]}>
              This meeting has ended. Viewing in read-only mode.
            </Text>
          </View>
        )}

        <PreviousMinutesSection
          previousMeeting={previousMeeting}
          previousMinutes={previousMinutes}
          prevLoading={prevLoading}
          showPrevMinutes={showPrevMinutes}
          setShowPrevMinutes={setShowPrevMinutes}
          isChairperson={isChairperson && !isReadOnly}
          onApproveMinutes={approvePreviousMinutes}
          colors={colors}
        />

        <AttendanceSection
          chamaMembers={chamaMembers}
          memberAttendance={memberAttendance}
          canMarkAttendance={canMarkAttendance && !isReadOnly}
          onToggleAttendance={toggleMemberAttendance}
          colors={colors}
        />

        <NotesSection
          notes={notes}
          onNotesChange={setNotes}
          onSaveNotes={saveNotes}
          canTakeNotes={canTakeNotes && !isReadOnly}
          colors={colors}
          meetingId={screen.meetingId}
          isReadOnly={isReadOnly}
        />

        <DocumentsSection
          uploadedDocuments={uploadedDocuments}
          onUploadDocument={uploadDocument}
          onRemoveDocument={removeDocument}
          canUploadDocuments={canUploadDocuments && !isReadOnly}
          formatFileSize={formatFileSize}
          colors={colors}
        />
      </ScrollView>

      {!isReadOnly && (
        <ActionButtons
          canMarkAttendance={canMarkAttendance}
          canEndMeeting={canEndMeeting}
          isSaving={isSaving}
          meetingData={meetingData}
          onSave={saveMeetingData}
          onSaveAndExit={instantSaveAndExit}
          onStartMeeting={startMeeting}
          onEndMeeting={endMeeting}
          colors={colors}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.sm,
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
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    gap: 8,
  },
  readOnlyText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default PhysicalMeetingScreen;
