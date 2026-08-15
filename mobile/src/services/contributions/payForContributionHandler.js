/**
 * Pay-for-someone contribution handler.
 *
 * Performs the API call when a treasurer pays on behalf of a member.
 * Returns the raw API response plus derived metadata.
 * Caller handles state updates, toasts, alerts, and navigation.
 */

import ApiService from '../../services/api';

export const handlePayForContribution = async ({
  chamaId,
  amount,
  description,
  contributionType,
  selectedContributor,
  user,
  selectedMerryGoRound,
  selectedWelfare,
  getContributionDescription,
}) => {
  if (!selectedContributor) {
    throw new Error('Please select the member you want to pay for');
  }

  const contributionAmount = parseFloat(amount);

  const validContributionType = (() => {
    const validTypes = ['regular', 'penalty', 'special', 'merry-go-round', 'welfare'];
    return validTypes.includes(contributionType) ? contributionType : 'regular';
  })();

  const contributionData = {
    chamaId,
    amount: contributionAmount,
    description: description || getContributionDescription(),
    type: validContributionType,
    paymentMethod: 'pay_for',
    contributorId: selectedContributor.id,
    paidForBy: user.id,
    isAnonymous: false,
    ...(selectedMerryGoRound ? { roundId: selectedMerryGoRound.id } : {}),
    ...(selectedWelfare ? { proposalId: selectedWelfare.id } : {}),
  };

  const response = await ApiService.makeRequest('/contributions', {
    method: 'POST',
    body: JSON.stringify(contributionData),
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to record payment for someone');
  }

  const contributorName = selectedContributor.fullName ||
    selectedContributor.first_name ||
    selectedContributor.name ||
    'member';

  return {
    ok: true,
    contributorName,
    contributionAmount,
    data: response.data,
  };
};
