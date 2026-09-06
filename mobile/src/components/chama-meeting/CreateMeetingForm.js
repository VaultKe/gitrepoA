import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import MeetingTypeOption from './MeetingTypeOption';
import DurationOption from './DurationOption';
import FormErrorMessage from './FormErrorMessage';

const CreateMeetingForm = ({
  formData,
  errors,
  showErrors,
  handleInputChange,
  handleSubmit,
  endTime,
  meetingTypes,
  durations,
  colors,
}) => {
  // Was hardcoded to "2025-12-01", which just reads as a wrong date once the
  // year has actually moved on -- a placeholder is meant as a plausible
  // example, not a fixed one, so pin it to today's real year/month instead.
  const now = new Date();
  const datePlaceholder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01 (YYYY-MM-DD)`;

  return (
    <View>
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
          <FormErrorMessage error={errors.title} showErrors={showErrors} colors={colors} />
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
          <FormErrorMessage error={errors.description} showErrors={showErrors} colors={colors} />
        </View>

        <View>
          <Input
            label="Meeting Date *"
            value={formData.meetingDate}
            onChangeText={(text) => handleInputChange('meetingDate', text)}
            placeholder={datePlaceholder}
            icon={<Ionicons name="calendar" size={20} color={colors.textSecondary} />}
            style={errors.meetingDate && showErrors ? [styles.inputError, { borderColor: colors.error }] : null}
          />
          <FormErrorMessage error={errors.meetingDate} showErrors={showErrors} colors={colors} />
        </View>

        <View>
          <Input
            label="Meeting Time *"
            value={formData.meetingTime}
            onChangeText={(text) => handleInputChange('meetingTime', text)}
            placeholder="15:30 (HH:MM - 24 hour format)"
            icon={<Ionicons name="time" size={20} color={colors.textSecondary} />}
            style={errors.meetingTime && showErrors ? [styles.inputError, { borderColor: colors.error }] : null}
          />
          <FormErrorMessage error={errors.meetingTime} showErrors={showErrors} colors={colors} />
        </View>

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
          {meetingTypes.map((type) => (
            <MeetingTypeOption
              key={type.id}
              type={type}
              selectedType={formData.meetingType}
              onSelect={(value) => handleInputChange('meetingType', value)}
              colors={colors}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.formCard}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Duration
        </Text>

        <View style={styles.durationGrid}>
          {durations.map((duration) => (
            <DurationOption
              key={duration.value}
              duration={duration}
              selectedDuration={formData.duration}
              onSelect={(value) => handleInputChange('duration', value)}
              colors={colors}
            />
          ))}
        </View>
      </Card>

      {formData.meetingType === 'physical' && (
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
            <FormErrorMessage error={errors.location} showErrors={showErrors} colors={colors} />
          </View>
        </Card>
      )}

      {/* Virtual meetings don't need a link -- picking "Virtual Meeting"
          gets you an in-app online-meeting room (see OnlineMeetingScreen),
          not a field to paste someone else's Zoom/Teams URL into. */}

      {/* Google Calendar integration (and the attendee-emails field that
          existed to feed it) was removed -- connecting a Google account was
          too much friction for what it bought, an optional reminder, and
          the feature never actually worked to begin with (it depended on a
          DB column that was never there). Chama members already see a
          scheduled meeting in-app via ChamaMeetingsScreen. */}

      <View style={styles.submitButton}>
        <Button
          title="Create Meeting"
          onPress={handleSubmit}
          disabled={false}
        />
      </View>
    </View>
  );
};

const styles = {
  formCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  typeGrid: {
    gap: 12,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  submitButton: {
    marginBottom: 32,
  },
  inputError: {
    borderWidth: 1,
  },
  generalErrorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  generalErrorContent: {
    flex: 1,
    marginLeft: 12,
  },
  generalErrorTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  generalErrorText: {
    fontSize: 14,
  },
  endTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  endTimeText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
};

export default CreateMeetingForm;
