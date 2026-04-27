import React, { useState, useEffect } from 'react';
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
import { Audio } from 'expo-av';

import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import ApiService from '../../../services/api';
import notificationService from '../../../services/notificationService';

const NotificationToneScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const [availableSounds, setAvailableSounds] = useState([]);
  const [selectedSoundId, setSelectedSoundId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testingSound, setTestingSound] = useState(null);
  const [playingSound, setPlayingSound] = useState(null);
  const [currentSoundObject, setCurrentSoundObject] = useState(null);

  useEffect(() => {
    loadNotificationData();

    // Cleanup function to stop and unload any playing sound when component unmounts
    return () => {
      if (currentSoundObject) {
        currentSoundObject.unloadAsync().catch(console.error);
      }
    };
  }, []); // Empty dependency array - only run on mount/unmount

  const loadNotificationData = async () => {
    try {
      setLoading(true);
      
      // Load notification preferences to get current selection
      const preferencesResponse = await ApiService.getNotificationPreferences();
      if (preferencesResponse.success) {
        setSelectedSoundId(preferencesResponse.data.preferences.notification_sound_id);
        setAvailableSounds(preferencesResponse.data.available_sounds || []);
      } else {
        // Fallback to just getting available sounds
        const soundsResponse = await ApiService.getAvailableNotificationSounds();
        if (soundsResponse.success) {
          setAvailableSounds(soundsResponse.data.sounds || []);
        }
      }
    } catch (error) {
      console.error('Failed to load notification data:', error);
      Alert.alert('Error', 'Failed to load notification sounds');
    } finally {
      setLoading(false);
    }
  };

  const playSound = async (sound) => {
    try {
      // Stop any currently playing sound
      if (currentSoundObject) {
        await currentSoundObject.stopAsync();
        await currentSoundObject.unloadAsync();
        setCurrentSoundObject(null);
        setPlayingSound(null);
      }

      // Handle silent sound
      if (!sound.file_path || sound.file_path === '') {
        Alert.alert('Silent Tone', 'This is a silent notification tone - no sound will play.');
        return;
      }

      setPlayingSound(sound.id);

      // Create new sound object
      const soundObject = new Audio.Sound();
      setCurrentSoundObject(soundObject);

      // Configure audio mode for playback with error handling
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (audioModeError) {
        console.warn('⚠️ Audio mode setup failed:', audioModeError);
        // Continue anyway - audio might still work
      }

      // Load and play the sound - fix URI construction
      let soundUri;
      if (sound.file_path.startsWith('http://') || sound.file_path.startsWith('https://')) {
        // Already a full URL
        soundUri = sound.file_path;
      } else if (sound.file_path.startsWith('/')) {
        // Absolute path
        soundUri = `http://localhost:8080${sound.file_path}`;
      } else {
        // Relative path
        soundUri = `http://localhost:8080/${sound.file_path}`;
      }

      // console.log('🎵 Loading sound from URI:', soundUri);
      // console.log('🎵 Original file_path:', sound.file_path);

      await soundObject.loadAsync({
        uri: soundUri,
        shouldPlay: false, // Don't auto-play, we'll control it
        isLooping: false,
      });

      // Set up playback status listener with better error handling
      soundObject.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          // console.log('🎵 Sound finished playing:', sound.name);
          setPlayingSound(null);
          soundObject.unloadAsync().catch(console.error);
          setCurrentSoundObject(null);
        } else if (status.error) {
          console.error('🎵 Sound playback error:', status.error);
          setPlayingSound(null);
          soundObject.unloadAsync().catch(console.error);
          setCurrentSoundObject(null);
        }
      });

      await soundObject.playAsync();
      // console.log('✅ Sound playback started:', sound.name);

    } catch (error) {
      console.error('❌ Failed to play sound:', error);

      // Clean up state to prevent issues
      setPlayingSound(null);
      if (currentSoundObject) {
        try {
          await currentSoundObject.unloadAsync();
        } catch (unloadError) {
          console.warn('Warning unloading sound:', unloadError);
        }
      }
      setCurrentSoundObject(null);

      // Show user-friendly error message
      const duration = sound.duration_seconds ? ` (${sound.duration_seconds.toFixed(1)}s)` : '';
      Alert.alert(
        'Audio Preview Unavailable',
        `Sound: ${sound.name}${duration}\n\nThe audio file could not be loaded. This might be due to network issues or an invalid file path.\n\nUse the test button to hear it as a real notification.`,
        [{ text: 'OK' }]
      );
    }
  };

  const stopSound = async () => {
    if (currentSoundObject) {
      try {
        await currentSoundObject.stopAsync();
        await currentSoundObject.unloadAsync();
      } catch (error) {
        console.error('Error stopping sound:', error);
      }
      setCurrentSoundObject(null);
      setPlayingSound(null);
    }
  };

  const selectNotificationTone = async (soundId) => {
    try {
      console.log('🔧 Selecting notification tone:', soundId);

      // Stop any currently playing sound first
      if (currentSoundObject) {
        try {
          await currentSoundObject.stopAsync();
          await currentSoundObject.unloadAsync();
        } catch (stopError) {
          console.warn('Warning stopping sound during selection:', stopError);
        }
        setCurrentSoundObject(null);
        setPlayingSound(null);
      }

      const response = await ApiService.updateNotificationPreferences({
        notification_sound_id: soundId
      });

      if (response.success) {
        setSelectedSoundId(soundId);
        console.log('✅ Notification tone updated successfully');

        // Show success message without causing reload
        Alert.alert(
          'Success',
          'Notification tone updated successfully',
          [{ text: 'OK' }]
        );
      } else {
        console.error('❌ Failed to update notification tone:', response);
        Alert.alert(
          'Error',
          'Failed to update notification tone. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Failed to update notification tone:', error);
      Alert.alert(
        'Error',
        'Failed to update notification tone. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const testNotificationSound = async (soundId) => {
    try {
      setTestingSound(soundId);

      // Check if notifications are enabled first
      const permissionStatus = await notificationService.getPermissionStatus();

      if (!permissionStatus.enabled) {
        Alert.alert(
          'Notification Permissions Required',
          'To test notification sounds, please enable notifications for this app. Would you like to enable them now?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Enable',
              onPress: async () => {
                const granted = await notificationService.requestPermissionsFromUser();
                if (granted) {
                  // Retry the test after permissions are granted
                  setTimeout(() => testNotificationSound(soundId), 1000);
                } else {
                  Alert.alert(
                    'Permissions Required',
                    'Please enable notifications in your device settings to test notification sounds.',
                    [{ text: 'OK' }]
                  );
                }
              }
            }
          ]
        );
        return;
      }

      // Use the enhanced notification service to test the sound
      const success = await notificationService.testNotificationWithSound(soundId);

      if (success) {
        Alert.alert(
          'Test Notification Sent',
          'A test notification has been sent with your selected sound and vibration. You should hear it shortly!',
          [{ text: 'OK' }]
        );
      } else {
        // Fallback: try to play the sound directly
        const directPlay = await notificationService.forcePlayNotificationSound(soundId);
        if (directPlay) {
          Alert.alert(
            'Sound Test',
            'The notification sound was played directly. If you didn\'t hear it, check your device volume and notification settings.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Test Failed',
            'Unable to test the notification sound. Please check your device settings and try again.',
            [{ text: 'OK' }]
          );
        }
      }

    } catch (error) {
      console.error('Failed to test notification sound:', error);
      Alert.alert(
        'Error',
        'Failed to test notification sound. Please check your device settings and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setTimeout(() => setTestingSound(null), 3000); // Give time for the test to complete
    }
  };

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
      {/* Header */}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  headerRight: {
    width: 32, // Same as back button for centering
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
    borderRadius: borderRadius.sm,
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
