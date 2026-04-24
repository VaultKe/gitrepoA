import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

/**
 * E2EE Status Component
 * Shows encryption status and provides security information
 */
const E2EEStatus = ({ isEncrypted = true, onPress }) => {
  const colors = getThemeColors();

  const showSecurityInfo = () => {
    Alert.alert(
      '🔐 End-to-End Encryption',
      'Your messages are secured with Signal Protocol encryption:\n\n' +
      '• Messages are encrypted on your device\n' +
      '• Only you and the recipient can read them\n' +
      '• VaultKe servers cannot access your messages\n' +
      '• Perfect forward secrecy protects past messages\n' +
      '• Military-grade AES-256-GCM encryption for images',
      [{ text: 'Got it', style: 'default' }]
    );
  };

  if (!isEncrypted) {
    return (
      <TouchableOpacity 
        style={[styles.container, styles.unencrypted]} 
        onPress={onPress || showSecurityInfo}
      >
        <Ionicons name="shield-outline" size={14} color={colors.warning} />
        <Text style={[styles.text, { color: colors.warning }]}>
          Not Encrypted
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={[styles.container, styles.encrypted]} 
      onPress={onPress || showSecurityInfo}
    >
      <Ionicons name="shield-checkmark" size={14} color={colors.success} />
      <Text style={[styles.text, { color: colors.success }]}>
        E2EE
      </Text>
    </TouchableOpacity>
  );
};

const styles = {
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.xs,
  },
  encrypted: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  unencrypted: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  text: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: 3,
  },
};

export default E2EEStatus;
