import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { VaultKeTheme } from '../theme/VaultKeTheme';
import { notificationService } from '../services/NotificationService';
import { audioService } from '../services/AudioService';

const NotificationSettingsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState(null);
  const [availableSounds, setAvailableSounds] = useState([]);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [testingSound, setTestingSound] = useState(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const response = await notificationService.getPreferences();
      
      if (response.success) {
        setPreferences(response.data.preferences);
        setAvailableSounds(response.data.available_sounds);
      } else {
        Alert.alert('Error', 'Failed to load notification preferences');
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
      Alert.alert('Error', 'Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key, value) => {
    try {
      setSaving(true);
      const updatedPreferences = { ...preferences, [key]: value };
      
      const response = await notificationService.updatePreferences({
        [key]: value
      });

      if (response.success) {
        setPreferences(updatedPreferences);
      } else {
        Alert.alert('Error', 'Failed to update preference');
      }
    } catch (error) {
      console.error('Failed to update preference:', error);
      Alert.alert('Error', 'Failed to update preference');
    } finally {
      setSaving(false);
    }
  };

  const testNotificationSound = async (soundId) => {
    try {
      setTestingSound(soundId);
      
      // Play sound locally first
      const sound = availableSounds.find(s => s.id === soundId);
      if (sound && sound.file_path) {
        await audioService.playNotificationSound(sound.file_path);
      }

      // Send test notification
      const response = await notificationService.testSound(soundId);
      
      if (!response.success) {
        Alert.alert('Error', 'Failed to send test notification');
      }
    } catch (error) {
      console.error('Failed to test sound:', error);
      Alert.alert('Error', 'Failed to test notification sound');
    } finally {
      setTestingSound(null);
    }
  };

  const selectNotificationSound = (soundId) => {
    updatePreference('notification_sound_id', soundId);
    setShowSoundPicker(false);
  };

  const renderSoundPicker = () => {
    const selectedSound = availableSounds.find(s => s.id === preferences?.notification_sound_id);

    return (
      <Modal
        visible={showSoundPicker}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowSoundPicker(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Choose Notification Sound
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <FlatList
            data={availableSounds}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.soundItem,
                  { 
                    backgroundColor: colors.surface,
                    borderColor: colors.border
                  }
                ]}
                onPress={() => selectNotificationSound(item.id)}
              >
                <View style={styles.soundItemContent}>
                  <View style={styles.soundInfo}>
                    <Text style={[styles.soundName, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    {item.duration && (
                      <Text style={[styles.soundDuration, { color: colors.textSecondary }]}>
                        {item.duration}s
                      </Text>
                    )}
                  </View>

                  <View style={styles.soundActions}>
                    <TouchableOpacity
                      style={[styles.testButton, { backgroundColor: colors.primary + '20' }]}
                      onPress={() => testNotificationSound(item.id)}
                      disabled={testingSound === item.id}
                    >
                      {testingSound === item.id ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Ionicons name="play" size={16} color={colors.primary} />
                      )}
                    </TouchableOpacity>

                    {preferences?.notification_sound_id === item.id && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading preferences...
        </Text>
      </View>
    );
  }

  const selectedSound = availableSounds.find(s => s.id === preferences?.notification_sound_id);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sound Settings */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Sound & Vibration
        </Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              Sound Enabled
            </Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
              Play sound for notifications
            </Text>
          </View>
          <Switch
            value={preferences?.sound_enabled || false}
            onValueChange={(value) => updatePreference('sound_enabled', value)}
            trackColor={{ false: colors.border, true: colors.primary + '40' }}
            thumbColor={preferences?.sound_enabled ? colors.primary : colors.textSecondary}
          />
        </View>

        {preferences?.sound_enabled && (
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setShowSoundPicker(true)}
          >
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Notification Sound
              </Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                {selectedSound?.name || 'Default Ring'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              Vibration
            </Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
              Vibrate for notifications
            </Text>
          </View>
          <Switch
            value={preferences?.vibration_enabled || false}
            onValueChange={(value) => updatePreference('vibration_enabled', value)}
            trackColor={{ false: colors.border, true: colors.primary + '40' }}
            thumbColor={preferences?.vibration_enabled ? colors.primary : colors.textSecondary}
          />
        </View>
      </View>

      {/* Notification Types */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Notification Types
        </Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              Chama Notifications
            </Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
              Meetings, contributions, updates
            </Text>
          </View>
          <Switch
            value={preferences?.chama_notifications || false}
            onValueChange={(value) => updatePreference('chama_notifications', value)}
            trackColor={{ false: colors.border, true: colors.primary + '40' }}
            thumbColor={preferences?.chama_notifications ? colors.primary : colors.textSecondary}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              Transaction Notifications
            </Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
              Payments, deposits, withdrawals
            </Text>
          </View>
          <Switch
            value={preferences?.transaction_notifications || false}
            onValueChange={(value) => updatePreference('transaction_notifications', value)}
            trackColor={{ false: colors.border, true: colors.primary + '40' }}
            thumbColor={preferences?.transaction_notifications ? colors.primary : colors.textSecondary}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              Reminder Notifications
            </Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
              Personal reminders and alerts
            </Text>
          </View>
          <Switch
            value={preferences?.reminder_notifications || false}
            onValueChange={(value) => updatePreference('reminder_notifications', value)}
            trackColor={{ false: colors.border, true: colors.primary + '40' }}
            thumbColor={preferences?.reminder_notifications ? colors.primary : colors.textSecondary}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              System Notifications
            </Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
              App updates, maintenance alerts
            </Text>
          </View>
          <Switch
            value={preferences?.system_notifications || false}
            onValueChange={(value) => updatePreference('system_notifications', value)}
            trackColor={{ false: colors.border, true: colors.primary + '40' }}
            thumbColor={preferences?.system_notifications ? colors.primary : colors.textSecondary}
          />
        </View>
      </View>

      {/* Quiet Hours */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Quiet Hours
        </Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              Enable Quiet Hours
            </Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
              Reduce notifications during specified hours
            </Text>
          </View>
          <Switch
            value={preferences?.quiet_hours_enabled || false}
            onValueChange={(value) => updatePreference('quiet_hours_enabled', value)}
            trackColor={{ false: colors.border, true: colors.primary + '40' }}
            thumbColor={preferences?.quiet_hours_enabled ? colors.primary : colors.textSecondary}
          />
        </View>

        {preferences?.quiet_hours_enabled && (
          <>
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  Start Time
                </Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  {preferences?.quiet_hours_start || '22:00'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  End Time
                </Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  {preferences?.quiet_hours_end || '07:00'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {renderSoundPicker()}
    </ScrollView>
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
    marginTop: VaultKeTheme.spacing.md,
    fontSize: VaultKeTheme.typography.fontSize.base,
  },
  section: {
    margin: VaultKeTheme.spacing.md,
    borderRadius: VaultKeTheme.borderRadius.lg,
    padding: VaultKeTheme.spacing.md,
  },
  sectionTitle: {
    fontSize: VaultKeTheme.typography.fontSize.lg,
    fontWeight: VaultKeTheme.typography.fontWeight.semibold,
    marginBottom: VaultKeTheme.spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: VaultKeTheme.spacing.sm,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: VaultKeTheme.typography.fontSize.base,
    fontWeight: VaultKeTheme.typography.fontWeight.medium,
  },
  settingDescription: {
    fontSize: VaultKeTheme.typography.fontSize.sm,
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: VaultKeTheme.spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: VaultKeTheme.typography.fontSize.lg,
    fontWeight: VaultKeTheme.typography.fontWeight.semibold,
  },
  soundItem: {
    margin: VaultKeTheme.spacing.sm,
    borderRadius: VaultKeTheme.borderRadius.md,
    borderWidth: 1,
  },
  soundItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: VaultKeTheme.spacing.md,
  },
  soundInfo: {
    flex: 1,
  },
  soundName: {
    fontSize: VaultKeTheme.typography.fontSize.base,
    fontWeight: VaultKeTheme.typography.fontWeight.medium,
  },
  soundDuration: {
    fontSize: VaultKeTheme.typography.fontSize.sm,
    marginTop: 2,
  },
  soundActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: VaultKeTheme.spacing.sm,
  },
  testButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NotificationSettingsScreen;
