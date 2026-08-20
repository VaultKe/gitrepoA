import React from 'react';
import { View, StyleSheet } from 'react-native';

const localStyles = StyleSheet.create({
  flexibleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  flexibleCard: {
    flex: 1,
  },
  fullWidthRow: {
    marginBottom: 12,
  },
});

const SmartResponsiveLayout = ({ children, isLargeScreen, styles }) => {
  const layoutStyles = { ...localStyles, ...(styles || {}) };

  if (!isLargeScreen) {
    return <View>{children}</View>;
  }

  const cardConfigs = [
    { component: 'members', canShare: true, priority: 1 },
    { component: 'meetings', canShare: true, priority: 2 },
    { component: 'transactions', canShare: false, priority: 3 },
    { component: 'polls', canShare: false, priority: 4 },
  ];

  const childrenArray = React.Children.toArray(children);
  const rows = [];
  let currentRow = [];

  childrenArray.forEach((child, index) => {
    const config = cardConfigs[index] || { canShare: false };

    if (!config.canShare || currentRow.length === 0) {
      if (currentRow.length > 0) {
        rows.push(
          <View key={`row-${rows.length}`} style={layoutStyles.flexibleRow}>
            {currentRow.map((item, idx) => (
              <View key={idx} style={[layoutStyles.flexibleCard, { flex: 1 / currentRow.length }]}>
                {item}
              </View>
            ))}
          </View>
        );
        currentRow = [];
      }

      if (config.canShare) {
        currentRow.push(child);
      } else {
        rows.push(
          <View key={`row-${rows.length}`} style={layoutStyles.fullWidthRow}>
            {child}
          </View>
        );
      }
    } else if (config.canShare && currentRow.length === 1) {
      currentRow.push(child);

      rows.push(
        <View key={`row-${rows.length}`} style={layoutStyles.flexibleRow}>
          {currentRow.map((item, idx) => (
            <View key={idx} style={[layoutStyles.flexibleCard, { flex: 0.5 }]}>
              {item}
            </View>
          ))}
        </View>
      );
      currentRow = [];
    }
  });

  if (currentRow.length > 0) {
    rows.push(
      <View key={`row-${rows.length}`} style={layoutStyles.flexibleRow}>
        {currentRow.map((item, idx) => (
          <View key={idx} style={[layoutStyles.flexibleCard, { flex: 1 / currentRow.length }]}>
            {item}
          </View>
        ))}
      </View>
    );
  }

  return <View>{rows}</View>;
};

export default SmartResponsiveLayout;
