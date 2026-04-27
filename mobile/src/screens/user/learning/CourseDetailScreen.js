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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import ApiService from '../../../services/api';

const CourseDetailScreen = ({ navigation, route }) => {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  // Debug route parameters
  console.log('📚 CourseDetailScreen route params:', route?.params);

  // Safe parameter extraction with fallback
  const courseId = route?.params?.courseId;

  // If no courseId, navigate back to learning dashboard
  useEffect(() => {
    if (!courseId) {
      console.warn('⚠️ No courseId provided to CourseDetailScreen');
      // Navigate back to learning hub instead of crashing
      navigation.navigate('UserTabs', { screen: 'Learn' });
      return;
    }
  }, [courseId, navigation]);

  // Early return if no courseId to prevent further errors
  if (!courseId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            Loading course...
          </Text>
        </View>
      </View>
    );
  }

  const [course, setCourse] = useState(null);
  const [userProgress, setUserProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    loadCourseDetail();
  }, [courseId]);

  const loadCourseDetail = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getLearningCourse(courseId);
      if (response.success) {
        setCourse(response.course);
        setUserProgress(response.course.user_progress);
      } else {
        throw new Error(response.error || 'Failed to load course');
      }
    } catch (error) {
      console.error('Failed to load course detail:', error);
      Alert.alert('Error', 'Failed to load course details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartCourse = async () => {
    try {
      setStarting(true);
      const response = await ApiService.startCourse(courseId);
      if (response.success) {
        await loadCourseDetail(); // Reload to get updated progress
        navigateToContent();
      } else {
        throw new Error(response.error || 'Failed to start course');
      }
    } catch (error) {
      console.error('Failed to start course:', error);
      Alert.alert('Error', error.message || 'Failed to start course. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const navigateToContent = () => {
    if (!course) return;

    switch (course.type) {
      case 'quiz':
        navigation.navigate('QuizTaking', { course });
        break;
      case 'video':
        navigation.navigate('VideoPlayer', { course });
        break;
      case 'article':
        navigation.navigate('ArticleReader', { course });
        break;
      case 'course':
        navigation.navigate('CourseNavigation', { course });
        break;
      default:
        Alert.alert('Error', 'Unknown course type');
    }
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

  const getLevelColor = (level) => {
    switch (level) {
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

  const parseStructuredContent = (content) => {
    try {
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  };

  const renderCourseContent = () => {
    if (!course.content) return null;

    // Try to parse structured content
    const structuredContent = parseStructuredContent(course.content);

    if (structuredContent && structuredContent.type) {
      switch (structuredContent.type) {
        case 'quiz':
          return renderQuizPreview(structuredContent);
        case 'article':
          return renderArticlePreview(structuredContent);
        case 'course':
          return renderCourseStructurePreview(structuredContent);
        default:
          return renderBasicContent();
      }
    }

    // Handle specific content types based on course type
    switch (course.type) {
      case 'video':
        return renderVideoPreview();
      case 'quiz':
        return renderQuizPreview({ questions: course.quiz_questions || [] });
      case 'article':
        return renderArticlePreview(course.article_content);
      case 'course':
        return renderCourseStructurePreview(course.course_structure);
      default:
        return renderBasicContent();
    }
  };

  const renderBasicContent = () => (
    <Card style={styles.contentCard}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Course Content
      </Text>
      <Text style={[styles.contentText, { color: colors.textSecondary }]}>
        {course.content}
      </Text>
    </Card>
  );

  const renderVideoPreview = () => (
    <Card style={styles.contentCard}>
      <View style={styles.videoPreviewHeader}>
        <Ionicons name="videocam" size={24} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.text, marginLeft: spacing.sm }]}>
          Video Lesson
        </Text>
      </View>
      {course.video_url ? (
        <View style={styles.videoPreview}>
          <View style={[styles.videoThumbnail, { backgroundColor: colors.surface }]}>
            <Ionicons name="play-circle" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.videoDescription, { color: colors.textSecondary }]}>
            {course.content || 'Watch this video lesson to learn more.'}
          </Text>
        </View>
      ) : (
        <Text style={[styles.contentText, { color: colors.textSecondary }]}>
          {course.content || 'Video content will be available soon.'}
        </Text>
      )}
    </Card>
  );

  const renderQuizPreview = (quizData) => {
    const questions = quizData?.questions || course.quiz_questions || [];

    return (
      <Card style={styles.contentCard}>
        <View style={styles.quizPreviewHeader}>
          <Ionicons name="help-circle" size={24} color={colors.warning} />
          <Text style={[styles.sectionTitle, { color: colors.text, marginLeft: spacing.sm }]}>
            Quiz Assessment
          </Text>
        </View>

        {quizData?.description && (
          <Text style={[styles.contentText, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            {quizData.description}
          </Text>
        )}

        <View style={styles.quizStats}>
          <View style={styles.quizStat}>
            <Text style={[styles.quizStatNumber, { color: colors.primary }]}>
              {questions.length}
            </Text>
            <Text style={[styles.quizStatLabel, { color: colors.textSecondary }]}>
              Questions
            </Text>
          </View>

          {course.duration_minutes && (
            <View style={styles.quizStat}>
              <Text style={[styles.quizStatNumber, { color: colors.warning }]}>
                {course.duration_minutes}
              </Text>
              <Text style={[styles.quizStatLabel, { color: colors.textSecondary }]}>
                Minutes
              </Text>
            </View>
          )}
        </View>

        {questions.length > 0 && (
          <View style={styles.sampleQuestion}>
            <Text style={[styles.sampleQuestionLabel, { color: colors.textTertiary }]}>
              Sample Question:
            </Text>
            <Text style={[styles.sampleQuestionText, { color: colors.text }]}>
              {questions[0].question}
            </Text>
          </View>
        )}
      </Card>
    );
  };

  const renderArticlePreview = (articleData) => {
    const sections = articleData?.sections || [];

    return (
      <Card style={styles.contentCard}>
        <View style={styles.articlePreviewHeader}>
          <Ionicons name="document-text" size={24} color={colors.info} />
          <Text style={[styles.sectionTitle, { color: colors.text, marginLeft: spacing.sm }]}>
            Article Content
          </Text>
        </View>

        {articleData?.headline_image && (
          <View style={styles.headlineImageContainer}>
            <Text style={[styles.headlineImageLabel, { color: colors.textTertiary }]}>
              Featured Image Available
            </Text>
          </View>
        )}

        <View style={styles.articleStats}>
          <View style={styles.articleStat}>
            <Text style={[styles.articleStatNumber, { color: colors.info }]}>
              {sections.length}
            </Text>
            <Text style={[styles.articleStatLabel, { color: colors.textSecondary }]}>
              Sections
            </Text>
          </View>

          <View style={styles.articleStat}>
            <Text style={[styles.articleStatNumber, { color: colors.success }]}>
              {course.estimated_read_time || '5 min'}
            </Text>
            <Text style={[styles.articleStatLabel, { color: colors.textSecondary }]}>
              Read Time
            </Text>
          </View>
        </View>

        {sections.length > 0 && (
          <View style={styles.sectionPreview}>
            <Text style={[styles.sectionPreviewLabel, { color: colors.textTertiary }]}>
              Article Outline:
            </Text>
            {sections.slice(0, 3).map((section, index) => (
              <View key={index} style={styles.sectionPreviewItem}>
                <Text style={[styles.sectionPreviewText, { color: colors.text }]}>
                  {section.heading || `Section ${index + 1}`}
                </Text>
              </View>
            ))}
            {sections.length > 3 && (
              <Text style={[styles.moreSectionsText, { color: colors.textSecondary }]}>
                +{sections.length - 3} more sections
              </Text>
            )}
          </View>
        )}
      </Card>
    );
  };

  const renderCourseStructurePreview = (courseData) => {
    const topics = courseData?.topics || [];

    return (
      <Card style={styles.contentCard}>
        <View style={styles.coursePreviewHeader}>
          <Ionicons name="school" size={24} color={colors.success} />
          <Text style={[styles.sectionTitle, { color: colors.text, marginLeft: spacing.sm }]}>
            Course Structure
          </Text>
        </View>

        {courseData?.outline && (
          <Text style={[styles.contentText, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            {courseData.outline}
          </Text>
        )}

        <View style={styles.courseStats}>
          <View style={styles.courseStat}>
            <Text style={[styles.courseStatNumber, { color: colors.success }]}>
              {topics.length}
            </Text>
            <Text style={[styles.courseStatLabel, { color: colors.textSecondary }]}>
              Topics
            </Text>
          </View>

          <View style={styles.courseStat}>
            <Text style={[styles.courseStatNumber, { color: colors.primary }]}>
              {topics.reduce((total, topic) => total + (topic.subtopics?.length || 0), 0)}
            </Text>
            <Text style={[styles.courseStatLabel, { color: colors.textSecondary }]}>
              Subtopics
            </Text>
          </View>
        </View>

        {topics.length > 0 && (
          <View style={styles.topicsPreview}>
            <Text style={[styles.topicsPreviewLabel, { color: colors.textTertiary }]}>
              Course Topics:
            </Text>
            {topics.slice(0, 3).map((topic, index) => (
              <View key={index} style={styles.topicPreviewItem}>
                <Text style={[styles.topicPreviewTitle, { color: colors.text }]}>
                  {topic.title}
                </Text>
                {topic.subtopics && topic.subtopics.length > 0 && (
                  <Text style={[styles.topicPreviewSubtopics, { color: colors.textSecondary }]}>
                    {topic.subtopics.length} subtopic{topic.subtopics.length !== 1 ? 's' : ''}
                  </Text>
                )}
              </View>
            ))}
            {topics.length > 3 && (
              <Text style={[styles.moreTopicsText, { color: colors.textSecondary }]}>
                +{topics.length - 3} more topics
              </Text>
            )}
          </View>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading course...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!course) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Course Not Found
          </Text>
          <Text style={[styles.errorDescription, { color: colors.textSecondary }]}>
            The course you're looking for could not be found.
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backButtonText, { color: colors.white }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Course Header */}
        <Card style={styles.courseHeader}>
          <View style={styles.courseHeaderContent}>
            <View style={[styles.courseIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons
                name={getContentIcon(course.type)}
                size={32}
                color={colors.primary}
              />
            </View>
            <View style={styles.courseMeta}>
              <View style={[styles.levelBadge, { backgroundColor: getLevelColor(course.level) + '20' }]}>
                <Text style={[styles.levelText, { color: getLevelColor(course.level) }]}>
                  {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
                </Text>
              </View>
              <Text style={[styles.durationText, { color: colors.textSecondary }]}>
                {formatDuration(course)}
              </Text>
              {course.is_featured && (
                <View style={[styles.featuredBadge, { backgroundColor: colors.warning + '20' }]}>
                  <Ionicons name="star" size={12} color={colors.warning} />
                  <Text style={[styles.featuredText, { color: colors.warning }]}>Featured</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={[styles.courseTitle, { color: colors.text }]}>
            {course.title}
          </Text>

          <Text style={[styles.courseDescription, { color: colors.textSecondary }]}>
            {course.description}
          </Text>

          {course.category_name && (
            <Text style={[styles.categoryLabel, { color: colors.textTertiary }]}>
              Category: {course.category_name}
            </Text>
          )}

          {/* Progress Bar */}
          {userProgress && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, { color: colors.text }]}>
                  Progress
                </Text>
                <Text style={[styles.progressPercentage, { color: colors.primary }]}>
                  {Math.round(userProgress.progress_percentage)}%
                </Text>
              </View>
              <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.primary,
                      width: `${userProgress.progress_percentage}%`,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </Card>

        {/* Course Content */}
        {renderCourseContent()}

        {/* Learning Objectives */}
        {course.learning_objectives && course.learning_objectives.length > 0 && (
          <Card style={styles.objectivesCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              What You'll Learn
            </Text>
            {course.learning_objectives.map((objective, index) => (
              <View key={index} style={styles.objectiveItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={[styles.objectiveText, { color: colors.text }]}>
                  {objective}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Prerequisites */}
        {course.prerequisites && course.prerequisites.length > 0 && (
          <Card style={styles.prerequisitesCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Prerequisites
            </Text>
            {course.prerequisites.map((prereq, index) => (
              <View key={index} style={styles.prerequisiteItem}>
                <Ionicons name="school" size={16} color={colors.info} />
                <Text style={[styles.prerequisiteText, { color: colors.text }]}>
                  {prereq}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Tags */}
        {course.tags && course.tags.length > 0 && (
          <Card style={styles.tagsCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Tags
            </Text>
            <View style={styles.tagsContainer}>
              {course.tags.map((tag, index) => (
                <View key={index} style={[styles.tag, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.tagText, { color: colors.primary }]}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Action Button */}
        <View style={styles.actionSection}>
          {userProgress ? (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={navigateToContent}
            >
              <Text style={[styles.actionButtonText, { color: colors.white }]}>
                Continue Course
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={handleStartCourse}
              disabled={starting}
            >
              {starting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={[styles.actionButtonText, { color: colors.white }]}>
                  Start Course
                </Text>
              )}
            </TouchableOpacity>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  errorDescription: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerBackButton: {
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  courseHeader: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  courseHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  courseIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  courseMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  levelBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
  },
  levelText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  durationText: {
    fontSize: typography.fontSize.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  featuredText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  courseTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  courseDescription: {
    fontSize: typography.fontSize.base,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  categoryLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.md,
  },
  progressSection: {
    marginTop: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  progressPercentage: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  contentCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  objectivesCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  prerequisitesCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  tagsCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  contentText: {
    fontSize: typography.fontSize.base,
    lineHeight: 22,
  },
  objectiveItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  objectiveText: {
    fontSize: typography.fontSize.base,
    marginLeft: spacing.sm,
    flex: 1,
  },
  prerequisiteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  prerequisiteText: {
    fontSize: typography.fontSize.base,
    marginLeft: spacing.sm,
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  tagText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  actionSection: {
    marginTop: spacing.lg,
  },
  actionButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  // Content Preview Styles
  videoPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  videoPreview: {
    alignItems: 'center',
  },
  videoThumbnail: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  videoDescription: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 22,
  },
  quizPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  quizStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  quizStat: {
    alignItems: 'center',
  },
  quizStatNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  quizStatLabel: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  sampleQuestion: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  sampleQuestionLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  sampleQuestionText: {
    fontSize: typography.fontSize.base,
    lineHeight: 22,
  },
  articlePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headlineImageContainer: {
    marginBottom: spacing.md,
  },
  headlineImageLabel: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },
  articleStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  articleStat: {
    alignItems: 'center',
  },
  articleStatNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  articleStatLabel: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  sectionPreview: {
    marginTop: spacing.md,
  },
  sectionPreviewLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  sectionPreviewItem: {
    paddingVertical: spacing.xs,
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(0,0,0,0.1)',
    marginBottom: spacing.xs,
  },
  sectionPreviewText: {
    fontSize: typography.fontSize.base,
  },
  moreSectionsText: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  coursePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  courseStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  courseStat: {
    alignItems: 'center',
  },
  courseStatNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  courseStatLabel: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  topicsPreview: {
    marginTop: spacing.md,
  },
  topicsPreviewLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  topicPreviewItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginBottom: spacing.sm,
  },
  topicPreviewTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  topicPreviewSubtopics: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  moreTopicsText: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorText: {
    fontSize: typography.fontSize.lg,
    textAlign: 'center',
  },
});

export default CourseDetailScreen;
