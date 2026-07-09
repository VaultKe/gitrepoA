import { useState } from 'react';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import { useApp } from '../../../../context/AppContext';
import { getThemeColors } from '../../../../utils/theme';
import ApiService from '../../../../services/api';

// Custom hook for contribution helper functions
const useContributionHelpers = () => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const { user } = useApp();

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getContributionTitle = (contributionType) => {
    switch (contributionType) {
      case 'merry-go-round':
        return 'Merry-Go-Round Contribution';
      case 'welfare':
        return 'Welfare Contribution';
      case 'savings':
        return 'Savings Contribution';
      case 'loan':
        return 'Loan Contribution';
      case 'emergency':
        return 'Emergency Contribution';
      default:
        return 'Make Contribution';
    }
  };

  const getContributionSubtitle = (contributionType, chama, roundName, proposalTitle) => {
    switch (contributionType) {
      case 'merry-go-round':
        return `Note that you're contributing to ${roundName || 'Merry-Go-Round'}`;
      case 'welfare':
        return proposalTitle
          ? `Support: ${proposalTitle}`
          : `Welfare fund for ${chama?.name || 'group'}`;
      case 'savings':
        return `Save to your chama savings subwallet`;
      case 'loan':
        return `Loan fund for ${chama?.name || 'group'}`;
      case 'emergency':
        return `Emergency fund for ${chama?.name || 'group'}`;
      default:
        return `Note that you're contributing to ${chama?.name || 'Loading...'}`;
    }
  };

  const getContributionIcon = (contributionType) => {
    switch (contributionType) {
      case 'merry-go-round':
        return 'refresh-circle';
      case 'welfare':
        return 'heart';
      case 'savings':
        return 'wallet';
      case 'loan':
        return 'card';
      case 'emergency':
        return 'warning';
      default:
        return 'people';
    }
  };

  const getContributionColor = (contributionType, colors) => {
    switch (contributionType) {
      case 'merry-go-round':
        return colors.warning;
      case 'welfare':
        return '#EC4899';
      case 'savings':
        return colors.success;
      case 'loan':
        return '#6366F1';
      case 'emergency':
        return colors.error;
      default:
        return colors.primary;
    }
  };

  const getContributionDescription = (contributionType, selectedMerryGoRound, roundName, selectedWelfare, proposalTitle, chama) => {
    switch (contributionType) {
      case 'merry-go-round':
        return `Merry-Go-Round contribution to ${selectedMerryGoRound?.name || roundName || 'round'}`;
      case 'welfare':
        return selectedWelfare?.title
          ? `Welfare support for: ${selectedWelfare.title}`
          : proposalTitle
            ? `Welfare support for: ${proposalTitle}`
            : `Welfare contribution to ${chama?.name}`;
      case 'savings':
        return `Savings contribution to ${chama?.name}`;
      default:
        return `${contributionType.charAt(0).toUpperCase() + contributionType.slice(1)} contribution to ${chama?.name}`;
    }
  };

  const getSuccessMessage = (contributionType, amount, chama, selectedMerryGoRound, roundName, isAnonymous) => {
    const amountText = formatCurrency(parseFloat(amount));
    const chamaName = chama?.name || 'the group';
    let baseMessage;
    switch (contributionType) {
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

  const getDefaultDescription = (contributionType, selectedMerryGoRound, roundName, selectedWelfare, proposalTitle, chama) => {
    switch (contributionType) {
      case 'merry-go-round':
        return `Merry-Go-Round contribution to ${selectedMerryGoRound?.name || roundName || 'round'}`;
      case 'welfare':
        return selectedWelfare?.title || proposalTitle
          ? `Welfare support for: ${selectedWelfare?.title || proposalTitle}`
          : `Welfare contribution to ${chama?.name}`;
      default:
        return `Contribution to ${chama?.name}`;
    }
  };

  return {
    formatCurrency,
    getContributionTitle,
    getContributionSubtitle,
    getContributionIcon,
    getContributionColor,
    getContributionDescription,
    getSuccessMessage,
    getDefaultDescription,
  };
};

export default useContributionHelpers;