import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors } from '../../../utils/theme';
import Button from '../../../components/common/Button';

const EmptyRemindersState = ({ onAddReminder }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  return (
    <View style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 20,
    }}>
      <Ionicons name="notifications-outline" size={64} color={colors.textSecondary} />
      <Text style={{
        fontSize: 20,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
        color: colors.text,
      }}>No Reminders Yet</Text>
      <Text style={{
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 40,
        color: colors.textSecondary,
      }}>
        Create your first reminder to get started
      </Text>
      <Button
        title="Add Reminder"
        onPress={onAddReminder}
        style={{
          paddingHorizontal: 32,
        }}
      />
    </View>
  );
};

export default EmptyRemindersState;