import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Switch,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import Toast from 'react-native-toast-message';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import { formatDate } from '../../../utils/dateUtils';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import ReminderService from '../../../services/reminderService';
import ReminderItem from './components/ReminderItem';
import EmptyRemindersState from './components/EmptyRemindersState';
import AddEditReminderModal from './components/AddEditReminderModal';
import ReminderTableHeader from './components/ReminderTableHeader';
import styles from '../../../styles/ReminderScreenStyles';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const REMINDER_STORAGE_KEY = 'user_reminders';

const ReminderScreen = () => {
  const { theme } = useApp();
  const { width } = useWindowDimensions();
  const colors = getThemeColors(theme);

  const isDesktop = width >= 1024;

  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [filterValue, setFilterValue] = useState('all');

  // Form state
  const getDefaultDateTime = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // Set to 9:00 AM tomorrow
    return {
      date: tomorrow.toISOString().split('T')[0], // YYYY-MM-DD format
      time: '09:00' // HH:MM format
    };
  };



  const [formData, setFormData] = useState({
    title: '',
    description: '',
    ...getDefaultDateTime(),
    type: 'once', // 'once', 'daily', 'weekly', 'monthly'
    isEnabled: true,
  });

  // Request notification permissions on mount
  useEffect(() => {
    requestNotificationPermissions();
    loadReminders();
  }, []);

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
      // console.error('Error requesting notification permissions:', error);
    }
  };

  const loadReminders = async () => {
    try {
      setLoading(true);

      // Check if backend service is available
      const isBackendAvailable = await ReminderService.isServiceAvailable();

      if (isBackendAvailable) {
        // Load from backend
        const backendReminders = await ReminderService.getUserReminders();
        const formattedReminders = backendReminders.map(reminder =>
          ReminderService.formatReminderForFrontend(reminder)
        );

        // Sort by date/time
        const sortedReminders = formattedReminders.sort((a, b) =>
          new Date(a.dateTime) - new Date(b.dateTime)
        );
        setReminders(sortedReminders);

        // Migrate local reminders if any exist
        await migrateLocalReminders();
      } else {
        // Fallback to local storage
        await loadLocalReminders();
      }
    } catch (error) {
      // console.error('Error loading reminders:', error);
      // Fallback to local storage on error
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
        // Sort by date/time
        const sortedReminders = parsedReminders.sort((a, b) =>
          new Date(a.dateTime) - new Date(b.dateTime)
        );
        setReminders(sortedReminders);
      }
    } catch (error) {
      // console.error('Error loading local reminders:', error);
      Alert.alert('Error', 'Failed to load reminders');
    }
  };

  const migrateLocalReminders = async () => {
    try {
      const storedReminders = await AsyncStorage.getItem(REMINDER_STORAGE_KEY);
      if (storedReminders) {
        const localReminders = JSON.parse(storedReminders);
        if (localReminders.length > 0) {
          // console.log('Migrating local reminders to backend...');
          await ReminderService.syncLocalReminders(localReminders);
          // Clear local storage after successful migration
          await AsyncStorage.removeItem(REMINDER_STORAGE_KEY);
          // console.log('Local reminders migrated successfully');
        }
      }
    } catch (error) {
      // console.warn('Failed to migrate local reminders:', error);
    }
  };

  const saveReminders = async (updatedReminders) => {
    try {
      // Update local state immediately for better UX
      setReminders(updatedReminders);

      // Try to sync with backend, fallback to local storage
      const isBackendAvailable = await ReminderService.isServiceAvailable();
      if (!isBackendAvailable) {
        await AsyncStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(updatedReminders));
      }
    } catch (error) {
      // console.error('Error saving reminders:', error);
      Alert.alert('Error', 'Failed to save reminders');
    }
  };

  const generateReminderId = () => {
    return `reminder_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  };

  const scheduleNotification = async (reminder) => {
    try {
      const trigger = new Date(reminder.dateTime);

      // Don't schedule if the time has already passed
      if (trigger <= new Date()) {
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title,
          body: reminder.description || 'Reminder notification',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          date: trigger,
        },
      });

      return notificationId;
    } catch (error) {
      // console.error('Error scheduling notification:', error);
      return null;
    }
  };

  const scheduleRecurringNotifications = async (reminder) => {
    try {
      const notificationIds = [];
      const baseDate = new Date(reminder.dateTime);
      const now = new Date();

      // Schedule up to 10 future occurrences
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

        // Only schedule future notifications
        if (nextDate > now) {
          const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: reminder.title,
              body: reminder.description || 'Recurring reminder',
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: {
              date: nextDate,
            },
          });

          if (notificationId) {
            notificationIds.push(notificationId);
          }
        }
      }

      return notificationIds;
    } catch (error) {
      // console.error('Error scheduling recurring notifications:', error);
      return [];
    }
  };

  const cancelNotifications = async (notificationIds) => {
    try {
      if (Array.isArray(notificationIds)) {
        for (const id of notificationIds) {
          await Notifications.cancelScheduledNotificationAsync(id);
        }
      } else if (notificationIds) {
        await Notifications.cancelScheduledNotificationAsync(notificationIds);
      }
    } catch (error) {
      // console.error('Error canceling notifications:', error);
    }
  };

  const handleAddReminder = async () => {

    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a reminder title');
      return;
    }

    // Validate date field
    if (!formData.date.trim()) {
      Alert.alert('Error', 'Please select a date');
      return;
    }

    // Validate time field
    if (!formData.time.trim()) {
      Alert.alert('Error', 'Please select a time');
      return;
    }

    // Combine date and time and validate
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
      const isBackendAvailable = await ReminderService.isServiceAvailable();

      if (isBackendAvailable) {
        const backendData = {
          ...formData,
          dateTime: `${formData.date}T${formData.time}:00.000Z` // ISO format for backend
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
          dateTime: `${formData.date}T${formData.time}:00.000Z`, // Combined date/time
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
      // console.error('Error adding reminder:', error);
      Alert.alert('Error', 'Failed to add reminder');
    }
  };

  const handleEditReminder = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a reminder title');
      return;
    }

    try {
      // Try to update reminder via backend first
      const isBackendAvailable = await ReminderService.isServiceAvailable();

      if (isBackendAvailable) {
        const updatedReminder = await ReminderService.updateReminder(editingReminder.id, formData);
        const formattedReminder = ReminderService.formatReminderForFrontend(updatedReminder);

        // Cancel existing notifications
        if (editingReminder.notificationIds) {
          await cancelNotifications(editingReminder.notificationIds);
        }

        // Schedule new notifications if enabled and future date
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

        // Schedule new notifications if enabled and future date
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

      const isBackendAvailable = await ReminderService.isServiceAvailable();

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
      // Try to toggle via backend first
      const isBackendAvailable = await ReminderService.isServiceAvailable();

      if (isBackendAvailable) {
        const updatedReminder = await ReminderService.toggleReminder(reminder.id);
        const formattedReminder = ReminderService.formatReminderForFrontend(updatedReminder);

        // Handle local notifications
        if (formattedReminder.isEnabled) {
          // Enable: schedule notifications
          if (new Date(formattedReminder.dateTime) > new Date()) {
            if (formattedReminder.type === 'once') {
              await scheduleNotification(formattedReminder);
            } else {
              await scheduleRecurringNotifications(formattedReminder);
            }
          }
        } else {
          // Disable: cancel notifications
          if (reminder.notificationIds) {
            await cancelNotifications(reminder.notificationIds);
          }
        }

        // Reload reminders from backend
        await loadReminders();
      } else {
        // Fallback to local storage
        const updatedReminder = { ...reminder, isEnabled: !reminder.isEnabled };

        if (updatedReminder.isEnabled) {
          // Enable: schedule notifications
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
          // Disable: cancel notifications
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
      // console.error('Error toggling reminder:', error);
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
      date: reminderDate.toISOString().split('T')[0], // YYYY-MM-DD format
      time: reminderDate.toTimeString().slice(0, 5), // HH:MM format
      type: reminder.type,
      isEnabled: reminder.isEnabled,
    });
    setEditingReminder(reminder);
    setShowAddModal(true);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadReminders();
    setRefreshing(false);
  }, []);

  // Filter reminders based on search and filter
  const filteredReminders = reminders.filter(reminder => {
    // Search filter
    const matchesSearch = !searchValue ||
      reminder.title.toLowerCase().includes(searchValue.toLowerCase()) ||
      (reminder.description && reminder.description.toLowerCase().includes(searchValue.toLowerCase()));

    // Type filter
    const matchesFilter = filterValue === 'all' || reminder.type === filterValue;

    return matchesSearch && matchesFilter;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading reminders...</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }}
        >
          <Card
            variant="default"
            style={{
              borderRadius: 8,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: 'transparent',
              shadowOpacity: 0,
              shadowRadius: 0,
              shadowOffset: { width: 0, height: 0 },
              elevation: 0,
              marginBottom: spacing.sm,
            }}
          >
            <ReminderTableHeader
              isDesktop={true}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              filterValue={filterValue}
              onFilterChange={setFilterValue}
              onCreate={openAddModal}
              showTableHeader={false}
            />
          </Card>

          <Card
            variant="default"
            style={{
              borderRadius: 8,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: 'transparent',
              shadowOpacity: 0,
              shadowRadius: 0,
              shadowOffset: { width: 0, height: 0 },
              elevation: 0,
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, minWidth: Math.max(width - 32, 760) }}
            >
              <View style={{ width: '100%' }}>
                <ReminderTableHeader
                  isDesktop={true}
                  searchValue={searchValue}
                  onSearchChange={setSearchValue}
                  filterValue={filterValue}
                  onFilterChange={setFilterValue}
                  onCreate={openAddModal}
                  showSearchFilter={false}
                />

                {filteredReminders.length > 0 ? (
                  filteredReminders.map((item, index) => (
                    <ReminderItem
                      key={item.id}
                      reminder={item}
                      onToggle={handleToggleReminder}
                      onEdit={openEditModal}
                      onDelete={handleDeleteReminder}
                      index={index}
                    />
                  ))
                ) : (
                  <EmptyRemindersState onAddReminder={openAddModal} />
                )}
              </View>
            </ScrollView>
          </Card>
        </ScrollView>
      )}

      <AddEditReminderModal
        visible={showAddModal}
        editingReminder={editingReminder}
        formData={formData}
        onFormDataChange={setFormData}
        onCancel={() => {
          setShowAddModal(false);
          setEditingReminder(null);
          resetForm();
        }}
        onSave={() => {
          if (editingReminder) {
            handleEditReminder();
          } else {
            handleAddReminder();
          }
        }}
      />
    </SafeAreaView>
  );
};
export default ReminderScreen;