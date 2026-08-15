/**
 * M-Pesa contribution handler.
 *
 * Performs the API call for M-Pesa-based contributions.
 * Returns the raw API response plus derived metadata.
 * Caller handles alerts, state updates, and navigation.
 */

import ApiService from '../../services/api';

export const handleMpesaContribution = async ({
  chamaId,
  amount,
  description,
  contributionType,
  selectedWelfare,
  proposalId,
  selectedMerryGoRound,
  user,
  getDefaultDescription,
}) => {
  // Welfare contributions use the welfare endpoint
  if (contributionType === 'welfare') {
    const welfareData = {
      welfareRequestId: selectedWelfare?.id || proposalId,
      amount: parseFloat(amount),
      message: description || getDefaultDescription(),
      chamaId,
    };

    const mpesaResponse = await ApiService.contributeToWelfare(welfareData);

    if (mpesaResponse.success) {
      return {
        ok: true,
        type: 'welfare',
        data: mpesaResponse.data,
      };
    }

    throw new Error(mpesaResponse.error || 'Welfare contribution failed');
  }

  // Standard M-Pesa STK push for all other types
  let formattedPhone = user.phone.replace(/\s+/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '254' + formattedPhone.substring(1);
  } else if (formattedPhone.startsWith('+254')) {
    formattedPhone = formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('254')) {
    formattedPhone = '254' + formattedPhone;
  }

  const accountReference = `CHAMA-${chamaId.substring(0, 8)}`;
  const transactionDesc = description || getDefaultDescription();

  const mpesaResponse = await ApiService.makeContribution({
    chamaId,
    amount: parseFloat(amount),
    description: transactionDesc,
    type: contributionType,
    paymentMethod: 'mpesa',
    mpesaReference: accountReference,
    status: 'pending',
    ...(selectedMerryGoRound ? { roundId: selectedMerryGoRound.id } : {}),
    ...(selectedWelfare ? { proposalId: selectedWelfare.id } : {}),
  });

  if (!mpesaResponse.success) {
    throw new Error(mpesaResponse.error || 'Failed to initiate M-Pesa payment');
  }

  return {
    ok: true,
    type: 'stk-push',
    data: mpesaResponse.data,
    formattedPhone,
    accountReference,
  };
};
