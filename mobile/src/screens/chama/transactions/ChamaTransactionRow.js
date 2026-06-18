import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import {
  formatCurrency,
  formatUserName,
  getShortDescription,
  getShortTypeLabel,
  getTransactionAmount,
  getTransactionColor,
  getTransactionIcon,
  getTransactionUserName,
} from './chamaTransactionsUtils';

const ChamaTransactionRow = ({
  item,
  index,
  chamaMembers,
  onReceiptPress,
  exportLoading,
}) => {
  const colors = getThemeColors();
  const styles = createStyles(colors);
  const transactionType = item.type || item.transaction_type || 'other';
  const transactionColor = getTransactionColor(transactionType, colors);
  const typeIconStyle = getTypeIconStyle(transactionType, styles);
  const typeBadgeStyle = getTypeBadgeStyle(transactionType, styles);
  const typeTextStyle = getTypeTextStyle(transactionType, styles);
  const amountTextStyle = getAmountTextStyle(transactionType, styles);

  return (
    <View style={index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
      <View style={[styles.tableCell, styles.nameCell]}>
        <View style={styles.nameContainer}>
          <View style={[styles.typeIcon, typeIconStyle]}>
            <Ionicons
              name={getTransactionIcon(transactionType)}
              size={12}
              color={transactionColor}
            />
          </View>
          <Text style={[styles.tableCellText, styles.nameText]} numberOfLines={1}>
            {(item.metadata?.isAnonymous || item.metadata?.displayName === 'Anonymous')
              ? 'Anonymous'
              : formatUserName(getTransactionUserName(item, chamaMembers))
            }
          </Text>
        </View>
      </View>

      <View style={[styles.tableCell, styles.descriptionCell]}>
        <Text style={styles.tableCellText} numberOfLines={2}>
          {getShortDescription(item)}
        </Text>
      </View>

      <View style={[styles.tableCell, styles.amountCell]}>
        <Text style={[styles.tableCellText, styles.amountText, amountTextStyle]}>
          {transactionType === 'contribution' ? '+' : '-'}{formatCurrency(getTransactionAmount(item))}
        </Text>
      </View>

      <View style={[styles.tableCell, styles.dateCell]}>
        <Text style={styles.tableCellText}>
          {item.createdAt || item.created_at}
        </Text>
      </View>

      <View style={[styles.tableCell, styles.typeCell]}>
        <View style={[styles.statusBadge, typeBadgeStyle]}>
          <Text style={[styles.statusText, typeTextStyle]}>
            {getShortTypeLabel(transactionType)}
          </Text>
        </View>
      </View>

      <View style={[styles.tableCell, styles.actionsCell]}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={() => onReceiptPress(item)}
          disabled={exportLoading}
        >
          <Ionicons
            name="receipt-outline"
            size={12}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const getTypeIconStyle = (type, styles) => {
  switch (type) {
    case 'contribution':
      return styles.typeIconSuccess;
    case 'withdrawal':
      return styles.typeIconWarning;
    case 'loan':
      return styles.typeIconInfo;
    case 'expense':
      return styles.typeIconError;
    default:
      return styles.typeIconMuted;
  }
};

const getTypeBadgeStyle = (type, styles) => {
  switch (type) {
    case 'contribution':
      return styles.statusBadgeSuccess;
    case 'withdrawal':
      return styles.statusBadgeWarning;
    case 'loan':
      return styles.statusBadgeInfo;
    case 'expense':
      return styles.statusBadgeError;
    default:
      return styles.statusBadgeMuted;
  }
};

const getTypeTextStyle = (type, styles) => {
  switch (type) {
    case 'contribution':
      return styles.statusTextSuccess;
    case 'withdrawal':
      return styles.statusTextWarning;
    case 'loan':
      return styles.statusTextInfo;
    case 'expense':
      return styles.statusTextError;
    default:
      return styles.statusTextMuted;
  }
};

const getAmountTextStyle = (type, styles) => {
  switch (type) {
    case 'contribution':
      return styles.amountTextSuccess;
    case 'withdrawal':
      return styles.amountTextWarning;
    default:
      return styles.amountTextDefault;
  }
};

const createStyles = (colors) => StyleSheet.create({
  tableRowEven: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  tableRowOdd: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  nameCell: {
    flex: 2.5,
    alignItems: 'flex-start',
  },
  descriptionCell: {
    flex: 2,
  },
  amountCell: {
    flex: 1.2,
  },
  dateCell: {
    flex: 1.5,
  },
  typeCell: {
    flex: 1,
  },
  actionsCell: {
    flex: 0.8,
  },
  tableCellText: {
    fontSize: 8.5,
    color: colors.text,
    textAlign: 'center',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  typeIconSuccess: {
    backgroundColor: colors.success + '20',
  },
  typeIconWarning: {
    backgroundColor: colors.warning + '20',
  },
  typeIconInfo: {
    backgroundColor: colors.info + '20',
  },
  typeIconError: {
    backgroundColor: colors.error + '20',
  },
  typeIconMuted: {
    backgroundColor: colors.textSecondary + '20',
  },
  nameText: {
    fontWeight: typography.fontWeight.medium,
    textAlign: 'left',
  },
  amountText: {
    fontWeight: typography.fontWeight.medium,
  },
  amountTextSuccess: {
    color: colors.success,
  },
  amountTextWarning: {
    color: colors.warning,
  },
  amountTextDefault: {
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  statusBadgeSuccess: {
    backgroundColor: colors.success + '20',
  },
  statusBadgeWarning: {
    backgroundColor: colors.warning + '20',
  },
  statusBadgeInfo: {
    backgroundColor: colors.info + '20',
  },
  statusBadgeError: {
    backgroundColor: colors.error + '20',
  },
  statusBadgeMuted: {
    backgroundColor: colors.textSecondary + '20',
  },
  statusText: {
    fontSize: 7,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'capitalize',
  },
  statusTextSuccess: {
    color: colors.success,
  },
  statusTextWarning: {
    color: colors.warning,
  },
  statusTextInfo: {
    color: colors.info,
  },
  statusTextError: {
    color: colors.error,
  },
  statusTextMuted: {
    color: colors.textSecondary,
  },
  actionButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary + '20',
  },
});

export default ChamaTransactionRow;
