import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import Dropdown from '../../components/common/Dropdown';
import KENYA_COUNTIES from '../../utils/kenyaCounties';

const CreateChamaStep2 = ({
  chamaData,
  handleInputChange,
  showErrors,
  formErrors,
  colors,
}) => {
  const frequencies = [
    { id: 'weekly', name: 'Weekly' },
    { id: 'monthly', name: 'Monthly' },
    { id: 'quarterly', name: 'Quarterly' },
  ];

  const countyOptions = [
    { value: 'National', label: 'Not specific / Multi-County', icon: 'earth' },
    ...KENYA_COUNTIES.map((county) => ({ value: county, label: county, icon: 'location' })),
  ];

  const isChama = chamaData.group_type === 'chama';

  return (
    <Card style={styles.section} variant="outlined">
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        {isChama ? 'Financial & Location Details' : 'Target & Location Details'}
      </Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        {isChama
          ? 'Set your contribution amount, frequency, and where your chama is based.'
          : 'Define your target amount and where the contribution group operates.'}
      </Text>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Location</Text>
      <Dropdown
        label="County *"
        value={chamaData.county}
        placeholder="Select county"
        options={countyOptions}
        searchable
        searchPlaceholder="Search counties..."
        onSelect={(county) => handleInputChange('county', county)}
        error={showErrors && !!formErrors.county}
        errorText={formErrors.county}
        colors={colors}
      />

      <Input
        label="Town *"
        value={chamaData.town}
        onChangeText={(text) => handleInputChange('town', text)}
        placeholder="Enter town"
        error={showErrors && formErrors.town}
      />

      <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: spacing.lg }]}>
        {isChama ? 'Contributions' : 'Target'}
      </Text>

      {isChama ? (
        <View style={styles.row}>
          <Input
            label="Contribution Amount"
            value={chamaData.contribution_amount}
            onChangeText={(text) => handleInputChange('contribution_amount', text)}
            placeholder="0"
            keyboardType="numeric"
            style={styles.halfInput}
            error={showErrors && formErrors.contribution_amount}
          />
          <Dropdown
            label="Frequency *"
            value={chamaData.contribution_frequency}
            placeholder="Select frequency"
            options={frequencies.map((freq) => ({ value: freq.id, label: freq.name }))}
            onSelect={(freq) => handleInputChange('contribution_frequency', freq)}
            colors={colors}
            style={[styles.halfInput, { marginTop: spacing.sm }]}
          />
        </View>
      ) : (
        <>
          <Input
            label="Target Amount (KES) *"
            value={chamaData.target_amount}
            onChangeText={(text) => handleInputChange('target_amount', text)}
            placeholder="e.g., 50000"
            keyboardType="numeric"
            error={showErrors && formErrors.target_amount}
          />
          <Input
            label="Contribution Rules"
            value={chamaData.contribution_rules}
            onChangeText={(text) => handleInputChange('contribution_rules', text)}
            placeholder="e.g., Minimum KES 100 per person, Deadline: End of month"
            multiline
            numberOfLines={3}
            error={showErrors && formErrors.contribution_rules}
          />
        </>
      )}

      <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: spacing.lg }]}>
        Group Settings
      </Text>
      <Input
        label="Maximum Members *"
        value={chamaData.max_members}
        onChangeText={(text) => handleInputChange('max_members', text)}
        placeholder="e.g., 20"
        keyboardType="numeric"
        error={showErrors && formErrors.max_members}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  section: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  stepTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
});

export default CreateChamaStep2;
