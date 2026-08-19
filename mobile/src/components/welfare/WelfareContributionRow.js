import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, typography } from "../../utils/theme";

const WelfareContributionRow = ({
  contribution,
  index,
  colors,
  tableStyles,
  formatCurrency,
  formatDate,
  getContributorDisplayName,
}) => {
  const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;

  const getContributorName = (contribution) => {
    if (contribution.contributor) {
      const c = contribution.contributor;
      const userData = c.user || c;
      const firstName = userData.first_name || c.first_name || userData.firstName || "";
      const lastName = userData.last_name || c.last_name || userData.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || userData.name || c.name || c.email?.split("@")[0] || "Anonymous";
    }
    return "Anonymous";
  };

  return (
    <View
      style={[
        tableStyles.tableRow,
        { backgroundColor: rowBackgroundColor },
      ]}
    >
      {/* Contributor */}
      <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
        <View style={tableStyles.nameContainer}>
          <View
            style={[
              tableStyles.typeIcon,
              { backgroundColor: colors.primary + "20" },
            ]}
          >
            <Ionicons name="person" size={12} color={colors.primary} />
          </View>
          <Text
            style={[tableStyles.tableCellText, tableStyles.nameText]}
            numberOfLines={1}
          >
            {getContributorDisplayName(contribution)}
          </Text>
        </View>
      </View>

      {/* Amount */}
      <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
        <Text
          style={[
            tableStyles.tableCellText,
            {
              fontWeight: typography.fontWeight.medium,
              color: colors.success,
            },
          ]}
        >
          {formatCurrency(contribution.amount)}
        </Text>
      </View>

      {/* Date */}
      <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
        <Text style={tableStyles.tableCellText}>
          {formatDate(contribution.createdAt || contribution.created_at)}
        </Text>
      </View>
    </View>
  );
};

export default WelfareContributionRow;
