import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';

const EmptyMeetingsState = ({ selectedTab }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const getEmptyMessage = () => {
    switch (selectedTab) {
      case 'upcoming':
        return {
          title: 'No Upcoming Meetings',
          description: 'All caught up! Check back later for new meetings.',
        };
      case 'ongoing':
        return {
          title: 'No Ongoing Meetings',
          description: 'There are no meetings happening right now.',
        };
      case 'past':
        return {
          title: 'No Past Meetings',
          description: 'Your meeting history will appear here.',
        };
      case 'all':
        return {
          title: 'No Meetings Found',
          description: 'No meetings have been scheduled yet.',
        };
      default:
        return {
          title: 'No Meetings',
          description: 'Check back later for upcoming meetings.',
        };
    }
  };

  const { title, description } = getEmptyMessage();

  return (
    <View style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 48,
    }}>
      <Ionicons
        name="calendar-outline"
        size={64}
        color={colors.textSecondary}
        style={{ marginBottom: 16 }}
      />
      <Text style={{
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
        color: colors.text,
      }}>
        {title}
      </Text>
      <Text style={{
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 32,
        paddingHorizontal: 48,
        color: colors.textSecondary,
      }}>
        {description}
      </Text>
    </View>
  );
};

export default EmptyMeetingsState;