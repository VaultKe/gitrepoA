import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors } from '../../utils/theme';

const MessageBanner = ({
  type = 'info',
  message,
  onClose,
  style
}) => {
  const colors = getThemeColors();

  const getBannerStyle = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: colors.success + '15',
          borderColor: colors.success,
          borderWidth: 1,
        };
      case 'error':
        return {
          backgroundColor: colors.error + '15',
          borderColor: colors.error,
          borderWidth: 1,
        };
      case 'warning':
        return {
          backgroundColor: colors.warning + '15',
          borderColor: colors.warning,
          borderWidth: 1,
        };
      default:
        return {
          backgroundColor: colors.info + '15',
          borderColor: colors.info,
          borderWidth: 1,
        };
    }
  };

  const getIconName = () => {
    switch (type) {
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'close-circle';
      case 'warning':
        return 'warning';
      default:
        return 'information-circle';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return colors.success;
      case 'error':
        return colors.error;
      case 'warning':
        return colors.warning;
      default:
        return colors.info;
    }
  };

  return (
    <View style={[styles.container, getBannerStyle(), style]}>
      <Ionicons
        name={getIconName()}
        size={20}
        color={getIconColor()}
        style={styles.icon}
      />
      <Text style={[styles.message, { color: colors.text }]}>
        {message}
      </Text>
      {onClose && (
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  icon: {
    marginRight: 8,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});

export default MessageBanner;