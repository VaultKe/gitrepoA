import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';

const createTableStyles = (colors, spacing, typography, shadows) => ({
  tableContainer: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  nameCell: {
    flex: 2,
    alignItems: 'flex-start',
  },
  statusCell: {
    flex: 1.5,
  },
  tableHeaderText: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    fontSize: 9,
    textAlign: 'center',
  },
  tableCellText: {
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  nameText: {
    fontWeight: typography.fontWeight.medium,
    textAlign: 'left',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 2,
  },
});
import api from '../../../services/api';
import Toast from 'react-native-toast-message';

const MeetingSummaryScreen = ({ route, navigation }) => {
  const { meetingId, meetingData, chamaId, chamaName, fromUserDashboard, showAllMeetings } = route.params || {};
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const tableStyles = createTableStyles(colors, spacing, typography, shadows);

  const isHistoryMode = fromUserDashboard && showAllMeetings;

  const [loading, setLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [meetingDetails, setMeetingDetails] = useState(meetingData || null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [allAttendanceData, setAllAttendanceData] = useState([]);
  const [meetingMinutes, setMeetingMinutes] = useState(null);
  const [meetingDocuments, setMeetingDocuments] = useState([]);
  const [chamaMembers, setChamaMembers] = useState([]);
  const [allMeetings, setAllMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [downloadingDocId, setDownloadingDocId] = useState(null);

  // Attendance pagination state
  const [attendancePage, setAttendancePage] = useState(1);
  const [totalAttendancePages, setTotalAttendancePages] = useState(1);
  const [totalAttendanceItems, setTotalAttendanceItems] = useState(0);
  const attendancePageSize = 10;

  const handleDocumentPress = async (document) => {
    if (!document || !document.url) {
      Toast.show({ type: 'info', text1: 'Document URL Missing' });
      return;
    }

    try {
      // Construct the full URL properly
      let fileUrl;
      if (document.url.startsWith('http')) {
        fileUrl = document.url;
      } else {
        // Ensure the base URL doesn't have trailing slash and document URL has leading slash
        const baseUrl = api.getApiBaseUrl();
        if (!baseUrl) {
          throw new Error('API base URL is not configured');
        }
        const normalizedBaseUrl = baseUrl.replace('/api/v1', '').replace(/\/$/, '');
        const docUrl = document.url.startsWith('/') ? document.url : `/${document.url}`;
        fileUrl = `${normalizedBaseUrl}${docUrl}`;
      }

      const fileName = document.name || fileUrl.split('/').pop() || 'document';

      console.log('📄 Document download:', { fileUrl, fileName, platform: Platform.OS });

      if (Platform.OS === 'web') {
        // For web, open in new tab/window instead of download to avoid CORS issues
        window.open(fileUrl, '_blank');
        Toast.show({
          type: 'success',
          text1: 'Document Opened',
          text2: 'Document opened in new tab.',
        });
      } else {
        if (downloadingDocId) return;
        setDownloadingDocId(document.id);

        try {
          const localUri = FileSystem.documentDirectory + fileName;
          Toast.show({ type: 'info', text1: 'Starting Download', text2: `Downloading ${fileName}...` });

          console.log('📥 Downloading from:', fileUrl, 'to:', localUri);

          const { uri } = await FileSystem.downloadAsync(fileUrl, localUri);
          Toast.show({ type: 'success', text1: 'Download Complete', text2: `${fileName} saved.` });

          if (await Sharing.isAvailableAsync()) {
            Alert.alert('Open Document', `Would you like to open ${fileName}?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open', onPress: () => Sharing.shareAsync(uri) },
            ]);
          }
        } catch (downloadError) {
          console.error('❌ Download failed:', downloadError);
          Toast.show({
            type: 'error',
            text1: 'Download Failed',
            text2: downloadError.message || 'Unable to download document'
          });
        } finally {
          setDownloadingDocId(null);
        }
      }
    } catch (error) {
      console.error('❌ Document handling error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Unable to process document request'
      });
    }
  };



  // Helper function to get recorder name
  const getRecorderName = (minutes) => {
    if (!minutes || !minutes.takenBy) {
      return 'Unknown';
    }

    if (minutes.takenByName && minutes.takenByName.length < 30 && !minutes.takenByName.includes('-')) {
      return minutes.takenByName;
    }

    const member = chamaMembers.find(m =>
      m.user_id === minutes.takenBy ||
      m.id === minutes.takenBy ||
      m.userId === minutes.takenBy
    );

    if (member) {
      const name = member.name ||
                   member.user_name ||
                   member.username ||
                   member.displayName ||
                   member.user?.name ||
                   member.user?.username ||
                   member.user?.user_name ||
                   `${member.first_name || member.user?.first_name || ''} ${member.last_name || member.user?.last_name || ''}`.trim() ||
                   member.user?.email?.split('@')[0];

      if (name && name !== ' ') {
        return name;
      }
    }

    return `Member ${minutes.takenBy.slice(-4)}`;
  };

  // Helper function to get attendee name
  const getAttendeeName = (attendance) => {
    const providedName = attendance.userName || attendance.user_name;
    if (providedName && providedName.length < 30 && !providedName.includes('-')) {
      return providedName;
    }

    const member = chamaMembers.find(m =>
      m.user_id === attendance.userId ||
      m.id === attendance.userId ||
      m.userId === attendance.userId
    );

    if (member) {
      const name = member.name ||
                   member.user_name ||
                   member.username ||
                   member.displayName ||
                   member.user?.name ||
                   member.user?.username ||
                   member.user?.user_name ||
                   `${member.first_name || member.user?.first_name || ''} ${member.last_name || member.user?.last_name || ''}`.trim() ||
                   member.user?.email?.split('@')[0];

      if (name && name !== ' ') {
        return name;
      }
    }

    return `Member ${attendance.userId?.slice(-4) || 'Unknown'}`;
  };

  // Function to load all user meetings for history view
  const loadMeetingHistory = async () => {
    try {
      setLoading(true);
      const response = await api.getUserMeetings(100, 0);
      if (response.success && response.data) {
        const completedMeetings = response.data.filter(meeting =>
          meeting.status === 'completed' || meeting.status === 'ended'
        );
        completedMeetings.sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));
        setAllMeetings(completedMeetings);

        if (completedMeetings.length > 0) {
          const firstMeeting = completedMeetings[0];
          setSelectedMeeting(firstMeeting);
          setMeetingDetails(firstMeeting);
          if (firstMeeting.chamaId) {
            await loadChamaMembers(firstMeeting.chamaId);
          }
          await loadMeetingSummaryData();
        }
      } else {
        setAllMeetings([]);
      }
    } catch (error) {
      console.error('❌ Failed to load meeting history:', error);
      setAllMeetings([]);
    } finally {
      setLoading(false);
      setDataReady(true);
    }
  };

  useEffect(() => {
    if (isHistoryMode) {
      loadMeetingHistory();
    } else {
      if (chamaId) {
        loadChamaMembers();
      }
      if (meetingId) {
        loadMeetingSummaryData();
      } else if (meetingData) {
        setMeetingDetails(meetingData);
        setLoading(false);
      } else {
        setLoading(false);
      }
    }
  }, [meetingId, isHistoryMode]);

  // Handle attendance pagination
  useEffect(() => {
    if (allAttendanceData.length > 0) {
      const startIndex = (attendancePage - 1) * attendancePageSize;
      const endIndex = startIndex + attendancePageSize;
      setAttendanceData(allAttendanceData.slice(startIndex, endIndex));
    }
  }, [attendancePage, allAttendanceData]);

  const loadChamaMembers = async () => {
    try {
      const response = await api.getChamaMembers(chamaId);
      if (response.success && response.data) {
        setChamaMembers(response.data);
      } else {
        setChamaMembers([]);
      }
    } catch (error) {
      console.error('❌ Failed to load chama members:', error);
      setChamaMembers([]);
    }
  };

  const loadMeetingSummaryData = async () => {
    try {
      setLoading(true);
      const [detailsResponse, attendanceResponse, minutesResponse, documentsResponse, membersResponse] = await Promise.allSettled([
        api.getMeetingDetails(meetingId),
        api.getMeetingAttendance(meetingId),
        api.getMeetingMinutes(meetingId),
        api.getMeetingDocuments(meetingId),
        api.getChamaMembers(chamaId)
      ]);

      if (detailsResponse.status === 'fulfilled' && detailsResponse.value.success) {
        setMeetingDetails(detailsResponse.value.data);
      }
      if (attendanceResponse.status === 'fulfilled' && attendanceResponse.value.success) {
        const attendance = attendanceResponse.value.data || [];
        setAllAttendanceData(attendance);
        setTotalAttendanceItems(attendance.length);
        setTotalAttendancePages(Math.ceil(attendance.length / attendancePageSize));

        // Set initial page data
        const startIndex = 0;
        const endIndex = attendancePageSize;
        setAttendanceData(attendance.slice(startIndex, endIndex));
        setAttendancePage(1);
      }
      if (minutesResponse.status === 'fulfilled' && minutesResponse.value.success) {
        setMeetingMinutes(minutesResponse.value.data);
      }
      if (documentsResponse.status === 'fulfilled' && documentsResponse.value.success) {
        setMeetingDocuments(documentsResponse.value.data || []);
      }
      if (membersResponse.status === 'fulfilled' && membersResponse.value.success) {
        setChamaMembers(membersResponse.value.data || []);
      }
    } catch (error) {
      console.error('❌ Failed to load meeting summary data:', error);
      Toast.show({ type: 'error', text1: 'Failed to Load Meeting Data' });
    } finally {
      setLoading(false);
      setDataReady(true);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMeetingSummaryData();
    setRefreshing(false);
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const formatTime = (dateString) => {
    try {
      return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return 'Invalid Time';
    }
  };

  const getMeetingTypeIcon = (type) => {
    switch (type) {
      case 'virtual': return 'videocam';
      case 'physical': return 'location';
      case 'hybrid': return 'globe';
      default: return 'calendar';
    }
  };

  const getAttendanceStats = () => {
    let totalMembers = chamaMembers.length || 0;
    if (totalMembers === 0 && attendanceData && attendanceData.length > 0) {
      totalMembers = attendanceData.length;
    }
    if (!attendanceData || !Array.isArray(attendanceData) || attendanceData.length === 0) {
      return { present: 0, absent: totalMembers, total: totalMembers };
    }
    const present = attendanceData.filter(att => att && att.isPresent).length;
    const absent = Math.max(0, totalMembers - present);
    return { present, absent, total: totalMembers };
  };

  const renderMeetingHeader = () => {
    const meeting = meetingDetails || meetingData;
    if (!meeting) {
      return (
        <Card variant="outlined" style={styles.meetingHeaderCard}>
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>Meeting details not available</Text>
          </View>
        </Card>
      );
    }
    return (
      <Card variant="outlined" style={styles.meetingHeaderCard}>
        <View style={styles.meetingHeader}>
          <View style={[styles.meetingTypeIcon, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name={getMeetingTypeIcon(meeting.meetingType)} size={24} color={colors.primary} />
          </View>
          <View style={styles.meetingHeaderInfo}>
            <Text style={[styles.meetingTitle, { color: colors.text }]}>{meeting.title}</Text>
            <Text style={[styles.meetingDate, { color: colors.textSecondary }]}>{formatDate(meeting.scheduledAt)}</Text>
            <Text style={[styles.meetingTime, { color: colors.textSecondary }]}>
              {formatTime(meeting.scheduledAt)} • {meeting.meetingType?.charAt(0).toUpperCase() + meeting.meetingType?.slice(1)}
            </Text>
            {meeting.location && <Text style={[styles.meetingLocation, { color: colors.textSecondary }]}>📌Location: {meeting.location}</Text>}
          </View>
        </View>
        {meeting.description && <Text style={[styles.meetingDescription, { color: colors.textSecondary }]}>{meeting.description}</Text>}
      </Card>
    );
  };

  const renderMeetingDetails = () => {
    const meeting = meetingDetails || meetingData;
    if (!meeting) return null;

    const stats = getAttendanceStats();
    const attendanceRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

    return (
      <View style={styles.detailsContainer}>
        <Card variant="outlined" style={styles.overviewCard}>
          <Text style={[styles.detailsTitle, { color: colors.text }]}>Attendance Summary</Text>
          <View style={styles.attendanceStats}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.success }]}>{stats.present}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Present</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.error }]}>{stats.absent}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Absent</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{attendanceRate}%</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Rate</Text>
            </View>
          </View>
        </Card>

        {/* Attendance Details Table */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>Attendance Details</Text>
        {totalAttendanceItems > 0 ? (
          <Card variant="default" style={{ borderRadius: 8, overflow: 'hidden' }}>
            <View style={styles.attendanceTable}>
              {/* Table Header */}
              <View style={tableStyles.tableHeader}>
                <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
                  <Text style={[tableStyles.tableHeaderText, { textAlign: 'left' }]}>Member Name</Text>
                </View>
                <View style={tableStyles.tableCell}>
                  <Text style={tableStyles.tableHeaderText}>Meeting Type</Text>
                </View>
                <View style={[tableStyles.tableCell, tableStyles.statusCell]}>
                  <Text style={tableStyles.tableHeaderText}>Status</Text>
                </View>
              </View>

              {/* Table Body */}
              {attendanceData.map((attendance, index) => (
                <View
                  key={attendance.id || index}
                  style={[
                    tableStyles.tableRow,
                    index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }
                  ]}
                >
                  {/* Member Name */}
                  <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
                    <Text style={[tableStyles.tableCellText, tableStyles.nameText]} numberOfLines={1}>
                      {getAttendeeName(attendance)}
                    </Text>
                  </View>

                  {/* Attendance Type */}
                  <View style={tableStyles.tableCell}>
                    <Text style={tableStyles.tableCellText}>
                      {attendance.attendanceType || 'Physical'}
                    </Text>
                  </View>

                  {/* Status */}
                  <View style={[tableStyles.tableCell, tableStyles.statusCell]}>
                    <View style={[
                      tableStyles.statusBadge,
                      { backgroundColor: attendance.isPresent ? colors.success + '20' : colors.error + '20' }
                    ]}>
                      <Ionicons
                        name={attendance.isPresent ? "checkmark-circle" : "close-circle"}
                        size={14}
                        color={attendance.isPresent ? colors.success : colors.error}
                      />
                      <Text style={[
                        { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, color: attendance.isPresent ? colors.success : colors.error }
                      ]}>
                        {attendance.isPresent ? 'Present' : 'Absent'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}

              {/* Pagination */}
              {totalAttendanceItems > attendancePageSize && (
                <View style={[styles.paginationContainer, { borderTopColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.paginationButton, attendancePage === 1 && styles.paginationButtonDisabled]}
                    onPress={() => attendancePage > 1 && setAttendancePage(attendancePage - 1)}
                    disabled={attendancePage === 1}
                  >
                    <Ionicons name="chevron-back" size={16} color={attendancePage === 1 ? colors.textTertiary : colors.primary} />
                    <Text style={[styles.paginationText, attendancePage === 1 && styles.paginationTextDisabled]}>Previous</Text>
                  </TouchableOpacity>

                  <Text style={[styles.paginationInfo, { color: colors.text }]}>
                    Page {attendancePage} of {totalAttendancePages} ({totalAttendanceItems} total)
                  </Text>

                  <TouchableOpacity
                    style={[styles.paginationButton, attendancePage === totalAttendancePages && styles.paginationButtonDisabled]}
                    onPress={() => attendancePage < totalAttendancePages && setAttendancePage(attendancePage + 1)}
                    disabled={attendancePage === totalAttendancePages}
                  >
                    <Text style={[styles.paginationText, attendancePage === totalAttendancePages && styles.paginationTextDisabled]}>Next</Text>
                    <Ionicons name="chevron-forward" size={16} color={attendancePage === totalAttendancePages ? colors.textTertiary : colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Card>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No attendance data available</Text>
          </View>
        )}

        <Card variant="outlined" style={styles.minutesCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Meeting Minutes</Text>
          {meetingMinutes ? (
            <>
              <Text style={[styles.minutesContent, { color: colors.textSecondary }]}>{meetingMinutes.content}</Text>
              <View style={styles.minutesMetadata}>
                <Text style={[styles.minutesStatus, { color: colors.primary }]}>Status: {meetingMinutes.status?.charAt(0).toUpperCase() + meetingMinutes.status?.slice(1)}</Text>
                <Text style={[styles.minutesTakenBy, { color: colors.textSecondary }]}>Recorded by: {getRecorderName(meetingMinutes)}</Text>
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No meeting minutes available</Text>
            </View>
          )}
        </Card>

        <Card variant="outlined" style={styles.documentsCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Meeting Documents ({meetingDocuments.length})</Text>
          {meetingDocuments.length > 0 ? (
            <>
              {meetingDocuments.map((document, index) => (
                <TouchableOpacity key={index} style={styles.documentItem} onPress={() => handleDocumentPress(document)} disabled={downloadingDocId === document.id}>
                  <View style={[styles.documentIcon, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name="document" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.documentInfo}>
                    <Text style={[styles.documentName, { color: colors.text }]} numberOfLines={1}>{document.name}</Text>
                    <Text style={[styles.documentType, { color: colors.textSecondary }]}>{document.documentType} • {Math.round(document.size / 1024)} KB</Text>
                  </View>
                  {downloadingDocId === document.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="download" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No documents available</Text>
            </View>
          )}
        </Card>
      </View>
    );
  };

  if (loading && !dataReady) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '70%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '50%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '30%' }]} />
          </View>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '60%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '40%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '80%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '55%' }]} />
          </View>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '45%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '65%' }]} />
          </View>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '75%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '35%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '50%' }]} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {(meetingDetails || meetingData) ? (
          <>
            {renderMeetingHeader()}
            {renderMeetingDetails()}
          </>
        ) : (
          <View style={styles.noMeetingsContainer}>
            <Ionicons name="document-outline" size={80} color={colors.textTertiary} />
            <Text style={[styles.noMeetingsTitle, { color: colors.text }]}>Meeting Data Not Available</Text>
            <Text style={[styles.noMeetingsText, { color: colors.textSecondary }]}>Unable to load the meeting summary.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    padding: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  skeletonCard: {
    height: 120,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs / 2,
  },
  refreshButton: {
    padding: spacing.sm,
    marginLeft: spacing.sm,
  },
  content: {
    flex: 1,
  },
  meetingHeaderCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    marginHorizontal: -spacing.sm,
  },
  meetingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  meetingHeaderInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  meetingTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  meetingDate: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.xs / 2,
  },
  meetingTime: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs / 2,
  },
  meetingLocation: {
    fontSize: typography.fontSize.sm,
  },
  meetingDescription: {
    fontSize: typography.fontSize.base,
    lineHeight: 22,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyStateText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  meetingsList: {
    // Remove maxHeight for mobile
  },
  meetingItem: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  meetingItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  meetingItemInfo: {
    flex: 1,
  },
  meetingItemTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs / 2,
  },
  meetingItemDate: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs / 2,
  },
  meetingItemTime: {
    fontSize: typography.fontSize.sm,
  },
  detailsContainer: {
    paddingHorizontal: spacing.md,
  },
  overviewCard: {
    marginBottom: spacing.sm,
    marginHorizontal: -spacing.sm,
  },
  detailsTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
  },
  detailsDescription: {
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * 1.5,
    marginBottom: spacing.md,
  },
  meetingMetadata: {
    gap: spacing.sm,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metadataText: {
    fontSize: typography.fontSize.sm,
  },
  attendanceCard: {
    marginBottom: spacing.md,
  },
  attendanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0, 212, 170, 0.05)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs / 2,
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
  },
  attendanceCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    marginHorizontal: -spacing.sm,
  },
  attendanceList: {
    marginTop: spacing.md,
  },
  subsectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  attendanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  attendanceInfo: {
    flex: 1,
  },
  attendeeName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs / 2,
  },
  attendanceType: {
    fontSize: typography.fontSize.sm,
  },
  attendanceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  attendanceStatusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
minutesCard: {
    marginBottom: spacing.sm,
    marginHorizontal: -spacing.sm,
  },
  minutesContent: {
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * 1.6,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  minutesMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  minutesStatus: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  minutesTakenBy: {
    fontSize: typography.fontSize.sm,
  },
  documentsCard: {
    marginBottom: spacing.sm,
    marginHorizontal: -spacing.sm,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs / 2,
  },
  documentType: {
    fontSize: typography.fontSize.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyStateText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 22,
  },
  noMeetingsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  noMeetingsTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  noMeetingsText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 350,
    marginBottom: spacing.md,
  },
  requirementsList: {
    alignSelf: 'stretch',
    marginBottom: spacing.lg,
  },
  requirementItem: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.xs,
    textAlign: 'left',
  },
  helpText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    fontWeight: typography.fontWeight.medium,
    fontStyle: 'italic',
  },

  // Attendance Table Styles
  attendanceTable: {
    width: '100%',
  },

});

export default MeetingSummaryScreen;
