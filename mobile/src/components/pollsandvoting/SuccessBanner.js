import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '../../utils/theme';

const SuccessBanner = ({ colors, message, onClose }) => {
  if (!message) return null;

  return (
    <View style={[{
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: colors.success + '15',
      borderColor: colors.success,
      borderWidth: 1,
    }]}>
      <Ionicons
        name="checkmark-circle"
        size={20}
        color={colors.success}
        style={{ marginRight: 8 }}
      />
      <Text style={[{ flex: 1, fontSize: 14, fontWeight: '500', color: colors.text }]}>
        {message}
      </Text>
      <TouchableOpacity
        onPress={onClose}
        style={{ padding: 4, marginLeft: 8 }}
      >
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({});

export default SuccessBanner;
