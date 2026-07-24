import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Alert,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import ApiService from '../../../services/api';
import { useApp } from '../../../context/AppContext';
import Input from '../../../components/common/Input';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import { getThemeColors } from '../../../utils/theme';
import { spacing, typography, borderRadius } from '../../../utils/theme';

const ApplyForLoanScreen = () => {
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
        // Inspect payload shape if needed:
        // console.log('Available guarantors sample:', members[0]);
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

  if (!pageReady) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <LoadingSpinner />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Apply for Loan</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Complete the form below to apply for a loan.
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              loadLoanTypesForForm();
              loadAvailableGuarantors();
            }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Loan Details Card */}
        <Card variant="outlined" style={{ marginBottom: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
              <Ionicons name="cash" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Loan Details</Text>
          </View>

          {/* Loan Type Selection */}
          <TouchableOpacity
            style={[styles.formGroup, { marginBottom: spacing.md }]}
            onPress={() => setExpandedLoanTypes(!expandedLoanTypes)}
            activeOpacity={0.8}
          >
            <Text style={[styles.formLabel, { color: colors.text }]}>
              Loan Type {newLoan.loanTypeName ? `(${newLoan.loanTypeName})` : '*'}
            </Text>
            <View
              style={[
                styles.formInput,
                { backgroundColor: colors.background, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
              ]}
            >
              <Text style={{ color: newLoan.loanTypeName ? colors.text : colors.textSecondary, flex: 1 }}>
                {newLoan.loanTypeName || 'Select a loan type'}
              </Text>
              <Ionicons name={expandedLoanTypes ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
          
           {expandedLoanTypes && (
             <View style={{ marginBottom: spacing.md }}>
               <FlatList
                 data={loanTypes}
                 keyExtractor={(item) => item.id}
                 style={{ maxHeight: 240 }}
                 renderItem={({ item }) => {
                   const isSelected = newLoan.loanTypeId === item.id;
                   return (
                     <TouchableOpacity
                       style={[
                         styles.guarantorCard,
                         {
                           backgroundColor: isSelected ? colors.primary + '20' : colors.surface,
                           borderColor: isSelected ? colors.primary : colors.border,
                         },
                       ]}
                       onPress={() => {
                         handleSelectLoanType(item);
                         setExpandedLoanTypes(false);
                       }}
                     >
                       <View style={styles.guarantorCardContent}>
                         <View style={[styles.avatar, { backgroundColor: colors.white }]}>
                           <Ionicons name="cash" size={20} color={colors.primary} />
                         </View>
                         <View style={styles.guarantorDetails}>
                           <Text style={[styles.guarantorName, { color: isSelected ? colors.primary : colors.text, fontWeight: '600' }]}>
                             {item.name}
                           </Text>
                           <Text style={[styles.guarantorEmail, { color: isSelected ? colors.primary : colors.textSecondary, fontWeight: '500' }]}>
                             KES {item.exactAmount ? item.exactAmount.toLocaleString() : '-'} • {item.interestRate}% • {item.termMonths} months
                           </Text>
                         </View>
                         {isSelected && (
                           <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                         )}
                       </View>
                     </TouchableOpacity>
                   );
                 }}
                 ListEmptyComponent={
                   <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                     <Text style={{ color: colors.textSecondary }}>No active loan types</Text>
                   </View>
                 }
               />
              </View>
             )}

          <Input
            label="Loan Amount (KES) *"
            value={newLoan.amount}
            editable={!newLoan.loanTypeId}
            onChangeText={(text) => setNewLoan((prev) => ({ ...prev, amount: text.replace(/[^0-9.]/g, '') }))}
            placeholder="Enter loan amount"
            keyboardType="numeric"
            helperText={newLoan.loanTypeId ? 'Amount set by selected loan type' : ''}
          />

          <Input
            label="Purpose *"
            value={newLoan.purpose}
            onChangeText={(text) => setNewLoan((prev) => ({ ...prev, purpose: text }))}
            placeholder="What will you use this loan for?"
            multiline
            numberOfLines={3}
          />

          <Input
            label="Monthly Income (KES) *"
            value={newLoan.monthlyIncome}
            onChangeText={(text) => setNewLoan((prev) => ({ ...prev, monthlyIncome: text.replace(/[^0-9.]/g, '') }))}
            placeholder="Your monthly income"
            keyboardType="numeric"
          />        


         </Card>

        {/* Loan Terms Card */}
        <Card variant="outlined" style={{ marginBottom: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
              <Ionicons name="calculator" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Loan Terms</Text>
          </View>

          <Input
            label="Repayment Period (Months)"
            value={newLoan.repaymentPeriod}
            editable={!newLoan.loanTypeId}
            onChangeText={(text) => setNewLoan((prev) => ({ ...prev, repaymentPeriod: text.replace(/[^0-9]/g, '') }))}
            placeholder={newLoan.termMonths || '12'}
            keyboardType="numeric"
            helperText={newLoan.loanTypeId ? 'Set by selected loan type' : ''}
          />

          <Input
            label="Interest Rate (%)"
            value={newLoan.interestRate}
            editable={!newLoan.loanTypeId}
            onChangeText={(text) => setNewLoan((prev) => ({ ...prev, interestRate: text.replace(/[^0-9.]/g, '').split('.').slice(0, 2).join('.') }))}
            placeholder="5"
            keyboardType="numeric"
            helperText={newLoan.loanTypeId ? 'Set by selected loan type' : ''}
          />
        </Card>

        {/* Additional Information Card */}
        <Card variant="outlined" style={{ marginBottom: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.info + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
              <Ionicons name="information-circle" size={20} color={colors.info} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Additional Information</Text>
          </View>

          <Input
            label="Business Plan (Optional)"
            value={newLoan.businessPlan}
            onChangeText={(text) => setNewLoan((prev) => ({ ...prev, businessPlan: text }))}
            placeholder="Describe your business plan..."
            multiline
            numberOfLines={4}
          />

          <Input
            label="Other Loans (Optional)"
            value={newLoan.otherLoans}
            onChangeText={(text) => setNewLoan((prev) => ({ ...prev, otherLoans: text }))}
            placeholder="Do you have any other loans?"
            multiline
            numberOfLines={2}
          />
        </Card>

         {/* Guarantors Card */}
        {newLoan.requiresGuarantors && (
          <Card variant="outlined" style={{ marginBottom: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.warning + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
                <Ionicons name="people" size={20} color={colors.warning} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>
                Guarantors ({newLoan.guarantors.length}/5) *
              </Text>
            </View>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, marginTop: -spacing.xs }]}>
              Select at least 2 guarantors for your loan application
            </Text>

            {newLoan.guarantors.map((guarantor) => (
              <View key={guarantor.id} style={[styles.guarantorItem, { backgroundColor: colors.primary + '20', borderColor: colors.primary, borderWidth: 1, marginBottom: spacing.sm }]}>
                 <View style={styles.guarantorInfo}>
                   <Text style={[styles.guarantorName, { color: colors.primary }]}>
                     {guarantor.firstName} {guarantor.lastName}
                   </Text>
                   <Text style={[styles.guarantorEmail, { color: colors.textSecondary }]}>{guarantor.email}</Text>
                 </View>
                 <TouchableOpacity
                   onPress={() => removeGuarantor(guarantor.id)}
                   style={[styles.removeGuarantorBtn, { backgroundColor: colors.primary }]}
                 >
                   <Ionicons name="close" size={16} color={colors.white} />
                 </TouchableOpacity>
               </View>
             ))}

            <TouchableOpacity
              style={[styles.addGuarantorBtn, { borderColor: colors.primary, marginTop: spacing.sm }]}
              onPress={() => setExpandedGuarantors(!expandedGuarantors)}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
              <Text style={[styles.addGuarantorText, { color: colors.primary }]}>Add Guarantor</Text>
              <Ionicons name={expandedGuarantors ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
            </TouchableOpacity>

            {expandedGuarantors && (
              <View style={{ marginTop: spacing.sm }}>
                <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
                  <View style={[styles.searchInputContainer, { backgroundColor: colors.surface }]}>
                    <Ionicons name="search" size={20} color={colors.textSecondary} />
                    <TextInput
                      style={[styles.searchInput, { color: colors.text }]}
                      value={guarantorSearch}
                      onChangeText={(text) => {
                        setGuarantorSearch(text);
                        loadAvailableGuarantors();
                      }}
                      placeholder="Search by name, email, or phone..."
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                </View>

                 <FlatList
                   data={availableGuarantors}
                   keyExtractor={(item) => item.id}
                   style={{ maxHeight: 240 }}
                   renderItem={({ item }) => {
                      const isSelected = newLoan.guarantors.some((g) => g.id === item.id);
                     return (
                       <TouchableOpacity
                         style={[
                           styles.guarantorCard,
                           {
                             backgroundColor: isSelected ? colors.primary + '20' : colors.surface,
                             borderColor: isSelected ? colors.primary : colors.border,
                           },
                         ]}
                          onPress={() => {
                            const id = item.id;
                            if (isSelected) {
                              removeGuarantor(id);
                            } else {
                              addGuarantor({
                                id,
                                firstName: item.firstName,
                                lastName: item.lastName,
                                email: item.email,
                              });
                            }
                          }}
                       >
                         <View style={styles.guarantorCardContent}>
                           <View style={[styles.avatar, { backgroundColor: isSelected ? colors.primary : colors.textSecondary }]}>
                             <Ionicons name="person" size={20} color={colors.white} />
                           </View>
                           <View style={styles.guarantorDetails}>
                             <Text style={[styles.guarantorName, { color: isSelected ? colors.primary : colors.text, fontWeight: '600' }]}>
                               {item.firstName} {item.lastName}
                             </Text>
                             <Text style={[styles.guarantorEmail, { color: isSelected ? colors.primary : colors.textSecondary, fontWeight: '500' }]}>{item.email}</Text>
                           </View>
                           {isSelected && (
                             <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                           )}
                         </View>
                       </TouchableOpacity>
                     );
                   }}
                   ListEmptyComponent={
                     <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                       <Text style={{ color: colors.textSecondary }}>No guarantors found</Text>
                     </View>
                   }
                   />
               </View>
             )}
           </Card>
         )}

        <Button
          title={submitting ? 'Submitting...' : 'Submit Application'}
          onPress={handleSubmit}
          disabled={submitting}
          style={{ backgroundColor: colors.primary, marginTop: spacing.lg, marginBottom: spacing.xl }}
          icon={!submitting && <Ionicons name="send" size={16} color={colors.white} />}
        />
      </ScrollView>

      {/* Guarantor Search Modal */}
      <Modal visible={showGuarantorSearch} transparent animationType="fade" onRequestClose={() => setShowGuarantorSearch(false)}>
        <View style={styles.searchModalOverlay}>
          <View style={[styles.searchModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.searchModalHeader}>
              <View>
                <Text style={[styles.searchModalTitle, { color: colors.text }]}>Select Guarantors</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                  {newLoan.guarantors.length}/5 selected
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowGuarantorSearch(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
              <View style={[styles.searchInputContainer, { backgroundColor: colors.backgroundSecondary }]}>
                <Ionicons name="search" size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  value={guarantorSearch}
                  onChangeText={(text) => {
                    setGuarantorSearch(text);
                    loadAvailableGuarantors();
                  }}
                  placeholder="Search by name, email, or phone..."
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            <FlatList
              data={availableGuarantors}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator
              style={{ maxHeight: 320 }}
              contentContainerStyle={{ paddingVertical: spacing.sm }}
               renderItem={({ item }) => {
                 const isSelected = newLoan.guarantors.some((g) => g.id === item.id);
                   return (
                     <TouchableOpacity
                       style={[
                         styles.guarantorCard,
                         {
                           backgroundColor: isSelected ? colors.primary + '20' : colors.surface,
                           borderColor: isSelected ? colors.primary : colors.border,
                         },
                       ]}
                       onPress={() => {
                         const id = item.id;
                         if (isSelected) {
                           removeGuarantor(id);
                         } else {
                           addGuarantor({
                             id,
                             firstName: item.firstName,
                             lastName: item.lastName,
                             email: item.email,
                           });
                         }
                       }}
                     >
                       <View style={styles.guarantorCardContent}>
                         <View style={[styles.avatar, { backgroundColor: isSelected ? colors.primary : colors.textSecondary }]}>
                           <Ionicons name="person" size={20} color={colors.white} />
                         </View>
                         <View style={styles.guarantorDetails}>
                           <Text style={[styles.guarantorName, { color: isSelected ? colors.primary : colors.text, fontWeight: '600' }]}>
                             {item.firstName} {item.lastName}
                           </Text>
                           <Text style={[styles.guarantorEmail, { color: isSelected ? colors.primary : colors.textSecondary, fontWeight: '500' }]}>{item.email}</Text>
                         </View>
                         {isSelected && (
                           <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                         )}
                       </View>
                     </TouchableOpacity>
                   );
               }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                  <Text style={{ color: colors.textSecondary }}>No guarantors found</Text>
                </View>
              }
            />

            <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
              <TouchableOpacity
                style={[styles.doneButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowGuarantorSearch(false)}
              >
                <Text style={[styles.doneButtonText, { color: colors.white }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Loan Type Picker Modal */}
      <Modal visible={showLoanTypePicker} transparent animationType="fade" onRequestClose={() => setShowLoanTypePicker(false)}>
        <View style={styles.searchModalOverlay}>
          <View style={[styles.searchModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.searchModalHeader}>
              <View>
                <Text style={[styles.searchModalTitle, { color: colors.text }]}>Select Loan Type</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Choose a loan type to prefill your application</Text>
              </View>
              <TouchableOpacity onPress={() => setShowLoanTypePicker(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={loanTypes}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 320 }}
              contentContainerStyle={{ paddingVertical: spacing.sm }}
              renderItem={({ item }) => {
                const isSelected = newLoan.loanTypeId === item.id;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.guarantorCard,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => handleSelectLoanType(item)}
                    >
                      <View style={styles.guarantorCardContent}>
                        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                          <Ionicons name="cash" size={20} color={colors.white} />
                        </View>
                        <View style={styles.guarantorDetails}>
                          <Text style={[styles.guarantorName, { color: isSelected ? colors.primary : colors.text, fontWeight: '600' }]}>
                            {item.name}
                          </Text>
                          <Text style={[styles.guarantorEmail, { color: isSelected ? colors.primary : colors.textSecondary, fontWeight: '500' }]}>
                             KES {item.exactAmount ? item.exactAmount.toLocaleString() : '-'} • {item.interestRate}% • {item.termMonths} months
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
              }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                  <Text style={{ color: colors.textSecondary }}>No active loan types</Text>
                </View>
              }
            />

            <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
              <TouchableOpacity
                style={[styles.doneButton, { backgroundColor: colors.textSecondary }]}
                onPress={() => setShowLoanTypePicker(false)}
              >
                <Text style={[styles.doneButtonText, { color: colors.white }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.base,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  formLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  formInput: {
    height: 48,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  guarantorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  guarantorInfo: {
    flex: 1,
  },
  guarantorName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  guarantorEmail: {
    fontSize: typography.fontSize.xs,
  },
  removeGuarantorBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGuarantorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  addGuarantorText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  searchModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  searchModalContent: {
    borderRadius: borderRadius.xl,
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    borderWidth: 1,
  },
  searchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.lg,
  },
  searchModalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  closeButton: {
    padding: spacing.xs,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    height: 44,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.sm,
  },
  guarantorCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  guarantorCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guarantorDetails: {
    flex: 1,
  },
});

export default ApplyForLoanScreen;
