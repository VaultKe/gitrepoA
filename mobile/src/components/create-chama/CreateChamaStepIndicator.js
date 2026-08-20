import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography } from '../../utils/theme';

const CreateChamaStepIndicator = ({
  currentStep,
  totalSteps,
  groupType,
  colors,
  styles,
}) => {
  const componentStyles = styles || localStyles;
  const steps = groupType === 'chama' ? [1, 2, 3, 4] : [1, 2, 4];

  return (
    <View style={componentStyles.stepIndicator}>
      {steps.map((step, index) => (
        <View key={step} style={componentStyles.stepContainer}>
          <View style={[
            componentStyles.stepCircle,
            {
              backgroundColor: step <= currentStep ? colors.primary : colors.backgroundSecondary,
              borderColor: step <= currentStep ? colors.primary : colors.border,
            }
          ]}>
            <Text style={[
              componentStyles.stepNumber,
              { color: step <= currentStep ? colors.white : colors.textSecondary }
            ]}>
              {groupType === 'chama' ? step : index + 1}
            </Text>
          </View>
          {index < steps.length - 1 && (
            <View style={[
              componentStyles.stepLine,
              { backgroundColor: step < currentStep ? colors.primary : colors.border }
            ]} />
          )}
        </View>
      ))}
    </View>
  );
};

const localStyles = StyleSheet.create({
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: spacing.sm,
  },
});

export default CreateChamaStepIndicator;
