import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';

const ContributionTypeSelector = ({
  contributionType,
  selectedMerryGoRound,
  selectedWelfare,
  merryGoRounds,
  welfareContributions,
  loadingContributionOptions,
  showContributionTypeDropdown,
  showMerryGoRoundDropdown,
  showWelfareDropdown,
  onContributionTypeChange,
  onMerryGoRoundSelect,
  onWelfareSelect,
  onToggleContributionType,
  onToggleMerryGoRound,
  onToggleWelfare,
  formatCurrency,
  availableContributionTypes = ['regular', 'merry-go-round', 'welfare', 'savings'],
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const allContributionTypes = [
    {
      id: 'merry-go-round',
      label: 'Merry-Go-Round',
      icon: 'refresh-circle',
      color: colors.warning,
    },
    {
      id: 'welfare',
      label: 'Welfare',
      icon: 'heart',
      color: '#EC4899',
    },
    {
      id: 'savings',
      label: 'Savings',
      icon: 'wallet',
      color: colors.success,
    },
  ];

  const enabledContributionTypes = allContributionTypes.filter(type =>
    availableContributionTypes.includes(type.id)
  );

  return (
    <View style={styles.contributionTypeWrapper}>
      <View style={styles.contributionTypeContainer}>
        <Text style={[styles.contributionTypeLabel, { color: colors.text }]}>
          Contribution Type
        </Text>
        
        {/* Contribution Type Dropdown Trigger */}
        <TouchableOpacity
          style={[styles.contributionTypeSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={onToggleContributionType}
        >
          <View style={styles.contributionTypeSelectorContent}>
            <Ionicons
              name={
                contributionType === 'merry-go-round' ? 'refresh-circle' :
                contributionType === 'welfare' ? 'heart' :
                contributionType === 'savings' ? 'wallet' : 'people'
              }
              size={20}
              color={
                contributionType === 'merry-go-round' ? colors.warning :
                contributionType === 'welfare' ? '#EC4899' :
                contributionType === 'savings' ? colors.success : colors.primary
              }
            />
            <Text style={[styles.contributionTypeSelectorText, { color: colors.text }]}>
              {contributionType === 'merry-go-round' ? 'Merry-Go-Round' :
               contributionType === 'welfare' ? 'Welfare' :
               contributionType === 'savings' ? 'Savings' : 'Regular'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Contribution Type Options Dropdown */}
        {showContributionTypeDropdown && (
          <View style={[styles.contributionTypeDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {enabledContributionTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.contributionTypeOption,
                  { backgroundColor: contributionType === type.id ? colors.primary + '15' : 'transparent' }
                ]}
                onPress={() => onContributionTypeChange(type.id)}
              >
                <Ionicons name={type.icon} size={20} color={type.color} />
                <Text style={[styles.contributionTypeOptionText, { color: colors.text }]}>
                  {type.label}
                </Text>
                {contributionType === type.id && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Merry-Go-Round Cycle Selection - Conditional Dropdown */}
        {contributionType === 'merry-go-round' && (
          <View style={styles.conditionalDropdownContainer}>
            <Text style={[styles.contributionTypeLabel, { color: colors.text }]}>
              Select Merry-Go-Round Cycle
            </Text>
            
            <TouchableOpacity
              style={[styles.contributionTypeSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={onToggleMerryGoRound}
              disabled={loadingContributionOptions || merryGoRounds.length === 0}
            >
              <View style={styles.contributionTypeSelectorContent}>
                <Ionicons name="refresh-circle" size={20} color={colors.warning} />
                <Text style={[styles.contributionTypeSelectorText, { color: colors.text }]}>
                  {selectedMerryGoRound 
                    ? selectedMerryGoRound.name || `Cycle ${selectedMerryGoRound.position || ''}`
                    : loadingContributionOptions 
                      ? 'Loading cycles...' 
                      : merryGoRounds.length === 0 
                        ? 'No cycles available' 
                        : 'Select a cycle'
                  }
                </Text>
              </View>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Merry-Go-Round Cycles Dropdown */}
            {showMerryGoRoundDropdown && merryGoRounds.length > 0 && (
              <View style={[styles.contributionTypeDropdown, { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: 200 }]}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {merryGoRounds.map((round) => (
                    <TouchableOpacity
                      key={round.id}
                      style={[
                        styles.contributionTypeOption,
                        { backgroundColor: selectedMerryGoRound?.id === round.id ? colors.primary + '15' : 'transparent' }
                      ]}
                      onPress={() => onMerryGoRoundSelect(round)}
                    >
                      <View style={styles.merryGoRoundOptionContent}>
                        <Text style={[styles.contributionTypeOptionText, { color: colors.text }]}>
                          {round.name || `Cycle ${round.position || round.id?.slice(-4)}`}
                        </Text>
                        <Text style={[styles.merryGoRoundAmountText, { color: colors.textSecondary }]}>
                          Amount: {round.amountPerRound ? formatCurrency(round.amountPerRound) : round.amount ? formatCurrency(round.amount) : 'Variable'}
                        </Text>
                      </View>
                      {selectedMerryGoRound?.id === round.id && (
                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Welfare Contribution Selection - Conditional Dropdown */}
        {contributionType === 'welfare' && (
          <View style={styles.conditionalDropdownContainer}>
            <Text style={[styles.contributionTypeLabel, { color: colors.text }]}>
              Select Welfare Contribution
            </Text>
            
            <TouchableOpacity
              style={[styles.contributionTypeSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={onToggleWelfare}
              disabled={loadingContributionOptions || welfareContributions.length === 0}
            >
              <View style={styles.contributionTypeSelectorContent}>
                <Ionicons name="heart" size={20} color="#EC4899" />
                <Text style={[styles.contributionTypeSelectorText, { color: colors.text }]}>
                  {selectedWelfare
                    ? selectedWelfare.title || selectedWelfare.purpose || `Welfare #${selectedWelfare.id?.slice(-4)}`
                    : loadingContributionOptions
                      ? 'Loading contributions...'
                      : welfareContributions.length === 0
                        ? 'No welfare contributions available'
                        : 'Select a contribution'
                  }
                </Text>
              </View>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Welfare Contributions Dropdown */}
            {showWelfareDropdown && welfareContributions.length > 0 && (
              <View style={[styles.contributionTypeDropdown, { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: 200 }]}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {welfareContributions.map((welfare) => (
                    <TouchableOpacity
                      key={welfare.id}
                      style={[
                        styles.contributionTypeOption,
                        { backgroundColor: selectedWelfare?.id === welfare.id ? colors.primary + '15' : 'transparent' }
                      ]}
                      onPress={() => onWelfareSelect(welfare)}
                    >
                      <View style={styles.welfareOptionContent}>
                        <Text style={[styles.contributionTypeOptionText, { color: colors.text }]} numberOfLines={1}>
                          {welfare.title || welfare.purpose || `Welfare Request`}
                        </Text>
                        <Text style={[styles.welfareAmountText, { color: colors.textSecondary }]}>
                          Amount: {welfare.amount ? formatCurrency(welfare.amount) : 'Any amount'}
                        </Text>
                        <Text style={[styles.welfareStatusText, { color: colors.textTertiary }]}>
                          Status: {welfare.status || 'active'}
                        </Text>
                      </View>
                      {selectedWelfare?.id === welfare.id && (
                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Savings Notice */}
        {contributionType === 'savings' && (
          <View style={[styles.savingsNotice, { backgroundColor: colors.success + '10', borderColor: colors.success }]}>
            <Ionicons name="information-circle" size={20} color={colors.success} />
            <Text style={[styles.savingsNoticeText, { color: colors.textSecondary }]}>
              Savings contributions allow you to save any amount to your chama savings subwallet.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  contributionTypeWrapper: {
    marginBottom: spacing.lg,
  },
  contributionTypeContainer: {
    marginBottom: spacing.sm,
  },
  contributionTypeLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  contributionTypeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  contributionTypeSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  contributionTypeSelectorText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.md,
    flex: 1,
  },
  contributionTypeDropdown: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginTop: spacing.xs,
    maxHeight: 200,
    overflow: 'hidden',
    ...shadows.lg,
  },
  contributionTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  contributionTypeOptionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
    marginLeft: spacing.md,
  },
  conditionalDropdownContainer: {
    marginTop: spacing.md,
  },
  merryGoRoundOptionContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  merryGoRoundAmountText: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  welfareOptionContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  welfareAmountText: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  welfareStatusText: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  savingsNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  savingsNoticeText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
});

export default ContributionTypeSelector;