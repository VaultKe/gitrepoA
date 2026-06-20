import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
  Dimensions,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows, createThemedStyles } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import ApiService from '../../../services/api';

const createTableStyles = createThemedStyles((colors, spacing, typography, shadows) => ({
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
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
    flex: 3,
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
    color: colors.text,
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
  const { theme, user, switchToChamaDashboard } = useApp();
  const colors = getThemeColors(theme);
  const themedStyles = createTableStyles(theme);

  // Get current screen dimensions (updates on orientation change)
  const [screenData, setScreenData] = useState(Dimensions.get('window'));

  useEffect(() => {
    const onChange = (result) => {
      setScreenData(result.window);
    };

    const subscription = Dimensions.addEventListener('change', onChange);
    return () => subscription?.remove();
  }, []);

  // Improved responsive breakpoints
  const { width: screenWidth, height: screenHeight } = screenData;
  const getResponsiveConfig = () => {
    // Check if device has limited screen height (compact mode)
    const isCompactHeight = screenHeight < 700;

    if (screenWidth < 600) {
      // Mobile phones (portrait and landscape)
      return {
        numColumns: 1,
        isLargeScreen: false,
        screenType: 'mobile',
        isCompactHeight
      };
    } else if (screenWidth < 900) {
      // Small tablets, large phones in landscape
      return {
        numColumns: 2,
        isLargeScreen: true,
        screenType: 'tablet',
        isCompactHeight
      };
    } else {
      // Large tablets, desktop - make cards bigger for readability
      return {
        numColumns: 2,
        isLargeScreen: true,
        screenType: 'desktop',
        isCompactHeight
      };
    }
  };

  const { numColumns, isLargeScreen, screenType, isCompactHeight } = getResponsiveConfig();
  const styles = getResponsiveStyles(isLargeScreen, screenWidth, numColumns, screenType, isCompactHeight, colors);

  const [chamas, setChamas] = useState([]);
  const [filteredChamas, setFilteredChamas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categoryOptions = [
    { id: 'all', name: 'All', icon: 'list' },
    { id: 'chama', name: 'Chamas', icon: 'people' },
    { id: 'contribution', name: 'Contribution Groups', icon: 'heart' },
  ];




  useEffect(() => {
    loadUserChamas();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [chamas, searchQuery, selectedCategory]);

  // Refresh chamas when screen is focused (e.g., after creating a new chama)
  useFocusEffect(
    React.useCallback(() => {
      if (route.params?.refresh) {
        loadUserChamas();
        // Clear the refresh param to avoid unnecessary refreshes
        navigation.setParams({ refresh: undefined });
      }
    }, [route.params?.refresh])
  );

  const loadUserChamas = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getUserChamas(50, 0);

      if (response.success) {
        setChamas(response.data || []);
      } else {
        throw new Error(response.error || 'Failed to load chamas');
      }
    } catch (error) {
      console.error('Failed to load user chamas:', error);
      Alert.alert('Error', 'Failed to load your chamas. Please try again.');
      setChamas([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserChamas();
    setRefreshing(false);
  };

  const applyFiltersAndSort = () => {
    let filtered = [...chamas];

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(chama => {
        if (selectedCategory === 'contribution') {
          return chama.category === 'contribution';
        } else if (selectedCategory === 'chama') {
          return chama.category !== 'contribution';
        }
        return true;
      });
    }

    // Apply search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(chama => {
        const name = (chama.name || '').toLowerCase();
        const description = (chama.description || '').toLowerCase();
        const county = (chama.county || '').toLowerCase();
        const town = (chama.town || '').toLowerCase();
        return name.includes(searchLower) ||
               description.includes(searchLower) ||
               county.includes(searchLower) ||
               town.includes(searchLower);
      });
    }

  // Default sorting by recent (with null safety)
  filtered.sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
    const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
    return dateB - dateA;
  });

    setFilteredChamas(filtered);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getUserRole = (chama) => {
    // For now, return 'member' as default
    // In the future, this should be fetched from the chama membership data
    if (chama.createdBy === user?.id) {
      return 'chairperson';
    }
    return 'member';
  };





   const renderTableRow = ({ item, index }) => {
     // Handle null/undefined item
     if (!item) {
       return null;
     }
     
     const isContributionGroup = item.category === 'contribution';

     const typeConfig = isContributionGroup ? {
       color: colors.success,
       icon: 'heart',
       label: 'Contribution',
     } : {
       color: colors.primary,
       icon: 'people',
       label: 'Chama',
     };

     const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;

     return (
       <View style={[themedStyles.tableRow, { backgroundColor: rowBackgroundColor }]}>
         <View style={[themedStyles.tableCell, themedStyles.nameCell]}>
           <View style={themedStyles.nameContainer}>
             <View style={[themedStyles.typeIcon, { backgroundColor: typeConfig.color + '20' }]}>
               <Ionicons name={typeConfig.icon} size={16} color={typeConfig.color} />
             </View>
             <View>
               <Text style={[themedStyles.tableCellText, themedStyles.nameText]} numberOfLines={1}>
                 {item.name || 'Unnamed Chama'}
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
               onPress={() => navigation.navigate('ChamaDetails', { chamaId: item.id || '' })}
             >
               <Ionicons name="eye" size={10} color={colors.white} />
             </TouchableOpacity>
             <TouchableOpacity
               style={[themedStyles.actionButton, { backgroundColor: colors.secondary }]}
               onPress={() => switchToChamaDashboard(item)}
             >
               <Ionicons name="grid" size={10} color={colors.white} />
             </TouchableOpacity>
           </View>
         </View>
       </View>
     );
   };



  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No chamas found
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {searchQuery
          ? 'Try adjusting your search'
          : "You haven't joined any chamas yet"
        }
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '70%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '50%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '30%' }]} />
          </View>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '60%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '40%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '80%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '55%' }]} />
          </View>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '45%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '65%' }]} />
          </View>
          <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '75%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '35%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '50%' }]} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search and Filter Bar - Fixed Position */}
      <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <View style={[themedStyles.searchContainer, { flex: 1 }]}>
            <Ionicons name="search" size={14} color={colors.textSecondary} style={themedStyles.searchIcon} />
            <TextInput
              style={themedStyles.searchInput}
              placeholder="Search chamas..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.textSecondary}
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
              borderColor: colors.border,
              gap: spacing.xs,
            }]}
            onPress={() => setShowFilterDropdown(!showFilterDropdown)}
          >
            <Text style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.text }}>
              {categoryOptions.find(opt => opt.id === selectedCategory)?.name || 'All'}
            </Text>
            <Ionicons name={showFilterDropdown ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Dropdown Overlay */}
      {showFilterDropdown && (
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterDropdown(false)}
        />
      )}

      {/* Filter Dropdown */}
      {showFilterDropdown && (
        <View style={[{
          position: 'absolute',
          top: 80,
          right: spacing.md + 20,
          minWidth: 200,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 20,
          zIndex: 10000,
        }]}>
          {categoryOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                gap: spacing.sm,
                backgroundColor: selectedCategory === option.id ? colors.primary : 'transparent',
              }]}
              onPress={() => {
                setSelectedCategory(option.id);
                setShowFilterDropdown(false);
              }}
            >
              <Text style={[{
                flex: 1,
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.medium,
                color: selectedCategory === option.id ? colors.white : colors.text,
              }]}>
                {option.name}
              </Text>
              {selectedCategory === option.id && (
                <Ionicons name="checkmark" size={14} color={colors.white} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Table Container */}
      <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
        <Card
          variant="default"
          style={{
            borderRadius: 8,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: 'transparent',
            shadowOpacity: 0,
            shadowRadius: 0,
            shadowOffset: { width: 0, height: 0 },
            elevation: 0,
          }}
        >
          {/* Table Header */}
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

          {/* Table Body */}
          <FlatList
            data={filteredChamas}
            renderItem={renderTableRow}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={!loading && renderEmptyState()}
          />
        </Card>
      </View>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('CreateChama')}
      >
        <Ionicons name="add" size={24} color={colors.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const getResponsiveStyles = (isLargeScreen, screenWidth, numColumns, screenType, isCompactHeight, colors) => {
  // Calculate card width based on screen size and number of columns
  const getCardWidth = () => {
    if (numColumns === 1) {
      return '100%';
    } else {
      // For 2 columns: account for container padding and card margins
      const containerPadding = spacing.md * 2; // Left and right padding
      const cardMargin = screenType === 'desktop' ? spacing.lg : spacing.sm; // More margin on desktop
      const availableWidth = screenWidth - containerPadding - cardMargin;
      return availableWidth / numColumns;
    }
  };

  const cardWidth = getCardWidth();

  // Responsive sizing based on screen type
  const getResponsiveSizes = () => {
    switch (screenType) {
      case 'desktop':
        return {
          cardMinHeight: 220, // Taller cards for desktop
          titleFontSize: typography.fontSize.xl, // Larger title
          subtitleFontSize: typography.fontSize.base, // Larger subtitle
          avatarSize: 60, // Larger avatar
          padding: spacing.lg, // More padding
        };
      case 'tablet':
        return {
          cardMinHeight: 200,
          titleFontSize: typography.fontSize.lg,
          subtitleFontSize: typography.fontSize.sm,
          avatarSize: 55,
          padding: spacing.md,
        };
      default: // mobile
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
  loadingContainer: {
    flex: 1,
    padding: 16,
  },
  skeletonCard: {
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
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
    height: 36, // Compact search box
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
    paddingBottom: spacing.xxxl, // Extra space for FAB
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
    lineHeight: screenType === 'desktop' ? 28 : 24, // Better line height for readability
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
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  // Category Tabs Styles
  categoryTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: spacing.lg, // Increased bottom margin
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm, // Added vertical padding
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md, // Increased vertical padding
    paddingHorizontal: spacing.sm, // Increased horizontal padding
    margin: spacing.xs,
    borderRadius: borderRadius.lg, // Increased border radius
    borderWidth: 1,
    minHeight: 48, // Increased minimum height for better touch targets
  },
  categoryTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm, // Increased margin from icon
    textAlign: 'center',
  },
  // Filter Indicator Styles
  filterIndicator: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, // Increased vertical padding
    marginBottom: spacing.xs, // Added bottom margin
    alignItems: 'center',
  },
  filterIndicatorText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Category Badge Styles
  categoryBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    minWidth: 50, // Smaller minimum width
    maxWidth: 70, // Much smaller max width to prevent overlap
  },
  categoryBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Compact styles for devices with limited screen height
  compactSearchInput: {
    height: 32, // Reduced from 36px
    marginBottom: spacing.xs / 2, // Reduced margin
  },
  compactCategoryTabs: {
    marginTop: spacing.sm, // Reduced from spacing.lg
    marginBottom: spacing.sm, // Reduced bottom margin
    paddingVertical: spacing.xs, // Reduced padding
  },
  compactCategoryTab: {
    paddingVertical: spacing.sm, // Reduced from spacing.md
    paddingHorizontal: spacing.xs, // Reduced padding
    minHeight: 36, // Reduced from 48px
  },
  compactCategoryTabText: {
    fontSize: typography.fontSize.xs, // Smaller font
    marginLeft: spacing.xs, // Reduced margin
  },
  compactFiltersRow: {
    marginTop: spacing.xs / 2, // Reduced margin
  },
  compactFilterChip: {
    paddingHorizontal: spacing.xs, // Reduced padding
    paddingVertical: spacing.xs / 2, // Reduced padding
  },
  compactFilterText: {
    fontSize: typography.fontSize.xs - 1, // Even smaller font (11px)
    marginLeft: spacing.xs / 2, // Reduced margin
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

export default MyChamasScreen;