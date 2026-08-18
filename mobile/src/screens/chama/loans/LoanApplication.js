import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Modal, FlatList, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import useLoanApplication from '../../../hooks/useLoanApplication';

const LoanApplication = ({ route, navigation, onRouteChange }) => {
  const screen = useLoanApplication({ route, navigation, onRouteChange });
  const colors = screen.colors;
  const styles = screen.styles;

  if (screen.loading) {
    return (
      <SafeAreaView style={[styles.container, styles.containerBackground]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textSecondary }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, styles.containerBackground]}>
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
      >
        <Card variant="outlined" style={{ marginBottom: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
              <Ionicons name="cash" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Loan Details</Text>
          </View>

          <TouchableOpacity style={[styles.formGroup, { marginBottom: spacing.md }]} onPress={() => screen.setSelectedLoanType(!screen.selectedLoanType)} activeOpacity={0.8}>
            <Text style={[styles.formLabel, { color: colors.text }]}>
              Loan Type {screen.formData.loanTypeName ? `(${screen.formData.loanTypeName})` : '*'}
            </Text>
            <View style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text style={{ color: screen.formData.loanTypeName ? colors.text : colors.textSecondary, flex: 1 }}>
                {screen.formData.loanTypeName || 'Select a loan type'}
              </Text>
              <Ionicons name={screen.selectedLoanType ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {screen.selectedLoanType && (
            <View style={{ marginBottom: spacing.md }}>
              <FlatList
                data={screen.loanTypes}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 240 }}
                renderItem={({ item }) => {
                  const isSelected = screen.formData.loanTypeId === item.id;
                  return (
                    <TouchableOpacity
                      style={[styles.guarantorCard, { backgroundColor: isSelected ? colors.primary + '20' : colors.surface, borderColor: isSelected ? colors.primary : colors.border }]}
                      onPress={() => {
                        screen.handleInputChange('loanTypeId', item.id);
                        screen.handleInputChange('loanTypeName', item.name);
                        screen.handleInputChange('amount', String(item.exactAmount || ''));
                        screen.handleInputChange('repaymentPeriod', String(item.termMonths || screen.formData.repaymentPeriod || '12'));
                        screen.handleInputChange('interestRate', String(item.interestRate || screen.formData.interestRate || '5'));
                        screen.setSelectedLoanType(false);
                      }}
                    >
                      <View style={styles.guarantorCardContent}>
                        <View style={[styles.avatar, { backgroundColor: colors.white }]}>
                          <Ionicons name="cash" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.guarantorDetails}>
                          <Text style={[styles.guarantorName, { color: isSelected ? colors.primary : colors.text, fontWeight: '600' }]}>{item.name}</Text>
                          <Text style={[styles.guarantorEmail, { color: isSelected ? colors.primary : colors.textSecondary, fontWeight: '500' }]}>
                            KES {item.exactAmount ? item.exactAmount.toLocaleString() : '-'} • {item.interestRate}% • {item.termMonths} months
                          </Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
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
            value={screen.formData.amount}
            editable={!screen.formData.loanTypeId}
            onChangeText={(text) => screen.handleInputChange('amount', text.replace(/[^0-9.]/g, ''))}
            placeholder="Enter loan amount"
            keyboardType="numeric"
            helperText={screen.formData.loanTypeId ? 'Amount set by selected loan type' : ''}
          />

          <Input
            label="Purpose *"
            value={screen.formData.purpose}
            onChangeText={(text) => screen.handleInputChange('purpose', text)}
            placeholder="What will you use this loan for?"
            multiline
            numberOfLines={3}
          />

          <Input
            label="Monthly Income (KES) *"
            value={screen.formData.monthlyIncome}
            onChangeText={(text) => screen.handleInputChange('monthlyIncome', text.replace(/[^0-9.]/g, ''))}
            placeholder="Your monthly income"
            keyboardType="numeric"
          />
        </Card>

        <Card variant="outlined" style={{ marginBottom: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
              <Ionicons name="calculator" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Loan Terms</Text>
          </View>

          <Input
            label="Repayment Period (Months)"
            value={screen.formData.repaymentPeriod}
            editable={!screen.formData.loanTypeId}
            onChangeText={(text) => screen.handleInputChange('repaymentPeriod', text.replace(/[^0-9]/g, ''))}
            placeholder={screen.formData.termMonths || '12'}
            keyboardType="numeric"
            helperText={screen.formData.loanTypeId ? 'Set by selected loan type' : ''}
          />

          <Input
            label="Interest Rate (%)"
            value={screen.formData.interestRate}
            editable={!screen.formData.loanTypeId}
            onChangeText={(text) => screen.handleInputChange('interestRate', text.replace(/[^0-9.]/g, '').split('.').slice(0, 2).join('.'))}
            placeholder="5"
            keyboardType="numeric"
            helperText={screen.formData.loanTypeId ? 'Set by selected loan type' : ''}
          />
        </Card>

        <Card variant="outlined" style={{ marginBottom: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.info + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
              <Ionicons name="information-circle" size={20} color={colors.info} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Additional Information</Text>
          </View>

          <Input
            label="Business Plan (Optional)"
            value={screen.formData.businessPlan}
            onChangeText={(text) => screen.handleInputChange('businessPlan', text)}
            placeholder="Describe your business plan..."
            multiline
            numberOfLines={4}
          />

          <Input
            label="Other Loans (Optional)"
            value={screen.formData.otherLoans}
            onChangeText={(text) => screen.handleInputChange('otherLoans', text)}
            placeholder="Do you have any other loans?"
            multiline
            numberOfLines={2}
          />
        </Card>

        <Button
          title={screen.loading ? 'Submitting...' : 'Submit Application'}
          onPress={screen.handleSubmit}
          disabled={screen.loading}
          style={{ backgroundColor: colors.primary, marginTop: spacing.lg, marginBottom: spacing.xl }}
          icon={!screen.loading && <Ionicons name="send" size={16} color={colors.white} />}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export default LoanApplication;
