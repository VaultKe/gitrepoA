/**
 * Contribution type metadata and description helpers.
 * Pure config/data — no component state or side effects.
 */

export const CONTRIBUTION_TYPES = {
  'merry-go-round': {
    title: 'Merry-Go-Round Contribution',
    icon: 'refresh-circle',
    colorKey: 'warning',
    subtitle: (params) => `Note that you're contributing to ${params.roundName || 'Merry-Go-Round'}`,
    description: (params) => `Merry-Go-Round contribution to ${params.selectedMerryGoRound?.name || params.roundName || 'round'}`,
    defaultDescription: (params) => `Merry-Go-Round contribution to ${params.selectedMerryGoRound?.name || params.roundName || 'round'}`,
  },
  welfare: {
    title: 'Welfare Contribution',
    icon: 'heart',
    colorKey: 'welfare',
    subtitle: (params) => params.proposalTitle
      ? `Support: ${params.proposalTitle}`
      : `Welfare fund for ${params.chamaName || 'group'}`,
    description: (params) => params.selectedWelfare?.title
      ? `Welfare support for: ${params.selectedWelfare.title}`
      : params.proposalTitle
        ? `Welfare support for: ${params.proposalTitle}`
        : `Welfare contribution to ${params.chamaName}`,
    defaultDescription: (params) => params.selectedWelfare?.title || params.proposalTitle
      ? `Welfare support for: ${params.selectedWelfare?.title || params.proposalTitle}`
      : `Welfare contribution to ${params.chamaName}`,
  },
  savings: {
    title: 'Savings Contribution',
    icon: 'wallet',
    colorKey: 'success',
    subtitle: () => `Save to your chama savings subwallet`,
    description: (params) => `Savings contribution to ${params.chamaName}`,
    defaultDescription: (params) => `Savings contribution to ${params.chamaName}`,
  },
  loan: {
    title: 'Loan Contribution',
    icon: 'card',
    colorKey: 'loan',
    subtitle: (params) => `Loan fund for ${params.chamaName || 'group'}`,
    description: (params) => `Loan contribution to ${params.chamaName}`,
    defaultDescription: () => `Loan contribution`,
  },
  emergency: {
    title: 'Emergency Contribution',
    icon: 'warning',
    colorKey: 'error',
    subtitle: (params) => `Emergency fund for ${params.chamaName || 'group'}`,
    description: (params) => `Emergency contribution to ${params.chamaName}`,
    defaultDescription: () => `Emergency contribution`,
  },
  regular: {
    title: 'Make Contribution',
    icon: 'people',
    colorKey: 'primary',
    subtitle: (params) => `Note that you're contributing to ${params.chamaName || 'Loading...'}`,
    description: (params) => `${params.contributionType?.charAt(0).toUpperCase() || 'R'}egular contribution to ${params.chamaName}`,
    defaultDescription: (params) => `${params.paymentMethod?.charAt(0).toUpperCase() || 'P'}ayment contribution to ${params.chamaName}`,
  },
};

export const getContributionColor = (type, colors) => {
  const colorMap = {
    'merry-go-round': colors.warning,
    welfare: '#EC4899',
    savings: colors.success,
    loan: '#6366F1',
    emergency: colors.error,
  };
  return colorMap[type] || colors.primary;
};

export const getContributionTitle = (type) => CONTRIBUTION_TYPES[type]?.title || CONTRIBUTION_TYPES['regular'].title;

export const getContributionIcon = (type) => CONTRIBUTION_TYPES[type]?.icon || CONTRIBUTION_TYPES['regular'].icon;

export const getContributionSubtitle = (type, params = {}) => CONTRIBUTION_TYPES[type]?.subtitle(params) || CONTRIBUTION_TYPES['regular'].subtitle(params);

export const getContributionDescription = (type, params = {}) => CONTRIBUTION_TYPES[type]?.description(params) || '';

export const getDefaultDescription = (type, params = {}) => CONTRIBUTION_TYPES[type]?.defaultDescription(params) || '';

export const getSuccessMessage = (type, amountText, chamaName, isAnonymous, extra = {}) => {
  const { selectedMerryGoRound, roundName } = extra;
  let baseMessage;
  switch (type) {
    case 'merry-go-round':
      baseMessage = `You have successfully contributed KES ${amountText} to ${selectedMerryGoRound?.name || roundName || 'the merry-go-round'} from your VaultKe wallet.`;
      break;
    case 'welfare':
      baseMessage = `You have successfully contributed ${amountText} from your VaultKe wallet to the welfare fund.`;
      break;
    case 'savings':
      baseMessage = `You have successfully contributed ${amountText} from your VaultKe wallet to ${chamaName} savings.`;
      break;
    default:
      baseMessage = `You have successfully contributed KES ${amountText} from your VaultKe wallet to ${chamaName}.`;
  }
  if (isAnonymous) {
    baseMessage += '\n\nThis contribution was made anonymously and will appear as "Anonymous" in records.';
  }
  return baseMessage;
};
