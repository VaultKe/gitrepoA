import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';

const ViewMemberActivitySection = ({
  recentActivity,
  activityPage,
  setActivityPage,
  activityItemsPerPage,
  getActivityColor,
  formatDate,
  formatCurrency,
  styles,
  colors,
}) => {
  if (!recentActivity || recentActivity.length === 0) {
    return (
      <Card variant="outlined" padding="none" style={{ borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
        <View style={{ padding: 16, alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary }}>No recent activity</Text>
        </View>
      </Card>
    );
  }

  const totalPages = Math.ceil(recentActivity.length / activityItemsPerPage);
  const startIndex = (activityPage - 1) * activityItemsPerPage;
  const paginatedItems = recentActivity.slice(startIndex, startIndex + activityItemsPerPage);

  const renderRows = () =>
    paginatedItems.map((activity, index) => (
      <View
        key={activity.id || `activity-${startIndex + index}`}
        style={[
          styles.activityRow,
          { backgroundColor: index % 2 === 0 ? colors.background : colors.surface },
        ]}
      >
        <Text style={[styles.activityCellText, { color: colors.textSecondary }]}>
          {formatDate(activity.date)}
        </Text>
        <Text style={[styles.activityCellText, { color: colors[getActivityColor(activity.type)] || colors.text }]}>
          {activity.type?.charAt(0).toUpperCase() + activity.type?.slice(1)}
        </Text>
        <Text style={[styles.activityCellText, { color: colors.text }]}>
          {formatCurrency(activity.amount)}
        </Text>
        <Text style={[styles.activityCellText, { color: colors.text }]} numberOfLines={1}>
          {activity.description || 'N/A'}
        </Text>
      </View>
    ));

  return (
    <Card variant="outlined" padding="none" style={{ borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ padding: 16 }}>
        <Text style={{ color: colors.text, marginBottom: 12, fontSize: 16, fontWeight: '600' }}>
          Recent Activity
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ minWidth: 400 }}>
            <View style={[styles.activityTableHeader, { backgroundColor: colors.primary + '10' }]}>
              <Text style={[styles.activityHeaderText, { color: colors.primary, flex: 1 }]}>Date</Text>
              <Text style={[styles.activityHeaderText, { color: colors.primary, flex: 1 }]}>Type</Text>
              <Text style={[styles.activityHeaderText, { color: colors.primary, flex: 1 }]}>Amount</Text>
              <Text style={[styles.activityHeaderText, { color: colors.primary, flex: 1.5 }]}>Description</Text>
            </View>
            {renderRows()}
          </View>
        </ScrollView>
        {totalPages > 1 && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, gap: 16, marginTop: 8 }}>
            <TouchableOpacity
              style={[styles.paginationButton, { backgroundColor: activityPage > 1 ? colors.primary : colors.border }]}
              onPress={() => setActivityPage(Math.max(1, activityPage - 1))}
              disabled={activityPage === 1}
            >
              <Ionicons name="chevron-back" size={16} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.paginationText, { color: colors.text }]}>
              Page {activityPage} of {totalPages}
            </Text>
            <TouchableOpacity
              style={[styles.paginationButton, { backgroundColor: activityPage < totalPages ? colors.primary : colors.border }]}
              onPress={() => setActivityPage(Math.min(totalPages, activityPage + 1))}
              disabled={activityPage === totalPages}
            >
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Card>
  );
};

export default ViewMemberActivitySection;
