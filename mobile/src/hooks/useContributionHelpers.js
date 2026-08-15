import { useState } from 'react';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import { useApp } from '../context/AppContext';
import { getThemeColors } from '../utils/theme';
import ApiService from '../services/api';
import {
  getContributionTitle as getContributionTitleConfig,
  getContributionIcon as getContributionIconConfig,
  getContributionColor as getContributionColorConfig,
  getContributionSubtitle as getContributionSubtitleConfig,
  getContributionDescription as getContributionDescriptionConfig,
  getDefaultDescription as getDefaultDescriptionConfig,
  getSuccessMessage as getSuccessMessageConfig,
  CONTRIBUTION_TYPES,
} from '../config/contributionConfig';

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

  const getContributionTitle = (contributionType) =>
    getContributionTitleConfig(contributionType);

  const getContributionIcon = (contributionType) =>
    getContributionIconConfig(contributionType);

  const getContributionColor = (contributionType) =>
    getContributionColorConfig(contributionType, colors);

  const getContributionSubtitle = (contributionType, params = {}) =>
    getContributionSubtitleConfig(contributionType, params);

  const getContributionDescription = (contributionType, params = {}) =>
    getContributionDescriptionConfig(contributionType, params);

  const getDefaultDescription = (contributionType, params = {}) =>
    getDefaultDescriptionConfig(contributionType, params);

  const getSuccessMessage = (contributionType, amountText, chamaName, isAnonymous, extra = {}) =>
    getSuccessMessageConfig(contributionType, amountText, chamaName, isAnonymous, extra);

  return {
    formatCurrency,
    getContributionTitle,
    getContributionSubtitle,
    getContributionIcon,
    getContributionColor,
    getContributionDescription,
    getSuccessMessage,
    getDefaultDescription,
    colors,
    user,
  };
};

export default useContributionHelpers;
