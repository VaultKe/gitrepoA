import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  TextInput,
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
// Member listing rendered inline using guarantor card design
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
    loadChamaMembers,
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

              <Card variant="outlined" style={{ marginBottom: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.info + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
                    <Ionicons name="people" size={20} color={colors.info} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Select Member</Text>
                </View>

                <View style={{ marginBottom: spacing.md }}>
                  <View style={[styles.searchInputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Ionicons name="search" size={18} color={colors.textSecondary} />
                    <TextInput
                      style={[styles.searchInput, { color: colors.text }]}
                      placeholder="Search members..."
                      placeholderTextColor={colors.textSecondary}
                      value={memberSearchQuery}
                      onChangeText={setMemberSearchQuery}
                    />
                    {memberSearchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setMemberSearchQuery('')}>
                        <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <FlatList
                    data={(() => {
                      try {
                        const { isMemberVisible } = require('../../../utils/chamaMembersUtils');
                        return (chamaMembers || []).filter((m) => isMemberVisible(m)).filter((m) => {
                          const fullName = (m.first_name || m.user?.first_name || '') + ' ' + (m.last_name || m.user?.last_name || '');
                          const search = memberSearchQuery ? memberSearchQuery.toLowerCase() : '';
                          const matchesSearch = !search || fullName.toLowerCase().includes(search) || (m.email || m.user?.email || '').toLowerCase().includes(search);
                          return matchesSearch;
                        });
                      } catch (e) {
                        return (chamaMembers || []).filter((m) => {
                          const isActive = m.is_active !== false;
                          const status = (m.status || m.user?.status || '').toLowerCase();
                          const notLeft = status !== 'left';
                          const fullName = (m.first_name || m.user?.first_name || '') + ' ' + (m.last_name || m.user?.last_name || '');
                          const search = memberSearchQuery ? memberSearchQuery.toLowerCase() : '';
                          const matchesSearch = !search || fullName.toLowerCase().includes(search) || (m.email || '').toLowerCase().includes(search);
                          return isActive && notLeft && matchesSearch;
                        });
                      }
                    })()}
                    keyExtractor={(item, index) => (item.id ? String(item.id) : index.toString())}
                    style={{ maxHeight: 300 }}
                    nestedScrollEnabled
                    renderItem={({ item }) => {
                      const isSelected = selectedContributor?.id === item.id || selectedContributor?.user_id === item.user_id;
                      return (
                        <TouchableOpacity
                          style={[styles.guarantorCard, { backgroundColor: isSelected ? colors.primary + '20' : colors.background, borderColor: isSelected ? colors.primary : colors.border }]}
                          onPress={() => {
                            if (validateMemberSelection(item)) {
                              setSelectedContributor(item);
                            }
                          }}
                          disabled={isSelected}
                        >
                          <View style={styles.guarantorCardContent}>
                            <View style={[styles.avatar, { backgroundColor: colors.white }]}>
                              {renderMemberAvatar(item)}
                            </View>
                            <View style={styles.guarantorDetails}>
                              <Text style={[styles.guarantorName, { color: isSelected ? colors.primary : colors.text, fontWeight: typography.fontWeight.semibold }]}>
                                {getMemberName(item)}
                              </Text>
                              <Text style={[styles.guarantorEmail, { color: isSelected ? colors.primary : colors.textSecondary }]}>
                                {item.email || item.user?.email || 'No email'}
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
                          {memberSearchQuery ? 'No members match your search' : 'No available members'}
                        </Text>
                        {paymentMethod === 'pay_for' && (
                          <TouchableOpacity
                            style={[styles.loadMembersButton, { borderColor: colors.primary, marginTop: spacing.md }]}
                            onPress={() => loadChamaMembers()}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.loadMembersButtonText, { color: colors.primary }]}>Load members</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    }
                  />
                </View>
              </Card>

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
  sectionTitle: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, marginLeft: spacing.sm },
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, height: 44, borderRadius: borderRadius.md, gap: spacing.sm, marginBottom: spacing.sm },
  searchInput: { flex: 1, fontSize: typography.fontSize.sm },
  guarantorCard: { borderRadius: borderRadius.md, borderWidth: 1, marginBottom: spacing.sm },
  guarantorCardContent: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, gap: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  guarantorDetails: { flex: 1 },
  guarantorName: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold },
  guarantorEmail: { fontSize: typography.fontSize.xs },
  loadMembersButton: { marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: borderRadius.md, borderWidth: 1 },
  loadMembersButtonText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold },
});

export default ContributeScreen;
