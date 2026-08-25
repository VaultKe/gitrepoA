import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Dimensions,
   ActivityIndicator,
   TextInput,
 } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getThemeColors, spacing, typography, borderRadius, shadows, createThemedStyles } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import useMyChamas from '../../../hooks/useMyChamas';
import ChamaTableRow from '../../../components/my-chamas/ChamaTableRow';
import ChamaFilterDropdown from '../../../components/my-chamas/ChamaFilterDropdown';

const categoryOptions = [
  { id: 'all', name: 'All', icon: 'list' },
  { id: 'chama', name: 'Chamas'},
  { id: 'contribution', name: 'Contribution Groups'},
];

const createTableStyles = createThemedStyles((colors, spacing, typography, shadows) => ({
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary + '10',
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  nameCell: {
    flex: 1.5,
    alignItems: 'flex-start',
  },
  categoryCell: {
    flex: 2,
  },
  actionsCell: {
    flex: 1.5,
  },
  tableHeaderText: {
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    fontSize: 13,
    textAlign: 'center',
  },
  tableCellText: {
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  nameText: {
    fontWeight: typography.fontWeight.medium,
    textAlign: 'left',
  },
  subText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs / 2,
  },
  roleBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'capitalize',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  actionButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text,
    paddingVertical: 0,
  },
}));

const MyChamasScreen = ({ navigation, route }) => {
  const hook = useMyChamas({ navigation, route });
  const themedStyles = createTableStyles(hook.theme);

  const renderTableRow = ({ item, index }) => {
    return (
      <ChamaTableRow
        item={item}
        index={index}
        colors={hook.theme ? getThemeColors(hook.theme) : getThemeColors('light')}
        themedStyles={themedStyles}
        navigation={navigation}
        onPressDetails={(item) => navigation.navigate('ChamaDetails', { chamaId: item.id || '' })}
        onPressDashboard={(item) => hook.switchToChamaDashboard(item)}
        formatCurrency={hook.formatCurrency}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: getThemeColors(hook.theme).background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
        <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <View style={[themedStyles.searchContainer, { flex: 1 }]}>
              <Ionicons name="search" size={14} color={getThemeColors(hook.theme).textSecondary} style={themedStyles.searchIcon} />
              <TextInput
                style={themedStyles.searchInput}
                placeholder="Search chamas..."
                value={hook.searchQuery}
                onChangeText={hook.setSearchQuery}
                placeholderTextColor={getThemeColors(hook.theme).textSecondary}
              />
            </View>
            <TouchableOpacity
              style={[{
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderRadius: borderRadius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderColor: getThemeColors(hook.theme).border,
                gap: spacing.xs,
              }]}
              onPress={() => hook.setShowFilterDropdown(!hook.showFilterDropdown)}
            >
              <Text style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: getThemeColors(hook.theme).text }}>
                {categoryOptions.find(opt => opt.id === hook.selectedCategory)?.name || 'All'}
              </Text>
              <Ionicons name={hook.showFilterDropdown ? "chevron-up" : "chevron-down"} size={16} color={getThemeColors(hook.theme).textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <ChamaFilterDropdown
          showFilterDropdown={hook.showFilterDropdown}
          setShowFilterDropdown={hook.setShowFilterDropdown}
          selectedCategory={hook.selectedCategory}
          setSelectedCategory={hook.setSelectedCategory}
          categoryOptions={categoryOptions}
          colors={getThemeColors(hook.theme)}
        />

        <View style={{ flex: 1, paddingHorizontal: spacing.sm }}>
          <Card
            variant="outlined"
            style={{
              flex: 1,
              borderRadius: 8,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: getThemeColors(hook.theme).border,
              shadowColor: 'transparent',
              shadowOpacity: 0,
              shadowRadius: 0,
              shadowOffset: { width: 0, height: 0 },
              elevation: 0,
            }}
          >
            {hook.loading && (
              <View style={styles.inlineTableLoading}>
                <ActivityIndicator size="small" color={getThemeColors(hook.theme).primary} />
                <Text style={[styles.inlineTableLoadingText, { color: getThemeColors(hook.theme).textSecondary }]}>
                  Loading chamas...
                </Text>
              </View>
            )}
            <View style={themedStyles.tableHeader}>
              <View style={[themedStyles.tableCell, themedStyles.nameCell]}>
                <Text style={themedStyles.tableHeaderText}>Name</Text>
              </View>
              <View style={[themedStyles.tableCell, themedStyles.categoryCell]}>
                <Text style={themedStyles.tableHeaderText}>Category</Text>
              </View>
              <View style={[themedStyles.tableCell, themedStyles.actionsCell]}>
                <Text style={themedStyles.tableHeaderText}>Action</Text>
              </View>
            </View>

            <FlatList
              data={hook.filteredChamas}
              renderItem={renderTableRow}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={hook.refreshing}
                  onRefresh={hook.onRefresh}
                  colors={[getThemeColors(hook.theme).primary]}
                  tintColor={getThemeColors(hook.theme).primary}
                />
              }
              ListEmptyComponent={hook.loading ? null : renderEmptyState(hook)}
            />
          </Card>
        </View>

        <View style={{ position: 'absolute', right: spacing.md, bottom: 64, flexDirection: 'column', alignItems: 'center', gap: spacing.md, zIndex: 999 }}>
          <PageRefreshButton onRefresh={hook.onRefresh} refreshing={hook.refreshing} color={getThemeColors(hook.theme).primary} absolute={false} style={{ borderRadius: borderRadius.full }} />
          <TouchableOpacity
            activeOpacity={0.85}
            style={[{
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: getThemeColors(hook.theme).primary,
              shadowColor: getThemeColors(hook.theme).primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.35,
              shadowRadius: 4,
              elevation: 6,
            }]}
            onPress={() => navigation.navigate('CreateChama')}
          >
            <Ionicons name="add" size={24} color={getThemeColors(hook.theme).white} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const renderEmptyState = (hook) => (
  <View style={styles.emptyState}>
    <Ionicons size={64} color={getThemeColors(hook.theme).textTertiary} />
    <Text style={[styles.emptyTitle, { color: getThemeColors(hook.theme).text }]}>
      No chamas found
    </Text>
    <Text style={[styles.emptySubtitle, { color: getThemeColors(hook.theme).textSecondary }]}>
      {hook.searchQuery
        ? 'Try adjusting your search'
        : "You haven't joined any chamas yet"
      }
    </Text>
  </View>
);

const getResponsiveStyles = (isLargeScreen, screenWidth, numColumns, screenType, isCompactHeight, colors) => {
  const getCardWidth = () => {
    if (numColumns === 1) {
      return '100%';
    } else {
      const containerPadding = spacing.md * 2;
      const cardMargin = screenType === 'desktop' ? spacing.lg : spacing.sm;
      const availableWidth = screenWidth - containerPadding - cardMargin;
      return availableWidth / numColumns;
    }
  };

  const cardWidth = getCardWidth();

  const getResponsiveSizes = () => {
    switch (screenType) {
      case 'desktop':
        return {
          cardMinHeight: 220,
          titleFontSize: typography.fontSize.xl,
          subtitleFontSize: typography.fontSize.base,
          avatarSize: 60,
          padding: spacing.lg,
        };
      case 'tablet':
        return {
          cardMinHeight: 200,
          titleFontSize: typography.fontSize.lg,
          subtitleFontSize: typography.fontSize.sm,
          avatarSize: 55,
          padding: spacing.md,
        };
      default:
        return {
          cardMinHeight: 180,
          titleFontSize: typography.fontSize.lg,
          subtitleFontSize: typography.fontSize.sm,
          avatarSize: 50,
          padding: spacing.md,
        };
    }
  };

  const responsiveSizes = getResponsiveSizes();

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    inlineTableLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    inlineTableLoadingText: {
      fontSize: typography.fontSize.sm,
    },
    staticHeader: {
      borderBottomWidth: 1,
      ...shadows.sm,
      zIndex: 1000,
      elevation: 5,
    },
    header: {
      paddingHorizontal: spacing.md,
      paddingVertical: isCompactHeight ? spacing.xs : spacing.sm,
    },
    stickySearchHeader: {
      paddingHorizontal: spacing.md,
      paddingVertical: isCompactHeight ? spacing.xs : spacing.sm,
    },
    scrollableFilters: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
    },
    scrollableContainer: {
      flex: 1,
    },

    searchInput: {
      marginBottom: spacing.xs,
      height: 36,
    },
    filtersRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    filtersContainer: {
      paddingRight: spacing.sm,
      flex: 1,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      marginRight: spacing.xs,
      borderWidth: 1,
    },
    filterText: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
      marginLeft: spacing.xs,
    },
    sortButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      borderWidth: 1,
    },
    sortText: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      marginLeft: spacing.xs,
    },
    chamasList: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxxl,
    },
    row: {
      justifyContent: numColumns === 2 ? 'space-between' : 'center',
      paddingHorizontal: numColumns === 2 ? spacing.xs : 0,
    },
    chamaCard: {
      marginBottom: screenType === 'desktop' ? spacing.lg : spacing.md,
      width: cardWidth,
      marginHorizontal: numColumns === 2 ? (screenType === 'desktop' ? spacing.sm : spacing.xs / 2) : 0,
      minHeight: responsiveSizes.cardMinHeight,
      padding: responsiveSizes.padding,
    },
    chamaHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    chamaAvatar: {
      width: responsiveSizes.avatarSize,
      height: responsiveSizes.avatarSize,
      borderRadius: responsiveSizes.avatarSize / 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: screenType === 'desktop' ? spacing.lg : spacing.md,
    },
    chamaInfo: {
      flex: 1,
    },
    chamaName: {
      fontSize: responsiveSizes.titleFontSize,
      fontWeight: typography.fontWeight.semibold,
      marginBottom: screenType === 'desktop' ? spacing.sm : spacing.xs,
      lineHeight: screenType === 'desktop' ? 28 : 24,
    },
    chamaType: {
      fontSize: responsiveSizes.subtitleFontSize,
      lineHeight: screenType === 'desktop' ? 22 : 20,
    },
    roleBadge: {
      paddingHorizontal: screenType === 'desktop' ? spacing.md : spacing.sm,
      paddingVertical: screenType === 'desktop' ? spacing.sm : spacing.xs,
      borderRadius: borderRadius.md,
    },
    roleText: {
      fontSize: screenType === 'desktop' ? typography.fontSize.sm : typography.fontSize.xs,
      fontWeight: typography.fontWeight.bold,
    },
    descriptionContainer: {
      marginTop: spacing.lg,
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    chamaDescription: {
      fontSize: typography.fontSize.sm,
      lineHeight: typography.lineHeight.normal,
      opacity: 0.9,
      textAlign: 'left',
    },
    noDescription: {
      fontStyle: 'italic',
      opacity: 0.6,
    },
    chamaStats: {
      marginBottom: spacing.md,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    statText: {
      fontSize: typography.fontSize.sm,
      marginLeft: spacing.sm,
    },
    chamaActions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    actionButton: {
      flex: 1,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxxl,
      paddingHorizontal: spacing.xl,
    },
    emptyTitle: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.semibold,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    emptySubtitle: {
      fontSize: typography.fontSize.base,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    emptyButton: {
      marginTop: spacing.md,
    },
    fab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 4,
      elevation: 6,
    },
    categoryTabs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    categoryTab: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      margin: spacing.xs,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      minHeight: 48,
    },
    categoryTabText: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      marginLeft: spacing.sm,
      textAlign: 'center',
    },
    filterIndicator: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.xs,
      alignItems: 'center',
    },
    filterIndicatorText: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    categoryBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.sm,
      minWidth: 50,
      maxWidth: 70,
    },
    categoryBadgeText: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.bold,
      marginLeft: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    compactSearchInput: {
      height: 32,
      marginBottom: spacing.xs / 2,
    },
    compactCategoryTabs: {
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      paddingVertical: spacing.xs,
    },
    compactCategoryTab: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      minHeight: 36,
    },
    compactCategoryTabText: {
      fontSize: typography.fontSize.xs,
      marginLeft: spacing.xs,
    },
    compactFiltersRow: {
      marginTop: spacing.xs / 2,
    },
    compactFilterChip: {
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs / 2,
    },
    compactFilterText: {
      fontSize: typography.fontSize.xs - 1,
      marginLeft: spacing.xs / 2,
    },
    dropdownOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9998,
    },
  });
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MyChamasScreen;
