/**
 * Contribution validation utilities.
 *
 * Each validator returns an object:
 *   { valid: boolean, errorKey?: string, alert?: { title, message } }
 *
 * The caller can use `errorKey` for inline messages and `alert` for modal warnings.
 */

export const validateMemberSelection = ({ member, chamaMembers, contributionType, roundName, getMemberName }) => {
  if (contributionType !== 'merry-go-round') {
    return { valid: true };
  }

  const isParticipant = chamaMembers.some(m => m.id === member.id || m.user_id === member.id);
  if (!isParticipant) {
    return {
      valid: false,
      errorKey: 'invalid_member',
      alert: {
        title: 'Invalid Selection',
        message: `${getMemberName(member)} is not a participant in ${roundName || 'this merry-go-round'} circle.`,
      },
    };
  }

  return { valid: true };
};

export const validatePaymentMethod = ({ method, contributionType, isAnonymous }) => {
  if (contributionType === 'merry-go-round') {
    if (isAnonymous) {
      return {
        valid: false,
        errorKey: 'anonymous_not_allowed',
        alert: {
          title: 'Anonymous Contributions Not Allowed',
          message: 'Anonymous contributions are not allowed for merry-go-round. All contributions must be traceable to maintain fairness.',
        },
      };
    }

    const validMethods = ['wallet', 'mpesa', 'pay_for'];
    if (!validMethods.includes(method)) {
      return {
        valid: false,
        errorKey: 'invalid_method',
        alert: {
          title: 'Invalid Payment Method',
          message: 'Only wallet, M-Pesa, and pay for someone payments are permitted.',
        },
      };
    }
  }

  if (contributionType === 'savings' && method !== 'wallet') {
    return {
      valid: false,
      errorKey: 'savings_wallet_only',
      alert: {
        title: 'Invalid Payment Method',
        message: 'Only wallet payments are allowed for savings contributions. Please use your VaultKe wallet.',
      },
    };
  }

  return { valid: true };
};

export const validateContributionAmount = ({ amount, contributionType, selectedMerryGoRound, contributionStatus, currentRecipient, amountPerRound }) => {
  if (contributionType !== 'merry-go-round') {
    return { valid: true };
  }

  const expectedAmount = selectedMerryGoRound?.amountPerRound ||
    selectedMerryGoRound?.amount ||
    contributionStatus?.amountPerRound ||
    currentRecipient?.amountPerRound ||
    amountPerRound || 0;

  if (expectedAmount > 0) {
    const inputAmount = parseFloat(amount);
    if (inputAmount !== expectedAmount) {
      return {
        valid: false,
        errorKey: 'amount_mismatch',
        alert: {
          title: 'Invalid Amount',
          message: `Merry-go-round contributions must be exactly ${expectedAmount} KES. You cannot contribute more or less than the required amount.`,
        },
      };
    }
  }

  return { valid: true };
};

export const validateWalletBalance = ({ paymentMethod, walletBalance, amount, contributionType, formatCurrency, navigation }) => {
  if (paymentMethod !== 'wallet') {
    return { valid: true };
  }

  const contributionAmount = parseFloat(amount);

  if (walletBalance <= 0) {
    return {
      valid: false,
      errorKey: 'no_balance',
      alert: {
        title: 'No Wallet Balance',
        message: `Your VaultKe wallet balance is KES 0.00. Please deposit money into your wallet before making a contribution.`,
        buttons: [
          { text: 'Deposit Now', onPress: () => navigation.navigate('WalletScreen', { tab: 'deposit' }) },
          { text: 'Cancel', style: 'cancel' },
        ],
      },
    };
  }

  if (contributionAmount > walletBalance) {
    const shortfall = contributionAmount - walletBalance;
    const isMerryGoRound = contributionType === 'merry-go-round';

    return {
      valid: false,
      errorKey: 'insufficient_balance',
      alert: {
        title: 'Insufficient Wallet Balance',
        message: isMerryGoRound
          ? `Your VaultKe wallet balance is KES ${formatCurrency(walletBalance)}.\n\nYou need KES ${formatCurrency(shortfall)} more to make this merry-go-round contribution of KES ${formatCurrency(contributionAmount)}.\n\nMerry-go-round contributions require the exact amount and cannot be reduced.`
          : `Your VaultKe wallet balance is KES ${formatCurrency(walletBalance)}.\n\nYou need KES ${formatCurrency(shortfall)} more to make this contribution.\n\nWould you like to deposit money or reduce the contribution amount?`,
        buttons: isMerryGoRound
          ? [
              { text: 'Deposit Money', onPress: () => navigation.navigate('WalletScreen', { tab: 'deposit' }) },
              { text: 'Cancel', style: 'cancel' },
            ]
          : [
              { text: 'Deposit Money', onPress: () => navigation.navigate('WalletScreen', { tab: 'deposit' }) },
              { text: 'Reduce Amount', onPress: () => {} },
              { text: 'Cancel', style: 'cancel' },
            ],
      },
    };
  }

  return { valid: true };
};

export const validateMpesaPhone = ({ paymentMethod, user }) => {
  if (paymentMethod !== 'mpesa') {
    return { valid: true };
  }

  if (!user?.phone || user.phone.length < 10) {
    return {
      valid: false,
      errorKey: 'phone_required',
      alert: {
        title: 'Phone Number Required',
        message: 'Your account does not have a valid phone number. Please update your profile to use M-Pesa payments.',
      },
    };
  }

  return { valid: true };
};

export const validatePayForMember = ({ paymentMethod, selectedContributor }) => {
  if (paymentMethod !== 'pay_for') {
    return { valid: true };
  }

  if (!selectedContributor) {
    return {
      valid: false,
      errorKey: 'member_required',
      alert: {
        title: 'Member Required',
        message: 'Please select the member you want to pay for.',
      },
    };
  }

  return { valid: true };
};
