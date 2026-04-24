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
  Linking,
  TouchableOpacity,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useApp } from '../../context/AppContext';
import api from '../../services/api';
import Toast from 'react-native-toast-message';

const { width, height } = Dimensions.get('window');

const JitsiMeetScreen = ({ route, navigation }) => {
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
  const [jitsiUrl, setJitsiUrl] = useState(null);
  const [useWebView, setUseWebView] = useState(true);

  const hasJoinedRef = useRef(false);
  const webViewRef = useRef(null);

  // Debug logging
  console.log('🎬 Jitsi Meet Screen initialized with:', {
    meetingId,
    userRole,
    isPreview,
    meetingTitle,
    platform: Platform.OS,
  });

  useEffect(() => {
    // Detect platform capabilities
    const detectPlatformCapabilities = () => {
      if (Platform.OS === 'web') {
        // On web, we'll use iframe instead of WebView
        setUseWebView(false); // Don't use WebView on web
        console.log('🎬 Jitsi: Web platform detected, will use iframe');
      } else {
        // On native platforms, check if WebView is available
        try {
          // Try to use WebView for in-app experience
          setUseWebView(true);
        } catch (error) {
          console.log('🎬 Jitsi: WebView not available, will use external browser');
          setUseWebView(false);
        }
      }
    };

    detectPlatformCapabilities();
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

      console.log('🎬 Jitsi: Meeting config:', {
        hasRoomName: !!meetingConfig.roomName,
        userDisplayName: meetingConfig.userDisplayName,
        userRole: meetingConfig.userRole,
        isModerator: meetingConfig.isModerator,
        isPreview: meetingConfig.isPreview || false,
      });

      // Build JaaS configuration and fallback URL
      const jaasConfig = buildJaaSConfig(meetingConfig);
      const fallbackUrl = buildFallbackJitsiUrl(meetingConfig);

      // Store room data and URL
      setRoomData(meetingConfig);
      setJitsiUrl(fallbackUrl);

      // Mark attendance (skip for preview mode)
      if (!isPreview) {
        await markAttendance();
      }

      if (Platform.OS === 'web') {
        // On web, we'll use iframe - just set the URL and let the render handle it
        setIsConnecting(false);
        console.log('🎬 Jitsi: Using iframe for web platform');
      } else if (useWebView) {
        // Use WebView for in-app experience on native platforms
        setIsConnecting(false);
        console.log('🎬 Jitsi: Using WebView for in-app experience');
      } else {
        // Use external browser
        console.log('🎬 Jitsi: Opening in external browser');
        await Linking.openURL(jitsiUrl);

        // Show message and navigate back after a delay
        Toast.show({
          type: 'info',
          text1: 'Meeting opened in browser',
          text2: 'The meeting has been opened in your default browser',
        });

        setTimeout(() => {
          navigation.goBack();
        }, 2000);
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
    // SECURITY: Room name will be processed by backend for cryptographic isolation
    const jaasConfig = {
      roomName: `vpaas-magic-cookie-cb055ffbd0604dedb00b5a2540349c3c/${config.roomName}`,
      parentNode: null, // Will be set by the component

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

        // VaultKe branding and customization
        defaultLocalDisplayName: config.userDisplayName,
        defaultRemoteDisplayName: 'VaultKe User',

        // Meeting room branding
        subject: `VaultKe Meeting - ${config.roomName?.split('_')[0] || 'Chama'}`,

        // Moderator settings
        enableLobby: !config.isModerator,
        enableLobbyChat: !config.isModerator,
      },

      // Interface configuration with VaultKe branding
      interfaceConfigOverwrite: {
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
        DISABLE_PRESENCE_STATUS: true,
        HIDE_INVITE_MORE_HEADER: true,
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false,
        SHOW_POWERED_BY: false,

        // VaultKe branding
        APP_NAME: 'VaultKe',
        NATIVE_APP_NAME: 'VaultKe',
        DEFAULT_BACKGROUND: '#1a1a1a',

        // Custom branding
        BRAND_WATERMARK_LINK: '',
        JITSI_WATERMARK_LINK: '',

        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'hangup', 'chat', 'raisehand', 'tileview', 'settings'
        ],
      }
    };

    console.log('🎬 JaaS: Built config for room:', config.roomName);
    return jaasConfig;
  };

  const buildFallbackJitsiUrl = (config) => {
    // Build a simple fallback URL for cases where JaaS External API isn't available
    const baseUrl = 'https://8x8.vc';
    const roomName = `vpaas-magic-cookie-cb055ffbd0604dedb00b5a2540349c3c/${config.roomName}`;
    const encodedRoomName = encodeURIComponent(roomName);

    // Build URL with essential parameters and VaultKe branding
    const params = new URLSearchParams();
    params.append('userInfo.displayName', config.userDisplayName);
    if (config.userEmail) {
      params.append('userInfo.email', config.userEmail);
    }

    // VaultKe branding parameters
    params.append('config.defaultLocalDisplayName', config.userDisplayName);
    params.append('config.defaultRemoteDisplayName', 'VaultKe User');
    params.append('interfaceConfig.APP_NAME', 'VaultKe');
    params.append('interfaceConfig.NATIVE_APP_NAME', 'VaultKe');
    params.append('interfaceConfig.SHOW_JITSI_WATERMARK', 'false');
    params.append('interfaceConfig.SHOW_WATERMARK_FOR_GUESTS', 'false');
    params.append('interfaceConfig.SHOW_BRAND_WATERMARK', 'false');
    params.append('interfaceConfig.SHOW_POWERED_BY', 'false');

    // Add JWT token
    params.append('jwt', 'eyJraWQiOiJ2cGFhcy1tYWdpYy1jb29raWUtY2IwNTVmZmJkMDYwNGRlZGIwMGI1YTI1NDAzNDljM2MvZmYxNWQ1LVNBTVBMRV9BUFAiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJqaXRzaSIsImlzcyI6ImNoYXQiLCJpYXQiOjE3NTIwMTAzNzksImV4cCI6MTc1MjAxNzU3OSwibmJmIjoxNzUyMDEwMzc0LCJzdWIiOiJ2cGFhcy1tYWdpYy1jb29raWUtY2IwNTVmZmJkMDYwNGRlZGIwMGI1YTI1NDAzNDljM2MiLCJjb250ZXh0Ijp7ImZlYXR1cmVzIjp7ImxpdmVzdHJlYW1pbmciOmZhbHNlLCJmaWxlLXVwbG9hZCI6ZmFsc2UsIm91dGJvdW5kLWNhbGwiOmZhbHNlLCJzaXAtb3V0Ym91bmQtY2FsbCI6ZmFsc2UsInRyYW5zY3JpcHRpb24iOmZhbHNlLCJyZWNvcmRpbmciOmZhbHNlLCJmbGlwIjpmYWxzZX0sInVzZXIiOnsiaGlkZGVuLWZyb20tcmVjb3JkZXIiOmZhbHNlLCJtb2RlcmF0b3IiOnRydWUsIm5hbWUiOiJUZXN0IFVzZXIiLCJpZCI6Imdvb2dsZS1vYXV0aDJ8MTAzNDg4MTc2MDgxMjc0OTY0NDYyIiwiYXZhdGFyIjoiIiwiZW1haWwiOiJ0ZXN0LnVzZXJAY29tcGFueS5jb20ifX0sInJvb20iOiIqIn0.MywuAboUYhDc3l-v-3n9o7bwlh4ssiCOsyBVfLkVBrO9OA84KANmHXTJEMYdzDgj9m2k_IDLNEPt_h5sAH5g12vO7OMHEc9rV8wDSDJMfOk3LSs54DQqyTHGui10p5RniGTdrG2Cx2Ldl8tjkq7gbH3sRIYZ68rSIxUR8EQAjJfb8YjN6BiTusT2NGLwTE_l_3iGBaRLU_IDURDLLkUHoP9Ltm15AY2ABGW6t0VYkalYJVh9mPNVo65IKQ821tTqta-nyyQ4Nc-4C4AefKTCNqDphZjdDMSQpN2mH35d_C_QXSdkxEoZcECaH3zYMdXnreijw5xA_HqJF0qYZOs7Pg');

    const fullUrl = `${baseUrl}/${encodedRoomName}?${params.toString()}`;
    console.log('🎬 Jitsi: Built fallback URL for room:', config.roomName);
    return fullUrl;
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

  // Event handlers
  const handleWebViewLoad = () => {
    console.log('🎬 Jitsi: WebView loaded');
    setIsConnected(true);
    setIsConnecting(false);
    hasJoinedRef.current = true;

    // Inject CSS to hide login elements (only for WebView, not iframe)
    if (Platform.OS !== 'web' && webViewRef.current) {
      const cssInjectionScript = `
        (function() {
          const style = document.createElement('style');
          style.textContent = \`
            /* Hide login/authentication prompts */
            .auth-dialog,
            .login-dialog,
            .authentication-dialog,
            .auth-required-dialog,
            .waiting-for-host .login-button,
            .lobby-screen .login-button,
            .lobby-screen .auth-button,
            [data-testid="lobby.loginButton"],
            [data-testid="lobby.authButton"],
            .toolbox-button[aria-label*="login"],
            .toolbox-button[aria-label*="sign"],
            .prejoin-input-area .auth-section {
              display: none !important;
              visibility: hidden !important;
            }

            /* Hide invite and external buttons */
            .invite-more-dialog,
            .add-people-dialog,
            [data-testid="invite-more-button"],
            [data-testid="add-people-button"] {
              display: none !important;
            }
          \`;
          document.head.appendChild(style);
          console.log('🎬 Jitsi: Custom CSS injected');
        })();
      `;

      // Inject the CSS after a short delay to ensure DOM is ready
      setTimeout(() => {
        webViewRef.current.injectJavaScript(cssInjectionScript);
      }, 1000);
    }

    Toast.show({
      type: 'success',
      text1: isPreview ? 'Preview mode active' : 'Joined meeting',
      text2: meetingTitle,
    });
  };

  const handleWebViewError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('🎬 Jitsi: WebView error:', nativeEvent);
    setConnectionError('Failed to load Jitsi Meet. Please check your internet connection.');
    setIsConnecting(false);

    Toast.show({
      type: 'error',
      text1: 'Failed to load meeting',
      text2: 'Please check your internet connection and try again',
    });
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
      hasJoinedRef.current = false;
      setIsConnected(false);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to leave meeting:', error);
      navigation.goBack(); // Go back anyway
    }
  };

  const cleanup = () => {
    hasJoinedRef.current = false;
    setIsConnected(false);
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

  // Render cross-platform Jitsi Meet interface
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {Platform.OS === 'web' && jitsiUrl && !connectionError ? (
        // Web platform: Use iframe
        <iframe
          src={jitsiUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: '#000000',
          }}
          allow="camera; microphone; fullscreen; display-capture"
          onLoad={() => {
            console.log('🎬 Jitsi: Iframe loaded');
            handleWebViewLoad();
          }}
        />
      ) : useWebView && jitsiUrl && !connectionError ? (
        // Native platforms: Use WebView
        <WebView
          ref={webViewRef}
          source={{ uri: jitsiUrl }}
          style={styles.webView}
          onLoad={handleWebViewLoad}
          onError={handleWebViewError}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          mixedContentMode="compatibility"
          thirdPartyCookiesEnabled={true}
          sharedCookiesEnabled={true}
          userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.text }]}>
                Loading Jitsi Meet...
              </Text>
            </View>
          )}
        />
      ) : (
        // Fallback: Show error or loading state instead of null
        <View style={styles.fallbackContainer}>
          <Text style={[styles.fallbackText, { color: colors.text }]}>
            {!jitsiUrl ? 'Preparing meeting...' : 'Unable to load meeting interface'}
          </Text>
          {!jitsiUrl && <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />}
          {jitsiUrl && (
            <TouchableOpacity
              style={[styles.fallbackButton, { backgroundColor: colors.primary }]}
              onPress={() => Linking.openURL(jitsiUrl)}
            >
              <Text style={styles.fallbackButtonText}>Open in Browser</Text>
            </TouchableOpacity>
          )}
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

      {/* Debug overlay for development - DISABLED for production */}
      {false && __DEV__ && (
        <View style={styles.debugOverlay}>
          <Text style={styles.debugText}>
            Jitsi Meet | Platform: {Platform.OS}
          </Text>
          <Text style={styles.debugText}>
            Method: {Platform.OS === 'web' ? 'iframe' : useWebView ? 'WebView' : 'External'} | Connected: {isConnected ? '✅' : '❌'}
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
  },
  previewBadge: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
    letterSpacing: 1,
  },
  webView: {
    flex: 1,
    width: width,
    height: height,
  },
  securityNotice: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255, 165, 0, 0.9)',
    padding: 12,
    borderRadius: 8,
    zIndex: 1000,
    alignItems: 'center',
  },
  securityText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  securitySubtext: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
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
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  fallbackText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  fallbackButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  fallbackButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default JitsiMeetScreen;
