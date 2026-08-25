import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, FlatList, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import useApplyForLoanScreen from '../../../hooks/useApplyForLoanScreen';

const ApplyForLoanScreen = () => {
  const screen = useApplyForLoanScreen();
  const colors = screen.colors;
  const styles = createStyles(colors);

  const [localGuarantorSearch, setLocalGuarantorSearch] = useState('');
  const [showGuarantorList, setShowGuarantorList] = useState(false);

  useEffect(() => {
    if (screen.submitSuccess) {
      const timer = setTimeout(() => {
        screen.setSubmitSuccess(false);
        screen.navigation.navigate('ChamaLoansScreen', { chamaId: screen.chamaId, loanApplicationSuccess: true });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [screen.submitSuccess, screen.chamaId, screen.navigation, screen.setSubmitSuccess]);

  if (!screen.pageReady) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textSecondary }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.sm }}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Apply for Loan</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Complete the form below to apply for a loan.</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
        <Card variant="outlined" style={{ marginBottom: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
              <Ionicons name="cash" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Loan Details</Text>
          </View>

          <TouchableOpacity style={[styles.formGroup, { marginBottom: spacing.md }]} onPress={() => screen.setShowLoanTypePicker(!screen.showLoanTypePicker)} activeOpacity={0.8}>
            <Text style={[styles.formLabel, { color: colors.text }]}>Loan Type {screen.newLoan.loanTypeName ? `(${screen.newLoan.loanTypeName})` : '*'}</Text>
            <View style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text style={{ color: screen.newLoan.loanTypeName ? colors.text : colors.textSecondary, flex: 1 }}>{screen.newLoan.loanTypeName || 'Select a loan type'}</Text>
              <Ionicons name={screen.showLoanTypePicker ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {screen.showLoanTypePicker && (
            <View style={{ marginBottom: spacing.md }}>
              <FlatList data={screen.loanTypes} keyExtractor={(item) => item.id} style={{ maxHeight: 240 }} renderItem={({ item }) => {
                const isSelected = screen.newLoan.loanTypeId === item.id;
                return (
                  <TouchableOpacity style={[styles.guarantorCard, { backgroundColor: isSelected ? colors.primary + '20' : colors.surface, borderColor: isSelected ? colors.primary : colors.border }]} onPress={() => { screen.handleSelectLoanType(item); screen.setShowLoanTypePicker(false); }}>
                    <View style={styles.guarantorCardContent}>
                      <View style={[styles.avatar, { backgroundColor: colors.white }]}><Ionicons name="cash" size={20} color={colors.primary} /></View>
                      <View style={styles.guarantorDetails}>
                        <Text style={[styles.guarantorName, { color: isSelected ? colors.primary : colors.text, fontWeight: typography.fontWeight.semibold }]}>{item.name}</Text>
                        <Text style={[styles.guarantorEmail, { color: isSelected ? colors.primary : colors.textSecondary, fontWeight: '500' }]}>KES {item.exactAmount ? item.exactAmount.toLocaleString() : '-'} • {item.interestRate}% • {item.termMonths} months</Text>
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                    </View>
                  </TouchableOpacity>
                );
              }} ListEmptyComponent={<View style={{ alignItems: 'center', paddingVertical: spacing.md }}><Text style={{ color: colors.textSecondary }}>No active loan types</Text></View>} />
            </View>
          )}

          <Input label="Loan Amount (KES) *" value={screen.newLoan.amount} editable={!screen.newLoan.loanTypeId} onChangeText={(text) => screen.handleInputChange('amount', text.replace(/[^0-9.]/g, ''))} placeholder="Enter loan amount" keyboardType="numeric" helperText={screen.newLoan.loanTypeId ? 'Amount set by selected loan type' : ''} />
          <Input label="Purpose *" value={screen.newLoan.purpose} onChangeText={(text) => screen.handleInputChange('purpose', text)} placeholder="What will you use this loan for?" multiline numberOfLines={3} />
          <Input label="Monthly Income (KES) *" value={screen.newLoan.monthlyIncome} onChangeText={(text) => screen.handleInputChange('monthlyIncome', text.replace(/[^0-9.]/g, ''))} placeholder="Your monthly income" keyboardType="numeric" />
        </Card>

        <Card variant="outlined" style={{ marginBottom: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
              <Ionicons name="calculator" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Loan Terms</Text>
          </View>
          <Input label="Repayment Period (Months)" value={screen.newLoan.repaymentPeriod} editable={!screen.newLoan.loanTypeId} onChangeText={(text) => screen.handleInputChange('repaymentPeriod', text.replace(/[^0-9]/g, ''))} placeholder={screen.newLoan.termMonths || '12'} keyboardType="numeric" helperText={screen.newLoan.loanTypeId ? 'Set by selected loan type' : ''} />
          <Input label="Interest Rate (%)" value={screen.newLoan.interestRate} editable={!screen.newLoan.loanTypeId} onChangeText={(text) => screen.handleInputChange('interestRate', text.replace(/[^0-9.]/g, '').split('.').slice(0, 2).join('.'))} placeholder="5" keyboardType="numeric" helperText={screen.newLoan.loanTypeId ? 'Set by selected loan type' : ''} />
        </Card>

        {screen.newLoan.requiresGuarantors && (
          <Card variant="outlined" style={{ marginBottom: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.info + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
                <Ionicons name="people" size={20} color={colors.info} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Guarantors</Text>
                <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
                  {screen.newLoan.guarantors.length < 2
                    ? `At least 2 guarantors required (${screen.newLoan.guarantors.length}/2 selected)`
                    : `${screen.newLoan.guarantors.length} guarantor${screen.newLoan.guarantors.length !== 1 ? 's' : ''} selected`}
                </Text>
              </View>
            </View>

            {screen.newLoan.guarantors.length > 0 && (
              <View style={{ marginBottom: spacing.md }}>
                {screen.newLoan.guarantors.map((guarantor, index) => (
                  <View key={guarantor.id || index} style={[styles.selectedGuarantorItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.selectedGuarantorName, { color: colors.text }]}>
                        {guarantor.firstName} {guarantor.lastName}
                      </Text>
                      <Text style={[styles.selectedGuarantorEmail, { color: colors.textSecondary }]}>
                        {guarantor.email || `@${guarantor.firstName || 'user'}`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.removeGuarantorBtn, { backgroundColor: colors.error + '15' }]}
                      onPress={() => screen.removeGuarantor(guarantor.id)}
                    >
                      <Ionicons name="close" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.addGuarantorBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={() => setShowGuarantorList((prev) => !prev)}
            >
              <Ionicons name={showGuarantorList ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary} />
              <Text style={[styles.addGuarantorText, { color: colors.primary }]}>
                {showGuarantorList ? 'Hide Available Members' : 'Add Guarantor'}
              </Text>
            </TouchableOpacity>

            {showGuarantorList && (
              <View style={styles.guarantorListContainer}>
                <View style={[styles.searchInputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="search" size={18} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search members..."
                    placeholderTextColor={colors.textSecondary}
                    value={localGuarantorSearch}
                    onChangeText={setLocalGuarantorSearch}
                  />
                  {localGuarantorSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setLocalGuarantorSearch('')}>
                      <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>

                <FlatList
                  data={screen.availableGuarantors.filter((g) => {
                    const fullName = `${g.firstName || ''} ${g.lastName || ''}`.toLowerCase();
                    const searchLower = localGuarantorSearch.toLowerCase();
                    return fullName.includes(searchLower) || (g.email || '').toLowerCase().includes(searchLower);
                  })}
                  keyExtractor={(item, index) => (item.id ? String(item.id) : index.toString())}
                  style={{ maxHeight: 300 }}
                  nestedScrollEnabled
                  renderItem={({ item }) => {
                    const isSelected = screen.newLoan.guarantors.some((g) => g.id === item.id);
                    return (
                      <TouchableOpacity
                        style={[styles.guarantorCard, { backgroundColor: isSelected ? colors.primary + '20' : colors.background, borderColor: isSelected ? colors.primary : colors.border }]}
                        onPress={() => {
                          if (!isSelected) {
                            screen.addGuarantor(item);
                          }
                        }}
                        disabled={isSelected}
                      >
                        <View style={styles.guarantorCardContent}>
                          <View style={[styles.avatar, { backgroundColor: colors.white }]}>
                            <Ionicons name="person" size={20} color={colors.primary} />
                          </View>
                          <View style={styles.guarantorDetails}>
                            <Text style={[styles.guarantorName, { color: isSelected ? colors.primary : colors.text, fontWeight: typography.fontWeight.semibold }]}>
                              {item.firstName} {item.lastName}
                            </Text>
                            <Text style={[styles.guarantorEmail, { color: isSelected ? colors.primary : colors.textSecondary }]}>
                              {item.email || 'No email'}
                            </Text>
                          </View>
                          {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                      <Text style={{ color: colors.textSecondary }}>
                        {localGuarantorSearch ? 'No members match your search' : 'No available guarantors'}
                      </Text>
                    </View>
                  }
                />
              </View>
            )}
          </Card>
        )}

        <Card variant="outlined" style={{ marginBottom: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.info + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
              <Ionicons name="information-circle" size={20} color={colors.info} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Additional Information</Text>
          </View>
          <Input label="Business Plan (Optional)" value={screen.newLoan.businessPlan} onChangeText={(text) => screen.handleInputChange('businessPlan', text)} placeholder="Describe your business plan..." multiline numberOfLines={4} />
          <Input label="Other Loans (Optional)" value={screen.newLoan.otherLoans} onChangeText={(text) => screen.handleInputChange('otherLoans', text)} placeholder="Do you have any other loans?" multiline numberOfLines={2} />
        </Card>

          <Button title={screen.submitting ? 'Submitting...' : 'Submit Application'} onPress={screen.handleSubmit} disabled={screen.submitting} style={{ backgroundColor: colors.primary, marginTop: spacing.lg, marginBottom: spacing.xl }} icon={!screen.submitting && <Ionicons name="send" size={16} color={colors.white} />} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  containerBackground: { backgroundColor: colors.background },
  headerTitle: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, marginBottom: spacing.xs },
  headerSubtitle: { fontSize: typography.fontSize.base },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.sm, paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  sectionTitle: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, marginLeft: spacing.sm },
  sectionSubtitle: { fontSize: typography.fontSize.sm, marginBottom: spacing.md },
  formGroup: { marginBottom: spacing.md },
  formLabel: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginBottom: spacing.xs },
  formInput: { height: 48, paddingHorizontal: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1 },
  selectedGuarantorItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.sm, borderWidth: 1 },
  selectedGuarantorName: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium },
  selectedGuarantorEmail: { fontSize: typography.fontSize.xs },
  guarantorItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm, borderRadius: borderRadius.md, marginBottom: spacing.sm },
  guarantorInfo: { flex: 1 },
  guarantorName: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium },
  guarantorEmail: { fontSize: typography.fontSize.xs },
  removeGuarantorBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addGuarantorBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, marginBottom: spacing.md, gap: spacing.sm },
  addGuarantorText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium },
  guarantorListContainer: { marginTop: spacing.md },
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, height: 44, borderRadius: borderRadius.md, gap: spacing.sm, marginBottom: spacing.sm },
  searchInput: { flex: 1, fontSize: typography.fontSize.sm },
  guarantorCard: { borderRadius: borderRadius.md, borderWidth: 1, marginBottom: spacing.sm },
  guarantorCardContent: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, gap: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  guarantorDetails: { flex: 1 },
  doneButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  doneButtonText: { color: colors.white, fontWeight: '600' },
});

export default ApplyForLoanScreen;
