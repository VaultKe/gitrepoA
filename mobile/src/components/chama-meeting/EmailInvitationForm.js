import React from 'react';
import { View, Text, TextInput } from 'react-native';
import FormErrorMessage from './FormErrorMessage';

const EmailInvitationForm = ({ email, phoneNumber, onEmailChange, onPhoneChange, showErrors, formErrors, colors }) => {
  return (
    <View style={[styles.formCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Email Invitation
      </Text>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>
          Email Address *
        </Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: colors.background,
              borderColor: showErrors && formErrors.email ? colors.error : colors.border,
              color: colors.text
            }
          ]}
          value={email}
          onChangeText={onEmailChange}
          placeholder="Enter email address"
          placeholderTextColor={colors.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {showErrors && formErrors.email && (
          <FormErrorMessage error={formErrors.email} showErrors={showErrors} colors={colors} />
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>
          Phone Number (Optional)
        </Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: colors.background,
              borderColor: showErrors && formErrors.phone ? colors.error : colors.border,
              color: colors.text
            }
          ]}
          value={phoneNumber}
          onChangeText={onPhoneChange}
          placeholder="Enter phone number"
          placeholderTextColor={colors.textSecondary}
          keyboardType="phone-pad"
        />
        {showErrors && formErrors.phone && (
          <FormErrorMessage error={formErrors.phone} showErrors={showErrors} colors={colors} />
        )}
      </View>
    </View>
  );
};

const styles = {
  formCard: {
    padding: 20,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
};

export default EmailInvitationForm;
