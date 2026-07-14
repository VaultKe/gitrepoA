import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Input from '../../../components/common/Input';
import Dropdown from '../../../components/common/Dropdown';

const creationOptions = [
  {
    id: 'chama',
    name: 'Chama',
    icon: 'people',
    description: 'Traditional savings and investment group with regular contributions',
  },
  {
    id: 'contribution',
    name: 'Contribution Group',
    icon: 'heart',
    description: 'Fundraising group for specific causes and emergencies',
  },
];

const chamaTypes = [
  { id: 'savings', name: 'Savings Group', icon: 'wallet', description: 'Focus on saving money together' },
  { id: 'investment', name: 'Investment Club', icon: 'trending-up', description: 'Pool funds for investments' },
  { id: 'welfare', name: 'Welfare Group', icon: 'heart', description: 'Support members in times of need' },
  { id: 'business', name: 'Business Group', icon: 'briefcase', description: 'Support business ventures' },
  { id: 'merry-go-round', name: 'Merry-go-round', icon: 'refresh', description: 'Rotating savings scheme' },
];

const contributionTypes = [
  { id: 'emergency', name: 'Emergency Fund', icon: 'alert-circle', description: 'For urgent financial needs' },
  { id: 'medical', name: 'Medical Support', icon: 'medical', description: 'Healthcare and medical expenses' },
  { id: 'education', name: 'Education Fund', icon: 'school', description: 'School fees and educational support' },
  { id: 'community', name: 'Community Project', icon: 'people', description: 'Local community development' },
  { id: 'personal', name: 'Personal Goal', icon: 'person', description: 'Individual financial goals' },
];

const CreateChamaStep1 = ({
  chamaData,
  handleInputChange,
  showErrors,
  formErrors,
  colors,
}) => {
  const groupTypeOptions = creationOptions.map((option) => ({
    value: option.id,
    label: option.name,
    icon: option.icon,
    description: option.description,
  }));

  const typeOptions = (chamaData.group_type === 'contribution' ? contributionTypes : chamaTypes).map((type) => ({
    value: type.id,
    label: type.name,
    icon: type.icon,
    description: type.description,
  }));

  const handleGroupTypeSelect = (optionId) => {
    handleInputChange('group_type', optionId === chamaData.group_type ? '' : optionId);
    if (optionId !== chamaData.group_type) {
      handleInputChange('type', '');
    }
  };

  return (
    <Card style={styles.section} variant="outlined">
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        What do you want to create?
      </Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
        Choose the type of group you want to create
      </Text>

      <Dropdown
        label="Group Type *"
        value={chamaData.group_type}
        placeholder="Select what you want to create"
        options={groupTypeOptions}
        onSelect={handleGroupTypeSelect}
        error={showErrors && !!formErrors.group_type}
        errorText={formErrors.group_type}
        colors={colors}
      />

      {chamaData.group_type && (
        <>
          <Input
            label={`${chamaData.group_type === 'contribution' ? 'Contribution Group' : 'Chama'} Name *`}
            value={chamaData.name}
            onChangeText={(text) => handleInputChange('name', text)}
            placeholder={`Enter ${chamaData.group_type === 'contribution' ? 'contribution group' : 'chama'} name`}
            error={showErrors && formErrors.name}
            style={{ marginTop: spacing.lg }}
          />

          <Input
            label="Description *"
            value={chamaData.description}
            onChangeText={(text) => handleInputChange('description', text)}
            placeholder={`Describe your ${chamaData.group_type === 'contribution' ? 'contribution goal and purpose' : "chama's purpose"}...`}
            multiline
            numberOfLines={4}
            error={showErrors && formErrors.description}
          />

          <Dropdown
            label={chamaData.group_type === 'contribution' ? 'Contribution Type *' : 'Chama Type *'}
            value={chamaData.type}
            placeholder={`Select ${chamaData.group_type === 'contribution' ? 'contribution' : 'chama'} type`}
            options={typeOptions}
            onSelect={(typeId) => handleInputChange('type', typeId)}
            error={showErrors && !!formErrors.type}
            errorText={formErrors.type}
            colors={colors}
          />
        </>
      )}
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
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: typography.fontSize.base,
    textAlign: 'left',
    marginBottom: spacing.xl,
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
    letterSpacing: 0.2,
    width: '100%',
    flexShrink: 1,
    flexGrow: 1,
  },
});

export default CreateChamaStep1;
