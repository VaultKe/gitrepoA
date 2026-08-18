import React from 'react';
import { View, Text, ActivityIndicator, StatusBar } from 'react-native';
import { useApp } from '../../context/AppContext';

const OnlineMeetingLoading = ({ theme, meetingTitle, isPreview }) => {
  const colors = {
    backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
    text: theme === 'dark' ? '#ffffff' : '#000000',
    textSecondary: theme === 'dark' ? '#cccccc' : '#666666',
    primary: '#007AFF',
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundColor }}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
      }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{
          fontSize: 18,
          fontWeight: '600',
          marginTop: 16,
          textAlign: 'center',
          color: colors.text,
        }}>
          {isPreview ? 'Loading preview...' : 'Connecting to meeting...'}
        </Text>
        <Text style={{
          fontSize: 14,
          marginTop: 8,
          textAlign: 'center',
          color: colors.textSecondary,
        }}>
          {meetingTitle}
        </Text>
        {isPreview && (
          <Text style={{
            fontSize: 12,
            fontWeight: '600',
            marginTop: 8,
            textAlign: 'center',
            letterSpacing: 1,
            color: colors.primary,
          }}>
            PREVIEW MODE
          </Text>
        )}
      </View>
    </View>
  );
};

export default OnlineMeetingLoading;
