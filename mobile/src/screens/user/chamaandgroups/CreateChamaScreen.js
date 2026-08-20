/**
 * CreateChamaScreen - Secure Chama/Contribution Group Creation
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import ApiService from '../../../services/api';
import CreateChamaStep1 from '../../../components/create-chama/CreateChamaStep1';
import CreateChamaStep2 from '../../../components/create-chama/CreateChamaStep2';
import CreateChamaStep3 from '../../../components/create-chama/CreateChamaStep3';
import CreateChamaStep4 from '../../../components/create-chama/CreateChamaStep4';
import CreateChamaStepIndicator from '../../../components/create-chama/CreateChamaStepIndicator';
import CreateChamaNavigationButtons from '../../../components/create-chama/CreateChamaNavigationButtons';
import useCreateChama from '../../../hooks/useCreateChama';

const CREATE_CHAMA_DRAFT_KEY = 'createChama_draft';

const CreateChamaScreen = ({ navigation }) => {
  const { theme, user, loadUserChamas } = useApp();
  const colors = getThemeColors(theme);
  const create = useCreateChama({ navigation, loadUserChamas });

  const renderStepContent = () => {
    if (create.chamaData.group_type === 'contribution' && create.currentStep === 3) {
      return null;
    }
    switch (create.currentStep) {
      case 1:
        return (
          <CreateChamaStep1
            chamaData={create.chamaData}
            handleInputChange={create.handleInputChange}
            showErrors={create.showErrors}
            formErrors={create.formErrors}
            colors={colors}
          />
        );
      case 2:
        return (
          <CreateChamaStep2
            chamaData={create.chamaData}
            handleInputChange={create.handleInputChange}
            showErrors={create.showErrors}
            formErrors={create.formErrors}
            colors={colors}
          />
        );
      case 3:
        return (
          <CreateChamaStep3
            chamaData={create.chamaData}
            onboardedMembers={create.onboardedMembers}
            onAddMember={create.handleMemberAdded}
            onUpdateMember={create.handleMemberUpdated}
            user={user}
            colors={colors}
          />
        );
      case 4:
        return (
          <CreateChamaStep4
            chamaData={create.chamaData}
            handleInputChange={create.handleInputChange}
            showErrors={create.showErrors}
            formErrors={create.formErrors}
            colors={colors}
            user={user}
            onRegistrationFeeStatusChange={(status) => {
              create.setChamaData(prev => ({
                ...prev,
                registration_fee_status: status,
              }));
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <CreateChamaStepIndicator
          currentStep={create.currentStep}
          groupType={create.chamaData.group_type}
          colors={colors}
        />
        {renderStepContent()}
        <View style={styles.spacer} />
      </ScrollView>

      <CreateChamaNavigationButtons
        currentStep={create.currentStep}
        totalSteps={create.getTotalSteps()}
        isLastStep={create.currentStep >= create.getTotalSteps()}
        canSubmit={create.getFirstInvalidStep() === 0}
        loading={create.loading}
        getDisableReason={() => {
          const stepLabels = {
            1: 'chama details',
            2: 'location and finances',
            3: 'member onboarding',
            4: 'wallet types and settings',
          };
          const firstInvalidStep = create.getFirstInvalidStep();
          return `Complete ${stepLabels[firstInvalidStep] || 'all fields'} to enable creation.`;
        }}
        handleNext={create.handleNext}
        handleBack={create.handleBack}
        handleSubmit={create.handleSubmit}
        groupType={create.chamaData.group_type}
        colors={colors}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
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
    marginHorizontal: spacing.xs,
  },
  spacer: {
    height: 20,
  },
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

export default CreateChamaScreen;
