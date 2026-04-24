import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import ApiService from '../../services/api';

const LoanApplicationScreen = ({ route, navigation }) => {
  const { chamaId } = route.params;
  const { theme, user, chamas } = useApp();
  const colors = getThemeColors(theme);
  
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [chama, setChama] = useState(null);
  const [guarantors, setGuarantors] = useState([]);
  const [selectedGuarantors, setSelectedGuarantors] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [loanData, setLoanData] = useState({
    amount: '',
    purpose: '',
    repayment_period: '6',
    monthly_income: '',
    other_loans: '',
    collateral: '',
    business_plan: '',
  });

  const loanPurposes = [
    'Business Expansion',
    'Emergency',
    'Education',
    'Medical',
    'Agriculture',
    'Equipment Purchase',
    'Stock/Inventory',
    'Other',
  ];

  const repaymentPeriods = [
    { value: '3', label: '3 months' },
    { value: '6', label: '6 months' },
    { value: '12', label: '12 months' },
    { value: '18', label: '18 months' },
    { value: '24', label: '24 months' },
  ];

  useEffect(() => {
    loadChamaData();
    loadPotentialGuarantors();
  }, []);

  const loadChamaData = async () => {
    try {
      const response = await ApiService.getChamaById(chamaId);
      if (response.success) {
        setChama(response.data);
      }
    } catch (error) {
      console.error('Failed to load chama data:', error);
    }
  };

  const loadPotentialGuarantors = async () => {
    try {
      const response = await ApiService.getChamaMembers(chamaId);
      if (response.success) {
        // Filter out current user and get members who can be guarantors
        const eligibleGuarantors = response.data?.filter(member => 
          member.user_id !== user?.id && 
          member.status === 'active' &&
          member.total_contributions > 0
        ) || [];
        setGuarantors(eligibleGuarantors);
      }
    } catch (error) {
      console.error('Failed to load guarantors:', error);
    }
  };

  const handleInputChange = (field, value) => {
    // Input sanitization and validation
    let sanitizedValue = value;

    // For numeric fields, only allow numbers and decimal points
    if (['amount', 'monthly_income', 'other_loans'].includes(field)) {
      // Remove any non-numeric characters except decimal point
      sanitizedValue = value.replace(/[^0-9.]/g, '');

      // Ensure only one decimal point
      const parts = sanitizedValue.split('.');
      if (parts.length > 2) {
        sanitizedValue = parts[0] + '.' + parts.slice(1).join('');
      }

      // Limit decimal places to 2
      if (parts[1] && parts[1].length > 2) {
        sanitizedValue = parts[0] + '.' + parts[1].substring(0, 2);
      }
    }

    // For repayment period, only allow integers
    if (field === 'repayment_period') {
      sanitizedValue = value.replace(/[^0-9]/g, '');
    }

    // Sanitize text fields to prevent XSS
    if (['purpose', 'business_plan', 'collateral'].includes(field)) {
      // Remove potentially dangerous characters
      sanitizedValue = value.replace(/[<>\"'&]/g, '');

      // Limit length
      const maxLengths = {
        purpose: 200,
        business_plan: 1000,
        collateral: 500
      };
      if (sanitizedValue.length > maxLengths[field]) {
        sanitizedValue = sanitizedValue.substring(0, maxLengths[field]);
      }
    }

    setLoanData(prev => ({
      ...prev,
      [field]: sanitizedValue,
    }));

    // Clear field error when user starts typing
    clearFieldError(field);
  };

  const clearFieldError = (fieldName) => {
    if (formErrors[fieldName]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const validateStep1 = () => {
    console.log('🔍 Loan Form: validateStep1 called with data:', {
      amount: loanData.amount,
      purpose: loanData.purpose,
      repayment_period: loanData.repayment_period
    });

    const errors = {};

    // Amount validation
    if (!loanData.amount.trim()) {
      errors.amount = 'Loan amount is required';
      console.log('🔍 Loan Form: Amount validation failed - empty');
    } else {
      const amount = parseFloat(loanData.amount);
      if (isNaN(amount)) {
        errors.amount = 'Amount must be a valid number';
        console.log('🔍 Loan Form: Amount validation failed - not a number');
      } else if (amount <= 0) {
        errors.amount = 'Amount must be greater than 0';
        console.log('🔍 Loan Form: Amount validation failed - not positive');
      } else if (amount < 1000) {
        errors.amount = 'Minimum loan amount is KES 1,000';
        console.log('🔍 Loan Form: Amount validation failed - too small');
      } else if (amount > 5000000) {
        errors.amount = 'Maximum loan amount is KES 5,000,000';
        console.log('🔍 Loan Form: Amount validation failed - too large');
      } else {
        console.log('🔍 Loan Form: Amount validation passed');
      }
    }

    // Purpose validation
    if (!loanData.purpose.trim()) {
      errors.purpose = 'Loan purpose is required';
    } else if (loanData.purpose.trim().length < 10) {
      errors.purpose = 'Purpose must be at least 10 characters';
    } else if (loanData.purpose.trim().length > 200) {
      errors.purpose = 'Purpose must be less than 200 characters';
    }

    // Repayment period validation
    if (!loanData.repayment_period) {
      errors.repayment_period = 'Repayment period is required';
    } else {
      const period = parseInt(loanData.repayment_period);
      if (isNaN(period)) {
        errors.repayment_period = 'Repayment period must be a number';
      } else if (period < 1) {
        errors.repayment_period = 'Minimum repayment period is 1 month';
      } else if (period > 60) {
        errors.repayment_period = 'Maximum repayment period is 60 months';
      }
    }

    // Business plan validation (if provided)
    if (loanData.business_plan && loanData.business_plan.trim().length > 1000) {
      errors.business_plan = 'Business plan must be less than 1000 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = () => {
    const errors = {};

    // Monthly income validation
    if (!loanData.monthly_income.trim()) {
      errors.monthly_income = 'Monthly income is required';
    } else {
      const income = parseFloat(loanData.monthly_income);
      if (isNaN(income)) {
        errors.monthly_income = 'Income must be a valid number';
      } else if (income <= 0) {
        errors.monthly_income = 'Income must be greater than 0';
      } else if (income < 5000) {
        errors.monthly_income = 'Minimum monthly income is KES 5,000';
      }
    }

    // Debt-to-income ratio validation
    if (loanData.monthly_income && loanData.amount) {
      const income = parseFloat(loanData.monthly_income);
      const loanAmount = parseFloat(loanData.amount);
      const period = parseInt(loanData.repayment_period) || 12;
      const monthlyPayment = loanAmount / period;
      const debtRatio = (monthlyPayment / income) * 100;

      if (debtRatio > 40) {
        errors.debt_ratio = `Monthly payment (${Math.round(monthlyPayment)} KES) exceeds 40% of income. Consider reducing loan amount or extending repayment period.`;
      }
    }

    // Other loans validation (if provided)
    if (loanData.other_loans.trim()) {
      const otherLoans = parseFloat(loanData.other_loans);
      if (isNaN(otherLoans)) {
        errors.other_loans = 'Other loans amount must be a valid number';
      } else if (otherLoans < 0) {
        errors.other_loans = 'Other loans amount cannot be negative';
      }
    }

    // Guarantors validation
    if (selectedGuarantors.length < 2) {
      errors.guarantors = 'At least 2 guarantors are required';
    } else if (selectedGuarantors.length > 5) {
      errors.guarantors = 'Maximum 5 guarantors allowed';
    }

    // Check if user selected themselves as guarantor
    const userAsGuarantor = selectedGuarantors.find(g => g.id === user.id);
    if (userAsGuarantor) {
      errors.guarantors = 'You cannot select yourself as a guarantor';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateAllSteps = () => {
    const step1Valid = validateStep1();
    const step2Valid = validateStep2();
    return step1Valid && step2Valid;
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        return loanData.amount && loanData.purpose && loanData.repayment_period;
      case 2:
        return loanData.monthly_income && selectedGuarantors.length >= 2;
      case 3:
        return true; // Optional step
      default:
        return false;
    }
  };

  const handleNext = () => {
    console.log('🔍 Loan Form: handleNext called for step', currentStep);
    console.log('🔍 Loan Form: Current form data:', loanData);

    // Use our comprehensive validation
    let isValid = false;

    if (currentStep === 1) {
      console.log('🔍 Loan Form: Validating step 1...');
      isValid = validateStep1();
      console.log('🔍 Loan Form: Step 1 validation result:', isValid);
      console.log('🔍 Loan Form: Form errors after step 1 validation:', formErrors);
    } else if (currentStep === 2) {
      console.log('🔍 Loan Form: Validating step 2...');
      isValid = validateStep2();
      console.log('🔍 Loan Form: Step 2 validation result:', isValid);
      console.log('🔍 Loan Form: Form errors after step 2 validation:', formErrors);
    } else {
      isValid = true; // Step 3 is optional
    }

    if (isValid) {
      console.log('🔍 Loan Form: Validation passed, moving to next step');
      setCurrentStep(currentStep + 1);
    } else {
      console.log('🔍 Loan Form: Validation failed, showing error toast');
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: `Please fix the errors in Step ${currentStep} before proceeding`,
      });
    }
  };

  const getStepValidationMessage = (step) => {
    switch (step) {
      case 1:
        return 'Please fill in loan amount, purpose, and repayment period';
      case 2:
        return 'Please provide your monthly income and select at least 2 guarantors';
      default:
        return 'Please complete all required fields';
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const calculateInterest = () => {
    const amount = parseFloat(loanData.amount) || 0;
    const months = parseInt(loanData.repayment_period) || 6;
    const interestRate = chama?.loan_interest_rate || 0.05; // 5% default
    return amount * interestRate * (months / 12);
  };

  const calculateMonthlyPayment = () => {
    const amount = parseFloat(loanData.amount) || 0;
    const interest = calculateInterest();
    const months = parseInt(loanData.repayment_period) || 6;
    return (amount + interest) / months;
  };

  const handleSubmit = async () => {
    // Validate all steps before submission
    if (!validateAllSteps()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Failed',
        text2: 'Please fix all errors before submitting your application',
      });
      return;
    }

    try {
      setLoading(true);

      const applicationData = {
        ...loanData,
        amount: parseFloat(loanData.amount),
        repayment_period: parseInt(loanData.repayment_period),
        monthly_income: parseFloat(loanData.monthly_income),
        chama_id: chamaId,
        guarantor_ids: selectedGuarantors.map(g => g.id),
        interest_amount: calculateInterest(),
        monthly_payment: calculateMonthlyPayment(),
      };

      const response = await ApiService.createLoanApplication(applicationData);
      
      if (response.success) {
        Alert.alert(
          'Application Submitted!',
          'Your loan application has been submitted and guarantors will be notified.',
          [
            {
              text: 'View Application',
              onPress: () => navigation.navigate('LoanDetails', { loanId: response.data.id }),
            },
          ]
        );
      } else {
        throw new Error(response.error || 'Failed to submit application');
      }
    } catch (error) {
      console.error('Loan application failed:', error);
      Alert.alert('Error', error.message || 'Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const ErrorText = ({ error }) => {
    if (!error) return null;
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.error + '10', borderColor: colors.error }]}>
        <Ionicons name="alert-circle" size={16} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>
          {error}
        </Text>
      </View>
    );
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((step) => (
        <View key={step} style={styles.stepContainer}>
          <View style={[
            styles.stepCircle,
            {
              backgroundColor: step <= currentStep ? colors.primary : colors.backgroundSecondary,
              borderColor: step <= currentStep ? colors.primary : colors.border,
            }
          ]}>
            <Text style={[
              styles.stepNumber,
              { color: step <= currentStep ? colors.white : colors.textSecondary }
            ]}>
              {step}
            </Text>
          </View>
          {step < 3 && (
            <View style={[
              styles.stepLine,
              { backgroundColor: step < currentStep ? colors.primary : colors.border }
            ]} />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => {
    const step1Errors = Object.keys(formErrors).filter(key =>
      ['amount', 'purpose', 'repayment_period'].includes(key)
    );

    return (
      <Card style={styles.section}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Loan Details
        </Text>

        {step1Errors.length > 0 && (
          <View style={[styles.errorSummary, { backgroundColor: colors.error + '10', borderColor: colors.error }]}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={[styles.errorSummaryText, { color: colors.error }]}>
              Please fix {step1Errors.length} error{step1Errors.length > 1 ? 's' : ''} below
            </Text>
          </View>
        )}
      
      <View style={styles.inputContainer}>
        <Input
          label="Loan Amount (KES) *"
          value={loanData.amount}
          onChangeText={(text) => handleInputChange('amount', text)}
          placeholder="Enter amount (e.g., 50000)"
          keyboardType="numeric"
          error={formErrors.amount}
          // Removed error styling
        />
        {formErrors.amount && <ErrorText error={formErrors.amount} />}
      </View>
      
      <View style={styles.purposeContainer}>
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
          Purpose *
        </Text>
        <View style={[
          styles.purposeGrid,
          formErrors.purpose ? styles.sectionError : null
        ]}>
          {loanPurposes.map((purpose) => (
            <TouchableOpacity
              key={purpose}
              style={[
                styles.purposeChip,
                {
                  backgroundColor: loanData.purpose === purpose ? colors.primary : colors.backgroundSecondary,
                  borderColor: colors.border,
                }
              ]}
              onPress={() => handleInputChange('purpose', purpose)}
            >
              <Text style={[
                styles.purposeText,
                { color: loanData.purpose === purpose ? colors.white : colors.text }
              ]}>
                {purpose}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <ErrorText error={formErrors.purpose} />
      </View>

      <View style={styles.periodContainer}>
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
          Repayment Period *
        </Text>
        <View style={[
          styles.periodGrid,
          formErrors.repayment_period ? styles.sectionError : null
        ]}>
          {repaymentPeriods.map((period) => (
            <TouchableOpacity
              key={period.value}
              style={[
                styles.periodChip,
                {
                  backgroundColor: loanData.repayment_period === period.value ? colors.primary : colors.backgroundSecondary,
                  borderColor: colors.border,
                }
              ]}
              onPress={() => handleInputChange('repayment_period', period.value)}
            >
              <Text style={[
                styles.periodText,
                { color: loanData.repayment_period === period.value ? colors.white : colors.text }
              ]}>
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <ErrorText error={formErrors.repayment_period} />
      </View>

      {loanData.amount && loanData.repayment_period && (
        <Card style={styles.calculationCard} variant="outlined">
          <Text style={[styles.calculationTitle, { color: colors.text }]}>
            Loan Summary
          </Text>
          <View style={styles.calculationRow}>
            <Text style={[styles.calculationLabel, { color: colors.textSecondary }]}>
              Principal Amount:
            </Text>
            <Text style={[styles.calculationValue, { color: colors.text }]}>
              {formatCurrency(parseFloat(loanData.amount) || 0)}
            </Text>
          </View>
          <View style={styles.calculationRow}>
            <Text style={[styles.calculationLabel, { color: colors.textSecondary }]}>
              Interest ({((chama?.loan_interest_rate || 0.05) * 100).toFixed(1)}%):
            </Text>
            <Text style={[styles.calculationValue, { color: colors.text }]}>
              {formatCurrency(calculateInterest())}
            </Text>
          </View>
          <View style={styles.calculationRow}>
            <Text style={[styles.calculationLabel, { color: colors.textSecondary }]}>
              Total Amount:
            </Text>
            <Text style={[styles.calculationValue, { color: colors.primary }]}>
              {formatCurrency((parseFloat(loanData.amount) || 0) + calculateInterest())}
            </Text>
          </View>
          <View style={styles.calculationRow}>
            <Text style={[styles.calculationLabel, { color: colors.textSecondary }]}>
              Monthly Payment:
            </Text>
            <Text style={[styles.calculationValue, { color: colors.primary }]}>
              {formatCurrency(calculateMonthlyPayment())}
            </Text>
          </View>
        </Card>
      )}
    </Card>
    );
  };

  const renderStep2 = () => {
    const step2Errors = Object.keys(formErrors).filter(key =>
      ['monthly_income', 'other_loans', 'debt_ratio', 'guarantors'].includes(key)
    );

    return (
      <Card style={styles.section}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Financial Information & Guarantors
        </Text>

        {step2Errors.length > 0 && (
          <View style={[styles.errorSummary, { backgroundColor: colors.error + '10', borderColor: colors.error }]}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={[styles.errorSummaryText, { color: colors.error }]}>
              Please fix {step2Errors.length} error{step2Errors.length > 1 ? 's' : ''} below
            </Text>
          </View>
        )}
      
      <View style={styles.inputContainer}>
        <Input
          label="Monthly Income (KES) *"
          value={loanData.monthly_income}
          onChangeText={(text) => handleInputChange('monthly_income', text)}
          placeholder="Enter your monthly income"
          keyboardType="numeric"
          error={formErrors.monthly_income}
          // Removed error styling
        />
        {formErrors.monthly_income && <ErrorText error={formErrors.monthly_income} />}
      </View>

      <View style={styles.inputContainer}>
        <Input
          label="Other Loans/Debts (KES)"
          value={loanData.other_loans}
          onChangeText={(text) => handleInputChange('other_loans', text)}
          placeholder="Enter existing debt amount (optional)"
          keyboardType="numeric"
          error={formErrors.other_loans}
          // Removed error styling
        />
        {formErrors.other_loans && <ErrorText error={formErrors.other_loans} />}
      </View>

      {/* Debt-to-income ratio warning */}
      {formErrors.debt_ratio && (
        <View style={styles.warningContainer}>
          <Ionicons name="warning" size={20} color={colors.warning} />
          <Text style={[styles.warningText, { color: colors.warning }]}>
            {formErrors.debt_ratio}
          </Text>
        </View>
      )}
      
      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
        Select Guarantors (Minimum 2) *
      </Text>
      <Text style={[styles.guarantorHint, { color: colors.textTertiary }]}>
        Guarantors will be notified and must approve your application
      </Text>
      
      <View style={styles.guarantorsList}>
        {guarantors.map((guarantor) => (
          <TouchableOpacity
            key={guarantor.id}
            style={[
              styles.guarantorCard,
              {
                backgroundColor: selectedGuarantors.some(g => g.id === guarantor.id) ? colors.primary + '20' : colors.backgroundSecondary,
                borderColor: selectedGuarantors.some(g => g.id === guarantor.id) ? colors.primary : colors.border,
              }
            ]}
            onPress={() => {
              const isSelected = selectedGuarantors.some(g => g.id === guarantor.id);
              if (isSelected) {
                setSelectedGuarantors(prev => prev.filter(g => g.id !== guarantor.id));
              } else {
                setSelectedGuarantors(prev => [...prev, guarantor]);
              }
            }}
          >
            <View style={[styles.guarantorAvatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.guarantorInitials, { color: colors.white }]}>
                {guarantor.user?.first_name?.[0]}{guarantor.user?.last_name?.[0]}
              </Text>
            </View>
            
            <View style={styles.guarantorInfo}>
              <Text style={[styles.guarantorName, { color: colors.text }]}>
                {guarantor.user?.first_name} {guarantor.user?.last_name}
              </Text>
              <Text style={[styles.guarantorRole, { color: colors.textSecondary }]}>
                {guarantor.role} • {formatCurrency(guarantor.total_contributions)} contributed
              </Text>
            </View>
            
            <Ionicons
              name={selectedGuarantors.some(g => g.id === guarantor.id) ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={selectedGuarantors.some(g => g.id === guarantor.id) ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
        ))}
      </View>
      
      <Text style={[styles.selectedCount, { color: colors.textSecondary }]}>
        {selectedGuarantors.length} of {guarantors.length} members selected
      </Text>
      <ErrorText error={formErrors.guarantors} />
    </Card>
  );

  const renderStep3 = () => (
    <Card style={styles.section}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        Additional Information
      </Text>
      
      <Input
        label="Collateral (Optional)"
        value={loanData.collateral}
        onChangeText={(text) => handleInputChange('collateral', text)}
        placeholder="Describe any collateral you can provide..."
        multiline
        numberOfLines={3}
      />
      
      <Input
        label="Business Plan/Usage Details (Optional)"
        value={loanData.business_plan}
        onChangeText={(text) => handleInputChange('business_plan', text)}
        placeholder="Describe how you plan to use the loan..."
        multiline
        numberOfLines={4}
      />
      
      <Card style={styles.summaryCard} variant="outlined">
        <Text style={[styles.summaryTitle, { color: colors.text }]}>
          Application Summary
        </Text>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Amount:</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {formatCurrency(parseFloat(loanData.amount) || 0)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Purpose:</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{loanData.purpose}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Period:</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {loanData.repayment_period} months
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Monthly Payment:</Text>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>
            {formatCurrency(calculateMonthlyPayment())}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Guarantors:</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {selectedGuarantors.length} selected
          </Text>
        </View>
      </Card>
    </Card>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      default:
        return null;
    }
  };

  const renderNavigationButtons = () => (
    <View style={[styles.navigationButtons, { backgroundColor: colors.surface }]}>
      {currentStep > 1 && (
        <Button
          title="Back"
          variant="outline"
          onPress={handleBack}
          style={styles.navButton}
        />
      )}
      
      {currentStep < 3 ? (
        <Button
          title="Next"
          onPress={handleNext}
          style={styles.navButton}
        />
      ) : (
        <Button
          title="Submit Application"
          onPress={handleSubmit}
          loading={loading}
          style={styles.navButton}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {renderStepIndicator()}
        {renderStepContent()}
        
        {/* Spacer for fixed buttons */}
        <View style={styles.spacer} />
      </ScrollView>
      
      {renderNavigationButtons()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
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
    marginHorizontal: spacing.sm,
  },
  section: {
    margin: spacing.md,
  },
  stepTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  purposeContainer: {
    marginBottom: spacing.md,
  },
  purposeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  purposeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  purposeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  periodContainer: {
    marginBottom: spacing.md,
  },
  periodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  periodChip: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  periodText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  calculationCard: {
    marginTop: spacing.lg,
  },
  calculationTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  calculationLabel: {
    fontSize: typography.fontSize.sm,
  },
  calculationValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  guarantorHint: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
  },
  guarantorsList: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  guarantorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  guarantorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  guarantorInitials: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  guarantorInfo: {
    flex: 1,
  },
  guarantorName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  guarantorRole: {
    fontSize: typography.fontSize.sm,
  },
  selectedCount: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  summaryCard: {
    marginTop: spacing.lg,
  },
  summaryTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
  },
  summaryValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  spacer: {
    height: 100,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  // Removed red border styling
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    flex: 1,
    fontWeight: typography.fontWeight.medium,
  },
  errorSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorSummaryText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
  },
  sectionError: {
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  warningText: {
    fontSize: typography.fontSize.sm,
    flex: 1,
    lineHeight: 18,
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
});

export default LoanApplicationScreen;
