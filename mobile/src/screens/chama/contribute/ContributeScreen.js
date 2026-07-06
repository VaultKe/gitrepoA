import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import ApiService from '../../../services/api';
import ContributionTypeSelector from './components/ContributionTypeSelector';
import PaymentMethodSelector from './components/PaymentMethodSelector';
import MemberListingSection from './components/MemberListingSection';
import CurrentRecipientInfo from './components/CurrentRecipientInfo';
import PaymentConfirmationModal from './components/PaymentConfirmationModal';
import MerryGoRoundRules from './components/MerryGoRoundRules';
import AnonymousContribution from './components/AnonymousContribution';
import ValidationMessage from './components/ValidationMessage';
import PhoneNumberDisplay from './components/PhoneNumberDisplay';


const ContributeScreen = ({ route, navigation }) => {
  // Extract all parameters - handle both direct chamaId and nested params
  const chamaId = route.params?.chamaId || route.params?.id;
  const initialContributionType = route.params?.contributionType || 'regular';
  const roundId = route.params?.roundId;
  const roundName = route.params?.roundName;
  const proposalId = route.params?.proposalId;
  const proposalTitle = route.params?.proposalTitle;
  const requestedAmount = route.params?.requestedAmount;
  const amountPerRound = route.params?.amountPerRound;

  const { theme, user, refreshSpecificData } = useApp();
  const colors = getThemeColors(theme);
  
  const [chama, setChama] = useState(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [chamaLoading, setChamaLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('wallet'); // 'wallet', 'mpesa', or 'pay_for'
  const [walletBalance, setWalletBalance] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
const [isAnonymous, setIsAnonymous] = useState(false); // For anonymous contributions
   
   // New states for contribution type selection
   const [contributionType, setContributionType] = useState(initialContributionType);
   const [showContributionTypeDropdown, setShowContributionTypeDropdown] = useState(false);
   const [merryGoRounds, setMerryGoRounds] = useState([]);
   const [selectedMerryGoRound, setSelectedMerryGoRound] = useState(null);
   const [showMerryGoRoundDropdown, setShowMerryGoRoundDropdown] = useState(false);
   const [welfareContributions, setWelfareContributions] = useState([]);
   const [selectedWelfare, setSelectedWelfare] = useState(null);
   const [showWelfareDropdown, setShowWelfareDropdown] = useState(false);
   const [loadingContributionOptions, setLoadingContributionOptions] = useState(false);
 
   // Pay for someone contribution specific states
   const [chamaMembers, setChamaMembers] = useState([]);
   const [selectedContributor, setSelectedContributor] = useState(null);
   const [userRole, setUserRole] = useState(null);
   const [currentRecipient, setCurrentRecipient] = useState(null);
   const [failedAvatars, setFailedAvatars] = useState(new Set()); // Track failed avatar loads
   const [contributionStatus, setContributionStatus] = useState(null);
   const [statusCheckInterval, setStatusCheckInterval] = useState(null);
   const [isCheckingStatus, setIsCheckingStatus] = useState(false);
   const [memberSearchQuery, setMemberSearchQuery] = useState('');

  useEffect(() => {
    loadChamaDetails();
    loadWalletBalance();
    checkUserRole();
    
    // Load contribution options based on type
    if (chamaId) {
      loadContributionOptions();
    }

    // For merry-go-round contributions with route params, pre-select the round
    // Note: This runs only once on mount due to dependency array below
    const initializeContribution = async () => {
      if (initialContributionType === 'merry-go-round' && chamaId && roundId && amountPerRound) {
        // Pre-populate from route params for backward compatibility
        setSelectedMerryGoRound({ id: roundId, name: roundName, amountPerRound });
        setAmount(amountPerRound.toString());
        setContributionType('merry-go-round');
      }
      
      // For welfare contributions with route params, pre-select the welfare
      if (initialContributionType === 'welfare' && proposalId && requestedAmount) {
        setSelectedWelfare({ id: proposalId, title: proposalTitle, amount: requestedAmount });
        setAmount(requestedAmount.toString());
        setContributionType('welfare');
        if (proposalTitle) {
          setDescription(`Welfare contribution for: ${proposalTitle}`);
        }
      }
    };
    
    initializeContribution();
  }, [chamaId]); // Run once on mount

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
        // Filter to only show approved/active welfare contributions that people can pay to
        const approvedWelfare = (welfareResponse.data || []).filter(
          req => req.status === 'approved' || req.status === 'active' || req.status === 'pending'
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
    // Set amount from the selected cycle's amountPerRound or amount
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
    React.useCallback(() => {
      // Start status checking when screen is focused
      if (contributionType === 'merry-go-round' && chamaId) {
        startStatusChecking();
      }

      // Cleanup function to stop status checking when screen loses focus
      return () => {
        stopStatusChecking();
      };
    }, [contributionType, chamaId])
  );

  // Load chama members for pay for someone contributions (only for treasurers)
  const loadChamaMembers = async () => {
    try {
      // For merry-go-round contributions, load members from the merry-go-round circle
      if (contributionType === 'merry-go-round' && roundId) {
        const response = await ApiService.makeRequest(`/merry-go-rounds/${roundId}`);

        if (response.success && response.data) {
          const merryGoRound = response.data;
          const participants = merryGoRound.members || merryGoRound.participants || [];

          // Convert participants to member format expected by the UI
          const eligibleMembers = participants.map(participant => {
            const member = participant.user || participant;
            return {
              id: member.id || participant.id,
              user_id: member.id || participant.id,
              first_name: member.first_name || member.firstName || '',
              last_name: member.last_name || member.lastName || '',
              fullName: member.first_name && member.last_name
                ? `${member.first_name} ${member.last_name}`
                : member.fullName || member.name || `Member ${participant.position || participants.indexOf(participant) + 1}`,
              email: member.email || '',
              role: member.role || 'member',
              total_contributions: member.total_contributions || 0,
              avatar: member.avatar,
              avatar_url: member.avatar_url,
              position: participant.position || (participants.indexOf(participant) + 1)
            };
          });
          setChamaMembers(eligibleMembers);
          return;
        }
      }

      // For regular contributions, load all chama members (treasurer only)
      const response = await ApiService.makeRequest(`/contributions/chamas/${chamaId}/members`);
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
    try {
      const response = await ApiService.makeRequest(`/chamas/${chamaId}/members/${user.id}/role`);
      if (response.success) {
        setUserRole(response.data.role);
        // Load members if user is treasurer or chairperson
        if (response.data.role === 'treasurer' || response.data.role === 'chairperson') {
          loadChamaMembers();
        }
      }
    } catch (error) {
      console.error('Failed to check user role:', error);
    }
  };

  // Load current recipient for merry-go-round contributions
  const loadCurrentRecipient = async () => {
    try {
      // Use the contribution status endpoint which provides current recipient info
      // Include roundId as query parameter if available for specific round targeting
      const queryParams = roundId ? `?roundId=${roundId}` : '';
      const apiUrl = `/merry-go-rounds/contribution-status/${chamaId}${queryParams}`;

      const response = await ApiService.makeRequest(apiUrl);
      if (response.success && response.data) {
        const statusData = response.data;

        // Update contribution status
        setContributionStatus(statusData);

        // Set current recipient from status data
        if (statusData.currentRecipient) {
          setCurrentRecipient({
            id: statusData.currentRecipient.id,
            firstName: statusData.currentRecipient.name.split(' ')[0] || '',
            lastName: statusData.currentRecipient.name.split(' ').slice(1).join(' ') || '',
            fullName: statusData.currentRecipient.name,
            position: statusData.currentRound,
            amountPerRound: statusData.amountPerRound
          });

          // CRITICAL: Set the contribution amount to the EXACT required amount
          const amountToUse = statusData.amountPerRound || amountPerRound;
          if (amountToUse && amountToUse > 0) {
            const exactAmount = amountToUse.toString();
            setAmount(exactAmount);

            // Validate that the amount was set correctly
            if (parseFloat(exactAmount) !== amountToUse) {
              console.error('❌ AMOUNT MISMATCH! Expected:', amountToUse, 'Got:', exactAmount);
            }
          } else {
            console.error('❌ NO AMOUNT RECEIVED FROM BACKEND OR PARAMS! API amountPerRound:', statusData.amountPerRound, ', param amountPerRound:', amountPerRound);
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
      // Include roundId as query parameter if available for specific round targeting
      const queryParams = roundId ? `?roundId=${roundId}` : '';
      const response = await ApiService.makeRequest(`/merry-go-rounds/contribution-status/${chamaId}${queryParams}`);

      if (response.success && response.data) {
        const statusData = response.data;

        // Update contribution status
        setContributionStatus(statusData);

        // If user has already contributed, show notification (only once)
        // Skip this notification when using pay_for, since payer can pay for multiple members
        if (statusData.hasContributed && !contributionStatus?.hasContributed && paymentMethod !== 'pay_for') {
          Alert.alert(
            'Already Contributed',
            'You have already contributed to this merry-go-round round. Each member can only contribute once per round.',
            [{ text: 'OK' }]
          );
        }

        // Update current recipient if it changed
        if (statusData.currentRecipient && statusData.currentRecipient.id !== currentRecipient?.id) {
          setCurrentRecipient({
            id: statusData.currentRecipient.id,
            firstName: statusData.currentRecipient.name.split(' ')[0] || '',
            lastName: statusData.currentRecipient.name.split(' ').slice(1).join(' ') || '',
            fullName: statusData.currentRecipient.name,
            position: statusData.currentRound,
            amountPerRound: statusData.amountPerRound || amountPerRound
          });

          // Update amount if it changed
          const newAmount = statusData.amountPerRound || amountPerRound;
          if (newAmount && newAmount !== parseFloat(amount)) {
            setAmount(newAmount.toString());
          }
        }

        // If round is complete, show notification (only once)
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
      // Don't show error alerts for background status checks to avoid spam
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Start real-time status checking for merry-go-round
  const startStatusChecking = () => {
    if (contributionType === 'merry-go-round' && !statusCheckInterval && chamaId) {
      // Check immediately
      checkContributionStatus();

      // Set up interval for periodic checks (every 15 seconds to avoid excessive API calls)
      const interval = setInterval(() => {
        // Only check if component is still mounted and focused
        if (contributionType === 'merry-go-round' && chamaId) {
          checkContributionStatus();
        }
      }, 15000); // Increased to 15 seconds to reduce API load

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

  const loadChamaDetails = async () => {
    try {
      setChamaLoading(true);
      const response = await ApiService.getChamaById(chamaId);

      // Handle different response structures
      let chamaData = null;

      if (response && response.success) {
        // If response has data property
        chamaData = response.data;
      } else if (response && !response.success && response.error) {
        // Handle API error response
        throw new Error(response.error);
      } else if (response && response.id) {
        // If response is the chama object directly
        chamaData = response;
      } else {
        throw new Error('Invalid response format');
      }

      if (chamaData) {
        setChama(chamaData);
        // Only set amount for regular contributions, not for merry-go-round
        if (contributionType !== 'merry-go-round') {
          setAmount(chamaData.contribution_amount?.toString() || '');
        }
      } else {
        throw new Error('No chama data received');
      }
    } catch (error) {
      console.error('Failed to load chama details:', error);
      Alert.alert('Error', `Failed to load chama details: ${error.message}`);
    } finally {
      setChamaLoading(false);
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
    // Check if merry-go-round cycle is selected when merry-go-round type is chosen
    if (contributionType === 'merry-go-round' && !selectedMerryGoRound) {
      Alert.alert('Select Merry-Go-Round Cycle', 'Please select a merry-go-round cycle to contribute to.');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid contribution amount');
      return;
    }

    if (!chama) {
      Alert.alert('Error', 'Chama details not loaded. Please try again.');
      return;
    }

    // For merry-go-round, check real-time contribution status with backend assertions
    if (contributionType === 'merry-go-round') {
      // Refresh status before proceeding
      await checkContributionStatus();

      // Backend assertion: Check if user has already contributed to this round
      // Allow pay_for payments even if the payer has already contributed for themselves
      if (contributionStatus?.hasContributed && paymentMethod !== 'pay_for') {
        Alert.alert(
          'Already Contributed',
          'You have already contributed to this merry-go-round round. Each member can only contribute once per round.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Backend assertion: Check if there's an active merry-go-round
      if (!contributionStatus?.hasActiveMerryGoRound) {
        Alert.alert('No Active Merry-Go-Round', 'There is no active merry-go-round for this chama.');
        return;
      }

      // Backend assertion: Check if user is a participant in the merry-go-round
      if (!contributionStatus?.isParticipant) {
        Alert.alert(
          'Not a Participant',
          'You are not a participant in this merry-go-round circle.',
          [{ text: 'OK' }]
        );
        return;
      }

    }

    // Validate payment method for merry-go-round
    if (!validatePaymentMethod(paymentMethod)) {
      return;
    }

    // Validate amount for merry-go-round
    if (!validateContributionAmount(amount)) {
      return;
    }

    // Validate payment method specific requirements
    if (paymentMethod === 'wallet') {
      const contributionAmount = parseFloat(amount);

      // Check for nil/zero balance
      if (walletBalance <= 0) {
        Alert.alert(
          'No Wallet Balance',
          'Your VaultKe wallet balance is KES 0.00. Please deposit money into your wallet before making a contribution.',
          [
            {
              text: 'Deposit Now',
              onPress: () => {
                // Navigate to deposit screen
                navigation.navigate('WalletScreen', { tab: 'deposit' });
              }
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
        return;
      }

      // Check for insufficient balance
      if (contributionAmount > walletBalance) {
        const shortfall = contributionAmount - walletBalance;

        // For merry-go-round contributions, amount is fixed and cannot be reduced
        const alertMessage = contributionType === 'merry-go-round'
          ? `Your VaultKe wallet balance is KES ${formatCurrency(walletBalance)}.\n\nYou need KES ${formatCurrency(shortfall)} more to make this merry-go-round contribution of KES ${formatCurrency(contributionAmount)}.\n\nMerry-go-round contributions require the exact amount and cannot be reduced.`
          : `Your VaultKe wallet balance is KES ${formatCurrency(walletBalance)}.\n\nYou need KES ${formatCurrency(shortfall)} more to make this contribution.\n\nWould you like to deposit money or reduce the contribution amount?`;

        const alertButtons = contributionType === 'merry-go-round'
          ? [
              {
                text: 'Deposit Money',
                onPress: () => {
                  navigation.navigate('WalletScreen', { tab: 'deposit' });
                }
              },
              {
                text: 'Cancel',
                style: 'cancel'
              }
            ]
          : [
              {
                text: 'Deposit Money',
                onPress: () => {
                  navigation.navigate('WalletScreen', { tab: 'deposit' });
                }
              },
              {
                text: 'Reduce Amount',
                onPress: () => {
                  setAmount(walletBalance.toString());
                }
              },
              {
                text: 'Cancel',
                style: 'cancel'
              }
            ];

        Alert.alert(
          'Insufficient Wallet Balance',
          alertMessage,
          alertButtons
        );
        return;
      }
    } else if (paymentMethod === 'mpesa') {
      if (!user?.phone || user.phone.length < 10) {
        Alert.alert('Phone Number Required', 'Your account does not have a valid phone number. Please update your profile to use M-Pesa payments.');
        return;
      }
    } else if (paymentMethod === 'pay_for') {
      if (!selectedContributor) {
        Alert.alert('Member Required', 'Please select the member you want to pay for.');
        return;
      }
    }

    // Show payment confirmation
    setShowPaymentModal(true);
  };

  const confirmContribution = async () => {
    try {
      setLoading(true);
      setShowPaymentModal(false);

      // Ensure chamaId is a string, not an object
      const cleanChamaId = typeof chamaId === 'string' ? chamaId : chamaId?.chamaId || chamaId?.id;

      if (!cleanChamaId) {
        throw new Error('Invalid chama ID');
      }

      if (paymentMethod === 'mpesa') {
        await handleMpesaContribution(cleanChamaId);
      } else if (paymentMethod === 'pay_for') {
        if (!selectedContributor) {
          Alert.alert(
            'Member Required',
            'Please select the member you want to pay for before proceeding.',
            [{ text: 'OK' }]
          );
          return;
        }
        await handlePayForContribution(cleanChamaId);
      } else {
        await handleWalletContribution(cleanChamaId);
      }
    } catch (error) {
      console.error('Contribution failed:', error);
      if (contributionType === 'merry-go-round') {
        const errorMessage = error.message || '';
        if (errorMessage.includes('already contributed')) {
          Toast.show({
            type: 'error',
            text1: 'Already Contributed',
            text2: 'You have already contributed to this merry-go-round round.',
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
            text2: 'The contribution amount does not match the required amount for this round.',
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
            text2: 'This payment method is not allowed for merry-go-round contributions.',
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
        text2: error.message || 'An error occurred while processing your contribution',
        position: 'top',
        visibilityTime: 4000,
        topOffset: 60,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWalletContribution = async (cleanChamaId) => {
    // For savings contributions, use the subwallet endpoint
    if (contributionType === 'savings') {
      const response = await ApiService.contributeToSavings(cleanChamaId, parseFloat(amount), description || getContributionDescription());

      if (response.success) {
        const backendBalance = response.data?.senderBalanceAfter;
        if (typeof backendBalance === 'number' && !isNaN(backendBalance)) {
          setWalletBalance(Math.max(0, backendBalance));
        } else {
          setWalletBalance(prev => Math.max(0, prev - parseFloat(amount || '0')));
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

        // Retry refresh shortly after in case writes haven't surfaced yet
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
      } else {
        throw new Error(response.error || 'Savings contribution failed');
      }
      return;
    }

    const validContributionType = (() => {
      const validTypes = ['regular', 'penalty', 'special', 'merry-go-round', 'welfare'];
      return validTypes.includes(contributionType) ? contributionType : 'regular';
    })();

    const contributionData = {
      chamaId: cleanChamaId,
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

    if (response.success) {
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

      const successTitle = contributionType === 'regular'
        ? 'Contribution Successful!'
        : `${getContributionTitle()} Successful!`;

      Toast.show({
        type: 'success',
        text1: successTitle,
        text2: getSuccessMessage(),
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
    } else {
      throw new Error(response.error || 'Wallet contribution failed');
    }
  };

  const getContributionDescription = () => {
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

  const getSuccessMessage = () => {
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

const handleMpesaContribution = async (cleanChamaId) => {
  // For welfare contributions, use the welfare endpoint
  if (contributionType === 'welfare') {
    // Use welfare contribute endpoint for welfare contributions
    const welfareData = {
      welfareRequestId: selectedWelfare?.id || proposalId,
      amount: parseFloat(amount),
      message: description || getDefaultDescription(),
      chamaId: cleanChamaId,
    };

    const mpesaResponse = await ApiService.contributeToWelfare(welfareData);

    if (mpesaResponse.success) {
      // Refresh wallet balance after successful contribution
      const oldBalance = walletBalance;
      await loadWalletBalance();
      // Also refresh the global wallet data in AppContext
      try {
        await refreshSpecificData('wallet');
      } catch (error) {
        console.warn('⚠️ Failed to refresh global wallet data:', error);
      }

      const getSuccessMessage = () => {
        const amountText = formatCurrency(parseFloat(amount));
        const chamaName = chama?.name || 'the group';
        let baseMessage;
        switch (contributionType) {
          case 'welfare':
            baseMessage = `You have successfully contributed ${amountText} via M-Pesa to the welfare fund`;
            break;
          default:
            baseMessage = `You have successfully contributed ${amountText} via M-Pesa to ${chamaName}`;
        }

        // Add anonymous note if applicable
        if (isAnonymous) {
          baseMessage += '\n\n🔒 This contribution was made anonymously and will appear as "Anonymous" in transaction records.';
        }

        return baseMessage;
      };
      Toast.show({
        type: 'success',
        text1: 'Welfare Contribution Successful!',
        text2: getSuccessMessage(),
        position: 'top',
        visibilityTime: 4000,
        topOffset: 60,
      });
      // Reset form and navigate back after a short delay
      setTimeout(() => {
        setAmount('');
        setDescription('');
        setIsAnonymous(false);
        navigation.goBack();
      }, 2000); // Give user time to see the toast
    } else {
      throw new Error(mpesaResponse.error || 'Welfare contribution failed');
    }
  } else {
    // Format user's registered phone number for M-Pesa
    let formattedPhone = user.phone.replace(/\s+/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('+254')) {
      formattedPhone = formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    const accountReference = `CHAMA-${cleanChamaId.substring(0, 8)}`;
    const transactionDesc = description || getDefaultDescription();

    function getDefaultDescription() {
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
    }
    const mpesaResponse = await ApiService.makeContribution({
      chamaId: cleanChamaId,
      amount: parseFloat(amount),
      description: transactionDesc,
      type: contributionType,
      paymentMethod: 'mpesa',
      mpesaReference: accountReference,
      status: 'pending',
      ...(selectedMerryGoRound ? { roundId: selectedMerryGoRound.id } : {}),
      ...(selectedWelfare ? { proposalId: selectedWelfare.id } : {}),
    });

    if (mpesaResponse.success) {
      Alert.alert(
        'M-Pesa Payment Initiated',
        `M-Pesa STK push sent to ${formattedPhone} for ${formatCurrency(parseFloat(amount))}. Please check your phone and enter your PIN to complete the payment. The contribution will be processed once payment is confirmed.`,
        [
          {
            text: 'Check Status',
            onPress: () => {
              // Reset form and navigate to transactions to check status
              setAmount('');
              setDescription('');
              navigation.navigate('ChamaTransactions');
            },
          },
          {
            text: 'OK',
            style: 'default',
            onPress: () => {
              // Reset form and navigate back
              setAmount('');
              setDescription('');
              navigation.goBack();
            },
          },
        ]
      );
    } else {
      throw new Error(mpesaResponse.error || 'Failed to initiate M-Pesa payment');
    }
  }
};

  const getDefaultDescription = () => {
    switch (contributionType) {
      case 'merry-go-round':
        return `Merry-Go-Round contribution to ${selectedMerryGoRound?.name || roundName || 'round'}`;
      case 'welfare':
        return selectedWelfare?.title || proposalTitle
          ? `Welfare support for: ${selectedWelfare?.title || proposalTitle}`
          : `Welfare contribution to ${chama?.name}`;
      default:
        return `${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)} contribution to ${chama?.name}`;
    }
  };

  const handlePayForContribution = async (cleanChamaId) => {
    if (!selectedContributor) {
      throw new Error('Please select the member you want to pay for');
    }

    const contributionAmount = parseFloat(amount);

    // Check wallet balance - same logic as wallet contribution
    if (walletBalance <= 0) {
      Alert.alert(
        'No Wallet Balance',
        'Your VaultKe wallet balance is KES 0.00. Please deposit money into your wallet before paying for someone.',
        [
          {
            text: 'Deposit Now',
            onPress: () => {
              navigation.navigate('WalletScreen', { tab: 'deposit' });
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
      return;
    }

    if (contributionAmount > walletBalance) {
      const shortfall = contributionAmount - walletBalance;
      Alert.alert(
        'Insufficient Wallet Balance',
        `Your VaultKe wallet balance is KES ${formatCurrency(walletBalance)}.\n\nYou need KES ${formatCurrency(shortfall)} more to pay KES ${formatCurrency(contributionAmount)} for ${selectedContributor.fullName}.`,
        [
          {
            text: 'Deposit Money',
            onPress: () => {
              navigation.navigate('WalletScreen', { tab: 'deposit' });
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
      return;
    }

    const validContributionType = (() => {
      const validTypes = ['regular', 'penalty', 'special', 'merry-go-round', 'welfare'];
      return validTypes.includes(contributionType) ? contributionType : 'regular';
    })();

    const contributionData = {
      chamaId: cleanChamaId,
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

    if (response.success) {
      // Deduct from current user's wallet
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

      const contributorName = selectedContributor.fullName;

      Toast.show({
        type: 'success',
        text1: 'Payment for Someone Successful!',
        text2: `You paid KES ${formatCurrency(contributionAmount)} for ${contributorName}. KES ${formatCurrency(contributionAmount)} has been deducted from your wallet.`,
        position: 'top',
        visibilityTime: 4000,
        topOffset: 60,
      });

      Alert.alert(
        'Payment Recorded Successfully',
        `You have paid KES ${formatCurrency(contributionAmount)} for ${contributorName}. The amount has been deducted from your VaultKe wallet.`,
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
            },
          },
        ]
      );
    } else {
      throw new Error(response.error || 'Failed to record payment for someone');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Helper function to generate a consistent avatar URL from email
  const getAvatarFromEmail = (email, size = 50) => {
    if (!email) return null;

    // Use a more reliable avatar service that doesn't have CORS issues
    // Extract initials from email for better avatar generation
    const emailParts = email.split('@')[0];
    const initials = emailParts.substring(0, 2).toUpperCase();

    // Use ui-avatars.com which is more reliable and doesn't have CORS issues
    return `https://ui-avatars.com/api/?name=${initials}&size=${size}&background=00D4AA&color=fff&format=png&rounded=true&bold=true`;
  };

  // Validate member selection for merry-go-round contributions
  const validateMemberSelection = (member) => {
    if (contributionType === 'merry-go-round') {
      // For merry-go-round, ensure the selected member is a participant
      const isParticipant = chamaMembers.some(m => m.id === member.id || m.user_id === member.id);
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

  // Validate payment method for merry-go-round contributions (matches backend assertions)
  const validatePaymentMethod = (method) => {
    if (contributionType === 'merry-go-round') {
      // Backend assertion: No anonymous contributions for merry-go-round
      if (isAnonymous) {
        Alert.alert(
          'Anonymous Contributions Not Allowed',
          'Anonymous contributions are not allowed for merry-go-round. All contributions must be traceable to maintain fairness.',
          [{ text: 'OK' }]
        );
        return false;
      }

      // Assertion: Only wallet, mpesa, and pay_for are valid payment methods for contributions
      const validMethods = ['wallet', 'mpesa', 'pay_for'];
      if (!validMethods.includes(method)) {
        Alert.alert(
          'Invalid Payment Method',
          `Only wallet, M-Pesa, and pay for someone payments are permitted.`,
          [{ text: 'OK' }]
        );
        return false;
      }

      // Backend assertion: Only wallet, M-Pesa, and pay_for allowed
      if (method !== 'wallet' && method !== 'mpesa' && method !== 'pay_for') {
        Alert.alert(
          'Invalid Payment Method',
          'Only wallet and M-Pesa payments are allowed for merry-go-round contributions.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }

    // Savings contributions only allow wallet payment
    if (contributionType === 'savings' && method !== 'wallet') {
      Alert.alert(
        'Invalid Payment Method',
        'Only wallet payments are allowed for savings contributions. Please use your VaultKe wallet.',
        [{ text: 'OK' }]
      );
      return false;
    }

    return true;
  };

  // Validate amount for merry-go-round contributions (matches backend assertions)
  const validateContributionAmount = (amount) => {
    if (contributionType === 'merry-go-round') {
      // Get expected amount from selected merry-go-round cycle, contribution status, current recipient, or route params
      const expectedAmount = selectedMerryGoRound?.amountPerRound || 
                           selectedMerryGoRound?.amount ||
                           contributionStatus?.amountPerRound || 
                           currentRecipient?.amountPerRound || 
                           amountPerRound || 0;

      if (expectedAmount > 0) {
        const inputAmount = parseFloat(amount);

        // Backend assertion: Exact amount matching required
        if (inputAmount !== expectedAmount) {
          Alert.alert(
            'Invalid Amount',
            `Merry-go-round contributions must be exactly ${expectedAmount} KES. You cannot contribute more or less than the required amount.`,
            [{ text: 'OK' }]
          );
          return false;
        }

      } else {
        console.warn('⚠️ No expected amount available for validation');
      }
    }
    return true;
  };

  // Helper function to render member avatar with real profile photo
  const renderMemberAvatar = (item) => {
    // Access data from nested user object (correct structure)
    const user = item?.user || {};
    const firstName = user?.first_name || item?.firstName || item?.first_name;
    const lastName = user?.last_name || item?.lastName || item?.last_name;
    const email = user?.email || item?.email;
    const memberId = item?.user_id || item?.userId;

    // Try multiple avatar sources from user object
    const avatarUrl = user?.avatar_url || user?.avatar || user?.profile_image || item?.avatar || item?.avatarUrl;

    // Try to use provided avatar URL first (if not failed before)
    if (avatarUrl && !failedAvatars.has(avatarUrl)) {
      let fullAvatarUrl;
      if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) {
        fullAvatarUrl = avatarUrl;
      } else {
        fullAvatarUrl = `${ApiService.baseURL}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
      }

      return (
        <Image
          source={{ uri: fullAvatarUrl }}
          style={styles.memberAvatar}
          onError={(error) => {
            // Mark this URL as failed to avoid repeated attempts
            setFailedAvatars(prev => new Set([...prev, avatarUrl]));
          }}
        />
      );
    }

    // Try generated avatar as fallback if email is available and not failed before
    if (email && !failedAvatars.has(email)) {
      const generatedAvatarUrl = getAvatarFromEmail(email, 40);
      return (
        <Image
          source={{ uri: generatedAvatarUrl }}
          style={styles.memberAvatar}
          onError={(error) => {
            // Mark this email as failed to avoid repeated attempts
            setFailedAvatars(prev => new Set([...prev, email]));
          }}
        />
      );
    }

    // Final fallback to initials
    return (
      <View style={[styles.memberAvatar, { backgroundColor: colors.primary }]}>
        <Text style={[styles.memberInitials, { color: colors.white }]}>
          {firstName?.[0]?.toUpperCase() || 'U'}{lastName?.[0]?.toUpperCase() || ''}
        </Text>
      </View>
    );
  };

  // Helper function to get member name from various data structures
  const getMemberName = (item) => {
    // Access from nested user object (correct structure)
    const user = item?.user || {};
    const firstName = user?.first_name || item?.firstName || item?.first_name || '';
    const lastName = user?.last_name || item?.lastName || item?.last_name || '';
    const fullName = item?.fullName || `${firstName} ${lastName}`.trim();

    // Fallback to email or ID if no name
    if (!fullName) {
      return user?.email || item?.email || `Member ${(item?.user_id || item?.id || '').slice(-4)}`;
    }

    return fullName;
  };

  // Render member card for the listing section
  const renderMemberCard = ({ item }) => {
    const isSelected = selectedContributor?.id === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.memberChip,
          {
            backgroundColor: isSelected ? colors.primary + '20' : colors.surface,
            borderColor: isSelected ? colors.primary : colors.border,
          },
        ]}
        onPress={() => {
          if (validateMemberSelection(item)) {
            setSelectedContributor(item);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.memberChipContent}>
          <View style={[styles.memberChipAvatar, { backgroundColor: isSelected ? colors.primary : colors.backgroundSecondary }]}>
            {renderMemberAvatar(item)}
          </View>
          <Text style={[styles.memberChipName, { color: isSelected ? colors.primary : colors.text }]} numberOfLines={1}>
            {getMemberName(item)}
          </Text>
        </View>
        {isSelected && (
          <View style={[styles.memberChipCheck, { backgroundColor: colors.primary }]}>
            <Ionicons name="checkmark" size={14} color={colors.white} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const getContributionTitle = () => {
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

  const getContributionSubtitle = () => {
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

  const getContributionIcon = () => {
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

  const getContributionColor = () => {
    switch (contributionType) {
      case 'merry-go-round':
        return colors.warning;
      case 'welfare':
        return '#EC4899'; // Pink
      case 'savings':
        return colors.success;
      case 'loan':
        return '#6366F1'; // Indigo
      case 'emergency':
        return colors.error;
      default:
        return colors.primary;
    }
  };

  if (chamaLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading chama details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {getContributionTitle()}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {getContributionSubtitle()}
          </Text>
        </View>

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
                     : chama?.name
                 }
               </Text>
               <Text style={[styles.chamaType, { color: colors.textSecondary }]}>
                 {contributionType === 'merry-go-round'
                   ? `Merry-Go-Round • ${chama?.name || 'Group'}`
                   : contributionType === 'welfare' && proposalTitle
                     ? `Welfare Support • ${chama?.name || 'Group'}`
                     : contributionType === 'regular'
                       ? `${chama?.type || 'Community'} • ${chama?.contributionFrequency || 'regular'} contributions`
                       : `${getContributionTitle()} • ${chama?.name || 'Group'}`
                 }
               </Text>
               <Text style={[styles.chamaAmount, { color: getContributionColor() }]}>
                 {contributionType === 'regular'
                   ? `Regular: ${amount ? formatCurrency(parseFloat(amount)) : formatCurrency(chama?.contributionAmount || 0)}`
                   : contributionType === 'welfare' && requestedAmount
                     ? `Needed: ${formatCurrency(requestedAmount)}`
                     : contributionType === 'merry-go-round' && amount
                       ? `Contributing: ${formatCurrency(parseFloat(amount))}`
                       : amount
                         ? `Amount: ${formatCurrency(parseFloat(amount))}`
                         : getContributionTitle()
                 }
               </Text>
             </View>
           </View>
         </Card>

{/* Current Recipient Info for Merry-Go-Round */}
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

            {/* Contribution Type Selection */}
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
              onToggleContributionType={() => setShowContributionTypeDropdown(!showContributionTypeDropdown)}
              onToggleMerryGoRound={() => setShowMerryGoRoundDropdown(!showMerryGoRoundDropdown)}
              onToggleWelfare={() => setShowWelfareDropdown(!showWelfareDropdown)}
              formatCurrency={formatCurrency}
            />

            {/* Payment Method Selection */}
            <PaymentMethodSelector
              paymentMethod={paymentMethod}
              walletBalance={walletBalance}
              amount={amount}
              setPaymentMethod={setPaymentMethod}
              formatCurrency={formatCurrency}
            />

            {/* Member Listing Section for Pay for Someone Contributions */}
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

            {/* M-Pesa Phone Number Display */}
            {paymentMethod === 'mpesa' && (
              <PhoneNumberDisplay user={user} />
            )}

{/* Pay for Someone Notice */}
            {paymentMethod === 'pay_for' && (
              <View style={styles.cashContributionContainer}>
                <View style={[styles.cashNotice, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
                  <Ionicons name="information-circle" size={20} color={colors.warning} />
                  <Text style={[styles.cashNoticeText, { color: colors.text }]}>
                    You are paying for a member. The amount will be deducted from your VaultKe wallet and the selected member will appear to have paid.
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
                  : setAmount
              }
              placeholder={
                contributionType === 'merry-go-round'
                  ? (selectedMerryGoRound 
                      ? "Amount set automatically from cycle"
                      : "Select a merry-go-round cycle first")
                  : contributionType === 'welfare' && selectedWelfare
                    ? "Amount from selected welfare"
                    : "Enter contribution amount"
              }
              keyboardType="numeric"
              leftIcon="wallet"
              editable={contributionType !== 'merry-go-round'}
              style={contributionType === 'merry-go-round' ? { backgroundColor: colors.surface + '80' } : undefined}
            />

            {/* Real-time validation for wallet payments */}
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
              onChangeText={setDescription}
              placeholder="Add a note for this contribution..."
              multiline
              numberOfLines={3}
              leftIcon="document-text"
            />

            {/* Anonymous Contribution Option - Only for Contribution Groups, not for Merry-Go-Round */}
            {chama?.category === 'contribution' && contributionType !== 'merry-go-round' && (
              <AnonymousContribution
                isAnonymous={isAnonymous}
                setIsAnonymous={setIsAnonymous}
              />
            )}

            {/* Merry-Go-Round Restrictions Notice */}
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
                ? "✅ You have already contributed!"
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
      </ScrollView>

      {/* Payment Confirmation Modal */}
      <PaymentConfirmationModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        amount={amount}
        paymentMethod={paymentMethod}
        walletBalance={walletBalance}
        selectedContributor={selectedContributor}
        chama={chama}
        user={user}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: typography.fontSize.base,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    ...shadows.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.base,
  },
  chamaInfoCard: {
    margin: spacing.md,
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
    margin: spacing.md,
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
  // Cash Contribution Styles (kept for Pay for Someone Notice)
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
  // Member Avatar Styles (used in renderMemberAvatar)
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  memberInitials: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
});

export default ContributeScreen;
