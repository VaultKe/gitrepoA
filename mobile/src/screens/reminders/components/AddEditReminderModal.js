import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors } from '../../../utils/theme';
import ReminderTypeSelector from './ReminderTypeSelector';

const AddEditReminderModal = ({
  visible,
  editingReminder,
  formData,
  onFormDataChange,
  onCancel,
  onSave,
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  // Input formatting helpers
  const formatDateInput = (text) => {
    // Remove non-numeric characters except hyphens
    let cleaned = text.replace(/[^\d-]/g, '');

    // Auto-format as YYYY-MM-DD
    if (cleaned.length >= 4 && cleaned.charAt(4) !== '-') {
      cleaned = cleaned.slice(0, 4) + '-' + cleaned.slice(4);
    }
    if (cleaned.length >= 7 && cleaned.charAt(7) !== '-') {
      cleaned = cleaned.slice(0, 7) + '-' + cleaned.slice(7);
    }

    return cleaned.slice(0, 10); // Limit to YYYY-MM-DD
  };

  const formatTimeInput = (text) => {
    // Remove non-numeric characters except colons
    let cleaned = text.replace(/[^\d:]/g, '');

    // Auto-format as HH:MM
    if (cleaned.length >= 2 && cleaned.charAt(2) !== ':') {
      cleaned = cleaned.slice(0, 2) + ':' + cleaned.slice(2);
    }

    return cleaned.slice(0, 5); // Limit to HH:MM
  };

  const updateFormData = (key, value) => {
    onFormDataChange({ ...formData, [key]: value });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}>
          <TouchableOpacity onPress={onCancel}>
            <Text style={{
              fontSize: 16,
              fontWeight: '500',
              color: colors.primary,
            }}>Cancel</Text>
          </TouchableOpacity>

          <Text style={{
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
          }}>
            {editingReminder ? 'Edit Reminder' : 'Add Reminder'}
          </Text>

          <TouchableOpacity onPress={onSave}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: colors.primary,
            }}>
              {editingReminder ? 'Update' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{
          flex: 1,
          padding: 20,
        }}>
          <View style={{ marginBottom: 24 }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              marginBottom: 8,
              color: colors.text,
            }}>Title *</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              }}
              value={formData.title}
              onChangeText={(text) => updateFormData('title', text)}
              placeholder="Enter reminder title"
              placeholderTextColor={colors.textSecondary}
              maxLength={100}
            />
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              marginBottom: 8,
              color: colors.text,
            }}>Description</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
                minHeight: 80,
                textAlignVertical: 'top',
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              }}
              value={formData.description}
              onChangeText={(text) => updateFormData('description', text)}
              placeholder="Enter description (optional)"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>

          {/* Date Input */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              marginBottom: 8,
              color: colors.text,
            }}>Date *</Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderRadius: 8,
              paddingHorizontal: 16,
              minHeight: 48,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}>
              <Ionicons name="calendar" size={20} color={colors.primary} style={{ marginRight: 12 }} />
              <TextInput
                style={{
                  flex: 1,
                  fontSize: 16,
                  paddingVertical: 12,
                  minHeight: 48,
                  color: colors.text,
                }}
                value={formData.date}
                onChangeText={(text) => {
                  const formatted = formatDateInput(text);
                  updateFormData('date', formatted);
                }}
                placeholder="YYYY-MM-DD (e.g., 2025-07-27)"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          </View>

          {/* Time Input */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              marginBottom: 8,
              color: colors.text,
            }}>Time *</Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderRadius: 8,
              paddingHorizontal: 16,
              minHeight: 48,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}>
              <Ionicons name="time" size={20} color={colors.primary} style={{ marginRight: 12 }} />
              <TextInput
                style={{
                  flex: 1,
                  fontSize: 16,
                  paddingVertical: 12,
                  minHeight: 48,
                  color: colors.text,
                }}
                value={formData.time}
                onChangeText={(text) => {
                  const formatted = formatTimeInput(text);
                  updateFormData('time', formatted);
                }}
                placeholder="HH:MM (e.g., 14:30)"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              marginBottom: 8,
              color: colors.text,
            }}>Repeat</Text>
            <ReminderTypeSelector
              selectedType={formData.type}
              onTypeChange={(type) => updateFormData('type', type)}
            />
          </View>

          <View style={{ marginBottom: 24 }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <View>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: colors.text,
                }}>Enable Notifications</Text>
                <Text style={{
                  fontSize: 14,
                  marginTop: 2,
                  color: colors.textSecondary,
                }}>
                  Receive notifications for this reminder
                </Text>
              </View>
              <Switch
                value={formData.isEnabled}
                onValueChange={(value) => updateFormData('isEnabled', value)}
                trackColor={{ false: colors.border, true: colors.primary + '30' }}
                thumbColor={formData.isEnabled ? colors.primary : colors.textSecondary}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default AddEditReminderModal;