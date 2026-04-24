import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  SafeAreaView,
  StatusBar,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { useApp } from '../../context/AppContext';
import VideoCallView from '../../components/VideoCallView';
import api from '../../services/api';
import Toast from 'react-native-toast-message';

const OnlineMeetingScreen = ({ route, navigation }) => {
  const {
    meetingId,
    meetingTitle,
    userRole = 'member',
    isPreview = false,
    previewData = null
  } = route.params;
  const { theme, user } = useApp();

  // Simple color scheme
  const colors = {
    backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
    text: theme === 'dark' ? '#ffffff' : '#000000',
    textSecondary: theme === 'dark' ? '#cccccc' : '#666666',
    primary: '#007AFF',
    error: '#FF3B30'
  };
  
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true); // Enable camera by default
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);
  const [meetingData, setMeetingData] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  
  const hasJoinedRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    initializeMeeting();
    
    // Handle back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    
    return () => {
      backHandler.remove();
      cleanup();
    };
  }, []);

  // LiveKit event listeners removed - no longer needed

  const initializeMeeting = async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);

      let connectionData;

      if (isPreview && previewData) {
        // Use preview data for chairperson/secretary preview
        // Map preview data fields to expected format
        connectionData = {
          token: previewData.accessToken, // Preview uses 'accessToken'
          roomName: previewData.roomName,
          wsUrl: previewData.wsURL, // Preview uses 'wsURL' (uppercase)
          userRole: previewData.userRole,
          isPreview: true,
        };
      } else {
        // Get meeting connection data from backend
        const response = await api.makeRequest(`/meetings/${meetingId}/join`, {
          method: 'POST',
          body: { userRole },
        });

        if (!response.success) {
          throw new Error(response.error || 'Failed to get meeting connection data');
        }

        connectionData = response.data;
      }

      console.log('🎬 Connection data:', {
        hasToken: !!connectionData.token,
        roomName: connectionData.roomName,
        userRole: connectionData.userRole || userRole,
        isPreview: connectionData.isPreview || false,
      });

      // Meeting connection logic removed - LiveKit no longer used

      // Mark attendance (skip for preview mode)
      if (!isPreview) {
        await markAttendance();
      }

      // Update participants list
      updateParticipantsList();

      setIsConnected(true);
      setIsConnecting(false);
      hasJoinedRef.current = true;

      Toast.show({
        type: 'success',
        text1: isPreview ? 'Preview mode active' : 'Connected to meeting',
        text2: isPreview ? 'You are previewing the meeting room' : 'You have successfully joined the meeting',
      });

      // Initialize camera and microphone states (simplified without LiveKit)
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
    // Simplified without LiveKit - just use empty participants list
    setParticipants([]);
  };

  // Event handlers removed - LiveKit no longer used

  // Control handlers (simplified without LiveKit)
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
    return true; // Prevent default back action
  };

  const leaveMeeting = async () => {
    try {
      hasJoinedRef.current = false;
      navigation.goBack();
    } catch (error) {
      console.error('Failed to leave meeting:', error);
      navigation.goBack(); // Go back anyway
    }
  };

  const cleanup = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
  };

  // Render loading state
  if (isConnecting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            {isPreview ? 'Loading preview...' : 'Connecting to meeting...'}
          </Text>
          <Text style={[styles.loadingSubtext, { color: colors.textSecondary }]}>
            {meetingTitle}
          </Text>
          {isPreview && (
            <Text style={[styles.previewBadge, { color: colors.primary }]}>
              PREVIEW MODE
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (connectionError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            Failed to connect to meeting
          </Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
            {connectionError}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      <VideoCallView
        participants={participants}
        onToggleCamera={handleToggleCamera}
        onToggleMicrophone={handleToggleMicrophone}
        onSwitchCamera={handleSwitchCamera}
        onEndCall={handleEndCall}
        isCameraEnabled={isCameraEnabled}
        isMicrophoneEnabled={isMicrophoneEnabled}
        userRole={userRole}
        isPreview={isPreview}
        meetingTitle={meetingTitle}
      />

      {/* Debug overlay for development */}
      {__DEV__ && (
        <View style={styles.debugOverlay}>
          <Text style={styles.debugText}>
            Camera: {isCameraEnabled ? '✅' : '❌'} | Mic: {isMicrophoneEnabled ? '✅' : '❌'}
          </Text>
          <Text style={styles.debugText}>
            Participants: {participants.length} | Connected: {isConnected ? '✅' : '❌'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  previewBadge: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
    letterSpacing: 1,
  },
  debugOverlay: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 4,
    zIndex: 1000,
  },
  debugText: {
    color: 'white',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});

export default OnlineMeetingScreen;
