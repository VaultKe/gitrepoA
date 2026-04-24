import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 80) / 2; // 2 cards per row with more margins for better spacing

export default function StatsCard({
  title,
  value,
  icon,
  color,
  trend = null, // 'up', 'down', or null
  trendValue = null,
  subtitle = null,
}) {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const getTrendIcon = () => {
    if (trend === 'up') return 'trending-up';
    if (trend === 'down') return 'trending-down';
    return null;
  };

  const getTrendColor = () => {
    if (trend === 'up') return colors.success;
    if (trend === 'down') return colors.error;
    return colors.textSecondary;
  };

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: colors.surface,
        borderColor: colors.border,
      }
    ]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        {trend && (
          <View style={styles.trendContainer}>
            <Ionicons name={getTrendIcon()} size={16} color={getTrendColor()} />
          </View>
        )}
      </View>

      {/* Value */}
      <View style={styles.valueSection}>
        <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
          {value}
        </Text>
        {trendValue && (
          <Text style={[styles.trendValue, { color: getTrendColor() }]}>
            {trendValue}
          </Text>
        )}
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: colors.textSecondary }]} numberOfLines={2}>
        {title}
      </Text>

      {/* Subtitle */}
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.textTertiary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      )}

      {/* Background Decoration */}
      <View style={[styles.decoration, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: 120, // Increased height for better proportions
    borderRadius: 16, // More rounded corners
    padding: 20, // Increased padding for better spacing
    marginBottom: 0, // Remove bottom margin since parent handles spacing
    marginHorizontal: 2, // Small horizontal margin for breathing room
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    elevation: 3, // More elevation for better depth
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12, // Increased spacing
  },
  iconContainer: {
    width: 36, // Larger icon container
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendContainer: {
    padding: 4, // Increased padding
  },
  valueSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6, // Increased spacing
  },
  value: {
    fontSize: 20, // Larger font size
    fontWeight: 'bold',
    flex: 1,
  },
  trendValue: {
    fontSize: 13, // Slightly larger
    fontWeight: '600',
    marginLeft: 6,
  },
  title: {
    fontSize: 13, // Slightly larger
    fontWeight: '500',
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 11, // Slightly larger
    marginTop: 4, // Increased spacing
  },
  decoration: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4, // Thicker decoration
    opacity: 0.4,
  },
});
