import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import ChamaLayout from './ChamaLayout';
import ApiService from '../../services/api';
import { useApp } from '../../context/AppContext';

// Import all chama screens
import ChamaDashboard from '../../screens/chama/dashboard/ChamaDashboard';
import ChamaMembersScreen from '../../screens/chama/meeting/ChamaMembersScreen';
import ContributeScreen from '../../screens/chama/contribute/ContributeScreen';
import ChamaTransactionsScreen from '../../screens/chama/transactions/ChamaTransactionsScreen';
import ChamaLoansScreen from '../../screens/chama/loans/ChamaLoansScreen';
import ChamaMeetingsScreen from '../../screens/chama/meeting/ChamaMeetingsScreen';
import MerryGoRoundScreen from '../../screens/chama/merry-go-round/MerryGoRoundScreen';
import WelfareScreen from '../../screens/chama/welfare/WelfareScreen';
import ChamaSettings from '../../screens/chama/settings/ChamaSettings';
import ApplyForLoanScreen from '../../screens/chama/loans/ApplyForLoanScreen';
import ApplyForLoanScreen from '../../screens/chama/loans/ApplyForLoanScreen';
import CreateMeeting from '../../screens/chama/meeting/CreateMeeting';
import CreateMerryGoRound from '../../screens/chama/merry-go-round/CreateMerryGoRound';
import JitsiMeetScreen from '../../screens/chama/meeting/JitsiMeetScreen';
import PhysicalMeetingScreen from '../../screens/chama/chamamember/PhysicalMeetingScreen';
import MeetingSummaryScreen from '../../screens/chama/meeting/MeetingSummaryScreen';
import InviteMembers from '../../screens/chama/chamamember/InviteMembers';

const ChamaLayoutProvider = ({ route, navigation }) => {
  const { chamaId, chamaName, chama, initialRoute = 'overview' } = route.params || {};
  const { setSelectedChama } = useApp();
  const [activeRoute, setActiveRoute] = useState(initialRoute);
  const [currentComponent, setCurrentComponent] = useState('overview');
  const [additionalParams, setAdditionalParams] = useState({});

  // Set the selected chama when entering the chama dashboard
  useEffect(() => {
    if (chama) {
      console.log('🎯 ChamaLayoutProvider: Setting selected chama from route params:', chama);
      setSelectedChama(chama);
    } else if (chamaId && chamaName) {
      // Create a basic chama object if we only have id and name
      const basicChama = {
        id: chamaId,
        name: chamaName
      };
      console.log('🎯 ChamaLayoutProvider: Setting selected chama from basic info:', basicChama);
      setSelectedChama(basicChama);
    }
  }, [chama, chamaId, chamaName, setSelectedChama]);

  // Route mapping
  const routeComponents = {
    overview: ChamaDashboard,
    members: ChamaMembersScreen,
    contributions: ContributeScreen,
    transactions: ChamaTransactionsScreen,
    loans: ChamaLoansScreen,
    meetings: ChamaMeetingsScreen,
    'merry-go-round': MerryGoRoundScreen,
    welfare: WelfareScreen,
    
    // Forms and additional screens
    'loan-application': ApplyForLoanScreen,
    'create-meeting': CreateMeeting,
    'create-merry-go-round': CreateMerryGoRound,
    'online-meeting': JitsiMeetScreen,
    'physical-meeting': PhysicalMeetingScreen,
    'meeting-summary': MeetingSummaryScreen,
    'invite-members': InviteMembers,
    chat: () => {
      // Get or create chama chat room
      const getChamaChatRoom = async () => {
        try {
          const roomId = chamaId || chama?.id;
          const roomTitle = chamaName || chama?.name || 'Group Chat';

          if (!roomId) {
            Alert.alert('Error', 'Unable to access chat room. Please try again.');
            return;
          }

          console.log('Getting chama chat room for:', { roomId, roomTitle });

          // Try to create or get existing chama chat room
          const response = await ApiService.createChatRoom({
            type: 'chama',
            chamaId: roomId,
            name: `${roomTitle} Chat`,
          });

          if (response.success) {
            // Navigate to the actual chat room
            navigation.navigate('ChatRoom', {
              roomId: response.data.id, // Use the actual chat room ID
              roomName: `${roomTitle} Group Chat`,
              roomType: 'group'
            });
          } else {
            Alert.alert('Error', 'Failed to access chat room. Please try again.');
          }
        } catch (error) {
          console.error('Failed to get chama chat room:', error);
          Alert.alert('Error', 'Failed to access chat room. Please try again.');
        }
      };

      getChamaChatRoom();
      return null;
    },
    settings: ChamaSettings,
  };

  const handleRouteChange = (routeId, routeName, additionalParams = {}) => {
    setActiveRoute(routeId);
    setCurrentComponent(routeId);

    // Store additional parameters for the component
    if (Object.keys(additionalParams).length > 0) {
      setAdditionalParams(additionalParams);
    } else {
      setAdditionalParams({});
    }
  };

  const renderCurrentComponent = () => {
    const Component = routeComponents[currentComponent];

    if (!Component) {
      return routeComponents.overview;
    }

    // Handle special routes that navigate away
    if (currentComponent === 'chat') {
      return Component();
    }

    // Render the component with proper props
    return (
      <Component
        route={{
          params: {
            chamaId: chamaId || chama?.id,
            chamaName: chamaName || chama?.name,
            chama: chama,
            ...additionalParams
          }
        }}
        navigation={navigation}
        onRouteChange={handleRouteChange}
      />
    );
  };

  return (
    <ChamaLayout
      navigation={navigation}
      chamaId={chamaId || chama?.id}
      chamaName={chamaName || chama?.name}
      activeRoute={activeRoute}
      onRouteChange={handleRouteChange}
    >
      {renderCurrentComponent()}
    </ChamaLayout>
  );
};

export default ChamaLayoutProvider;
