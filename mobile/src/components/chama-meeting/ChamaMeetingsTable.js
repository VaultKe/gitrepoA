import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const ChamaMeetingsTable = ({
  meetings,
  totalCount,
  totalPages,
  loading,
  refreshing,
  onRefresh,
  currentPage,
  setCurrentPage,
  renderEmptyState,
  formatMeetingDate,
  getDynamicStatus,
  getStatusColor,
  onViewSummary,
  onAttend,
  onDelete,
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);

  const renderMeetingRow = ({ item, index }) => {
    const status = getDynamicStatus(item, 'all');
    const statusColor = getStatusColor(status);

    return (
      <View style={index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
        <View style={[styles.tableCell, styles.titleCell]}>
          <Text style={[styles.tableCellText, styles.tableCellTextDefault]} numberOfLines={2}>
            {item.title.length > 30 ? `${item.title.substring(0, 30)}..` : item.title}
          </Text>
        </View>
        <View style={[styles.tableCell, styles.dateCell]}>
          <Text style={[styles.tableCellText, styles.tableCellTextDefault]}>
            {formatMeetingDate(item.scheduledAt || item.date)}
          </Text>
        </View>
        <View style={[styles.tableCell, styles.locationCell]}>
          <Text style={[styles.tableCellText, styles.tableCellTextDefault]}>
            {item.location}
          </Text>
        </View>
        <View style={[styles.tableCell, styles.statusCell]}>
          <View style={[styles.statusBadge, getStatusBadgeStyle(status, styles)]}>
            <Text style={[styles.statusText, getStatusTextStyle(status, styles)]}>
              {status}
            </Text>
          </View>
        </View>
        <View style={[styles.tableCell, styles.actionsCell]}>
          <TouchableOpacity
            style={[styles.actionButtonSmall, styles.actionButtonPrimary]}
            onPress={() => onViewSummary(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="eye" size={12} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButtonSmall, styles.actionButtonSuccess]}
            onPress={() => onAttend(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="play" size={12} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButtonSmall, styles.actionButtonError]}
            onPress={() => onDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash" size={12} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.tableContainer}>
      <Card variant="outlined" padding="none" style={styles.tableCard}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tableScrollContent}
          pointerEvents="box-none"
        >
          <View style={styles.tableContent}>
            <View style={styles.tableHeader}>
              <View style={[styles.tableCell, styles.titleCell]}>
                <Text numberOfLines={1} style={[styles.tableHeaderText, styles.tableHeaderTextTitle]}>Title</Text>
              </View>
              <View style={[styles.tableCell, styles.dateCell]}>
                <Text numberOfLines={1} style={styles.tableHeaderText}>Date</Text>
              </View>
              <View style={[styles.tableCell, styles.locationCell]}>
                <Text numberOfLines={1} style={styles.tableHeaderText}>Location</Text>
              </View>
              <View style={[styles.tableCell, styles.statusCell]}>
                <Text numberOfLines={1} style={styles.tableHeaderText}>Status</Text>
              </View>
              <View style={[styles.tableCell, styles.actionsCell]}>
                <Text numberOfLines={1} style={styles.tableHeaderText}>Actions</Text>
              </View>
            </View>

            <FlatList
              data={meetings}
              renderItem={renderMeetingRow}
              keyExtractor={(item) => item.id}
              style={styles.tableList}
              contentContainerStyle={styles.tableListContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                />
              }
              ListEmptyComponent={!loading && renderEmptyState()}
            />

            {totalPages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[
                    styles.pageButton,
                    currentPage === 1 && styles.pageButtonDisabled,
                  ]}
                  onPress={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <Text style={[styles.pageButtonText, currentPage === 1 && styles.pageButtonTextDisabled]}>
                    Previous
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.pageText, styles.pageTextDefault]}>
                  {currentPage} of {totalPages}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.pageButton,
                    currentPage === totalPages && styles.pageButtonDisabled,
                  ]}
                  onPress={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <Text style={[styles.pageButtonText, currentPage === totalPages && styles.pageButtonTextDisabled]}>
                    Next
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </Card>
    </View>
  );
};

const getStatusBadgeStyle = (status, styles) => {
  switch (status) {
    case 'SCHEDULED':
      return styles.statusBadgePrimary;
    case 'ONGOING':
      return styles.statusBadgeWarning;
    case 'ENDED':
      return styles.statusBadgeSuccess;
    case 'cancelled':
      return styles.statusBadgeError;
    default:
      return styles.statusBadgeMuted;
  }
};

const getStatusTextStyle = (status, styles) => {
  switch (status) {
    case 'SCHEDULED':
      return styles.statusTextPrimary;
    case 'ONGOING':
      return styles.statusTextWarning;
    case 'ENDED':
      return styles.statusTextSuccess;
    case 'cancelled':
      return styles.statusTextError;
    default:
      return styles.statusTextMuted;
  }
};

const createStyles = (colors) => StyleSheet.create({
  tableContainer: {
    marginHorizontal: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    alignSelf: 'stretch',
  },
  tableCard: {
    minHeight: 520,
    borderRadius: 8,
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tableScrollContent: {
    flexGrow: 1,
    width: '100%',
  },
  tableContent: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary + '10',
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  titleCell: {
    flex: 1.5,
    alignItems: 'flex-start',
  },
  dateCell: {
    flex: 1,
  },
  locationCell: {
    flex: 1,
  },
  statusCell: {
    flex: 1,
  },
  actionsCell: {
    flex: 1.5,
    flexDirection: 'row',
    gap: 4,
  },
  tableHeaderText: {
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    fontSize: 12,
    textAlign: 'center',
  },
  tableHeaderTextTitle: {
    textAlign: 'left',
  },
  tableList: {
    flex: 1,
  },
  tableListContent: {
    flexGrow: 1,
  },
  tableRowEven: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  tableRowOdd: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  tableCellText: {
    fontSize: 12,
    fontWeight: typography.fontWeight.medium,
  },
  tableCellTextDefault: {
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  statusBadgePrimary: {
    backgroundColor: colors.primary + '20',
  },
  statusBadgeWarning: {
    backgroundColor: colors.warning + '20',
  },
  statusBadgeSuccess: {
    backgroundColor: colors.success + '20',
  },
  statusBadgeError: {
    backgroundColor: colors.error + '20',
  },
  statusBadgeMuted: {
    backgroundColor: colors.textSecondary + '20',
  },
  statusText: {
    fontSize: 7,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
  },
  statusTextPrimary: {
    color: colors.primary,
  },
  statusTextWarning: {
    color: colors.warning,
  },
  statusTextSuccess: {
    color: colors.success,
  },
  statusTextError: {
    color: colors.error,
  },
  statusTextMuted: {
    color: colors.textSecondary,
  },
  actionButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 2,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  actionButtonSuccess: {
    backgroundColor: colors.success,
  },
  actionButtonError: {
    backgroundColor: colors.error,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  pageButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  pageButtonDisabled: {
    opacity: 0.5,
    backgroundColor: colors.border,
  },
  pageButtonActive: {
    backgroundColor: colors.surface,
  },
  pageText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  pageTextDefault: {
    color: colors.text,
  },
  pageButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary,
  },
  pageButtonTextDisabled: {
    color: colors.textSecondary,
  },
});

export default ChamaMeetingsTable;
