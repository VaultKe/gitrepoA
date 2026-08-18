import { useState, useEffect, useRef } from 'react';
import { Alert, BackHandler, Toast } from 'react-native';
import { useApp } from '../context/AppContext';
import api from '../services/api';

const useOnlineMeetingScreen = ({ route, navigation }) => {
  const {
    meetingId,
    meetingTitle,
    userRole = 'member',
    isPreview = false,
    previewData = null,
    isReadOnly = false,
  } = route.params;
  const { theme } = useApp();

  const colors = {
    backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
    text: theme === 'dark' ? '#ffffff' : '#000000',
    textSecondary: theme === 'dark' ? '#cccccc' : '#666666',
    primary: '#007AFF',
    error: '#FF3B30',
  };

  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);
  const [meetingData, setMeetingData] = useState(null);
  const [connectionError, setConnectionError] = useState(null);

  const hasJoinedRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    initializeMeeting();

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

    return () => {
      backHandler.remove();
      cleanup();
    };
  }, []);

  const initializeMeeting = async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);

      let connectionData;

      if (isPreview && previewData) {
        connectionData = {
          token: previewData.accessToken,
          roomName: previewData.roomName,
          wsUrl: previewData.wsURL,
          userRole: previewData.userRole,
          isPreview: true,
        };
      } else {
        const response = await api.makeRequest(`/meetings/${meetingId}/join`, {
          method: 'POST',
          body: { userRole },
        });

        if (!response.success) {
          throw new Error(response.error || 'Failed to get meeting connection data');
        }

        connectionData = response.data;
      }

      if (!isPreview) {
        await markAttendance();
      }

      updateParticipantsList();

      setIsConnected(true);
      setIsConnecting(false);
      hasJoinedRef.current = true;

      Toast.show({
        type: 'success',
        text1: isPreview ? 'Preview mode active' : 'Connected to meeting',
        text2: isPreview ? 'You are previewing the meeting room' : 'You have successfully joined the meeting',
      });

      setIsCameraEnabled(true);
      setIsMicrophoneEnabled(true);
    } catch (error) {
      console.error('Failed to initialize meeting:', error);
      setConnectionError(error.message);
      setIsConnecting(false);

      Toast.show({
        type: 'error',
        text1: 'Connection failed',
        text2: error.message,
      });
    }
  };

  const markAttendance = async () => {
    try {
      await api.makeRequest(`/meetings/${meetingId}/attendance`, {
        method: 'POST',
        body: {
          attendanceType: 'virtual',
          isPresent: true,
        },
      });
    } catch (error) {
      console.error('Failed to mark attendance:', error);
    }
  };

  const updateParticipantsList = () => {
    setParticipants([]);
  };

  const handleToggleCamera = async () => {
    const newState = !isCameraEnabled;
    setIsCameraEnabled(newState);

    Toast.show({
      type: 'success',
      text1: newState ? 'Camera enabled' : 'Camera disabled',
      text2: newState ? 'Your camera is now on' : 'Your camera is now off',
    });
  };

  const handleToggleMicrophone = async () => {
    const newState = !isMicrophoneEnabled;
    setIsMicrophoneEnabled(newState);

    Toast.show({
      type: 'success',
      text1: newState ? 'Microphone enabled' : 'Microphone disabled',
      text2: newState ? 'Your microphone is now on' : 'Your microphone is now off',
    });
  };

  const handleSwitchCamera = async () => {
    Toast.show({
      type: 'success',
      text1: 'Camera switched',
      text2: 'Camera view has been switched',
    });
  };

  const handleEndCall = () => {
    Alert.alert(
      'End Meeting',
      'Are you sure you want to leave the meeting?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: leaveMeeting },
      ]
    );
  };

  const handleBackPress = () => {
    handleEndCall();
    return true;
  };

  const leaveMeeting = async () => {
    try {
      hasJoinedRef.current = false;
      navigation.goBack();
    } catch (error) {
      console.error('Failed to leave meeting:', error);
      navigation.goBack();
    }
  };

  const cleanup = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
  };

  return {
    isConnecting,
    isConnected,
    participants,
    isCameraEnabled,
    isMicrophoneEnabled,
    meetingData,
    connectionError,
    meetingId,
    meetingTitle,
    userRole,
    isPreview,
    previewData,
    isReadOnly,
    handleToggleCamera,
    handleToggleMicrophone,
    handleSwitchCamera,
    handleEndCall,
    leaveMeeting,
    initializeMeeting,
    colors,
    theme,
  };
};

export default useOnlineMeetingScreen;
