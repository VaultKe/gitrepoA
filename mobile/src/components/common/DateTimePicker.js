import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import { useApp } from '../../context/AppContext';
import { toEAT, formatDate } from '../../utils/dateUtils';

// Only import DateTimePicker on native platforms
let DateTimePicker = null;
if (Platform.OS !== 'web') {
  try {
    DateTimePicker = require('@react-native-community/datetimepicker').default;
  } catch (error) {
    console.warn('DateTimePicker not available:', error);
  }
}

const CustomDateTimePicker = ({ 
  label, 
  value, 
  onDateTimeChange, 
  minimumDate,
  placeholder = "Select date and time",
  icon,
  style 
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : new Date());
  const [tempDate, setTempDate] = useState(value ? new Date(value) : new Date());

  const formatDisplayDate = (date) => {
    if (!date) return placeholder;

    // Convert to EAT and format for display
    const eatDate = toEAT(date);
    return formatDate(eatDate, 'datetime');
  };

  const formatRFC3339 = (date) => {
    if (!date) return '';
    const rfc3339 = date.toISOString();
    return rfc3339;
  };

  const handleDateChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (date) {
      setTempDate(date);
      if (Platform.OS === 'android') {
        // On Android, show time picker after date selection
        setTimeout(() => setShowTimePicker(true), 100);
      }
    }
  };

  const handleTimeChange = (event, time) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    
    if (time) {
      const newDateTime = new Date(tempDate);
      newDateTime.setHours(time.getHours());
      newDateTime.setMinutes(time.getMinutes());
      
      setSelectedDate(newDateTime);
      setTempDate(newDateTime);

      // Call the callback with RFC3339 formatted string
      const rfc3339Date = formatRFC3339(newDateTime);
      onDateTimeChange(rfc3339Date);
    }
  };

  const handleIOSConfirm = () => {
    setSelectedDate(tempDate);
    onDateTimeChange(formatRFC3339(tempDate));
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const handleIOSCancel = () => {
    setTempDate(selectedDate);
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const openDatePicker = () => {
    if (Platform.OS === 'web') {
      // On web, we'll use the HTML datetime-local input
      return;
    }
    setTempDate(selectedDate);
    setShowDatePicker(true);
  };

  const handleWebDateTimeChange = (dateTimeString) => {
    if (dateTimeString) {
      try {
        // Validate the datetime string format
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateTimeString)) {
          console.warn('📅 Invalid datetime format:', dateTimeString);
          return;
        }

        // Convert from "YYYY-MM-DDTHH:MM" to ISO string
        const date = new Date(dateTimeString);

        // Check if date is valid
        if (isNaN(date.getTime())) {
          console.warn('📅 Invalid date created from:', dateTimeString);
          return;
        }

        const rfc3339Date = formatRFC3339(date);
        setSelectedDate(date);
        onDateTimeChange(rfc3339Date);
      } catch (error) {
        console.error('📅 Error handling web datetime change:', error);
      }
    }
  };

  const renderIOSPicker = () => (
    <Modal
      visible={showDatePicker || showTimePicker}
      transparent
      animationType="slide"
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleIOSCancel}>
              <Text style={[styles.modalButton, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {showDatePicker ? 'Select Date & Time' : 'Select Time'}
            </Text>
            <TouchableOpacity onPress={handleIOSConfirm}>
              <Text style={[styles.modalButton, { color: colors.primary }]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
          
          <DateTimePicker
            value={tempDate}
            mode="datetime"
            display="spinner"
            onChange={(event, date) => {
              if (date) setTempDate(date);
            }}
            minimumDate={minimumDate}
            textColor={colors.text}
            style={styles.picker}
          />
        </View>
      </View>
    </Modal>
  );

  const renderAndroidPicker = () => (
    <>
      {showDatePicker && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={minimumDate}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </>
  );

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, { color: colors.text }]}>
          {label}
        </Text>
      )}
      
      {Platform.OS === 'web' ? (
        // Web version with HTML datetime-local input
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
            }
          ]}
        >
          {icon && (
            <View style={styles.iconContainer}>
              {icon}
            </View>
          )}

          <TextInput
            style={[
              styles.inputText,
              { color: colors.text }
            ]}
            type="datetime-local"
            value={selectedDate ? selectedDate.toISOString().slice(0, 16) : ''}
            onChange={(e) => handleWebDateTimeChange(e.target.value)}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            min={minimumDate ? minimumDate.toISOString().slice(0, 16) : undefined}
          />

          <Ionicons
            name="calendar-outline"
            size={20}
            color={colors.textSecondary}
            style={styles.calendarIcon}
          />
        </View>
      ) : (
        // Native version with TouchableOpacity
        <TouchableOpacity
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
            }
          ]}
          onPress={openDatePicker}
        >
          {icon && (
            <View style={styles.iconContainer}>
              {icon}
            </View>
          )}

          <Text
            style={[
              styles.inputText,
              {
                color: selectedDate ? colors.text : colors.textSecondary,
              }
            ]}
          >
            {formatDisplayDate(selectedDate)}
          </Text>

          <Ionicons
            name="calendar-outline"
            size={20}
            color={colors.textSecondary}
            style={styles.calendarIcon}
          />
        </TouchableOpacity>
      )}

      {Platform.OS !== 'web' && DateTimePicker && (
        Platform.OS === 'ios' ? renderIOSPicker() : renderAndroidPicker()
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  inputText: {
    flex: 1,
    fontSize: typography.fontSize.base,
  },
  calendarIcon: {
    marginLeft: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingBottom: 34, // Safe area for iOS
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  modalButton: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  picker: {
    height: 200,
  },
});

export default CustomDateTimePicker;
