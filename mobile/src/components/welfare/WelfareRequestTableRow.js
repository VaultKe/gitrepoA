import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const WelfareRequestTableRow = ({ item, index, colors, tableStyles, formatCurrency, formatDate, welfareCategories, urgencyLevels, getCategoryIcon, getCategoryColor, getUrgencyColor, isUserIdLeft, getRequesterDisplayName, setSelectedTableItem, setShowActionModal }) => {
  const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;
  return (
    <View style={[tableStyles.tableRow, { backgroundColor: rowBackgroundColor }]}>
      <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
        <View style={tableStyles.nameContainer}>
          <View style={[tableStyles.typeIcon, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
            <Ionicons name={getCategoryIcon(item.category)} size={12} color={getCategoryColor(item.category)} />
          </View>
          <Text style={[tableStyles.tableCellText, tableStyles.nameText]} numberOfLines={1}>
            {item.title.length > 5 ? item.title.substring(0, 5) + '...' : item.title}
          </Text>
        </View>
      </View>
      <View style={[tableStyles.tableCell, tableStyles.typeCell]}>
        <View style={[tableStyles.statusBadge, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
          <Text style={[tableStyles.statusText, { color: getCategoryColor(item.category) }]}>
            {welfareCategories.find(c => c.id === item.category)?.name || item.category}
          </Text>
        </View>
      </View>
      <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
        <Text style={[tableStyles.tableCellText, { color: colors.primary, fontWeight: '500' }]}>
          {formatCurrency(item.amount)}
        </Text>
      </View>
      <View style={[tableStyles.tableCell, tableStyles.typeCell]}>
        <View style={[tableStyles.statusBadge, { backgroundColor: getUrgencyColor(item.urgency) + '20' }]}>
          <Text style={[tableStyles.statusText, { color: getUrgencyColor(item.urgency) }]}>
            {urgencyLevels.find(l => l.id === item.urgency)?.name || item.urgency}
          </Text>
        </View>
      </View>
      <View style={[tableStyles.tableCell, tableStyles.typeCell]}>
        <Text style={[
          tableStyles.tableCellText,
          isUserIdLeft(item.requesterId) && { textDecorationLine: 'line-through', color: colors.error }
        ]} numberOfLines={1}>
          {getRequesterDisplayName(item)}
        </Text>
      </View>
      <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
          <Text style={tableStyles.tableCellText}>
            {formatDate(item.createdAt || item.created_at)}
          </Text>
      </View>
      <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
        <Text style={tableStyles.tableCellText}>
          {item.votes?.yes || item.votes_for || 0}/{item.votes?.no || item.votes_against || 0}
        </Text>
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

export default WelfareRequestTableRow;
