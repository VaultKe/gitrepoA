import React, { useState, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import { getTimeAgo } from '../../utils/dateUtils';
import { getNotificationIcon, getNotificationColor } from '../../utils/notificationHelpers';
import NotificationActions from './NotificationActions';

const { width: screenWidth } = Dimensions.get('window');

const NotificationCard = memo(({ item, colors, screenWidth, onMarkAsRead, onDelete, smartNavigate }) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const isRead = item.isRead;

  const iconColor = getNotificationColor(item.type, item.priority, colors);

  return (
    <Card variant="outlined" style={[styles.notificationCard, {
      // Read cards sit on `surface` (not `background`) so they stay distinct
      // from the page, and use the stronger `border` token — `divider` is
      // near-invisible against the dark-mode background. Unread cards get a
      // solid primary border (no alpha) so it reads in both themes.
      backgroundColor: isRead ? colors.surface : colors.primary + '1F',
      borderColor: isRead ? colors.border : colors.primary,
      borderWidth: isRead ? 1 : 2,
    }]}>
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <View style={[styles.notificationIcon, { backgroundColor: iconColor + '26' }]}>
            <Ionicons name={getNotificationIcon(item.type, item.priority)} size={24} color={iconColor} />
          </View>

          <View style={styles.notificationInfo}>
            <View style={styles.titleRow}>
              <Text style={[styles.notificationTitle, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.titleActions}>
                {!isRead && <View style={[styles.unreadDot, { backgroundColor: iconColor }]} />}
              </View>
            </View>
            <Text style={[styles.notificationTime, { color: colors.textTertiary }]}>
              {getTimeAgo(item.createdAt)}
            </Text>
          </View>
        </View>

        <Text style={[styles.notificationMessage, { color: colors.text }]} numberOfLines={3}>
          {item.message}
        </Text>

        {item.action_url && (
          <View style={styles.notificationAction}>
            <Text style={[styles.actionText, { color: colors.primary }]}>
              Tap to view details →
            </Text>
          </View>
        )}
      </View>

      <NotificationActions
        item={item}
        isRead={isRead}
        colors={colors}
        iconColor={iconColor}
        onMarkAsRead={onMarkAsRead}
        onDelete={onDelete}
      />
    </Card>
  );
});

const styles = StyleSheet.create({
  notificationCard: { marginBottom: screenWidth < 350 ? spacing.md : spacing.lg, overflow: 'hidden', minHeight: screenWidth < 350 ? 100 : 120, maxHeight: screenWidth < 350 ? 250 : 300 },
  notificationContent: { padding: screenWidth < 350 ? spacing.md : spacing.lg, paddingBottom: screenWidth < 350 ? spacing.sm : spacing.md },
  notificationHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: screenWidth < 350 ? spacing.md : spacing.lg, minHeight: screenWidth < 350 ? 40 : 48 },
  notificationIcon: { width: screenWidth < 350 ? 40 : 48, height: screenWidth < 350 ? 40 : 48, borderRadius: screenWidth < 350 ? 20 : 24, alignItems: 'center', justifyContent: 'center', marginRight: screenWidth < 350 ? spacing.md : spacing.lg, flexShrink: 0, marginTop: 2 },
  notificationInfo: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: screenWidth < 350 ? spacing.xs : spacing.sm, minHeight: screenWidth < 350 ? 20 : 24 },
  titleActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unreadDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0, marginTop: 2 },
  notificationTitle: { fontSize: screenWidth < 350 ? typography.fontSize.base : typography.fontSize.lg, fontWeight: typography.fontWeight.bold, flex: 1, marginRight: spacing.md, lineHeight: screenWidth < 350 ? 20 : 24 },
  notificationTime: { fontSize: screenWidth < 350 ? typography.fontSize.xs : typography.fontSize.sm, marginTop: spacing.xs, fontWeight: typography.fontWeight.medium },
  notificationMessage: { fontSize: screenWidth < 350 ? typography.fontSize.sm : typography.fontSize.base, lineHeight: screenWidth < 350 ? 20 : 22, marginBottom: screenWidth < 350 ? spacing.sm : spacing.md, fontWeight: typography.fontWeight.normal },
  notificationAction: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.2)' },
  actionText: { fontSize: screenWidth < 350 ? typography.fontSize.sm : typography.fontSize.base, fontWeight: typography.fontWeight.semibold },
});

export default NotificationCard;
