/**
 * Wallet contribution handler.
 *
 * Performs the API call for wallet-based contributions.
 * Returns the raw API response plus derived metadata.
 * Caller handles state updates, toasts, and navigation.
 */

import ApiService from '../../services/api';

export const handleWalletContribution = async ({
  chamaId,
  amount,
  description,
  contributionType,
  chama,
  isAnonymous,
  selectedMerryGoRound,
  selectedWelfare,
  getContributionDescription,
}) => {
  // Savings contributions use the subwallet endpoint
  if (contributionType === 'savings') {
    const response = await ApiService.contributeToSavings(
      chamaId,
      parseFloat(amount),
      description || getContributionDescription()
    );
    if (response.success) {
      return {
        ok: true,
        type: 'savings',
        backendBalance: response.data?.senderBalanceAfter,
      };
    }
    throw new Error(response.error || 'Savings contribution failed');
  }

  const validContributionType = (() => {
    const validTypes = ['regular', 'penalty', 'special', 'merry-go-round', 'welfare'];
    return validTypes.includes(contributionType) ? contributionType : 'regular';
  })();

  const contributionData = {
    chamaId,
    amount: parseFloat(amount),
    description: description || getContributionDescription(),
    type: validContributionType,
    paymentMethod: 'wallet',
    isAnonymous: chama?.category === 'contribution' ? isAnonymous : false,
    ...(selectedMerryGoRound ? { roundId: selectedMerryGoRound.id } : {}),
    ...(selectedWelfare ? { proposalId: selectedWelfare.id } : {}),
  };

  const response = await ApiService.makeRequest('/contributions', {
    method: 'POST',
    body: JSON.stringify(contributionData),
  });

  if (!response.success) {
    throw new Error(response.error || 'Wallet contribution failed');
  }

  return {
    ok: true,
    type: 'standard',
    data: response.data,
  };
};
