import React, { memo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const { width: screenWidth } = Dimensions.get('window');

const NotificationHeader = memo(({ colors, screenWidth, filters, selectedFilter, setSelectedFilter, invitationsCount, smartNavigate, displayNotifications, markAllAsRead }) => {
  const unreadCount = displayNotifications.filter(n => !n.isRead).length;

  return (
    <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.divider }]}>
      <View style={styles.headerTop}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.menuButton} onPress={() => smartNavigate('Settings')}>
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuButton} onPress={() => smartNavigate('Reminders')}>
            <Ionicons name="alarm-outline" size={22} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuButton} onPress={() => smartNavigate('NotificationTone')}>
            <Ionicons name="musical-notes-outline" size={22} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuButton} onPress={() => smartNavigate('Invitations')}>
            <Ionicons name="mail-outline" size={22} color={colors.text} />
            {invitationsCount > 0 && (
              <View style={[styles.invitationIndicator, { backgroundColor: colors.error }]}>
                <Text style={[styles.invitationCount, { color: colors.white }]}>
                  {invitationsCount > 9 ? '9+' : invitationsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
              <Text style={[styles.markAllText, { color: colors.primary }]}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        horizontal
        data={filters}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor: selectedFilter === item.id ? colors.primary : colors.backgroundSecondary,
                borderColor: colors.border,
              }
            ]}
            onPress={() => setSelectedFilter(item.id)}
          >
            <Text style={[
              styles.filterText,
              {
                color: selectedFilter === item.id ? colors.white : colors.textSecondary
              }
            ]}>
              {item.name} ({item.count})
            </Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContainer}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  headerTitle: { fontSize: screenWidth < 350 ? typography.fontSize.lg : typography.fontSize.xl, fontWeight: typography.fontWeight.bold, flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  markAllButton: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  markAllText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold },
  menuButton: { position: 'relative', padding: spacing.xs, borderRadius: borderRadius.md },
  invitationIndicator: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  invitationCount: { fontSize: 10, fontWeight: typography.fontWeight.bold, lineHeight: 12 },
  filtersContainer: { paddingRight: spacing.md },
  filterChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.lg, marginRight: spacing.xs, borderWidth: 1, minHeight: 32, justifyContent: 'center' },
  filterText: { fontSize: screenWidth < 350 ? typography.fontSize.xs : typography.fontSize.sm, fontWeight: typography.fontWeight.semibold },
});

export default NotificationHeader;
