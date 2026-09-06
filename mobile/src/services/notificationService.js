import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import webSocketService from './websocket';
import { API_BASE_URL } from '../config/environment';

const PUSH_TOKEN_KEY = 'expo_push_token';

class NotificationService {
  constructor() {
    this.isInitialized = false;
    this.appState = AppState.currentState;
    this._pushToken = null;
    this._responseSub = null;
    this._navigate = null; // set by the navigator; (routeName, params) => void

    // In-app notification tone playback
    this._toneSound = null;        // loaded expo-av Audio.Sound
    this._toneUri = null;          // URI the loaded sound was created from
    this._tonePrefs = null;        // { sound_enabled, notification_sound_id, file_path }
    this._tonePrefsFetchedAt = 0;
    this._lastTonePlayedAt = 0;
    this._audioModeSet = false;
  }

  // Resolve the user's selected notification tone (cached for 5 min).
  async _loadTonePreferences(force = false) {
    const fresh = Date.now() - this._tonePrefsFetchedAt < 5 * 60 * 1000;
    if (this._tonePrefs && fresh && !force) return this._tonePrefs;

    try {
      const ApiService = (await import('./api')).default;
      const res = await ApiService.getNotificationPreferences();
      if (res?.success && res.data) {
        const prefs = res.data.preferences || {};
        const sounds = res.data.available_sounds || res.data.sounds || [];
        const selected = sounds.find(s => s.id === prefs.notification_sound_id);
        const fallback = sounds.find(s => s.is_default) || sounds.find(s => s.file_path);
        const chosen = selected || fallback || null;
        this._tonePrefs = {
          sound_enabled: prefs.sound_enabled !== false,
          notification_sound_id: prefs.notification_sound_id ?? null,
          file_path: chosen?.file_path || '',
          name: chosen?.name || '',
        };
        this._tonePrefsFetchedAt = Date.now();
      }
    } catch (error) {
      // Network/permission issues shouldn't block playback of a default tone.
      if (!this._tonePrefs) {
        this._tonePrefs = { sound_enabled: true, notification_sound_id: null, file_path: '/notification_sound/ring.mp3', name: 'Default Ring' };
      }
    }
    return this._tonePrefs;
  }

  _resolveToneUri(filePath) {
    if (!filePath) return null;
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
    const baseUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
    return filePath.startsWith('/') ? `${baseUrl}${filePath}` : `${baseUrl}/${filePath}`;
  }

  // Invalidate the cached tone so the next play re-fetches (call after the user
  // changes their notification tone in settings).
  resetTonePreferences() {
    this._tonePrefs = null;
    this._tonePrefsFetchedAt = 0;
  }

  /**
   * Play the user's selected notification tone for an in-app notification.
   * Real playback via expo-av — works on web and native, in-app (foreground),
   * where the OS notification sound never fires. Throttled to once / 2s.
   */
  async playNotificationSound() {
    try {
      const now = Date.now();
      if (now - this._lastTonePlayedAt < 2000) return false;

      const prefs = await this._loadTonePreferences();
      if (!prefs || prefs.sound_enabled === false) return false;

      const uri = this._resolveToneUri(prefs.file_path);
      if (!uri) return false; // "Silent" tone selected

      this._lastTonePlayedAt = now;

      if (!this._audioModeSet) {
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            staysActiveInBackground: false,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
          this._audioModeSet = true;
        } catch {}
      }

      // Reuse the loaded sound when the tone hasn't changed.
      if (this._toneSound && this._toneUri === uri) {
        try {
          await this._toneSound.replayAsync();
          return true;
        } catch {
          // fall through to a fresh load
          try { await this._toneSound.unloadAsync(); } catch {}
          this._toneSound = null;
          this._toneUri = null;
        }
      }

      if (this._toneSound) {
        try { await this._toneSound.unloadAsync(); } catch {}
        this._toneSound = null;
        this._toneUri = null;
      }

      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: 1.0 });
      this._toneSound = sound;
      this._toneUri = uri;
      return true;
    } catch (error) {
      console.warn('playNotificationSound failed:', error?.message || error);
      return false;
    }
  }

  async initialize() {
    if (this.isInitialized) return true;
    this.setupNotificationHandler();
    this.setupAppStateListener();
    this.setupResponseListener();

    // Setup Android notification channels
    await this.setupNotificationChannels();

    // Request permissions on app start so notifications can appear
    // in the phone's notification shade
    await this.requestPermissionsFromUser();

    this.isInitialized = true;
    return true;
  }

  // Called by the navigator so a tapped notification can deep-link.
  setNavigator(navigateFn) {
    this._navigate = typeof navigateFn === 'function' ? navigateFn : null;
  }

  // Handle the user tapping a notification (from tray / lock screen).
  setupResponseListener() {
    if (this._responseSub) return;
    try {
      this._responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response?.notification?.request?.content?.data || {};
        this._routeFromNotification(data);
      });

      // Cold start: the app was launched by tapping a notification.
      Notifications.getLastNotificationResponseAsync?.()
        .then((response) => {
          const data = response?.notification?.request?.content?.data;
          if (data) {
            this._pendingColdStartData = data;
            // Give the navigator a moment to mount.
            setTimeout(() => {
              if (this._pendingColdStartData) {
                this._routeFromNotification(this._pendingColdStartData);
                this._pendingColdStartData = null;
              }
            }, 1200);
          }
        })
        .catch(() => {});
    } catch (error) {
      console.warn('Failed to attach notification response listener:', error?.message || error);
    }
  }

  _routeFromNotification(data) {
    if (!this._navigate) return;
    try {
      if (data.loan_id) {
        this._navigate('LoanDetails', { loanId: data.loan_id, chamaId: data.chama_id });
      } else {
        this._navigate('Notifications');
      }
    } catch (error) {
      console.warn('Notification navigation failed:', error?.message || error);
    }
  }

  /**
   * Register this device for OS push notifications and send the token to the
   * backend. Safe to call repeatedly (backend upserts). No-op on web / simulators
   * where a real push token cannot be obtained.
   */
  async registerForPushNotificationsAsync() {
    try {
      if (Platform.OS === 'web' || !Device.isDevice) return null;

      await this.setupNotificationChannels();

      const granted = await this.requestPermissionsFromUser();
      if (!granted) return null;

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ||
        Constants?.easConfig?.projectId ||
        Constants?.manifest?.extra?.eas?.projectId;

      const tokenResponse = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();

      const token = tokenResponse?.data;
      if (!token) return null;

      this._pushToken = token;
      try { await AsyncStorage.setItem(PUSH_TOKEN_KEY, token); } catch {}

      const ApiService = (await import('./api')).default;
      await ApiService.registerPushToken({
        token,
        platform: Platform.OS,
        deviceName: Device.deviceName || Device.modelName || '',
      });

      return token;
    } catch (error) {
      console.warn('registerForPushNotificationsAsync failed:', error?.message || error);
      return null;
    }
  }

  // Remove this device's push token from the backend (call on logout).
  async unregisterPushToken() {
    try {
      const token = this._pushToken || (await AsyncStorage.getItem(PUSH_TOKEN_KEY).catch(() => null));
      if (!token) return;
      const ApiService = (await import('./api')).default;
      await ApiService.unregisterPushToken({ token });
      this._pushToken = null;
      try { await AsyncStorage.removeItem(PUSH_TOKEN_KEY); } catch {}
    } catch (error) {
      // Non-fatal — the backend prunes dead tokens on send anyway.
    }
  }

  setupAppStateListener() {
    this.appStateListener = AppState.addEventListener('change', (nextAppState) => {
      const safeState = typeof nextAppState === 'string' ? nextAppState : '';
      if (safeState === 'active' && !webSocketService.isConnected) {
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
        importance: Notifications.AndroidImportance?.MAX ?? 5,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        enableVibrate: true,
        sound: 'default',
        // Show full content on the lock screen (like WhatsApp).
        lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC ?? 1,
        showBadge: true,
        enableLights: true,
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
      const { status } = await Notifications.requestPermissionsAsync({
        sound: true,
        badge: true,
        vibrate: true,
      });
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

  async checkNotificationChannels() {
    if (Platform.OS === 'android') {
      try {
        const channels = await Notifications.getNotificationChannelsAsync();
        return channels && channels.some(channel => channel.id === 'default');
      } catch {
        return false;
      }
    }
    return true;
  }

  async verifyNotificationSystem() {
    try {
      const permissionStatus = await this.getPermissionStatus();
      const channelsOk = await this.checkNotificationChannels();

      return {
        overall: permissionStatus.enabled && channelsOk,
        permissions: permissionStatus,
        channels: channelsOk,
      };
    } catch (error) {
      return {
        overall: false,
        error: error.message,
      };
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