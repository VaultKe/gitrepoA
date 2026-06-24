import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Input from '../../../components/common/Input';

const CreateChamaStep4 = ({
  chamaData,
  handleInputChange,
  showErrors,
  formErrors,
  colors,
}) => {
  return (
    <Card style={styles.section}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        Settings & Rules
      </Text>

      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>
            {chamaData.group_type === 'contribution' ? 'Public Contribution Group' : 'Public Chama'}
          </Text>
          <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
            {chamaData.group_type === 'contribution'
              ? 'Allow others to discover and join your contribution group'
              : 'Allow others to discover and join your chama'
            }
          </Text>
        </View>
        <Switch
          value={chamaData.is_public}
          onValueChange={(value) => handleInputChange('is_public', value)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
        />
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>
            Require Approval
          </Text>
          <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
            New members need approval to join
          </Text>
        </View>
        <Switch
          value={chamaData.requires_approval}
          onValueChange={(value) => handleInputChange('requires_approval', value)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
        />
      </View>

      {chamaData.group_type === 'chama' && (
        <Input
          label="Chama Rules (Optional)"
          value={chamaData.rules}
          onChangeText={(text) => handleInputChange('rules', text)}
          placeholder="Define rules and guidelines for your chama..."
          multiline
          numberOfLines={4}
          error={showErrors && formErrors.rules}
        />
      )}

      <Input
        label="Meeting Schedule (Optional)"
        value={chamaData.meeting_schedule}
        onChangeText={(text) => handleInputChange('meeting_schedule', text)}
        placeholder={chamaData.group_type === 'contribution'
          ? 'e.g., Weekly check-ins every Sunday at 7 PM'
          : 'e.g., Every first Saturday of the month at 2 PM'
        }
        error={showErrors && formErrors.meeting_schedule}
      />

      {chamaData.group_type === 'contribution' && (
        <View style={[styles.infoBox, { backgroundColor: colors.info + '10', borderColor: colors.info }]}>
          <Ionicons name="information-circle" size={20} color={colors.info} />
          <Text style={[styles.infoText, { color: colors.info, marginLeft: spacing.sm }]}>
            Contribution rules were set in Step 2. You can modify them later from the group settings.
          </Text>
        </View>
      )}

      {chamaData.group_type === 'chama' && (
        <View style={[styles.infoBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.primary, marginLeft: spacing.sm }]}>
            Monthly subscription fee of KES 500 will be auto-deducted from the chama wallet on the 2nd of each month. Service fees for members will be managed separately.
          </Text>
        </View>
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
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: spacing.md,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  settingDescription: {
    fontSize: typography.fontSize.sm,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
});

export default CreateChamaStep4;
