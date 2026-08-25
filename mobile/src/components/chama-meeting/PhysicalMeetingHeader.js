import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PhysicalMeetingHeader = ({ meetingTitle, isPreview, meetingData, getStatusColor, getStatusIcon, colors }) => {
  return (
    <View style={[styles.header, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
      {isPreview && (
        <View style={[styles.previewBadge, { backgroundColor: colors.warning + '20' }]}>
          <Ionicons name="eye" size={16} color={colors.warning} />
          <Text style={[styles.previewText, { color: colors.warning }]}>
            PREVIEW MODE
          </Text>
        </View>
      )}
      <Text style={[styles.meetingTitle, { color: colors.text }]}>
        {meetingTitle}
      </Text>
      <Text style={[styles.meetingType, { color: colors.textSecondary }]}>
        Physical Meeting
      </Text>

      {meetingData?.status && (
        <View style={[styles.statusIndicator, {
          backgroundColor: getStatusColor(meetingData.status) + '20'
        }]}>
          <Ionicons
            name={getStatusIcon(meetingData.status)}
            size={16}
            color={getStatusColor(meetingData.status)}
          />
          <Text style={[styles.statusText, {
            color: getStatusColor(meetingData.status)
          }]}>
            {meetingData.status.toUpperCase()}
          </Text>
        </View>
      )}
      {meetingData?.location && (
        <View style={styles.locationContainer}>
          <Ionicons name="location" size={16} color={colors.primary} />
          <Text style={[styles.locationText, { color: colors.textSecondary }]}>
            {meetingData.location}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = {
  header: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  previewText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  meetingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  meetingType: {
    fontSize: 16,
    marginBottom: 12,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    marginLeft: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
};

export default PhysicalMeetingHeader;
