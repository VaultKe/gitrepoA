import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { Platform, Vibration, AppState } from 'react-native';
import ApiService from './api';

class NotificationService {
  constructor() {
    this.currentSound = null;
    this.userPreferences = null;
    this.isInitialized = false;
    this.appState = AppState.currentState;
    this.isWeb = Platform.OS === 'web';

    if (this.isWeb) {
      this.setupWebNotificationHandler();
    } else {
      this.setupNotificationHandler();
    }

    this.setupAppStateListener();
  }

  // Setup app state listener to handle background/foreground transitions
  setupAppStateListener() {
    this.appStateListener = AppState.addEventListener('change', (nextAppState) => {
      this.appState = nextAppState;
    });
  }

  // Web-compatible notification handler (no native APIs)
  setupWebNotificationHandler() {
  }

  // Configure how notifications are handled when the app is in the foreground (mobile only)
  setupNotificationHandler() {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        await this.loadUserPreferences();

        const shouldPlaySound = this.shouldPlayCustomSound(notification);
        return {
          shouldShowAlert: true,
          shouldPlaySound: !shouldPlaySound, // Let us handle custom sounds if enabled
          shouldSetBadge: true,
        };
      },
    });

    // Listen for received notifications
    this.notificationListener = Notifications.addNotificationReceivedListener(
      this.handleNotificationReceived.bind(this)
    );

    // Listen for notification responses (when user taps notification)
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse.bind(this)
    );

    // Set up background notification handling
    this.setupBackgroundNotificationHandling();
  }

  // Load user notification preferences
  async loadUserPreferences() {
    try {
      const response = await ApiService.getNotificationPreferences();
      if (response.success) {
        this.userPreferences = response.data.preferences;
        return this.userPreferences;
      }
    } catch (error) {
    }
    return null;
  }

  // Check if we should play a custom sound for this notification
  shouldPlayCustomSound(notification) {
    if (!this.userPreferences) return false;
    
    // Check if sound is enabled
    if (!this.userPreferences.sound_enabled) return false;
    
    // Check if we have a custom sound selected
    if (!this.userPreferences.notification_sound_id) return false;
    
    return true;
  }

  // Handle notification received (when app is in foreground)
  async handleNotificationReceived(notification) {
    await this.loadUserPreferences();

    // Handle sound and vibration
    await this.handleNotificationAlert(notification);

    // Also trigger local notification display if needed
    try {
      // The notification will be picked up by the NotificationsScreen's useLightningData hook
    } catch (error) {
    }
  }

  // Comprehensive notification alert handling
  async handleNotificationAlert(notification) {
    try {
      // Always try to play sound first (most important)
      const soundPlayed = await this.handleNotificationSound(notification);

      // Handle vibration if enabled
      await this.handleNotificationVibration();
    } catch (error) {
      await this.playSystemNotificationSound();
      if (this.userPreferences?.vibration_enabled !== false) {
        Vibration.vibrate(400); // Default vibration
      }
    }
  }

  // Handle notification sound with multiple fallbacks
  async handleNotificationSound(notification) {
    try {
      // Check if sound is disabled
      if (this.userPreferences?.sound_enabled === false) {
        return false;
      }

      // Try custom sound first
      if (this.shouldPlayCustomSound(notification)) {
        const customSoundPlayed = await this.playCustomNotificationSound();
        if (customSoundPlayed) {
          return true;
        }
      }

      // Fallback to system sound
      await this.playSystemNotificationSound();
      return true;

    } catch (error) {
      return false;
    }
  }

  // Handle notification vibration
  async handleNotificationVibration() {
    try {
      if (this.userPreferences?.vibration_enabled !== false) {
        Vibration.vibrate([0, 250, 100, 250]); // Short-pause-short-pause pattern
      } else {
      }
    } catch (error) {
    }
  }

  // Handle notification response (when user taps notification)
  handleNotificationResponse(response) {
  }

  // Setup background notification handling
  setupBackgroundNotificationHandling() {
    if (this.isWeb) {
      return;
    }

    try {
      // Configure notification categories for better handling (mobile only)
      Notifications.setNotificationCategoryAsync('default', [
        {
          identifier: 'view',
          buttonTitle: 'View',
          options: { opensAppToForeground: true },
        },
        {
          identifier: 'dismiss',
          buttonTitle: 'Dismiss',
          options: { isDestructive: true },
        },
      ]);

    } catch (error) {
    }
  }

  // Play the user's selected notification sound
  async playCustomNotificationSound() {
    try {
      // Stop any currently playing sound
      if (this.currentSound) {
        try {
          await this.currentSound.stopAsync();
          await this.currentSound.unloadAsync();
        } catch (stopError) {
        }
        this.currentSound = null;
      }

      // Get the selected sound
      const soundId = this.userPreferences?.notification_sound_id;
      if (!soundId) {
        return false;
      }

      // Get available sounds to find the file path
      const soundsResponse = await ApiService.getAvailableNotificationSounds();
      if (!soundsResponse.success) {
        return false;
      }

      const selectedSound = soundsResponse.data.sounds?.find(s => s.id === soundId);
      if (!selectedSound || !selectedSound.file_path) {
        return false;
      }
      // Configure audio mode for notification playback with minimal, compatible settings
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (audioModeError) {
        // Fallback to basic audio mode
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      }

      // Create and play the sound
      const soundObject = new Audio.Sound();
      this.currentSound = soundObject;

      // Fix the double protocol issue and use correct localhost URL
      const baseUrl = 'http://localhost:8080';
      const soundUri = selectedSound.file_path.startsWith('/')
        ? `${baseUrl}${selectedSound.file_path}`
        : `${baseUrl}/${selectedSound.file_path}`;

      await soundObject.loadAsync({
        uri: soundUri,
        shouldPlay: false,
        isLooping: false,
      });

      // Set volume based on user preference
      const volume = Math.max(0.1, Math.min(1.0, (this.userPreferences.volume_level || 80) / 100));
      await soundObject.setVolumeAsync(volume);
      // Play the sound
      await soundObject.playAsync();
      soundObject.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          soundObject.unloadAsync().catch(console.error);
          if (this.currentSound === soundObject) {
            this.currentSound = null;
          }
        } else if (status.error) {
          soundObject.unloadAsync().catch(console.error);
          if (this.currentSound === soundObject) {
            this.currentSound = null;
          }
        }
      });

      return true;

    } catch (error) {
      return false;
    }
  }

  // Fallback to system notification sound
  async playSystemNotificationSound() {
    try {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (audioModeError) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      }

      if (Platform.OS === 'ios') {
        // Use iOS system notification sound
        const { sound } = await Audio.Sound.createAsync(
          { uri: 'system://notification' },
          { shouldPlay: true, volume: 0.8 }
        );

        // Clean up after playing
        setTimeout(() => {
          sound.unloadAsync().catch(console.error);
        }, 3000);

      } else {
      }

    } catch (error) {
      // Last resort: try to trigger any available sound
      try {
        Vibration.vibrate(200); // At least provide haptic feedback
      } catch (vibError) {
      }
    }
  }

  // Request notification permissions with comprehensive settings
  async requestPermissions(userInitiated = false) {
    if (this.isWeb) {
      try {
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          return permission === 'granted';
        } else {
          return false;
        }
      } catch (erraor) {
        return false;
      }
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Only request permissions if they're not already granted
      if (existingStatus !== 'granted') {
        // If this is not user-initiated, don't request permissions to avoid the error
        if (!userInitiated) {
          return false;
        }

        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowDisplayInCarPlay: true,
            allowCriticalAlerts: false, // Don't request critical alerts by default
            allowProvisional: false,
            allowAnnouncements: true,
          },
          android: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });

        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return false;
      }

     // Also request audio permissions for custom sounds (only if notifications are granted)
      try {
        await Audio.requestPermissionsAsync();
      } catch (audioError) {
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // Initialize the service (call this after app startup)
  async initialize() {
    if (this.isInitialized) return true;

    try {
      // Check existing permissions but don't request them automatically
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      if (existingStatus !== 'granted') {
      }

      // Load user preferences
      await this.loadUserPreferences();

      // Set up audio session
      await this.setupAudioSession();

      // Set up notification channels (Android)
      await this.setupNotificationChannels();

      this.isInitialized = true;
      return true;

    } catch (error) {
      return false;
    }
  }

  // Request permissions when user explicitly wants to enable notifications
  async requestPermissionsFromUser() {
    return await this.requestPermissions(true); // Mark as user-initiated
  }

  // Check if notifications are enabled
  async areNotificationsEnabled() {
    if (this.isWeb) {
      if ('Notification' in window) {
        return Notification.permission === 'granted';
      }
      return false;
    }

    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      return false;
    }
  }

  // Get notification permission status with user-friendly message
  async getPermissionStatus() {
    try {
      const { status } = await Notifications.getPermissionsAsync();

      const statusMessages = {
        'granted': 'Notifications are enabled',
        'denied': 'Notifications are disabled. Please enable them in device settings.',
        'undetermined': 'Notification permissions not yet requested'
      };

      return {
        status,
        enabled: status === 'granted',
        message: statusMessages[status] || 'Unknown notification status'
      };
    } catch (error) {
      return {
        status: 'error',
        enabled: false,
        message: 'Unable to check notification permissions'
      };
    }
  }

  // Setup audio session for reliable sound playbook
  async setupAudioSession() {
    if (this.isWeb) {
      return;
    }

    try {
      // Use minimal, compatible audio configuration
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      // Try with minimal config as fallback
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      } catch (fallbackError) {
      }
    }
  }

  // Setup notification channels for Android
  async setupNotificationChannels() {
    if (this.isWeb) {
      return;
    }

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default notifications',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });

        await Notifications.setNotificationChannelAsync('financial', {
          name: 'Financial alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });

        await Notifications.setNotificationChannelAsync('chama', {
          name: 'Chama notifications',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
      }
    } catch (error) {
    }
  }

  // Schedule a local notification (for testing)
  async scheduleTestNotification(title, body, soundId = null) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      // If soundId is provided, temporarily update preferences for this test
      if (soundId) {
        const originalPrefs = this.userPreferences;
        this.userPreferences = {
          ...this.userPreferences,
          sound_enabled: true,
          notification_sound_id: soundId,
        };

        // Schedule the notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: title || 'Test Notification',
            body: body || 'This is a test notification with your selected sound.',
            sound: false, // We'll handle sound ourselves
          },
          trigger: { seconds: 1 },
        });

        // Restore original preferences after a delay
        setTimeout(() => {
          this.userPreferences = originalPrefs;
        }, 5000);
      } else {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: title || 'Test Notification',
            body: body || 'This is a test notification.',
            sound: true, // Use system sound
          },
          trigger: { seconds: 1 },
        });
      }
    } catch (error) {
    }
  }

  // Enhanced test notification with better feedback
  async testNotificationWithSound(soundId) {
    try {
      // Ensure we have permissions first (user-initiated)
      const hasPermissions = await this.requestPermissionsFromUser();
      if (!hasPermissions) {
        return false;
      }

      // Temporarily update preferences for testing
      const originalPrefs = this.userPreferences;
      this.userPreferences = {
        ...this.userPreferences,
        sound_enabled: true,
        vibration_enabled: true,
        notification_sound_id: soundId,
        volume_level: 80,
      };

      // Schedule test notification with comprehensive settings
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'VaultKe Test Notification',
          body: 'Testing your selected notification sound and vibration. This should ring and notify you!',
          sound: false, // We handle sound ourselves for custom sounds
          badge: 1,
          categoryIdentifier: 'default',
          data: {
            type: 'test',
            soundId: soundId,
            timestamp: Date.now()
          },
        },
        trigger: {
          seconds: 1,
          channelId: 'default', // For Android
        },
      });

      // Also trigger immediate sound and vibration for testing
      setTimeout(async () => {
        try {
          // Force play the sound immediately as backup
          await this.forcePlayNotificationSound(soundId);

          // Force vibration
          if (this.userPreferences?.vibration_enabled !== false) {
            Vibration.vibrate([0, 250, 100, 250]);
          }
        } catch (immediateError) {
        }
      }, 500);

      // Restore original preferences after test
      setTimeout(() => {
        this.userPreferences = originalPrefs;
      }, 15000); // Give more time for the test

      return true;

    } catch (error) {
      return false;
    }
  }

  // Force play notification sound (for testing)
  async forcePlayNotificationSound(soundId = null) {
    try {
      if (soundId) {
        // Temporarily set the sound ID
        const originalSoundId = this.userPreferences?.notification_sound_id;
        if (this.userPreferences) {
          this.userPreferences.notification_sound_id = soundId;
          this.userPreferences.sound_enabled = true;
        }

        const played = await this.playCustomNotificationSound();

        // Restore original sound ID
        if (this.userPreferences && originalSoundId) {
          this.userPreferences.notification_sound_id = originalSoundId;
        }

        return played;
      } else {
        return await this.playSystemNotificationSound();
      }
    } catch (error) {
      return false;
    }
  }

  // Verify notification system is working properly
  async verifyNotificationSystem() {
    try {
      const results = {
        permissions: false,
        audioSession: false,
        preferences: false,
        channels: false,
        overall: false
      };

      // Check permissions
      const { status } = await Notifications.getPermissionsAsync();
      results.permissions = status === 'granted';

      // Check audio session
      try {
        await this.setupAudioSession();
        results.audioSession = true;
      } catch (audioError) {
      }

      // Check preferences
      await this.loadUserPreferences();
      results.preferences = this.userPreferences !== null;
      // Check channels (Android)
      if (Platform.OS === 'android') {
        try {
          await this.setupNotificationChannels();
          results.channels = true;
        } catch (channelError) {
        }
      } else {
        results.channels = true; // Not needed on iOS
      }

      // Overall status
      results.overall = results.permissions && results.audioSession && results.preferences && results.channels;
      return results;

    } catch (error) {
      return { overall: false, error: error.message };
    }
  }

  // Clean up resources
  cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }
    if (this.currentSound) {
      this.currentSound = null;
    }

    this.isInitialized = false;
  }
}

// Create and export a singleton instance
const notificationService = new NotificationService();
export default notificationService;
