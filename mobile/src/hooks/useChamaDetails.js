import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Dimensions } from 'react-native';
import { useApp } from '../context/AppContext';
import ApiService from '../services/api';
import Toast from 'react-native-toast-message';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

const useChamaDetails = ({ route, navigation }) => {
  const { chamaId } = route.params;
  const { theme, user, setSelectedChama, switchToChamaDashboard } = useApp();

  const [screenData, setScreenData] = useState(Dimensions.get('window'));

  useEffect(() => {
    const onChange = (result) => {
      setScreenData(result.window);
    };
    const subscription = Dimensions.addEventListener('change', onChange);
    return () => subscription?.remove();
  }, []);

  const { width: screenWidth } = screenData;
  const getResponsiveConfig = useCallback(() => {
    if (screenWidth < 600) {
      return { isLargeScreen: false, screenType: 'mobile' };
    } else if (screenWidth < 900) {
      return { isLargeScreen: true, screenType: 'tablet' };
    } else {
      return { isLargeScreen: true, screenType: 'desktop' };
    }
  }, [screenWidth]);

  const { isLargeScreen, screenType } = getResponsiveConfig();

  const getResponsiveTextSize = useCallback((baseSize) => {
    const sizeMultiplier = screenType === 'desktop' ? 1.2 : screenType === 'tablet' ? 1.1 : 1;
    return baseSize * sizeMultiplier;
  }, [screenType]);

  const [chama, setChama] = useState(null);
  const [members, setMembers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loans, setLoans] = useState([]);
  const [polls, setPolls] = useState([]);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userMembership, setUserMembership] = useState(null);
  const [chatRoomLoading, setChatRoomLoading] = useState(false);
  const [uploadingRules, setUploadingRules] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [userLeft, setUserLeft] = useState(false);

  const loadingRef = useRef(false);
  const lastLoadedAtRef = useRef(0);
  const creatingChatRoomRef = useRef(false);

  useEffect(() => {
    if (chamaId) {
      setChama(null);
      setMembers([]);
      setMeetings([]);
      setTransactions([]);
      setLoans([]);
      setPolls([]);
      setPollsLoading(false);
      setStatistics(null);
      setUserMembership(null);
      loadChamaDetails();
    }
  }, [chamaId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (Date.now() - lastLoadedAtRef.current < 2000) {
        return;
      }
      if (chamaId) {
        loadChamaDetails();
      }
    });
    return unsubscribe;
  }, [navigation, chamaId]);

  const loadChamaDetails = async (targetChamaId = chamaId) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      if (!targetChamaId) {
        return;
      }

      let memberIsLeft = false;
      let chamaResponse;
      let membersResponse;
      try {
        chamaResponse = await ApiService.getChamaById(targetChamaId);
      } catch (chamaError) {
        chamaResponse = { success: false, data: null };
      }

      try {
        membersResponse = await ApiService.getChamaMembers(targetChamaId, { include_inactive: 'true' });
      } catch (membersError) {
        membersResponse = { success: false, data: [] };
      }

      if (chamaResponse.success && chamaResponse.data) {
        setChama(chamaResponse.data);
        setSelectedChama(chamaResponse.data);
      }

      let membership = null;
      let currentUserIsLeft = false;

      if (membersResponse.success) {
        const membersData = Array.isArray(membersResponse.data) ? membersResponse.data : [];
        const uniqueMembers = Array.from(
          new Map(membersData.map((m) => [m.id, m])).values()
        );

        const activeMembers = uniqueMembers.filter(member => {
          const isActive = member?.is_active;
          return isActive !== false && isActive !== 0 && isActive !== '0' && isActive !== 'false';
        });
        setMembers(activeMembers);

        const currentUserId = String(user?.id);

        membership = uniqueMembers.find(member => {
          const memberUserId = String(
            member.user_id ||
            member.userId ||
            member.user?.id ||
            member.user?.userId ||
            ''
          );
          return memberUserId === currentUserId;
        });

        if (membership) {
          const memberIsActive = membership?.is_active;
          if (memberIsActive === false || memberIsActive === 0 || memberIsActive === '0' || memberIsActive === 'false') {
            currentUserIsLeft = true;
          }
        }
      } else {
        setMembers([]);
      }

      if (!membership && chamaResponse.data) {
        const currentUserId = String(user?.id);
        try {
          const myChamasResponse = await ApiService.getUserChamas(50, 0);
          if (myChamasResponse.success && Array.isArray(myChamasResponse.data)) {
            const myChama = myChamasResponse.data.find(c => String(c.id) === String(chamaResponse.data.id));
            if (myChama) {
              membership = {
                id: myChama.memberId || myChama.id,
                user_id: currentUserId,
                role: myChama.memberRole || myChama.role || 'member',
                joined_at: myChama.createdAt || new Date().toISOString(),
              };
            }
          }
        } catch (myChamasError) {
          // Silent fail for fallback
        }
      }

      if (!membership && chamaResponse.data) {
        const currentUserId = String(user?.id);
        const creatorId = String(chamaResponse.data.createdBy);
        if (creatorId === currentUserId) {
          membership = {
            id: 'creator',
            user_id: currentUserId,
            role: 'chairperson',
            joined_at: chamaResponse.data.createdAt || new Date().toISOString(),
          };
        }
      }

       setUserMembership(membership);
       setUserLeft(currentUserIsLeft);
       if (currentUserIsLeft) {
         Alert.alert(
           'Membership Expired',
           'You have left this chama. You can no longer access its details.',
           [{ text: 'OK', onPress: () => navigation.goBack() }]
         );
       }
       setPollsLoading(true);
       Promise.all([
        ApiService.getTransactions(1000, 0).then(response => {
          if (response.success && Array.isArray(response.data)) {
            const allTransactions = response.data || [];
            const userId = String(user?.id);
            const chamaId = String(targetChamaId || '');
            const userTransactions = allTransactions.filter(transaction => {
              const txChamaId = String(transaction.chamaId || '');
              const initiatedBy = String(transaction.initiatedBy || '');
              const memberId = String(transaction.memberId || '');
              const recipientId = String(transaction.recipientId || '');
              const fromWalletId = String(transaction.fromWalletId || '');
              const toWalletId = String(transaction.toWalletId || '');
              const transactionUserId = String(transaction.user?.id || transaction.member?.user_id || '');
              const belongsToChama = txChamaId === chamaId;
              const belongsToUser = initiatedBy === userId ||
                     memberId === userId ||
                     recipientId === userId ||
                     fromWalletId === userId ||
                     toWalletId === userId ||
                     transactionUserId === userId;
              return belongsToChama && belongsToUser;
            });
            setTransactions(userTransactions);
          }
        }).catch(error => {
          setTransactions([]);
        }),

        ApiService.getChamaVotes(targetChamaId, 10, 0).then(response => {
          if (response.success && Array.isArray(response.data)) {
            const allPolls = response.data || [];
            const normalized = allPolls.map(poll => ({
              ...poll,
              userVoted: poll.user_voted === 1 || poll.user_voted === true,
              user_has_voted: poll.user_voted === 1 || poll.user_voted === true,
            }));
            const sorted = normalized.sort((a, b) => {
              const aActive = a.status === 'active' && (!a.ends_at || new Date(a.ends_at) > new Date());
              const bActive = b.status === 'active' && (!b.ends_at || new Date(b.ends_at) > new Date());
              if (aActive && !bActive) return -1;
              if (!aActive && bActive) return 1;
              return new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0);
            });
            setPolls(sorted);
          } else {
            setPolls([]);
          }
        }).catch(() => {
          setPolls([]);
        }).finally(() => {
          setPollsLoading(false);
        }),

        ApiService.getMeetings(targetChamaId).then(response => {
          if (response.success) {
            const meetingsData = response.data || [];
            setMeetings(meetingsData);
          }
        }).catch(error => {
          setMeetings([]);
        }),

        ApiService.getChamaStatistics(targetChamaId).then(response => {
          if (response.success) {
            setStatistics(response.data);
          }
        }).catch(error => {
          setStatistics(null);
        })
      ]);

      setLoans([]);

    } catch (error) {
      // Silent catch for load errors
    } finally {
      loadingRef.current = false;
      lastLoadedAtRef.current = Date.now();
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadChamaDetails(chamaId);
    } catch (error) {
      console.warn('Chama details refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
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

  const handleLeaveChama = () => setShowLeaveModal(true);

  const confirmLeaveChama = async () => {
    try {
      const response = await ApiService.leaveChama(chamaId);
      if (response.success) {
        setShowLeaveModal(false);
        Alert.alert('Success', 'You have left the chama');
        navigation.goBack();
      } else {
        setShowLeaveModal(false);
        Alert.alert('Unable to Leave', response.error || 'Failed to leave chama');
      }
    } catch (error) {
      setShowLeaveModal(false);
      Alert.alert('Error', error?.message || 'Failed to leave chama');
    }
  };

  const getExistingChatRoomId = () => {
    return chama?.chat_room_id || chama?.chat_room?.id || chama?.chatRoom?.id;
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
    if (creatingChatRoomRef.current) {
      return;
    }

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
    if (creatingChatRoomRef.current) {
      return;
    }

    try {
      creatingChatRoomRef.current = true;
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

      await loadChamaDetails();

      Alert.alert(
        'Chat Room Created',
        'Chat room has been created for this group.'
      );

      navigateToChatRoom(roomId);
    } catch (error) {
      console.error('[ChamaDetails] Error creating chat room:', error);
      Alert.alert('Error', error.message || 'Failed to create chat room');
    } finally {
      creatingChatRoomRef.current = false;
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
      const docName = document.name || '';
      const isPdf = document.mimeType === 'application/pdf' || docName.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        Toast.show({ type: 'error', text1: 'Invalid file type', text2: 'Only PDF files are accepted for rules' });
        return;
      }
      setUploadingRules(true);
      const formData = new FormData();

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

  return {
    chamaId,
    theme,
    user,
    isLargeScreen,
    screenType,
    getResponsiveTextSize,
    chama,
    members,
    meetings,
    transactions,
    loans,
    polls,
    pollsLoading,
    statistics,
    refreshing,
    userMembership,
    chatRoomLoading,
    uploadingRules,
    showLeaveModal,
    setShowLeaveModal,
    userLeft,
    loadChamaDetails,
    onRefresh,
    formatCurrency,
    handleJoinChama,
    handleLeaveChama,
    confirmLeaveChama,
    getExistingChatRoomId,
    getGroupLabel,
    navigateToChatRoom,
    handleCreateChatRoom,
    confirmCreateChatRoom,
    handleUploadRulesFile,
    handleRemoveRulesFile,
  };
};

export default useChamaDetails;
