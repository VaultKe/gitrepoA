import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const MemberListingSection = ({
  chamaMembers,
  selectedContributor,
  memberSearchQuery,
  setMemberSearchQuery,
  contributionType,
  roundName,
  setSelectedContributor,
  getMemberName,
  renderMemberAvatar,
  validateMemberSelection,
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const renderMemberCard = ({ item }) => {
    const isSelected = selectedContributor?.id === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.memberChip,
          {
            backgroundColor: isSelected ? colors.primary + '20' : colors.surface,
            borderColor: isSelected ? colors.primary : colors.border,
          },
        ]}
        onPress={() => {
          if (validateMemberSelection(item)) {
            setSelectedContributor(item);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.memberChipContent}>
          <View style={[styles.memberChipAvatar, { backgroundColor: isSelected ? colors.primary : colors.backgroundSecondary }]}>
            {renderMemberAvatar(item)}
          </View>
          <Text style={[styles.memberChipName, { color: isSelected ? colors.primary : colors.text }]} numberOfLines={1}>
            {getMemberName(item)}
          </Text>
        </View>
        {isSelected && (
          <View style={[styles.memberChipCheck, { backgroundColor: colors.primary }]}>
            <Ionicons name="checkmark" size={14} color={colors.white} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.memberListingSection}>
      <View style={styles.memberListingHeader}>
        <Text style={[styles.memberListingTitle, { color: colors.text }]}>
          {contributionType === 'merry-go-round'
            ? `Select ${roundName || 'Merry-Go-Round'} Participant`
            : `Select Member to Pay For`
          }
        </Text>
        <Text style={[styles.memberListingSubtitle, { color: colors.textSecondary }]}>
          {contributionType === 'merry-go-round'
            ? `Only members of this merry-go-round circle can be paid for`
            : `Choose the member you want to pay for. The amount will be deducted from your wallet.`
          }
        </Text>
      </View>

      {chamaMembers.length > 0 ? (
        <View style={styles.memberPickerContainer}>
          <View style={styles.memberSearchContainer}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={styles.memberSearchInput}
              placeholder="Search members..."
              placeholderTextColor={colors.textSecondary}
              value={memberSearchQuery}
              onChangeText={setMemberSearchQuery}
            />
            {memberSearchQuery ? (
              <TouchableOpacity onPress={() => setMemberSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.memberGridScroll}
            contentContainerStyle={styles.memberGridContent}
          >
            {chamaMembers
              .filter(member => {
                const name = getMemberName(member).toLowerCase();
                return !memberSearchQuery || name.includes(memberSearchQuery.toLowerCase());
              })
              .map((member) => (
                <View key={member.id} style={styles.memberChipWrapper}>
                  {renderMemberCard({ item: member })}
                </View>
              ))}
          </ScrollView>
        </View>
      ) : (
        <View style={[styles.noMembersContainer, { backgroundColor: colors.surface }]}>
          <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.noMembersText, { color: colors.textSecondary }]}>
            {contributionType === 'merry-go-round'
              ? `No participants in ${roundName || 'this merry-go-round'}`
              : 'No members available for selection'
            }
          </Text>
          <Text style={[styles.noMembersSubtext, { color: colors.textTertiary }]}>
            {contributionType === 'merry-go-round'
              ? 'Only circle participants can make contributions'
              : 'Members will appear here once loaded'
            }
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  memberListingSection: {
    marginTop: spacing.xxxl,
    marginBottom: spacing.lg,
  },
  memberListingHeader: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  memberListingTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  memberListingSubtitle: {
    fontSize: typography.fontSize.sm,
  },
  memberPickerContainer: {
    maxHeight: 320,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  memberSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  memberSearchInput: {
    flex: 1,
    fontSize: typography.fontSize.sm,
  },
  memberGridScroll: {
    flex: 1,
  },
  memberGridContent: {
    padding: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    minWidth: 100,
    flexShrink: 1,
    overflow: 'hidden',
  },
  memberChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  memberChipAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  memberChipName: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    flexShrink: 1,
  },
  memberChipCheck: {
    marginLeft: spacing.xs,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberChipWrapper: {
    // No additional styles needed
  },
  noMembersContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  noMembersText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  noMembersSubtext: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
});

export default MemberListingSection;