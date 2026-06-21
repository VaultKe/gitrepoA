import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
import webSocketService from './websocket';

class NotificationService {
  constructor() {
    this.isInitialized = false;
    this.appState = AppState.currentState;
  }

  async initialize() {
    if (this.isInitialized) return;
    this.setupNotificationHandler();
    this.setupAppStateListener();
    this.isInitialized = true;
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

  cleanup() {
    if (this.appStateListener) {
      this.appStateListener.remove();
    }
    this.isInitialized = false;
  }
}

const notificationService = new NotificationService();
export default notificationService;