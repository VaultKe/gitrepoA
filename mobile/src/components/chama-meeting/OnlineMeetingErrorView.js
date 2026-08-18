import React from 'react';
import { View, Text } from 'react-native';

const OnlineMeetingErrorView = ({ theme, error }) => {
  const colors = {
    backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
    text: theme === 'dark' ? '#ffffff' : '#000000',
    textSecondary: theme === 'dark' ? '#cccccc' : '#666666',
    error: '#FF3B30',
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundColor }}>
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
      }}>
        <Text style={{
          fontSize: 18,
          fontWeight: '600',
          textAlign: 'center',
          marginBottom: 8,
          color: colors.error,
        }}>
          Failed to connect to meeting
        </Text>
        <Text style={{
          fontSize: 14,
          textAlign: 'center',
          color: colors.textSecondary,
        }}>
          {error}
        </Text>
      </View>
    </View>
  );
};

export default OnlineMeetingErrorView;
