import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius } from '../../utils/theme';

const SavingsActions = ({ colors, savingsAccount, canApproveSavings, onApprove, onWithdraw, onDeposit, onStatements }) => {
  return (
    <View style={styles.actions}>
      {canApproveSavings() && savingsAccount.status !== 'locked' && (
        <ActionButton
          colors={colors}
          title={savingsAccount.status === 'eligible' || savingsAccount.status === 'pending' ? 'Approve Withdrawal' : 'Verify Disbursement'}
          onPress={onApprove}
          backgroundColor={colors.primary}
          iconName="checkmark-done"
          marginBottom={spacing.md}
        />
      )}
      {savingsAccount.status === 'eligible' && (
        <ActionButton
          colors={colors}
          title="Withdraw Funds"
          onPress={onWithdraw}
          backgroundColor={colors.warning}
          iconName="cash"
          marginBottom={spacing.md}
        />
      )}

      <ActionButton
        colors={colors}
        title="Deposit Funds"
        onPress={onDeposit}
        backgroundColor={colors.success}
        iconName="add-circle"
        marginBottom={spacing.md}
      />

      <ActionButton
        colors={colors}
        title="View Statements"
        onPress={onStatements}
        backgroundColor={colors.info}
        iconName="document-text"
      />
    </View>
  );
};

const ActionButton = ({ colors, title, onPress, backgroundColor, iconName, marginBottom }) => (
  <View style={{ marginBottom: marginBottom || 0 }}>
    <ActionButtonInner
      colors={colors}
      title={title}
      onPress={onPress}
      backgroundColor={backgroundColor}
      iconName={iconName}
    />
  </View>
);

const ActionButtonInner = ({ colors, title, onPress, backgroundColor, iconName }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      gap: spacing.xs,
    }}
  >
    <Ionicons name={iconName} size={16} color={colors.white} />
    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.white }}>
      {title}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  actions: {
    marginBottom: spacing.xxxl,
  },
});

export default SavingsActions;
