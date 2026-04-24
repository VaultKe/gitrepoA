import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VaultKeTheme } from '../theme/theme';

const { width } = Dimensions.get('window');

const MessageBanner = ({
  visible,
  message,
  type = 'error', // 'error', 'success', 'warning', 'info'
  duration = 4000,
  onDismiss,
  actionText,
  onActionPress,
}) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Slide in and fade in
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after duration
      if (duration > 0) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, duration);

        return () => clearTimeout(timer);
      }
    } else {
      // Slide out and fade out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, duration]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onDismiss) {
        onDismiss();
      }
    });
  };

  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: VaultKeTheme.colors.success,
          icon: 'checkmark-circle',
          textColor: '#FFFFFF',
        };
      case 'warning':
        return {
          backgroundColor: VaultKeTheme.colors.warning,
          icon: 'warning',
          textColor: '#FFFFFF',
        };
      case 'info':
        return {
          backgroundColor: VaultKeTheme.colors.primary,
          icon: 'information-circle',
          textColor: '#FFFFFF',
        };
      case 'error':
      default:
        return {
          backgroundColor: VaultKeTheme.colors.error,
          icon: 'alert-circle',
          textColor: '#FFFFFF',
        };
    }
  };

  const typeConfig = getTypeConfig();

  if (!visible && slideAnim._value === -100) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: typeConfig.backgroundColor,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons
          name={typeConfig.icon}
          size={24}
          color={typeConfig.textColor}
          style={styles.icon}
        />
        <Text style={[styles.message, { color: typeConfig.textColor }]}>
          {message}
        </Text>
        {actionText && onActionPress && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onActionPress}
          >
            <Text style={[styles.actionText, { color: typeConfig.textColor }]}>
              {actionText}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
        >
          <Ionicons
            name="close"
            size={20}
            color={typeConfig.textColor}
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: 50, // Account for status bar
    paddingHorizontal: VaultKeTheme.spacing.md,
    paddingBottom: VaultKeTheme.spacing.md,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: VaultKeTheme.borderRadius.md,
    padding: VaultKeTheme.spacing.md,
  },
  icon: {
    marginRight: VaultKeTheme.spacing.sm,
  },
  message: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  actionButton: {
    marginLeft: VaultKeTheme.spacing.sm,
    paddingHorizontal: VaultKeTheme.spacing.sm,
    paddingVertical: VaultKeTheme.spacing.xs,
    borderRadius: VaultKeTheme.borderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    marginLeft: VaultKeTheme.spacing.sm,
    padding: VaultKeTheme.spacing.xs,
  },
});

export default MessageBanner;
