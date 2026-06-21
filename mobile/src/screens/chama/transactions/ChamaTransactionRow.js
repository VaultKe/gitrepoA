import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import {
  formatCurrency,
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
  theme,
}) => {
  const colors = getThemeColors(theme);
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
          <Text style={[styles.tableCellText, styles.nameText]}>
            {(item.metadata?.isAnonymous || item.metadata?.displayName === 'Anonymous')
              ? 'Anonymous'
              : getTransactionUserName(item, chamaMembers)
            }
          </Text>
        </View>
      </View>

      <Text style={[styles.tableCellText, styles.descriptionCellText, styles.descriptionText]}>
        {getTransactionDescription(item)}
      </Text>

      <Text style={[styles.tableCellText, styles.amountCellText, styles.amountText, amountTextStyle]}>
        {transactionType === 'contribution' ? '+' : '-'}{formatCurrency(getTransactionAmount(item))}
      </Text>

      <Text style={[styles.tableCellText, styles.dateCellText]}>
        {formatTransactionDate(item.createdAt || item.created_at)}
      </Text>

      <View style={[styles.statusBadgeCell, typeBadgeStyle]}>
        <Text style={[styles.statusText, typeTextStyle]}>
          {getShortTypeLabel(transactionType)}
        </Text>
      </View>

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
  );
};

const formatTransactionDate = (dateValue) => {
  if (!dateValue) return '';

  const dateString = String(dateValue);
  const datePart = dateString.slice(0, 10);
  const timePart = dateString.slice(11, 16);

  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart) && /^\d{2}:\d{2}$/.test(timePart)) {
    return `${datePart} ${timePart}`;
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toISOString().slice(0, 16).replace('T', ' ');
};

const getTransactionDescription = (item) => {
  return item.description ||
         item.transaction_description ||
         item.memo ||
         item.purpose ||
         item.metadata?.description ||
         `${item.type || item.transaction_type || 'Transaction'} transaction`;
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
    paddingHorizontal: 0,
  },
  nameCell: {
    flex: 1.8,
    alignItems: 'flex-start',
    paddingHorizontal: 0,
  },
  descriptionCell: {
    flex: 2.3,
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
    fontSize: typography.fontSize.sm,
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: spacing.xs,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  typeIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
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
    flex: 1,
  },
  descriptionCellText: {
    flex: 2.3,
    textAlign: 'left',
  },
  amountCellText: {
    flex: 1.2,
  },
  dateCellText: {
    flex: 1.5,
  },
  descriptionText: {
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
  statusBadgeCell: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: typography.fontSize.xs,
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
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary + '20',
  },
});

export default ChamaTransactionRow;
