import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

/**
 * PageRefreshButton
 *
 * A reusable floating refresh button for any screen. It is positioned
 * absolute bottom-right, above the tab bar, so it does not interfere
 * with tab navigation. The button accepts an `onRefresh` callback and
 * manages its own loading/refreshing guard to avoid deadlock.
 *
 * Usage:
 *   <PageRefreshButton
 *     onRefresh={async () => {
 *       await loadPageData();
 *     }}
 *     refreshing={externalRefreshing}
 *   />
 *
 * Notes:
 * - `refreshing` is optional. If omitted, the button tracks its own
 *   in-flight state internally.
 * - If `onRefresh` throws, the button resets itself so it never stays
 *   stuck in a loading state.
 */

const PageRefreshButton = ({
  onRefresh,
  refreshing: externalRefreshing,
  color,
  size = 56,
  iconSize = 24,
  style,
  label,
  bottom = 64,
  absolute = true,
}) => {
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const [spinAnim] = useState(new Animated.Value(0));

  const refreshing = externalRefreshing ?? internalRefreshing;
  const themeColors = getThemeColors(color ? undefined : undefined);
  const buttonColor = color || themeColors.primary;

  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const startSpin = useCallback(() => {
    spinAnim.setValue(0);
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ).start();
  }, [spinAnim]);

  const stopSpin = useCallback(() => {
    spinAnim.stopAnimation(() => spinAnim.setValue(0));
  }, [spinAnim]);

  const handlePress = useCallback(async () => {
    if (refreshing) return;

    if (externalRefreshing === undefined) {
      setInternalRefreshing(true);
    }
    startSpin();

    try {
      await onRefresh?.();
    } catch (error) {
      console.warn('PageRefreshButton: refresh failed', error);
    } finally {
      if (externalRefreshing === undefined) {
        setInternalRefreshing(false);
      }
      stopSpin();
    }
  }, [refreshing, externalRefreshing, onRefresh, startSpin, stopSpin]);

  const wrapperStyle = [
    absolute ? styles.wrapper : styles.wrapperRelative,
    absolute ? { bottom } : {},
    style,
  ];

  return (
    <View style={wrapperStyle} pointerEvents="box-none">
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        disabled={refreshing}
        style={[
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: buttonColor,
            shadowColor: buttonColor,
          },
        ]}
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons
            name={refreshing ? 'refresh' : 'refresh-outline'}
            size={iconSize}
            color="#fff"
          />
        </Animated.View>

        {label ? (
          <Text style={styles.label}>{label}</Text>
        ) : null}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 999,
    alignItems: 'flex-end',
  },
  wrapperRelative: {
    position: 'relative',
    zIndex: 999,
    alignItems: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  label: {
    color: '#fff',
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
});

export default PageRefreshButton;
