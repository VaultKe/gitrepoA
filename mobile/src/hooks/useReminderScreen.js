import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import ReminderService from '../services/reminderService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  getDefaultDateTime,
  generateReminderId,
  scheduleNotification,
  scheduleRecurringNotifications,
  cancelNotifications,
  REMINDER_STORAGE_KEY,
} from '../utils/reminderHelpers';

const useReminderScreen = () => {

  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [filterValue, setFilterValue] = useState('all');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    ...getDefaultDateTime(),
    type: 'once',
    isEnabled: true,
  });

  const backendAvailabilityRef = useRef({ available: null, checkedAt: 0 });
  const BACKEND_AVAILABILITY_TTL = 30000;

  const checkBackendAvailability = async () => {
    const now = Date.now();
    if (backendAvailabilityRef.current.available !== null &&
        now - backendAvailabilityRef.current.checkedAt < BACKEND_AVAILABILITY_TTL) {
      return backendAvailabilityRef.current.available;
    }

    try {
      const available = await ReminderService.isServiceAvailable();
      backendAvailabilityRef.current = { available, checkedAt: now };
      return available;
    } catch {
      return false;
    }
  };

  const requestNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please enable notifications to receive reminders.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      // silent
    }
  };

  const loadReminders = async () => {
    try {
      setLoading(true);

      const isBackendAvailable = await checkBackendAvailability();

      if (isBackendAvailable) {
        const backendReminders = await ReminderService.getUserReminders();
        const formattedReminders = backendReminders.map(reminder =>
          ReminderService.formatReminderForFrontend(reminder)
        );

        const sortedReminders = formattedReminders.sort((a, b) =>
          new Date(a.dateTime) - new Date(b.dateTime)
        );
        setReminders(sortedReminders);

        await migrateLocalReminders();
      } else {
        await loadLocalReminders();
      }
    } catch (error) {
      await loadLocalReminders();
    } finally {
      setLoading(false);
    }
  };

  const loadLocalReminders = async () => {
    try {
      const storedReminders = await AsyncStorage.getItem(REMINDER_STORAGE_KEY);
      if (storedReminders) {
        const parsedReminders = JSON.parse(storedReminders);
        const sortedReminders = parsedReminders.sort((a, b) =>
          new Date(a.dateTime) - new Date(b.dateTime)
        );
        setReminders(sortedReminders);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load reminders');
    }
  };

  const migrateLocalReminders = async () => {
    try {
      const storedReminders = await AsyncStorage.getItem(REMINDER_STORAGE_KEY);
      if (storedReminders) {
        const localReminders = JSON.parse(storedReminders);
        if (localReminders.length > 0) {
          await ReminderService.syncLocalReminders(localReminders);
          await AsyncStorage.removeItem(REMINDER_STORAGE_KEY);
        }
      }
    } catch (error) {
      // silent
    }
  };

  const saveReminders = async (updatedReminders) => {
    try {
      setReminders(updatedReminders);

      const isBackendAvailable = await checkBackendAvailability();
      if (!isBackendAvailable) {
        await AsyncStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(updatedReminders));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save reminders');
    }
  };

  const handleAddReminder = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a reminder title');
      return;
    }

    if (!formData.date.trim()) {
      Alert.alert('Error', 'Please select a date');
      return;
    }

    if (!formData.time.trim()) {
      Alert.alert('Error', 'Please select a time');
      return;
    }

    const dateTimeString = `${formData.date}T${formData.time}:00`;
    const selectedDateTime = new Date(dateTimeString);
    const currentDateTime = new Date();

    if (isNaN(selectedDateTime.getTime())) {
      Alert.alert('Error', 'Please enter a valid date and time');
      return;
    }

    if (selectedDateTime <= currentDateTime) {
      Alert.alert('Error', 'Please select a future date and time');
      return;
    }

    try {
      const isBackendAvailable = await checkBackendAvailability();

      if (isBackendAvailable) {
        const backendData = {
          ...formData,
          dateTime: `${formData.date}T${formData.time}:00.000Z`
        };

        const createdReminder = await ReminderService.createReminder(backendData);
        const formattedReminder = ReminderService.formatReminderForFrontend(createdReminder);
        if (formData.isEnabled) {
          if (formData.type === 'once') {
            await scheduleNotification(formattedReminder);
          } else {
            await scheduleRecurringNotifications(formattedReminder);
          }
        }

        await loadReminders();
      } else {
        const newReminder = {
          id: generateReminderId(),
          title: formData.title,
          description: formData.description,
          dateTime: `${formData.date}T${formData.time}:00.000Z`,
          type: formData.type,
          isEnabled: formData.isEnabled,
          createdAt: new Date().toISOString(),
          notificationIds: [],
        };
        if (formData.isEnabled) {
          if (formData.type === 'once') {
            const notificationId = await scheduleNotification(newReminder);
            if (notificationId) {
              newReminder.notificationIds = [notificationId];
            }
          } else {
            const notificationIds = await scheduleRecurringNotifications(newReminder);
            newReminder.notificationIds = notificationIds;
          }
        }

        const updatedReminders = [...reminders, newReminder].sort((a, b) =>
          new Date(a.dateTime) - new Date(b.dateTime)
        );

        await saveReminders(updatedReminders);
      }

      resetForm();
      setShowAddModal(false);
      Alert.alert('Success', 'Reminder added successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to add reminder');
    }
  };

  const handleEditReminder = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a reminder title');
      return;
    }

    try {
      const isBackendAvailable = await checkBackendAvailability();

      if (isBackendAvailable) {
        const updatedReminder = await ReminderService.updateReminder(editingReminder.id, formData);
        const formattedReminder = ReminderService.formatReminderForFrontend(updatedReminder);

        if (editingReminder.notificationIds) {
          await cancelNotifications(editingReminder.notificationIds);
        }

        if (formData.isEnabled && new Date(formData.dateTime) > new Date()) {
          if (formData.type === 'once') {
            await scheduleNotification(formattedReminder);
          } else {
            await scheduleRecurringNotifications(formattedReminder);
          }
        }
        await loadReminders();
      } else {
        if (editingReminder.notificationIds) {
          await cancelNotifications(editingReminder.notificationIds);
        }

        const updatedReminder = {
          ...editingReminder,
          ...formData,
          notificationIds: [],
        };

        if (formData.isEnabled && new Date(formData.dateTime) > new Date()) {
          if (formData.type === 'once') {
            const notificationId = await scheduleNotification(updatedReminder);
            if (notificationId) {
              updatedReminder.notificationIds = [notificationId];
            }
          } else {
            const notificationIds = await scheduleRecurringNotifications(updatedReminder);
            updatedReminder.notificationIds = notificationIds;
          }
        }
        const updatedReminders = reminders.map(reminder =>
          reminder.id === editingReminder.id ? updatedReminder : reminder
        ).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

        await saveReminders(updatedReminders);
      }

      resetForm();
      setShowAddModal(false);
      setEditingReminder(null);
      Alert.alert('Success', 'Reminder updated successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update reminder');
    }
  };

  const handleDeleteReminder = async (reminder) => {
    try {
      const updatedReminders = reminders.filter(r => r.id !== reminder.id);
      setReminders(updatedReminders);

      const isBackendAvailable = await checkBackendAvailability();

      if (isBackendAvailable) {
        await ReminderService.deleteReminder(reminder.id);

        if (reminder.notificationIds) {
          await cancelNotifications(reminder.notificationIds);
        }

        await loadReminders();
      } else {
        await saveReminders(updatedReminders);

        if (reminder.notificationIds) {
          await cancelNotifications(reminder.notificationIds);
        }
      }

      Toast.show({
        type: 'success',
        text1: 'Reminder Deleted',
        text2: 'Your reminder has been removed successfully',
        position: 'bottom',
        visibilityTime: 2000,
      });
    } catch (error) {
      await loadReminders();
      Toast.show({
        type: 'error',
        text1: 'Delete Failed',
        text2: 'Failed to delete reminder. Please try again.',
        position: 'bottom',
        visibilityTime: 3000,
      });
    }
  };

  const handleToggleReminder = async (reminder) => {
    try {
      const isBackendAvailable = await checkBackendAvailability();

      if (isBackendAvailable) {
        const updatedReminder = await ReminderService.toggleReminder(reminder.id);
        const formattedReminder = ReminderService.formatReminderForFrontend(updatedReminder);

        if (formattedReminder.isEnabled) {
          if (new Date(formattedReminder.dateTime) > new Date()) {
            if (formattedReminder.type === 'once') {
              await scheduleNotification(formattedReminder);
            } else {
              await scheduleRecurringNotifications(formattedReminder);
            }
          }
        } else {
          if (reminder.notificationIds) {
            await cancelNotifications(reminder.notificationIds);
          }
        }

        await loadReminders();
      } else {
        const updatedReminder = { ...reminder, isEnabled: !reminder.isEnabled };

        if (updatedReminder.isEnabled) {
          if (new Date(reminder.dateTime) > new Date()) {
            if (reminder.type === 'once') {
              const notificationId = await scheduleNotification(updatedReminder);
              if (notificationId) {
                updatedReminder.notificationIds = [notificationId];
              }
            } else {
              const notificationIds = await scheduleRecurringNotifications(updatedReminder);
              updatedReminder.notificationIds = notificationIds;
            }
          }
        } else {
          if (reminder.notificationIds) {
            await cancelNotifications(reminder.notificationIds);
          }
          updatedReminder.notificationIds = [];
        }

        const updatedReminders = reminders.map(r =>
          r.id === reminder.id ? updatedReminder : r
        );

        await saveReminders(updatedReminders);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update reminder');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      ...getDefaultDateTime(),
      type: 'once',
      isEnabled: true,
    });
  };

  const openAddModal = () => {
    resetForm();
    setEditingReminder(null);
    setShowAddModal(true);
  };

  const openEditModal = (reminder) => {
    const reminderDate = new Date(reminder.dateTime);

    setFormData({
      title: reminder.title,
      description: reminder.description || '',
      date: reminderDate.toISOString().split('T')[0],
      time: reminderDate.toTimeString().slice(0, 5),
      type: reminder.type,
      isEnabled: reminder.isEnabled,
    });
    setEditingReminder(reminder);
    setShowAddModal(true);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadReminders();
    } catch (error) {
      console.warn('Reminders refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const filteredReminders = reminders.filter(reminder => {
    const matchesSearch = !searchValue ||
      reminder.title.toLowerCase().includes(searchValue.toLowerCase()) ||
      (reminder.description && reminder.description.toLowerCase().includes(searchValue.toLowerCase()));

    const matchesFilter = filterValue === 'all' || reminder.type === filterValue;

    return matchesSearch && matchesFilter;
  });

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    requestNotificationPermissions();
    loadReminders();
  }, []);

  return {
    // State
    reminders,
    loading,
    refreshing,
    showAddModal,
    editingReminder,
    searchValue,
    filterValue,
    formData,
    filteredReminders,
    // Setters
    setShowAddModal,
    setSearchValue,
    setFilterValue,
    setFormData,
    // Handlers
    handleAddReminder,
    handleEditReminder,
    handleDeleteReminder,
    handleToggleReminder,
    resetForm,
    openAddModal,
    openEditModal,
    onRefresh,
  };
};

export default useReminderScreen;
