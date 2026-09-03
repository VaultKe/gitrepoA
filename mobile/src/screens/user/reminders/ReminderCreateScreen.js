import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView, Switch, Alert, useWindowDimensions } from 'react-native';
import Card from '../../../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, borderRadius } from '../../../utils/theme';
import ReminderTypeSelector from '../../../components/reminders/ReminderTypeSelector';
import ReminderService from '../../../services/reminderService';
import Toast from 'react-native-toast-message';
import { getDefaultDateTime, scheduleNotification, scheduleRecurringNotifications } from '../../../utils/reminderHelpers';

const ReminderCreateScreen = ({ navigation, route }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    ...getDefaultDateTime(),
    type: 'once',
    isEnabled: true,
    sound: 'default',
  });
  const [saving, setSaving] = useState(false);

  const formatDateInput = (text) => {
    let cleaned = text.replace(/[^\d-]/g, '');
    if (cleaned.length >= 4 && cleaned.charAt(4) !== '-') {
      cleaned = cleaned.slice(0, 4) + '-' + cleaned.slice(4);
    }
    if (cleaned.length >= 7 && cleaned.charAt(7) !== '-') {
      cleaned = cleaned.slice(0, 7) + '-' + cleaned.slice(7);
    }
    return cleaned.slice(0, 10);
  };

  const formatTimeInput = (text) => {
    let cleaned = text.replace(/[^\d:]/g, '');
    if (cleaned.length >= 2 && cleaned.charAt(2) !== ':') {
      cleaned = cleaned.slice(0, 2) + ':' + cleaned.slice(2);
    }
    return cleaned.slice(0, 5);
  };

  const updateForm = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    const editing = route?.params?.reminder;
    if (editing) {
      const reminderDate = new Date(editing.dateTime);
      setFormData({
        title: editing.title || '',
        description: editing.description || '',
        date: reminderDate.toISOString().split('T')[0],
        time: reminderDate.toTimeString().slice(0, 5),
        type: editing.type || 'once',
        isEnabled: editing.isEnabled !== false,
        sound: editing.sound || 'default',
      });
    }
  }, [route]);

  const handleSave = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Validation', 'Please enter a title');
      return;
    }
    if (!formData.date || !formData.time) {
      Alert.alert('Validation', 'Please enter date and time');
      return;
    }

    const dateTimeIso = `${formData.date}T${formData.time}:00.000Z`;
    const payload = {
      title: formData.title,
      description: formData.description || null,
      type: formData.type,
      dateTime: dateTimeIso,
      isEnabled: formData.isEnabled,
      sound: formData.sound || 'default',
    };

    try {
      setSaving(true);
      if (route?.params?.reminder) {
        // Editing existing reminder
        const editingId = route.params.reminder.id;
        const updated = await ReminderService.updateReminder(editingId, payload);
        const frontendReminder = {
          id: updated.id,
          title: updated.title,
          description: updated.description,
          type: updated.reminderType || payload.type,
          dateTime: updated.scheduledAt || payload.dateTime,
          isEnabled: updated.isEnabled,
          sound: updated.sound || payload.sound,
        };

        // cancel existing notifications then reschedule
        // ReminderService.updateReminder expected to return updated object; scheduling handled below
        if (formData.isEnabled) {
          if (formData.type === 'once') {
            await scheduleNotification(frontendReminder);
          } else {
            await scheduleRecurringNotifications(frontendReminder);
          }
        }

        Toast.show({ type: 'success', text1: 'Reminder updated' });
        navigation.goBack();
        return;
      }

      const created = await ReminderService.createReminder({
        title: payload.title,
        description: payload.description,
        type: payload.type,
        dateTime: payload.dateTime,
        isEnabled: payload.isEnabled,
        sound: payload.sound,
      });

      const frontendReminder = {
        id: created.id,
        title: created.title,
        description: created.description,
        type: created.reminderType || payload.type,
        dateTime: created.scheduledAt || payload.dateTime,
        isEnabled: created.isEnabled,
      };

      if (formData.isEnabled) {
        if (formData.type === 'once') {
          await scheduleNotification(frontendReminder);
        } else {
          await scheduleRecurringNotifications(frontendReminder);
        }
      }

      Toast.show({ type: 'success', text1: 'Reminder created' });
      navigation.goBack();
    } catch (error) {
      console.warn('Failed to create reminder', error);
      Alert.alert('Error', 'Failed to create reminder. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Top filter/header removed from create form — use Reminders page header */}

      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Card variant="outlined" style={{ marginBottom: spacing.md, borderRadius: 8, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Title *</Text>
          <TextInput
            value={formData.title}
            onChangeText={(t) => updateForm('title', t)}
            placeholder="Enter title"
            placeholderTextColor={colors.textSecondary}
            style={{ borderWidth: 0, borderRadius: 6, padding: 8, backgroundColor: 'transparent', color: colors.text }}
          />
        </Card>

        <Card variant="outlined" style={{ marginBottom: spacing.md, borderRadius: 8, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Description</Text>
          <TextInput
            value={formData.description}
            onChangeText={(t) => updateForm('description', t)}
            placeholder="Optional"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            style={{ borderWidth: 0, borderRadius: 6, padding: 8, backgroundColor: 'transparent', color: colors.text, minHeight: 100 }}
          />
        </Card>

        <Card variant="outlined" style={{ marginBottom: spacing.md, borderRadius: 8, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Date *</Text>
          <TextInput
            value={formData.date}
            onChangeText={(t) => updateForm('date', formatDateInput(t))}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            style={{ borderWidth: 0, borderRadius: 6, padding: 8, backgroundColor: 'transparent', color: colors.text }}
          />
        </Card>

        <Card variant="outlined" style={{ marginBottom: spacing.md, borderRadius: 8, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Time *</Text>
          <TextInput
            value={formData.time}
            onChangeText={(t) => updateForm('time', formatTimeInput(t))}
            placeholder="HH:MM"
            placeholderTextColor={colors.textSecondary}
            style={{ borderWidth: 0, borderRadius: 6, padding: 8, backgroundColor: 'transparent', color: colors.text }}
          />
        </Card>

        <Card variant="outlined" style={{ marginBottom: spacing.md, borderRadius: 8, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Repeat</Text>
          <ReminderTypeSelector selectedType={formData.type} onTypeChange={(t) => updateForm('type', t)} />
        </Card>

        <Card variant="outlined" style={{ marginBottom: spacing.md, borderRadius: 8, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Enable Notifications</Text>
            <Text style={{ color: colors.textSecondary }}>Receive notifications for this reminder</Text>
          </View>
          <Switch value={formData.isEnabled} onValueChange={(v) => updateForm('isEnabled', v)} />
        </Card>

        <Card variant="outlined" style={{ marginBottom: spacing.md, borderRadius: 8, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Notification Tone</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {['default', 'chime', 'bell', 'alert'].map((tone) => (
              <TouchableOpacity
                key={tone}
                onPress={() => updateForm('sound', tone)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: formData.sound === tone ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: formData.sound === tone ? colors.primary : colors.border,
                }}
              >
                <Text style={{ color: formData.sound === tone ? '#fff' : colors.text }}>{tone}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Bottom action bar with Cancel and Save */}
      <View style={{ padding: spacing.sm, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.background, flexDirection: 'row', justifyContent: 'space-between' }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ color: colors.text }}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.primary }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ReminderCreateScreen;
