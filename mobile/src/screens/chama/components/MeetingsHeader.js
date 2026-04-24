import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors } from '../../../utils/theme';

const MeetingsHeader = ({ tabs, selectedTab, onTabPress }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  return (
    <View style={{
      paddingHorizontal: 16,
      paddingVertical: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    }}>
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
      }}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              gap: 8,
              backgroundColor: selectedTab === tab.id ? colors.primary + '10' : 'transparent',
              borderColor: selectedTab === tab.id ? colors.primary : colors.border,
            }}
            onPress={() => onTabPress(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={selectedTab === tab.id ? colors.primary : colors.textSecondary}
            />
            <Text style={{
              fontSize: 14,
              fontWeight: '500',
              color: selectedTab === tab.id ? colors.primary : colors.textSecondary,
            }}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export default MeetingsHeader;