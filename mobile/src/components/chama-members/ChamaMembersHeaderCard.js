import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';
import Input from '../common/Input';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const ChamaMembersHeaderCard = ({
  activeTab,
  searchQuery,
  setSearchQuery,
  filteredMembersCount,
  sentInvitationsCount,
  canManageMembers,
  canExportMembers,
  setActiveTab,
  theme,
  onExportMenuPress,
}) => {
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);

  return (
    <Card variant="outlined" padding="none" style={styles.headerCard}>
      <Input
        placeholder={activeTab === 'members' ? 'Search members...' : 'Search invitations...'}
        value={searchQuery}
        onChangeText={setSearchQuery}
        leftIcon="search"
        style={styles.searchInput}
      />

      <View style={styles.compactTabContainer}>
        <TouchableOpacity
          style={[
            styles.compactTab,
            activeTab === 'members' ? styles.compactTabActive : styles.compactTabInactive,
          ]}
          onPress={() => setActiveTab('members')}
        >
          <Ionicons
            name="people"
            size={16}
            color={activeTab === 'members' ? colors.primary : colors.textSecondary}
          />
          <Text style={[
            styles.compactTabText,
            activeTab === 'members' ? styles.compactTabTextActive : styles.compactTabTextInactive,
          ]}>
            Members ({filteredMembersCount})
          </Text>
        </TouchableOpacity>

        {canManageMembers() && (
          <TouchableOpacity
            style={[
              styles.compactTab,
              activeTab === 'invitations' ? styles.compactTabActive : styles.compactTabInactive,
            ]}
            onPress={() => setActiveTab('invitations')}
          >
            <Ionicons
              name="mail"
              size={16}
              color={activeTab === 'invitations' ? colors.primary : colors.textSecondary}
            />
            <Text style={[
              styles.compactTabText,
              activeTab === 'invitations' ? styles.compactTabTextActive : styles.compactTabTextInactive,
            ]}>
              Invitations ({sentInvitationsCount})
            </Text>
          </TouchableOpacity>
        )}

        {canExportMembers && (
          <TouchableOpacity
            style={styles.exportButton}
            onPress={() => onExportMenuPress?.()}
            accessibilityLabel="Export members"
            accessibilityHint="Export member list to Excel"
          >
            <Ionicons name="download-outline" size={16} color={colors.primary} />
            <Text style={styles.exportButtonText}>Export</Text>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
};

const createStyles = (colors) => StyleSheet.create({
  headerCard: {
    padding: spacing.md,
    marginHorizontal: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: 8,
  },
  searchInput: {
    marginBottom: spacing.sm,
  },
  compactTabContainer: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  compactTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginHorizontal: spacing.xs,
    borderRadius: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  compactTabActive: {
    backgroundColor: colors.primary + '15',
    borderBottomColor: colors.primary,
  },
  compactTabInactive: {
    backgroundColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  compactTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  compactTabTextActive: {
    color: colors.primary,
  },
  compactTabTextInactive: {
    color: colors.textSecondary,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary + '30',
    gap: spacing.xs,
  },
  exportButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
});

export default ChamaMembersHeaderCard;
