import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AttendanceTable = ({
  attendanceData,
  totalAttendanceItems,
  attendancePage,
  totalAttendancePages,
  onPageChange,
  getAttendeeName,
  colors,
}) => {
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Attendance Details</Text>
      {totalAttendanceItems > 0 ? (
        <View style={styles.attendanceTable}>
          <View style={[styles.tableHeader, { backgroundColor: colors.primary + '15', borderBottomColor: colors.primary }]}>
            <View style={styles.nameCell}>
              <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Member Name</Text>
            </View>
            <View style={styles.cell}>
              <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Meeting Type</Text>
            </View>
            <View style={styles.statusCell}>
              <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Status</Text>
            </View>
          </View>

          {attendanceData.map((attendance, index) => (
            <View
              key={attendance.id || index}
              style={[
                styles.tableRow,
                index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }
              ]}
            >
              <View style={[styles.cell, styles.nameCell]}>
                <Text style={[styles.tableCellText, styles.nameText, { color: colors.text }]} numberOfLines={1}>
                  {getAttendeeName(attendance)}
                </Text>
              </View>

              <View style={styles.cell}>
                <Text style={[styles.tableCellText, { color: colors.textSecondary }]}>
                  {attendance.attendanceType || 'Physical'}
                </Text>
              </View>

              <View style={[styles.cell, styles.statusCell]}>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: attendance.isPresent ? colors.success + '20' : colors.error + '20' }
                ]}>
                  <Ionicons
                    name={attendance.isPresent ? "checkmark-circle" : "close-circle"}
                    size={14}
                    color={attendance.isPresent ? colors.success : colors.error}
                  />
                  <Text style={[
                    { fontSize: 12, fontWeight: '600', color: attendance.isPresent ? colors.success : colors.error }
                  ]}>
                    {attendance.isPresent ? 'Present' : 'Absent'}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          {totalAttendanceItems > 10 && (
            <View style={[styles.paginationContainer, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.paginationButton, attendancePage === 1 && styles.paginationButtonDisabled]}
                onPress={() => attendancePage > 1 && onPageChange(attendancePage - 1)}
                disabled={attendancePage === 1}
              >
                <Ionicons name="chevron-back" size={16} color={attendancePage === 1 ? colors.textSecondary : colors.primary} />
                <Text style={[styles.paginationText, attendancePage === 1 && styles.paginationTextDisabled, { color: attendancePage === 1 ? colors.textSecondary : colors.primary }]}>Previous</Text>
              </TouchableOpacity>

              <Text style={[styles.paginationInfo, { color: colors.text }]}>
                Page {attendancePage} of {totalAttendancePages} ({totalAttendanceItems} total)
              </Text>

              <TouchableOpacity
                style={[styles.paginationButton, attendancePage === totalAttendancePages && styles.paginationButtonDisabled]}
                onPress={() => attendancePage < totalAttendancePages && onPageChange(attendancePage + 1)}
                disabled={attendancePage === totalAttendancePages}
              >
                <Text style={[styles.paginationText, attendancePage === totalAttendancePages && styles.paginationTextDisabled, { color: attendancePage === totalAttendancePages ? colors.textSecondary : colors.primary }]}>Next</Text>
                <Ionicons name="chevron-forward" size={16} color={attendancePage === totalAttendancePages ? colors.textSecondary : colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No attendance data available</Text>
        </View>
      )}
    </View>
  );
};

const styles = {
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  attendanceTable: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  cell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  nameCell: {
    flex: 2,
    alignItems: 'flex-start',
  },
  statusCell: {
    flex: 1.5,
  },
  tableHeaderText: {
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
  tableCellText: {
    fontSize: 12,
    textAlign: 'center',
  },
  nameText: {
    fontWeight: '500',
    textAlign: 'left',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: 1,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '500',
  },
  paginationTextDisabled: {
    opacity: 0.6,
  },
  paginationInfo: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
};

export default AttendanceTable;
