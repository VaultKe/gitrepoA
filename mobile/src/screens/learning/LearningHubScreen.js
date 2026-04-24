import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { useLightningData } from '../../hooks/useLightningData';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import Card from '../../components/common/Card';
import ApiService from '../../services/api';

const LearningHubScreen = ({ navigation }) => {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState([]);
  const [courses, setCourses] = useState([]);
  const [featuredCourses, setFeaturedCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadCourses();
  }, [selectedCategory]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadCategories(),
        loadCourses(),
        loadFeaturedCourses(),
      ]);
    } catch (error) {
      console.error('Failed to load learning data:', error);
      Alert.alert('Error', 'Failed to load learning content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await ApiService.getLearningCategories();
      if (response.success) {
        const allCategory = { id: 'all', name: 'All', icon: 'library', color: '#6366f1' };
        setCategories([allCategory, ...response.categories]);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadCourses = async () => {
    try {
      const params = {};
      if (selectedCategory !== 'all') {
        params.category_id = selectedCategory;
      }

      const response = await ApiService.getLearningCourses(params);
      if (response.success) {
        setCourses(response.courses || []);
      }
    } catch (error) {
      console.error('Failed to load courses:', error);
    }
  };

  const loadFeaturedCourses = async () => {
    try {
      const response = await ApiService.getLearningCourses({ featured: 'true', limit: '3' });
      if (response.success) {
        setFeaturedCourses(response.courses || []);
      }
    } catch (error) {
      console.error('Failed to load featured courses:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getContentIcon = (type) => {
    switch (type) {
      case 'video': return 'play-circle';
      case 'quiz': return 'help-circle';
      case 'article': return 'document-text';
      case 'course': return 'school';
      default: return 'book';
    }
  };

  const getContentColor = (type) => {
    switch (type) {
      case 'video': return colors.error;
      case 'quiz': return colors.warning;
      case 'article': return colors.info;
      case 'course': return colors.primary;
      default: return colors.primary;
    }
  };

  const getLevelColor = (level) => {
    const normalizedLevel = level?.toLowerCase();
    switch (normalizedLevel) {
      case 'beginner': return colors.success;
      case 'intermediate': return colors.warning;
      case 'advanced': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const formatDuration = (course) => {
    if (course.estimated_read_time) {
      return course.estimated_read_time;
    }
    if (course.duration_minutes) {
      return `${course.duration_minutes} min`;
    }
    return 'Quick read';
  };

  const handleContentPress = async (course) => {
    try {
      // Navigate to course detail screen or start course
      navigation.navigate('CourseDetail', { courseId: course.id });
    } catch (error) {
      console.error('Failed to open course:', error);
      Alert.alert('Error', 'Failed to open course. Please try again.');
    }
  };

  const handleStartCourse = async (course) => {
    try {
      const response = await ApiService.startCourse(course.id);
      if (response.success) {
        Alert.alert('Success', 'Course started successfully!', [
          { text: 'Continue', onPress: () => handleContentPress(course) }
        ]);
      } else {
        throw new Error(response.error || 'Failed to start course');
      }
    } catch (error) {
      console.error('Failed to start course:', error);
      Alert.alert('Error', error.message || 'Failed to start course. Please try again.');
    }
  };

  const renderCategoryFilter = () => (
    <View style={styles.categoriesContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryButton,
              {
                backgroundColor: selectedCategory === category.id ? colors.primary : colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <Ionicons
              name={category.icon || 'book'}
              size={20}
              color={selectedCategory === category.id ? colors.white : colors.text}
            />
            <Text
              style={[
                styles.categoryText,
                {
                  color: selectedCategory === category.id ? colors.white : colors.text,
                },
              ]}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderContentCard = (course) => (
    <TouchableOpacity
      key={course.id}
      style={styles.contentCard}
      onPress={() => handleContentPress(course)}
    >
      <Card style={styles.cardContainer}>
        <View style={styles.contentHeader}>
          <View style={[styles.contentTypeIcon, { backgroundColor: getContentColor(course.type) + '20' }]}>
            <Ionicons
              name={getContentIcon(course.type)}
              size={24}
              color={getContentColor(course.type)}
            />
          </View>
          <View style={styles.contentMeta}>
            <View style={[styles.levelBadge, { backgroundColor: getLevelColor(course.level) + '20' }]}>
              <Text style={[styles.levelText, { color: getLevelColor(course.level) }]}>
                {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
              </Text>
            </View>
            <Text style={[styles.durationText, { color: colors.textSecondary }]}>
              {formatDuration(course)}
            </Text>
          </View>
        </View>

        <View style={styles.titleRow}>
          <Text style={[styles.contentTitle, { color: colors.text }]}>
            {course.title}
          </Text>
          {course.is_featured && (
            <View style={[styles.featuredBadge, { backgroundColor: colors.warning + '20' }]}>
              <Ionicons name="star" size={12} color={colors.warning} />
            </View>
          )}
        </View>

        <Text style={[styles.contentDescription, { color: colors.textSecondary }]}>
          {course.description}
        </Text>

        {course.category_name && (
          <Text style={[styles.categoryLabel, { color: colors.textTertiary }]}>
            {course.category_name}
          </Text>
        )}

        <View style={styles.contentFooter}>
          <View style={styles.contentType}>
            <Ionicons
              name={getContentIcon(course.type)}
              size={16}
              color={colors.textTertiary}
            />
            <Text style={[styles.typeText, { color: colors.textTertiary }]}>
              {course.type.charAt(0).toUpperCase() + course.type.slice(1)}
            </Text>
            {course.view_count > 0 && (
              <Text style={[styles.viewCount, { color: colors.textTertiary }]}>
                • {course.view_count} views
              </Text>
            )}
          </View>

          {course.user_progress ? (
            <View style={styles.progressContainer}>
              <Text style={[styles.progressText, { color: colors.primary }]}>
                {Math.round(course.user_progress.progress_percentage)}%
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: colors.primary }]}
              onPress={(e) => {
                e.stopPropagation();
                handleStartCourse(course);
              }}
            >
              <Text style={[styles.startButtonText, { color: colors.white }]}>
                Start
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );

  // Header is now handled by the navigation system with SmartHeader

  const renderFeaturedSection = () => {
    if (featuredCourses.length === 0) return null;

    const featuredCourse = featuredCourses[0];

    return (
      <Card style={styles.featuredCard}>
        <View style={styles.featuredContent}>
          <View style={[styles.featuredIcon, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name={getContentIcon(featuredCourse.type)} size={32} color={colors.primary} />
          </View>
          <View style={styles.featuredText}>
            <Text style={[styles.featuredTitle, { color: colors.text }]}>
              {featuredCourse.title}
            </Text>
            <Text style={[styles.featuredDescription, { color: colors.textSecondary }]}>
              {featuredCourse.description}
            </Text>
            <View style={styles.featuredMeta}>
              <Text style={[styles.featuredLevel, { color: colors.primary }]}>
                {featuredCourse.level.charAt(0).toUpperCase() + featuredCourse.level.slice(1)}
              </Text>
              <Text style={[styles.featuredDuration, { color: colors.textTertiary }]}>
                • {formatDuration(featuredCourse)}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.featuredButton, { backgroundColor: colors.primary }]}
          onPress={() => handleContentPress(featuredCourse)}
        >
          <Text style={[styles.featuredButtonText, { color: colors.white }]}>
            {featuredCourse.user_progress ? 'Continue' : 'Start Course'}
          </Text>
        </TouchableOpacity>
      </Card>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading learning content...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}
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
        {renderFeaturedSection()}
        {categories.length > 0 && renderCategoryFilter()}

        <View style={styles.contentSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {selectedCategory === 'all'
              ? 'All Courses'
              : categories.find(c => c.id === selectedCategory)?.name || 'Courses'
            }
          </Text>

          {courses.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={64} color={colors.textTertiary} />
              <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
                No courses available
              </Text>
              <Text style={[styles.emptyStateDescription, { color: colors.textSecondary }]}>
                {selectedCategory === 'all'
                  ? 'Check back later for new learning content.'
                  : 'No courses found in this category. Try selecting a different category.'
                }
              </Text>
            </View>
          ) : (
            courses.map(renderContentCard)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.base,
  },
  featuredCard: {
    margin: spacing.lg,
    marginTop: 0,
  },
  featuredContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  featuredIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  featuredText: {
    flex: 1,
  },
  featuredTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  featuredDescription: {
    fontSize: typography.fontSize.sm,
  },
  featuredButton: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  featuredButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  categoriesContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  categoryText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  contentSection: {
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  contentCard: {
    marginBottom: spacing.md,
  },
  cardContainer: {
    padding: spacing.lg,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  contentTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentMeta: {
    alignItems: 'flex-end',
  },
  levelBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  levelText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  durationText: {
    fontSize: typography.fontSize.xs,
  },
  contentTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  contentDescription: {
    fontSize: typography.fontSize.base,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  contentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contentType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.xs,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  featuredBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  categoryLabel: {
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.sm,
    fontWeight: typography.fontWeight.medium,
  },
  viewCount: {
    fontSize: typography.fontSize.xs,
    marginLeft: spacing.xs,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginRight: spacing.xs,
  },
  startButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  startButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  featuredMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  featuredLevel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  featuredDuration: {
    fontSize: typography.fontSize.sm,
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
});

export default LearningHubScreen;
