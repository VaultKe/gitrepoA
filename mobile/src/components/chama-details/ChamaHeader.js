import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const ChamaHeader = ({ chama, colors, getGroupLabel }) => {
  const isContributionGroup = chama?.category === 'contribution';
  const typeConfig = isContributionGroup ? {
    color: colors.success,
    icon: 'heart',
    label: 'Fund Group',
    fullLabel: 'Contribution Group',
    bgColor: colors.success + '15'
  } : {
    color: colors.primary,
    icon: 'people',
    label: 'Chama',
    fullLabel: 'Chama',
    bgColor: colors.primary + '15'
  };

  return (
    <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs }} variant="outlined">
      <View style={[styles.categoryBadge, { backgroundColor: typeConfig.color }]}>
        <Ionicons name={typeConfig.icon} size={12} color={colors.white} />
        <Text style={[styles.categoryBadgeText, { color: colors.white }]}>
          {typeConfig.label.toUpperCase()}
        </Text>
      </View>

      <View style={styles.chamaHeader}>
        <View style={[styles.chamaAvatar, { backgroundColor: typeConfig.color }]}>
          <Ionicons name={typeConfig.icon} size={40} color={colors.white} />
        </View>

        <View style={styles.chamaInfo}>
          <Text style={[styles.chamaName, { color: colors.text }]}>
            {chama?.name}
          </Text>
          <Text style={[styles.chamaType, { color: colors.textSecondary }]}>
            {chama?.type} • {chama?.county}, {chama?.town}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: colors.success + '20' }]}>
            <Text style={[styles.statusText, { color: colors.success }]}>
              {chama?.status?.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {chama?.description && (
        <View style={styles.descriptionContainer}>
          <Text style={[styles.descriptionLabel, { color: colors.text }]}>
            About this {typeConfig.fullLabel}
          </Text>
          <Text
            style={[styles.chamaDescription, { color: colors.textSecondary }]}
            numberOfLines={0}
            allowFontScaling={true}
          >
            {chama.description}
          </Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  categoryBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  categoryBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginLeft: spacing.xs,
    letterSpacing: 0.5,
  },
  chamaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chamaAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  chamaInfo: {
    flex: 1,
  },
  chamaName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  chamaType: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.xs,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  descriptionContainer: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  descriptionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  chamaDescription: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
});

export default ChamaHeader;
