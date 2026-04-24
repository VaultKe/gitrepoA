import React from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

/**
 * ButtonGroup Component
 * Provides consistent layouts for multiple buttons
 */
export default function ButtonGroup({
  children,
  direction = 'row', // row, column
  spacing = 12,
  wrap = false,
  justify = 'flex-start', // flex-start, center, flex-end, space-between, space-around, space-evenly
  align = 'center', // flex-start, center, flex-end, stretch
  style,
  ...props
}) {
  const containerStyle = [
    styles.container,
    {
      flexDirection: direction,
      justifyContent: justify,
      alignItems: align,
      flexWrap: wrap ? 'wrap' : 'nowrap',
    },
    style,
  ];

  // Add spacing between children
  const childrenWithSpacing = React.Children.map(children, (child, index) => {
    if (!child) return null;

    const isLast = index === React.Children.count(children) - 1;
    const spacingStyle = isLast ? {} : (
      direction === 'row' 
        ? { marginRight: spacing }
        : { marginBottom: spacing }
    );

    return React.cloneElement(child, {
      style: [child.props.style, spacingStyle],
    });
  });

  return (
    <View style={containerStyle} {...props}>
      {childrenWithSpacing}
    </View>
  );
}

// Predefined button group layouts - RESPONSIVE
export const ButtonRow = ({ children, spacing = 8, justify = 'space-between', ...props }) => {
  const isSmallScreen = screenWidth < 350;
  const adjustedSpacing = isSmallScreen ? Math.max(4, spacing - 4) : spacing;

  return (
    <ButtonGroup
      direction="row"
      spacing={adjustedSpacing}
      justify={justify}
      {...props}
    >
      {children}
    </ButtonGroup>
  );
};

export const ButtonColumn = ({ children, spacing = 8, align = 'stretch', ...props }) => {
  const isSmallScreen = screenWidth < 350;
  const adjustedSpacing = isSmallScreen ? Math.max(4, spacing - 4) : spacing;

  return (
    <ButtonGroup
      direction="column"
      spacing={adjustedSpacing}
      align={align}
      {...props}
    >
      {children}
    </ButtonGroup>
  );
};

export const ButtonGrid = ({ children, spacing = 8, ...props }) => {
  const isSmallScreen = screenWidth < 350;
  const adjustedSpacing = isSmallScreen ? Math.max(4, spacing - 4) : spacing;

  return (
    <ButtonGroup
      direction="row"
      spacing={adjustedSpacing}
      wrap={true}
      justify="space-between"
      {...props}
    >
      {children}
    </ButtonGroup>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
