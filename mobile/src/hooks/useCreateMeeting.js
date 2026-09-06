import { useState, useRef, useMemo } from 'react';
import { Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import { getThemeColors } from '../utils/theme';
import { formatDate } from '../utils/dateUtils';
import ApiService from '../services/api';

const useCreateMeeting = ({ route, navigation, onRouteChange }) => {
  const { chamaId } = route.params;
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meetingDate: '',
    meetingTime: '',
    scheduledAt: '',
    duration: '60',
    location: '',
    meetingType: 'physical',
  });

  const [errors, setErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);

  const scrollViewRef = useRef(null);

  // Hybrid used to sit here too, but it only ever meant "show both the
  // location field and the meeting-link field" -- and the meeting-link
  // field is gone now (see below), so it no longer described anything a
  // plain virtual meeting doesn't already cover.
  const meetingTypes = useMemo(() => [
    { id: 'physical', name: 'Physical Meeting', icon: 'location', description: 'In-person meeting at a location' },
    { id: 'virtual', name: 'Virtual Meeting', icon: 'videocam', description: 'Online meeting via video call' },
  ], []);

  // A virtual meeting is a live online-meeting room (see OnlineMeetingScreen),
  // not a scheduled call on someone else's platform, so its resource use is
  // this app's to carry -- the room itself is hard-capped server-side at 90
  // minutes (see clampRoomDuration in meeting-service) regardless of what's
  // picked here. Physical meetings carry no such cost and can still run the
  // full 3 hours.
  const allDurations = useMemo(() => [
    { value: '30', label: '30 minutes' },
    { value: '60', label: '1 hour' },
    { value: '90', label: '1.5 hours' },
    { value: '120', label: '2 hours' },
    { value: '180', label: '3 hours' },
  ], []);

  const durations = useMemo(
    () => (formData.meetingType === 'virtual'
      ? allDurations.filter((d) => Number(d.value) <= 90)
      : allDurations),
    [allDurations, formData.meetingType]
  );

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

  const endTime = useMemo(() => calculateEndTime(formData.meetingDate, formData.meetingTime, parseInt(formData.duration)), [
    formData.meetingDate,
    formData.meetingTime,
    formData.duration,
  ]);

  const handleInputChange = (field, value) => {
    let sanitizedValue = value;
    if (typeof value === 'string') {
      sanitizedValue = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                          .replace(/javascript:/gi, '')
                          .replace(/on\w+\s*=/gi, '');
    }

    setFormData(prev => {
      const newData = { ...prev, [field]: sanitizedValue };

      if (field === 'meetingDate' || field === 'meetingTime') {
        const date = field === 'meetingDate' ? sanitizedValue : prev.meetingDate;
        const time = field === 'meetingTime' ? sanitizedValue : prev.meetingTime;

        if (date && time) {
          newData.scheduledAt = `${date}T${time}:00+03:00`;
        } else {
          newData.scheduledAt = '';
        }
      }

      // Switching to virtual with a longer duration already picked (from
      // when physical allowed up to 3 hours) would otherwise leave that too-
      // long value selected but no longer shown as an option -- clamp it
      // down to the virtual cap instead of submitting a stale, invisible
      // choice.
      if (field === 'meetingType' && sanitizedValue === 'virtual' && parseInt(prev.duration, 10) > 90) {
        newData.duration = '90';
      }

      return newData;
    });

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Please enter a meeting title';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Meeting title must be at least 3 characters long';
    } else if (formData.title.trim().length > 100) {
      newErrors.title = 'Meeting title must be less than 100 characters';
    }

    if (formData.description.trim() && formData.description.trim().length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

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

    if (!formData.meetingTime.trim()) {
      newErrors.meetingTime = 'Please select the meeting time';
    } else {
      const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timePattern.test(formData.meetingTime.trim())) {
        newErrors.meetingTime = 'Please enter a valid time in HH:MM format';
      }
    }

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

    if (formData.meetingType === 'physical' && !formData.location.trim()) {
      newErrors.location = 'Please enter a location for physical meeting';
    }

    // Virtual meetings don't need a URL: they get their own in-app online-
    // meeting room (see OnlineMeetingScreen), not a link to some other
    // platform.

    setErrors(newErrors);
    setShowErrors(true);

    if (Object.keys(newErrors).length > 0 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current.scrollTo({ y: 0, animated: true });
      }, 100);
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      let scheduledAtRFC3339 = formData.scheduledAt.trim();

      if (!scheduledAtRFC3339.includes('T')) {
        scheduledAtRFC3339 = scheduledAtRFC3339.replace(' ', 'T') + ':00+03:00';
      } else if (!scheduledAtRFC3339.includes('Z') && !scheduledAtRFC3339.includes('+')) {
        scheduledAtRFC3339 += '+03:00';
      }

      const testDate = new Date(scheduledAtRFC3339);
      if (isNaN(testDate.getTime())) {
        console.error('Date validation failed in handleSubmit');
        return;
      }

      const displayTime = formatDate(testDate, 'time');

      // Belt-and-braces alongside the durations list already being filtered
      // for virtual meetings (see useCreateMeeting's `durations`) and the
      // meeting-service's own hard cap on the room itself -- this is just
      // the last place a stale value could still slip through.
      let duration = parseInt(formData.duration, 10);
      if (formData.meetingType === 'virtual' && duration > 90) {
        duration = 90;
      }

      const meetingData = {
        chamaId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        scheduledAt: scheduledAtRFC3339,
        duration,
        location: formData.location.trim(),
        meetingType: formData.meetingType,
        recordingEnabled: formData.meetingType === 'virtual',
      };

      const response = await ApiService.makeRequest('/meetings/', {
        method: 'POST',
        body: meetingData,
      });

      if (!response.success) {
        Alert.alert('Error', response.error || 'Failed to schedule meeting');
        return;
      }

      if (onRouteChange) {
        onRouteChange('meetings', 'ChamaMeetingsScreen');
      } else {
        navigation.navigate('ChamaMeetingsScreen', {
          chamaId,
          newMeeting: response.data,
          refresh: true
        });
      }
    } catch (error) {
      console.error('Error creating meeting:', error);
      Alert.alert('Error', 'Failed to schedule meeting. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    errors,
    showErrors,
    loading,
    scrollViewRef,
    meetingTypes,
    durations,
    endTime,
    colors,
    chamaId,
    handleInputChange,
    validateForm,
    handleSubmit,
  };
};

export default useCreateMeeting;
