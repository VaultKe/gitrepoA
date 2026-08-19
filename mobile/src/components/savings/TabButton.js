import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../../utils/theme';

const TabButton = ({ colors, activeTab, tabName, label, iconName, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 2,
      borderBottomColor: activeTab === tabName ? colors.primary : colors.border,
    }}
  >
    <Ionicons
      name={iconName}
      size={20}
      color={activeTab === tabName ? colors.primary : colors.textSecondary}
    />
    <Text style={{
      fontSize: 12,
      fontWeight: activeTab === tabName ? '600' : '400',
      color: activeTab === tabName ? colors.primary : colors.textSecondary,
      marginTop: spacing.xs / 2,
    }}>
      {label}
    </Text>
  </TouchableOpacity>
);

export default TabButton;
