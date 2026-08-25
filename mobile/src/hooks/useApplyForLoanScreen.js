import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import ApiService from '../services/api';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../utils/theme';

const useApplyForLoanScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { theme, user, selectedChama } = useApp();
  const colors = getThemeColors(theme);

  const routeChamaId = route.params?.chamaId || route.params?.id || selectedChama?.id || null;
  const chamaId = typeof routeChamaId === 'string' ? routeChamaId : null;

  const [newLoan, setNewLoan] = useState({
    amount: '',
    purpose: '',
    repaymentPeriod: '12',
    interestRate: '5',
    guarantors: [],
    businessPlan: '',
    monthlyIncome: '',
    otherLoans: '',
    loanTypeId: '',
    loanTypeName: '',
    termMonths: '12',
    requiresGuarantors: false,
  });

  const [availableGuarantors, setAvailableGuarantors] = useState([]);
  const [guarantorSearch, setGuarantorSearch] = useState('');
  const [showGuarantorSearch, setShowGuarantorSearch] = useState(false);
  const [loanTypes, setLoanTypes] = useState([]);
  const [showLoanTypePicker, setShowLoanTypePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [expandedLoanTypes, setExpandedLoanTypes] = useState(false);
  const [expandedGuarantors, setExpandedGuarantors] = useState(false);

  const loadLoanTypesForForm = useCallback(async () => {
    try {
      if (!chamaId) return;
      const response = await ApiService.getLoanTypes(chamaId, 'active');
      if (response.success) setLoanTypes(response.data || []);
    } catch (error) {
      console.error('Failed to load loan types for form:', error);
    }
  }, [chamaId]);

  const loadAvailableGuarantors = useCallback(async () => {
    try {
      if (!chamaId) return;
      const response = await ApiService.getChamaMembers(chamaId);
      if (response.success) {
        const members = (response.data || []).filter(
          m => {
            const uid = m.user_id || m.user?.id || m.userId || m.id;
            const isActive = m.is_active !== false && m.status !== 'inactive';
            return uid !== user?.id && isActive;
          }
        );
        const normalized = members.map(m => ({
          id: m.user_id || m.user?.id || m.userId || m.id,
          firstName: m.user?.first_name || m.first_name || m.firstName || '',
          lastName: m.user?.last_name || m.last_name || m.lastName || '',
          email: m.user?.email || m.email || '',
          phone: m.user?.phone || m.phone || '',
          memberNumber: m.member_number || m.memberNumber || m.membership_number || '',
        }));
        setAvailableGuarantors(normalized);
      }
    } catch (error) {
      console.error('Failed to load available guarantors:', error);
    }
  }, [chamaId, user?.id]);

  useEffect(() => {
    if (chamaId) {
      setPageReady(true);
      loadLoanTypesForForm();
      loadAvailableGuarantors();
    }
  }, [chamaId, loadLoanTypesForForm, loadAvailableGuarantors]);

  const handleInputChange = (field, value) => {
    setNewLoan((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addGuarantor = (guarantor) => {
    const userId = guarantor.id || guarantor.user_id || guarantor.user?.id || guarantor.userId;
    const firstName = guarantor.firstName || guarantor.first_name || guarantor.user?.first_name || '';
    const lastName = guarantor.lastName || guarantor.last_name || guarantor.user?.last_name || '';
    const email = guarantor.email || '';
    setNewLoan((prev) => ({
      ...prev,
      guarantors: prev.guarantors.some((g) => g.id === userId)
        ? prev.guarantors
        : [...prev.guarantors, { id: userId, firstName, lastName, email }],
    }));
  };

  const removeGuarantor = (guarantorId) => {
    setNewLoan((prev) => ({
      ...prev,
      guarantors: prev.guarantors.filter((g) => g.id !== guarantorId),
    }));
  };

  const handleSelectLoanType = (loanType) => {
    setNewLoan((prev) => ({
      ...prev,
      loanTypeId: loanType.id,
      loanTypeName: loanType.name,
      amount: String(loanType.exactAmount || ''),
      repaymentPeriod: String(loanType.termMonths || prev.repaymentPeriod || prev.termMonths || '12'),
      interestRate: String(loanType.interestRate || prev.interestRate || '5'),
      requiresGuarantors: !!loanType.requiresGuarantors,
    }));
    setShowLoanTypePicker(false);
  };

  const handleSubmit = async () => {
    if (!chamaId || !user?.id || typeof chamaId !== 'string') {
      Alert.alert('Error', `Missing chama or user context: chamaId=${chamaId}`);
      return;
    }
    const amount = parseFloat(newLoan.amount);
    if (!amount || amount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid loan amount.');
      return;
    }
    if (!newLoan.purpose.trim()) {
      Alert.alert('Validation Error', 'Please enter the loan purpose.');
      return;
    }
    if (!newLoan.monthlyIncome.trim()) {
      Alert.alert('Validation Error', 'Please enter your monthly income.');
      return;
    }
    if (!newLoan.loanTypeId) {
      Alert.alert('Validation Error', 'Please select a loan type.');
      return;
    }
    if (newLoan.requiresGuarantors && newLoan.guarantors.length < 2) {
      Alert.alert('Validation Error', 'Please select at least 2 guarantors.');
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        chamaId,
        loanTypeId: newLoan.loanTypeId,
        loanTypeName: newLoan.loanTypeName,
        amount,
        purpose: newLoan.purpose,
        interestRate: parseFloat(newLoan.interestRate || '0'),
        repaymentPeriod: parseInt(newLoan.repaymentPeriod, 10),
        monthlyIncome: parseFloat(newLoan.monthlyIncome || '0'),
        guarantors: newLoan.guarantors.map((g) => g.id),
        businessPlan: newLoan.businessPlan,
        otherLoans: newLoan.otherLoans,
      };
      const response = await ApiService.applyForLoan(payload);
      if (response?.success || response?.data) {
        Alert.alert('Success', 'Loan application submitted successfully', [
          {
            text: 'OK',
            onPress: () => {
              setNewLoan({
                amount: '',
                purpose: '',
                repaymentPeriod: '12',
                interestRate: '5',
                guarantors: [],
                businessPlan: '',
                monthlyIncome: '',
                otherLoans: '',
                loanTypeId: '',
                loanTypeName: '',
                termMonths: '12',
                requiresGuarantors: false,
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
      setSubmitting(false);
    }
  };

  return {
    chamaId,
    newLoan,
    availableGuarantors,
    guarantorSearch,
    showGuarantorSearch,
    loanTypes,
    showLoanTypePicker,
    submitting,
    pageReady,
    expandedLoanTypes,
    expandedGuarantors,
    colors,
    setNewLoan,
    setGuarantorSearch,
    setShowGuarantorSearch,
    setShowLoanTypePicker,
    setExpandedLoanTypes,
    setExpandedGuarantors,
    loadLoanTypesForForm,
    loadAvailableGuarantors,
    addGuarantor,
    removeGuarantor,
    handleInputChange,
    handleSelectLoanType,
    handleSubmit,
    navigation,
  };
};

export default useApplyForLoanScreen;
