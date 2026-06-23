import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Input from '../../../components/common/Input';

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
  const handleGroupTypeChange = (optionId) => {
    handleInputChange('group_type', optionId === chamaData.group_type ? '' : optionId);
  };

  return (
    <Card style={styles.section}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        What do you want to create?
      </Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
        Choose the type of group you want to create
      </Text>

      <View style={[
        styles.typeContainer,
        showErrors && formErrors.group_type && { borderColor: colors.error, borderWidth: 1, borderRadius: 8 }
      ]}>
        {creationOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.typeCard,
              {
                backgroundColor: chamaData.group_type === option.id ? option.color + '20' : colors.backgroundSecondary,
                borderColor: chamaData.group_type === option.id ? option.color : colors.border,
                borderWidth: 2,
              }
            ]}
            onPress={() => handleGroupTypeChange(option.id)}
          >
            {chamaData.group_type === option.id && (
              <View style={[styles.checkBadge, { backgroundColor: option.color }]}>
                <Ionicons name="checkmark" size={10} color={colors.white} />
              </View>
            )}
            <Ionicons
              name={option.icon}
              size={22}
              color={chamaData.group_type === option.id ? option.color : colors.textSecondary}
            />
            <Text style={[
              styles.typeName,
              {
                color: chamaData.group_type === option.id ? option.color : colors.text,
                fontWeight: chamaData.group_type === option.id ? 'bold' : 'normal',
              }
            ]} numberOfLines={1}>
              {option.name}
            </Text>
            <Text style={[styles.typeDescription, { color: colors.textSecondary, textAlign: 'center' }]} numberOfLines={2}>
              {option.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {showErrors && formErrors.group_type && (
        <Text style={[styles.errorText, { color: colors.error }]}>
          {formErrors.group_type}
        </Text>
      )}

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

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            {chamaData.group_type === 'contribution' ? 'Contribution Type *' : 'Chama Type *'}
          </Text>
          <View style={[
            styles.typeContainer,
            showErrors && formErrors.type && { borderColor: colors.error, borderWidth: 1, borderRadius: 8 }
          ]}>
            {(chamaData.group_type === 'contribution' ? contributionTypes : chamaTypes).map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: chamaData.type === type.id ? colors.primary + '20' : colors.backgroundSecondary,
                    borderColor: chamaData.type === type.id ? colors.primary : colors.border,
                  }
                ]}
                onPress={() => handleInputChange('type', type.id)}
              >
                {chamaData.type === type.id && (
                  <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                    <Ionicons name="checkmark" size={10} color={colors.white} />
                  </View>
                )}
                <Ionicons
                  name={type.icon}
                  size={18}
                  color={chamaData.type === type.id ? colors.primary : colors.textSecondary}
                />
                <Text style={[
                  styles.typeName,
                  { color: chamaData.type === type.id ? colors.primary : colors.text }
                ]} numberOfLines={1}>
                  {type.name}
                </Text>
                <Text style={[styles.typeDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                  {type.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {showErrors && formErrors.type && (
            <Text style={[styles.errorText, { color: colors.error }]}>
              {formErrors.type}
            </Text>
          )}
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
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  typeCard: {
    width: '48%',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.xs,
    marginBottom: 2,
    textAlign: 'center',
  },
  typeDescription: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
  },
});

export default CreateChamaStep1;
