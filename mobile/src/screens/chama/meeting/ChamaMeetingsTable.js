import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../../components/common/Card';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';

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
  const colors = getThemeColors();
  const styles = createStyles(colors);

  const renderMeetingRow = ({ item, index }) => {
    const status = getDynamicStatus(item, 'all');
    const statusColor = getStatusColor(status);

    return (
      <View style={index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
        <View style={[styles.tableCell, styles.titleCell]}>
          <Text style={[styles.tableCellText, styles.tableCellTextDefault]} numberOfLines={2}>
            {item.title.length > 10 ? `${item.title.substring(0, 10)}..` : item.title}
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
          >
            <Ionicons name="eye" size={12} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButtonSmall, styles.actionButtonSuccess]}
            onPress={() => onAttend(item)}
          >
            <Ionicons name="play" size={12} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButtonSmall, styles.actionButtonError]}
            onPress={() => onDelete(item)}
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
        >
          <View style={styles.tableContent}>
            <View style={styles.tableHeader}>
              <View style={[styles.tableCell, styles.titleCell]}>
                <Text style={[styles.tableHeaderText, styles.tableHeaderTextDefault, styles.tableHeaderTextTitle]}>Title</Text>
              </View>
              <View style={[styles.tableCell, styles.dateCell]}>
                <Text style={[styles.tableHeaderText, styles.tableHeaderTextDefault]}>Date</Text>
              </View>
              <View style={[styles.tableCell, styles.locationCell]}>
                <Text style={[styles.tableHeaderText, styles.tableHeaderTextDefault]}>Location</Text>
              </View>
              <View style={[styles.tableCell, styles.statusCell]}>
                <Text style={[styles.tableHeaderText, styles.tableHeaderTextDefault]}>Status</Text>
              </View>
              <View style={[styles.tableCell, styles.actionsCell]}>
                <Text style={[styles.tableHeaderText, styles.tableHeaderTextDefault]}>Actions</Text>
              </View>
            </View>

            <FlatList
              data={meetings}
              renderItem={renderMeetingRow}
              keyExtractor={(item) => item.id}
              style={styles.tableList}
              contentContainerStyle={styles.tableListContent}
              showsVerticalScrollIndicator={false}
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
                    currentPage === 1 ? styles.pageButtonDisabled : styles.pageButtonActive,
                  ]}
                  onPress={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={currentPage === 1 ? colors.textSecondary : colors.text}
                  />
                </TouchableOpacity>
                <Text style={[styles.pageText, styles.pageTextDefault]}>
                  {currentPage} of {totalPages}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.pageButton,
                    currentPage === totalPages ? styles.pageButtonDisabled : styles.pageButtonActive,
                  ]}
                  onPress={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={currentPage === totalPages ? colors.textSecondary : colors.text}
                  />
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
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    alignSelf: 'stretch',
  },
  tableCard: {
    minHeight: 360,
    borderRadius: 8,
    width: '100%',
    alignSelf: 'stretch',
    padding: spacing.md,
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
    minWidth: 680,
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    backgroundColor: colors.surface,
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  titleCell: {
    flex: 2,
    alignItems: 'flex-start',
  },
  dateCell: {
    flex: 1.5,
  },
  locationCell: {
    flex: 1,
  },
  statusCell: {
    flex: 1,
  },
  actionsCell: {
    flex: 1.5,
  },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
  },
  tableHeaderTextDefault: {
    color: colors.text,
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
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  tableRowOdd: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  tableCellText: {
    fontSize: 8.5,
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
});

export default ChamaMeetingsTable;
