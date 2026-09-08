import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const REMINDER_STORAGE_KEY = 'user_reminders';
const REMINDER_CHANNEL = 'reminders';

// A dedicated high-importance Android channel so a reminder reliably rings and
// shows on the lock screen even when the app is backgrounded or killed. The
// exact tone the user picked in Settings is played by notificationService when
// the app is in the foreground; the OS channel sound covers the rest.
let _channelReady = false;
const ensureReminderChannel = async () => {
  if (Platform.OS !== 'android' || _channelReady) return;
  try {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance?.MAX ?? 5,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      enableLights: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC ?? 1,
      showBadge: true,
    });
    _channelReady = true;
  } catch {
    // non-fatal
  }
};

export const getDefaultDateTime = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return {
    date: tomorrow.toISOString().split('T')[0],
    time: '09:00',
  };
};

export const generateReminderId = () => {
  return `reminder_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

export const scheduleNotification = async (reminder) => {
  try {
    const trigger = new Date(reminder.dateTime);
    if (isNaN(trigger.getTime()) || trigger <= new Date()) {
      return null;
    }
    await ensureReminderChannel();

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.description || 'Reminder',
        // `true` = OS notification sound (for background/killed). The user's
        // own tone is played by notificationService while the app is open.
        sound: true,
        data: { type: 'reminder', reminderId: reminder.id || null },
        priority: Notifications.AndroidNotificationPriority?.MAX ?? Notifications.AndroidNotificationPriority?.HIGH,
      },
      trigger: Platform.OS === 'android'
        ? { date: trigger, channelId: REMINDER_CHANNEL }
        : { date: trigger },
    });

    return notificationId;
  } catch (error) {
    return null;
  }
};

export const scheduleRecurringNotifications = async (reminder) => {
  try {
    const notificationIds = [];
    const baseDate = new Date(reminder.dateTime);
    if (isNaN(baseDate.getTime())) return [];
    const now = new Date();
    await ensureReminderChannel();

    for (let i = 0; i < 10; i++) {
      let nextDate = new Date(baseDate);

      switch (reminder.type) {
        case 'daily':
          nextDate.setDate(baseDate.getDate() + i);
          break;
        case 'weekly':
          nextDate.setDate(baseDate.getDate() + (i * 7));
          break;
        case 'monthly':
          nextDate.setMonth(baseDate.getMonth() + i);
          break;
        default:
          continue;
      }

      if (nextDate > now) {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: reminder.title,
            body: reminder.description || 'Reminder',
            sound: true,
            data: { type: 'reminder', reminderId: reminder.id || null },
            priority: Notifications.AndroidNotificationPriority?.MAX ?? Notifications.AndroidNotificationPriority?.HIGH,
          },
          trigger: Platform.OS === 'android'
            ? { date: nextDate, channelId: REMINDER_CHANNEL }
            : { date: nextDate },
        });

        if (notificationId) {
          notificationIds.push(notificationId);
        }
      }
    }

    return notificationIds;
  } catch (error) {
    return [];
  }
};

export const cancelNotifications = async (notificationIds) => {
  try {
    if (Array.isArray(notificationIds)) {
      for (const id of notificationIds) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
    } else if (notificationIds) {
      await Notifications.cancelScheduledNotificationAsync(notificationIds);
    }
  } catch (error) {
    // silent
  }
};
