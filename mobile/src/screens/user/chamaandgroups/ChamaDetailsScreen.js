import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
  Image,
  Linking,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import ApiService from '../../../services/api';
import getResponsiveStyles from '../../../styles/ChamaDetailsScreenStyles';

const ChamaDetailsScreen = ({ route, navigation }) => {
  const { chamaId } = route.params;
  const { theme, user, setSelectedChama, switchToChamaDashboard } = useApp();
  const colors = getThemeColors(theme);

  // Get current screen dimensions for responsive design
  const [screenData, setScreenData] = useState(Dimensions.get('window'));

  useEffect(() => {
    const onChange = (result) => {
      setScreenData(result.window);
    };

    const subscription = Dimensions.addEventListener('change', onChange);
    return () => subscription?.remove();
  }, []);

  // Responsive configuration
  const { width: screenWidth } = screenData;
  const getResponsiveConfig = () => {
    if (screenWidth < 600) {
      return { isLargeScreen: false, screenType: 'mobile' };
    } else if (screenWidth < 900) {
      return { isLargeScreen: true, screenType: 'tablet' };
    } else {
      return { isLargeScreen: true, screenType: 'desktop' };
    }
  };

  const { isLargeScreen, screenType } = getResponsiveConfig();

  // Responsive text sizing helper
  const getResponsiveTextSize = (baseSize) => {
    const sizeMultiplier = screenType === 'desktop' ? 1.2 : screenType === 'tablet' ? 1.1 : 1;
    return baseSize * sizeMultiplier;
  };

  // Create responsive styles
  const styles = getResponsiveStyles(screenType, screenWidth, colors);

  // Smart responsive layout component
  const SmartResponsiveLayout = ({ children }) => {
    if (!isLargeScreen) {
      // Mobile: all cards take full width
      return <View>{children}</View>;
    }

    // Define which cards can share a row (compact cards)
    const cardConfigs = [
      { component: 'members', canShare: true, priority: 1 },
      { component: 'meetings', canShare: true, priority: 2 },
      { component: 'transactions', canShare: false, priority: 3 }, // Full width (has transaction list)
      { component: 'polls', canShare: false, priority: 4 }, // Full width (has poll details)
    ];

    const childrenArray = React.Children.toArray(children);
    const rows = [];
    let currentRow = [];

    childrenArray.forEach((child, index) => {
      const config = cardConfigs[index] || { canShare: false };

      if (!config.canShare || currentRow.length === 0) {
        // Start new row
        if (currentRow.length > 0) {
          // Finish previous row
          rows.push(
            <View key={`row-${rows.length}`} style={styles.flexibleRow}>
              {currentRow.map((item, idx) => (
                <View key={idx} style={[styles.flexibleCard, { flex: 1 / currentRow.length }]}>
                  {item}
                </View>
              ))}
            </View>
          );
          currentRow = [];
        }

        if (config.canShare) {
          currentRow.push(child);
        } else {
          // Full width card
          rows.push(
            <View key={`row-${rows.length}`} style={styles.fullWidthRow}>
              {child}
            </View>
          );
        }
      } else if (config.canShare && currentRow.length === 1) {
        // Add to current row (max 2 cards per row)
        currentRow.push(child);

        // Finish the row
        rows.push(
          <View key={`row-${rows.length}`} style={styles.flexibleRow}>
            {currentRow.map((item, idx) => (
              <View key={idx} style={[styles.flexibleCard, { flex: 0.5 }]}>
                {item}
              </View>
            ))}
          </View>
        );
        currentRow = [];
      }
    });

    // Handle any remaining cards in currentRow
    if (currentRow.length > 0) {
      rows.push(
        <View key={`row-${rows.length}`} style={styles.flexibleRow}>
          {currentRow.map((item, idx) => (
            <View key={idx} style={[styles.flexibleCard, { flex: 1 / currentRow.length }]}>
              {item}
            </View>
          ))}
        </View>
      );
    }

    return <View>{rows}</View>;
  };

  const [chama, setChama] = useState(null);
  const [members, setMembers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loans, setLoans] = useState([]);
  const [polls, setPolls] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userMembership, setUserMembership] = useState(null);
  const [chatRoomLoading, setChatRoomLoading] = useState(false);
  const [uploadingRules, setUploadingRules] = useState(false);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [pollsLoading, setPollsLoading] = useState(false);

  // Reset state and reload data when chamaId changes
  useEffect(() => {
    if (chamaId) {
      // Reset all state to prevent showing previous chama data
      setChama(null);
      setMembers([]);
      setMeetings([]);
      setTransactions([]);
      setLoans([]);
      setPolls([]);
      setStatistics(null);
      setUserMembership(null);

      // Load new chama data
      loadChamaDetails();
    }
  }, [chamaId]);

  // Also reload when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (chamaId) {
        loadChamaDetails();
      }
    });

    return unsubscribe;
  }, [navigation, chamaId]);

  const loadChamaDetails = async (targetChamaId = chamaId) => {
    try {
      // Ensure we have a valid chamaId
      if (!targetChamaId) {
        return;
      }

      // Load basic chama data and members first (critical for page display)
      // Use independent calls so a failure on one doesn't block the other
      let chamaResponse;
      let membersResponse;
      try {
        chamaResponse = await ApiService.getChamaById(targetChamaId);
      } catch (chamaError) {
        console.error('[ChamaDetails] getChamaById error:', chamaError);
        chamaResponse = { success: false, data: null };
      }

      try {
        membersResponse = await ApiService.getChamaMembers(targetChamaId);
      } catch (membersError) {
        console.error('[ChamaDetails] getChamaMembers error:', membersError);
        membersResponse = { success: false, data: [] };
      }

      if (chamaResponse.success && chamaResponse.data) {
        setChama(chamaResponse.data);
        setSelectedChama(chamaResponse.data);
      }

      // Determine membership through multiple fallbacks
      let membership = null;

      // Fallback 1: Try to find user in chama members list
      if (membersResponse.success) {
        const membersData = Array.isArray(membersResponse.data) ? membersResponse.data : [];
        console.log('[ChamaDetails] membersResponse.data type:', typeof membersResponse.data, Array.isArray(membersResponse.data) ? membersResponse.data.length : 'N/A');
        const uniqueMembers = Array.from(
          new Map(membersData.map((m) => [m.id, m])).values()
        );
        setMembers(uniqueMembers);
        const currentUserId = String(user?.id);
        console.log('[ChamaDetails] currentUserId:', currentUserId, 'uniqueMembers count:', uniqueMembers.length);

        membership = uniqueMembers.find(member => {
          const memberUserId = String(
            member.user_id ||
            member.userId ||
            member.user?.id ||
            member.user?.userId ||
            ''
          );
          const matches = memberUserId === currentUserId;
          if (!matches) {
               }
          return matches;
        });
        console.log('[ChamaDetails] membership from members list:', !!membership, membership?.role);
      } else {
        console.log('[ChamaDetails] getChamaMembers failed or returned no data, membersResponse:', membersResponse);
        setMembers([]);
      }

      // Fallback 2: If not found in members list, check user's chamas via /chamas/my
      if (!membership && chamaResponse.data) {
        const currentUserId = String(user?.id);
        console.log('[ChamaDetails] membership not found in members list, checking /chamas/my');
        try {
          const myChamasResponse = await ApiService.getUserChamas(50, 0);
          if (myChamasResponse.success && Array.isArray(myChamasResponse.data)) {
            const myChama = myChamasResponse.data.find(c => String(c.id) === String(chamaResponse.data.id));
            if (myChama) {
              console.log('[ChamaDetails] chama found in user chamas list:', myChama.memberRole || myChama.role);
              membership = {
                id: myChama.memberId || myChama.id,
                user_id: currentUserId,
                role: myChama.memberRole || myChama.role || 'member',
                joined_at: myChama.createdAt || new Date().toISOString(),
              };
            } else {
              console.log('[ChamaDetails] chama NOT found in user chamas list');
            }
          } else {
            console.log('[ChamaDetails] getUserChamas failed or returned no data');
          }
        } catch (myChamasError) {
          console.error('[ChamaDetails] getUserChamas error:', myChamasError);
        }
      }

      // Fallback 3: If still not found, check if user is the chama creator
      if (!membership && chamaResponse.data) {
        const currentUserId = String(user?.id);
        const creatorId = String(chamaResponse.data.createdBy);
        if (creatorId === currentUserId) {
          console.log('[ChamaDetails] user is chama creator, assigning chairperson');
          membership = {
            id: 'creator',
            user_id: currentUserId,
            role: 'chairperson',
            joined_at: chamaResponse.data.createdAt || new Date().toISOString(),
          };
        }
      }

      setUserMembership(membership);
      console.log('[ChamaDetails] final userMembership:', !!membership, membership?.role);

      // Load additional data in background (non-blocking)
      setMeetingsLoading(true);
      setTransactionsLoading(true);
      setPollsLoading(true);
      setStatisticsLoading(true);

      Promise.all([
        // Load user transactions
        ApiService.getChamaTransactions(targetChamaId).then(response => {
          if (response.success) {
            const allTransactions = response.data || [];
            const userTransactions = allTransactions.filter(transaction => {
              return transaction.user_id === user?.id ||
                     transaction.initiated_by === user?.id ||
                     transaction.member_id === user?.id ||
                     transaction.sender_id === user?.id ||
                     transaction.recipient_id === user?.id ||
                     (transaction.user && transaction.user.id === user?.id) ||
                     (transaction.member && transaction.member.user_id === user?.id);
            });
            setTransactions(userTransactions);
          }
          setTransactionsLoading(false);
        }).catch(error => {
          setTransactions([]);
          setTransactionsLoading(false);
        }),

        // Load active polls (same logic as PollsVotingScreen)
        Promise.all([
          ApiService.getActiveVotes(targetChamaId),
          ApiService.getVoteResults(targetChamaId)
        ]).then(([activeResponse, completedResponse]) => {

          // Combine and filter out duplicates, preferring completed status
          const allPolls = [];
          const pollMap = new Map();

          // Add active polls first
          if (activeResponse.success && activeResponse.data) {
            activeResponse.data.forEach(poll => pollMap.set(poll.id, poll));
          }

          // Add completed polls (these will override active ones if they exist)
          if (completedResponse.success && completedResponse.data) {
            completedResponse.data.forEach(poll => pollMap.set(poll.id, poll));
          }

          allPolls.push(...pollMap.values());

          setPolls(allPolls);
          setPollsLoading(false);

          if (allPolls.length > 0) {
          }
        }).catch(error => {
          setPolls([]);
          setPollsLoading(false);
        }),

        // Load meetings (like ChamaMeetingsScreen does)
        ApiService.getMeetings(targetChamaId).then(response => {
          if (response.success) {
            const meetingsData = response.data || [];
            setMeetings(meetingsData);
            if (meetingsData.length > 0) {
            }
          }
          setMeetingsLoading(false);
        }).catch(error => {
          setMeetings([]);
          setMeetingsLoading(false);
        }),

        // Load statistics
        ApiService.getChamaStatistics(targetChamaId).then(response => {
          if (response.success) {
            setStatistics(response.data);
          }
          setStatisticsLoading(false);
        }).catch(error => {
          setStatistics(null);
          setStatisticsLoading(false);
        })
      ]);

      // Set empty array for loans (API not implemented yet)
      setLoans([]);

    } catch (error) {
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChamaDetails(chamaId);
    setRefreshing(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleJoinChama = async () => {
    try {
      const response = await ApiService.joinChama(chamaId);
      if (response.success) {
        Alert.alert('Success', 'You have successfully joined the chama!');
        await loadChamaDetails();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to join chama');
    }
  };

  const handleLeaveChama = () => {
    Alert.alert(
      'Leave Chama',
      'Are you sure you want to leave this chama?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: confirmLeaveChama },
      ]
    );
  };

  const confirmLeaveChama = async () => {
    try {
      const response = await ApiService.leaveChama(chamaId);
      if (response.success) {
        Alert.alert('Success', 'You have left the chama');
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to leave chama');
    }
  };

  const getExistingChatRoomId = () => {
    return chama?.chat_room_id || chama?.chatRoomId || chama?.chat_room?.id || chama?.chatRoom?.id;
  };

  const getGroupLabel = () => {
    return chama?.category === 'contribution' ? 'Group' : 'Chama';
  };

  const navigateToChatRoom = (roomId) => {
    navigation.navigate('ChatRoom', {
      roomId,
      roomName: `${chama?.name || getGroupLabel()} Group Chat`,
      roomType: 'group',
      chamaId,
    });
  };

  const handleCreateChatRoom = () => {
    const existingChatRoomId = getExistingChatRoomId();
    if (existingChatRoomId) {
      navigateToChatRoom(existingChatRoomId);
      return;
    }

    const canCreateChatRoom = ['chairperson', 'treasurer', 'secretary'].includes(userMembership?.role?.toLowerCase());
    if (!canCreateChatRoom) {
        Alert.alert(
          'Access Denied',
          'Only chairperson, secretary, and treasurer can create a chat room for this group.'
        );
      return;
    }

    confirmCreateChatRoom();
  };

  const confirmCreateChatRoom = async () => {
    try {
      setChatRoomLoading(true);

      const response = await ApiService.createChamaChatRoom(chamaId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to create chat room');
      }

      const roomId = response.data?.roomId || response.data?.id || getExistingChatRoomId();
      if (!roomId) {
        throw new Error('Chat room was created but no room ID was returned');
      }

      setChama(prev => prev ? { ...prev, chat_room_id: roomId } : prev);
      setSelectedChama(prev => prev && prev.id === chamaId ? { ...prev, chat_room_id: roomId } : prev);

      Alert.alert(
        'Chat Room Created',
        'Chat room has been created for this group.'
      );

      navigateToChatRoom(roomId);
    } catch (error) {
      console.error('[ChamaDetails] Error creating chat room:', error);
      Alert.alert('Error', error.message || 'Failed to create chat room');
    } finally {
      console.log('[ChamaDetails] Chat room loading finished');
      setChatRoomLoading(false);
    }
  };

  const handleUploadRulesFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const document = result.assets[0];
      // Accept only real PDFs. Some platforms misreport mimeType, so also
      // validate by extension — a .docx renamed to .pdf can't be rendered
      // in-app and would just download.
      const docName = document.name || '';
      const isPdf = document.mimeType === 'application/pdf' || docName.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        Toast.show({ type: 'error', text1: 'Invalid file type', text2: 'Only PDF files are accepted for rules' });
        return;
      }
      setUploadingRules(true);
      const formData = new FormData();

      // On web, FormData.append requires a Blob/File. A plain { uri, type, name }
      // object is serialized to "[object Object]" and the server receives no file
      // (→ 400 "No updatable fields provided"). Fetch the picked file into a Blob
      // and wrap it as a File when running on web so the part is sent correctly.
      let fileToUpload;
      if (Platform.OS === 'web') {
        const fileResponse = await fetch(document.uri);
        const blob = await fileResponse.blob();
        fileToUpload = new File([blob], document.name || 'rules.pdf', {
          type: document.mimeType || 'application/pdf',
        });
      } else if (document.uri.startsWith('data:')) {
        const fileResponse = await fetch(document.uri);
        const blob = await fileResponse.blob();
        fileToUpload = new File([blob], document.name, { type: document.mimeType });
      } else {
        fileToUpload = {
          uri: document.uri,
          type: document.mimeType || 'application/pdf',
          name: document.name || 'rules.pdf',
        };
      }

      formData.append('rules_file', fileToUpload);
      formData.append('rules_file_name', document.name || 'rules.pdf');
      const response = await ApiService.makeRequest(`/chamas/${chamaId}`, {
        method: 'PUT',
        body: formData,
      });
      if (response.success) {
        Toast.show({ type: 'success', text1: 'Rules PDF updated' });
        await loadChamaDetails();
      } else {
        Toast.show({ type: 'error', text1: 'Upload failed', text2: response.error });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Upload failed', text2: error.message });
    } finally {
      setUploadingRules(false);
    }
  };

  const handleRemoveRulesFile = async () => {
    try {
      setUploadingRules(true);
      const response = await ApiService.updateChama(chamaId, {
        rules_file_path: '',
        rules_file_name: '',
      });
      if (response.success) {
        Toast.show({ type: 'success', text1: 'Rules PDF removed' });
        await loadChamaDetails();
      } else {
        Toast.show({ type: 'error', text1: 'Remove failed', text2: response.error });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Remove failed', text2: error.message });
    } finally {
      setUploadingRules(false);
    }
  };

  const renderChamaHeader = () => {
    const isContributionGroup = chama?.category === 'contribution';
    const typeConfig = isContributionGroup ? {
      color: colors.success,
      icon: 'heart',
      label: 'Fund Group', // Shorter for mobile
      fullLabel: 'Contribution Group',
      bgColor: colors.success + '15'
    } : {
      color: colors.primary,
      icon: 'people',
      label: 'Chama',
      fullLabel: 'Chama',
      bgColor: colors.primary + '15'
    };

    return (
      <Card style={styles.section} variant="outlined">
        {/* Category Badge */}
        <View style={[styles.categoryBadge, { backgroundColor: typeConfig.color }]}>
          <Ionicons name={typeConfig.icon} size={12} color={colors.white} />
          <Text style={[styles.categoryBadgeText, { color: colors.white }]}>
            {typeConfig.label.toUpperCase()}
          </Text>
        </View>

        <View style={styles.chamaHeader}>
          <View style={[styles.chamaAvatar, { backgroundColor: typeConfig.color }]}>
            <Ionicons name={typeConfig.icon} size={40} color={colors.white} />
          </View>

          <View style={styles.chamaInfo}>
            <Text style={[styles.chamaName, { color: colors.text }]}>
              {chama?.name}
            </Text>
            <Text style={[styles.chamaType, { color: colors.textSecondary }]}>
              {chama?.type} • {chama?.county}, {chama?.town}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: colors.success + '20' }]}>
              <Text style={[styles.statusText, { color: colors.success }]}>
                {chama?.status?.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Improved Description Section */}
        {chama?.description && (
          <View style={styles.descriptionContainer}>
            <Text style={[styles.descriptionLabel, { color: colors.text }]}>
              About this {typeConfig.fullLabel}
            </Text>
            <Text
              style={[styles.chamaDescription, { color: colors.textSecondary }]}
              numberOfLines={0}
              allowFontScaling={true}
            >
              {chama.description}
            </Text>
          </View>
        )}
      </Card>
    );
  };

  const renderStats = () => {
    const financialStats = statistics?.financial_stats || {};
    const memberStats = statistics?.member_stats || {};
    const activityStats = statistics?.activity_stats || {};
    const chamaInfo = statistics?.chama_info || {};
    const walletBalance = chamaInfo.wallet_balance || chamaInfo.total_funds || chama?.total_funds || 0;
    const totalMembers = memberStats.active_members || memberStats.total_members || chamaInfo.current_members || members.length || 0;
    const maxMembers = chama?.max_members || chamaInfo.max_members || 50;
    const totalMeetings = activityStats.total_meetings || 0;
    const contributionAmount = chama?.contribution_amount || 0;
    const contributionFrequency = chama?.contribution_frequency || 'Monthly';
    const totalContributions = financialStats.total_contributions || 0;
    const activePolls = polls.length || 0; // Polls from API call

    return (
      <Card style={styles.section} variant="outlined">
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Chama Statistics
        </Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {totalMembers}/{maxMembers}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Members
            </Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="wallet" size={24} color={colors.secondary} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatCurrency(walletBalance)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Total Balance
            </Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="trending-up" size={24} color={colors.success} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatCurrency(contributionAmount)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {contributionFrequency} Contribution
            </Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="cash" size={24} color={colors.warning} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {totalContributions}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Total Accounts
            </Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={24} color={colors.info} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {totalMeetings}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Total Meetings
            </Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {activePolls}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Active Polls
            </Text>
          </View>
        </View>
      </Card>
    );
  };

  const handleAvatarPress = (member) => {
    navigation.navigate('ViewMember', {
      memberId: member?.user_id || member?.id,
      chamaId,
      userRole: userMembership?.role,
    });
  };

  // Pick a stable background color for a local initials avatar from a seed.
  // Purely local (no network request) so nothing leaks into the browser
  // network tab and there are no ORB/CORS failures.
  const AVATAR_COLORS = ['#00D4AA', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#EC4899', '#6366F1'];
  const getAvatarColor = (seed) => {
    const str = String(seed || '');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
  };

  // Map a user's gender to a local avatar icon. Falls back to a neutral person
  // icon when gender is unknown / non-binary. No network request involved.
  const getAvatarGenderIcon = (gender) => {
    if (gender === 'female') return 'female';
    if (gender === 'male') return 'male';
    return 'person';
  };

  // Helper function to render member avatar with real profile photo
  const renderMemberAvatar = (member) => {
    if (!member) {
      return (
        <View style={[styles.memberAvatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.memberInitials, { color: colors.white }]}>?</Text>
        </View>
      );
    }

    // Access data from nested user object
    const user = member?.user || {};
    const email = user?.email || member?.email;

    // Try multiple avatar sources from user object
    const avatarUrl = user?.avatar_url || user?.avatar || user?.profile_image || member?.avatar || member?.avatarUrl;

    // Try to use provided avatar URL first
    if (avatarUrl && avatarUrl.trim()) {
      let fullAvatarUrl;
      if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) {
        fullAvatarUrl = avatarUrl;
      } else {
        fullAvatarUrl = `${ApiService.uploadBaseUrl}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
      }

      return (
        <TouchableOpacity onPress={() => handleAvatarPress(member)}>
          <Image
            source={{ uri: fullAvatarUrl }}
            style={styles.memberAvatar}
            onError={(error) => {
              // Will fallback to local initials avatar
            }}
          />
        </TouchableOpacity>
      );
    }

    // No profile photo: render a local gender-based avatar (no network request).
    const avatarColor = getAvatarColor(member?.id || user?.id || member?.user_id || email);
    const genderIcon = getAvatarGenderIcon(user?.gender);
    return (
      <TouchableOpacity onPress={() => handleAvatarPress(member)}>
        <View style={[styles.memberAvatar, { backgroundColor: avatarColor }]}>
          <Ionicons name={genderIcon} size={36} color={colors.white} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderMembers = () => (
    <Card style={styles.section} variant="outlined">
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Members ({members.length})
        </Text>
        {members.length > 5 && (
          <TouchableOpacity onPress={() => navigation.navigate('ChamaMembersScreen', { chamaId })}>
            <Text style={[styles.viewMoreText, { color: colors.primary }]}>
              View All
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {members.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No members found
        </Text>
      ) : (
        <View style={styles.membersList}>
          {members.slice(0, 5).map((member, index) => {
            const firstName = member.first_name || member.user?.first_name || '';
            const lastName = member.last_name || member.user?.last_name || '';
            const fullName = `${firstName} ${lastName}`.trim() || 'Unknown Member';

            // Parse join date safely
            let joinDate = 'Unknown Date';
            try {
              if (member.joined_at) {
                const date = new Date(member.joined_at);
                if (!isNaN(date.getTime())) {
                  joinDate = date.toLocaleDateString();
                }
              }
            } catch (error) {
            }

            // Get status safely
            const memberStatus = member.status || member.user?.status || 'active';
            const isActive = memberStatus === 'active';

            return (
              <View key={[member.user_id, member.id, index].filter(Boolean).join('-')} style={[styles.memberItem, { borderBottomColor: colors.border }]}>
                {renderMemberAvatar(member)}
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: colors.text }]}>
                    {fullName}
                  </Text>
                  <Text style={[styles.memberRole, { color: colors.textSecondary }]}>
                    {member.role || 'Member'} • Joined {joinDate}
                  </Text>
                </View>
                <View style={[styles.memberStatus, { backgroundColor: isActive ? colors.success + '20' : colors.warning + '20' }]}>
                  <Text style={[styles.memberStatusText, { color: isActive ? colors.success : colors.warning }]}>
                    {memberStatus}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );

  const renderMeetings = () => (
    <Card style={[styles.section, { borderWidth: 1, borderColor: colors.border }]} variant="flat">
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Recent Meetings
        </Text>
        {meetings.length > 5 && !meetingsLoading && (
          <TouchableOpacity onPress={() => navigation.navigate('ChamaMeetingsScreen', { chamaId })}>
            <Text style={[styles.viewMoreText, { color: colors.primary }]}>
              View All
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {meetingsLoading ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ marginTop: 8, color: colors.textSecondary }}>Loading meetings…</Text>
        </View>
      ) : meetings.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No meetings scheduled
        </Text>
      ) : (
        <View>
          {/* Table Header */}
          <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 2, borderBottomColor: colors.primary }}>
            <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.text, textTransform: 'uppercase' }}>Title</Text>
            <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.text, textAlign: 'center', textTransform: 'uppercase' }}>Date & Time</Text>
            <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.text, textAlign: 'center', textTransform: 'uppercase' }}>Status</Text>
          </View>

          {/* Table Rows */}
          {meetings.slice(0, 5).map((meeting, index) => {
            let meetingDate = 'Unknown Date';
            let meetingTime = '';

            try {
              const dateStr = meeting.scheduledAt || meeting.scheduled_date || meeting.date;
              if (dateStr) {
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) {
                  meetingDate = date.toLocaleDateString();
                  meetingTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
              }
            } catch (error) {
            }

            const meetingStatus = meeting.status || 'scheduled';
            const isCompleted = meetingStatus === 'completed' || meetingStatus === 'ended';
            const isPast = new Date(meeting.scheduledAt || meeting.scheduled_date || meeting.date) < new Date();

            return (
              <View key={`meeting-${meeting.id || index}`} style={[{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }]}>
                <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), color: colors.text }} numberOfLines={1}>{meeting.title || 'Chama Meeting'}</Text>
                <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), color: colors.textSecondary, textAlign: 'center' }}>{meetingDate} {meetingTime}</Text>
                <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), color: isCompleted ? colors.success : isPast ? colors.textSecondary : colors.info, textAlign: 'center' }}>
                  {isCompleted ? 'Completed' : isPast ? 'Past' : 'Scheduled'}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
 

  const renderTransactions = () => (
    <Card style={[styles.section, { borderWidth: 1, borderColor: colors.border }]} variant="flat">
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          My Transactions
        </Text>
        {transactions.length > 5 && !transactionsLoading && (
          <TouchableOpacity onPress={() => {
            if (chama) {
              setSelectedChama(chama);
            }
            navigation.navigate('ChamaTransactionsScreen', { chamaId, chama });
          }}>
            <Text style={[styles.viewMoreText, { color: colors.primary }]}>
              View All
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {transactionsLoading ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ marginTop: 8, color: colors.textSecondary }}>Loading transactions…</Text>
        </View>
      ) : transactions.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No transactions found for your account
        </Text>
      ) : (
        <View>
          {/* Table Header */}
          <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 2, borderBottomColor: colors.primary }}>
            <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.text, textTransform: 'uppercase' }}>Description</Text>
            <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.text, textAlign: 'center', textTransform: 'uppercase' }}>Date</Text>
            <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.text, textAlign: 'right', textTransform: 'uppercase' }}>Amount</Text>
          </View>

          {/* Table Rows */}
          {transactions.slice(0, 5).map((transaction, index) => {
            let contributionDate = 'Unknown Date';

            try {
              const dateValue = transaction.createdAt || transaction.created_at || transaction.date || transaction.transaction_date;

              if (dateValue) {
                const date = new Date(dateValue);
                if (!isNaN(date.getTime()) && date.getFullYear() > 1900) {
                  contributionDate = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                }
              }
            } catch (error) {
            }

            const transactionType = transaction.type || 'transaction';
            const isContribution = transactionType === 'contribution' || transactionType === 'deposit' || transaction.description?.toLowerCase().includes('contribution');
            const transactionDescription = transaction.description || (isContribution ? 'Chama Contribution' : 'Transaction') || transactionType;

            return (
              <View key={`transaction-${transaction.id || index}`} style={[{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }]}>
                <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), color: colors.text }} numberOfLines={1}>{transactionDescription}</Text>
                <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), color: colors.textSecondary, textAlign: 'center' }}>{contributionDate}</Text>
                <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.medium, color: isContribution ? colors.success : colors.primary, textAlign: 'right' }}>
                  {formatCurrency(transaction.amount)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );

  const renderActivePolls = () => {

    const votedPolls = polls.filter(poll => poll.userVoted || poll.user_has_voted);
    const unvotedPolls = polls.filter(poll => !(poll.userVoted || poll.user_has_voted));


    // Get last 5 voted polls (most recent first)
    const recentVotedPolls = votedPolls.slice(-5).reverse();

    // Count of new polls user hasn't acted on
    const newPollsCount = unvotedPolls.length;

    return (
      <Card style={styles.section} variant="outlined">
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Polls & Voting
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('PollsVotingScreen', { chamaId })}>
            <Text style={[styles.viewMoreText, { color: colors.primary }]}>
              View All
            </Text>
          </TouchableOpacity>
        </View>

        {pollsLoading ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ marginTop: 8, color: colors.textSecondary }}>Loading polls…</Text>
          </View>
        ) : polls.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
            <Ionicons name="bar-chart" size={48} color={colors.primary} />
            <Text style={[styles.emptyText, { color: colors.primary, marginTop: spacing.sm, fontWeight: '500' }]}>
              No polls & vote available
            </Text>
          </View>
        ) : (
          <View>
            {/* Notification for new polls */}
            {newPollsCount > 0 && (
              <View style={[styles.newPollsNotification, { backgroundColor: colors.warning + '15', borderColor: colors.warning }]}>
                <Ionicons name="notifications" size={20} color={colors.warning} />
                <Text style={[styles.newPollsText, { color: colors.warning }]}>
                  You have {newPollsCount} new poll{newPollsCount !== 1 ? 's' : ''} waiting for your vote!
                </Text>
              </View>
            )}

            {/* Table Header */}
            <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 2, borderBottomColor: colors.primary }}>
              <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.text, textTransform: 'uppercase' }}>Title</Text>
              <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.text, textAlign: 'center', textTransform: 'uppercase' }}>You Voted</Text>
              <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.text, textAlign: 'center', textTransform: 'uppercase' }}>Status</Text>
            </View>

            {/* Table Rows */}
            {recentVotedPolls.map((poll, index) => {
              const hasUserVoted = poll.userVoted || poll.user_has_voted;
              const pollStatus = poll.status || 'active';

              const endDate = poll.endDate || poll.end_date || poll.endsAt;
              const hasEnded = endDate && new Date(endDate) < new Date();
              const isActive = pollStatus === 'active' && !hasEnded;

              return (
                 <View key={`poll-${poll.id || index}`} style={[{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }]}>
                   <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), color: colors.text }} numberOfLines={1}>{poll.title || 'Poll'}</Text>
                   <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                     <Ionicons
                       name={hasUserVoted ? "checkmark-circle" : "close-circle"}
                       size={16}
                       color={hasUserVoted ? colors.success : colors.error}
                     />
                   </View>
                   <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), color: isActive ? colors.success : colors.textSecondary, textAlign: 'center' }}>
                     {isActive ? 'Active' : 'Closed'}
                   </Text>
                 </View>
               );
             })}

            {/* New polls row */}
            {newPollsCount > 0 && (
              <TouchableOpacity
                style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}
                onPress={() => navigation.navigate('PollsVotingScreen', { chamaId })}
              >
                <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), color: colors.primary }} numberOfLines={1}>New Polls Available</Text>
                <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), color: colors.primary, textAlign: 'center' }}>{newPollsCount}</Text>
                <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), color: colors.primary, textAlign: 'center' }}>New</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Card>
    );
  };

  const renderChamaRules = () => {
    // Resolve the uploaded rules document (stored in dedicated columns, with fallback to permissions).
    // Only considered "present" if a non-empty path exists, so the card only shows for chamas that uploaded a file.
    const rawRulesFilePath = (chama?.rules_file_path && chama.rules_file_path.trim()) ||
      (chama?.permissions && chama.permissions.rules_file_path);
    const rulesFilePath = rawRulesFilePath ? rawRulesFilePath.trim() : null;
    const rulesFileName = (chama?.rules_file_name && chama.rules_file_name.trim()) ||
      (chama?.permissions && chama.permissions.rules_file_name) || null;

    const handleOpenRulesFile = async () => {
      if (!rulesFilePath) return;
      const fullUrl = rulesFilePath.startsWith('http')
        ? rulesFilePath
        : `${ApiService.uploadBaseUrl}${rulesFilePath.startsWith('/') ? '' : '/'}${rulesFilePath}`;
      try {
        const supported = await Linking.canOpenURL(fullUrl);
        if (supported) {
          await Linking.openURL(fullUrl);
        } else {
          Alert.alert('Unable to open', 'No application is available to open the rules document.');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to open the rules document.');
      }
    };

    // Parse rules - they might be a JSON string, object, or plain string
    let rules = [];
    if (chama?.rules) {
      try {
        if (typeof chama.rules === 'string') {
          // Try to parse as JSON first
          try {
            const parsed = JSON.parse(chama.rules);
            if (Array.isArray(parsed)) {
              rules = parsed;
            } else if (typeof parsed === 'object') {
              rules = Object.entries(parsed).map(([key, value]) => ({
                title: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                description: typeof value === 'string' ? value : JSON.stringify(value)
              }));
            } else {
              // If parsed result is not array/object, treat as single rule
              rules = [{ title: 'Chama Rule', description: String(parsed) }];
            }
          } catch (jsonError) {
            // If JSON parsing fails, treat as plain text rule
            rules = [{ title: 'Chama Rule', description: chama.rules }];
          }
        } else if (Array.isArray(chama.rules)) {
          rules = chama.rules;
        } else if (typeof chama.rules === 'object') {
          // Convert object to array format
          rules = Object.entries(chama.rules).map(([key, value]) => ({
            title: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
            description: typeof value === 'string' ? value : JSON.stringify(value)
          }));
        }
      } catch (error) {
        // Fallback: treat as plain text
        if (typeof chama.rules === 'string') {
          rules = [{ title: 'Chama Rule', description: chama.rules }];
        }
      }
    }

    return (
      <Card style={styles.section} variant="outlined">
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Chama Rules & Regulations
        </Text>

        {/* Attached rules document (uploaded PDF) */}
        {rulesFilePath && (
          <TouchableOpacity
            style={[styles.rulesFileCard, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
            onPress={handleOpenRulesFile}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text" size={24} color={colors.primary} />
            <View style={styles.rulesFileInfo}>
              <Text style={[styles.rulesFileTitle, { color: colors.text }]} numberOfLines={1}>
                {rulesFileName || 'Chama Rules Document'}
              </Text>
              <Text style={[styles.rulesFileSubtitle, { color: colors.textSecondary }]}>
                Tap to view the attached rules PDF
              </Text>
            </View>
            <Ionicons name="open-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}

        <View style={styles.rulesList}>
          {/* Show custom rules first if they exist */}
          {rules.length > 0 && (
            <>
              <Text style={[styles.rulesSubtitle, { color: colors.text }]}>
                Chama-Specific Rules:
              </Text>
              {rules.map((rule, index) => (
                <View key={`custom-${index}`}>
                  <View style={[styles.ruleItem, { borderLeftColor: colors.primary }]}>
                    <View style={styles.ruleHeader}>
                      <Text style={[styles.ruleNumber, { color: colors.primary }]}>
                        {index + 1}
                      </Text>
                      <Text style={[styles.ruleTitle, { color: colors.text }]}>
                        {rule.title || `Rule ${index + 1}`}
                      </Text>
                    </View>
                    <Text style={[styles.ruleDescription, { color: colors.textSecondary }]}>
                      {rule.description || rule}
                    </Text>
                    {rule.penalty && (
                      <Text style={[styles.rulePenalty, { color: colors.warning }]}>
                        Penalty: {rule.penalty}
                      </Text>
                    )}
                  </View>
                  {index < rules.length - 1 && <View style={[styles.horizontalSeparator, { backgroundColor: colors.border }]} />}
                </View>
              ))}
            </>
          )}

          {/* Always show standard guidelines */}
          <Text style={[styles.rulesSubtitle, { color: colors.text, marginTop: rules.length > 0 ? spacing.lg : 0 }]}>
            Standard Chama Guidelines:
          </Text>

          <View style={styles.ruleItem}>
            <View style={styles.ruleHeader}>
              <Text style={[styles.ruleNumber, { color: colors.secondary }]}>
                {rules.length + 1}
              </Text>
              <Text style={[styles.ruleTitle, { color: colors.text }]}>
                Regular Contributions
              </Text>
            </View>
            <Text style={[styles.ruleDescription, { color: colors.textSecondary }]}>
              Members must make their contributions on time as per the agreed schedule
            </Text>
          </View>
          <View style={[styles.horizontalSeparator, { backgroundColor: colors.border }]} />

          <View style={styles.ruleItem}>
            <View style={styles.ruleHeader}>
              <Text style={[styles.ruleNumber, { color: colors.secondary }]}>
                {rules.length + 2}
              </Text>
              <Text style={[styles.ruleTitle, { color: colors.text }]}>
                Meeting Attendance
              </Text>
            </View>
            <Text style={[styles.ruleDescription, { color: colors.textSecondary }]}>
              Members are expected to attend scheduled meetings or provide advance notice
            </Text>
          </View>
          <View style={[styles.horizontalSeparator, { backgroundColor: colors.border }]} />

          <View style={styles.ruleItem}>
            <View style={styles.ruleHeader}>
              <Text style={[styles.ruleNumber, { color: colors.secondary }]}>
                {rules.length + 3}
              </Text>
              <Text style={[styles.ruleTitle, { color: colors.text }]}>
                Respectful Communication
              </Text>
            </View>
            <Text style={[styles.ruleDescription, { color: colors.textSecondary }]}>
              All members should maintain respectful and professional communication
            </Text>
          </View>
          <View style={[styles.horizontalSeparator, { backgroundColor: colors.border }]} />

          <View style={styles.ruleItem}>
            <View style={styles.ruleHeader}>
              <Text style={[styles.ruleNumber, { color: colors.secondary }]}>
                {rules.length + 4}
              </Text>
              <Text style={[styles.ruleTitle, { color: colors.text }]}>
                Financial Transparency
              </Text>
            </View>
            <Text style={[ { color: colors.textSecondary }]}>
              All financial transactions and decisions must be transparent and documented
            </Text>
          </View>
          <View style={[styles.horizontalSeparator, { backgroundColor: colors.border }]} />

          <View style={styles.ruleItem}>
            <View style={styles.ruleHeader}>
              <Text style={[styles.ruleNumber, { color: colors.secondary }]}>
                {rules.length + 5}
              </Text>
              <Text style={[styles.ruleTitle, { color: colors.text }]}>
                Confidentiality
              </Text>
            </View>
            <Text style={[styles.ruleDescription, { color: colors.textSecondary }]}>
              Members must maintain confidentiality of chama matters and member information
            </Text>
          </View>
        </View>

        {/* Chairperson controls for the attached rules document */}
        {userMembership?.role?.toLowerCase() === 'chairperson' && (
          <View style={[styles.rulesFileActions, { marginTop: spacing.lg }]}>
            <Button
              title={rulesFilePath ? 'Replace Rules PDF' : 'Upload Rules PDF'}
              variant="outline"
              onPress={handleUploadRulesFile}
              loading={uploadingRules}
              icon={<Ionicons name="document-attach-outline" size={18} color={colors.primary} />}
              style={styles.rulesFileActionButton}
            />
            {rulesFilePath && !uploadingRules && (
              <TouchableOpacity
                onPress={handleRemoveRulesFile}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.rulesFileRemoveButton}
              >
                <Text style={[styles.rulesFileRemoveText, { color: colors.error }]}>
                  Remove
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Card>
    );
  };
  const renderGroupChat = () => {
    const existingChatRoomId = getExistingChatRoomId();
    const canCreateChatRoom = ['chairperson', 'treasurer', 'secretary'].includes(userMembership?.role?.toLowerCase());
    const groupLabel = getGroupLabel();

    return (
      <Card style={styles.section} variant="outlined">
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Group Communication
        </Text>

        {!userMembership ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary, paddingVertical: spacing.md }]}>
            Join this {groupLabel.toLowerCase()} to access group chat.
          </Text>
        ) : (
          <>
            {existingChatRoomId ? (
              <Button
                title="Open Group Chat"
                onPress={() => navigateToChatRoom(existingChatRoomId)}
                disabled={chatRoomLoading}
                loading={chatRoomLoading}
                icon={
                  <Ionicons
                    name="chatbubbles"
                    size={20}
                    color={colors.white}
                  />
                }
                style={[
                  styles.chatButton,
                  { backgroundColor: colors.success, borderColor: colors.success }
                ]}
                textStyle={{ color: colors.white }}
              />
            ) : canCreateChatRoom ? (
              <Button
                title={`Create Chat Room`}
                onPress={handleCreateChatRoom}
                disabled={chatRoomLoading}
                loading={chatRoomLoading}
                icon={
                  <Ionicons
                    name="add-circle"
                    size={20}
                    color={colors.white}
                  />
                }
                style={[
                  styles.chatButton,
                  { backgroundColor: colors.success, borderColor: colors.success }
                ]}
                textStyle={{ color: colors.white }}
              />
            ) : null}
          </>
        )}
      </Card>
    );
  };

  const renderMembershipActions = () => {
    if (!userMembership) {
      return (
        <Card style={styles.section} variant="outlined">
          <Button
            title="Join This Chama"
            onPress={handleJoinChama}
            disabled={chama?.current_members >= chama?.max_members}
            icon={<Ionicons name="person-add" size={20} color={colors.white} />}
          />
        </Card>
      );
    }

    return (
      <Card style={styles.section} variant="outlined">
        <View style={styles.membershipInfo}>
          <Text style={[styles.membershipTitle, { color: colors.text }]}>
            Your Membership
          </Text>
          <Text style={[styles.membershipRole, { color: colors.primary }]}>
            {userMembership.role?.toUpperCase()}
          </Text>
          <Text style={[styles.membershipDate, { color: colors.textSecondary }]}>
            Joined {new Date(userMembership.joined_at).toLocaleDateString()}
          </Text>
        </View>
        
        <View style={styles.membershipActions}>
          <Button
            title="Switch to Chama Dashboard"
            onPress={() => {
              switchToChamaDashboard(chama);
            }}
            style={styles.membershipButton}
          />
          
          <Button
            title="Leave Chama"
            variant="outline"
            onPress={handleLeaveChama}
            style={[styles.membershipButton, { borderColor: colors.error }]}
            textStyle={{ color: colors.error }}
          />
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        key={chamaId} // Force re-render when chamaId changes
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Always single column - Header and Stats */}
        {renderChamaHeader()}
        {renderStats()}

        {/* Smart responsive layout for content cards */}
        <SmartResponsiveLayout>
          {renderMembers()}
          {renderMeetings()}
          {renderTransactions()}
          {renderActivePolls()}
        </SmartResponsiveLayout>

        {isLargeScreen ? (
          <View style={styles.desktopBottomRow}>
            <View style={styles.desktopRulesColumn}>
              {renderChamaRules()}
            </View>
            <View style={styles.desktopSideColumn}>
              {renderGroupChat()}
              {renderMembershipActions()}
            </View>
          </View>
        ) : (
          <>
            {renderChamaRules()}
            {renderGroupChat()}
            {renderMembershipActions()}
          </>
        )}
      </ScrollView>

    </SafeAreaView>
  );
};

export default ChamaDetailsScreen;
