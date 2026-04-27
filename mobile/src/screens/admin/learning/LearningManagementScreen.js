import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import ApiService from '../../../services/api';
import useSmartNavigation from '../../../hooks/useSmartNavigation';
import BorderedButton from '../../../components/BorderedButton';
import { ButtonRow, ButtonColumn } from '../../../components/ButtonGroup';
import { useLightningData } from '../../../hooks/useLightningData';
import lightningDataService from '../../../services/lightningDataService';

const LearningManagementScreen = ({ navigation, route, onRouteChange }) => {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const { goBack } = useSmartNavigation();

  // REAL: Use Lightning Data for learning analytics
  const {
    data: learningAnalytics,
    loading: analyticsLoading,
    error: analyticsError,
    refresh: refreshAnalytics,
    source: analyticsSource,
  } = useLightningData('learning-analytics', { forceRefresh: false });

  const [categories, setCategories] = useState([]);
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalCategories: 0,
    publishedCourses: 0,
    draftCourses: 0,
    totalViews: 0,
    totalEnrollments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');

  // REAL: Local loading state for UI
  const [localLoading, setLocalLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const isActuallyLoading = localLoading && !dataReady;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadCategories(),
        loadCourses(),
        loadStats(),
      ]);
    } catch (error) {
      console.error('Failed to load learning management data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await ApiService.getLearningCategories();
      if (response.success) {
        setCategories(response.categories || []);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadCourses = async () => {
    try {
      const response = await ApiService.getLearningCourses({ limit: '50' });
      if (response.success) {
        setCourses(response.courses || []);
      }
    } catch (error) {
      console.error('Failed to load courses:', error);
    }
  };

  // REAL: Process learning analytics when it loads
  useEffect(() => {
    if (learningAnalytics && typeof learningAnalytics === 'object') {
      console.log('📚 REAL: Processing learning analytics from backend...');

      try {
        // Transform backend data to UI format
        const processedStats = {
          totalCategories: learningAnalytics.categories?.total || 0,
          totalCourses: learningAnalytics.courses?.total || 0,
          activeCategories: learningAnalytics.categories?.active || 0,
          inactiveCategories: learningAnalytics.categories?.inactive || 0,
          publishedCourses: learningAnalytics.courses?.published || 0,
          draftCourses: learningAnalytics.courses?.draft || 0,
          completionRate: learningAnalytics.summary?.completionRate || 0,
        };

        setStats(processedStats);
        setDataReady(true);
        setLocalLoading(false);

        console.log('✅ REAL: Learning analytics processed for UI:', processedStats);

      } catch (error) {
        console.error('❌ REAL: Error processing learning analytics:', error);
        setLocalLoading(false);
        setDataReady(false);
      }
    } else if (analyticsError) {
      console.error('❌ REAL: Learning analytics loading error:', analyticsError);
      setLocalLoading(false);
      setDataReady(false);
    }
  }, [learningAnalytics, analyticsError]);

  // REAL: Force immediate learning analytics loading on mount
  useEffect(() => {
    console.log('🚀 REAL: Triggering immediate learning analytics loading...');
    setLocalLoading(true);
    setDataReady(false);

    const loadImmediate = async () => {
      try {
        const result = await lightningDataService.getData('learning-analytics', {
          forceRefresh: true,
          immediate: true
        });

        console.log('🔍 REAL: Immediate learning analytics load result:', {
          success: result.success,
          hasData: !!result.data,
          source: result.source,
          error: result.error || 'none'
        });

        if (result.success && result.data) {
          console.log('⚡ REAL: Got learning analytics immediately');
        } else {
          console.error('❌ REAL: Immediate learning analytics load failed:', result.error);
          // Fallback to old method
          loadStats();
        }
      } catch (error) {
        console.error('❌ REAL: Immediate learning analytics load failed:', error.message);
        // Fallback to old method
        loadStats();
      }
    };

    loadImmediate();
  }, []);

  const loadStats = async () => {
    try {
      // Fallback: Calculate stats from loaded data
      const publishedCourses = courses.filter(c => c.status === 'published').length;
      const draftCourses = courses.filter(c => c.status === 'draft').length;
      const totalViews = courses.reduce((sum, c) => sum + (c.view_count || 0), 0);

      setStats({
        totalCourses: courses.length,
        totalCategories: categories.length,
        publishedCourses,
        draftCourses,
        totalViews,
        totalEnrollments: 0, // This would come from user progress data
      });

      setDataReady(true);
      setLocalLoading(false);
    } catch (error) {
      console.error('Failed to calculate stats:', error);
      setLocalLoading(false);
      setDataReady(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCreateCategory = () => {
    // Navigate to create category screen
    if (onRouteChange) {
      onRouteChange('create-category', 'Create Category');
    } else {
      navigation.navigate('CreateLearningCategoryScreen');
    }
  };

  const handleCreateCourse = () => {
    // Navigate to create course screen
    if (onRouteChange) {
      onRouteChange('create-course', 'Create Course');
    } else {
      navigation.navigate('CreateLearningCourseScreen');
    }
  };

  const handleEditCategory = (category) => {
    navigation.navigate('EditLearningCategory', { categoryId: category.id });
  };

  const handleEditCourse = (course) => {
    navigation.navigate('EditLearningCourse', { courseId: course.id });
  };

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <ButtonRow spacing={4} justify="space-between">
        {[
          { id: 'overview', title: 'Overview', icon: 'analytics' },
          { id: 'categories', title: 'Categories', icon: 'folder' },
          { id: 'courses', title: 'Courses', icon: 'book' },
        ].map((tab) => (
          <BorderedButton
            key={tab.id}
            title={tab.title}
            icon={tab.icon}
            variant={selectedTab === tab.id ? 'primary' : 'secondary'}
            size="auto"
            onPress={() => setSelectedTab(tab.id)}
            theme={theme}
            style={styles.tabButtonBordered}
          />
        ))}
      </ButtonRow>
    </View>
  );

  const renderStatsCard = (title, value, icon, color) => (
    <Card style={styles.statsCard}>
      <View style={styles.statsContent}>
        <View style={[styles.statsIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <View style={styles.statsText}>
          <Text style={[styles.statsValue, { color: colors.text }]}>{value}</Text>
          <Text style={[styles.statsTitle, { color: colors.textSecondary }]}>{title}</Text>
        </View>
      </View>
    </Card>
  );

  const renderOverview = () => (
    <View style={styles.tabContent}>
      {/* Learning Overview - User Dashboard Style */}
      <Card style={styles.userDashboardStatsCard}>
        <View style={styles.userDashboardStatsGrid}>
          <View style={[styles.userDashboardStatTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.userDashboardStatTileHeader}>
              <View style={[styles.userDashboardStatTileIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="book" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.userDashboardStatTileLabel, { color: colors.textSecondary }]}>
                Total Courses
              </Text>
            </View>
            <Text style={[styles.userDashboardStatTileValue, { color: colors.text }]}>
              {stats.totalCourses}
            </Text>
          </View>

          <View style={[styles.userDashboardStatTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.userDashboardStatTileHeader}>
              <View style={[styles.userDashboardStatTileIcon, { backgroundColor: colors.info + '15' }]}>
                <Ionicons name="folder" size={20} color={colors.info} />
              </View>
              <Text style={[styles.userDashboardStatTileLabel, { color: colors.textSecondary }]}>
                Categories
              </Text>
            </View>
            <Text style={[styles.userDashboardStatTileValue, { color: colors.text }]}>
              {stats.totalCategories}
            </Text>
          </View>

          <View style={[styles.userDashboardStatTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.userDashboardStatTileHeader}>
              <View style={[styles.userDashboardStatTileIcon, { backgroundColor: colors.success + '15' }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              </View>
              <Text style={[styles.userDashboardStatTileLabel, { color: colors.textSecondary }]}>
                Published
              </Text>
            </View>
            <Text style={[styles.userDashboardStatTileValue, { color: colors.text }]}>
              {stats.publishedCourses}
            </Text>
          </View>

          <View style={[styles.userDashboardStatTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.userDashboardStatTileHeader}>
              <View style={[styles.userDashboardStatTileIcon, { backgroundColor: colors.warning + '15' }]}>
                <Ionicons name="create" size={20} color={colors.warning} />
              </View>
              <Text style={[styles.userDashboardStatTileLabel, { color: colors.textSecondary }]}>
                Drafts
              </Text>
            </View>
            <Text style={[styles.userDashboardStatTileValue, { color: colors.text }]}>
              {stats.draftCourses}
            </Text>
          </View>

          <View style={[styles.userDashboardStatTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.userDashboardStatTileHeader}>
              <View style={[styles.userDashboardStatTileIcon, { backgroundColor: colors.error + '15' }]}>
                <Ionicons name="eye" size={20} color={colors.error} />
              </View>
              <Text style={[styles.userDashboardStatTileLabel, { color: colors.textSecondary }]}>
                Total Views
              </Text>
            </View>
            <Text style={[styles.userDashboardStatTileValue, { color: colors.text }]}>
              {stats.totalViews}
            </Text>
          </View>

          <View style={[styles.userDashboardStatTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.userDashboardStatTileHeader}>
              <View style={[styles.userDashboardStatTileIcon, { backgroundColor: (colors.purple || colors.info) + '15' }]}>
                <Ionicons name="people" size={20} color={colors.purple || colors.info} />
              </View>
              <Text style={[styles.userDashboardStatTileLabel, { color: colors.textSecondary }]}>
                Enrollments
              </Text>
            </View>
            <Text style={[styles.userDashboardStatTileValue, { color: colors.text }]}>
              {stats.totalEnrollments}
            </Text>
          </View>
        </View>
      </Card>

      <View style={styles.quickActions}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>

        <ButtonRow spacing={8} justify="space-between">
          <BorderedButton
            title="Create Course"
            icon="add"
            variant="primary"
            size="small"
            onPress={handleCreateCourse}
            theme={theme}
            style={styles.quickActionButton}
          />
          <BorderedButton
            title="Create Category"
            icon="folder-open"
            variant="info"
            size="small"
            onPress={handleCreateCategory}
            theme={theme}
            style={styles.quickActionButton}
          />
        </ButtonRow>
      </View>
    </View>
  );

  const renderCategoryCard = (category, index) => (
    <TouchableOpacity
      key={category.id}
      style={[styles.gridItem, { marginRight: index % 2 === 0 ? spacing.sm : 0 }]}
      onPress={() => handleEditCategory(category)}
    >
      <Card style={styles.gridCard}>
        <View style={styles.gridItemContent}>
          <View style={[styles.categoryIconGrid, { backgroundColor: (category.color || colors.primary) + '20' }]}>
            <Ionicons
              name={category.icon || 'folder'}
              size={28}
              color={category.color || colors.primary}
            />
          </View>
          <Text style={[styles.gridItemTitle, { color: colors.text }]} numberOfLines={2}>
            {category.name}
          </Text>
          <Text style={[styles.gridItemSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {category.description || 'No description'}
          </Text>
          <View style={[styles.statusBadgeGrid, {
            backgroundColor: category.is_active ? colors.success + '20' : colors.error + '20'
          }]}>
            <Text style={[styles.statusTextGrid, {
              color: category.is_active ? colors.success : colors.error
            }]}>
              {category.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderCategories = () => (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Categories ({categories.length})
        </Text>
        <BorderedButton
          icon="add"
          iconPosition="only"
          variant="primary"
          size="auto"
          onPress={handleCreateCategory}
          theme={theme}
          style={styles.addButtonBordered}
        />
      </View>

      <View style={[styles.categoriesCard, { backgroundColor: colors.surface }]}>
        {categories.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
              No categories yet
            </Text>
            <Text style={[styles.emptyStateDescription, { color: colors.textSecondary }]}>
              Create your first learning category to organize courses
            </Text>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {categories.map((category, index) => renderCategoryCard(category, index))}
          </View>
        )}
      </View>
    </View>
  );

  const renderCourseCard = (course, index) => (
    <TouchableOpacity
      key={course.id}
      style={[styles.gridItem, { marginRight: index % 2 === 0 ? spacing.sm : 0 }]}
      onPress={() => handleEditCourse(course)}
    >
      <Card style={styles.gridCard}>
        <View style={styles.gridItemContent}>
          <View style={[styles.courseIconGrid, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons
              name={course.type === 'video' ? 'play-circle' : course.type === 'quiz' ? 'help-circle' : 'document-text'}
              size={28}
              color={colors.primary}
            />
          </View>
          <Text style={[styles.gridItemTitle, { color: colors.text }]} numberOfLines={2}>
            {course.title}
          </Text>
          <Text style={[styles.gridItemSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {course.category_name} • {course.level}
          </Text>
          <Text style={[styles.gridItemMeta, { color: colors.textTertiary }]} numberOfLines={1}>
            {course.view_count || 0} views
          </Text>
          <View style={[styles.statusBadgeGrid, {
            backgroundColor: course.status === 'published' ? colors.success + '20' :
                           course.status === 'draft' ? colors.warning + '20' : colors.error + '20'
          }]}>
            <Text style={[styles.statusTextGrid, {
              color: course.status === 'published' ? colors.success :
                     course.status === 'draft' ? colors.warning : colors.error
            }]}>
              {course.status.charAt(0).toUpperCase() + course.status.slice(1)}
            </Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderCourses = () => (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Courses ({courses.length})
        </Text>
        <BorderedButton
          icon="add"
          iconPosition="only"
          variant="primary"
          size="auto"
          onPress={handleCreateCourse}
          theme={theme}
          style={styles.addButtonBordered}
        />
      </View>

      <View style={[styles.coursesCard, { backgroundColor: colors.surface }]}>
        {courses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
              No courses yet
            </Text>
            <Text style={[styles.emptyStateDescription, { color: colors.textSecondary }]}>
              Create your first learning course to start educating users
            </Text>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {courses.map((course, index) => renderCourseCard(course, index))}
          </View>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading learning management...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {renderTabBar()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'categories' && renderCategories()}
        {selectedTab === 'courses' && renderCourses()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  tabContent: {
    paddingHorizontal: spacing.lg,
  },
  statsContainer: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xs, // Add some padding for better spacing
  },
  statsCard: {
    width: '48%',
    marginBottom: spacing.lg, // Increase bottom margin for better spacing
    minHeight: 90, // Increase height for better proportions
  },
  statsContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    height: '100%',
  },
  statsIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  statsText: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsValue: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  statsTitle: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    opacity: 0.8,
  },
  quickActions: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  overviewCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  categoriesCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  coursesCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  statCard: {
    width: '47%',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  actionButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItem: {
    marginBottom: spacing.sm,
  },
  listCard: {
    padding: spacing.md,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  courseIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  listItemText: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  listItemSubtitle: {
    fontSize: typography.fontSize.sm,
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
  emptyStateTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyStateDescription: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Grid layout styles
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  gridItem: {
    width: '48%', // 2 items per row with some spacing
    marginBottom: spacing.md,
  },
  gridCard: {
    padding: spacing.md,
    height: 180, // Fixed height for consistent grid
  },
  gridItemContent: {
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
  },
  categoryIconGrid: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  courseIconGrid: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  gridItemTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
    marginBottom: spacing.xs,
    minHeight: 40, // Ensure consistent spacing
  },
  gridItemSubtitle: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.xs,
    minHeight: 32, // Ensure consistent spacing
  },
  gridItemMeta: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  statusBadgeGrid: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'center',
  },
  statusTextGrid: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
  },
  // Quick actions grid styles
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  actionButtonGrid: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: 100,
  },
  actionButtonTextGrid: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  // User Dashboard Style Stats
  userDashboardStatsCard: {
    margin: spacing.md,
  },
  userDashboardStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  userDashboardStatTile: {
    width: '48%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  userDashboardStatTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  userDashboardStatTileIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  userDashboardStatTileLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  userDashboardStatTileValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'left',
  },
  // BorderedButton styles - RESPONSIVE
  tabButtonBordered: {
    flex: 1,
    marginHorizontal: 1,
    maxWidth: 120,
  },
  quickActionButton: {
    flex: 1,
    maxWidth: 160,
  },
  addButtonBordered: {
    width: 32,
    height: 32,
    minWidth: 28,
    maxWidth: 36,
  },
});

export default LearningManagementScreen;
