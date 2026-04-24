import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { spacing, typography, borderRadius } from '../../utils/theme';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import MessageBanner from '../../components/common/MessageBanner';
import ApiService from '../../services/api';

// 🏦 MODERN SHARES & DIVIDENDS MANAGEMENT SCREEN
// Comprehensive share trading and dividend management platform
// Built with excellent mobile UX and integration with Account Management

const SharesDividendsScreen = ({ route, navigation }) => {
  const { chamaId } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  // Responsive layout logic
  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < 768;
  const isTablet = screenWidth >= 768 && screenWidth < 1024;
  const isDesktop = screenWidth >= 1024;
  const isLargeScreen = screenWidth >= 768;

  // 📱 CORE STATE
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('portfolio'); // 'portfolio', 'market', 'dividends', 'history'

  // 📊 DATA STATE
  const [dataReady, setDataReady] = useState(false);
  const [userShares, setUserShares] = useState(null); // User's personal share portfolio
  const [availableShares, setAvailableShares] = useState([]); // Shares available for purchase
  const [dividends, setDividends] = useState([]);
  const [shareHistory, setShareHistory] = useState([]);
  const [marketData, setMarketData] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0); // User's wallet balance

  // 🔐 USER & PERMISSIONS
  const [userRole, setUserRole] = useState('member');

  // 🎭 MODAL STATE
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showBuyDividendsModal, setShowBuyDividendsModal] = useState(false);
  const [selectedShare, setSelectedShare] = useState(null);
  const [selectedDividend, setSelectedDividend] = useState(null);

   // 🎉 SUCCESS BANNER STATE
   const [successMessage, setSuccessMessage] = useState(null);
   const [errorMessage, setErrorMessage] = useState(null);

  // 🎨 ANIMATION REFS
  const slideAnim = useRef(new Animated.Value(0)).current;

  // 💰 BUY SHARES FORM
  const [buyForm, setBuyForm] = useState({
    shareType: 'ordinary',
    quantity: '',
    pricePerShare: '',
    totalAmount: '',
    paymentMethod: 'wallet',
    notes: '',
  });

  // 💸 SELL SHARES FORM
  const [sellForm, setSellForm] = useState({
    shareType: 'ordinary',
    quantity: '',
    pricePerShare: '',
    totalAmount: '',
    reason: '',
    notes: '',
  });

  // 🔄 TRANSFER SHARES FORM
  const [transferForm, setTransferForm] = useState({
    shareId: '',
    toMemberId: '',
    toMemberName: '',
    sharesCount: '',
    transferPrice: '',
    totalAmount: '',
    notes: '',
  });

  // 👥 CHAMA MEMBERS FOR TRANSFER
  const [chamaMembers, setChamaMembers] = useState([]);

  // � BUY DIVIDENDS FORM
  const [buyDividendsForm, setBuyDividendsForm] = useState({
    quantity: '',
    pricePerShare: '',
    totalAmount: '',
    paymentMethod: 'mobile_money',
    notes: '',
  });

  // Removed unused dividend form state

  useEffect(() => {
    loadData();
  }, [chamaId]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadUserShares(),
        loadAvailableShares(),
        loadDividends(),
        loadShareHistory(),
        loadUserRole(),
        loadWalletBalance(),
        loadChamaMembers(),
      ]);
      setDataReady(true);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load shares and dividends data');
    } finally {
      setLoading(false);
    }
  };

  // 👤 LOAD USER'S PERSONAL SHARE PORTFOLIO
  const loadUserShares = async () => {
    try {
      const response = await ApiService.getMemberShares(chamaId, user.id);
      if (response.success && response.data) {
        // Transform the data to match expected format
        const sharesData = response.data;
        const totalShares = sharesData.reduce((sum, share) => sum + (share.sharesOwned || 0), 0);
        const totalValue = sharesData.reduce((sum, share) => sum + (share.totalValue || 0), 0);
        const averagePrice = totalShares > 0 ? totalValue / totalShares : 0;

        // Group by share type for shareTypes breakdown
        const shareTypesMap = {};
        sharesData.forEach(share => {
          const type = share.shareType || 'ordinary';
          if (!shareTypesMap[type]) {
            shareTypesMap[type] = {
              type: type,
              quantity: 0,
              value: 0,
              averagePrice: share.shareValue || 0,
              certificateNumber: share.certificateNumber
            };
          }
          shareTypesMap[type].quantity += share.sharesOwned || 0;
          shareTypesMap[type].value += share.totalValue || 0;
        });

        const shareTypes = Object.values(shareTypesMap);

        setUserShares({
          totalShares,
          totalValue,
          shareTypes,
          averagePrice,
          totalDividendsReceived: 0, // TODO: Implement when dividends are available
          portfolioPerformance: 0, // TODO: Calculate based on market data
          purchases: sharesData // Store raw purchase data for history
        });
      } else {
        console.error('Failed to load user shares:', response.error);
        setUserShares({
          totalShares: 0,
          totalValue: 0,
          shareTypes: [],
          averagePrice: 0,
          totalDividendsReceived: 0,
          portfolioPerformance: 0,
          purchases: []
        });
      }
    } catch (error) {
      console.error('Error loading user shares:', error);
      setUserShares({
        totalShares: 0,
        totalValue: 0,
        shareTypes: [],
        averagePrice: 0,
        totalDividendsReceived: 0,
        portfolioPerformance: 0,
        purchases: []
      });
    }
  };

  // 🏪 LOAD AVAILABLE SHARES FOR PURCHASE
  const loadAvailableShares = async () => {
    try {
      const response = await ApiService.getAvailableShares(chamaId);
      if (response.success) {
        setAvailableShares(response.data || []);
      } else {
        console.error('Failed to load available shares:', response.error);
        setAvailableShares([]);
      }
    } catch (error) {
      console.error('Error loading available shares:', error);
      setAvailableShares([]);
    }
  };

  // 📈 LOAD SHARE TRANSACTION HISTORY (now uses user shares data)
  const loadShareHistory = async () => {
    // History is now derived from user shares data, so no separate API call needed
    // The data will be set when loadUserShares completes
    setShareHistory([]);
  };

  // 📊 LOAD MARKET DATA
  const loadMarketData = async () => {
    try {
      const response = await ApiService.getShareMarketData(chamaId);
      if (response.success) {
        setMarketData(response.data || {
          currentPrice: 0,
          priceChange: 0,
          priceChangePercent: 0,
          volume: 0,
          marketCap: 0,
          lastUpdated: new Date(),
        });
      } else {
        console.error('Failed to load market data:', response.error);
        setMarketData(null);
      }
    } catch (error) {
      console.error('Error loading market data:', error);
      setMarketData(null);
    }
  };

  const loadDividends = async () => {
    try {
      const response = await ApiService.getChamaDividendDeclarations(chamaId);
      if (response.success) {
        setDividends(response.data || []);
      } else {
        console.error('Failed to load dividends:', response.error);
        // Set empty array for graceful handling
        setDividends([]);
      }
    } catch (error) {
      console.error('Error loading dividends:', error);
      // Set empty array for graceful handling
      setDividends([]);
    }
  };


  const loadUserRole = async () => {
    try {
      const response = await ApiService.getMemberRole(chamaId, user.id);
      if (response.success) {
        setUserRole(response.data?.role || 'member');
      } else {
        setUserRole('member'); // Default to member if role fetch fails
      }
    } catch (error) {
      console.error('Error loading user role:', error);
      setUserRole('member'); // Default to member on error
    }
  };

  // 💰 LOAD WALLET BALANCE
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

  // 👥 LOAD CHAMA MEMBERS FOR TRANSFER
  const loadChamaMembers = async () => {
    try {
      const response = await ApiService.getChamaMembers(chamaId);
      if (response.success) {
        // Filter out current user and only include active members
        const availableMembers = response.data.filter(member =>
          member.id !== user.id && member.is_active
        );
        setChamaMembers(availableMembers);
      } else {
        console.error('Failed to load chama members:', response.error);
        setChamaMembers([]);
      }
    } catch (error) {
      console.error('Error loading chama members:', error);
      setChamaMembers([]);
    }
  };

  // 💰 BUY SHARES FUNCTIONALITY
   const handleBuyShares = async () => {
     console.log('🚀 DEBUG: handleBuyShares called');

     if (!buyForm.quantity || !buyForm.pricePerShare) {
       console.log('❌ DEBUG: Validation failed - missing quantity or price');
       Alert.alert('Validation Error', 'Please fill in all required fields.');
       return;
     }

    const quantity = parseInt(buyForm.quantity);
    const pricePerShare = parseFloat(buyForm.pricePerShare);
    const totalAmount = quantity * pricePerShare;

    // Validate quantity limits
    if (selectedShare) {
      if (quantity < selectedShare.minimumPurchase) {
        Alert.alert('Validation Error', `Minimum purchase is ${selectedShare.minimumPurchase} shares.`);
        return;
      }
      if (quantity > selectedShare.totalShares) {
        Alert.alert('Validation Error', `Only ${selectedShare.totalShares} shares are available.`);
        return;
      }
    }

    // Validate wallet balance if wallet payment is selected
    if (buyForm.paymentMethod === 'wallet') {
      if (walletBalance <= 0) {
        Alert.alert(
          'No Wallet Balance',
          'Your VaultKe wallet balance is KES 0.00. Please deposit money into your wallet before making a share purchase.',
          [
            {
              text: 'Deposit Now',
              onPress: () => {
                // Navigate to wallet screen
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

      if (totalAmount > walletBalance) {
        const shortfall = totalAmount - walletBalance;

        Alert.alert(
          'Insufficient Wallet Balance',
          `Your VaultKe wallet balance is KES ${formatCurrency(walletBalance)}.\n\nYou need KES ${formatCurrency(shortfall)} more to purchase ${quantity} shares at KES ${formatCurrency(pricePerShare)} each.\n\nWould you like to deposit money or reduce the quantity?`,
          [
            {
              text: 'Deposit Money',
              onPress: () => {
                navigation.navigate('WalletScreen', { tab: 'deposit' });
              }
            },
            {
              text: 'Reduce Quantity',
              onPress: () => {
                const maxQuantity = Math.floor(walletBalance / pricePerShare);
                if (maxQuantity > 0) {
                  setBuyForm(prev => ({ ...prev, quantity: maxQuantity.toString() }));
                }
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
    }

    // Clear any previous messages
    setSuccessMessage(null);
    setErrorMessage(null);

    // Process purchase instantly without confirmation
    try {
      const purchaseData = {
        shareType: buyForm.shareType,
        quantity,
        pricePerShare,
        totalAmount,
        paymentMethod: buyForm.paymentMethod,
        notes: buyForm.notes,
        PurchaseDate: new Date(),
      };

      console.log('🔄 DEBUG: Calling buyShares API with data:', {
        chamaId,
        userId: user.id,
        purchaseData: {
          ...purchaseData,
          offeringId: selectedShare.id,
        }
      });

      const response = await ApiService.buyShares(chamaId, user.id, {
        ...purchaseData,
        offeringId: selectedShare.id,
      });

      console.log('📡 DEBUG: buyShares API response:', response);

      if (response.success) {
        console.log('✅ DEBUG: Share purchase successful, checking for certificate and database recording');
        console.log('📊 DEBUG: Response data:', response.data);

        // Check if certificate was awarded
        let certificateMessage = '';
        if (response.data?.certificateNumber) {
          console.log('🏆 DEBUG: Certificate awarded:', response.data.certificateNumber);
          certificateMessage = ` Certificate #${response.data.certificateNumber} awarded!`;
        } else {
          console.log('⚠️ DEBUG: No certificate number in response');
        }

        // Show success banner instead of Alert
        setSuccessMessage(`Shares purchased successfully!${certificateMessage} Your portfolio has been updated.`);

        setShowBuyModal(false);
        resetBuyForm();
        await loadData(); // Refresh all data
      } else {
        console.log('❌ DEBUG: Share purchase failed:', response.error);
        console.log('📊 DEBUG: Full response:', response);
        setErrorMessage(response.error || response.details || 'Failed to purchase shares');
      }
    } catch (error) {
      console.error('Error buying shares:', error);
      Alert.alert('Error', 'Failed to process share purchase');
    }
  };

  // 💰 BUY DIVIDENDS FUNCTIONALITY
  const handleBuyDividends = async () => {
    if (!buyDividendsForm.quantity || !buyDividendsForm.pricePerShare) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }

    const quantity = parseInt(buyDividendsForm.quantity);
    const pricePerShare = parseFloat(buyDividendsForm.pricePerShare);
    const totalAmount = quantity * pricePerShare;

    // Basic validation
    if (quantity <= 0) {
      Alert.alert('Validation Error', 'Quantity must be greater than 0.');
      return;
    }

    Alert.alert(
      'Confirm Purchase',
      `You are about to buy ${quantity} dividend certificates at KES ${formatCurrency(pricePerShare)} each.\n\nTotal Amount: KES ${formatCurrency(totalAmount)}\n\nProceed with purchase?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy Certificates',
          onPress: async () => {
            try {
              const purchaseData = {
                quantity,
                pricePerShare,
                totalAmount,
                paymentMethod: buyDividendsForm.paymentMethod,
                notes: buyDividendsForm.notes,
                purchaseDate: new Date(),
              };

              const response = await ApiService.buyDividends(chamaId, user.id, {
                ...purchaseData,
                declarationId: selectedDividend.id,
              });

              if (response.success) {
                Alert.alert('Success', 'Dividend certificates purchased successfully! Your portfolio has been updated.');
                setShowBuyDividendsModal(false);
                resetBuyDividendsForm();
                await loadData(); // Refresh all data
              } else {
                Alert.alert('Error', response.error || 'Failed to purchase dividend certificates');
              }
            } catch (error) {
              console.error('Error buying dividends:', error);
              Alert.alert('Error', 'Failed to process dividend certificate purchase');
            }
          }
        }
      ]
    );
  };

  // 💸 SELL SHARES FUNCTIONALITY
  const handleSellShares = async () => {
    if (!sellForm.quantity || !sellForm.pricePerShare) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }

    const quantity = parseInt(sellForm.quantity);
    const pricePerShare = parseFloat(sellForm.pricePerShare);
    const totalAmount = quantity * pricePerShare;

    // Check if user has enough shares
    if (userShares && quantity > userShares.totalShares) {
      Alert.alert('Insufficient Shares', `You only have ${userShares.totalShares} shares available for sale.`);
      return;
    }

    Alert.alert(
      'Confirm Sale',
      `You are about to sell ${quantity} shares at KES ${formatCurrency(pricePerShare)} each.\n\nTotal Amount: KES ${formatCurrency(totalAmount)}\n\nProceed with sale?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sell Shares',
          onPress: async () => {
            try {
              const saleData = {
                shareType: sellForm.shareType,
                quantity,
                pricePerShare,
                totalAmount,
                reason: sellForm.reason,
                notes: sellForm.notes,
                saleDate: new Date(),
              };

              const response = await ApiService.sellShares(chamaId, user.id, saleData);

              if (response.success) {
                Alert.alert('Success', 'Shares sold successfully! Your portfolio has been updated.');
                setShowSellModal(false);
                resetSellForm();
                await loadData(); // Refresh all data
              } else {
                Alert.alert('Error', response.error || 'Failed to sell shares');
              }
            } catch (error) {
              console.error('Error selling shares:', error);
              Alert.alert('Error', 'Failed to process share sale');
            }
          }
        }
      ]
    );
  };

  // 🔄 TRANSFER SHARES FUNCTIONALITY
  const handleTransferShares = async () => {
    if (!transferForm.shareId || !transferForm.toMemberId || !transferForm.sharesCount || !transferForm.transferPrice) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }

    const sharesCount = parseInt(transferForm.sharesCount);
    const transferPrice = parseFloat(transferForm.transferPrice);
    const totalAmount = sharesCount * transferPrice;

    // Validate shares count
    if (sharesCount <= 0) {
      Alert.alert('Validation Error', 'Shares count must be greater than 0.');
      return;
    }

    // Find the selected share to validate ownership
    const selectedShare = userShares?.shareTypes?.find(share => share.id === transferForm.shareId);
    if (!selectedShare) {
      Alert.alert('Error', 'Selected share not found.');
      return;
    }

    if (sharesCount > selectedShare.quantity) {
      Alert.alert('Insufficient Shares', `You only have ${selectedShare.quantity} shares of this type available.`);
      return;
    }

    Alert.alert(
      'Confirm Transfer',
      `You are about to transfer ${sharesCount} shares at KES ${formatCurrency(transferPrice)} each to ${transferForm.toMemberName}.\n\nTotal Amount: KES ${formatCurrency(totalAmount)}\n\nThe buyer will need to have sufficient funds in their wallet. Proceed with transfer?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer Shares',
          onPress: async () => {
            try {
              const transferData = {
                shareId: transferForm.shareId,
                toMemberId: transferForm.toMemberId,
                sharesCount,
                transferPrice,
                totalAmount,
                transferDate: new Date(),
                notes: transferForm.notes,
              };

              const response = await ApiService.transferShares(chamaId, transferData);

              if (response.success) {
                Alert.alert('Success', 'Shares transferred successfully! Your portfolio has been updated.');
                setShowTransferModal(false);
                resetTransferForm();
                await loadData(); // Refresh all data
              } else {
                Alert.alert('Error', response.error || 'Failed to transfer shares');
              }
            } catch (error) {
              console.error('Error transferring shares:', error);
              Alert.alert('Error', 'Failed to process share transfer');
            }
          }
        }
      ]
    );
  };

  // 🔄 FORM RESET FUNCTIONS
  const resetBuyForm = () => {
    setBuyForm({
      shareType: 'ordinary',
      quantity: '',
      pricePerShare: '',
      totalAmount: '',
      paymentMethod: 'wallet',
      notes: '',
    });
  };

  const resetSellForm = () => {
    setSellForm({
      shareType: 'ordinary',
      quantity: '',
      pricePerShare: '',
      totalAmount: '',
      reason: '',
      notes: '',
    });
  };

  const resetBuyDividendsForm = () => {
    setBuyDividendsForm({
      quantity: '',
      pricePerShare: '',
      totalAmount: '',
      paymentMethod: 'mobile_money',
      notes: '',
    });
  };

  const resetTransferForm = () => {
    setTransferForm({
      shareId: '',
      toMemberId: '',
      toMemberName: '',
      sharesCount: '',
      transferPrice: '',
      totalAmount: '',
      notes: '',
    });
  };

  // 🧮 CALCULATION HELPERS
  const calculateBuyTotal = () => {
    const quantity = parseInt(buyForm.quantity) || 0;
    const price = parseFloat(buyForm.pricePerShare) || 0;
    return quantity * price;
  };

  const calculateSellTotal = () => {
    const quantity = parseInt(sellForm.quantity) || 0;
    const price = parseFloat(sellForm.pricePerShare) || 0;
    return quantity * price;
  };

  // 🔐 PERMISSION CHECKS
  const canDeclareDividends = () => {
    return ['chairperson', 'treasurer', 'secretary'].includes(userRole.toLowerCase());
  };

  // 🎨 ANIMATION HELPERS
  const animateTabChange = (toValue) => {
    Animated.timing(slideAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // 🎨 UI RENDERING COMPONENTS
  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.surface }]}>
      {/* Top Row - Back Button, Title, Portfolio Value */}
      <View style={styles.headerTopRow}>
        <View style={styles.headerActions}>
          {userShares && (
            <View style={[styles.portfolioValue, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.portfolioValueLabel, { color: colors.primary }]}>
                Portfolio
              </Text>
              <Text style={[styles.portfolioValueAmount, { color: colors.primary }]}>
                KES {formatCurrency(userShares.totalValue)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Bottom Row - Subtitle and Tab Navigation */}
      <View style={styles.headerBottomRow}>
        <View style={styles.headerTabs}>
          {[
            { key: 'portfolio', label: 'Portfolio', icon: 'pie-chart' },
            { key: 'market', label: 'Market', icon: 'trending-up' },
            { key: 'dividends', label: 'Dividends', icon: 'cash' },
            { key: 'history', label: 'History', icon: 'time' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.headerTab,
                activeTab === tab.key && {
                  backgroundColor: colors.primary + '15',
                  borderBottomWidth: 2,
                  borderBottomColor: colors.primary
                }
              ]}
              onPress={() => {
                setActiveTab(tab.key);
                Animated.timing(slideAnim, {
                  toValue: 0,
                  duration: 300,
                  useNativeDriver: false,
                }).start();
              }}
            >
              <Ionicons
                name={tab.icon}
                size={14}
                color={activeTab === tab.key ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.headerTabText,
                  { color: activeTab === tab.key ? colors.primary : colors.textSecondary }
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  // Tab navigation now integrated into header - removed standalone function

  const renderPortfolioView = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Portfolio Summary Card */}
      <Card style={[styles.portfolioCard, { backgroundColor: colors.surface }]}>
        <View style={styles.portfolioHeader}>
          <View style={styles.portfolioTitleRow}>
            <Ionicons name="pie-chart" size={24} color={colors.primary} />
            <Text style={[styles.portfolioTitle, { color: colors.text }]}>
              My Portfolio
            </Text>
            <View style={[styles.performanceBadge, {
              backgroundColor: userShares?.portfolioPerformance >= 0 ? colors.success + '20' : colors.error + '20'
            }]}>
              <Ionicons
                name={userShares?.portfolioPerformance >= 0 ? 'trending-up' : 'trending-down'}
                size={14}
                color={userShares?.portfolioPerformance >= 0 ? colors.success : colors.error}
              />
              <Text style={[styles.performanceText, {
                color: userShares?.portfolioPerformance >= 0 ? colors.success : colors.error
              }]}>
                {userShares?.portfolioPerformance >= 0 ? '+' : ''}{userShares?.portfolioPerformance?.toFixed(2)}%
              </Text>
            </View>
          </View>
        </View>

        {userShares ? (
          <View style={styles.portfolioStats}>
            {isMobile ? (
              // Mobile layout: vertical cards
              <>
                <View style={styles.statRowMobile}>
                  <View style={styles.statItemMobile}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Total Shares
                    </Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {userShares.totalShares.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.statItemMobile}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Total Value
                    </Text>
                    <Text style={[styles.statValue, { color: colors.primary }]}>
                      KES {formatCurrency(userShares.totalValue)}
                    </Text>
                  </View>
                </View>

                <View style={styles.statRowMobile}>
                  <View style={styles.statItemMobile}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Average Price
                    </Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      KES {formatCurrency(userShares.averagePrice)}
                    </Text>
                  </View>
                  <View style={styles.statItemMobile}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Dividends Received
                    </Text>
                    <Text style={[styles.statValue, { color: colors.success }]}>
                      KES {formatCurrency(userShares.totalDividendsReceived)}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              // Desktop layout: horizontal rows
              <>
                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Total Shares
                    </Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {userShares.totalShares.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Total Value
                    </Text>
                    <Text style={[styles.statValue, { color: colors.primary }]}>
                      KES {formatCurrency(userShares.totalValue)}
                    </Text>
                  </View>
                </View>

                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Average Price
                    </Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      KES {formatCurrency(userShares.averagePrice)}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Dividends Received
                    </Text>
                    <Text style={[styles.statValue, { color: colors.success }]}>
                      KES {formatCurrency(userShares.totalDividendsReceived)}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        ) : (
          <View style={styles.emptyPortfolio}>
            <Ionicons name="pie-chart-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No Shares Yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Start building your portfolio by purchasing shares
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={[styles.portfolioActions, isMobile && styles.portfolioActionsMobile]}>
           <Button
             title="Buy Shares"
             onPress={() => setActiveTab('market')}
             style={[styles.actionButton, isMobile && styles.actionButtonMobile, { backgroundColor: colors.success }]}
             icon={<Ionicons name="add" size={20} color={colors.white} />}
           />
           {userShares && userShares.totalShares > 0 && (
             <>
               <Button
                 title="Transfer"
                 onPress={() => setShowTransferModal(true)}
                 style={[styles.actionButton, isMobile && styles.actionButtonMobile, { backgroundColor: colors.info }]}
                 icon={<Ionicons name="swap-horizontal" size={20} color={colors.white} />}
               />
               <Button
                 title="Sell Shares"
                 onPress={() => setShowSellModal(true)}
                 style={[styles.actionButton, isMobile && styles.actionButtonMobile, { backgroundColor: colors.error }]}
                 icon={<Ionicons name="remove" size={20} color={colors.white} />}
               />
             </>
           )}
         </View>
      </Card>

      {/* Share Types Breakdown */}
      {userShares && userShares.shareTypes && userShares.shareTypes.length > 0 && (
        <Card style={[styles.shareTypesCard, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Share Types Breakdown
            </Text>
          </View>

          {userShares.shareTypes.map((shareType, index) => (
            <View key={index} style={styles.shareTypeItem}>
              <View style={styles.shareTypeInfo}>
                <Text style={[styles.shareTypeName, { color: colors.text }]}>
                  {shareType.type} Shares
                </Text>
                <Text style={[styles.shareTypeCount, { color: colors.textSecondary }]}>
                  {shareType.quantity} shares
                </Text>
                {shareType.certificateNumber && (
                  <Text style={[styles.certificateNumber, { color: colors.primary }]}>
                    Certificate: {shareType.certificateNumber}
                  </Text>
                )}
              </View>
              <View style={styles.shareTypeValue}>
                <Text style={[styles.shareTypeAmount, { color: colors.primary }]}>
                  KES {formatCurrency(shareType.value)}
                </Text>
                <Text style={[styles.shareTypePrice, { color: colors.textSecondary }]}>
                  @ KES {formatCurrency(shareType.averagePrice)}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* Digital Certificates - Enhanced Design */}
      {userShares && userShares.purchases && userShares.purchases.length > 0 && (
        <Card style={[styles.certificatesCard, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            {isMobile ? (
              <View style={styles.certificatesHeaderMobile}>
                <View style={styles.certificatesHeaderRow}>
                  <Ionicons name="ribbon" size={24} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    Digital Share Certificates
                  </Text>
                </View>
                <View style={[styles.certificatesCount, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.certificatesCountText, { color: colors.primary }]}>
                    {userShares.shareTypes.length}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.certificatesHeader}>
                <Ionicons name="ribbon" size={24} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Digital Share Certificates
                </Text>
                <View style={[styles.certificatesCount, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.certificatesCountText, { color: colors.primary }]}>
                    {userShares.shareTypes.length}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.certificatesGrid}>
            {userShares.shareTypes.map((shareType, index) => (
              <TouchableOpacity
                key={shareType.type}
                style={[
                  styles.professionalCertificateCard,
                  isMobile ? styles.professionalCertificateCardMobile : styles.professionalCertificateCardDesktop,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.primary,
                    shadowColor: colors.primary,
                  }
                ]}
                onPress={() => {
                  Alert.alert(
                    'Certificate Details',
                    `Certificate: ${shareType.certificateNumber}\n\nShare Type: ${shareType.type}\nTotal Quantity: ${shareType.quantity} shares\nAverage Value per Share: KES ${formatCurrency(shareType.averagePrice)}\nTotal Value: KES ${formatCurrency(shareType.value)}\n\nStatus: Active`,
                    [
                      { text: 'Close', style: 'cancel' },
                      {
                        text: 'Share Certificate',
                        onPress: () => {
                          // TODO: Implement certificate sharing
                          Alert.alert('Coming Soon', 'Certificate sharing will be available in the next update.');
                        }
                      }
                    ]
                  );
                }}
              >
                {/* Certificate Border Decoration */}
                <View style={styles.certificateBorderDecoration}>
                  <View style={[styles.certificateCorner, styles.topLeftCorner]} />
                  <View style={[styles.certificateCorner, styles.topRightCorner]} />
                  <View style={[styles.certificateCorner, styles.bottomLeftCorner]} />
                  <View style={[styles.certificateCorner, styles.bottomRightCorner]} />
                </View>

                {/* Certificate Header */}
                <View style={[styles.certificateHeader, isMobile && styles.certificateHeaderMobile]}>
                  <View style={[styles.certificateHeaderLeft, isMobile && styles.certificateHeaderLeftMobile]}>
                    <Ionicons name="shield-checkmark" size={isMobile ? 20 : 24} color={colors.primary} />
                    <View style={styles.certificateTitleSection}>
                      <Text style={[
                        styles.certificateMainTitle,
                        isMobile && styles.certificateMainTitleMobile,
                        { color: colors.primary }
                      ]}>
                        SHARE CERTIFICATE
                      </Text>
                      <Text style={[
                        styles.certificateSubtitle,
                        isMobile && styles.certificateSubtitleMobile,
                        { color: colors.textSecondary }
                      ]}>
                        VaultKe Chama Investment
                      </Text>
                    </View>
                  </View>
                  <View style={[
                    styles.certificateSeal,
                    isMobile && styles.certificateSealMobile,
                    { backgroundColor: colors.primary + '15' }
                  ]}>
                    <Ionicons name={isMobile ? 16 : 20} color={colors.primary} />
                  </View>
                </View>

                {/* Certificate Number - Prominently Displayed */}
                <View style={[styles.certificateNumberSection, isMobile && styles.certificateNumberSectionMobile]}>
                  <Text style={[
                    styles.certificateNumberLabel,
                    isMobile && styles.certificateNumberLabelMobile,
                    { color: colors.textSecondary }
                  ]}>
                    Certificate Number
                  </Text>
                  <Text style={[
                    styles.certificateNumber,
                    isMobile && styles.certificateNumberMobile,
                    { color: colors.primary, fontFamily: 'monospace' }
                  ]}>
                    {shareType.certificateNumber}
                  </Text>
                </View>

                {/* Certificate Body */}
                <View style={[styles.certificateBody, isMobile && styles.certificateBodyMobile]}>
                  <Text style={[
                    styles.certificateBodyText,
                    isMobile && styles.certificateBodyTextMobile,
                    { color: colors.text }
                  ]}>
                    This is to certify that the bearer holds
                  </Text>

                  <View style={styles.certificateShareDetails}>
                    <View style={[styles.shareDetailItem, isMobile && styles.shareDetailItemMobile]}>
                      <Text style={[
                        styles.shareDetailLabel,
                        isMobile && styles.shareDetailLabelMobile,
                        { color: colors.textSecondary }
                      ]}>
                        Share Type:
                      </Text>
                      <Text style={[
                        styles.shareDetailValue,
                        isMobile && styles.shareDetailValueMobile,
                        { color: colors.text }
                      ]}>
                        {shareType.type} Shares
                      </Text>
                    </View>

                    <View style={[styles.shareDetailItem, isMobile && styles.shareDetailItemMobile]}>
                      <Text style={[
                        styles.shareDetailLabel,
                        isMobile && styles.shareDetailLabelMobile,
                        { color: colors.textSecondary }
                      ]}>
                        Quantity:
                      </Text>
                      <Text style={[
                        styles.shareDetailValue,
                        isMobile && styles.shareDetailValueMobile,
                        { color: colors.primary, fontWeight: 'bold' }
                      ]}>
                        {shareType.quantity} shares
                      </Text>
                    </View>

                    <View style={[styles.shareDetailItem, isMobile && styles.shareDetailItemMobile]}>
                      <Text style={[
                        styles.shareDetailLabel,
                        isMobile && styles.shareDetailLabelMobile,
                        { color: colors.textSecondary }
                      ]}>
                        Value per Share:
                      </Text>
                      <Text style={[
                        styles.shareDetailValue,
                        isMobile && styles.shareDetailValueMobile,
                        { color: colors.text }
                      ]}>
                        KES {formatCurrency(shareType.averagePrice)}
                      </Text>
                    </View>

                    <View style={[styles.shareDetailItem, isMobile && styles.shareDetailItemMobile]}>
                      <Text style={[
                        styles.shareDetailLabel,
                        isMobile && styles.shareDetailLabelMobile,
                        { color: colors.textSecondary }
                      ]}>
                        Total Value:
                      </Text>
                      <Text style={[
                        styles.shareDetailValue,
                        isMobile && styles.shareDetailValueMobile,
                        { color: colors.success, fontWeight: 'bold' }
                      ]}>
                        KES {formatCurrency(shareType.value)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Certificate Footer */}
                <View style={[styles.certificateFooter, isMobile && styles.certificateFooterMobile]}>
                  <View style={[styles.certificateFooterLeft, isMobile && styles.certificateFooterLeftMobile]}>
                    <Text style={[
                      styles.certificateDateLabel,
                      isMobile && styles.certificateDateLabelMobile,
                      { color: colors.textSecondary }
                    ]}>
                      Date Issued:
                    </Text>
                    <Text style={[
                      styles.certificateDate,
                      isMobile && styles.certificateDateMobile,
                      { color: colors.text }
                    ]}>
                      Active Holding
                    </Text>
                  </View>

                  <View style={[styles.certificateFooterRight, isMobile && styles.certificateFooterRightMobile]}>
                    <View style={[
                      styles.certificateStatusBadge,
                      isMobile && styles.certificateStatusBadgeMobile,
                      {
                        backgroundColor: colors.success + '20' // Always active for consolidated certificates
                      }
                    ]}>
                      <Text style={[
                        styles.certificateStatusText,
                        isMobile && styles.certificateStatusTextMobile,
                        {
                          color: colors.success // Always active for consolidated certificates
                        }
                      ]}>
                        {'ACTIVE'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Decorative Bottom Border */}
                <View style={[styles.certificateBottomDecoration, { backgroundColor: colors.primary + '10' }]}>
                  <View style={[styles.certificateBottomLine, { backgroundColor: colors.primary }]} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      )}
    </ScrollView>
  );

  const renderMarketView = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Market Overview Card */}
      {marketData && (
        <Card style={[styles.marketCard, { backgroundColor: colors.surface }]}>
          <View style={styles.marketHeader}>
            <View style={styles.marketTitleRow}>
              <Ionicons name="trending-up" size={24} color={colors.info} />
              <Text style={[styles.marketTitle, { color: colors.text }]}>
                Market Overview
              </Text>
              <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
                Updated {formatDate(marketData.lastUpdated)}
              </Text>
            </View>
          </View>

          <View style={styles.marketStats}>
            <View style={styles.priceSection}>
              <Text style={[styles.currentPrice, { color: colors.text }]}>
                KES {formatCurrency(marketData.currentPrice)}
              </Text>
              <View style={[styles.priceChange, {
                backgroundColor: marketData.priceChange >= 0 ? colors.success + '20' : colors.error + '20'
              }]}>
                <Ionicons
                  name={marketData.priceChange >= 0 ? 'arrow-up' : 'arrow-down'}
                  size={14}
                  color={marketData.priceChange >= 0 ? colors.success : colors.error}
                />
                <Text style={[styles.priceChangeText, {
                  color: marketData.priceChange >= 0 ? colors.success : colors.error
                }]}>
                  {marketData.priceChange >= 0 ? '+' : ''}{formatCurrency(marketData.priceChange)} ({marketData.priceChangePercent?.toFixed(2)}%)
                </Text>
              </View>
            </View>

            <View style={styles.marketMetrics}>
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                  Volume
                </Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>
                  {marketData.volume?.toLocaleString()}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                  Market Cap
                </Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>
                  KES {formatCurrency(marketData.marketCap)}
                </Text>
              </View>
            </View>
          </View>
        </Card>
      )}

      {/* Available Shares for Purchase */}
      <Card style={[styles.availableSharesCard, { backgroundColor: colors.surface }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Available Shares
          </Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadAvailableShares}
          >
            <Ionicons name="refresh" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {availableShares.length > 0 ? (
          <FlatList
            data={availableShares}
            keyExtractor={(item) => item.id}
            renderItem={renderAvailableShareItem}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        ) : (
          <View style={styles.emptyShares}>
            <Ionicons name="storefront-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No Shares Available
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Check back later for new share offerings
            </Text>
          </View>
        )}
      </Card>
    </ScrollView>
  );

  const renderAvailableShareItem = ({ item }) => (
    <View style={styles.shareItem}>
      <View style={styles.shareItemHeader}>
        <View style={styles.shareItemInfo}>
          <Text style={[styles.shareItemTitle, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
            {item.name || `${item.shareType} Shares`}
          </Text>
          <Text style={[styles.shareItemDescription, { color: colors.textSecondary }]} numberOfLines={2} ellipsizeMode="tail">
            {item.description}
          </Text>
        </View>
        <View style={styles.shareItemPrice}>
          <Text style={[styles.sharePrice, { color: colors.primary }]}>
            KES {formatCurrency(item.pricePerShare)}
          </Text>
          <Text style={[styles.sharePriceLabel, { color: colors.textSecondary }]}>
            per share
          </Text>
        </View>
      </View>

      <View style={styles.shareItemDetails}>
        <View style={styles.shareDetail}>
          <Text style={[styles.shareDetailLabel, { color: colors.textSecondary }]}>
            Available
          </Text>
          <Text style={[styles.shareDetailValue, { color: colors.text }]}>
            {item.totalShares?.toLocaleString()} shares
          </Text>
        </View>
        <View style={styles.shareDetail}>
          <Text style={[styles.shareDetailLabel, { color: colors.textSecondary }]}>
            Min Purchase
          </Text>
          <Text style={[styles.shareDetailValue, { color: colors.text }]}>
            {item.minimumPurchase} shares
          </Text>
        </View>
      </View>

      <Button
        title={isMobile ? "Buy" : "Buy Shares"}
        onPress={() => {
          setSelectedShare(item);
          setBuyForm(prev => ({
            ...prev,
            shareType: item.shareType,
            pricePerShare: item.pricePerShare.toString(),
          }));
          setShowBuyModal(true);
        }}
        style={[styles.buyButton, isMobile && styles.buyButtonMobile, { backgroundColor: colors.success }]}
        size="small"
      />
    </View>
  );

  const renderDividendsView = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Dividend Summary Card */}
      <Card style={[styles.dividendSummaryCard, { backgroundColor: colors.surface }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="cash" size={24} color={colors.success} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Dividend Summary
            </Text>
            {canDeclareDividends() && (
              <TouchableOpacity
                style={[styles.declareButton, { backgroundColor: colors.primary + '20' }]}
                onPress={() => Alert.alert('Feature Coming Soon', 'Dividend declaration will be available in the next update.')}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={[styles.declareButtonText, { color: colors.primary }]}>
                  Declare
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {userShares && (
          <View style={styles.dividendStats}>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Total Received
                </Text>
                <Text style={[styles.statValue, { color: colors.success }]}>
                  KES {formatCurrency(userShares.totalDividendsReceived)}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Expected Next
                </Text>
                <Text style={[styles.statValue, { color: colors.info }]}>
                  KES {formatCurrency(userShares.totalShares * (dividends.length > 0 ? (dividends[0].dividendPerShare || 0) : 0))}
                </Text>
              </View>
            </View>
          </View>
        )}
      </Card>

      {/* Dividend History */}
      <Card style={[styles.dividendHistoryCard, { backgroundColor: colors.surface }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Dividend History
          </Text>
        </View>

        {dividends.length > 0 ? (
          <FlatList
            data={dividends}
            keyExtractor={(item) => item.id}
            renderItem={renderDividendItem}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        ) : (
          <View style={styles.emptyDividends}>
            <Ionicons name="cash-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No Dividends Yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Dividend payments will appear here when declared
            </Text>
          </View>
        )}
      </Card>
    </ScrollView>
  );

  const renderDividendItem = ({ item }) => (
    <View style={styles.dividendItem}>
      <View style={styles.dividendItemHeader}>
        <View style={styles.dividendItemInfo}>
          <Text style={[styles.dividendItemTitle, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
            {item.description || 'Dividend Declaration'}
          </Text>
          <Text style={[styles.dividendItemDate, { color: colors.textSecondary }]}>
            Declared: {formatDate(item.declarationDate)}
          </Text>
        </View>
        <View style={styles.dividendItemAmount}>
          <Text style={[styles.dividendAmount, { color: colors.success }]}>
            KES {formatCurrency(item.dividendPerShare)} per share
          </Text>
          <Text style={[styles.dividendPerShare, { color: colors.textSecondary }]}>
            Total: KES {formatCurrency(item.totalDividendAmount)}
          </Text>
        </View>
      </View>

      <View style={styles.dividendItemDetails}>
        <View style={styles.dividendDetail}>
          <Text style={[styles.dividendDetailLabel, { color: colors.textSecondary }]}>
            Payment Date
          </Text>
          <Text style={[styles.dividendDetailValue, { color: colors.text }]}>
            {formatDate(item.paymentDate)}
          </Text>
        </View>
        <View style={styles.dividendDetail}>
          <Text style={[styles.dividendDetailLabel, { color: colors.textSecondary }]}>
            Status
          </Text>
          <View style={[styles.statusBadge, {
            backgroundColor: getStatusColor(item.status) + '20'
          }]}>
            <Text style={[styles.statusText, {
              color: getStatusColor(item.status)
            }]}>
              {item.status?.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* Buy Dividend Certificates Button */}
      {item.status === 'approved' && (
        <Button
          title={isMobile ? "Buy Certificates" : "Buy Dividend Certificates"}
          onPress={() => {
            setSelectedDividend(item);
            setBuyDividendsForm(prev => ({
              ...prev,
              pricePerShare: item.dividendPerShare.toString(),
            }));
            setShowBuyDividendsModal(true);
          }}
          style={[styles.buyDividendButton, isMobile && styles.buyDividendButtonMobile, { backgroundColor: colors.info }]}
          size="small"
        />
      )}
    </View>
  );

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid': return colors.success;
      case 'pending': return colors.warning;
      case 'processing': return colors.info;
      case 'cancelled': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const renderHistoryView = () => {
    const purchases = userShares?.purchases || [];

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <Card style={[styles.historyCard, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Share Purchase History
            </Text>
          </View>

          {purchases.length > 0 ? (
            <FlatList
              data={purchases}
              keyExtractor={(item) => item.id}
              renderItem={renderPurchaseHistoryItem}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          ) : (
            <View style={styles.emptyHistory}>
              <Ionicons name="time-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No Purchase History
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Your share purchases will appear here
              </Text>
            </View>
          )}
        </Card>
      </ScrollView>
    );
  };

  const renderPurchaseHistoryItem = ({ item }) => (
    <View style={styles.purchaseHistoryItem}>
      <View style={styles.purchaseHistoryHeader}>
        <View style={[styles.transactionTypeIcon, {
          backgroundColor: colors.success + '20'
        }]}>
          <Ionicons
            name="add"
            size={16}
            color={colors.success}
          />
        </View>
        <View style={styles.purchaseHistoryInfo}>
          <Text style={[styles.purchaseHistoryTitle, { color: colors.text }]}>
            Purchased {item.sharesOwned} {item.shareType} shares
          </Text>
          <Text style={[styles.purchaseHistoryDate, { color: colors.textSecondary }]}>
            {formatDate(item.purchaseDate)}
          </Text>
        </View>
        <View style={styles.purchaseHistoryAmount}>
          <Text style={[styles.purchaseAmount, { color: colors.error }]}>
            -KES {formatCurrency(item.totalValue)}
          </Text>
          <Text style={[styles.purchasePricePerShare, { color: colors.textSecondary }]}>
            @ KES {formatCurrency(item.shareValue)} each
          </Text>
        </View>
      </View>

      {/* Certificate Information */}
      <View style={styles.certificateInfo}>
        <View style={[styles.certificateBadge, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="document-text" size={16} color={colors.primary} />
          <Text style={[styles.certificateText, { color: colors.primary }]}>
            Certificate: {item.certificateNumber}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.viewCertificateButton, { borderColor: colors.primary }]}
          onPress={() => {
            // TODO: Navigate to detailed certificate view
            Alert.alert('Certificate Details', `Certificate: ${item.certificateNumber}\nShares: ${item.sharesOwned} ${item.shareType}\nValue: KES ${formatCurrency(item.totalValue)}\nPurchase Date: ${formatDate(item.purchaseDate)}`);
          }}
        >
          <Text style={[styles.viewCertificateText, { color: colors.primary }]}>
            View Details
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderBuyModal = () => (
    <Modal
      visible={showBuyModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            onPress={() => {
              setShowBuyModal(false);
              resetBuyForm();
              setSelectedShare(null);
              setErrorMessage(null);
            }}
            style={styles.modalCloseButton}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            Buy Shares
          </Text>
          <View style={styles.modalCloseButton} />
        </View>

        <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
          {selectedShare && (
            <Card style={[styles.selectedShareCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.selectedShareTitle, { color: colors.text }]}>
                {selectedShare.shareType} Shares
              </Text>
              <Text style={[styles.selectedSharePrice, { color: colors.primary }]}>
                KES {formatCurrency(selectedShare.pricePerShare)} per share
              </Text>
              <Text style={[styles.selectedShareAvailable, { color: colors.textSecondary }]}>
                {selectedShare.totalShares?.toLocaleString()} shares available
              </Text>
            </Card>
          )}

          <Card style={[styles.buyFormCard, { backgroundColor: colors.surface }]}>
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Quantity *
              </Text>
              <TextInput
                style={[styles.formInput, {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text
                }]}
                value={buyForm.quantity}
                onChangeText={(text) => {
                  setBuyForm(prev => ({ ...prev, quantity: text }));
                }}
                placeholder="Enter number of shares"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
              {selectedShare && (
                <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                  Min: {selectedShare.minimumPurchase} shares, Max: {selectedShare.totalShares} shares
                </Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Price per Share
              </Text>
              <TextInput
                style={[styles.formInput, {
                  backgroundColor: colors.background + '80', // Slightly disabled look
                  borderColor: colors.border,
                  color: colors.textSecondary
                }]}
                value={buyForm.pricePerShare}
                editable={false} // Price is fixed from offering
                placeholder="Price set by offering"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
              <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                Price is fixed by the share offering
              </Text>
            </View>

            {buyForm.quantity && buyForm.pricePerShare && (
              <View style={[styles.totalAmountCard, { backgroundColor: colors.primary + '10' }]}>
                <Text style={[styles.totalAmountLabel, { color: colors.primary }]}>
                  Total Amount
                </Text>
                <Text style={[styles.totalAmountValue, { color: colors.primary }]}>
                  KES {formatCurrency(calculateBuyTotal())}
                </Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Payment Method
              </Text>
              <View style={[styles.paymentMethods, isMobile && styles.paymentMethodsMobile]}>
                {[
                  { key: 'wallet', label: isMobile ? 'Wallet' : 'VaultKe Wallet', icon: 'wallet', balance: walletBalance },
                  { key: 'mobile_money', label: isMobile ? 'M-Pesa' : 'Mobile Money', icon: 'phone-portrait' },
                  { key: 'bank_transfer', label: isMobile ? 'Bank' : 'Bank Transfer', icon: 'card' },
                  { key: 'cash', label: isMobile ? 'Cash' : 'Cash', icon: 'cash' },
                ].map((method) => (
                  <TouchableOpacity
                    key={method.key}
                    style={[
                      styles.paymentMethod,
                      isMobile && styles.paymentMethodMobile,
                      { borderColor: colors.border },
                      buyForm.paymentMethod === method.key && {
                        backgroundColor: colors.primary + '20',
                        borderColor: colors.primary
                      }
                    ]}
                    onPress={() => setBuyForm(prev => ({ ...prev, paymentMethod: method.key }))}
                  >
                    <Ionicons
                      name={method.icon}
                      size={20}
                      color={buyForm.paymentMethod === method.key ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[
                      styles.paymentMethodText,
                      isMobile && styles.paymentMethodTextMobile,
                      { color: buyForm.paymentMethod === method.key ? colors.primary : colors.textSecondary }
                    ]} numberOfLines={1} ellipsizeMode="tail">
                      {method.label}
                    </Text>
                    {method.key === 'wallet' && (
                      <Text style={[
                        styles.paymentMethodBalance,
                        isMobile && styles.paymentMethodBalanceMobile,
                        { color: buyForm.paymentMethod === method.key ? colors.primary : colors.textSecondary }
                      ]}>
                        {isMobile ? formatCurrency(method.balance || 0) : `KES ${formatCurrency(method.balance || 0)}`}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Notes (Optional)
              </Text>
              <TextInput
                style={[styles.formTextArea, {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text
                }]}
                value={buyForm.notes}
                onChangeText={(text) => setBuyForm(prev => ({ ...prev, notes: text }))}
                placeholder="Add any notes about this purchase"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>
          </Card>

          <View style={[styles.modalActions, isMobile && styles.modalActionsMobile]}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => {
                setShowBuyModal(false);
                resetBuyForm();
                setSelectedShare(null);
                setErrorMessage(null);
              }}
              style={[styles.cancelButton, isMobile && styles.cancelButtonMobile]}
            />
            <Button
              title={isMobile ? `Buy KES ${formatCurrency(calculateBuyTotal())}` : `Buy for KES ${formatCurrency(calculateBuyTotal())}`}
              onPress={() => {
                console.log('🖱️ DEBUG: Buy button pressed');
                handleBuyShares();
              }}
              style={[styles.confirmButton, isMobile && styles.confirmButtonMobile, { backgroundColor: colors.success }]}
              disabled={!buyForm.quantity || !buyForm.pricePerShare}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const renderSellModal = () => (
    <Modal
      visible={showSellModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            onPress={() => {
              setShowSellModal(false);
              resetSellForm();
            }}
            style={styles.modalCloseButton}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            Sell Shares
          </Text>
          <View style={styles.modalCloseButton} />
        </View>

        <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
          {userShares && (
            <Card style={[styles.portfolioSummaryCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.portfolioSummaryTitle, { color: colors.text }]}>
                Your Portfolio
              </Text>
              <Text style={[styles.portfolioSummaryShares, { color: colors.primary }]}>
                {userShares.totalShares} shares available
              </Text>
              <Text style={[styles.portfolioSummaryValue, { color: colors.textSecondary }]}>
                Average price: KES {formatCurrency(userShares.averagePrice)}
              </Text>
            </Card>
          )}

          <Card style={[styles.sellFormCard, { backgroundColor: colors.surface }]}>
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Quantity to Sell *
              </Text>
              <TextInput
                style={[styles.formInput, {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text
                }]}
                value={sellForm.quantity}
                onChangeText={(text) => setSellForm(prev => ({ ...prev, quantity: text }))}
                placeholder="Enter number of shares to sell"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
              {userShares && (
                <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                  Max: {userShares.totalShares} shares available
                </Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Selling Price per Share *
              </Text>
              <TextInput
                style={[styles.formInput, {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text
                }]}
                value={sellForm.pricePerShare}
                onChangeText={(text) => setSellForm(prev => ({ ...prev, pricePerShare: text }))}
                placeholder="Enter selling price per share"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
              {marketData && (
                <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                  Current market price: KES {formatCurrency(marketData.currentPrice)}
                </Text>
              )}
            </View>

            {sellForm.quantity && sellForm.pricePerShare && (
              <View style={[styles.totalAmountCard, { backgroundColor: colors.success + '10' }]}>
                <Text style={[styles.totalAmountLabel, { color: colors.success }]}>
                  Total Amount (You'll Receive)
                </Text>
                <Text style={[styles.totalAmountValue, { color: colors.success }]}>
                  KES {formatCurrency(calculateSellTotal())}
                </Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Reason for Selling
              </Text>
              <View style={styles.sellReasons}>
                {[
                  { key: 'profit_taking', label: 'Profit Taking' },
                  { key: 'emergency_funds', label: 'Emergency Funds' },
                  { key: 'portfolio_rebalancing', label: 'Portfolio Rebalancing' },
                  { key: 'other', label: 'Other' },
                ].map((reason) => (
                  <TouchableOpacity
                    key={reason.key}
                    style={[
                      styles.sellReason,
                      { borderColor: colors.border },
                      sellForm.reason === reason.key && {
                        backgroundColor: colors.primary + '20',
                        borderColor: colors.primary
                      }
                    ]}
                    onPress={() => setSellForm(prev => ({ ...prev, reason: reason.key }))}
                  >
                    <Text style={[
                      styles.sellReasonText,
                      { color: sellForm.reason === reason.key ? colors.primary : colors.textSecondary }
                    ]}>
                      {reason.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Additional Notes (Optional)
              </Text>
              <TextInput
                style={[styles.formTextArea, {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text
                }]}
                value={sellForm.notes}
                onChangeText={(text) => setSellForm(prev => ({ ...prev, notes: text }))}
                placeholder="Add any notes about this sale"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>
          </Card>

          <View style={[styles.modalActions, isMobile && styles.modalActionsMobile]}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => {
                setShowSellModal(false);
                resetSellForm();
              }}
              style={[styles.cancelButton, isMobile && styles.cancelButtonMobile]}
            />
            <Button
              title={isMobile ? `Sell KES ${formatCurrency(calculateSellTotal())}` : `Sell for KES ${formatCurrency(calculateSellTotal())}`}
              onPress={handleSellShares}
              style={[styles.confirmButton, isMobile && styles.confirmButtonMobile, { backgroundColor: colors.error }]}
              disabled={!sellForm.quantity || !sellForm.pricePerShare}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const renderBuyDividendsModal = () => (
    <Modal
      visible={showBuyDividendsModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            onPress={() => {
              setShowBuyDividendsModal(false);
              resetBuyDividendsForm();
              setSelectedDividend(null);
            }}
            style={styles.modalCloseButton}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            Buy Dividend Certificates
          </Text>
          <View style={styles.modalCloseButton} />
        </View>

        <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
          {selectedDividend && (
            <Card style={[styles.selectedDividendCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.selectedDividendTitle, { color: colors.text }]}>
                {selectedDividend.description || 'Dividend Declaration'}
              </Text>
              <Text style={[styles.selectedDividendPrice, { color: colors.info }]}>
                KES {formatCurrency(selectedDividend.dividendPerShare)} per certificate
              </Text>
              <Text style={[styles.selectedDividendTotal, { color: colors.textSecondary }]}>
                Total Declaration: KES {formatCurrency(selectedDividend.totalDividendAmount)}
              </Text>
            </Card>
          )}

          <Card style={[styles.buyDividendsFormCard, { backgroundColor: colors.surface }]}>
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Quantity *
              </Text>
              <TextInput
                style={[styles.formInput, {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text
                }]}
                value={buyDividendsForm.quantity}
                onChangeText={(text) => {
                  setBuyDividendsForm(prev => ({ ...prev, quantity: text }));
                }}
                placeholder="Enter number of certificates"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Price per Certificate
              </Text>
              <TextInput
                style={[styles.formInput, {
                  backgroundColor: colors.background + '80', // Slightly disabled look
                  borderColor: colors.border,
                  color: colors.textSecondary
                }]}
                value={buyDividendsForm.pricePerShare}
                editable={false} // Price is fixed from declaration
                placeholder="Price set by declaration"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
              <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                Price is fixed by the dividend declaration
              </Text>
            </View>

            {buyDividendsForm.quantity && buyDividendsForm.pricePerShare && (
              <View style={[styles.totalAmountCard, { backgroundColor: colors.info + '10' }]}>
                <Text style={[styles.totalAmountLabel, { color: colors.info }]}>
                  Total Amount
                </Text>
                <Text style={[styles.totalAmountValue, { color: colors.info }]}>
                  KES {formatCurrency(parseInt(buyDividendsForm.quantity) * parseFloat(buyDividendsForm.pricePerShare))}
                </Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Payment Method
              </Text>
              <View style={[styles.paymentMethods, isMobile && styles.paymentMethodsMobile]}>
                {[
                  { key: 'mobile_money', label: isMobile ? 'M-Pesa' : 'Mobile Money', icon: 'phone-portrait' },
                  { key: 'bank_transfer', label: isMobile ? 'Bank' : 'Bank Transfer', icon: 'card' },
                  { key: 'cash', label: isMobile ? 'Cash' : 'Cash', icon: 'cash' },
                ].map((method) => (
                  <TouchableOpacity
                    key={method.key}
                    style={[
                      styles.paymentMethod,
                      isMobile && styles.paymentMethodMobile,
                      { borderColor: colors.border },
                      buyDividendsForm.paymentMethod === method.key && {
                        backgroundColor: colors.primary + '20',
                        borderColor: colors.primary
                      }
                    ]}
                    onPress={() => setBuyDividendsForm(prev => ({ ...prev, paymentMethod: method.key }))}
                  >
                    <Ionicons
                      name={method.icon}
                      size={20}
                      color={buyDividendsForm.paymentMethod === method.key ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[
                      styles.paymentMethodText,
                      isMobile && styles.paymentMethodTextMobile,
                      { color: buyDividendsForm.paymentMethod === method.key ? colors.primary : colors.textSecondary }
                    ]} numberOfLines={1} ellipsizeMode="tail">
                      {method.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Notes (Optional)
              </Text>
              <TextInput
                style={[styles.formTextArea, {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text
                }]}
                value={buyDividendsForm.notes}
                onChangeText={(text) => setBuyDividendsForm(prev => ({ ...prev, notes: text }))}
                placeholder="Add any notes about this purchase"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>
          </Card>

          <View style={[styles.modalActions, isMobile && styles.modalActionsMobile]}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => {
                setShowBuyDividendsModal(false);
                resetBuyDividendsForm();
                setSelectedDividend(null);
              }}
              style={[styles.cancelButton, isMobile && styles.cancelButtonMobile]}
            />
            <Button
              title={isMobile ? `Buy KES ${formatCurrency(parseInt(buyDividendsForm.quantity || 0) * parseFloat(buyDividendsForm.pricePerShare || 0))}` : `Buy for KES ${formatCurrency(parseInt(buyDividendsForm.quantity || 0) * parseFloat(buyDividendsForm.pricePerShare || 0))}`}
              onPress={handleBuyDividends}
              style={[styles.confirmButton, isMobile && styles.confirmButtonMobile, { backgroundColor: colors.info }]}
              disabled={!buyDividendsForm.quantity || !buyDividendsForm.pricePerShare}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  // 🔄 TRANSFER SHARES MODAL
  const renderTransferModal = () => (
    <Modal
      visible={showTransferModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            onPress={() => {
              setShowTransferModal(false);
              resetTransferForm();
            }}
            style={styles.modalCloseButton}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            Transfer Shares
          </Text>
          <View style={styles.modalCloseButton} />
        </View>

        <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
          {/* Share Selection */}
          <Card style={[styles.transferFormCard, { backgroundColor: colors.surface }]}>
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Select Share Type *
              </Text>
              {userShares?.shareTypes && userShares.shareTypes.length > 0 ? (
                <View style={styles.shareSelection}>
                  {userShares.shareTypes.map((shareType, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.shareOption,
                        { borderColor: colors.border },
                        transferForm.shareId === shareType.id && {
                          backgroundColor: colors.primary + '20',
                          borderColor: colors.primary
                        }
                      ]}
                      onPress={() => {
                        setTransferForm(prev => ({
                          ...prev,
                          shareId: shareType.id,
                          toMemberName: '',
                          toMemberId: '',
                        }));
                      }}
                    >
                      <View style={styles.shareOptionInfo}>
                        <Text style={[styles.shareOptionName, { color: colors.text }]}>
                          {shareType.type} Shares
                        </Text>
                        <Text style={[styles.shareOptionCount, { color: colors.textSecondary }]}>
                          {shareType.quantity} shares available
                        </Text>
                        <Text style={[styles.shareOptionValue, { color: colors.primary }]}>
                          KES {formatCurrency(shareType.value)}
                        </Text>
                      </View>
                      {transferForm.shareId === shareType.id && (
                        <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.emptySharesMessage}>
                  <Ionicons name="information-circle-outline" size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptySharesTitle, { color: colors.text }]}>
                    No Shares Available
                  </Text>
                  <Text style={[styles.emptySharesText, { color: colors.textSecondary }]}>
                    You need to purchase shares first before you can transfer them.
                  </Text>
                </View>
              )}
            </View>

            {/* Member Selection */}
            {transferForm.shareId && (
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Transfer To *
                </Text>
                {chamaMembers.length > 0 ? (
                  <View style={styles.memberSelection}>
                    {chamaMembers.map((member) => (
                      <TouchableOpacity
                        key={member.id}
                        style={[
                          styles.memberOption,
                          { borderColor: colors.border },
                          transferForm.toMemberId === member.id && {
                            backgroundColor: colors.primary + '20',
                            borderColor: colors.primary
                          }
                        ]}
                        onPress={() => {
                          setTransferForm(prev => ({
                            ...prev,
                            toMemberId: member.id,
                            toMemberName: member.name || member.full_name || 'Member',
                          }));
                        }}
                      >
                        <View style={styles.memberOptionInfo}>
                          <Text style={[styles.memberOptionName, { color: colors.text }]}>
                            {member.name || member.full_name || 'Member'}
                          </Text>
                          <Text style={[styles.memberOptionPhone, { color: colors.textSecondary }]}>
                            {member.phone || 'No phone'}
                          </Text>
                        </View>
                        {transferForm.toMemberId === member.id && (
                          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyMembersMessage}>
                    <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.emptyMembersTitle, { color: colors.text }]}>
                      No Members Available
                    </Text>
                    <Text style={[styles.emptyMembersText, { color: colors.textSecondary }]}>
                      No other active members found in this chama.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Quantity Input */}
            {transferForm.shareId && transferForm.toMemberId && (
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Quantity to Transfer *
                </Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text
                  }]}
                  value={transferForm.sharesCount}
                  onChangeText={(text) => {
                    setTransferForm(prev => ({ ...prev, sharesCount: text }));
                  }}
                  placeholder="Enter number of shares"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
                {(() => {
                  const selectedShare = userShares?.shareTypes?.find(share => share.id === transferForm.shareId);
                  return selectedShare ? (
                    <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                      Max: {selectedShare.quantity} shares available
                    </Text>
                  ) : null;
                })()}
              </View>
            )}

            {/* Transfer Price */}
            {transferForm.shareId && transferForm.toMemberId && transferForm.sharesCount && (
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Transfer Price per Share *
                </Text>
                <TextInput
                  style={[styles.formInput, {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text
                  }]}
                  value={transferForm.transferPrice}
                  onChangeText={(text) => {
                    setTransferForm(prev => ({ ...prev, transferPrice: text }));
                  }}
                  placeholder="Enter price per share"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
                <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                  Price at which the shares will be transferred
                </Text>
              </View>
            )}

            {/* Total Amount Display */}
            {transferForm.shareId && transferForm.toMemberId && transferForm.sharesCount && transferForm.transferPrice && (
              <View style={[styles.totalAmountCard, { backgroundColor: colors.info + '10' }]}>
                <Text style={[styles.totalAmountLabel, { color: colors.info }]}>
                  Total Transfer Amount
                </Text>
                <Text style={[styles.totalAmountValue, { color: colors.info }]}>
                  KES {formatCurrency(parseInt(transferForm.sharesCount || 0) * parseFloat(transferForm.transferPrice || 0))}
                </Text>
              </View>
            )}

            {/* Notes */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Notes (Optional)
              </Text>
              <TextInput
                style={[styles.formTextArea, {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text
                }]}
                value={transferForm.notes}
                onChangeText={(text) => setTransferForm(prev => ({ ...prev, notes: text }))}
                placeholder="Add any notes about this transfer"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>
          </Card>

          <View style={[styles.modalActions, isMobile && styles.modalActionsMobile]}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => {
                setShowTransferModal(false);
                resetTransferForm();
              }}
              style={[styles.cancelButton, isMobile && styles.cancelButtonMobile]}
            />
            <Button
              title={isMobile ? `Transfer KES ${formatCurrency(parseInt(transferForm.sharesCount || 0) * parseFloat(transferForm.transferPrice || 0))}` : `Transfer for KES ${formatCurrency(parseInt(transferForm.sharesCount || 0) * parseFloat(transferForm.transferPrice || 0))}`}
              onPress={handleTransferShares}
              style={[styles.confirmButton, isMobile && styles.confirmButtonMobile, { backgroundColor: colors.info }]}
              disabled={!transferForm.shareId || !transferForm.toMemberId || !transferForm.sharesCount || !transferForm.transferPrice}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  // Removed old handleDeclareDividend - using modern version above

  // Removed all old unused functions

  if (loading && !dataReady) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '70%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '50%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '30%' }]} />
          </View>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '60%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '40%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '80%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '55%' }]} />
          </View>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '45%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '65%' }]} />
          </View>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '75%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '35%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '50%' }]} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 🎨 MODERN HEADER WITH INTEGRATED TABS */}
      {renderHeader()}

      {/* 🎉 SUCCESS BANNER */}
      {successMessage && (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <MessageBanner
            type="success"
            message={successMessage}
            onClose={() => setSuccessMessage(null)}
          />
        </View>
      )}

      {/* ❌ ERROR BANNER */}
      {errorMessage && (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <MessageBanner
            type="error"
            message={errorMessage}
            onClose={() => setErrorMessage(null)}
          />
        </View>
      )}

      {/* 📋 MAIN CONTENT */}
      <View style={styles.contentContainer}>
        {activeTab === 'portfolio' && renderPortfolioView()}
        {activeTab === 'market' && renderMarketView()}
        {activeTab === 'dividends' && renderDividendsView()}
        {activeTab === 'history' && renderHistoryView()}
      </View>

      {/* 💰 BUY SHARES MODAL */}
      {renderBuyModal()}

      {/* 💸 SELL SHARES MODAL */}
      {renderSellModal()}

      {/* 🔄 TRANSFER SHARES MODAL */}
      {renderTransferModal()}

      {/* � BUY DIVIDENDS MODAL */}
      {renderBuyDividendsModal()}
    </SafeAreaView>
  );
};

// 🎨 MODERN SHARES & DIVIDENDS STYLES
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    padding: 16,
  },
  skeletonCard: {
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
  },

  // 🎨 HEADER STYLES
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    gap: spacing.md,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 1,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
  },
  headerActions: {
    alignItems: 'flex-end',
  },
  portfolioValue: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  portfolioValueLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  portfolioValueAmount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  // 📱 HEADER TABS STYLES
  headerTabs: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginLeft: spacing.md,
  },
  headerTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    minWidth: 0, // Allow shrinking
  },
  headerTabText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
    flexShrink: 1,
  },

  // 🎖️ PROFESSIONAL CERTIFICATE STYLES
  professionalCertificateCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    position: 'relative',
    elevation: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    marginVertical: spacing.sm,
  },
  professionalCertificateCardDesktop: {
    padding: spacing.xl,
  },
  professionalCertificateCardMobile: {
    padding: spacing.md,
    marginVertical: spacing.xs,
  },

  // Certificate Border Decorations
  certificateBorderDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  certificateCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderWidth: 3,
  },
  topLeftCorner: {
    top: -2,
    left: -2,
    borderTopColor: 'currentColor',
    borderLeftColor: 'currentColor',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  topRightCorner: {
    top: -2,
    right: -2,
    borderTopColor: 'currentColor',
    borderRightColor: 'currentColor',
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  bottomLeftCorner: {
    bottom: -2,
    left: -2,
    borderBottomColor: 'currentColor',
    borderLeftColor: 'currentColor',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
  },
  bottomRightCorner: {
    bottom: -2,
    right: -2,
    borderBottomColor: 'currentColor',
    borderRightColor: 'currentColor',
    borderLeftColor: 'transparent',
    borderTopColor: 'transparent',
  },

  // Certificate Header
  certificateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  certificateHeaderMobile: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  certificateHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  certificateHeaderLeftMobile: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.sm,
  },
  certificateTitleSection: {
    gap: spacing.xs,
  },
  certificateMainTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1,
  },
  certificateMainTitleMobile: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  certificateSubtitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  certificateSubtitleMobile: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
  certificateSeal: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'currentColor',
  },
  certificateSealMobile: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  // Certificate Number Section
  certificateNumberSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: borderRadius.md,
  },
  certificateNumberSectionMobile: {
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  certificateNumberLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  certificateNumberLabelMobile: {
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.xs,
  },
  certificateNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 2,
  },
  certificateNumberMobile: {
    fontSize: typography.fontSize.lg,
    letterSpacing: 1,
  },

  // Certificate Body
  certificateBody: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  certificateBodyMobile: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  certificateBodyText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  certificateBodyTextMobile: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  certificateShareDetails: {
    gap: spacing.sm,
  },
  shareDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.01)',
    borderRadius: borderRadius.sm,
  },
  shareDetailItemMobile: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  shareDetailLabel: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  shareDetailLabelMobile: {
    fontSize: typography.fontSize.xs,
  },
  shareDetailValue: {
    fontSize: typography.fontSize.sm,
    textAlign: 'right',
    flex: 1,
  },
  shareDetailValueMobile: {
    fontSize: typography.fontSize.xs,
  },

  // Certificate Footer
  certificateFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  certificateFooterMobile: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  certificateFooterLeft: {
    gap: spacing.xs,
  },
  certificateFooterLeftMobile: {
    alignItems: 'center',
  },
  certificateFooterRight: {
    alignItems: 'flex-end',
  },
  certificateFooterRightMobile: {
    alignItems: 'center',
  },
  certificateDateLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  certificateDateLabelMobile: {
    fontSize: typography.fontSize.xxs,
  },
  certificateDate: {
    fontSize: typography.fontSize.sm,
  },
  certificateDateMobile: {
    fontSize: typography.fontSize.xs,
  },
  certificateStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  certificateStatusBadgeMobile: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  certificateStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  certificateStatusTextMobile: {
    fontSize: typography.fontSize.xxs,
  },

  // Certificate Bottom Decoration
  certificateBottomDecoration: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  certificateBottomLine: {
    height: 3,
    width: 100,
    borderRadius: 2,
  },

  // 📱 TAB NAVIGATION STYLES (Legacy - can be removed)
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.sm,
    marginVertical: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  // 📋 CONTENT STYLES
  contentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },

  // 💰 PORTFOLIO STYLES
  portfolioCard: {
    marginBottom: spacing.lg,
    marginHorizontal: spacing.xs,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  portfolioHeader: {
    marginBottom: spacing.lg,
  },
  portfolioTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  portfolioTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    flex: 1,
  },
  performanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  performanceText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  portfolioStats: {
    gap: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statRowMobile: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemMobile: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: borderRadius.sm,
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  emptyPortfolio: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  portfolioActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  portfolioActionsMobile: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  actionButtonMobile: {
    flex: 1,
    minWidth: '100%',
    marginBottom: spacing.xs,
  },

  // 📊 SHARE TYPES STYLES
  shareTypesCard: {
    marginBottom: spacing.lg,
    marginHorizontal: spacing.xs,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  cardHeader: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  shareTypeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  shareTypeInfo: {
    flex: 1,
  },
  shareTypeName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  shareTypeCount: {
    fontSize: typography.fontSize.sm,
  },
  shareTypeValue: {
    alignItems: 'flex-end',
  },
  shareTypeAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  shareTypePrice: {
    fontSize: typography.fontSize.sm,
  },

  // 🏪 MARKET STYLES
  marketCard: {
    marginBottom: spacing.lg,
    marginHorizontal: spacing.xs,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  marketHeader: {
    marginBottom: spacing.lg,
  },
  marketTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  marketTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    flex: 1,
  },
  lastUpdated: {
    fontSize: typography.fontSize.xs,
  },
  marketStats: {
    gap: spacing.lg,
  },
  priceSection: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  currentPrice: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
  },
  priceChange: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  priceChangeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  marketMetrics: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  metricValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },

  // 📋 AVAILABLE SHARES STYLES
  availableSharesCard: {
    marginBottom: spacing.lg,
    marginHorizontal: spacing.xs,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  refreshButton: {
    padding: spacing.sm,
  },
  emptyShares: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  shareItem: {
    padding: spacing.md,
    gap: spacing.md,
  },
  shareItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  shareItemInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  shareItemTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  shareItemDescription: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
  },
  shareItemPrice: {
    alignItems: 'flex-end',
  },
  sharePrice: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  sharePriceLabel: {
    fontSize: typography.fontSize.xs,
  },
  shareItemDetails: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  shareDetail: {
    flex: 1,
  },
  shareDetailLabel: {
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.xs,
  },
  shareDetailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  buyButton: {
    marginTop: spacing.sm,
    minHeight: 44,
  },
  buyButtonMobile: {
    minHeight: 48,
    paddingVertical: spacing.md,
  },
  buyDividendButton: {
    marginTop: spacing.sm,
    minHeight: 44,
  },
  buyDividendButtonMobile: {
    minHeight: 48,
    paddingVertical: spacing.md,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: spacing.sm,
  },

  // 💸 DIVIDEND STYLES
  dividendSummaryCard: {
    marginBottom: spacing.lg,
    marginHorizontal: spacing.xs,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  declareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  declareButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  dividendStats: {
    gap: spacing.md,
  },
  dividendHistoryCard: {
    marginBottom: spacing.lg,
    marginHorizontal: spacing.xs,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  emptyDividends: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  dividendItem: {
    padding: spacing.md,
    gap: spacing.md,
  },
  dividendItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dividendItemInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  dividendItemTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  dividendItemDate: {
    fontSize: typography.fontSize.sm,
  },
  dividendItemAmount: {
    alignItems: 'flex-end',
  },
  dividendAmount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  dividendPerShare: {
    fontSize: typography.fontSize.sm,
  },
  dividendItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dividendDetail: {
    flex: 1,
  },
  dividendDetailLabel: {
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.xs,
  },
  dividendDetailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  // 📈 HISTORY STYLES
  emptyHistory: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  purchaseHistoryItem: {
    padding: spacing.md,
    gap: spacing.md,
  },
  purchaseHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  transactionTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseHistoryInfo: {
    flex: 1,
  },
  purchaseHistoryTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  purchaseHistoryDate: {
    fontSize: typography.fontSize.sm,
  },
  purchaseHistoryAmount: {
    alignItems: 'flex-end',
  },
  purchaseAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  purchasePricePerShare: {
    fontSize: typography.fontSize.sm,
  },

  // 🏆 CERTIFICATE STYLES
  certificateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  certificateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  certificateText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    fontFamily: 'monospace',
  },
  viewCertificateButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  viewCertificateText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },


  // 🎭 MODAL STYLES
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: spacing.lg,
    gap: spacing.lg,
  },

  // 📝 FORM STYLES
  selectedShareCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  selectedShareTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  selectedSharePrice: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  selectedShareAvailable: {
    fontSize: typography.fontSize.sm,
  },
  selectedDividendCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  selectedDividendTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  selectedDividendPrice: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  selectedDividendTotal: {
    fontSize: typography.fontSize.sm,
  },
  buyFormCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
  },
  buyDividendsFormCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
  },
  sellFormCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
  },
  portfolioSummaryCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  portfolioSummaryTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  portfolioSummaryShares: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  portfolioSummaryValue: {
    fontSize: typography.fontSize.sm,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  formLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
  },
  formTextArea: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  formHint: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  totalAmountCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  totalAmountLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  totalAmountValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  paymentMethods: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  paymentMethodsMobile: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  paymentMethod: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    minHeight: 44,
  },
  paymentMethodMobile: {
    width: '100%',
    minHeight: 48,
    paddingVertical: spacing.lg,
  },
  paymentMethodText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  paymentMethodTextMobile: {
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  paymentMethodBalance: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  paymentMethodBalanceMobile: {
    fontSize: typography.fontSize.sm,
  },
  sellReasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sellReason: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  sellReasonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  modalActionsMobile: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    minHeight: 44,
  },
  cancelButtonMobile: {
    minHeight: 48,
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    minHeight: 44,
  },
  confirmButtonMobile: {
    minHeight: 48,
    width: '100%',
  },

  // 🔄 TRANSFER MODAL STYLES
  transferFormCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
  },
  shareSelection: {
    gap: spacing.sm,
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  shareOptionInfo: {
    flex: 1,
  },
  shareOptionName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  shareOptionCount: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  shareOptionValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  memberSelection: {
    gap: spacing.sm,
  },
  memberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  memberOptionInfo: {
    flex: 1,
  },
  memberOptionName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  memberOptionPhone: {
    fontSize: typography.fontSize.sm,
  },
  emptySharesMessage: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptySharesTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  emptySharesText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyMembersMessage: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyMembersTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  emptyMembersText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Missing share type styles
  shareTypeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  shareTypeInfo: {
    flex: 1,
  },
  shareTypeName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  shareTypeCount: {
    fontSize: typography.fontSize.sm,
  },
  shareTypeValue: {
    alignItems: 'flex-end',
  },
  shareTypeAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  shareTypePrice: {
    fontSize: typography.fontSize.sm,
  },

  // 🏆 CERTIFICATES STYLES
  certificatesCard: {
    marginBottom: spacing.lg,
    marginHorizontal: spacing.xs,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  certificatesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  certificatesHeaderMobile: {
    gap: spacing.sm,
  },
  certificatesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  certificatesCount: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    marginLeft: 'auto',
  },
  certificatesCountText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  certificatesGrid: {
    gap: spacing.md,
  },

  // 🎖️ PROFESSIONAL CERTIFICATE STYLES
  professionalCertificateCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    position: 'relative',
    elevation: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    marginVertical: spacing.sm,
  },

  // Certificate Border Decorations
  certificateBorderDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  certificateCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderWidth: 3,
  },
  topLeftCorner: {
    top: -2,
    left: -2,
    borderTopColor: 'currentColor',
    borderLeftColor: 'currentColor',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  topRightCorner: {
    top: -2,
    right: -2,
    borderTopColor: 'currentColor',
    borderRightColor: 'currentColor',
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  bottomLeftCorner: {
    bottom: -2,
    left: -2,
    borderBottomColor: 'currentColor',
    borderLeftColor: 'currentColor',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
  },
  bottomRightCorner: {
    bottom: -2,
    right: -2,
    borderBottomColor: 'currentColor',
    borderRightColor: 'currentColor',
    borderLeftColor: 'transparent',
    borderTopColor: 'transparent',
  },

  // Certificate Header
  certificateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  certificateHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  certificateTitleSection: {
    gap: spacing.xs,
  },
  certificateMainTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1,
  },
  certificateSubtitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  certificateSeal: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'currentColor',
  },

  // Certificate Number Section
  certificateNumberSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: borderRadius.md,
  },
  certificateNumberLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  certificateNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 2,
  },

  // Certificate Body
  certificateBody: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  certificateBodyText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  certificateShareDetails: {
    gap: spacing.sm,
  },
  shareDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.01)',
    borderRadius: borderRadius.sm,
  },
  shareDetailLabel: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  shareDetailValue: {
    fontSize: typography.fontSize.sm,
    textAlign: 'right',
    flex: 1,
  },

  // Certificate Footer
  certificateFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  certificateFooterLeft: {
    gap: spacing.xs,
  },
  certificateFooterRight: {
    alignItems: 'flex-end',
  },
  certificateDateLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  certificateDate: {
    fontSize: typography.fontSize.sm,
  },
  certificateStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  certificateStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  // Certificate Bottom Decoration
  certificateBottomDecoration: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  certificateBottomLine: {
    height: 3,
    width: 100,
    borderRadius: 2,
  },

  // Legacy certificate styles (keeping for compatibility)
  enhancedCertificateCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  enhancedCertificateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  certificateIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certificateMeta: {
    flex: 1,
  },
  enhancedCertificateTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  enhancedCertificateNumber: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  enhancedCertificateDetails: {
    gap: spacing.xs,
  },
  certificateDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  certificateDetailLabel: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  certificateDetailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'right',
    flex: 1,
  },
  certificateStatus: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  certificateStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },


});

export default SharesDividendsScreen;
