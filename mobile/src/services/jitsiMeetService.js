import { Platform } from 'react-native';
import CryptoJS from 'crypto-js';

/**
 * Jitsi Meet Service
 * Replaces LiveKit service with Jitsi Meet integration
 * Provides secure room generation, JWT tokens, and WebView-based video conferencing
 */
class JitsiMeetService {
  constructor() {
    this.isConnected = false;
    this.currentRoom = null;
    this.eventListeners = new Map();
    this.participants = new Map();
    this.localParticipant = null;
    this.webViewRef = null;
    
    // Jitsi Meet configuration
    this.jitsiConfig = {
      domain: 'meet.jit.si',
      // You can change this to your own Jitsi server if self-hosting
      serverUrl: 'https://meet.jit.si',
      // JWT configuration (for secure rooms)
      appId: 'vaultke-meetings', // Your app identifier
      // Note: For production, you should use your own Jitsi server with proper JWT setup
    };

    console.log('🎬 Jitsi Meet Service initialized');
  }

  /**
   * Generate a secure room name for the meeting
   * Format: vaultke_chama_{chamaId}_{meetingId}_{timestamp}
   */
  generateSecureRoomName(chamaId, meetingId) {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `vaultke_chama_${chamaId}_${meetingId}_${timestamp}_${randomSuffix}`;
  }

  /**
   * Generate JWT token for secure room access
   * Note: In production, this should be done on the backend for security
   */
  generateJWTToken(roomName, userDisplayName, userRole, userEmail = '') {
    // For now, we'll use room passwords instead of JWT for simplicity
    // In production, implement proper JWT on your backend
    const roomPassword = this.generateRoomPassword(roomName, userRole);
    
    return {
      roomPassword,
      moderator: userRole === 'chairperson' || userRole === 'secretary',
      displayName: userDisplayName,
      email: userEmail,
    };
  }

  /**
   * Generate a secure room password
   */
  generateRoomPassword(roomName, userRole) {
    // Create a deterministic but secure password based on room and role
    const secret = 'vaultke-secret-key'; // In production, use environment variable
    const data = `${roomName}-${userRole}`;
    return CryptoJS.HmacSHA256(data, secret).toString().substring(0, 12);
  }

  /**
   * Connect to a Jitsi Meet room
   */
  async connectToRoom(connectionData) {
    try {
      console.log('🎬 Jitsi: Connecting to room with data:', connectionData);
      
      const {
        roomName,
        userDisplayName,
        userRole = 'member',
        userEmail = '',
        chamaId,
        meetingId
      } = connectionData;

      // Generate secure room name if not provided
      const secureRoomName = roomName || this.generateSecureRoomName(chamaId, meetingId);
      
      // Generate authentication data
      const authData = this.generateJWTToken(secureRoomName, userDisplayName, userRole, userEmail);
      
      // Store current room data
      this.currentRoom = {
        roomName: secureRoomName,
        userDisplayName,
        userRole,
        userEmail,
        authData,
        joinUrl: this.buildJitsiUrl(secureRoomName, authData),
      };

      // Create local participant
      this.localParticipant = {
        identity: `user_${Date.now()}`,
        name: userDisplayName,
        isLocal: true,
        isCameraEnabled: true,
        isMicrophoneEnabled: true,
        role: userRole,
      };

      // Add to participants map
      this.participants.set(this.localParticipant.identity, this.localParticipant);

      this.isConnected = true;
      
      // Emit connection event
      this.emit('connected', {
        room: this.currentRoom,
        participant: this.localParticipant,
      });

      console.log('✅ Jitsi: Connected to room:', secureRoomName);
      
      return {
        success: true,
        roomName: secureRoomName,
        joinUrl: this.currentRoom.joinUrl,
        authData,
      };

    } catch (error) {
      console.error('🎬 Jitsi: Failed to connect to room:', error);
      throw error;
    }
  }

  /**
   * Build Jitsi Meet URL with configuration
   */
  buildJitsiUrl(roomName, authData) {
    const baseUrl = this.jitsiConfig.serverUrl;
    const encodedRoomName = encodeURIComponent(roomName);
    
    // Build URL with configuration parameters
    const params = new URLSearchParams({
      // User configuration
      'userInfo.displayName': authData.displayName,
      'userInfo.email': authData.email,
      
      // Room configuration
      'config.startWithAudioMuted': 'false',
      'config.startWithVideoMuted': 'false',
      'config.requireDisplayName': 'true',
      'config.enableWelcomePage': 'false',
      'config.enableClosePage': 'false',
      
      // Security configuration
      'config.enableLobbyChat': 'false',
      'config.enableNoAudioDetection': 'true',
      'config.enableNoisyMicDetection': 'true',
      
      // UI configuration
      'config.toolbarButtons': JSON.stringify([
        'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
        'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
        'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
        'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
        'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
        'security'
      ]),
      
      // Moderator settings
      'config.enableUserRolesBasedOnToken': 'true',
    });

    // Add room password if available
    if (authData.roomPassword) {
      params.append('config.roomPassword', authData.roomPassword);
    }

    // Add moderator flag
    if (authData.moderator) {
      params.append('config.isModerator', 'true');
    }

    return `${baseUrl}/${encodedRoomName}?${params.toString()}`;
  }

  /**
   * Set WebView reference for communication
   */
  setWebViewRef(webViewRef) {
    this.webViewRef = webViewRef;
    console.log('🎬 Jitsi: WebView reference set');
  }

  /**
   * Handle messages from Jitsi Meet WebView
   */
  handleWebViewMessage(event) {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('🎬 Jitsi: Received message:', message);

      switch (message.type) {
        case 'participantJoined':
          this.handleParticipantJoined(message.data);
          break;
        case 'participantLeft':
          this.handleParticipantLeft(message.data);
          break;
        case 'audioMuteStatusChanged':
          this.handleAudioMuteChanged(message.data);
          break;
        case 'videoMuteStatusChanged':
          this.handleVideoMuteChanged(message.data);
          break;
        case 'conferenceJoined':
          this.handleConferenceJoined(message.data);
          break;
        case 'conferenceLeft':
          this.handleConferenceLeft(message.data);
          break;
        case 'readyToClose':
          this.handleReadyToClose();
          break;
        default:
          console.log('🎬 Jitsi: Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('🎬 Jitsi: Error handling WebView message:', error);
    }
  }

  /**
   * Handle participant joined event
   */
  handleParticipantJoined(data) {
    const participant = {
      identity: data.id || `participant_${Date.now()}`,
      name: data.displayName || 'Unknown',
      isLocal: false,
      isCameraEnabled: !data.videoMuted,
      isMicrophoneEnabled: !data.audioMuted,
      role: 'member',
    };

    this.participants.set(participant.identity, participant);
    this.emit('participantConnected', participant);
    console.log('🎬 Jitsi: Participant joined:', participant.name);
  }

  /**
   * Handle participant left event
   */
  handleParticipantLeft(data) {
    const participant = this.participants.get(data.id);
    if (participant) {
      this.participants.delete(data.id);
      this.emit('participantDisconnected', participant);
      console.log('🎬 Jitsi: Participant left:', participant.name);
    }
  }

  /**
   * Handle audio mute status change
   */
  handleAudioMuteChanged(data) {
    if (data.isLocal && this.localParticipant) {
      this.localParticipant.isMicrophoneEnabled = !data.muted;
      this.emit('trackSubscribed', {
        track: { kind: 'audio', enabled: !data.muted },
        participant: this.localParticipant,
      });
    }
  }

  /**
   * Handle video mute status change
   */
  handleVideoMuteChanged(data) {
    if (data.isLocal && this.localParticipant) {
      this.localParticipant.isCameraEnabled = !data.muted;
      this.emit('trackSubscribed', {
        track: { kind: 'video', enabled: !data.muted },
        participant: this.localParticipant,
      });
    }
  }

  /**
   * Handle conference joined event
   */
  handleConferenceJoined(data) {
    this.isConnected = true;
    this.emit('connectionStateChanged', 'connected');
    console.log('🎬 Jitsi: Conference joined successfully');
  }

  /**
   * Handle conference left event
   */
  handleConferenceLeft(data) {
    this.isConnected = false;
    this.emit('connectionStateChanged', 'disconnected');
    this.emit('disconnected', 'user_initiated');
    console.log('🎬 Jitsi: Conference left');
  }

  /**
   * Handle ready to close event
   */
  handleReadyToClose() {
    this.emit('readyToClose');
    console.log('🎬 Jitsi: Ready to close');
  }

  /**
   * Send command to Jitsi Meet WebView
   */
  sendCommand(command, data = {}) {
    if (this.webViewRef) {
      const message = JSON.stringify({ command, data });
      this.webViewRef.postMessage(message);
      console.log('🎬 Jitsi: Sent command:', command, data);
    } else {
      console.warn('🎬 Jitsi: WebView reference not available');
    }
  }

  /**
   * Toggle camera on/off
   */
  async toggleCamera() {
    try {
      const newState = !this.localParticipant.isCameraEnabled;
      this.sendCommand('toggleVideo');
      this.localParticipant.isCameraEnabled = newState;
      console.log('🎬 Jitsi: Camera toggled to:', newState);
      return newState;
    } catch (error) {
      console.error('🎬 Jitsi: Failed to toggle camera:', error);
      throw error;
    }
  }

  /**
   * Toggle microphone on/off
   */
  async toggleMicrophone() {
    try {
      const newState = !this.localParticipant.isMicrophoneEnabled;
      this.sendCommand('toggleAudio');
      this.localParticipant.isMicrophoneEnabled = newState;
      console.log('🎬 Jitsi: Microphone toggled to:', newState);
      return newState;
    } catch (error) {
      console.error('🎬 Jitsi: Failed to toggle microphone:', error);
      throw error;
    }
  }

  /**
   * Switch camera (front/back)
   */
  async switchCamera() {
    try {
      this.sendCommand('switchCamera');
      console.log('🎬 Jitsi: Camera switched');
    } catch (error) {
      console.error('🎬 Jitsi: Failed to switch camera:', error);
      throw error;
    }
  }

  /**
   * End the meeting/call
   */
  async endCall() {
    try {
      this.sendCommand('hangup');
      console.log('🎬 Jitsi: Call ended');
    } catch (error) {
      console.error('🎬 Jitsi: Failed to end call:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the room
   */
  async disconnect() {
    try {
      this.sendCommand('hangup');
      this.isConnected = false;
      this.currentRoom = null;
      this.participants.clear();
      this.localParticipant = null;
      this.webViewRef = null;

      console.log('🎬 Jitsi: Disconnected from room');
    } catch (error) {
      console.error('🎬 Jitsi: Error during disconnect:', error);
    }
  }

  /**
   * Get current participants
   */
  getParticipants() {
    return Array.from(this.participants.values());
  }

  /**
   * Get current room information
   */
  getCurrentRoom() {
    return this.currentRoom;
  }

  /**
   * Check if connected to a room
   */
  isConnectedToRoom() {
    return this.isConnected;
  }

  /**
   * Event listener management
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`🎬 Jitsi: Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Generate JavaScript code to inject into WebView for Jitsi integration
   */
  getWebViewInjectedJavaScript() {
    return `
      (function() {
        console.log('🎬 Jitsi WebView: Initializing...');

        // Store original postMessage
        const originalPostMessage = window.ReactNativeWebView?.postMessage;

        if (!originalPostMessage) {
          console.error('🎬 Jitsi WebView: ReactNativeWebView not available');
          return;
        }

        // Helper function to send messages to React Native
        function sendToReactNative(type, data) {
          try {
            originalPostMessage(JSON.stringify({ type, data }));
          } catch (error) {
            console.error('🎬 Jitsi WebView: Error sending message:', error);
          }
        }

        // Wait for Jitsi API to be available
        function waitForJitsiAPI() {
          if (typeof JitsiMeetExternalAPI !== 'undefined') {
            initializeJitsiIntegration();
          } else {
            setTimeout(waitForJitsiAPI, 100);
          }
        }

        function initializeJitsiIntegration() {
          console.log('🎬 Jitsi WebView: API available, setting up listeners...');

          // Listen for conference events
          window.addEventListener('message', function(event) {
            if (event.data && event.data.type) {
              switch (event.data.type) {
                case 'CONFERENCE_JOINED':
                  sendToReactNative('conferenceJoined', event.data);
                  break;
                case 'CONFERENCE_LEFT':
                  sendToReactNative('conferenceLeft', event.data);
                  break;
                case 'PARTICIPANT_JOINED':
                  sendToReactNative('participantJoined', event.data);
                  break;
                case 'PARTICIPANT_LEFT':
                  sendToReactNative('participantLeft', event.data);
                  break;
                case 'AUDIO_MUTE_STATUS_CHANGED':
                  sendToReactNative('audioMuteStatusChanged', event.data);
                  break;
                case 'VIDEO_MUTE_STATUS_CHANGED':
                  sendToReactNative('videoMuteStatusChanged', event.data);
                  break;
              }
            }
          });

          // Listen for commands from React Native
          window.addEventListener('message', function(event) {
            if (event.data && typeof event.data === 'string') {
              try {
                const message = JSON.parse(event.data);
                if (message.command) {
                  handleReactNativeCommand(message.command, message.data);
                }
              } catch (error) {
                // Not a JSON message, ignore
              }
            }
          });
        }

        function handleReactNativeCommand(command, data) {
          console.log('🎬 Jitsi WebView: Handling command:', command, data);

          // Note: These commands work with the Jitsi Meet interface
          // The exact implementation depends on Jitsi's current API
          switch (command) {
            case 'toggleVideo':
              // Try to find and click the video toggle button
              const videoButton = document.querySelector('[data-testid="toggle-video"]') ||
                                 document.querySelector('.toolbox-button[aria-label*="camera"]') ||
                                 document.querySelector('.toolbox-button[aria-label*="video"]');
              if (videoButton) videoButton.click();
              break;

            case 'toggleAudio':
              // Try to find and click the audio toggle button
              const audioButton = document.querySelector('[data-testid="toggle-audio"]') ||
                                 document.querySelector('.toolbox-button[aria-label*="microphone"]') ||
                                 document.querySelector('.toolbox-button[aria-label*="mute"]');
              if (audioButton) audioButton.click();
              break;

            case 'hangup':
              // Try to find and click the hangup button
              const hangupButton = document.querySelector('[data-testid="hangup"]') ||
                                  document.querySelector('.toolbox-button[aria-label*="leave"]') ||
                                  document.querySelector('.toolbox-button[aria-label*="hangup"]');
              if (hangupButton) hangupButton.click();
              break;

            case 'switchCamera':
              // This is more complex and may require accessing device APIs
              console.log('🎬 Jitsi WebView: Camera switch requested');
              break;
          }
        }

        // Start waiting for Jitsi API
        waitForJitsiAPI();

        console.log('🎬 Jitsi WebView: Integration setup complete');
      })();
      true; // Required for injected JavaScript
    `;
  }
}

// Create and export singleton instance
const jitsiMeetService = new JitsiMeetService();
export default jitsiMeetService;
