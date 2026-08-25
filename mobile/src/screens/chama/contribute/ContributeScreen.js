import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import ContributionTypeSelector from '../../../components/contributions/ContributionTypeSelector';
import PaymentMethodSelector from '../../../components/contributions/PaymentMethodSelector';
import MemberListingSection from '../../../components/contributions/MemberListingSection';
import CurrentRecipientInfo from '../../../components/contributions/CurrentRecipientInfo';
import PaymentConfirmationModal from '../../../components/contributions/PaymentConfirmationModal';
import MerryGoRoundRules from '../../../components/contributions/MerryGoRoundRules';
import AnonymousContribution from '../../../components/contributions/AnonymousContribution';
import ValidationMessage from '../../../components/contributions/ValidationMessage';
import PhoneNumberDisplay from '../../../components/contributions/PhoneNumberDisplay';
import useContributionScreen from '../../../hooks/useContributionScreen';

const ContributeScreen = ({ route, navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const screen = useContributionScreen({ route, navigation });

  const {
    // Route params
    chamaId,
    roundName,
    proposalTitle,
    requestedAmount,
    amountPerRound,
    // State
    chama,
    amount,
    description,
    loading,
    paymentMethod,
    walletBalance,
    showPaymentModal,
    refreshing,
    isAnonymous,
    availablePaymentMethods,
    availableContributionTypes,
    contributionType,
    showContributionTypeDropdown,
    merryGoRounds,
    selectedMerryGoRound,
    showMerryGoRoundDropdown,
    welfareContributions,
    selectedWelfare,
    showWelfareDropdown,
    loadingContributionOptions,
    chamaMembers,
    selectedContributor,
    currentRecipient,
    contributionStatus,
    memberSearchQuery,
    // Setters
    setPaymentMethod,
    setShowContributionTypeDropdown,
    setShowMerryGoRoundDropdown,
    setShowWelfareDropdown,
    setSelectedContributor,
    setMemberSearchQuery,
    // Handlers
    handleContributionTypeChange,
    handleMerryGoRoundSelect,
    handleWelfareSelect,
    closeAllDropdowns,
    loadCurrentRecipient,
    onRefresh,
    handleContribute,
    confirmContribution,
    validateMemberSelection,
    // Helpers
    formatCurrency,
    getContributionTitle,
    getContributionIcon,
    getContributionColor,
    getContributionSubtitle,
    getContributionDescription,
    getDefaultDescription,
    getSuccessMessage,
    getMemberName,
    renderMemberAvatar,
  } = screen;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={{ flex: 1 }}>
            <Card style={styles.chamaInfoCard} variant="outlined">
              <View style={styles.chamaInfo}>
                <View style={[styles.chamaIcon, { backgroundColor: getContributionColor() }]}>
                  <Ionicons
                    name={getContributionIcon()}
                    size={24}
                    color={colors.white}
                  />
                </View>
                <View style={styles.chamaDetails}>
                  <Text style={[styles.chamaName, { color: colors.text }]}>
                    {contributionType === 'merry-go-round'
                      ? roundName
                      : contributionType === 'welfare' && proposalTitle
                        ? proposalTitle
                        : chama?.name}
                  </Text>
                  <Text style={[styles.chamaType, { color: colors.textSecondary }]}>
                    {contributionType === 'merry-go-round'
                      ? `Merry-Go-Round • ${chama?.name || 'Group'}`
                      : contributionType === 'welfare' && proposalTitle
                        ? `Welfare Support • ${chama?.name || 'Group'}`
                        : contributionType === 'regular'
                           ? `${chama?.type || 'Community'} • ${chama?.contribution_frequency || 'regular'} contributions`
                          : `${getContributionTitle()} • ${chama?.name || 'Group'}`}
                  </Text>
                  <Text style={[styles.chamaAmount, { color: getContributionColor() }]}>
                    {contributionType === 'regular'
                       ? `Regular: ${amount ? formatCurrency(parseFloat(amount)) : formatCurrency(chama?.contribution_amount || 0)}`
                      : contributionType === 'welfare' && requestedAmount
                        ? `Needed: ${formatCurrency(requestedAmount)}`
                        : contributionType === 'merry-go-round' && amount
                          ? `Contributing: ${formatCurrency(parseFloat(amount))}`
                          : amount
                            ? `Amount: ${formatCurrency(parseFloat(amount))}`
                            : getContributionTitle()}
                  </Text>
                </View>
              </View>
            </Card>

            {contributionType === 'merry-go-round' && currentRecipient && (
              <CurrentRecipientInfo
                currentRecipient={currentRecipient}
                contributionStatus={contributionStatus}
                formatCurrency={formatCurrency}
              />
            )}

            <Card style={styles.formCard} variant="outlined">
              <Text style={[styles.formTitle, { color: colors.text }]}>
                Choose What to Pay
              </Text>

              <ContributionTypeSelector
                contributionType={contributionType}
                selectedMerryGoRound={selectedMerryGoRound}
                selectedWelfare={selectedWelfare}
                merryGoRounds={merryGoRounds}
                welfareContributions={welfareContributions}
                loadingContributionOptions={loadingContributionOptions}
                showContributionTypeDropdown={showContributionTypeDropdown}
                showMerryGoRoundDropdown={showMerryGoRoundDropdown}
                showWelfareDropdown={showWelfareDropdown}
                onContributionTypeChange={handleContributionTypeChange}
                onMerryGoRoundSelect={handleMerryGoRoundSelect}
                onWelfareSelect={handleWelfareSelect}
                onToggleContributionType={() =>
                  setShowContributionTypeDropdown(!showContributionTypeDropdown)
                }
                onToggleMerryGoRound={() =>
                  setShowMerryGoRoundDropdown(!showMerryGoRoundDropdown)
                }
                onToggleWelfare={() =>
                  setShowWelfareDropdown(!showWelfareDropdown)
                }
                formatCurrency={formatCurrency}
                availableContributionTypes={availableContributionTypes}
              />

              <PaymentMethodSelector
                paymentMethod={paymentMethod}
                walletBalance={walletBalance}
                amount={amount}
                setPaymentMethod={setPaymentMethod}
                formatCurrency={formatCurrency}
                availablePaymentMethods={availablePaymentMethods}
              />

              {paymentMethod === 'pay_for' && (
                <MemberListingSection
                  chamaMembers={chamaMembers}
                  selectedContributor={selectedContributor}
                  memberSearchQuery={memberSearchQuery}
                  setMemberSearchQuery={setMemberSearchQuery}
                  contributionType={contributionType}
                  roundName={roundName}
                  setSelectedContributor={setSelectedContributor}
                  getMemberName={getMemberName}
                  renderMemberAvatar={renderMemberAvatar}
                  validateMemberSelection={validateMemberSelection}
                />
              )}

              {paymentMethod === 'mpesa' && (
                <PhoneNumberDisplay user={screen.user} />
              )}

              {paymentMethod === 'pay_for' && (
                <View style={styles.cashContributionContainer}>
                  <View style={[styles.cashNotice, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
                    <Ionicons name="information-circle" size={20} color={colors.warning} />
                    <Text style={[styles.cashNoticeText, { color: colors.text }]}>
                      You are paying for a member. The amount will be deducted from your VaultKe wallet and the selected member's records will be updated.
                    </Text>
                  </View>
                </View>
              )}

              <Input
                label="Amount (KES)"
                value={amount}
                onChangeText={
                  contributionType === 'merry-go-round'
                    ? undefined
                    : screen.setAmount
                }
                placeholder={
                  contributionType === 'merry-go-round'
                    ? selectedMerryGoRound
                      ? "Amount set automatically from cycle"
                      : "Select a merry-go-round cycle first"
                    : contributionType === 'welfare' && selectedWelfare
                      ? "Amount from selected welfare"
                      : "Enter contribution amount"
                }
                keyboardType="numeric"
                leftIcon="wallet"
                editable={contributionType !== 'merry-go-round'}
                style={contributionType === 'merry-go-round' ? { backgroundColor: colors.surface + '80' } : undefined}
              />

              {paymentMethod === 'wallet' && amount && (
                <ValidationMessage
                  amount={amount}
                  walletBalance={walletBalance}
                  formatCurrency={formatCurrency}
                />
              )}

              <Input
                label="Description (Optional)"
                value={description}
                onChangeText={screen.setDescription}
                placeholder="Add a note for this contribution..."
                multiline
                numberOfLines={3}
                leftIcon="document-text"
              />

              {chama?.category === 'contribution' && contributionType !== 'merry-go-round' && (
                <AnonymousContribution
                  isAnonymous={isAnonymous}
                  setIsAnonymous={setIsAnonymous}
                />
              )}

              {contributionType === 'merry-go-round' && (
                <MerryGoRoundRules
                  contributionStatus={contributionStatus}
                  currentRecipient={currentRecipient}
                  amountPerRound={amountPerRound}
                />
              )}

              <View style={styles.summaryContainer}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                    Contribution Amount:
                  </Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>
                    {amount ? formatCurrency(parseFloat(amount)) : formatCurrency(0)}
                  </Text>
                </View>
              </View>

              <Button
                title={
                  contributionType === 'merry-go-round' && contributionStatus?.hasContributed && paymentMethod !== 'pay_for'
                    ? "You have already contributed!"
                    : contributionType === 'merry-go-round'
                      ? !selectedMerryGoRound
                        ? "Select a merry-go-round cycle first"
                        : amount && amount !== '0'
                          ? `Contribute ${formatCurrency(parseFloat(amount))}`
                          : "Loading Contribution Details..."
                      : contributionType === 'welfare' && !selectedWelfare
                        ? "Select a welfare contribution first"
                        : "Make Contribution"
                }
                onPress={handleContribute}
                loading={loading}
                disabled={
                  !amount ||
                  parseFloat(amount) <= 0 ||
                  (paymentMethod === 'pay_for' && !selectedContributor) ||
                  (contributionType === 'merry-go-round' && contributionStatus?.hasContributed && paymentMethod !== 'pay_for') ||
                  (contributionType === 'merry-go-round' && !selectedMerryGoRound) ||
                  (contributionType === 'welfare' && !selectedWelfare)
                }
                variant="outline"
                style={styles.contributeButton}
                icon={
                  <Ionicons
                    name={
                      contributionType === 'merry-go-round' && contributionStatus?.hasContributed && paymentMethod !== 'pay_for'
                        ? "checkmark-circle"
                        : contributionType === 'merry-go-round' && !selectedMerryGoRound
                          ? "time"
                          : contributionType === 'welfare' && !selectedWelfare
                            ? "time"
                            : "add-circle"
                    }
                    size={20}
                    color={
                      !amount || parseFloat(amount) <= 0 ||
                      (contributionType === 'merry-go-round' && contributionStatus?.hasContributed && paymentMethod !== 'pay_for') ||
                      (contributionType === 'merry-go-round' && !selectedMerryGoRound) ||
                      (contributionType === 'welfare' && !selectedWelfare)
                        ? colors.textSecondary
                        : colors.primary
                    }
                  />
                }
              />
            </Card>
          </View>
        </ScrollView>

        <PageRefreshButton onRefresh={onRefresh} refreshing={refreshing} color={colors.primary} bottom={64} />
      </View>

      <PaymentConfirmationModal
        visible={showPaymentModal}
        onClose={() => screen.setShowPaymentModal(false)}
        amount={amount}
        paymentMethod={paymentMethod}
        walletBalance={walletBalance}
        selectedContributor={selectedContributor}
        chama={chama}
        user={screen.user}
        loading={loading}
        onConfirm={confirmContribution}
        formatCurrency={formatCurrency}
      />
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
  chamaInfoCard: {
    margin: spacing.sm,
  },
  chamaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chamaIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  chamaDetails: {
    flex: 1,
  },
  chamaName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  chamaType: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  chamaAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  formCard: {
    margin: spacing.sm,
  },
  formTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.lg,
  },
  summaryContainer: {
    marginVertical: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: typography.fontSize.base,
  },
  summaryValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  contributeButton: {
    marginTop: spacing.lg,
    minHeight: 50,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    ...shadows.sm,
  },
  paymentMethodSubtext: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  cashContributionContainer: {
    marginBottom: spacing.lg,
  },
  cashNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  cashNoticeText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
});

export default ContributeScreen;
