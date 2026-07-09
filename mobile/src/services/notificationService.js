import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
import { Audio } from 'expo-av';
import webSocketService from './websocket';
import { API_BASE_URL } from '../config/environment';

class NotificationService {
  constructor() {
    this.isInitialized = false;
    this.appState = AppState.currentState;
  }

  async initialize() {
    if (this.isInitialized) return true;
    this.setupNotificationHandler();
    this.setupAppStateListener();
    this.isInitialized = true;
    return true;
  }

  setupAppStateListener() {
    this.appStateListener = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && !webSocketService.isConnected) {
        webSocketService.connect();
      }
    });
  }

  setupNotificationHandler() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }

  async handleNotificationAlert(request) {
    try {
      if (Platform.OS !== 'web') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: request.request.content.title,
            body: request.request.content.body,
            data: request.request.content.data,
            sound: true,
          },
          trigger: null,
        });
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to handle notification alert:', error);
      return { success: false, error: error.message };
    }
  }

  async setupNotificationChannels() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default notifications',
        importance: 4,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        enableVibrate: true,
      });
    }
  }

  async getPermissionStatus() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return {
        enabled: status === 'granted',
        status: status,
      };
    } catch (error) {
      console.error('Failed to get permission status:', error);
      return { enabled: false, status: 'denied' };
    }
  }

  async requestPermissionsFromUser() {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Failed to request permissions:', error);
      return false;
    }
  }

  async testNotificationWithSound(soundId) {
    try {
      // For testing, we just schedule a notification with the sound
      // The actual sound playback would be handled by the system notification
      if (Platform.OS !== 'web') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Sound Test',
            body: 'This is a test notification with your selected sound',
            data: { test: true, soundId },
            sound: 'default',
          },
          trigger: null,
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to test notification with sound:', error);
      return false;
    }
  }

  async forcePlayNotificationSound(soundId, filePath) {
    try {
      let soundUri = null;
      
      // Construct proper sound URL based on file path or sound ID
      if (filePath) {
        // Use the file path directly (e.g., /notification_sound/ring.mp3)
        if (filePath.startsWith('http')) {
          soundUri = filePath;
        } else {
          // Remove /api/v1 from API_BASE_URL since notification_sound is a static route
          const baseUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
          soundUri = `${baseUrl}${filePath}`;
        }
      } else {
        // Fallback: construct URL from sound ID
        const baseUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
        const soundFiles = {
          1: 'ring.mp3',
          2: 'bell.mp3',
          3: 'alert.mp3',
          4: 'chime.mp3',
          5: 'vibrate.mp3',
        };
        const soundFile = soundFiles[soundId] || 'ring.mp3';
        soundUri = `${baseUrl}/notification_sound/${soundFile}`;
      }

      // This attempts to play a notification sound directly
      const soundObject = new Audio.Sound();
      try {
        await soundObject.loadAsync(
          { uri: soundUri },
          { shouldPlay: true }
        );
        // Unload after playback completes
        setTimeout(() => {
          soundObject.unloadAsync().catch(() => {});
        }, 5000);
        return true;
      } catch (loadError) {
        console.warn('Could not load sound for direct playback:', loadError);
        return false;
      }
    } catch (error) {
      console.error('Failed to force play notification sound:', error);
      return false;
    }
  }

  async getSoundById(soundId) {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/sounds/${soundId}`);
      if (response.ok) {
        const data = await response.json();
        return data.data || data;
      }
      return null;
    } catch (error) {
      console.warn('Could not fetch sound info:', error);
      return null;
    }
  }

  cleanup() {
    if (this.appStateListener) {
      this.appStateListener.remove();
    }
    this.isInitialized = false;
  }
}

const notificationService = new NotificationService();
export default notificationService;