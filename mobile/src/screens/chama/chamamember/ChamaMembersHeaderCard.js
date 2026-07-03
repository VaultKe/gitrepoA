import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../../components/common/Card';
import Input from '../../../components/common/Input';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';

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
}) => {
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);
  const [showExportMenu, setShowExportMenu] = useState(false);

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
          <View style={styles.exportContainer}>
            <TouchableOpacity
              style={styles.exportMenuButton}
              onPress={() => setShowExportMenu(!showExportMenu)}
              accessibilityLabel="Export options"
              accessibilityHint="Tap to see export options for members"
            >
              <Text style={styles.exportMenuButtonText}>...</Text>
            </TouchableOpacity>

            {showExportMenu && (
              <TouchableOpacity
                style={styles.exportMenuOverlay}
                activeOpacity={1}
                onPress={() => setShowExportMenu(false)}
              />
            )}

            {showExportMenu && (
              <View style={styles.exportMenuDropdown}>
                <TouchableOpacity
                  style={styles.exportMenuItem}
                  onPress={() => {
                    setShowExportMenu(false);
                    onExportMenuPress?.();
                  }}
                >
                  <View style={styles.exportMenuIconContainer}>
                    <Ionicons name="download-outline" size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.exportMenuItemText}>Export Members</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    </Card>
  );
};

const createStyles = (colors) => StyleSheet.create({
  headerCard: {
    padding: spacing.md,
    marginHorizontal: spacing.md,
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
  headerActionsContainer: {
    marginLeft: 'auto',
    paddingLeft: spacing.sm,
    position: 'relative',
  },
  exportMenuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.border + '40',
    borderWidth: 1,
    borderColor: colors.border,
  },
  exportMenuButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  exportMenuOverlay: {
    position: 'absolute',
    top: -200,
    left: -200,
    right: 200,
    bottom: 200,
    zIndex: 1,
  },
  exportMenuDropdown: {
    position: 'absolute',
    top: 36,
    right: 0,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingVertical: spacing.xs,
    minWidth: 180,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    zIndex: 2,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  exportMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  exportMenuIconContainer: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '20',
  },
  exportMenuItemText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text,
  },
});

export default ChamaMembersHeaderCard;
