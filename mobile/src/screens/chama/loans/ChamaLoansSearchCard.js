import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../../components/common/Card';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';

const ChamaLoansSearchCard = ({
  searchQuery,
  setSearchQuery,
}) => {
  const colors = getThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.searchContainerOuter}>
      <Card padding="none" style={styles.searchCard}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={14} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, styles.searchInputText]}
            placeholder="Search loans..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      </Card>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  searchContainerOuter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchCard: {
    borderRadius: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    paddingVertical: 0,
    fontWeight: '500',
  },
  searchInputText: {
    color: colors.text,
  },
});

export default ChamaLoansSearchCard;
