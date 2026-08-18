import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FormErrorMessage = ({ error, showErrors, colors }) => {
  if (!error || !showErrors) return null;

  return (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle" size={16} color={colors.error} />
      <Text style={[styles.errorText, { color: colors.error }]}>
        {error}
      </Text>
    </View>
  );
};

const styles = {
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
  },
  errorText: {
    fontSize: 14,
    marginLeft: 6,
    flex: 1,
  },
};

export default FormErrorMessage;
