import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseToast } from 'react-native-toast-message';
import { getThemeColors } from '../../utils/theme';
import { useApp } from '../../context/AppContext';

const TOAST_ICON_SIZE = 22;
const INDICATOR_SIZE = 36;
const INDICATOR_BORDER_RADIUS = INDICATOR_SIZE / 2;

const CustomSuccessToast = (props) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const successColor = colors.success;

  return (
    <BaseToast
      style={styles.base}
      contentContainerStyle={styles.contentContainer}
      renderLeadingIcon={() => (
        <View style={[styles.indicator, { backgroundColor: successColor + '20' }]}>
          <Ionicons name="checkmark-circle" size={TOAST_ICON_SIZE} color={successColor} />
        </View>
      )}
      {...props}
    />
  );
};

const CustomErrorToast = (props) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const errorColor = colors.error;

  return (
    <BaseToast
      style={styles.base}
      contentContainerStyle={styles.contentContainer}
      renderLeadingIcon={() => (
        <View style={[styles.indicator, { backgroundColor: errorColor + '20' }]}>
          <Ionicons name="alert-circle" size={TOAST_ICON_SIZE} color={errorColor} />
        </View>
      )}
      {...props}
    />
  );
};

const CustomInfoToast = (props) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const infoColor = colors.info || '#3B82F6';

  return (
    <BaseToast
      style={styles.base}
      contentContainerStyle={styles.contentContainer}
      renderLeadingIcon={() => (
        <View style={[styles.indicator, { backgroundColor: infoColor + '20' }]}>
          <Ionicons name="information-circle" size={TOAST_ICON_SIZE} color={infoColor} />
        </View>
      )}
      {...props}
    />
  );
};

const toastConfig = {
  success: (props) => <CustomSuccessToast {...props} />,
  error: (props) => <CustomErrorToast {...props} />,
  info: (props) => <CustomInfoToast {...props} />,
};

export default toastConfig;

const styles = StyleSheet.create({
  base: {
    borderLeftWidth: 0,
    alignItems: 'center',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  indicator: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginLeft: 8,
  },
});
