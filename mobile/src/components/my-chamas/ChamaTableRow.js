import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ChamaTableRow = ({ item, index, colors, themedStyles, navigation, onPressDetails, onPressDashboard, formatCurrency }) => {
  if (!item) {
    return null;
  }

  const isContributionGroup = item.category === 'contribution';

  const typeConfig = isContributionGroup ? {
    color: colors.success,
    // icon: 'heart',
    label: 'Contribution',
  } : {
    color: colors.primary,
    // icon: 'people',
    label: 'Chama',
  };

  const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;

  const getDisplayName = (name) => {
    if (!name) return 'Unnamed Chama';
    if (name.length > 10) return `${name.substring(0, 10)}...`;
    return name;
  };

  return (
    <View style={[themedStyles.tableRow, { backgroundColor: rowBackgroundColor }]}>
      <View style={[themedStyles.tableCell, themedStyles.nameCell]}>
        <View style={themedStyles.nameContainer}>
          {/* <View style={[themedStyles.typeIcon, { backgroundColor: typeConfig.color + '20' }]}>
            <Ionicons name={typeConfig.icon} size={16} color={typeConfig.color} />
          </View> */}
          <View>
            <Text style={[themedStyles.tableCellText, themedStyles.nameText]} numberOfLines={1}>
              {getDisplayName(item.name)}
            </Text>
            <Text style={[themedStyles.tableCellText, themedStyles.subText]}>
              {item.type || 'Unknown Type'}
            </Text>
          </View>
        </View>
      </View>

      <View style={[themedStyles.tableCell, themedStyles.categoryCell]}>
        <View style={[themedStyles.typeBadge, { backgroundColor: typeConfig.color + '15' }]}>
          <Ionicons name={typeConfig.icon} size={12} color={typeConfig.color} />
          <Text style={[themedStyles.typeBadgeText, { color: typeConfig.color }]}>
            {typeConfig.label}
          </Text>
        </View>
      </View>

      <View style={[themedStyles.tableCell, themedStyles.actionsCell]}>
        <View style={themedStyles.actionButtons}>
          <TouchableOpacity
            style={[themedStyles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => onPressDetails(item)}
          >
            <Ionicons name="eye" size={10} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[themedStyles.actionButton, { backgroundColor: colors.secondary }]}
            onPress={() => onPressDashboard(item)}
          >
            <Ionicons name="grid" size={10} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default ChamaTableRow;
