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
      <TouchableOpacity
        style={[themedStyles.tableCell, themedStyles.nameCell]}
        onPress={() => onPressDashboard(item)}
        activeOpacity={0.7}
      >
        <View style={themedStyles.nameContainer}>
          <View>
            <Text style={[themedStyles.tableCellText, themedStyles.nameText]} numberOfLines={1}>
              {getDisplayName(item.name)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={[themedStyles.tableCell, themedStyles.categoryCell]}>
        <View style={[themedStyles.typeBadge, { backgroundColor: typeConfig.color + '15' }]}>
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
            <Ionicons name="eye" size={14} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[themedStyles.actionButton, { backgroundColor: colors.secondary }]}
            onPress={() => onPressDashboard(item)}
          >
            <Ionicons name="grid" size={14} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default ChamaTableRow;
