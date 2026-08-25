import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import OTPVerificationModal from '../../../components/common/OTPVerificationModal';
import useSavingsDetails from '../../../hooks/useSavingsDetails';
import SavingsAccountHeader from '../../../components/savings/SavingsAccountHeader';
import BalanceCard from '../../../components/savings/BalanceCard';
import AccountDetailsCard from '../../../components/savings/AccountDetailsCard';
import TransactionHistory from '../../../components/savings/TransactionHistory';
import SavingsActions from '../../../components/savings/SavingsActions';

const SavingsDetails = ({ route, navigation }) => {
  const {
    colors,
    savingsAccount,
    loading,
    transactions,
    userRole,
    showOTPModal,
    setShowOTPModal,
    otpLoading,
    handleInitiateApprove,
    handleVerifyOTP,
    handleResendOTP,
    canApproveSavings,
    formatCurrency,
    formatDate,
  } = useSavingsDetails({ route, navigation });

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (!savingsAccount) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorState}>
          <Ionicons name="wallet-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Account Not Found</Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            Unable to load savings account details
          </Text>
          <Button
            title="Go Back"
            onPress={() => navigation.goBack()}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <SavingsAccountHeader
          colors={colors}
          savingsAccount={savingsAccount}
        />

        <BalanceCard
          colors={colors}
          savingsAccount={savingsAccount}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />

        <AccountDetailsCard
          colors={colors}
          savingsAccount={savingsAccount}
          formatDate={formatDate}
        />

        <Card variant="outlined" style={styles.transactionsCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Transaction History</Text>
          <TransactionHistory
            colors={colors}
            transactions={transactions}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
          />
        </Card>

        <SavingsActions
          colors={colors}
          savingsAccount={savingsAccount}
          canApproveSavings={canApproveSavings}
          onApprove={() => handleInitiateApprove(savingsAccount)}
          onWithdraw={() => Alert.alert('Coming Soon', 'Savings withdrawal will be available in the next update.')}
          onDeposit={() => Alert.alert('Coming Soon', 'Savings deposit will be available in the next update.')}
          onStatements={() => Alert.alert('Coming Soon', 'Account statements will be available in the next update.')}
        />

        <OTPVerificationModal
          visible={showOTPModal}
          onClose={() => {
            setShowOTPModal(false);
          }}
          title={savingsAccount.status === 'eligible' || savingsAccount.status === 'pending' ? 'Approve Withdrawal' : 'Verify Disbursement'}
          subtitle={`Enter the OTP sent to your phone to approve this savings withdrawal.`}
          onVerify={handleVerifyOTP}
          onResend={handleResendOTP}
          loading={otpLoading}
          itemType="savings-withdrawal"
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: spacing.sm,
  },
  transactionsCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.lg,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorSubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
});

export default SavingsDetails;
