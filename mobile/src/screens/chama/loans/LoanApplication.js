import React, { useState, useEffect } from 'react';
// import { Alert } from 'react';
// import { useNavigation } from 'react';

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import ApiService from '../../../services/api';

const LoanApplication = ({ route, navigation, onRouteChange }) => {
  const { chamaId } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  
  const [loading, setLoading] = useState(false);
  const [chamaMembers, setChamaMembers] = useState([]);
  const [loanTypes, setLoanTypes] = useState([]);
  const [selectedLoanType, setSelectedLoanType] = useState(null);
  const [formData, setFormData] = useState({
    loanTypeId: '',
    amount: '',
    purpose: '',
    repaymentPeriod: '6',
    interestRate: '',
    guarantors: [],
    security: {
      type: 'none',
      description: '',
      value: '',
    },
    businessPlan: '',
    monthlyIncome: '',
    otherLoans: '',
  });

  const repaymentPeriods = [
    { value: '3', label: '3 months' },
    { value: '6', label: '6 months' },
    { value: '12', label: '12 months' },
    { value: '18', label: '18 months' },
    { value: '24', label: '24 months' },
  ];

  const securityTypes = [
    { id: 'none', name: 'No Security', description: 'Trust-based loan' },
    { id: 'asset', name: 'Asset Security', description: 'Property, vehicle, or equipment' },
    { id: 'savings', name: 'Savings Security', description: 'Portion of chama savings' },
    { id: 'business', name: 'Business Security', description: 'Business assets or inventory' },
    { id: 'other', name: 'Other Security', description: 'Other forms of collateral' },
  ];

  useEffect(() => {
    loadChamaMembers();
    loadLoanTypes();
  }, [chamaId]);

  const loadChamaMembers = async () => {
    try {
      const response = await ApiService.getChamaMembers(chamaId);
      if (response.success) {
        // Filter out current user from potential guarantors
        const otherMembers = (response.data || []).filter(member => member.user_id !== user.id);
        setChamaMembers(otherMembers);
      }
    } catch (error) {
      console.error('Failed to load chama members:', error);
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return 'KES 0';
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);
  };

  const loadLoanTypes = async () => {
    try {
      const response = await ApiService.getLoanTypes(chamaId, 'active');
      if (response.success) {
        setLoanTypes(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load loan types:', error);
    }
  };

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value,
        },
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const toggleGuarantor = (memberId) => {
    setFormData(prev => ({
      ...prev,
      guarantors: prev.guarantors.includes(memberId)
        ? prev.guarantors.filter(id => id !== memberId)
        : [...prev.guarantors, memberId],
    }));
  };

  const handleLoanTypeChange = (loanType) => {
    setSelectedLoanType(loanType);
    setFormData(prev => ({
      ...prev,
      loanTypeId: loanType.id,
      interestRate: loanType.interestRate?.toString() || prev.interestRate,
      repaymentPeriod: loanType.termMonths?.toString() || prev.repaymentPeriod,
    }));
  };

  const validateForm = () => {
    if (!formData.loanTypeId) {
      Alert.alert('Validation Error', 'Please select a loan type');
      return false;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid loan amount');
      return false;
    }
    if (!formData.purpose.trim()) {
      Alert.alert('Validation Error', 'Please specify the purpose of the loan');
      return false;
    }
    if (selectedLoanType?.requiresGuarantors && formData.guarantors.length < 2) {
      Alert.alert('Validation Error', 'Please select at least 2 guarantors');
      return false;
    }
    if (formData.security.type !== 'none' && !formData.security.description.trim()) {
      Alert.alert('Validation Error', 'Please describe your security/collateral');
      return false;
    }
    if (!formData.monthlyIncome || parseFloat(formData.monthlyIncome) <= 0) {
      Alert.alert('Validation Error', 'Please enter your monthly income');
      return false;
    }
    return true;
  };

  const calculateMonthlyPayment = () => {
    const principal = parseFloat(formData.amount || 0);
    const rate = parseFloat(formData.interestRate || 10) / 100 / 12; // Monthly rate
    const periods = parseInt(formData.repaymentPeriod || 6);
    
    if (principal > 0 && rate > 0) {
      const monthlyPayment = (principal * rate * Math.pow(1 + rate, periods)) / 
                           (Math.pow(1 + rate, periods) - 1);
      return monthlyPayment;
    }
    return 0;
  };


// const navigation = Navigation();

const handleSubmit = async () => {
  if (!validateForm()) return;

  try {
    setLoading(true);
    
    const loanData = {
      chamaId,
      applicantId: user.id,
      loanTypeId: formData.loanTypeId,
      amount: parseFloat(formData.amount),
      purpose: formData.purpose.trim(),
      repaymentPeriod: parseInt(formData.repaymentPeriod),
      interestRate: parseFloat(formData.interestRate || selectedLoanType?.interestRate || 10),
      guarantors: selectedLoanType?.requiresGuarantors ? formData.guarantors : [],
      security: formData.security,
      businessPlan: formData.businessPlan.trim(),
      monthlyIncome: parseFloat(formData.monthlyIncome),
      otherLoans: formData.otherLoans.trim(),
      monthlyPayment: calculateMonthlyPayment(),
      status: 'pending_guarantors',
    };

    const response = await ApiService.createLoanApplication(loanData);
    
    if (response.success) {
      Alert.alert(
        'Application Submitted!', 
        'Your loan application has been submitted. Guarantors will be notified to accept or reject.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (onRouteChange) {
                onRouteChange('loans', 'ChamaLoansScreen');
              } else {
                navigation.goBack();
              }
            },
          },
        ]
      );
    } else {
      Alert.alert('Error', response.error || 'Failed to submit loan application');
    }
  } catch (error) {
    console.error('Error submitting loan application:', error);
    Alert.alert('Error', 'Failed to submit loan application. Please try again.');
  } finally {
    setLoading(false);
  }
};


  const renderGuarantorOption = (member) => {
    const isSelected = formData.guarantors.includes(member.user_id);
    
    return (
      <TouchableOpacity
        key={member.user_id}
        style={[
          styles.guarantorOption,
          {
            backgroundColor: isSelected ? colors.primary + '20' : colors.background,
            borderColor: isSelected ? colors.primary : colors.border,
          }
        ]}
        onPress={() => toggleGuarantor(member.user_id)}
      >
        <View style={styles.guarantorInfo}>
          <Text style={[styles.guarantorName, { color: colors.text }]}>
            {member.first_name} {member.last_name}
          </Text>
          <Text style={[styles.guarantorRole, { color: colors.textSecondary }]}>
            {member.role} • Member since {new Date(member.joined_at).getFullYear()}
          </Text>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  const renderSecurityOption = (security) => (
    <TouchableOpacity
      key={security.id}
      style={[
        styles.securityOption,
        {
          backgroundColor: formData.security.type === security.id ? colors.primary + '20' : colors.background,
          borderColor: formData.security.type === security.id ? colors.primary : colors.border,
        }
      ]}
      onPress={() => handleInputChange('security.type', security.id)}
    >
      <View style={styles.securityContent}>
        <Text style={[
          styles.securityName,
          { color: formData.security.type === security.id ? colors.primary : colors.text }
        ]}>
          {security.name}
        </Text>
        <Text style={[
          styles.securityDescription,
          { color: formData.security.type === security.id ? colors.primary : colors.textSecondary }
        ]}>
          {security.description}
        </Text>
      </View>
      {formData.security.type === security.id && (
        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  const monthlyPayment = calculateMonthlyPayment();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (onRouteChange) {
              onRouteChange('loans', 'ChamaLoansScreen');
            } else {
              navigation.goBack();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Loan Application
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Loan Type Selection */}
          <Card style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Select Loan Type *
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.loanTypeScroll}>
              <View style={styles.loanTypeRow}>
                {loanTypes.map((loanType) => (
                  <TouchableOpacity
                    key={loanType.id}
                    style={[
                      styles.loanTypeCard,
                      {
                        backgroundColor: selectedLoanType?.id === loanType.id ? colors.primary + '20' : colors.background,
                        borderColor: selectedLoanType?.id === loanType.id ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => handleLoanTypeChange(loanType)}
                  >
                    <Text style={[styles.loanTypeName, { color: selectedLoanType?.id === loanType.id ? colors.primary : colors.text }]}>
                      {loanType.name}
                    </Text>
                    <Text style={[styles.loanTypeAmount, { color: colors.textSecondary }]}>
                      {formatCurrency(loanType.minAmount)} - {formatCurrency(loanType.maxAmount)}
                    </Text>
                    <Text style={[styles.loanTypeRate, { color: colors.textSecondary }]}>
                      {loanType.interestRate}% · {loanType.termMonths} months
                    </Text>
                    {selectedLoanType?.id === loanType.id && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} style={styles.loanTypeCheck} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {selectedLoanType && (
              <View style={[styles.productDetails, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.productTitle, { color: colors.text }]}>Product Details</Text>
                <View style={styles.productGrid}>
                  <View style={styles.productItem}>
                    <Text style={[styles.productLabel, { color: colors.textSecondary }]}>Min Amount</Text>
                    <Text style={[styles.productValue, { color: colors.text }]}>{formatCurrency(selectedLoanType.minAmount)}</Text>
                  </View>
                  <View style={styles.productItem}>
                    <Text style={[styles.productLabel, { color: colors.textSecondary }]}>Max Amount</Text>
                    <Text style={[styles.productValue, { color: colors.text }]}>{formatCurrency(selectedLoanType.maxAmount)}</Text>
                  </View>
                  <View style={styles.productItem}>
                    <Text style={[styles.productLabel, { color: colors.textSecondary }]}>Interest Rate</Text>
                    <Text style={[styles.productValue, { color: colors.text }]}>{selectedLoanType.interestRate}%</Text>
                  </View>
                  <View style={styles.productItem}>
                    <Text style={[styles.productLabel, { color: colors.textSecondary }]}>Term</Text>
                    <Text style={[styles.productValue, { color: colors.text }]}>{selectedLoanType.termMonths} months</Text>
                  </View>
                  <View style={styles.productItem}>
                    <Text style={[styles.productLabel, { color: colors.textSecondary }]}>Grace Period</Text>
                    <Text style={[styles.productValue, { color: colors.text }]}>{selectedLoanType.gracePeriodDays || 0} days</Text>
                  </View>
                  <View style={styles.productItem}>
                    <Text style={[styles.productLabel, { color: colors.textSecondary }]}>Default Threshold</Text>
                    <Text style={[styles.productValue, { color: colors.text }]}>{selectedLoanType.defaultThresholdDays || 30} days</Text>
                  </View>
                  <View style={styles.productItem}>
                    <Text style={[styles.productLabel, { color: colors.textSecondary }]}>Net Disbursement</Text>
                    <Text style={[styles.productValue, { color: colors.text }]}>{formatCurrency(selectedLoanType.netDisbursement || 0)}</Text>
                  </View>
                  <View style={styles.productItem}>
                    <Text style={[styles.productLabel, { color: colors.textSecondary }]}>Current Loans</Text>
                    <Text style={[styles.productValue, { color: colors.text }]}>{selectedLoanType.currentLoans || 0}</Text>
                  </View>
                  <View style={styles.productItem}>
                    <Text style={[styles.productLabel, { color: colors.textSecondary }]}>Installment Penalty</Text>
                    <Text style={[styles.productValue, { color: colors.text }]}>
                      {selectedLoanType.installmentPenaltyType || 'fixed'} · {formatCurrency(selectedLoanType.installmentPenaltyAmount || 0)}
                    </Text>
                  </View>
                  <View style={styles.productItem}>
                    <Text style={[styles.productLabel, { color: colors.textSecondary }]}>Loan Penalty</Text>
                    <Text style={[styles.productValue, { color: colors.text }]}>{formatCurrency(selectedLoanType.loanPenaltyAmount || 0)}</Text>
                  </View>
                </View>
              </View>
            )}
          </Card>

          {/* Loan Details */}
          <Card style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Loan Details
            </Text>
            
            <Input
              label="Loan Amount (KES) *"
              value={formData.amount}
              onChangeText={(text) => handleInputChange('amount', text)}
              placeholder="Enter loan amount"
              keyboardType="numeric"
              icon={<Ionicons name="cash" size={20} color={colors.textSecondary} />}
            />

            <Input
              label="Purpose of Loan *"
              value={formData.purpose}
              onChangeText={(text) => handleInputChange('purpose', text)}
              placeholder="Business expansion, education, emergency, etc."
              multiline
              numberOfLines={2}
              icon={<Ionicons name="document-text" size={20} color={colors.textSecondary} />}
            />

            <Text style={[styles.fieldLabel, { color: colors.text }]}>
              Repayment Period *
            </Text>
            <View style={styles.periodGrid}>
              {repaymentPeriods.map((period) => (
                <TouchableOpacity
                  key={period.value}
                  style={[
                    styles.periodOption,
                    {
                      backgroundColor: formData.repaymentPeriod === period.value ? colors.primary + '20' : colors.background,
                      borderColor: formData.repaymentPeriod === period.value ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => handleInputChange('repaymentPeriod', period.value)}
                >
                  <Text style={[
                    styles.periodText,
                    { color: formData.repaymentPeriod === period.value ? colors.primary : colors.text }
                  ]}>
                    {period.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Interest Rate (% per annum)"
              value={formData.interestRate}
              onChangeText={(text) => handleInputChange('interestRate', text)}
              placeholder="Default: 10%"
              keyboardType="numeric"
              icon={<Ionicons name="trending-up" size={20} color={colors.textSecondary} />}
            />
          </Card>

          {/* Financial Information */}
          <Card style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Financial Information
            </Text>
            
            <Input
              label="Monthly Income (KES) *"
              value={formData.monthlyIncome}
              onChangeText={(text) => handleInputChange('monthlyIncome', text)}
              placeholder="Your monthly income"
              keyboardType="numeric"
              icon={<Ionicons name="wallet" size={20} color={colors.textSecondary} />}
            />

            <Input
              label="Other Loans/Debts"
              value={formData.otherLoans}
              onChangeText={(text) => handleInputChange('otherLoans', text)}
              placeholder="Describe any existing loans or debts"
              multiline
              numberOfLines={2}
              icon={<Ionicons name="card" size={20} color={colors.textSecondary} />}
            />

            <Input
              label="Business Plan (if applicable)"
              value={formData.businessPlan}
              onChangeText={(text) => handleInputChange('businessPlan', text)}
              placeholder="How will you use the loan to generate income?"
              multiline
              numberOfLines={3}
              icon={<Ionicons name="briefcase" size={20} color={colors.textSecondary} />}
            />
          </Card>

          {/* Security/Collateral */}
          <Card style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Security/Collateral
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              What security can you provide for this loan?
            </Text>
            
            <View style={styles.securityGrid}>
              {securityTypes.map(renderSecurityOption)}
            </View>

            {formData.security.type !== 'none' && (
              <>
                <Input
                  label="Security Description *"
                  value={formData.security.description}
                  onChangeText={(text) => handleInputChange('security.description', text)}
                  placeholder="Describe your collateral in detail"
                  multiline
                  numberOfLines={2}
                />

                <Input
                  label="Estimated Value (KES)"
                  value={formData.security.value}
                  onChangeText={(text) => handleInputChange('security.value', text)}
                  placeholder="Estimated value of collateral"
                  keyboardType="numeric"
                />
              </>
            )}
          </Card>

          {/* Guarantors */}
          {selectedLoanType?.requiresGuarantors && (
            <Card style={styles.formCard}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Select Guarantors *
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                Choose at least 2 chama members as guarantors. They will be notified to accept or reject.
              </Text>

              <View style={styles.guarantorGrid}>
                {chamaMembers.map(renderGuarantorOption)}
              </View>

              {formData.guarantors.length > 0 && (
                <View style={styles.selectedGuarantors}>
                  <Text style={[styles.selectedTitle, { color: colors.text }]}>
                    Selected Guarantors: {formData.guarantors.length}
                  </Text>
                </View>
              )}
            </Card>
          )}

          {/* Loan Summary */}
          {formData.amount && monthlyPayment > 0 && (
            <Card style={styles.summaryCard}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Loan Summary
              </Text>
              
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                  Loan Amount:
                </Text>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>
                  KES {parseFloat(formData.amount).toLocaleString()}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                  Monthly Payment:
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  KES {monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                  Total Repayment:
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  KES {(monthlyPayment * parseInt(formData.repaymentPeriod)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </Text>
              </View>
            </Card>
          )}

          <Button
            title="Submit Loan Application"
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitButton}
            icon={<Ionicons name="send" size={20} color={colors.white} />}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    ...shadows.sm,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl, // Extra bottom padding for better scrolling
  },
  formCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  periodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  periodOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    width: '48%', // Responsive width for 2 columns
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  periodText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
  },
  securityGrid: {
    marginBottom: spacing.md,
  },
  securityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  securityContent: {
    flex: 1,
  },
  securityName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  securityDescription: {
    fontSize: typography.fontSize.sm,
  },
  guarantorGrid: {
    marginBottom: spacing.md,
  },
  guarantorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
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
  selectedGuarantors: {
    padding: spacing.sm,
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
    borderRadius: borderRadius.sm,
  },
  selectedTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  summaryCard: {
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontSize: typography.fontSize.base,
  },
  summaryValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  submitButton: {
    marginBottom: spacing.xl,
  },
  loanTypeScroll: {
    marginBottom: spacing.md,
  },
  loanTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  loanTypeCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minWidth: 180,
    maxWidth: 220,
    position: 'relative',
  },
  loanTypeName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  loanTypeAmount: {
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.xs / 2,
  },
  loanTypeRate: {
    fontSize: typography.fontSize.xs,
  },
  loanTypeCheck: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  },
  productDetails: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  productTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  productItem: {
    flex: 1,
    minWidth: '45%',
    marginBottom: spacing.xs,
  },
  productLabel: {
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.xs / 2,
  },
  productValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
});

export default LoanApplication;
