import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useApp } from '../context/AppContext';
import ApiService from '../services/api';
import {
  handleWalletContribution as handleWalletContributionHandler,
} from '../services/contributions/walletContributionHandler';
import {
  handleMpesaContribution as handleMpesaContributionHandler,
} from '../services/contributions/mpesaContributionHandler';
import {
  handlePayForContribution as handlePayForContributionHandler,
} from '../services/contributions/payForContributionHandler';
import {
  validatePaymentMethod,
  validateContributionAmount,
  validateWalletBalance,
  validateMpesaPhone,
  validatePayForMember,
} from '../utils/contributionValidation';
import useContributionHelpers from './useContributionHelpers';
import useMemberHelpers from './useMemberHelpers';

const useContributionScreen = ({ route, navigation }) => {
  const { theme, user, refreshSpecificData } = useApp();

  // Extract all parameters - handle both direct chamaId and nested params
  const rawChamaId = route.params?.chamaId || route.params?.id;
  const chamaId =
    typeof rawChamaId === 'string'
      ? rawChamaId
      : rawChamaId?.chamaId || rawChamaId?.id;
  const initialContributionType = route.params?.contributionType || 'regular';
  const roundId = route.params?.roundId;
  const roundName = route.params?.roundName;
  const proposalId = route.params?.proposalId;
  const proposalTitle = route.params?.proposalTitle;
  const requestedAmount = route.params?.requestedAmount;
  const amountPerRound = route.params?.amountPerRound;

  const helpers = useContributionHelpers();
  const {
    formatCurrency,
    getContributionTitle,
    getContributionIcon,
    getContributionColor,
    getContributionSubtitle,
    getContributionDescription,
    getDefaultDescription,
    getSuccessMessage,
  } = helpers;

  const memberHelpers = useMemberHelpers();
  const {
    failedAvatars,
    setFailedAvatars,
    getMemberName,
    renderMemberAvatar,
  } = memberHelpers;

  const [chama, setChama] = useState(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('wallet');
  const [walletBalance, setWalletBalance] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState([
    'wallet',
    'mpesa',
    'pay_for',
  ]);
  const [availableContributionTypes, setAvailableContributionTypes] = useState([
    'regular',
    'merry-go-round',
    'welfare',
    'savings',
  ]);

  // Reset payment method if it's no longer allowed by the chama
  useEffect(() => {
    if (!availablePaymentMethods.includes(paymentMethod)) {
      const preferred = availablePaymentMethods.includes('wallet')
        ? 'wallet'
        : availablePaymentMethods[0];
      setPaymentMethod(preferred);
    }
  }, [availablePaymentMethods]);

  const [contributionType, setContributionType] = useState(
    initialContributionType
  );
  const [showContributionTypeDropdown, setShowContributionTypeDropdown] =
    useState(false);
  const [merryGoRounds, setMerryGoRounds] = useState([]);
  const [selectedMerryGoRound, setSelectedMerryGoRound] = useState(null);
  const [showMerryGoRoundDropdown, setShowMerryGoRoundDropdown] = useState(false);
  const [welfareContributions, setWelfareContributions] = useState([]);
  const [selectedWelfare, setSelectedWelfare] = useState(null);
  const [showWelfareDropdown, setShowWelfareDropdown] = useState(false);
  const [loadingContributionOptions, setLoadingContributionOptions] =
    useState(false);

  // Reset contribution type if it's no longer allowed by the chama
  useEffect(() => {
    if (!availableContributionTypes.includes(contributionType)) {
      const preferred = availableContributionTypes.includes('regular')
        ? 'regular'
        : availableContributionTypes[0];
      setContributionType(preferred);
      setSelectedMerryGoRound(null);
      setSelectedWelfare(null);
      setAmount('');
    }
  }, [availableContributionTypes]);

  // Pay for someone contribution specific states
  const [chamaMembers, setChamaMembers] = useState([]);
  const [selectedContributor, setSelectedContributor] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [currentRecipient, setCurrentRecipient] = useState(null);
  const [contributionStatus, setContributionStatus] = useState(null);
  const [statusCheckInterval, setStatusCheckInterval] = useState(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  useEffect(() => {
    loadChamaDetails();
    loadWalletBalance();
    if (chamaId) {
      checkUserRole();
      loadContributionOptions();
    }

    const initializeContribution = async () => {
      if (
        initialContributionType === 'merry-go-round' &&
        chamaId &&
        roundId &&
        amountPerRound
      ) {
        setSelectedMerryGoRound({
          id: roundId,
          name: roundName,
          amountPerRound,
        });
        setAmount(amountPerRound.toString());
        setContributionType('merry-go-round');
      }

      if (initialContributionType === 'welfare' && proposalId && requestedAmount) {
        setSelectedWelfare({
          id: proposalId,
          title: proposalTitle,
          amount: requestedAmount,
        });
        setAmount(requestedAmount.toString());
        setContributionType('welfare');
        if (proposalTitle) {
          setDescription(`Welfare contribution for: ${proposalTitle}`);
        }
      }
    };

    initializeContribution();
  }, [chamaId]);

  // Load members when user switches to "Pay for Someone" and we haven't loaded them yet
  useEffect(() => {
    if (paymentMethod === 'pay_for' && chamaMembers.length === 0) {
      loadChamaMembers();
    }
  }, [paymentMethod, chamaMembers.length]);

  // Load merry-go-rounds and welfare contributions for the chama
  const loadContributionOptions = async () => {
    try {
      setLoadingContributionOptions(true);

      // Load merry-go-rounds
      const mgrResponse = await ApiService.getMerryGoRounds(chamaId);
      if (mgrResponse.success && mgrResponse.data) {
        setMerryGoRounds(mgrResponse.data);
      }

      // Load approved welfare contributions
      const welfareResponse = await ApiService.getWelfareRequests(chamaId);
      if (welfareResponse.success && welfareResponse.data) {
        const approvedWelfare = (welfareResponse.data || []).filter(
          (req) =>
            req.status === 'approved' ||
            req.status === 'active' ||
            req.status === 'pending'
        );
        setWelfareContributions(approvedWelfare);
      }
    } catch (error) {
      console.error('Failed to load contribution options:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load contribution options',
        position: 'top',
        visibilityTime: 3000,
        topOffset: 60,
      });
    } finally {
      setLoadingContributionOptions(false);
    }
  };

  // Handle contribution type selection and reset related state
  const handleContributionTypeChange = async (type) => {
    if (!availableContributionTypes.includes(type)) {
      return;
    }
    setContributionType(type);
    setShowContributionTypeDropdown(false);
    setSelectedMerryGoRound(null);
    setSelectedWelfare(null);
    setAmount('');
    setDescription('');
    setShowMerryGoRoundDropdown(false);
    setShowWelfareDropdown(false);
  };

  // Handle merry-go-round cycle selection
  const handleMerryGoRoundSelect = async (round) => {
    setSelectedMerryGoRound(round);
    setShowMerryGoRoundDropdown(false);
    const cycleAmount = round.amountPerRound || round.amount || amountPerRound;
    if (cycleAmount && cycleAmount > 0) {
      setAmount(cycleAmount.toString());
    } else {
      setAmount('');
    }
  };

  // Handle welfare contribution selection
  const handleWelfareSelect = (welfare) => {
    setSelectedWelfare(welfare);
    setShowWelfareDropdown(false);
    setAmount(welfare.amount ? welfare.amount.toString() : '');
    if (welfare.title) {
      setDescription(`Welfare contribution for: ${welfare.title}`);
    }
  };

  // Close all dropdowns
  const closeAllDropdowns = () => {
    setShowContributionTypeDropdown(false);
    setShowMerryGoRoundDropdown(false);
    setShowWelfareDropdown(false);
  };

  // Handle screen focus/blur for status checking
  useFocusEffect(
    useCallback(() => {
      if (contributionType === 'merry-go-round' && chamaId) {
        startStatusChecking();
      }

      return () => {
        stopStatusChecking();
      };
    }, [contributionType, chamaId])
  );

  // Load chama members for pay for someone contributions (only for treasurers)
  const loadChamaMembers = async () => {
    try {
      if (contributionType === 'merry-go-round' && roundId) {
        const response =
          await ApiService.makeRequestWithRetry(
            `/merry-go-rounds/${roundId}`
          );

        if (response.success && response.data) {
          const merryGoRound = response.data;
          const participants =
            merryGoRound.members || merryGoRound.participants || [];

          const eligibleMembers = participants.map((participant) => {
            const member = participant.user || participant;
            return {
              id: member.id || participant.id,
              user_id: member.id || participant.id,
              first_name:
                member.first_name || member.firstName || '',
              last_name: member.last_name || member.lastName || '',
              fullName:
                member.first_name && member.last_name
                  ? `${member.first_name} ${member.last_name}`
                  : member.fullName ||
                    member.name ||
                    `Member ${participant.position || participants.indexOf(participant) + 1}`,
              email: member.email || '',
              role: member.role || 'member',
              total_contributions: member.total_contributions || 0,
              avatar: member.avatar,
              avatar_url: member.avatar_url,
              position:
                participant.position ||
                (participants.indexOf(participant) + 1),
            };
          });
          setChamaMembers(eligibleMembers);
          return;
        }
      }

      // For regular contributions, load all chama members (treasurer only)
      const response = await ApiService.makeRequestWithRetry(
        `/contributions/chamas/${chamaId}/members`
      );
      if (response.success) {
        setChamaMembers(response.data);
      }
    } catch (error) {
      console.error('Failed to load chama members:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load chama members',
        position: 'top',
        visibilityTime: 3000,
        topOffset: 60,
      });
    }
  };

  // Check user role in the chama
  const checkUserRole = async () => {
    if (!chamaId || !user?.id) return;

    try {
      const response = await ApiService.getMemberRole(chamaId, user.id);
      if (response.success) {
        setUserRole(response.data?.role || null);
        if (
          response.data?.role === 'treasurer' ||
          response.data?.role === 'chairperson'
        ) {
          loadChamaMembers();
        }
      }
    } catch (error) {
      console.error('Failed to check user role:', error);
      // Only attempt the members fallback if we actually have a valid chamaId.
      // Without it, this would hit /contributions/chamas/undefined/members → 403.
      if (chamaId) {
        loadChamaMembers();
      }
    }
  };

  // Load current recipient for merry-go-round contributions
  const loadCurrentRecipient = async () => {
    try {
      const response = await ApiService.getMerryGoRoundContributionStatus(
        chamaId,
        roundId
      );

      if (response.success && response.data) {
        const statusData = response.data;

        setContributionStatus(statusData);

        if (statusData.currentRecipient) {
          setCurrentRecipient({
            id: statusData.currentRecipient.id,
            firstName: statusData.currentRecipient.name.split(' ')[0] || '',
            lastName: statusData.currentRecipient.name
              .split(' ')
              .slice(1)
              .join(' ') || '',
            fullName: statusData.currentRecipient.name,
            position: statusData.currentRound,
            amountPerRound: statusData.amountPerRound,
          });

          const amountToUse = statusData.amountPerRound || amountPerRound;
          if (amountToUse && amountToUse > 0) {
            const exactAmount = amountToUse.toString();
            setAmount(exactAmount);

            if (parseFloat(exactAmount) !== amountToUse) {
              console.error(
                '❌ AMOUNT MISMATCH! Expected:',
                amountToUse,
                'Got:',
                exactAmount
              );
            }
          } else {
            console.error(
              '❌ NO AMOUNT RECEIVED FROM BACKEND OR PARAMS! API amountPerRound:',
              statusData.amountPerRound,
              ', param amountPerRound:',
              amountPerRound
            );
            setAmount('0');
          }
        } else {
          console.warn('⚠️ No current recipient in status data');
          setCurrentRecipient(null);
          setAmount('0');
        }
      } else {
        console.warn('⚠️ Failed to get contribution status:', response);
        setCurrentRecipient(null);
        setAmount('0');
      }
    } catch (error) {
      console.error('❌ Failed to load current recipient:', error);
      setCurrentRecipient(null);
      setAmount('0');
    }
  };

  // Check contribution status for real-time updates
  const checkContributionStatus = async () => {
    if (contributionType !== 'merry-go-round' || !chamaId || isCheckingStatus) {
      return;
    }

    setIsCheckingStatus(true);

    try {
      const response = await ApiService.getMerryGoRoundContributionStatus(
        chamaId,
        roundId
      );

      if (response.success && response.data) {
        const statusData = response.data;

        setContributionStatus(statusData);

        if (
          statusData.hasContributed &&
          !contributionStatus?.hasContributed &&
          paymentMethod !== 'pay_for'
        ) {
          Alert.alert(
            'Already Contributed',
            'You have already contributed to this merry-go-round round. Each member can only contribute once per round.',
            [{ text: 'OK' }]
          );
        }

        if (
          statusData.currentRecipient &&
          statusData.currentRecipient.id !== currentRecipient?.id
        ) {
          setCurrentRecipient({
            id: statusData.currentRecipient.id,
            firstName: statusData.currentRecipient.name.split(' ')[0] || '',
            lastName: statusData.currentRecipient.name
              .split(' ')
              .slice(1)
              .join(' ') || '',
            fullName: statusData.currentRecipient.name,
            position: statusData.currentRound,
            amountPerRound: statusData.amountPerRound || amountPerRound,
          });

          const newAmount = statusData.amountPerRound || amountPerRound;
          if (newAmount && newAmount !== parseFloat(amount)) {
            setAmount(newAmount.toString());
          }
        }

        if (statusData.roundComplete && !contributionStatus?.roundComplete) {
          Alert.alert(
            'Round Complete!',
            'All members have contributed to this round. The merry-go-round will advance to the next member.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('❌ Failed to check contribution status:', error);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Start real-time status checking for merry-go-round
  const startStatusChecking = () => {
    if (
      contributionType === 'merry-go-round' &&
      !statusCheckInterval &&
      chamaId
    ) {
      checkContributionStatus();

      const interval = setInterval(() => {
        if (contributionType === 'merry-go-round' && chamaId) {
          checkContributionStatus();
        }
      }, 15000);

      setStatusCheckInterval(interval);
    }
  };

  // Stop status checking
  const stopStatusChecking = () => {
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
      setStatusCheckInterval(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const promises = [
        loadChamaDetails(),
        loadWalletBalance(),
      ];
      if (chamaId) {
        promises.push(loadContributionOptions());
        promises.push(checkUserRole());
      }
      await Promise.all(promises);
    } catch (error) {
      console.warn('ContributeScreen refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const deriveAvailablePaymentMethods = (walletTypes = []) => {
    if (!walletTypes || walletTypes.length === 0) {
      return ['wallet', 'mpesa', 'pay_for'];
    }

    const methods = new Set();

    walletTypes.forEach((type) => {
      switch (type) {
        case 'merry-go-round':
        case 'welfare':
        case 'loans':
          methods.add('wallet');
          methods.add('mpesa');
          methods.add('pay_for');
          break;
        case 'savings':
        case 'shares':
        case 'dividends':
          methods.add('wallet');
          break;
        default:
          methods.add('wallet');
          break;
      }
    });

    return Array.from(methods);
  };

  const deriveAvailableContributionTypes = (walletTypes = []) => {
    if (!walletTypes || walletTypes.length === 0) {
      return ['regular', 'merry-go-round', 'welfare', 'savings'];
    }

    const types = new Set(['regular']);

    walletTypes.forEach((type) => {
      switch (type) {
        case 'merry-go-round':
          types.add('merry-go-round');
          break;
        case 'welfare':
          types.add('welfare');
          break;
        case 'savings':
          types.add('savings');
          break;
        default:
          break;
      }
    });

    return Array.from(types);
  };

  const loadChamaDetails = async () => {
    try {
      const response = await ApiService.getChamaById(chamaId);

      let chamaData = null;

      if (response && response.success) {
        chamaData = response.data;
      } else if (response && !response.success && response.error) {
        throw new Error(response.error);
      } else if (response && response.id) {
        chamaData = response;
      } else {
        throw new Error('Invalid response format');
      }

      if (chamaData) {
        setChama(chamaData);
        if (contributionType !== 'merry-go-round') {
          setAmount((chamaData.contribution_amount || 0).toString());
        }

        const walletTypes =
          chamaData.permissions?.activeWalletTypes ||
          chamaData.wallet_types ||
          [];
        setAvailablePaymentMethods(deriveAvailablePaymentMethods(walletTypes));
        setAvailableContributionTypes(
          deriveAvailableContributionTypes(walletTypes)
        );
      } else {
        throw new Error('No chama data received');
      }
    } catch (error) {
      console.error('Failed to load chama details:', error);
      Alert.alert('Error', `Failed to load chama details: ${error.message}`);
    }
  };

  const loadWalletBalance = async () => {
    try {
      const response = await ApiService.getWalletBalance();

      if (response.success && response.data) {
        const balance = response.data.balance || 0;
        setWalletBalance(balance);
      } else {
        setWalletBalance(0);
      }
    } catch (error) {
      console.error('❌ Failed to load wallet balance:', error);
      setWalletBalance(0);
    }
  };

  const handleContribute = async () => {
    if (contributionType === 'merry-go-round' && !selectedMerryGoRound) {
      Alert.alert(
        'Select Merry-Go-Round Cycle',
        'Please select a merry-go-round cycle to contribute to.'
      );
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid contribution amount');
      return;
    }

    if (contributionType === 'merry-go-round') {
      await checkContributionStatus();

      if (contributionStatus?.hasContributed && paymentMethod !== 'pay_for') {
        Alert.alert(
          'Already Contributed',
          'You have already contributed to this merry-go-round round. Each member can only contribute once per round.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (!contributionStatus?.hasActiveMerryGoRound) {
        Alert.alert(
          'No Active Merry-Go-Round',
          'There is no active merry-go-round for this chama.'
        );
        return;
      }

      if (!contributionStatus?.isParticipant) {
        Alert.alert(
          'Not a Participant',
          'You are not a participant in this merry-go-round circle.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    const paymentValidation = validatePaymentMethod({
      method: paymentMethod,
      contributionType,
      isAnonymous,
    });
    if (!paymentValidation.valid) {
      Alert.alert(
        paymentValidation.alert.title,
        paymentValidation.alert.message
      );
      return;
    }

    const amountValidation = validateContributionAmount({
      amount,
      contributionType,
      selectedMerryGoRound,
      contributionStatus,
      currentRecipient,
      amountPerRound,
    });
    if (!amountValidation.valid) {
      Alert.alert(
        amountValidation.alert.title,
        amountValidation.alert.message
      );
      return;
    }

    const walletValidation = validateWalletBalance({
      paymentMethod,
      walletBalance,
      amount,
      contributionType,
      formatCurrency,
      navigation,
    });
    if (!walletValidation.valid) {
      const { alert } = walletValidation;
      Alert.alert(alert.title, alert.message, alert.buttons);
      return;
    }

    const mpesaValidation = validateMpesaPhone({ paymentMethod, user });
    if (!mpesaValidation.valid) {
      Alert.alert(
        mpesaValidation.alert.title,
        mpesaValidation.alert.message
      );
      return;
    }

    const payForValidation = validatePayForMember({
      paymentMethod,
      selectedContributor,
    });
    if (!payForValidation.valid) {
      Alert.alert(
        payForValidation.alert.title,
        payForValidation.alert.message
      );
      return;
    }

    // Show payment confirmation
    setShowPaymentModal(true);
  };

  const confirmContribution = async () => {
    try {
      setLoading(true);
      setShowPaymentModal(false);

      if (!chamaId) {
        throw new Error('Invalid chama ID');
      }

      if (paymentMethod === 'mpesa') {
        await handleMpesaContribution(chamaId);
      } else if (paymentMethod === 'pay_for') {
        if (!selectedContributor) {
          Alert.alert(
            'Member Required',
            'Please select the member you want to pay for before proceeding.',
            [{ text: 'OK' }]
          );
          return;
        }
        await handlePayForContribution(chamaId);
      } else {
        await handleWalletContribution(chamaId);
      }
    } catch (error) {
      console.error('Contribution failed:', error);
      if (contributionType === 'merry-go-round') {
        const errorMessage = error.message || '';
        if (errorMessage.includes('already contributed')) {
          Toast.show({
            type: 'error',
            text1: 'Already Contributed',
            text2:
              paymentMethod === 'pay_for'
                ? 'The selected member has already contributed to this merry-go-round round.'
                : 'You have already contributed to this merry-go-round round.',
            position: 'top',
            visibilityTime: 4000,
            topOffset: 60,
          });
          await checkContributionStatus();
          return;
        }
        if (errorMessage.includes('Invalid merry-go-round contribution amount')) {
          Toast.show({
            type: 'error',
            text1: 'Invalid Amount',
            text2:
              'The contribution amount does not match the required amount for this round.',
            position: 'top',
            visibilityTime: 4000,
            topOffset: 60,
          });
          return;
        }
        if (errorMessage.includes('not allowed for merry-go-round')) {
          Toast.show({
            type: 'error',
            text1: 'Payment Method Not Allowed',
            text2:
              'This payment method is not allowed for merry-go-round contributions.',
            position: 'top',
            visibilityTime: 4000,
            topOffset: 60,
          });
          return;
        }
      }
      Toast.show({
        type: 'error',
        text1: 'Contribution Failed',
        text2:
          error.message || 'An error occurred while processing your contribution',
        position: 'top',
        visibilityTime: 4000,
        topOffset: 60,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWalletContribution = async (cleanChamaId) => {
    const result = await handleWalletContributionHandler({
      chamaId: cleanChamaId,
      amount,
      description,
      contributionType,
      chama,
      isAnonymous,
      selectedMerryGoRound,
      selectedWelfare,
      getContributionDescription,
    });

    if (result.type === 'savings') {
      if (typeof result.backendBalance === 'number' && !isNaN(result.backendBalance)) {
        setWalletBalance(Math.max(0, result.backendBalance));
      } else {
        setWalletBalance((prev) => Math.max(0, prev - parseFloat(amount || '0')));
      }

      const refreshBalance = async () => {
        try {
          const balanceRes = await ApiService.getWalletBalance();
          if (balanceRes.success && balanceRes.data?.balance !== undefined) {
            setWalletBalance(balanceRes.data.balance);
          }
        } catch {}
      };

      try {
        await refreshSpecificData('wallet');
      } catch {}

      setTimeout(refreshBalance, 1500);

      Toast.show({
        type: 'success',
        text1: 'Savings Contribution Successful!',
        text2: `You have successfully contributed ${formatCurrency(parseFloat(amount))} from your personal wallet to ${chama?.name || 'group'} savings subwallet.`,
        position: 'top',
        visibilityTime: 4000,
        topOffset: 60,
      });

      setTimeout(() => {
        setAmount('');
        setDescription('');
        setShowPaymentModal(false);
        navigation.goBack();
      }, 2000);
      return;
    }

    await loadWalletBalance();
    try {
      await refreshSpecificData('wallet');
    } catch {}

    setTimeout(async () => {
      try {
        const balanceRes = await ApiService.getWalletBalance();
        if (balanceRes.success && balanceRes.data?.balance !== undefined) {
          setWalletBalance(balanceRes.data.balance);
        }
      } catch {}
    }, 1500);

    const successTitle =
      contributionType === 'regular'
        ? 'Contribution Successful!'
        : `${getContributionTitle()} Successful!`;

    Toast.show({
      type: 'success',
      text1: successTitle,
      text2: getSuccessMessage(
        contributionType,
        formatCurrency(parseFloat(amount)),
        chama?.name || 'the group',
        isAnonymous,
        {
          selectedMerryGoRound,
          roundName,
        }
      ),
      position: 'top',
      visibilityTime: 4000,
      topOffset: 60,
    });

    setTimeout(() => {
      setAmount('');
      setDescription('');
      setIsAnonymous(false);
      setShowPaymentModal(false);
      navigation.goBack();
    }, 2000);
  };

  const handleMpesaContribution = async (cleanChamaId) => {
    const result = await handleMpesaContributionHandler({
      chamaId: cleanChamaId,
      amount,
      description,
      contributionType,
      selectedWelfare,
      proposalId,
      selectedMerryGoRound,
      user,
      getDefaultDescription,
    });

    if (result.type === 'welfare') {
      await loadWalletBalance();
      try {
        await refreshSpecificData('wallet');
      } catch (error) {
        console.warn('⚠️ Failed to refresh global wallet data:', error);
      }

      Toast.show({
        type: 'success',
        text1: 'Welfare Contribution Successful!',
        text2: getSuccessMessage(
          'welfare',
          formatCurrency(parseFloat(amount)),
          chama?.name || 'the group',
          isAnonymous
        ),
        position: 'top',
        visibilityTime: 4000,
        topOffset: 60,
      });

      setTimeout(() => {
        setAmount('');
        setDescription('');
        setIsAnonymous(false);
        navigation.goBack();
      }, 2000);
      return;
    }

    const { formattedPhone } = result;

    Alert.alert(
      'M-Pesa Payment Initiated',
      `M-Pesa STK push sent to ${formattedPhone} for ${formatCurrency(parseFloat(amount))}. Please check your phone and enter your PIN to complete the payment. The contribution will be processed once payment is confirmed.`,
      [
        {
          text: 'Check Status',
          onPress: () => {
            setAmount('');
            setDescription('');
            navigation.navigate('ChamaTransactions');
          },
        },
        {
          text: 'OK',
          style: 'default',
          onPress: () => {
            setAmount('');
            setDescription('');
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handlePayForContribution = async (cleanChamaId) => {
    const result = await handlePayForContributionHandler({
      chamaId: cleanChamaId,
      amount,
      description,
      contributionType,
      selectedContributor,
      user,
      selectedMerryGoRound,
      selectedWelfare,
      getContributionDescription,
    });

    await loadWalletBalance();
    try {
      await refreshSpecificData('wallet');
    } catch {}

    setTimeout(async () => {
      try {
        const balanceRes = await ApiService.getWalletBalance();
        if (balanceRes.success && balanceRes.data?.balance !== undefined) {
          setWalletBalance(balanceRes.data.balance);
        }
      } catch {}
    }, 1500);

    const contributorName = result.contributorName;

    Toast.show({
      type: 'success',
      text1: 'Payment for Someone Successful!',
      text2: `You paid KES ${formatCurrency(result.contributionAmount)} for ${contributorName}. KES ${formatCurrency(result.contributionAmount)} has been deducted from your wallet.`,
      position: 'top',
      visibilityTime: 4000,
      topOffset: 60,
    });

    Alert.alert(
      'Payment Recorded Successfully',
      `You have paid KES ${formatCurrency(result.contributionAmount)} for ${contributorName}. The amount has been deducted from your VaultKe wallet.`,
      [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
          },
        },
      ]
    );
  };

  // Validate member selection for merry-go-round contributions
  const validateMemberSelection = (member) => {
    if (contributionType === 'merry-go-round') {
      const isParticipant = chamaMembers.some(
        (m) => m.id === member.id || m.user_id === member.id
      );
      if (!isParticipant) {
        Alert.alert(
          'Invalid Selection',
          `${member.fullName} is not a participant in ${roundName || 'this merry-go-round'} circle.`,
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true;
  };

  return {
    // Route params
    chamaId,
    initialContributionType,
    roundId,
    roundName,
    proposalId,
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
    userRole,
    currentRecipient,
    contributionStatus,
    isCheckingStatus,
    memberSearchQuery,
    // Setters
    setChama,
    setAmount,
    setDescription,
    setLoading,
    setPaymentMethod,
    setShowPaymentModal,
    setRefreshing,
    setIsAnonymous,
    setContributionType,
    setShowContributionTypeDropdown,
    setSelectedMerryGoRound,
    setShowMerryGoRoundDropdown,
    setSelectedWelfare,
    setShowWelfareDropdown,
    setSelectedContributor,
    setMemberSearchQuery,
    // Handlers
    handleContributionTypeChange,
    handleMerryGoRoundSelect,
    handleWelfareSelect,
    closeAllDropdowns,
    loadChamaMembers,
    loadCurrentRecipient,
    checkContributionStatus,
    startStatusChecking,
    stopStatusChecking,
    onRefresh,
    handleContribute,
    confirmContribution,
    handleWalletContribution,
    handleMpesaContribution,
    handlePayForContribution,
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
    user,
  };
};

export default useContributionScreen;
