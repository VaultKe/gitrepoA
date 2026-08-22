import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography } from '../../utils/theme';

const PaymentMethodCard = ({ method, methodType, colors, onToggleActive, onSetDefault, onDelete }) => {
  return (
    <Card style={styles.methodCard}>
      <View style={styles.methodHeader}>
        <View style={styles.methodInfo}>
          <View style={[styles.methodIcon, { backgroundColor: methodType?.color + '20' }]}>
            <Ionicons name={methodType?.icon} size={24} color={methodType?.color} />
          </View>
          <View style={styles.methodDetails}>
            <Text style={[styles.methodName, { color: colors.text }]}>
              {method.name}
            </Text>
            <Text style={[styles.methodDetailsText, { color: colors.textSecondary }]}>
              {method.details}
            </Text>
            {method.isDefault && (
              <Text style={[styles.defaultBadge, { color: colors.primary }]}>
                Default
              </Text>
            )}
          </View>
        </View>
        <Switch
          value={method.isActive}
          onValueChange={(value) => onToggleActive(method.id, value)}
          trackColor={{ false: colors.border, true: colors.primary + '40' }}
          thumbColor={method.isActive ? colors.primary : colors.textSecondary}
        />
      </View>
      
      <View style={styles.methodActions}>
        {!method.isDefault && (
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.primary }]}
            onPress={() => onSetDefault(method.id)}
          >
            <Text style={[styles.actionButtonText, { color: colors.primary }]}>
              Set as Default
            </Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.actionButton, { borderColor: colors.error }]}
          onPress={() => onDelete(method.id)}
        >
          <Text style={[styles.actionButtonText, { color: colors.error }]}>
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  methodCard: {
    padding: spacing.md,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  methodDetails: {
    flex: 1,
  },
  methodName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  methodDetailsText: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  defaultBadge: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
  },
  methodActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
});

export default PaymentMethodCard;
