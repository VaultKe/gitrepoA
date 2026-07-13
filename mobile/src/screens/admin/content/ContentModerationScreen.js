import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import BorderedButton from '../../../components/BorderedButton';
import { ButtonRow, ButtonGrid } from '../../../components/ButtonGroup';

const ContentModerationScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const [refreshing, setRefreshing] = useState(false);
  const [moderationData, setModerationData] = useState({
    pendingReviews: 12,
    flaggedContent: 8,
    autoModerated: 45,
    totalReports: 23,
    flaggedItems: [
      {
        id: 1,
        type: 'chat_message',
        content: 'Inappropriate language in chama chat',
        reporter: 'John Doe',
        reported: '2 hours ago',
        status: 'pending',
        severity: 'medium',
      },
      {
        id: 2,
        type: 'profile_image',
        content: 'Inappropriate profile picture',
        reporter: 'Jane Smith',
        reported: '4 hours ago',
        status: 'pending',
        severity: 'high',
      },
      {
        id: 3,
        type: 'chama_description',
        content: 'Misleading chama information',
        reporter: 'Mike Johnson',
        reported: '1 day ago',
        status: 'reviewed',
        severity: 'low',
      },
    ],
  });

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => {
      setModerationData({
        ...moderationData,
        pendingReviews: Math.floor(Math.random() * 20) + 5,
        flaggedContent: Math.floor(Math.random() * 15) + 3,
      });
      setRefreshing(false);
    }, 1500);
  };

  const handleModerationAction = (itemId, action) => {
    Alert.alert(
      'Confirm Action',
      `Are you sure you want to ${action} this content?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => {
          Alert.alert('Success', `Content has been ${action}d successfully.`);
        }},
      ]
    );
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return colors.error;
      case 'medium': return colors.warning;
      case 'low': return colors.info;
      default: return colors.textSecondary;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return colors.warning;
      case 'reviewed': return colors.success;
      case 'rejected': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getContentTypeIcon = (type) => {
    switch (type) {
      case 'chat_message': return 'chatbubble';
      case 'profile_image': return 'person-circle';
      case 'chama_description': return 'document-text';
      default: return 'help-circle';
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Content starts here - header handled by navigator */}

      {/* Moderation Overview - User Dashboard Style */}
      <Card style={styles.statsCard}>
        <View style={styles.statsGrid}>
          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statTileHeader}>
              <View style={[styles.statTileIcon, { backgroundColor: colors.warning + '15' }]}>
                <Ionicons name="time" size={20} color={colors.warning} />
              </View>
              <Text style={[styles.statTileLabel, { color: colors.textSecondary }]}>
                Pending Reviews
              </Text>
            </View>
            <Text style={[styles.statTileValue, { color: colors.text }]}>
              {moderationData.pendingReviews}
            </Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statTileHeader}>
              <View style={[styles.statTileIcon, { backgroundColor: colors.error + '15' }]}>
                <Ionicons name="flag" size={20} color={colors.error} />
              </View>
              <Text style={[styles.statTileLabel, { color: colors.textSecondary }]}>
                Flagged Content
              </Text>
            </View>
            <Text style={[styles.statTileValue, { color: colors.text }]}>
              {moderationData.flaggedContent}
            </Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statTileHeader}>
              <View style={[styles.statTileIcon, { backgroundColor: colors.success + '15' }]}>
                <Ionicons name="shield-checkmark" size={20} color={colors.success} />
              </View>
              <Text style={[styles.statTileLabel, { color: colors.textSecondary }]}>
                Auto Moderated
              </Text>
            </View>
            <Text style={[styles.statTileValue, { color: colors.text }]}>
              {moderationData.autoModerated}
            </Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statTileHeader}>
              <View style={[styles.statTileIcon, { backgroundColor: colors.info + '15' }]}>
                <Ionicons name="document-text" size={20} color={colors.info} />
              </View>
              <Text style={[styles.statTileLabel, { color: colors.textSecondary }]}>
                Total Reports
              </Text>
            </View>
            <Text style={[styles.statTileValue, { color: colors.text }]}>
              {moderationData.totalReports}
            </Text>
          </View>
        </View>
      </Card>

      {/* Flagged Content */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Flagged Content
        </Text>
        <Card style={[styles.contentCard, { backgroundColor: colors.surface }]}>
          {moderationData.flaggedItems.map((item) => (
            <View key={item.id} style={styles.contentItem}>
              <View style={styles.contentHeader}>
                <View style={styles.contentInfo}>
                  <Ionicons
                    name={getContentTypeIcon(item.type)}
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={[styles.contentType, { color: colors.text }]}>
                    {item.type.replace('_', ' ').toUpperCase()}
                  </Text>
                  <View style={[
                    styles.severityBadge,
                    { backgroundColor: getSeverityColor(item.severity) + '20' }
                  ]}>
                    <Text style={[
                      styles.severityText,
                      { color: getSeverityColor(item.severity) }
                    ]}>
                      {item.severity.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(item.status) + '20' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: getStatusColor(item.status) }
                  ]}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              
              <Text style={[styles.contentDescription, { color: colors.text }]}>
                {item.content}
              </Text>
              
              <View style={styles.contentMeta}>
                <Text style={[styles.contentReporter, { color: colors.textSecondary }]}>
                  Reported by: {item.reporter}
                </Text>
                <Text style={[styles.contentTime, { color: colors.textSecondary }]}>
                  {item.reported}
                </Text>
              </View>

              {item.status === 'pending' && (
                <View style={styles.contentActions}>
                  <ButtonRow spacing={4} justify="space-between">
                    <BorderedButton
                      title="Approve"
                      icon="checkmark"
                      variant="success"
                      size="auto"
                      onPress={() => handleModerationAction(item.id, 'approve')}
                      theme={theme}
                      style={styles.moderationActionButton}
                    />
                    <BorderedButton
                      title="Reject"
                      icon="close"
                      variant="danger"
                      size="auto"
                      onPress={() => handleModerationAction(item.id, 'reject')}
                      theme={theme}
                      style={styles.moderationActionButton}
                    />
                    <BorderedButton
                      title="Warn"
                      icon="warning"
                      variant="warning"
                      size="auto"
                      onPress={() => handleModerationAction(item.id, 'warn')}
                      theme={theme}
                      style={styles.moderationActionButton}
                    />
                  </ButtonRow>
                </View>
              )}
            </View>
          ))}
        </Card>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Quick Actions
        </Text>
        <ButtonGrid spacing={8}>
          <BorderedButton
            title="Moderation Rules"
            icon="settings"
            variant="primary"
            size="small"
            theme={theme}
            style={styles.quickActionButtonBordered}
          />
          <BorderedButton
            title="Moderation Stats"
            icon="analytics"
            variant="secondary"
            size="small"
            theme={theme}
            style={styles.quickActionButtonBordered}
          />
          <BorderedButton
            title="Auto-Moderation"
            icon="shield"
            variant="info"
            size="small"
            theme={theme}
            style={styles.quickActionButtonBordered}
          />
          <BorderedButton
            title="Reports History"
            icon="document-text"
            variant="success"
            size="small"
            theme={theme}
            style={styles.quickActionButtonBordered}
          />
        </ButtonGrid>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  // User Dashboard Style Stats
  statsCard: {
    margin: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statTile: {
    width: '48%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  statTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statTileIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  statTileLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  statTileValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'left',
  },
  contentCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  contentItem: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  contentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  contentType: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
  },
  severityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  severityText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  contentDescription: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.sm,
  },
  contentMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  contentReporter: {
    fontSize: typography.fontSize.sm,
  },
  contentTime: {
    fontSize: typography.fontSize.sm,
  },
  contentActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  actionButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    width: '48%',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  quickActionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  // BorderedButton styles - RESPONSIVE
  moderationActionButton: {
    flex: 1,
    maxWidth: 80,
  },
  quickActionButtonBordered: {
    width: '48%',
    marginBottom: spacing.md,
    maxWidth: 160,
  },
});

export default ContentModerationScreen;
