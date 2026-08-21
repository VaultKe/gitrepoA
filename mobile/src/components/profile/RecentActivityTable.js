import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography } from '../../utils/theme';
import { formatActivityDate, getActivityColor, getActivityIcon, getActivityDescription, formatCurrency } from '../../utils/profileHelpers';

const RecentActivityTable = memo(({ colors, recentActivities, activitiesLoading, formatCurrency: formatCurrencyFn }) => {
  const displayActivities = useMemo(() => recentActivities.slice(0, 10), [recentActivities]);

  if (activitiesLoading) {
    return (
      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={{ marginTop: 8, color: colors.textSecondary }}>Loading activities…</Text>
      </View>
    );
  }

  if (recentActivities.length === 0) {
    return (
      <View>
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: spacing.md, marginBottom: 0 }]}>
          Recent Activity
        </Text>
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <Ionicons name="time-outline" size={40} color={colors.textTertiary || colors.textSecondary} />
          <Text style={{ marginTop: 8, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 }}>
            No activities yet. Your contributions and transactions will appear here.{'\n'}
            Tap a chama on the Home tab to make your first contribution.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: spacing.md, marginBottom: 0 }]}>
        Recent Activity
      </Text>

      <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
        <View style={[styles.activityTableHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.activityHeaderText, styles.activityHeaderDate, { color: colors.textSecondary }]}>Date</Text>
          <Text style={[styles.activityHeaderText, styles.activityHeaderType, { color: colors.textSecondary }]}>Type</Text>
          <Text style={[styles.activityHeaderText, styles.activityHeaderAmount, { color: colors.textSecondary }]}>Amount</Text>
          <Text style={[styles.activityHeaderText, styles.activityHeaderDesc, { color: colors.textSecondary }]}>Description</Text>
        </View>

        <View style={[styles.activityTableBody, { borderBottomColor: colors.border }]}>
          {displayActivities.map((activity, index) => {
            const isAlt = index % 2 !== 0;
            const activityColor = getActivityColor(activity.type, activity.paymentMethod, colors);
            return (
              <View
                key={activity.id || index}
                style={[
                  styles.activityRow,
                  { backgroundColor: isAlt ? colors.surface : colors.background },
                  { borderBottomColor: colors.border },
                ]}
              >
                <View style={styles.activityCell}>
                  <Ionicons name="calendar-outline" size={11} color={colors.textTertiary || colors.textSecondary} />
                  <Text style={[styles.activityCellText, { color: colors.textSecondary, fontSize: 11, marginLeft: 3 }]}>
                    {formatActivityDate(activity.createdAt || activity.created_at)}
                  </Text>
                </View>

                <View style={styles.activityTypeCell}>
                  <View style={[styles.activityTypeBadge, { backgroundColor: activityColor + '18' }]}>
                    <Ionicons name={getActivityIcon(activity.type)} size={12} color={activityColor} />
                    <Text style={[styles.activityTypeText, { color: activityColor }]}>
                      {(activity.type || 'Transaction').replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.activityAmountText,
                    {
                      color:
                        (activity.type || '').toLowerCase() === 'withdrawal' || (activity.type || '').toLowerCase() === 'loan'
                          ? colors.error
                          : colors.success || colors.primary,
                      fontWeight: '600',
                    },
                  ]}
                >
                  {typeof activity.amount === 'number'
                    ? formatCurrencyFn(activity.amount)
                    : formatCurrencyFn(parseFloat(activity.amount) || 0)}
                </Text>

                <Text
                  style={[styles.activityDescText, { color: colors.textSecondary }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {getActivityDescription(activity)}
                </Text>
              </View>
            );
          })}
        </View>

        {recentActivities.length > 10 && (
          <View style={[styles.activityFooter, { borderTopColor: colors.border }]}>
            <Text style={{ color: colors.textTertiary || colors.textSecondary, fontSize: 12 }}>
              Showing 10 of {recentActivities.length} activities
            </Text>
          </View>
        )}
      </Card>
    </View>
  );
});

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.md,
    marginBottom: 0,
  },
  activityTableHeader: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.ss,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  activityHeaderText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityHeaderDate: {
    width: 85,
    marginRight: spacing.xs,
  },
  activityHeaderType: {
    width: 105,
    marginRight: spacing.xs,
  },
  activityHeaderAmount: {
    width: 80,
    marginRight: spacing.xs,
    textAlign: 'right',
  },
  activityHeaderDesc: {
    flex: 1,
  },
  activityTableBody: {
    borderBottomWidth: 1,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    minHeight: 44,
  },
  activityCell: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 85,
    marginRight: spacing.xs,
  },
  activityCellText: {
    flex: 1,
  },
  activityTypeCell: {
    width: 105,
    marginRight: spacing.xs,
  },
  activityTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  activityTypeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.medium,
    marginLeft: 3,
    flexShrink: 1,
  },
  activityAmountText: {
    fontSize: 12,
    width: 80,
    textAlign: 'right',
    marginRight: spacing.xs,
    flexShrink: 0,
  },
  activityDescText: {
    fontSize: 12,
    flexShrink: 1,
  },
  activityFooter: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
});

export default RecentActivityTable;
