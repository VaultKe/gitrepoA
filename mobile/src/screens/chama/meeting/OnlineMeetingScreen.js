import React from 'react';
import { SafeAreaView, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography } from '../../../utils/theme';
import useOnlineMeetingScreen from '../../../hooks/useOnlineMeetingScreen';
import OnlineMeetingLoading from '../../../components/chama-meeting/OnlineMeetingLoading';
import OnlineMeetingErrorView from '../../../components/chama-meeting/OnlineMeetingErrorView';
import OnlineMeetingView from '../../../components/chama-meeting/OnlineMeetingView';

const OnlineMeetingScreen = ({ route, navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const { isReadOnly = false } = route.params || {};
  const screen = useOnlineMeetingScreen({ route, navigation });

  const {
    isConnecting,
    connectionError,
    isCameraEnabled,
    isMicrophoneEnabled,
    meetingTitle,
    userRole,
    isPreview,
    participants,
    handleToggleCamera,
    handleToggleMicrophone,
    handleSwitchCamera,
    handleEndCall,
  } = screen;

  if (isReadOnly) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.readOnlyContainer}>
          <Ionicons name="calendar-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.readOnlyTitle, { color: colors.text }]}>
            Meeting Ended
          </Text>
          <Text style={[styles.readOnlySubtitle, { color: colors.textSecondary }]}>
            This online meeting has already ended. You can view past meeting details but cannot join.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isConnecting) {
    return (
      <OnlineMeetingLoading
        theme={theme}
        meetingTitle={meetingTitle}
        isPreview={isPreview}
      />
    );
  }

  if (connectionError) {
    return <OnlineMeetingErrorView theme={theme} error={connectionError} />;
  }

  return (
    <OnlineMeetingView
      participants={participants}
      onToggleCamera={handleToggleCamera}
      onToggleMicrophone={handleToggleMicrophone}
      onSwitchCamera={handleSwitchCamera}
      onEndCall={handleEndCall}
      isCameraEnabled={isCameraEnabled}
      isMicrophoneEnabled={isMicrophoneEnabled}
      userRole={userRole}
      isPreview={isPreview}
      meetingTitle={meetingTitle}
      theme={theme}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  readOnlyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  readOnlyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  readOnlySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default OnlineMeetingScreen;
