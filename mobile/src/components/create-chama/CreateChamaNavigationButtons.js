import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Button from '../../components/common/Button';
import { spacing, typography, shadows } from '../../utils/theme';

const CreateChamaNavigationButtons = ({
  currentStep,
  totalSteps,
  isLastStep,
  canSubmit,
  loading,
  getDisableReason,
  handleNext,
  handleBack,
  handleSubmit,
  groupType,
  colors,
  styles,
}) => {
  const componentStyles = styles || localStyles;

  return (
    <View style={[componentStyles.navigationButtons, { backgroundColor: colors.surface }]}>
      {currentStep > 1 && (
        <Button
          title="Back"
          variant="outline"
          onPress={handleBack}
          style={componentStyles.navButton}
        />
      )}

      {!isLastStep ? (
        <Button
          title="Next"
          onPress={handleNext}
          style={componentStyles.navButton}
        />
      ) : (
        <View style={componentStyles.navButtonContainer}>
          {!canSubmit && (
            <Text style={[componentStyles.navHelperText, { color: colors.textSecondary }]}>
              {getDisableReason()}
            </Text>
          )}
          <Button
            title={`Create ${groupType === 'contribution' ? 'Contribution Group' : 'Chama'}`}
            onPress={handleSubmit}
            loading={loading}
            disabled={!canSubmit}
            style={componentStyles.navButton}
          />
        </View>
      )}
    </View>
  );
};

const localStyles = StyleSheet.create({
  navigationButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.lg,
  },
  navButton: {
    flex: 1,
  },
  navButtonContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  navHelperText: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginBottom: spacing.xs,
    fontStyle: 'italic',
  },
});

export default CreateChamaNavigationButtons;
