import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import { toEAT, formatDate } from '../../../utils/dateUtils';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
// import DateTimePicker from '../../components/common/DateTimePicker';
import ApiService from '../../../services/api';

const CreateMeeting = ({ route, navigation, onRouteChange }) => {
  const { chamaId } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meetingDate: '',
    meetingTime: '',
    scheduledAt: '', // Will be calculated from date + time
    duration: '60',
    location: '',
    meetingUrl: '',
    meetingType: 'physical',
    attendeeEmails: '',
    addToCalendar: true,
    calendarId: 'primary',
  });

  // Calculate end time based on start time and duration
  const calculateEndTime = (date, time, durationMinutes) => {
    if (!date || !time || !durationMinutes) return '';

    try {
      const startDateTime = new Date(`${date}T${time}:00+03:00`);
      const endDateTime = new Date(startDateTime.getTime() + (durationMinutes * 60 * 1000));

      return endDateTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Africa/Nairobi'
      });
    } catch (error) {
      return '';
    }
  };

  // Get calculated end time
  const endTime = calculateEndTime(formData.meetingDate, formData.meetingTime, parseInt(formData.duration));

  // Error state for form validation
  const [errors, setErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);

  // Ref for scrolling to errors
  const scrollViewRef = useRef(null);

  const meetingTypes = [
    { 
      id: 'physical', 
      name: 'Physical Meeting', 
      icon: 'location',
      description: 'In-person meeting at a location' 
    },
    { 
      id: 'virtual', 
      name: 'Virtual Meeting', 
      icon: 'videocam',
      description: 'Online meeting via video call' 
    },
    { 
      id: 'hybrid', 
      name: 'Hybrid Meeting', 
      icon: 'people',
      description: 'Both physical and virtual attendance' 
    },
  ];

  const durations = [
    { value: '30', label: '30 minutes' },
    { value: '60', label: '1 hour' },
    { value: '90', label: '1.5 hours' },
    { value: '120', label: '2 hours' },
    { value: '180', label: '3 hours' },
  ];

  const handleInputChange = (field, value) => {
    // Basic malicious input filtering
    let sanitizedValue = value;
    if (typeof value === 'string') {
      // Remove potentially malicious characters
      sanitizedValue = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                          .replace(/javascript:/gi, '')
                          .replace(/on\w+\s*=/gi, '');
    }

    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: sanitizedValue
      };

      // Auto-calculate scheduledAt when date or time changes
      if (field === 'meetingDate' || field === 'meetingTime') {
        const date = field === 'meetingDate' ? sanitizedValue : prev.meetingDate;
        const time = field === 'meetingTime' ? sanitizedValue : prev.meetingTime;

        if (date && time) {
          // Combine date and time into RFC3339 format with EAT timezone
          newData.scheduledAt = `${date}T${time}:00+03:00`;
          console.log('🔍 Auto-calculated scheduledAt:', newData.scheduledAt);
        } else {
          newData.scheduledAt = '';
        }
      }

      return newData;
    });

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Validate required fields
    if (!formData.title.trim()) {
      newErrors.title = 'Please enter a meeting title';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Meeting title must be at least 3 characters long';
    } else if (formData.title.trim().length > 100) {
      newErrors.title = 'Meeting title must be less than 100 characters';
    }

    // Validate description length if provided
    if (formData.description.trim() && formData.description.trim().length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    // Validate meeting date
    if (!formData.meetingDate.trim()) {
      newErrors.meetingDate = 'Please select the meeting date';
    } else {
      try {
        const testDate = new Date(formData.meetingDate);
        if (isNaN(testDate.getTime())) {
          newErrors.meetingDate = 'Please enter a valid date';
        } else if (testDate < new Date().setHours(0, 0, 0, 0)) {
          newErrors.meetingDate = 'Meeting date must be today or in the future';
        }
      } catch (error) {
        newErrors.meetingDate = 'Please enter a valid date';
      }
    }

    // Validate meeting time
    if (!formData.meetingTime.trim()) {
      newErrors.meetingTime = 'Please select the meeting time';
    } else {
      // Validate time format (HH:MM)
      const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timePattern.test(formData.meetingTime.trim())) {
        newErrors.meetingTime = 'Please enter a valid time in HH:MM format';
      }
    }

    // Validate combined date and time is in the future
    if (formData.meetingDate && formData.meetingTime && !newErrors.meetingDate && !newErrors.meetingTime) {
      try {
        const combinedDateTime = new Date(`${formData.meetingDate}T${formData.meetingTime}:00+03:00`);
        if (combinedDateTime < new Date()) {
          newErrors.meetingTime = 'Meeting time must be in the future';
        }
      } catch (error) {
        newErrors.meetingTime = 'Invalid date and time combination';
      }
    }

    // Validate location for physical meetings
    if (formData.meetingType === 'physical' && !formData.location.trim()) {
      newErrors.location = 'Please enter a location for physical meeting';
    }

    // Validate meeting URL for virtual meetings
    if ((formData.meetingType === 'virtual' || formData.meetingType === 'hybrid') && !formData.meetingUrl.trim()) {
      newErrors.meetingUrl = 'Please enter a meeting URL for virtual meeting';
    } else if ((formData.meetingType === 'virtual' || formData.meetingType === 'hybrid') && formData.meetingUrl.trim()) {
      // Basic URL validation
      const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
      if (!urlPattern.test(formData.meetingUrl.trim())) {
        newErrors.meetingUrl = 'Please enter a valid URL (e.g., https://zoom.us/j/123456789)';
      }
    }

    // Validate attendee emails if provided
    if (formData.attendeeEmails.trim()) {
      const emails = formData.attendeeEmails.split(',').map(email => email.trim());
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = [];

      for (const email of emails) {
        if (email && !emailRegex.test(email)) {
          invalidEmails.push(email);
        }
      }

      if (invalidEmails.length > 0) {
        newErrors.attendeeEmails = `Invalid email format: ${invalidEmails.join(', ')}`;
      }
    }

    setErrors(newErrors);
    setShowErrors(true);

    // Scroll to top if there are errors to show the general error message
    if (Object.keys(newErrors).length > 0 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current.scrollTo({ y: 0, animated: true });
      }, 100);
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    console.log('🔄 Meeting form submitted!');
    console.log('📋 Form data:', formData);

    if (!validateForm()) {
      console.log('❌ Form validation failed');
      return;
    }

    console.log('✅ Form validation passed');

    try {
      setLoading(true);
      console.log('🔄 Setting loading to true');

      // Convert date format to RFC3339 with East African Time (EAT)
      let scheduledAtRFC3339 = formData.scheduledAt.trim();

      // Parse the input as EAT time
      if (!scheduledAtRFC3339.includes('T')) {
        // Convert "2025-06-12 14:57" to "2025-06-12T14:57:00+03:00" (EAT)
        scheduledAtRFC3339 = scheduledAtRFC3339.replace(' ', 'T') + ':00+03:00';
      } else if (!scheduledAtRFC3339.includes('Z') && !scheduledAtRFC3339.includes('+')) {
        // Add EAT timezone if no timezone specified
        scheduledAtRFC3339 += '+03:00';
      }

      console.log('📅 Original input:', formData.scheduledAt.trim());
      console.log('📅 Converted to EAT RFC3339:', scheduledAtRFC3339);

      // Verify the date is valid (this should already be validated in validateForm)
      const testDate = new Date(scheduledAtRFC3339);
      if (isNaN(testDate.getTime())) {
        // This shouldn't happen if validation is working correctly
        console.error('Date validation failed in handleSubmit - this should be caught earlier');
        return;
      }

      console.log('📅 Parsed date object:', testDate);
      console.log('📅 ISO string:', testDate.toISOString());
      console.log('📅 Will display as:', formatDate(testDate, 'datetime'));

      // Additional verification - show what time it will actually display
      const displayTime = formatDate(testDate, 'time');
      console.log('📅 Display time will be:', displayTime);

      // Parse attendee emails
      const attendeeEmails = formData.attendeeEmails.trim()
        ? formData.attendeeEmails.split(',').map(email => email.trim()).filter(email => email)
        : [];

      const meetingData = {
        chamaId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        scheduledAt: scheduledAtRFC3339,
        duration: parseInt(formData.duration),
        location: formData.location.trim(),
        meetingUrl: formData.meetingUrl.trim(),
        meetingType: formData.meetingType, // Use meetingType for new API
        recordingEnabled: formData.meetingType === 'virtual' || formData.meetingType === 'hybrid', // Enable recording for virtual meetings
        attendeeEmails: attendeeEmails,
        calendarId: formData.addToCalendar ? formData.calendarId : null,
      };

      console.log('📤 Sending meeting data:', meetingData);
      console.log('🔗 API call starting...');

      // Choose the appropriate endpoint based on features needed
      let endpoint = '/meetings/';

      if (formData.addToCalendar && attendeeEmails.length > 0) {
        // Use calendar integration endpoint
        endpoint = '/meetings/calendar';
      } else if (formData.meetingType === 'virtual' || formData.meetingType === 'hybrid') {
        // Use standard endpoint for virtual/hybrid meetings
        endpoint = '/meetings/';
      }

      const response = await ApiService.makeRequest(endpoint, {
        method: 'POST',
        body: meetingData,
      });

      console.log('📥 API response received:', response);
      
      if (response.success) {
        console.log('🎉 Meeting created successfully!');

        // Navigate back immediately with the new meeting data
        console.log('🔙 Navigating back with new meeting data...');
        if (onRouteChange) {
          onRouteChange('meetings', 'ChamaMeetingsScreen');
        } else {
          navigation.navigate('ChamaMeetingsScreen', {
            chamaId,
            newMeeting: response.data,
            refresh: true
          });
        }
      } else {
        console.log('❌ Meeting creation failed:', response.error);
        Alert.alert('Error', response.error || 'Failed to schedule meeting');
      }
    } catch (error) {
      console.error('❌ Error creating meeting:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      Alert.alert('Error', 'Failed to schedule meeting. Please try again.');
    } finally {
      console.log('🔄 Setting loading to false');
      setLoading(false);
    }
  };

  const renderMeetingTypeOption = (type) => (
    <TouchableOpacity
      key={type.id}
      style={[
        styles.typeOption,
        {
          backgroundColor: formData.meetingType === type.id ? colors.primary + '20' : colors.background,
          borderColor: formData.meetingType === type.id ? colors.primary : colors.border,
        }
      ]}
      onPress={() => handleInputChange('meetingType', type.id)}
    >
      <View style={styles.typeHeader}>
        <Ionicons 
          name={type.icon} 
          size={24} 
          color={formData.meetingType === type.id ? colors.primary : colors.textSecondary} 
        />
        <Text style={[
          styles.typeName,
          { color: formData.meetingType === type.id ? colors.primary : colors.text }
        ]}>
          {type.name}
        </Text>
        {formData.meetingType === type.id && (
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
        )}
      </View>
      <Text style={[
        styles.typeDescription,
        { color: formData.meetingType === type.id ? colors.primary : colors.textSecondary }
      ]}>
        {type.description}
      </Text>
    </TouchableOpacity>
  );

  const renderDurationOption = (duration) => (
    <TouchableOpacity
      key={duration.value}
      style={[
        styles.durationOption,
        {
          backgroundColor: formData.duration === duration.value ? colors.primary + '20' : colors.background,
          borderColor: formData.duration === duration.value ? colors.primary : colors.border,
        }
      ]}
      onPress={() => handleInputChange('duration', duration.value)}
    >
      <Text style={[
        styles.durationText,
        { color: formData.duration === duration.value ? colors.primary : colors.text }
      ]}>
        {duration.label}
      </Text>
      {formData.duration === duration.value && (
        <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  // Error message component
  const ErrorMessage = ({ error }) => {
    if (!error || !showErrors) return null;

    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={16} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>
          {error}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          {/* General error message */}
          {showErrors && Object.keys(errors).length > 0 && (
            <View style={[styles.generalErrorContainer, { backgroundColor: colors.error + '10', borderColor: colors.error }]}>
              <Ionicons name="alert-circle" size={20} color={colors.error} />
              <View style={styles.generalErrorContent}>
                <Text style={[styles.generalErrorTitle, { color: colors.error }]}>
                  Please fix the following errors:
                </Text>
                <Text style={[styles.generalErrorText, { color: colors.error }]}>
                  {Object.keys(errors).length} field{Object.keys(errors).length > 1 ? 's' : ''} need{Object.keys(errors).length === 1 ? 's' : ''} attention
                </Text>
              </View>
            </View>
          )}

          <Card style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Meeting Details
            </Text>
            
            <View>
              <Input
                label="Meeting Title *"
                value={formData.title}
                onChangeText={(text) => handleInputChange('title', text)}
                placeholder="Enter meeting title"
                icon={<Ionicons name="calendar" size={20} color={colors.textSecondary} />}
                style={errors.title && showErrors ? [styles.inputError, { borderColor: colors.error }] : null}
              />
              <ErrorMessage error={errors.title} />
            </View>

            <View>
              <Input
                label="Description"
                value={formData.description}
                onChangeText={(text) => handleInputChange('description', text)}
                placeholder="Meeting agenda and details..."
                multiline
                numberOfLines={3}
                icon={<Ionicons name="document-text" size={20} color={colors.textSecondary} />}
                style={errors.description && showErrors ? [styles.inputError, { borderColor: colors.error }] : null}
              />
              <ErrorMessage error={errors.description} />
            </View>

            {/* Meeting Date */}
            <View>
              <Input
                label="Meeting Date *"
                value={formData.meetingDate}
                onChangeText={(text) => handleInputChange('meetingDate', text)}
                placeholder="2025-12-01 (YYYY-MM-DD)"
                icon={<Ionicons name="calendar" size={20} color={colors.textSecondary} />}
                style={errors.meetingDate && showErrors ? [styles.inputError, { borderColor: colors.error }] : null}
              />
              <ErrorMessage error={errors.meetingDate} />
            </View>

            {/* Meeting Time */}
            <View>
              <Input
                label="Meeting Time *"
                value={formData.meetingTime}
                onChangeText={(text) => handleInputChange('meetingTime', text)}
                placeholder="15:30 (HH:MM - 24 hour format)"
                icon={<Ionicons name="time" size={20} color={colors.textSecondary} />}
                style={errors.meetingTime && showErrors ? [styles.inputError, { borderColor: colors.error }] : null}
              />
              <ErrorMessage error={errors.meetingTime} />
            </View>

            {/* End Time Display */}
            {endTime && (
              <View style={[styles.endTimeContainer, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
                <Ionicons name="time-outline" size={16} color={colors.primary} />
                <Text style={[styles.endTimeText, { color: colors.primary }]}>
                  Meeting will end at: {endTime} EAT
                </Text>
              </View>
            )}
          </Card>

          <Card style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Meeting Type
            </Text>
            
            <View style={styles.typeGrid}>
              {meetingTypes.map(renderMeetingTypeOption)}
            </View>
          </Card>

          <Card style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Duration
            </Text>
            
            <View style={styles.durationGrid}>
              {durations.map(renderDurationOption)}
            </View>
          </Card>

          {(formData.meetingType === 'physical' || formData.meetingType === 'hybrid') && (
            <Card style={styles.formCard}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Location Details
              </Text>
              
              <View>
                <Input
                  label="Meeting Location *"
                  value={formData.location}
                  onChangeText={(text) => handleInputChange('location', text)}
                  placeholder="Enter meeting venue/address"
                  icon={<Ionicons name="location" size={20} color={colors.textSecondary} />}
                  style={errors.location && showErrors ? [styles.inputError, { borderColor: colors.error }] : null}
                />
                <ErrorMessage error={errors.location} />
              </View>
            </Card>
          )}

          {(formData.meetingType === 'virtual' || formData.meetingType === 'hybrid') && (
            <Card style={styles.formCard}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Virtual Meeting Details
              </Text>

              <View>
                <Input
                  label="Meeting URL *"
                  value={formData.meetingUrl}
                  onChangeText={(text) => handleInputChange('meetingUrl', text)}
                  placeholder="Zoom, Teams, or other meeting link"
                  icon={<Ionicons name="link" size={20} color={colors.textSecondary} />}
                  style={errors.meetingUrl && showErrors ? [styles.inputError, { borderColor: colors.error }] : null}
                />
                <ErrorMessage error={errors.meetingUrl} />
              </View>
            </Card>
          )}

          <Card style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Attendees & Calendar Integration
            </Text>

            <View>
              <Input
                label="Attendee Emails (optional)"
                value={formData.attendeeEmails}
                onChangeText={(text) => handleInputChange('attendeeEmails', text)}
                placeholder="email1@example.com, email2@example.com"
                multiline
                numberOfLines={2}
                icon={<Ionicons name="mail" size={20} color={colors.textSecondary} />}
                style={errors.attendeeEmails && showErrors ? [styles.inputError, { borderColor: colors.error }] : null}
              />
              <ErrorMessage error={errors.attendeeEmails} />
            </View>

            <TouchableOpacity
              style={[
                styles.calendarOption,
                {
                  backgroundColor: formData.addToCalendar ? colors.primary + '20' : colors.background,
                  borderColor: formData.addToCalendar ? colors.primary : colors.border,
                }
              ]}
              onPress={() => handleInputChange('addToCalendar', !formData.addToCalendar)}
            >
              <View style={styles.calendarHeader}>
                <Ionicons
                  name="calendar"
                  size={24}
                  color={formData.addToCalendar ? colors.primary : colors.textSecondary}
                />
                <Text style={[
                  styles.calendarText,
                  { color: formData.addToCalendar ? colors.primary : colors.text }
                ]}>
                  Add to Google Calendar
                </Text>
                <Ionicons
                  name={formData.addToCalendar ? "checkmark-circle" : "ellipse-outline"}
                  size={20}
                  color={formData.addToCalendar ? colors.primary : colors.textSecondary}
                />
              </View>
              <Text style={[
                styles.calendarDescription,
                { color: formData.addToCalendar ? colors.primary : colors.textSecondary }
              ]}>
                Automatically create calendar event and send invites to attendees
              </Text>
            </TouchableOpacity>
          </Card>

          <View style={styles.submitButton}>
            <Button
              title={loading ? 'Creating Meeting...' : 'Create Meeting'}
              onPress={handleSubmit}
              disabled={loading}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    ...shadows.sm,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  content: {
    padding: spacing.md,
  },
  formCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  typeGrid: {
    gap: spacing.sm,
  },
  typeOption: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  typeName: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  typeDescription: {
    fontSize: typography.fontSize.sm,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  durationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.xs,
    minWidth: '45%',
  },
  durationText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  submitButton: {
    marginBottom: spacing.xl,
  },
  calendarOption: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  calendarText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  calendarDescription: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.lg + spacing.sm,
  },
  // Error styles
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.xs,
    flex: 1,
  },
  inputError: {
    borderWidth: 1,
  },
  // General error container styles
  generalErrorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  generalErrorContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  generalErrorTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  generalErrorText: {
    fontSize: typography.fontSize.sm,
  },
  endTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  endTimeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
});

export default CreateMeeting;
