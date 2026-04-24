import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
  TouchableOpacity,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import ApiService from '../../services/api';


const ContributeScreen = ({ route, navigation }) => {
  // Extract all parameters - handle both direct chamaId and nested params
  const chamaId = route.params?.chamaId || route.params?.id;
  const contributionType = route.params?.contributionType || 'regular';
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
  const [paymentMethod, setPaymentMethod] = useState('wallet'); // 'wallet' or 'mpesa'
  const [walletBalance, setWalletBalance] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false); // For anonymous contributions

  // Cash contribution specific states
  const [chamaMembers, setChamaMembers] = useState([]);
  const [selectedContributor, setSelectedContributor] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [phone, setPhone] = useState(user?.phone || '');
  const [currentRecipient, setCurrentRecipient] = useState(null);
  const [failedAvatars, setFailedAvatars] = useState(new Set()); // Track failed avatar loads
  const [contributionStatus, setContributionStatus] = useState(null);
  const [statusCheckInterval, setStatusCheckInterval] = useState(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  useEffect(() => {
    // For merry-go-round contributions, set amount immediately from route params
    if (contributionType === 'merry-go-round' && amountPerRound && amountPerRound > 0) {
      // console.log('🎯 Setting merry-go-round amount from route params:', amountPerRound);
      setAmount(amountPerRound.toString());
    }

    loadChamaDetails();
    loadWalletBalance();
    checkUserRole();

    // For merry-go-round contributions, fetch current recipient info
    if (contributionType === 'merry-go-round' && chamaId) {
      loadCurrentRecipient();
    }
  }, [chamaId, contributionType, amountPerRound]);

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

  // Load chama members for cash contributions (only for treasurers)
  const loadChamaMembers = async () => {
    try {
      // For merry-go-round contributions, load members from the merry-go-round circle
      if (contributionType === 'merry-go-round' && roundId) {
        // console.log('🎯 Loading merry-go-round participants for circle:', roundId);
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

          // console.log('🎯 Filtered to', eligibleMembers.length, 'merry-go-round participants');
          // console.log('🎯 Participants:', eligibleMembers.map(p => ({ id: p.id, name: p.fullName, position: p.position })));
          setChamaMembers(eligibleMembers);
          return;
        }
      }

      // For regular contributions, load all chama members (treasurer only)
      // console.log('👥 Loading all chama members for regular contributions');
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
        if (statusData.hasContributed && !contributionStatus?.hasContributed) {
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

      console.log('Chama details response:', response); // Debug log

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
      console.log('🔄 Loading wallet balance...');
      const response = await ApiService.getWalletBalance();
      console.log('💰 Wallet balance response:', response);

      if (response.success && response.data) {
        const balance = response.data.balance || 0;
        setWalletBalance(balance);
        console.log('✅ Wallet balance loaded:', balance);
      } else {
        console.log('⚠️ Wallet balance response not successful:', response);
        setWalletBalance(0);
      }
    } catch (error) {
      console.error('❌ Failed to load wallet balance:', error);
      setWalletBalance(0);
    }
  };

  const handleContribute = async () => {
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
      console.log('🎪 Validating merry-go-round contribution...');

      // Refresh status before proceeding
      await checkContributionStatus();

      // Backend assertion: Check if user has already contributed to this round
      if (contributionStatus?.hasContributed) {
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

      console.log('✅ Merry-go-round validation passed');
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
    } else if (paymentMethod === 'cash' || paymentMethod === 'cheque') {
      // Validate cash/cheque contribution requirements
      if (!selectedContributor) {
        Alert.alert('Member Required', `Please select the member who made this ${paymentMethod} contribution.`);
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
        // Handle M-Pesa payment
        await handleMpesaContribution(cleanChamaId);
      } else if (paymentMethod === 'cash' || paymentMethod === 'cheque') {
        // Handle cash/cheque contribution
        await handleCashContribution(cleanChamaId);
      } else {
        // Handle wallet contribution
        await handleWalletContribution(cleanChamaId);
      }
    } catch (error) {
      console.error('Contribution failed:', error);

      // Handle merry-go-round specific errors
      if (contributionType === 'merry-go-round') {
        console.log('🎪 Handling merry-go-round specific error...');

        // Check for specific backend validation error messages
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
          // Refresh status to update UI
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

      // Generic error handling
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
    const contributionData = {
      chamaId: cleanChamaId,
      amount: parseFloat(amount),
      description: description || getDefaultDescription(),
      type: contributionType,
      paymentMethod: 'wallet',
      isAnonymous: chama?.category === 'contribution' ? isAnonymous : false, // Only for contribution groups
      ...(roundId && { roundId }), // Include roundId if it exists
      ...(proposalId && { proposalId }), // Include proposalId for welfare contributions
    };

    function getDefaultDescription() {
        switch (contributionType) {
          case 'merry-go-round':
            return `Merry-Go-Round contribution to ${roundName || 'round'}`;
          case 'welfare':
            return proposalTitle
              ? `Welfare support for: ${proposalTitle}`
              : `Welfare contribution to ${chama.name}`;
          default:
            return `Contribution to ${chama.name}`;
        }
      }

    console.log('🔄 Making contribution with data:', contributionData);
    console.log('🔄 Clean chamaId:', cleanChamaId);

    // Debug log for merry-go-round contributions
    if (contributionType === 'merry-go-round') {
      console.log('🎪 MERRY-GO-ROUND CONTRIBUTION DEBUG:', {
        roundId: roundId,
        roundName: roundName,
        amount: parseFloat(amount),
        expectedAmount: contributionStatus?.amountPerRound || currentRecipient?.amountPerRound,
        contributor: user?.id,
        chamaId: cleanChamaId,
        currentRecipient: currentRecipient?.fullName,
        currentRound: contributionStatus?.currentRound,
        hasContributed: contributionStatus?.hasContributed,
        isParticipant: contributionStatus?.isParticipant,
        paymentMethod: paymentMethod,
        isAnonymous: isAnonymous
      });
    }

    const response = await ApiService.makeContribution(contributionData);

    console.log('🔍 Contribution response:', response);

    if (response.success) {
      console.log('🎉 Contribution successful! Preparing success notification...');
      console.log('💰 Contribution successful, refreshing wallet balance...');

      // Refresh wallet balance after successful contribution
      const oldBalance = walletBalance;
      await loadWalletBalance();
      console.log(`💰 Wallet balance updated: ${oldBalance} → ${walletBalance}`);

      // Also refresh the global wallet data in AppContext
      try {
        await refreshSpecificData('wallet');
        console.log('✅ Global wallet data refreshed');
      } catch (error) {
        console.warn('⚠️ Failed to refresh global wallet data:', error);
      }

      const successTitle = contributionType === 'regular'
        ? 'Contribution Successful!'
        : `${getContributionTitle()} Successful!`;

      const getSuccessMessage = () => {
        const amountText = formatCurrency(parseFloat(amount));
        const chamaName = chama?.name || 'the group';

        console.log('🔍 Success message data:', {
          amountText,
          contributionType,
          chamaName,
          roundName,
          isAnonymous
        });

        let baseMessage;
        switch (contributionType) {
          case 'merry-go-round':
            baseMessage = `You have successfully contributed ${amountText} from your VaultKe wallet to ${roundName || 'the merry-go-round'}`;
            break;
          case 'welfare':
            baseMessage = `You have successfully contributed ${amountText} from your VaultKe wallet to the welfare fund`;
            break;
          case 'loan':
            baseMessage = `You have successfully contributed ${amountText} from your VaultKe wallet to the loan fund`;
            break;
          case 'emergency':
            baseMessage = `You have successfully contributed ${amountText} from your VaultKe wallet to the emergency fund`;
            break;
          default:
            baseMessage = `You have successfully contributed ${amountText} from your VaultKe wallet to ${chamaName}`;
        }

        // Add anonymous note if applicable
        if (isAnonymous) {
          baseMessage += '\n\n🔒 This contribution was made anonymously and will appear as "Anonymous" in transaction records.';
        }

        return baseMessage;
      };

      // Show success toast notification
      console.log('🎉 Showing success toast:', successTitle, getSuccessMessage());

      Toast.show({
        type: 'success',
        text1: successTitle,
        text2: getSuccessMessage(),
        position: 'top',
        visibilityTime: 4000,
        topOffset: 60,
      });

      console.log('🎉 Success toast should be displayed now');

      // Reset form and navigate back after a short delay
      setTimeout(() => {
        setAmount('');
        setDescription('');
        setIsAnonymous(false);
        navigation.goBack();
      }, 2000); // Give user time to see the toast
    } else {
      throw new Error(response.error || 'Wallet contribution failed');
    }
  };

  const handleMpesaContribution = async (cleanChamaId) => {
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
          return `Merry-Go-Round contribution to ${roundName || 'round'}`;
        case 'welfare':
          return proposalTitle
            ? `Welfare support for: ${proposalTitle}`
            : `Welfare contribution to ${chama.name}`;
        default:
          return `Contribution to ${chama.name}`;
      }
    }

    console.log('🔄 Initiating M-Pesa payment:', {
      phone: formattedPhone,
      amount: parseFloat(amount),
      reference: accountReference,
      description: transactionDesc
    });

    const mpesaResponse = await ApiService.initiateMpesaPayment(
      formattedPhone,
      parseFloat(amount),
      accountReference,
      transactionDesc
    );

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
  };

  const handleCashContribution = async (cleanChamaId) => {
    // Validate cash contribution requirements
    if (!selectedContributor) {
      throw new Error('Please select the member who made this contribution');
    }

    const contributionData = {
      chamaId: cleanChamaId,
      amount: parseFloat(amount),
      description: description || getDefaultDescription(),
      type: contributionType || 'regular',
      paymentMethod: paymentMethod, // 'cash' or 'cheque'
      contributorId: selectedContributor.id,
      cashType: paymentMethod, // 'cash' or 'cheque'
      isAnonymous: false, // Cash/cheque contributions can't be anonymous
    };

    console.log('🔄 Making cash contribution:', contributionData);

    const response = await ApiService.makeRequest('/contributions', {
      method: 'POST',
      body: JSON.stringify(contributionData),
    });

    if (response.success) {
      // Refresh data
      if (refreshSpecificData) {
        refreshSpecificData('chamas');
        refreshSpecificData('wallets');
        refreshSpecificData('transactions');
      }

      const contributorName = selectedContributor.fullName;

      const paymentTypeText = paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1);

      Toast.show({
        type: 'success',
        text1: `${paymentTypeText} Contribution Recorded`,
        text2: `${paymentTypeText} contribution by ${contributorName} recorded successfully`,
        position: 'top',
        visibilityTime: 4000,
        topOffset: 60,
      });

      // Show success alert with details
      Alert.alert(
        'Contribution Recorded Successfully',
        `${contributorName}'s ${paymentMethod} contribution of ${formatCurrency(parseFloat(amount))} has been recorded.`,
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
      throw new Error(response.error || 'Failed to record cash contribution');
    }

    function getDefaultDescription() {
      switch (contributionType) {
        case 'merry-go-round':
          return `Merry-Go-Round contribution to ${roundName || 'round'}`;
        case 'welfare':
          return proposalTitle
            ? `Welfare support for: ${proposalTitle}`
            : `Welfare contribution to ${chama.name}`;
        default:
          return `${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)} contribution to ${chama.name}`;
      }
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
      console.log('💳 Validating payment method for merry-go-round...');

      // Backend assertion: No anonymous contributions for merry-go-round
      if (isAnonymous) {
        Alert.alert(
          'Anonymous Contributions Not Allowed',
          'Anonymous contributions are not allowed for merry-go-round. All contributions must be traceable to maintain fairness.',
          [{ text: 'OK' }]
        );
        return false;
      }

      // Backend assertion: No cheque payments for merry-go-round
      if (method === 'cheque') {
        Alert.alert(
          'Invalid Payment Method',
          'Cheque payments are not allowed for merry-go-round contributions. Only wallet and M-Pesa payments are permitted.',
          [{ text: 'OK' }]
        );
        return false;
      }

      // Backend assertion: Only wallet and M-Pesa allowed
      if (method !== 'wallet' && method !== 'mpesa') {
        Alert.alert(
          'Invalid Payment Method',
          'Only wallet and M-Pesa payments are allowed for merry-go-round contributions.',
          [{ text: 'OK' }]
        );
        return false;
      }

      console.log('✅ Payment method validation passed:', method);
    }
    return true;
  };

  // Validate amount for merry-go-round contributions (matches backend assertions)
  const validateContributionAmount = (amount) => {
    if (contributionType === 'merry-go-round') {
      console.log('💰 Validating merry-go-round contribution amount...');

      // Get expected amount from contribution status, current recipient, or route params
      const expectedAmount = contributionStatus?.amountPerRound || currentRecipient?.amountPerRound || amountPerRound || 0;

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

        console.log('✅ Amount validation passed:', inputAmount, 'KES');
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
  const renderMemberCard = ({ item }) => (
    <TouchableOpacity
      style={[styles.memberListCard, { backgroundColor: colors.surface }]}
      onPress={() => {
        if (validateMemberSelection(item)) {
          setSelectedContributor(item);
        }
      }}
      activeOpacity={0.7}
    >
      <View style={styles.memberListContent}>
        <View style={styles.memberListAvatar}>
          {renderMemberAvatar(item)}
        </View>

        <View style={styles.memberListInfo}>
          <Text style={[styles.memberListName, { color: colors.text }]}>
            {getMemberName(item)}
          </Text>
          <Text style={[styles.memberListRole, { color: colors.textSecondary }]}>
            {item.role?.charAt(0).toUpperCase() + item.role?.slice(1) || 'Member'}
          </Text>
          <Text style={[styles.memberListContributions, { color: colors.textTertiary }]}>
            Total: {formatCurrency(item.total_contributions || 0)}
          </Text>
        </View>

        {selectedContributor?.id === item.id && (
          <View style={[styles.selectedIndicator, { backgroundColor: colors.primary, borderColor: colors.white }]}>
            <Ionicons name="checkmark" size={16} color={colors.white} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const getContributionTitle = () => {
    switch (contributionType) {
      case 'merry-go-round':
        return 'Merry-Go-Round Contribution';
      case 'welfare':
        return 'Welfare Contribution';
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
        return `Contribute to ${roundName || 'Merry-Go-Round'}`;
      case 'welfare':
        return proposalTitle
          ? `Support: ${proposalTitle}`
          : `Welfare fund for ${chama?.name || 'group'}`;
      case 'loan':
        return `Loan fund for ${chama?.name || 'group'}`;
      case 'emergency':
        return `Emergency fund for ${chama?.name || 'group'}`;
      default:
        return `Contribute to ${chama?.name || 'Loading...'}`;
    }
  };

  const getContributionIcon = () => {
    switch (contributionType) {
      case 'merry-go-round':
        return 'refresh-circle';
      case 'welfare':
        return 'heart';
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

        <Card style={styles.chamaInfoCard}>
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
           <Card style={[styles.chamaInfoCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
             <View style={styles.recipientInfo}>
               <View style={[styles.recipientIcon, { backgroundColor: colors.primary }]}>
                 <Ionicons name="person" size={20} color={colors.white} />
               </View>
               <View style={styles.recipientDetails}>
                 <Text style={[styles.recipientLabel, { color: colors.textSecondary }]}>
                   Contributing to:
                 </Text>
                 <Text style={[styles.recipientName, { color: colors.primary }]}>
                   {currentRecipient.fullName}
                 </Text>
                 <Text style={[styles.recipientPosition, { color: colors.textSecondary }]}>
                   Position {currentRecipient.position} • Round {currentRecipient.position}
                 </Text>
               </View>
             </View>

             {/* Real-time Contribution Status */}
             {contributionStatus && (
               <View style={styles.statusContainer}>
                 {/* Prominent Contribution Status Banner */}
                 <View style={[
                   styles.contributionStatusBanner,
                   {
                     backgroundColor: contributionStatus.hasContributed
                       ? colors.success + '20'
                       : colors.warning + '20',
                     borderColor: contributionStatus.hasContributed
                       ? colors.success
                       : colors.warning
                   }
                 ]}>
                   <View style={styles.statusBannerContent}>
                     <Ionicons
                       name={contributionStatus.hasContributed ? "checkmark-circle" : "radio-button-off"}
                       size={24}
                       color={contributionStatus.hasContributed ? colors.success : colors.warning}
                     />
                     <View style={styles.statusBannerText}>
                       <Text style={[
                         styles.statusBannerTitle,
                         { color: contributionStatus.hasContributed ? colors.success : colors.warning }
                       ]}>
                         {contributionStatus.hasContributed ? "✅ You Have Contributed" : "⏳ You Haven't Contributed Yet"}
                       </Text>
                       <Text style={[
                         styles.statusBannerSubtitle,
                         { color: colors.textSecondary }
                       ]}>
                         {contributionStatus.hasContributed
                           ? `You successfully contributed ${formatCurrency(contributionStatus.amountPerRound || 0)} to this round`
                           : `You need to contribute exactly ${formatCurrency(contributionStatus.amountPerRound || 0)} to participate in this round`
                         }
                       </Text>
                     </View>
                   </View>
                 </View>

                 <View style={styles.statusRow}>
                   <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
                     Round Progress:
                   </Text>
                   <View style={styles.progressContainer}>
                     <Text style={[styles.progressText, { color: colors.text }]}>
                       {contributionStatus.contributionStats?.totalContributions || 0}/{contributionStatus.contributionStats?.totalParticipants || 0} members
                     </Text>
                     <View style={styles.progressBar}>
                       <View
                         style={[
                           styles.progressFill,
                           {
                             width: `${contributionStatus.contributionStats?.progressPercentage || 0}%`,
                             backgroundColor: contributionStatus.contributionStats?.progressPercentage === 100 ? colors.success : colors.primary
                           }
                         ]}
                       />
                     </View>
                   </View>
                 </View>

                 {contributionStatus.roundComplete && (
                   <View style={[styles.roundCompleteNotice, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
                     <Ionicons name="trophy" size={16} color={colors.success} />
                     <Text style={[styles.roundCompleteText, { color: colors.success }]}>
                       🎉 Round Complete! The merry-go-round will advance to the next member automatically.
                     </Text>
                   </View>
                 )}
               </View>
             )}
           </Card>
         )}

        <Card style={styles.formCard}>
          <Text style={[styles.formTitle, { color: colors.text }]}>
            {contributionType === 'regular' ? 'Contribution Details' : `${getContributionTitle()} Details`}
          </Text>

          {/* Payment Method Selection */}
          <View style={styles.paymentMethodContainer}>
            <Text style={[styles.paymentMethodLabel, { color: colors.text }]}>
              Payment Method
            </Text>
            <View style={styles.paymentMethodOptions}>
              <TouchableOpacity
                style={[
                  styles.paymentMethodOption,
                  {
                    backgroundColor: colors.surface,
                    borderColor: paymentMethod === 'wallet' ? colors.primary : colors.border,
                    borderWidth: paymentMethod === 'wallet' ? 2 : 1,
                  }
                ]}
                onPress={() => setPaymentMethod('wallet')}
              >
                <Ionicons
                  name="wallet"
                  size={20}
                  color={paymentMethod === 'wallet' ? colors.primary : colors.text}
                />
                <Text
                  style={[
                    styles.paymentMethodText,
                    { color: paymentMethod === 'wallet' ? colors.primary : colors.text }
                  ]}
                >
                  VaultKe Wallet
                </Text>
                {paymentMethod === 'wallet' && (
                  <View style={styles.walletBalanceContainer}>
                    <Text
                      style={[
                        styles.paymentMethodBalance,
                        { color: paymentMethod === 'wallet' ? colors.primary : colors.textSecondary }
                      ]}
                    >
                      Balance: {formatCurrency(walletBalance)}
                    </Text>
                    {walletBalance <= 0 && (
                      <Text
                        style={[
                          styles.balanceWarning,
                          { color: colors.error }
                        ]}
                      >
                        ⚠️ No balance
                      </Text>
                    )}
                    {walletBalance > 0 && amount && parseFloat(amount) > walletBalance && (
                      <Text
                        style={[
                          styles.balanceWarning,
                          { color: colors.error }
                        ]}
                      >
                        ⚠️ Insufficient
                      </Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentMethodOption,
                  {
                    backgroundColor: colors.surface,
                    borderColor: paymentMethod === 'mpesa' ? colors.success : colors.border,
                    borderWidth: paymentMethod === 'mpesa' ? 2 : 1,
                  }
                ]}
                onPress={() => setPaymentMethod('mpesa')}
              >
                <Ionicons
                  name="phone-portrait"
                  size={20}
                  color={paymentMethod === 'mpesa' ? colors.success : colors.text}
                />
                <Text
                  style={[
                    styles.paymentMethodText,
                    { color: paymentMethod === 'mpesa' ? colors.success : colors.text }
                  ]}
                >
                  M-Pesa
                </Text>
              </TouchableOpacity>

              {/* Cash Payment Method */}
              <TouchableOpacity
                style={[
                  styles.paymentMethodOption,
                  {
                    backgroundColor: colors.surface,
                    borderColor: paymentMethod === 'cash' ? colors.warning : colors.border,
                    borderWidth: paymentMethod === 'cash' ? 2 : 1,
                    opacity: (userRole === 'treasurer' || userRole === 'chairperson') ? 1 : 0.6,
                  }
                ]}
                onPress={() => {
                  if (userRole === 'treasurer' || userRole === 'chairperson') {
                    setPaymentMethod('cash');
                  } else {
                    Alert.alert(
                      'Access Restricted',
                      'Only treasurers and chairpersons can record cash contributions for members.',
                      [{ text: 'OK' }]
                    );
                  }
                }}
              >
                <Ionicons
                  name="cash"
                  size={20}
                  color={paymentMethod === 'cash' ? colors.warning : colors.text}
                />
                <Text
                  style={[
                    styles.paymentMethodText,
                    { color: paymentMethod === 'cash' ? colors.warning : colors.text }
                  ]}
                >
                  Cash
                </Text>
                {(userRole === 'treasurer' || userRole === 'chairperson') ? (
                  <Text
                    style={[
                      styles.paymentMethodSubtext,
                      { color: colors.textSecondary }
                    ]}
                  >
                    Record for member
                  </Text>
                ) : (
                  <Text
                    style={[
                      styles.paymentMethodSubtext,
                      { color: colors.textSecondary }
                    ]}
                  >
                    Treasurer/Chair only
                  </Text>
                )}
              </TouchableOpacity>

              {/* Cheque Payment Method */}
              <TouchableOpacity
                style={[
                  styles.paymentMethodOption,
                  {
                    backgroundColor: colors.surface,
                    borderColor: paymentMethod === 'cheque' ? colors.info : colors.border,
                    borderWidth: paymentMethod === 'cheque' ? 2 : 1,
                    opacity: (userRole === 'treasurer' || userRole === 'chairperson') && contributionType !== 'merry-go-round' ? 1 : 0.6,
                  }
                ]}
                onPress={() => {
                  if (contributionType === 'merry-go-round') {
                    Alert.alert(
                      'Payment Method Not Allowed',
                      'Cheque payments are not allowed for merry-go-round contributions. Only wallet and M-Pesa payments are permitted.',
                      [{ text: 'OK' }]
                    );
                    return;
                  }

                  if (userRole === 'treasurer' || userRole === 'chairperson') {
                    setPaymentMethod('cheque');
                  } else {
                    Alert.alert(
                      'Access Restricted',
                      'Only treasurers and chairpersons can record cheque contributions for members.',
                      [{ text: 'OK' }]
                    );
                  }
                }}
              >
                <Ionicons
                  name="card"
                  size={20}
                  color={paymentMethod === 'cheque' ? colors.info : colors.text}
                />
                <Text
                  style={[
                    styles.paymentMethodText,
                    { color: paymentMethod === 'cheque' ? colors.info : colors.text }
                  ]}
                >
                  Cheque
                </Text>
                {(userRole === 'treasurer' || userRole === 'chairperson') ? (
                  <Text
                    style={[
                      styles.paymentMethodSubtext,
                      { color: colors.textSecondary }
                    ]}
                  >
                    Record for member
                  </Text>
                ) : (
                  <Text
                    style={[
                      styles.paymentMethodSubtext,
                      { color: colors.textSecondary }
                    ]}
                  >
                    Treasurer/Chair only
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            </View>
 
            {/* Member Listing Section for Cash/Cheque Contributions */}
            {(paymentMethod === 'cash' || paymentMethod === 'cheque') && (
              <View style={styles.memberListingSection}>
                <View style={styles.memberListingHeader}>
                  <Text style={[styles.memberListingTitle, { color: colors.text }]}>
                    {contributionType === 'merry-go-round'
                      ? `Select ${roundName || 'Merry-Go-Round'} Participant`
                      : `Select Member for ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)} Contribution`
                    }
                  </Text>
                  <Text style={[styles.memberListingSubtitle, { color: colors.textSecondary }]}>
                    {contributionType === 'merry-go-round'
                      ? `Only members of this merry-go-round circle can contribute`
                      : `Choose the member who made this contribution`
                    }
                  </Text>
                </View>
 
                {chamaMembers.length > 0 ? (
                  <View style={styles.memberListContainer}>
                    {chamaMembers.map((member) => (
                      <View key={member.id}>
                        {renderMemberCard({ item: member })}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={[styles.noMembersContainer, { backgroundColor: colors.surface }]}>
                    <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.noMembersText, { color: colors.textSecondary }]}>
                      {contributionType === 'merry-go-round'
                        ? `No participants in ${roundName || 'this merry-go-round'}`
                        : 'No members available for selection'
                      }
                    </Text>
                    <Text style={[styles.noMembersSubtext, { color: colors.textTertiary }]}>
                      {contributionType === 'merry-go-round'
                        ? 'Only circle participants can make contributions'
                        : 'Members will appear here once loaded'
                      }
                    </Text>
                  </View>
                )}
              </View>
            )}
 
            {/* M-Pesa Phone Number Display */}
            {paymentMethod === 'mpesa' && (
            <View style={styles.phoneNumberContainer}>
              <Text style={[styles.phoneNumberLabel, { color: colors.text }]}>
                M-Pesa Phone Number
              </Text>
              <View style={[styles.phoneNumberDisplay, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="call" size={20} color={colors.textSecondary} style={styles.phoneIcon} />
                <Text style={[styles.phoneNumberText, { color: colors.text }]}>
                  {user?.phone || 'No phone number registered'}
                </Text>
                <View style={[styles.readOnlyBadge, { borderColor: colors.primary, backgroundColor: 'transparent' }]}>
                  <Text style={[styles.readOnlyText, { color: colors.primary }]}>
                    Registered
                  </Text>
                </View>
              </View>
              <Text style={[styles.phoneNumberHint, { color: colors.textSecondary }]}>
                You will receive the M-Pesa prompt on this number
              </Text>
            </View>
          )}

          {/* Cash/Cheque Contribution Form */}
          {(paymentMethod === 'cash' || paymentMethod === 'cheque') && (
            <View style={styles.cashContributionContainer}>

              <View style={[styles.cashNotice, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
                <Ionicons name="information-circle" size={20} color={colors.warning} />
                <Text style={[styles.cashNoticeText, { color: colors.text }]}>
                  {contributionType === 'merry-go-round'
                    ? `As ${userRole}, you're recording a ${paymentMethod} contribution to ${roundName || 'this merry-go-round'} made by a circle participant.`
                    : `As ${userRole}, you're recording a ${paymentMethod} contribution made by the selected member.`
                  }
                </Text>
              </View>
            </View>
          )}

          <Input
            label="Amount (KES)"
            value={amount}
            onChangeText={contributionType === 'merry-go-round' ? undefined : setAmount}
            placeholder={
              contributionType === 'merry-go-round'
                ? (amount && amount !== '0' ? "Amount set automatically" : "Loading amount...")
                : "Enter contribution amount"
            }
            keyboardType="numeric"
            leftIcon="wallet"
            editable={contributionType !== 'merry-go-round'}
            style={contributionType === 'merry-go-round' ? { backgroundColor: colors.surface + '80' } : undefined}
          />

          {/* Real-time validation for wallet payments */}
          {paymentMethod === 'wallet' && amount && (
            <View style={styles.validationContainer}>
              {parseFloat(amount) > walletBalance ? (
                <View style={styles.validationMessage}>
                  <Ionicons name="warning" size={16} color={colors.error} />
                  <Text style={[styles.validationText, { color: colors.error }]}>
                    Insufficient balance. You need KES {formatCurrency(parseFloat(amount) - walletBalance)} more.
                  </Text>
                </View>
              ) : walletBalance <= 0 ? (
                <View style={styles.validationMessage}>
                  <Ionicons name="alert-circle" size={16} color={colors.error} />
                  <Text style={[styles.validationText, { color: colors.error }]}>
                    Your wallet balance is KES 0.00. Please deposit money first.
                  </Text>
                </View>
              ) : (
                <View style={styles.validationMessage}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={[styles.validationText, { color: colors.success }]}>
                    Sufficient balance. Remaining: KES {formatCurrency(walletBalance - parseFloat(amount))}
                  </Text>
                </View>
              )}
            </View>
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
            <View style={styles.anonymousContainer}>
              <TouchableOpacity
                style={styles.anonymousOption}
                onPress={() => setIsAnonymous(!isAnonymous)}
                activeOpacity={0.7}
              >
                <View style={styles.anonymousCheckbox}>
                  <Ionicons
                    name={isAnonymous ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={isAnonymous ? colors.primary : colors.textSecondary}
                  />
                </View>
                <View style={styles.anonymousTextContainer}>
                  <Text style={[styles.anonymousLabel, { color: colors.text }]}>
                    Contribute Anonymously
                  </Text>
                  <Text style={[styles.anonymousDescription, { color: colors.textSecondary }]}>
                    Your name will not be shown in the transaction history
                  </Text>
                </View>
              </TouchableOpacity>

              {isAnonymous && (
                <View style={styles.anonymousNotice}>
                  <Ionicons name="information-circle" size={16} color={colors.info} />
                  <Text style={[styles.anonymousNoticeText, { color: colors.info }]}>
                    This contribution will appear as "Anonymous" in all transaction records
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Merry-Go-Round Restrictions Notice */}
          {contributionType === 'merry-go-round' && (
            <View style={[styles.anonymousContainer, { backgroundColor: colors.warning + '10', borderColor: colors.warning }]}>
              <View style={styles.anonymousOption}>
                <View style={styles.anonymousCheckbox}>
                  <Ionicons
                    name="information-circle"
                    size={24}
                    color={colors.warning}
                  />
                </View>
                <View style={styles.anonymousTextContainer}>
                  <Text style={[styles.anonymousLabel, { color: colors.text }]}>
                    Merry-Go-Round Rules
                  </Text>
                  <Text style={[styles.anonymousDescription, { color: colors.textSecondary }]}>
                    • Exact amount required: {contributionStatus?.amountPerRound || currentRecipient?.amountPerRound || amountPerRound || 'Loading...'} KES{'\n'}
                    • Only wallet and M-Pesa payments allowed{'\n'}
                    • Anonymous contributions not permitted{'\n'}
                    • Each member can contribute only once per round{'\n'}
                    • Round advances automatically when all members contribute
                  </Text>
                </View>
              </View>
            </View>
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
              contributionType === 'merry-go-round' && contributionStatus?.hasContributed
                ? "✅ You Have Already Contributed"
                : contributionType === 'merry-go-round'
                  ? (!amount || amount === '0')
                    ? (amountPerRound && amountPerRound > 0)
                      ? `Contribute ${formatCurrency(amountPerRound)}`
                      : "Loading Contribution Details..."
                    : `Contribute ${formatCurrency(parseFloat(amount))}`
                  : "Make Contribution"
            }
            onPress={handleContribute}
            loading={loading}
            disabled={
              !amount ||
              parseFloat(amount) <= 0 ||
              (contributionType === 'merry-go-round' && contributionStatus?.hasContributed) ||
              (contributionType === 'merry-go-round' && (!amount || amount === '0') && !(amountPerRound && amountPerRound > 0))
            }
            variant="outline"
            style={styles.contributeButton}
            icon={
              <Ionicons
                name={
                  contributionType === 'merry-go-round' && contributionStatus?.hasContributed
                    ? "checkmark-circle"
                    : contributionType === 'merry-go-round' && (!amount || amount === '0') && !(amountPerRound && amountPerRound > 0)
                      ? "time"
                      : "add-circle"
                }
                size={20}
                color={
                  !amount || parseFloat(amount) <= 0 ||
                  (contributionType === 'merry-go-round' && contributionStatus?.hasContributed) ||
                  (contributionType === 'merry-go-round' && (!amount || amount === '0') && !(amountPerRound && amountPerRound > 0))
                    ? colors.textSecondary
                    : colors.primary
                }
              />
            }
          />
        </Card>
      </ScrollView>


      {/* Payment Confirmation Modal */}
      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Confirm Contribution
              </Text>
              <TouchableOpacity
                onPress={() => setShowPaymentModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.confirmationRow}>
                <Text style={[styles.confirmationLabel, { color: colors.textSecondary }]}>
                  Amount:
                </Text>
                <Text style={[styles.confirmationValue, { color: colors.text }]}>
                  {formatCurrency(parseFloat(amount || 0))}
                </Text>
              </View>

              <View style={styles.confirmationRow}>
                <Text style={[styles.confirmationLabel, { color: colors.textSecondary }]}>
                  Payment Method:
                </Text>
                <Text style={[styles.confirmationValue, { color: colors.text }]}>
                  {paymentMethod === 'wallet' ? 'VaultKe Wallet' :
                   paymentMethod === 'mpesa' ? 'M-Pesa' :
                   paymentMethod === 'cash' ? 'Cash' :
                   paymentMethod === 'cheque' ? 'Cheque' : 'Unknown'}
                </Text>
              </View>

              {paymentMethod === 'wallet' && (
                <View style={styles.confirmationRow}>
                  <Text style={[styles.confirmationLabel, { color: colors.textSecondary }]}>
                    Wallet Balance:
                  </Text>
                  <Text style={[styles.confirmationValue, { color: colors.text }]}>
                    {formatCurrency(walletBalance)}
                  </Text>
                </View>
              )}

              {paymentMethod === 'mpesa' && (
                <View style={styles.confirmationRow}>
                  <Text style={[styles.confirmationLabel, { color: colors.textSecondary }]}>
                    M-Pesa Number:
                  </Text>
                  <Text style={[styles.confirmationValue, { color: colors.text }]}>
                    {user?.phone || 'Not available'}
                  </Text>
                </View>
              )}

              {(paymentMethod === 'cash' || paymentMethod === 'cheque') && (
                <>
                  <View style={styles.confirmationRow}>
                    <Text style={[styles.confirmationLabel, { color: colors.textSecondary }]}>
                      Contributor:
                    </Text>
                    <Text style={[styles.confirmationValue, { color: colors.text }]}>
                      {selectedContributor?.fullName || 'Not selected'}
                    </Text>
                  </View>

                  <View style={[styles.cashConfirmationNotice, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
                    <Ionicons name="information-circle" size={16} color={colors.warning} />
                    <Text style={[styles.cashConfirmationNoticeText, { color: colors.text }]}>
                      {contributionType === 'merry-go-round'
                        ? `As ${userRole}, you are recording this ${paymentMethod} contribution to ${roundName || 'the merry-go-round'} on behalf of ${selectedContributor?.fullName}, a circle participant.`
                        : `As ${userRole}, you are recording this ${paymentMethod} contribution on behalf of ${selectedContributor?.fullName}`
                      }
                    </Text>
                  </View>
                </>
              )}

              {paymentMethod === 'cash' && (
                <>
                  <View style={styles.confirmationRow}>
                    <Text style={[styles.confirmationLabel, { color: colors.textSecondary }]}>
                      Contributor:
                    </Text>
                    <Text style={[styles.confirmationValue, { color: colors.text }]}>
                      {selectedContributor?.fullName || 'Not selected'}
                    </Text>
                  </View>


                </>
              )}

              <View style={styles.confirmationRow}>
                <Text style={[styles.confirmationLabel, { color: colors.textSecondary }]}>
                  Contributing to:
                </Text>
                <Text style={[styles.confirmationValue, { color: colors.text }]}>
                  {chama?.name}
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowPaymentModal(false)}
                style={styles.modalCancelButton}
              />
              <Button
                title={
                  paymentMethod === 'wallet' ? 'Confirm Transfer' :
                  paymentMethod === 'mpesa' ? 'Pay with M-Pesa' :
                  paymentMethod === 'cash' ? 'Record Contribution' :
                  paymentMethod === 'cheque' ? 'Record Contribution' : 'Confirm'
                }
                onPress={confirmContribution}
                loading={loading}
                variant="outline"
                style={styles.modalConfirmButton}
                icon={
                  <Ionicons
                    name={
                      paymentMethod === 'wallet' ? 'wallet' :
                      paymentMethod === 'mpesa' ? 'phone-portrait' :
                      paymentMethod === 'cash' ? 'cash' :
                      paymentMethod === 'cheque' ? 'card' : 'checkmark'
                    }
                    size={20}
                    color={colors.primary}
                  />
                }
              />
            </View>
          </View>
        </View>
      </Modal>
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
  // Payment Method Styles
  paymentMethodContainer: {
    marginBottom: spacing.lg,
  },
  paymentMethodLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  paymentMethodOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  paymentMethodOption: {
    width: '48%', // Two columns layout
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    minHeight: 85,
    justifyContent: 'center',
    ...shadows.sm,
  },
  paymentMethodText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  paymentMethodBalance: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  walletBalanceContainer: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  balanceWarning: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: typography.fontWeight.medium,
  },
  // Validation Styles
  validationContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  validationMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  validationText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.xs,
    flex: 1,
  },
  // Phone Number Display Styles
  phoneNumberContainer: {
    marginBottom: spacing.lg,
  },
  phoneNumberLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  phoneNumberDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  phoneIcon: {
    marginRight: spacing.sm,
  },
  phoneNumberText: {
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  readOnlyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  readOnlyText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  phoneNumberHint: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.lg,
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalBody: {
    padding: spacing.lg,
  },
  confirmationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  confirmationLabel: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  confirmationValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    marginRight: spacing.xs,
  },
  modalConfirmButton: {
    flex: 2,
    minHeight: 48,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    marginLeft: spacing.xs,
  },
  // Anonymous contribution styles
  anonymousContainer: {
    marginVertical: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  anonymousOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  anonymousCheckbox: {
    marginRight: spacing.md,
    marginTop: 2, // Align with text
  },
  anonymousTextContainer: {
    flex: 1,
  },
  anonymousLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  anonymousDescription: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
  },
  anonymousNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(59, 130, 246, 0.1)', // Light blue background
    marginTop: spacing.sm,
  },
  anonymousNoticeText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
  // Cash Contribution Styles
  paymentMethodSubtext: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  cashContributionContainer: {
    marginBottom: spacing.lg,
  },
  memberSelectionContainer: {
    marginBottom: spacing.lg,
  },
  memberSelectionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  memberSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    minHeight: 60,
  },
  selectedMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedMemberName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
    flex: 1,
  },
  selectedMemberRole: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
  },
  memberSelectorPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberSelectorText: {
    fontSize: typography.fontSize.base,
    marginLeft: spacing.sm,
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
  // Member Search Modal Styles
  memberSearchModal: {
    flex: 1,
    marginTop: 50,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    ...shadows.lg,
  },
  searchContainer: {
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  searchInput: {
    marginBottom: 0,
  },
  membersList: {
    flex: 1,
    padding: spacing.lg,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitials: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  memberDetails: {
    marginLeft: spacing.md,
    flex: 1,
  },
  memberName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  memberEmail: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  memberRole: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginRight: spacing.md,
  },
  memberContributions: {
    fontSize: typography.fontSize.xs,
  },
  noMembersFound: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  noMembersText: {
    fontSize: typography.fontSize.base,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  // Cash confirmation modal styles
  cashConfirmationNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  cashConfirmationNoticeText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
  // Recipient Info Styles for Merry-Go-Round
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipientIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  recipientDetails: {
    flex: 1,
  },
  recipientLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  recipientName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  recipientPosition: {
    fontSize: typography.fontSize.sm,
  },
  // Real-time Status Styles
  statusContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statusLabel: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  progressContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  progressText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    width: 80,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  roundCompleteNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  roundCompleteText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
    flex: 1,
  },
  // Contribution Status Banner Styles
  contributionStatusBanner: {
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  statusBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBannerText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  statusBannerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  statusBannerSubtitle: {
    fontSize: typography.fontSize.sm,
    lineHeight: 16,
  },
  // Member Listing Section Styles
  memberListingSection: {
    marginHorizontal: spacing.xs, // Close to screen edges
    marginVertical: spacing.md,
    maxHeight: Dimensions.get('window').height * 0.5, // Half screen height
  },
  memberListingHeader: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  memberListingTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  memberListingSubtitle: {
    fontSize: typography.fontSize.sm,
  },
  memberListContainer: {
    gap: spacing.sm,
  },
  memberListCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...shadows.sm,
    minHeight: 80, // Ensure consistent card height
  },
  memberListContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberListAvatar: {
    marginRight: spacing.md,
  },
  memberAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    // Add subtle shadow for better visual appeal
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // For Android shadow
  },
  memberInitials: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  memberListInfo: {
    flex: 1,
  },
  memberListName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  memberListRole: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  memberListContributions: {
    fontSize: typography.fontSize.xs,
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  viewAllMembersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: spacing.sm,
  },
  viewAllMembersText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginRight: spacing.xs,
  },
  noMembersContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  noMembersText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  noMembersSubtext: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
});

export default ContributeScreen;
