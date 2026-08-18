import React from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing } from '../../../utils/theme';
import useCreateMeeting from '../../../hooks/useCreateMeeting';
import CreateMeetingForm from '../../../components/chama-meeting/CreateMeetingForm';

const CreateMeeting = ({ route, navigation, onRouteChange }) => {
  const screen = useCreateMeeting({ route, navigation, onRouteChange });
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const {
    formData,
    errors,
    showErrors,
    scrollViewRef,
    meetingTypes,
    durations,
    endTime,
    handleInputChange,
    handleSubmit,
  } = screen;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <CreateMeetingForm
            formData={formData}
            errors={errors}
            showErrors={showErrors}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            endTime={endTime}
            meetingTypes={meetingTypes}
            durations={durations}
            colors={colors}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  content: {
    padding: 16,
  },
});

export default CreateMeeting;
