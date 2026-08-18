import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const InvitationModeSelector = ({ invitationMode, onModeChange, colors }) => {
  return (
    <View style={styles.modeButtons}>
      <TouchableOpacity
        style={[
          styles.modeButton,
          { borderColor: colors.border },
          invitationMode === 'email' && { backgroundColor: colors.primary + '20', borderColor: colors.primary }
        ]}
        onPress={() => onModeChange('email')}
      >
        <Ionicons
          name="mail"
          size={20}
          color={invitationMode === 'email' ? colors.primary : colors.textSecondary}
        />
        <Text style={[
          styles.modeButtonText,
          { color: invitationMode === 'email' ? colors.primary : colors.textSecondary }
        ]}>
          By Email
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.modeButton,
          { borderColor: colors.border },
          invitationMode === 'users' && { backgroundColor: colors.primary + '20', borderColor: colors.primary }
        ]}
        onPress={() => onModeChange('users')}
      >
        <Ionicons
          name="people"
          size={20}
          color={invitationMode === 'users' ? colors.primary : colors.textSecondary}
        />
        <Text style={[
          styles.modeButtonText,
          { color: invitationMode === 'users' ? colors.primary : colors.textSecondary }
        ]}>
          Search Users
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = {
  modeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
};

export default InvitationModeSelector;
