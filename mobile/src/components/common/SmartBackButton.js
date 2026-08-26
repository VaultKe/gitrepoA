import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';

/**
 * Smart Back Button Component
 *
 * Uses navigation.goBack() (equivalent to navigate(-1)) to return to the
 * immediate previous screen. When the current navigator (e.g. a Tab navigator)
 * cannot go back, delegates to the parent navigator's goBack() — which is
 * essential for nested navigators like Tab-inside-Stack.
 */
const SmartBackButton = ({
  style,
  iconSize = 24,
  iconColor,
  onPress,
  disabled = false,
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const navigation = useNavigation();

  const handlePress = () => {
    if (disabled) return;

    if (onPress) {
      onPress();
      return;
    }

    // navigate(-1): go back to the immediate previous route
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    // If the current navigator (e.g. Tab) can't go back, try the parent
    // This handles the common Tab-inside-Stack pattern where the Tab
    // navigator has no back stack but the parent Stack does.
    const parent = navigation.getParent();
    if (parent && typeof parent.canGoBack === 'function' && parent.canGoBack()) {
      parent.goBack();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.backButton, style]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Ionicons
        name="arrow-back"
        size={iconSize}
        color={iconColor || colors.text}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    minHeight: 40,
  },
});

export default SmartBackButton;
