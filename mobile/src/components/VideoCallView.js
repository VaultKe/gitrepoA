import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const VideoCallView = ({
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
}) => {
  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.webContainer]}>
      <View style={styles.header}>
        <Text style={styles.title}>{meetingTitle || 'Online Meeting'}</Text>
        {isPreview && (
          <View style={styles.previewBadge}>
            <Text style={styles.previewText}>Preview</Text>
          </View>
        )}
      </View>

      <View style={styles.videoArea}>
        <View style={styles.videoPlaceholder}>
          <Ionicons name="people" size={48} color="#888" />
          <Text style={styles.videoText}>
            {participants.length > 0
              ? `${participants.length} participant${participants.length > 1 ? 's' : ''}`
              : 'Waiting for participants...'}
          </Text>
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, !isCameraEnabled && styles.controlButtonOff]}
          onPress={onToggleCamera}
        >
          <Ionicons
            name={isCameraEnabled ? 'videocam' : 'videocam-off'}
            size={24}
            color="white"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !isMicrophoneEnabled && styles.controlButtonOff]}
          onPress={onToggleMicrophone}
        >
          <Ionicons
            name={isMicrophoneEnabled ? 'mic' : 'mic-off'}
            size={24}
            color="white"
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={onSwitchCamera}>
          <Ionicons name="camera-reverse" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.controlButton, styles.endButton]} onPress={onEndCall}>
          <Ionicons name="call" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webContainer: {
    minHeight: '100vh',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  title: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  previewBadge: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  previewText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  videoArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholder: {
    alignItems: 'center',
    gap: 12,
  },
  videoText: {
    color: '#888',
    fontSize: 14,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonOff: {
    backgroundColor: 'rgba(255,59,48,0.8)',
  },
  endButton: {
    backgroundColor: '#FF3B30',
  },
});

export default VideoCallView;
