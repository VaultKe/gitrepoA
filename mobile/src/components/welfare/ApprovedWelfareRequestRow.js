import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ApprovedWelfareRequestRow = ({ item, index, colors, tableStyles, formatCurrency, getCategoryIcon, getCategoryColor, getUrgencyColor, isUserIdLeft, getBeneficiaryDisplayName, setSelectedTableItem, setShowActionModal }) => {
  const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;
  return (
    <View style={[tableStyles.tableRow, { backgroundColor: rowBackgroundColor }]}>
      <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
        <View style={tableStyles.nameContainer}>
          <View style={[tableStyles.typeIcon, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
            <Ionicons name={getCategoryIcon(item.category)} size={12} color={getCategoryColor(item.category)} />
          </View>
          <Text style={[tableStyles.tableCellText, tableStyles.nameText]} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
      </View>
      <View style={[tableStyles.tableCell, { flex: 2 }]}>
        <Text style={[
          tableStyles.tableCellText,
          isUserIdLeft(item.beneficiaryId) && { textDecorationLine: 'line-through', color: colors.error }
        ]} numberOfLines={1}>
          {getBeneficiaryDisplayName(item)}
        </Text>
      </View>
      <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
        <Text style={[tableStyles.tableCellText, { color: colors.primary, fontWeight: '500' }]}>
          {formatCurrency(item.amount)}
        </Text>
      </View>
      <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
        <Text style={[tableStyles.tableCellText, { color: colors.success, fontWeight: '500' }]}>
          {formatCurrency(item.totalContributions || 0)}
        </Text>
      </View>
      <View style={[tableStyles.tableCell, tableStyles.typeCell]}>
        <View style={[tableStyles.statusBadge, { backgroundColor: colors.primary + '20' }]}>
          <Text style={[tableStyles.statusText, { color: colors.primary }]}>
            {Math.min(Math.round(((item.totalContributions || 0) / item.amount) * 100), 100)}%
          </Text>
        </View>
      </View>
      <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
        <TouchableOpacity
          style={[tableStyles.actionButton, { backgroundColor: colors.primary + '20' }]}
          onPress={() => {
            setSelectedTableItem(item);
            setShowActionModal(true);
          }}
        >
          <Ionicons name="ellipsis-vertical" size={12} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ApprovedWelfareRequestRow;
