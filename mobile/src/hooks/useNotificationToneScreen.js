import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';
import { useApp } from '../context/AppContext';
import notificationService from '../services/notificationService';
import { API_BASE_URL } from '../config/environment';
import useNotificationPreferences from './useNotificationPreferences';

const useNotificationToneScreen = ({ navigation }) => {
  const { theme } = useApp();
  const notificationPrefs = useNotificationPreferences();

  const [availableSounds, setAvailableSounds] = useState([]);
  const [selectedSoundId, setSelectedSoundId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testingSound, setTestingSound] = useState(null);
  const [playingSound, setPlayingSound] = useState(null);
  const [currentSoundObject, setCurrentSoundObject] = useState(null);

  useEffect(() => {
    loadNotificationData();

    return () => {
      if (currentSoundObject) {
        currentSoundObject.unloadAsync().catch(console.error);
      }
    };
  }, []);

  const loadNotificationData = useCallback(async () => {
    try {
      setLoading(true);
      
      const result = await notificationPrefs.loadPreferences();
      if (result) {
        setSelectedSoundId(result.preferences?.notification_sound_id);
        setAvailableSounds(result.sounds || []);
      }
    } catch (error) {
      console.error('Failed to load notification data:', error);
      Alert.alert('Error', 'Failed to load notification sounds');
    } finally {
      setLoading(false);
    }
  }, [notificationPrefs]);

  const playSound = useCallback(async (sound) => {
    try {
      if (currentSoundObject) {
        await currentSoundObject.stopAsync();
        await currentSoundObject.unloadAsync();
        setCurrentSoundObject(null);
        setPlayingSound(null);
      }

      if (!sound.file_path || sound.file_path === '') {
        Alert.alert('Silent Tone', 'This is a silent notification tone - no sound will play.');
        return;
      }

      setPlayingSound(sound.id);

      const soundObject = new Audio.Sound();
      setCurrentSoundObject(soundObject);

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (audioModeError) {
        console.warn('Audio mode setup failed:', audioModeError);
      }

      let soundUri;
      if (sound.file_path.startsWith('http://') || sound.file_path.startsWith('https://')) {
        soundUri = sound.file_path;
      } else if (sound.file_path.startsWith('/')) {
        const baseUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
        soundUri = `${baseUrl}${sound.file_path}`;
      } else {
        const baseUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
        soundUri = `${baseUrl}/${sound.file_path}`;
      }

      await soundObject.loadAsync({
        uri: soundUri,
        shouldPlay: false,
        isLooping: false,
      });

      soundObject.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setPlayingSound(null);
          soundObject.unloadAsync().catch(console.error);
          setCurrentSoundObject(null);
        } else if (status.error) {
          console.error('Sound playback error:', status.error);
          setPlayingSound(null);
          soundObject.unloadAsync().catch(console.error);
          setCurrentSoundObject(null);
        }
      });

      await soundObject.playAsync();
    } catch (error) {
      console.error('Failed to play sound:', error);

      setPlayingSound(null);
      if (currentSoundObject) {
        try {
          await currentSoundObject.unloadAsync();
        } catch (unloadError) {
          console.warn('Warning unloading sound:', unloadError);
        }
      }
      setCurrentSoundObject(null);

      const duration = sound.duration_seconds ? ` (${sound.duration_seconds.toFixed(1)}s)` : '';
      Alert.alert(
        'Audio Preview Unavailable',
        `Sound: ${sound.name}${duration}\n\nThe audio file could not be loaded. This might be due to network issues or an invalid file path.\n\nUse the test button to hear it as a real notification.`,
        [{ text: 'OK' }]
      );
    }
  }, [currentSoundObject]);

  const stopSound = useCallback(async () => {
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
  }, [currentSoundObject]);

  const selectNotificationTone = useCallback(async (soundId) => {
    try {
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

      const success = await notificationPrefs.updatePreference('notification_sound_id', soundId);

      if (success) {
        setSelectedSoundId(soundId);
        Alert.alert(
          'Success',
          'Notification tone updated successfully',
          [{ text: 'OK' }]
        );
      } else {
        console.error('Failed to update notification tone:', success);
        Alert.alert(
          'Error',
          'Failed to update notification tone. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Failed to update notification tone:', error);
      Alert.alert(
        'Error',
        'Failed to update notification tone. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    }
  }, [currentSoundObject, notificationPrefs]);

  const testNotificationSound = useCallback(async (soundId) => {
    try {
      setTestingSound(soundId);

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

      const success = await notificationService.testNotificationWithSound(soundId);

      if (success) {
        Alert.alert(
          'Test Notification Sent',
          'A test notification has been sent with your selected sound and vibration. You should hear it shortly!',
          [{ text: 'OK' }]
        );
      } else {
        const sound = availableSounds.find(s => s.id === soundId);
        if (sound && sound.file_path) {
          const directPlay = await notificationService.forcePlayNotificationSound(soundId, sound.file_path);
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
      }

    } catch (error) {
      console.error('Failed to test notification sound:', error);
      Alert.alert(
        'Error',
        'Failed to test notification sound. Please check your device settings and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setTimeout(() => setTestingSound(null), 3000);
    }
  }, [availableSounds]);

  return {
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
  };
};

export default useNotificationToneScreen;
