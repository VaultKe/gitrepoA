import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import useNotificationToneScreen from '../../../hooks/useNotificationToneScreen';

const NotificationToneScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const {
    availableSounds,
    selectedSoundId,
    loading,
    testingSound,
    playingSound,
    currentSoundObject,
    loadNotificationData,
    playSound,
    stopSound,
    selectNotificationTone,
    testNotificationSound,
    setPlayingSound,
    setCurrentSoundObject,
    setTestingSound,
  } = useNotificationToneScreen({ navigation });

  const renderSoundItem = (sound) => {
    const isSelected = selectedSoundId === sound.id;
    const isTesting = testingSound === sound.id;
    const isPlaying = playingSound === sound.id;

    return (
      <TouchableOpacity
        key={sound.id}
        style={[
          styles.soundItem,
          {
            backgroundColor: colors.surface,
            borderColor: isSelected ? colors.primary : colors.border,
            borderWidth: isSelected ? 2 : 1,
          }
        ]}
        onPress={() => selectNotificationTone(sound.id)}
        activeOpacity={0.7}
      >
        <View style={styles.soundItemContent}>
          <View style={styles.soundInfo}>
            <View style={styles.soundHeader}>
              <Text style={[styles.soundName, { color: colors.text }]}>
                {sound.name}
              </Text>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              )}
              {sound.is_default && (
                <View style={[styles.defaultBadge, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.defaultText, { color: colors.primary }]}>
                    Default
                  </Text>
                </View>
              )}
            </View>
            
            {sound.duration_seconds > 0 && (
              <Text style={[styles.soundDuration, { color: colors.textSecondary }]}>
                Duration: {sound.duration_seconds.toFixed(1)}s
              </Text>
            )}
            
            {sound.file_path === '' && (
              <Text style={[styles.soundDescription, { color: colors.textSecondary }]}>
                Silent notification
              </Text>
            )}
          </View>

          <View style={styles.soundActions}>
            {/* Play/Stop Button */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.playButton,
                { backgroundColor: colors.primary + '20' }
              ]}
              onPress={() => isPlaying ? stopSound() : playSound(sound)}
            >
              <Ionicons
                name={isPlaying ? "stop" : "play"}
                size={16}
                color={colors.primary}
              />
            </TouchableOpacity>

            {/* Test Notification Button */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.testButton,
                { backgroundColor: colors.secondary + '20' }
              ]}
              onPress={() => testNotificationSound(sound.id)}
              disabled={isTesting}
            >
              {isTesting ? (
                <ActivityIndicator size="small" color={colors.secondary} />
              ) : (
                <Ionicons name="notifications" size={16} color={colors.secondary} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading notification tones...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
       {/* Instructions */}
      <View style={[styles.instructionsContainer, { backgroundColor: colors.surface }]}>
        <Ionicons name="information-circle" size={20} color={colors.primary} />
        <Text style={[styles.instructionsText, { color: colors.textSecondary }]}>
          Tap a tone to select it. you can also tap to play.
        </Text>
      </View>

      {/* Sound List */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.soundsList}>
          {availableSounds.map(renderSoundItem)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
  },
  instructionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  instructionsText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  soundsList: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  soundItem: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  soundItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  soundInfo: {
    flex: 1,
  },
  soundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  soundName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  defaultBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  defaultText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  soundDuration: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  soundDescription: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },
  soundActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    // Additional styles for play button
  },
  testButton: {
    // Additional styles for test button
  },
});

export default NotificationToneScreen;
