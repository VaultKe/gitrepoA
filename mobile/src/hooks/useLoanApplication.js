import { useState, useEffect } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../utils/theme';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import ApiService from '../services/api';

const useLoanApplication = ({ route, navigation, onRouteChange }) => {
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
    security: { type: 'none', description: '', value: '' },
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
        const otherMembers = (response.data || []).filter(member => member.user_id !== user.id);
        setChamaMembers(otherMembers);
      }
    } catch (error) {
      console.error('Failed to load chama members:', error);
    }
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
      setFormData((prev) => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.amount || !formData.purpose || !formData.monthlyIncome) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }
    try {
      setLoading(true);
      const payload = {
        ...formData,
        chamaId,
        amount: parseFloat(formData.amount),
        interestRate: parseFloat(formData.interestRate || '0'),
        repaymentPeriod: parseInt(formData.repaymentPeriod, 10),
        monthlyIncome: parseFloat(formData.monthlyIncome || '0'),
        guarantors: formData.guarantors.map((g) => g.id),
      };
      const response = await ApiService.applyForLoan(payload);
      if (response?.success || response?.data) {
        Alert.alert('Success', 'Loan application submitted successfully', [
          {
            text: 'OK',
            onPress: () => {
              setFormData({
                loanTypeId: '',
                amount: '',
                purpose: '',
                repaymentPeriod: '6',
                interestRate: '',
                guarantors: [],
                security: { type: 'none', description: '', value: '' },
                businessPlan: '',
                monthlyIncome: '',
                otherLoans: '',
              });
              setTimeout(() => {
                navigation.navigate('ChamaLoansScreen', { chamaId, loanApplicationSuccess: true });
              }, 100);
            },
          },
        ]);
      } else {
        Alert.alert('Error', response?.error || response?.message || 'Failed to submit loan application');
      }
    } catch (error) {
      console.error('[ApplyForLoan] Submit error', error);
      Alert.alert('Error', error?.message || 'Failed to submit loan application');
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    chamaMembers,
    loanTypes,
    selectedLoanType,
    formData,
    repaymentPeriods,
    securityTypes,
    setFormData,
    setSelectedLoanType,
    loadChamaMembers,
    loadLoanTypes,
    handleInputChange,
    handleSubmit,
    colors,
    styles: createStyles(colors),
  };
};

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  containerBackground: { backgroundColor: colors.background },
  headerTitle: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, marginBottom: spacing.xs },
  headerSubtitle: { fontSize: typography.fontSize.base },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.sm, paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 0, 0, 0.1)' },
  sectionTitle: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, marginLeft: spacing.sm },
  sectionSubtitle: { fontSize: typography.fontSize.sm, marginBottom: spacing.md },
  formGroup: { marginBottom: spacing.md },
  formLabel: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginBottom: spacing.xs },
  formInput: { height: 48, paddingHorizontal: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1 },
  guarantorItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm, borderRadius: borderRadius.md, marginBottom: spacing.sm },
  guarantorInfo: { flex: 1 },
  guarantorName: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium },
  guarantorEmail: { fontSize: typography.fontSize.xs },
  removeGuarantorBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addGuarantorBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, marginBottom: spacing.md, gap: spacing.sm },
  addGuarantorText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium },
  searchModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  searchModalContent: { borderRadius: borderRadius.xl, width: '100%', maxWidth: 420, maxHeight: '90%', borderWidth: 1 },
  searchModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.lg },
  searchModalTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold },
  closeButton: { padding: spacing.xs },
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, height: 44, borderRadius: borderRadius.md, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: typography.fontSize.sm },
  guarantorCard: { borderRadius: borderRadius.md, borderWidth: 1, marginBottom: spacing.sm },
  guarantorCardContent: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, gap: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  guarantorDetails: { flex: 1 },
  doneButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  doneButtonText: { color: colors.white, fontWeight: '600' },
});

export default useLoanApplication;
