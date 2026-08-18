import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PreviousMinutesSection = ({
  previousMeeting,
  previousMinutes,
  prevLoading,
  showPrevMinutes,
  setShowPrevMinutes,
  isChairperson,
  onApproveMinutes,
  formatDate,
  colors,
}) => {
  return (
    <View style={[styles.section, { backgroundColor: colors.surface }]}>
      <View style={styles.prevHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Previous Meeting Minutes</Text>
        {prevLoading && (
          <ActivityIndicator size="small" color={colors.primary} />
        )}
      </View>
      {previousMeeting ? (
        <>
          <Text style={[styles.prevMeta, { color: colors.textSecondary }]}>
            {`Last meeting: ${new Date(previousMeeting.scheduledAt || previousMeeting.date).toLocaleString()}`}
          </Text>
          {previousMinutes ? (
            <>
              <TouchableOpacity
                style={[styles.prevToggle, { borderColor: colors.border }]}
                onPress={() => setShowPrevMinutes(!showPrevMinutes)}
              >
                <Ionicons name={showPrevMinutes ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text} />
                <Text style={[styles.prevToggleText, { color: colors.text }]}>View last minutes</Text>
              </TouchableOpacity>

              {showPrevMinutes && (
                <View style={styles.prevContent}>
                  <Text style={[styles.prevStatus, { color: colors.textSecondary }]}>
                    {`Status: ${(previousMinutes.status || 'draft').toUpperCase()}`}
                  </Text>
                  <Text style={[styles.prevBody, { color: colors.text }]}>
                    {previousMinutes.content || 'No content available.'}
                  </Text>
                  {isChairperson && (previousMinutes.status || 'draft').toLowerCase() !== 'approved' && (
                    <TouchableOpacity
                      style={[styles.approveButton, { backgroundColor: colors.success }]}
                      onPress={onApproveMinutes}
                    >
                      <Ionicons name="checkmark-done" size={18} color={'white'} />
                      <Text style={styles.approveButtonText}>Approve Minutes</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          ) : (
            <Text style={[styles.prevMeta, { color: colors.textSecondary }]}>No minutes found for the previous meeting.</Text>
          )}
        </>
      ) : (
        <Text style={[styles.prevMeta, { color: colors.textSecondary }]}>No previous meeting found.</Text>
      )}
    </View>
  );
};

const styles = {
  section: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  prevHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  prevMeta: {
    fontSize: 12,
    marginBottom: 8,
  },
  prevToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  prevToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  prevContent: {
    marginTop: 12,
  },
  prevStatus: {
    fontSize: 12,
    marginBottom: 8,
  },
  prevBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  approveButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  approveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
};

export default PreviousMinutesSection;
