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
  Dimensions,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useApp } from '../../../context/AppContext';
import api from '../../../services/api';
import Toast from 'react-native-toast-message';

const { width, height } = Dimensions.get('window');

const JaaSMeetScreen = ({ route, navigation }) => {
  const {
    meetingId,
    meetingTitle,
    userRole = 'member',
    isPreview = false,
    previewData = null,
    meetingData = null
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
  const [connectionError, setConnectionError] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [jitsiApi, setJitsiApi] = useState(null);

  const hasJoinedRef = useRef(false);
  const containerRef = useRef(null);

  // Debug logging
  console.log('🎬 JaaS Meet Screen initialized with:', {
    meetingId,
    userRole,
    isPreview,
    meetingTitle,
    platform: Platform.OS,
  });

  useEffect(() => {
    initializeMeeting();

    // Handle back button
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

      let meetingConfig;

      if (isPreview && previewData) {
        // Use preview data for chairperson/secretary preview
        meetingConfig = {
          roomName: previewData.roomName,
          userDisplayName: user?.name || user?.username || 'Unknown User',
          userRole: previewData.userRole || userRole,
          userEmail: user?.email || '',
          chamaId: meetingData?.chamaId,
          meetingId: meetingId,
          isPreview: true,
        };
      } else {
        // Get meeting data from backend for regular join
        const response = await api.joinJitsiMeeting(meetingId, userRole);

        if (!response.success) {
          throw new Error(response.error || 'Failed to get meeting connection data');
        }

        meetingConfig = {
          roomName: response.data.roomName,
          userDisplayName: user?.name || user?.username || 'Unknown User',
          userRole: userRole,
          userEmail: user?.email || '',
          chamaId: response.data.chamaId,
          meetingId: meetingId,
          isModerator: response.data.isModerator,
          roomPassword: response.data.roomPassword,
        };
      }

      console.log('🎬 JaaS: Meeting config:', {
        hasRoomName: !!meetingConfig.roomName,
        userDisplayName: meetingConfig.userDisplayName,
        userRole: meetingConfig.userRole,
        isModerator: meetingConfig.isModerator,
        isPreview: meetingConfig.isPreview || false,
      });

      // Build JaaS configuration
      const jaasConfig = buildJaaSConfig(meetingConfig);

      // Store room data
      setRoomData(meetingConfig);

      // Mark attendance (skip for preview mode)
      if (!isPreview) {
        await markAttendance();
      }

      // Initialize JaaS on web platform
      if (Platform.OS === 'web') {
        await initializeJaaS(jaasConfig);
      } else {
        // For native platforms, show message to use web version
        setConnectionError('JaaS requires web platform. Please use the web version for the best experience.');
      }

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

  const buildJaaSConfig = (config) => {
    // Build JaaS configuration for External API
    const jaasConfig = {
      roomName: `vpaas-magic-cookie-cb055ffbd0604dedb00b5a2540349c3c/${config.roomName}`,
      parentNode: null, // Will be set when initializing
      
      // JWT token for authentication and features
      jwt: 'eyJraWQiOiJ2cGFhcy1tYWdpYy1jb29raWUtY2IwNTVmZmJkMDYwNGRlZGIwMGI1YTI1NDAzNDljM2MvZmYxNWQ1LVNBTVBMRV9BUFAiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJqaXRzaSIsImlzcyI6ImNoYXQiLCJpYXQiOjE3NTIwMTAzNzksImV4cCI6MTc1MjAxNzU3OSwibmJmIjoxNzUyMDEwMzc0LCJzdWIiOiJ2cGFhcy1tYWdpYy1jb29raWUtY2IwNTVmZmJkMDYwNGRlZGIwMGI1YTI1NDAzNDljM2MiLCJjb250ZXh0Ijp7ImZlYXR1cmVzIjp7ImxpdmVzdHJlYW1pbmciOmZhbHNlLCJmaWxlLXVwbG9hZCI6ZmFsc2UsIm91dGJvdW5kLWNhbGwiOmZhbHNlLCJzaXAtb3V0Ym91bmQtY2FsbCI6ZmFsc2UsInRyYW5zY3JpcHRpb24iOmZhbHNlLCJyZWNvcmRpbmciOmZhbHNlLCJmbGlwIjpmYWxzZX0sInVzZXIiOnsiaGlkZGVuLWZyb20tcmVjb3JkZXIiOmZhbHNlLCJtb2RlcmF0b3IiOnRydWUsIm5hbWUiOiJUZXN0IFVzZXIiLCJpZCI6Imdvb2dsZS1vYXV0aDJ8MTAzNDg4MTc2MDgxMjc0OTY0NDYyIiwiYXZhdGFyIjoiIiwiZW1haWwiOiJ0ZXN0LnVzZXJAY29tcGFueS5jb20ifX0sInJvb20iOiIqIn0.MywuAboUYhDc3l-v-3n9o7bwlh4ssiCOsyBVfLkVBrO9OA84KANmHXTJEMYdzDgj9m2k_IDLNEPt_h5sAH5g12vO7OMHEc9rV8wDSDJMfOk3LSs54DQqyTHGui10p5RniGTdrG2Cx2Ldl8tjkq7gbH3sRIYZ68rSIxUR8EQAjJfb8YjN6BiTusT2NGLwTE_l_3iGBaRLU_IDURDLLkUHoP9Ltm15AY2ABGW6t0VYkalYJVh9mPNVo65IKQ821tTqta-nyyQ4Nc-4C4AefKTCNqDphZjdDMSQpN2mH35d_C_QXSdkxEoZcECaH3zYMdXnreijw5xA_HqJF0qYZOs7Pg',
      
      // User configuration
      userInfo: {
        displayName: config.userDisplayName,
        email: config.userEmail || '',
      },
      
      // Meeting configuration
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        requireDisplayName: true,
        enableWelcomePage: false,
        enableClosePage: false,
        prejoinPageEnabled: false,
        
        // Security and UI
        disableProfile: true,
        readOnlyName: true,
        enableNoAudioDetection: true,
        enableNoisyMicDetection: true,
        disableDeepLinking: true,
        
        // Toolbar configuration
        toolbarButtons: [
          'microphone', 'camera', 'hangup', 'chat', 'raisehand', 'tileview', 'settings'
        ],
        
        // Moderator settings
        enableLobby: !config.isModerator,
        enableLobbyChat: !config.isModerator,
      },
      
      // Interface configuration
      interfaceConfigOverwrite: {
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
        DISABLE_PRESENCE_STATUS: true,
        HIDE_INVITE_MORE_HEADER: true,
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'hangup', 'chat', 'raisehand', 'tileview', 'settings'
        ],
      }
    };

    console.log('🎬 JaaS: Built config for room:', config.roomName);
    return jaasConfig;
  };

  const initializeJaaS = async (jaasConfig) => {
    try {
      // Load JaaS External API script
      await loadJaaSScript();
      
      // Set parent node
      jaasConfig.parentNode = containerRef.current;
      
      // Initialize JaaS API
      const api = new window.JitsiMeetExternalAPI("8x8.vc", jaasConfig);
      
      // Set up event listeners
      api.addEventListener('videoConferenceJoined', () => {
        console.log('🎬 JaaS: Conference joined');
        setIsConnected(true);
        setIsConnecting(false);
        hasJoinedRef.current = true;
        
        Toast.show({
          type: 'success',
          text1: isPreview ? 'Preview mode active' : 'Joined meeting',
          text2: meetingTitle,
        });
      });
      
      api.addEventListener('videoConferenceLeft', () => {
        console.log('🎬 JaaS: Conference left');
        cleanup();
        navigation.goBack();
      });
      
      api.addEventListener('readyToClose', () => {
        console.log('🎬 JaaS: Ready to close');
        cleanup();
        navigation.goBack();
      });
      
      setJitsiApi(api);
      
    } catch (error) {
      console.error('🎬 JaaS: Failed to initialize:', error);
      setConnectionError('Failed to load JaaS. Please refresh and try again.');
      setIsConnecting(false);
    }
  };

  const loadJaaSScript = () => {
    return new Promise((resolve, reject) => {
      if (window.JitsiMeetExternalAPI) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://8x8.vc/vpaas-magic-cookie-cb055ffbd0604dedb00b5a2540349c3c/external_api.js';
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
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
      console.log('🎬 JaaS: Attendance marked');
    } catch (error) {
      console.error('Failed to mark attendance:', error);
    }
  };

  const handleBackPress = () => {
    handleEndCall();
    return true; // Prevent default back action
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

  const leaveMeeting = async () => {
    try {
      if (jitsiApi) {
        jitsiApi.dispose();
      }
      cleanup();
      navigation.goBack();
    } catch (error) {
      console.error('Failed to leave meeting:', error);
      navigation.goBack(); // Go back anyway
    }
  };

  const cleanup = () => {
    hasJoinedRef.current = false;
    setIsConnected(false);
    if (jitsiApi) {
      try {
        jitsiApi.dispose();
      } catch (error) {
        console.error('Error disposing JaaS API:', error);
      }
      setJitsiApi(null);
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
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              setConnectionError(null);
              initializeMeeting();
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Render JaaS meeting interface
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000000' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {Platform.OS === 'web' ? (
        // Web platform: JaaS container
        <div 
          ref={containerRef}
          id="jaas-container" 
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#000000',
          }}
        />
      ) : (
        // Native platforms: Show message
        <View style={styles.nativeMessage}>
          <Text style={[styles.nativeMessageText, { color: colors.text }]}>
            JaaS meetings work best on web platform
          </Text>
          <Text style={[styles.nativeMessageSubtext, { color: colors.textSecondary }]}>
            Please use the web version for the full meeting experience
          </Text>
        </View>
      )}

      {/* Security notice for non-moderators */}
      {userRole !== 'chairperson' && userRole !== 'secretary' && userRole !== 'treasurer' && (
        <View style={styles.securityNotice}>
          <Text style={styles.securityText}>🔒 SECURE MEETING</Text>
          <Text style={styles.securitySubtext}>
            You'll be placed in a waiting room. A moderator will approve your entry.
          </Text>
        </View>
      )}

      {/* Debug overlay for development */}
      {__DEV__ && (
        <View style={styles.debugOverlay}>
          <Text style={styles.debugText}>
            JaaS Meet | Platform: {Platform.OS}
          </Text>
          <Text style={styles.debugText}>
            Connected: {isConnected ? '✅' : '❌'} | API: {jitsiApi ? '✅' : '❌'}
          </Text>
          <Text style={styles.debugText}>
            Room: {roomData?.roomName?.substring(0, 20)}...
          </Text>
          <Text style={styles.debugText}>
            Role: {userRole} | Preview: {isPreview ? '✅' : '❌'}
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
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  previewBadge: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  nativeMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  nativeMessageText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  nativeMessageSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  securityNotice: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  securityText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  securitySubtext: {
    color: '#cccccc',
    fontSize: 11,
  },
  debugOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 4,
  },
  debugText: {
    color: 'white',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});

export default JaaSMeetScreen;
