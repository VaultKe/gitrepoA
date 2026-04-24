import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

const VaultKeLogoWeb = ({
  size = 120,
  variant = 'full', // 'full', 'badge', 'icon'
  showText = true
}) => {
  // Always use the React Native SVG component for consistency
  // This ensures the premium logos are always visible
  const VaultKeLogo = require('./VaultKeLogo').default;
  return <VaultKeLogo size={size} variant={variant} showText={showText} />;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VaultKeLogoWeb;
