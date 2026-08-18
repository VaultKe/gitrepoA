import React from 'react';
import { View, Text, StatusBar } from 'react-native';
import VideoCallView from '../../components/VideoCallView';

const OnlineMeetingView = ({
  participants,
  onToggleCamera,
  onToggleMicrophone,
  onSwitchCamera,
  onEndCall,
  isCameraEnabled,
  isMicrophoneEnabled,
  userRole,
  isPreview,
  meetingTitle,
  theme,
}) => {
  return (
    <View style={{ flex: 1, backgroundColor: theme === 'dark' ? '#000000' : '#ffffff' }}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />

      <VideoCallView
        participants={participants}
        onToggleCamera={onToggleCamera}
        onToggleMicrophone={onToggleMicrophone}
        onSwitchCamera={onSwitchCamera}
        onEndCall={onEndCall}
        isCameraEnabled={isCameraEnabled}
        isMicrophoneEnabled={isMicrophoneEnabled}
        userRole={userRole}
        isPreview={isPreview}
        meetingTitle={meetingTitle}
      />

      {__DEV__ && (
        <View style={{
          position: 'absolute',
          top: 50,
          right: 10,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 8,
          borderRadius: 4,
          zIndex: 1000,
        }}>
          <Text style={{
            color: 'white',
            fontSize: 10,
            fontFamily: 'monospace',
          }}>
            Camera: {isCameraEnabled ? '✅' : '❌'} | Mic: {isMicrophoneEnabled ? '✅' : '❌'}
          </Text>
          <Text style={{
            color: 'white',
            fontSize: 10,
            fontFamily: 'monospace',
          }}>
            Participants: {participants.length} | Connected: {'✅'}
          </Text>
        </View>
      )}
    </View>
  );
};

export default OnlineMeetingView;
