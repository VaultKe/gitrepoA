import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const TransactionFilterBar = ({ filter, setFilter, filterTypes, colors }) => {
  return (
    <View style={[{ borderBottomWidth: 1, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={[{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.xs }}
            >
              {filterTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    { flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, gap: spacing.xs, marginRight: spacing.xs, backgroundColor: colors.backgroundSecondary },
                    filter === type.id && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => setFilter(type.id)}
                >
                  <Text
                    style={[
                      { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium, color: filter === type.id ? colors.white : colors.textSecondary },
                      filter === type.id && { fontWeight: '600' },
                    ]}
                  >
                    {type.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>
    </View>
  );
};

export default TransactionFilterBar;
