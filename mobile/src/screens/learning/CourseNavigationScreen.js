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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import Card from '../../components/common/Card';
import ApiService from '../../services/api';

const CourseNavigationScreen = ({ navigation, route }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const { course } = route.params;

  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [currentSubtopicIndex, setCurrentSubtopicIndex] = useState(0);
  const [completedTopics, setCompletedTopics] = useState(new Set());
  const [completedSubtopics, setCompletedSubtopics] = useState(new Set());
  const [courseProgress, setCourseProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [subtopicProgress, setSubtopicProgress] = useState({});

  // Parse course structure from multiple sources
  const parseCourseStructure = () => {
    // console.log('🔍 Parsing course structure for:', course.title);
    // console.log('📊 Course data:', JSON.stringify(course, null, 2));

    // First try to get from course_structure field
    if (course.course_structure && course.course_structure.topics) {
      console.log('✅ Found course_structure with topics:', course.course_structure.topics.length);
      return course.course_structure;
    }

    // Then try to parse from main content field
    if (course.content) {
      try {
        const parsedContent = JSON.parse(course.content);
        if (parsedContent.type === 'course') {
          return {
            outline: parsedContent.outline,
            topics: parsedContent.topics || []
          };
        }
      } catch (error) {
        // If parsing fails, create a basic course structure
        return {
          outline: course.description || 'Course overview',
          topics: [
            {
              title: course.title,
              description: course.content || course.description,
              subtopics: [
                {
                  title: 'Introduction',
                  content: course.content || course.description || 'Welcome to this course.',
                  type: 'text'
                }
              ]
            }
          ]
        };
      }
    }

    // Fallback to basic structure
    return {
      outline: course.description || 'Course overview',
      topics: [
        {
          title: course.title,
          description: course.description,
          subtopics: [
            {
              title: 'Course Content',
              content: course.content || course.description || 'No content available.',
              type: 'text'
            }
          ]
        }
      ]
    };
  };

  const courseStructure = parseCourseStructure();
  const topics = courseStructure.topics || [];
  const currentTopic = topics[currentTopicIndex];
  const currentSubtopic = currentTopic?.subtopics?.[currentSubtopicIndex];

  useEffect(() => {
    calculateProgress();
  }, [completedTopics, completedSubtopics]);

  const calculateProgress = () => {
    const totalSubtopics = topics.reduce((total, topic) => total + (topic.subtopics?.length || 0), 0);
    const completedCount = completedSubtopics.size;
    const progress = totalSubtopics > 0 ? (completedCount / totalSubtopics) * 100 : 0;
    setCourseProgress(progress);
  };

  const markSubtopicComplete = async (topicIndex, subtopicIndex) => {
    const subtopicKey = `${topicIndex}-${subtopicIndex}`;
    const newCompletedSubtopics = new Set(completedSubtopics);
    newCompletedSubtopics.add(subtopicKey);
    setCompletedSubtopics(newCompletedSubtopics);

    // Check if all subtopics in topic are complete
    const topic = topics[topicIndex];
    const topicSubtopics = topic.subtopics || [];
    const topicComplete = topicSubtopics.every((_, index) => 
      newCompletedSubtopics.has(`${topicIndex}-${index}`)
    );

    if (topicComplete) {
      const newCompletedTopics = new Set(completedTopics);
      newCompletedTopics.add(topicIndex);
      setCompletedTopics(newCompletedTopics);
    }

    // Save progress to backend
    try {
      // TODO: Implement progress saving
      // await ApiService.updateCourseProgress(course.id, topicIndex, subtopicIndex);
      console.log('Saving course progress:', { topicIndex, subtopicIndex });
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  };

  const navigateToSubtopic = (topicIndex, subtopicIndex) => {
    setCurrentTopicIndex(topicIndex);
    setCurrentSubtopicIndex(subtopicIndex);
    setReadingMode(true); // Enter reading mode when navigating to content
  };

  // Enhanced navigation functions for flowing course experience
  const goToNextSubtopic = () => {
    const currentTopic = topics[currentTopicIndex];
    if (!currentTopic) return;

    // Check if there's a next subtopic in current topic
    if (currentSubtopicIndex < (currentTopic.subtopics?.length || 0) - 1) {
      setCurrentSubtopicIndex(currentSubtopicIndex + 1);
    } else {
      // Move to first subtopic of next topic
      if (currentTopicIndex < topics.length - 1) {
        setCurrentTopicIndex(currentTopicIndex + 1);
        setCurrentSubtopicIndex(0);
      } else {
        // Course completed
        Alert.alert(
          'Course Completed!',
          'Congratulations! You have completed all topics in this course.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    }
  };

  const goToPreviousSubtopic = () => {
    // Check if there's a previous subtopic in current topic
    if (currentSubtopicIndex > 0) {
      setCurrentSubtopicIndex(currentSubtopicIndex - 1);
    } else {
      // Move to last subtopic of previous topic
      if (currentTopicIndex > 0) {
        const previousTopic = topics[currentTopicIndex - 1];
        setCurrentTopicIndex(currentTopicIndex - 1);
        setCurrentSubtopicIndex((previousTopic.subtopics?.length || 1) - 1);
      }
    }
  };

  const toggleReadingMode = () => {
    setReadingMode(!readingMode);
  };

  const toggleOutline = () => {
    setShowOutline(!showOutline);
  };

  const getSubtopicProgress = (topicIndex, subtopicIndex) => {
    const key = `${topicIndex}-${subtopicIndex}`;
    return completedSubtopics.has(key);
  };

  const getTotalEstimatedTime = () => {
    return topics.reduce((total, topic) => {
      const topicTime = topic.estimated_duration || 0;
      const subtopicsTime = (topic.subtopics || []).reduce((subTotal, subtopic) => {
        return subTotal + (subtopic.estimated_duration || 0);
      }, 0);
      return total + topicTime + subtopicsTime;
    }, 0);
  };

  const getCurrentSubtopicContent = () => {
    const subtopic = currentSubtopic;
    console.log('🎯 Getting current subtopic content:', subtopic);

    if (!subtopic) return null;

    // Handle both old and new subtopic formats
    if (typeof subtopic === 'string') {
      console.log('📝 Subtopic is string format:', subtopic);
      return {
        title: subtopic,
        content: `Content for ${subtopic}`,
        content_type: 'text',
        estimated_duration: 10
      };
    }

    // console.log('📊 Subtopic object format:', JSON.stringify(subtopic, null, 2));

    const subtopicContent = {
      title: subtopic.title || 'Untitled',
      content: subtopic.content || 'No content available',
      content_type: subtopic.content_type || subtopic.type || 'text',
      estimated_duration: subtopic.estimated_duration || 10,
      learning_objectives: subtopic.learning_objectives || [],
      resources: subtopic.resources || [],
      examples: subtopic.examples || [],
      // Include media fields
      image_url: subtopic.image_url || subtopic.imageUrl || '',
      video_url: subtopic.video_url || subtopic.videoUrl || '',
      documents: subtopic.documents || []
    };

    console.log('🎬 Final subtopic content with media:', {
      title: subtopicContent.title,
      has_image: !!subtopicContent.image_url,
      has_video: !!subtopicContent.video_url,
      has_documents: subtopicContent.documents.length > 0,
      image_url: subtopicContent.image_url,
      video_url: subtopicContent.video_url,
      documents: subtopicContent.documents
    });

    return subtopicContent;
  };

  const handleNextSubtopic = () => {
    const currentTopicSubtopics = currentTopic?.subtopics || [];
    
    if (currentSubtopicIndex < currentTopicSubtopics.length - 1) {
      // Move to next subtopic in current topic
      setCurrentSubtopicIndex(currentSubtopicIndex + 1);
    } else if (currentTopicIndex < topics.length - 1) {
      // Move to first subtopic of next topic
      setCurrentTopicIndex(currentTopicIndex + 1);
      setCurrentSubtopicIndex(0);
    } else {
      // Course completed
      handleCourseComplete();
    }
  };

  const handlePreviousSubtopic = () => {
    if (currentSubtopicIndex > 0) {
      // Move to previous subtopic in current topic
      setCurrentSubtopicIndex(currentSubtopicIndex - 1);
    } else if (currentTopicIndex > 0) {
      // Move to last subtopic of previous topic
      const previousTopic = topics[currentTopicIndex - 1];
      setCurrentTopicIndex(currentTopicIndex - 1);
      setCurrentSubtopicIndex((previousTopic.subtopics?.length || 1) - 1);
    }
  };

  const handleCourseComplete = async () => {
    try {
      Alert.alert(
        'Course Completed!',
        'Congratulations! You have successfully completed this course.',
        [
          {
            text: 'View Certificate',
            onPress: () => {
              // TODO: Navigate to certificate screen
              console.log('View certificate');
            },
          },
          {
            text: 'Continue Learning',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error handling course completion:', error);
    }
  };

  const renderCourseOverview = () => (
    <Card style={styles.overviewCard}>
      <Text style={[styles.courseTitle, { color: colors.text }]}>
        {course.title}
      </Text>
      
      {courseStructure.outline && (
        <Text style={[styles.courseOutline, { color: colors.textSecondary }]}>
          {courseStructure.outline}
        </Text>
      )}

      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: colors.text }]}>
            Course Progress
          </Text>
          <Text style={[styles.progressPercentage, { color: colors.primary }]}>
            {Math.round(courseProgress)}%
          </Text>
        </View>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                width: `${courseProgress}%`,
              },
            ]}
          />
        </View>
        <Text style={[styles.progressStats, { color: colors.textSecondary }]}>
          {completedSubtopics.size} of {topics.reduce((total, topic) => total + (topic.subtopics?.length || 0), 0)} lessons completed
        </Text>
      </View>
    </Card>
  );

  const renderCurrentLesson = () => {
    if (!currentTopic || !currentSubtopic) return null;

    const subtopicKey = `${currentTopicIndex}-${currentSubtopicIndex}`;
    const isCompleted = completedSubtopics.has(subtopicKey);

    return (
      <Card style={styles.currentLessonCard}>
        <View style={styles.lessonHeader}>
          <View style={styles.lessonInfo}>
            <Text style={[styles.topicTitle, { color: colors.text }]}>
              Topic {currentTopicIndex + 1}: {currentTopic.title}
            </Text>
            <Text style={[styles.subtopicTitle, { color: colors.primary }]}>
              Lesson {currentSubtopicIndex + 1}: {typeof currentSubtopic === 'string' ? currentSubtopic : currentSubtopic?.title || `Lesson ${currentSubtopicIndex + 1}`}
            </Text>
          </View>
          
          {isCompleted && (
            <View style={[styles.completedBadge, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={[styles.completedText, { color: colors.success }]}>
                Completed
              </Text>
            </View>
          )}
        </View>

        {currentTopic.description && (
          <Text style={[styles.topicDescription, { color: colors.textSecondary }]}>
            {currentTopic.description}
          </Text>
        )}

        <View style={styles.lessonActions}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.studyButton,
              { backgroundColor: colors.primary }
            ]}
            onPress={() => {
              // TODO: Navigate to appropriate content type based on course type
              console.log('Start studying:', currentSubtopic);
            }}
          >
            <Ionicons name="play" size={20} color={colors.white} />
            <Text style={[styles.actionButtonText, { color: colors.white }]}>
              {isCompleted ? 'Review Lesson' : 'Start Lesson'}
            </Text>
          </TouchableOpacity>

          {!isCompleted && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.completeButton,
                { backgroundColor: colors.success }
              ]}
              onPress={() => markSubtopicComplete(currentTopicIndex, currentSubtopicIndex)}
            >
              <Ionicons name="checkmark" size={20} color={colors.white} />
              <Text style={[styles.actionButtonText, { color: colors.white }]}>
                Mark Complete
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  };

  const renderTopicsList = () => (
    <Card style={styles.topicsCard}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Course Topics
      </Text>
      
      {topics.map((topic, topicIndex) => (
        <View key={topicIndex} style={styles.topicItem}>
          <View style={styles.topicHeader}>
            <View style={styles.topicTitleContainer}>
              <View style={[
                styles.topicIndicator,
                {
                  backgroundColor: completedTopics.has(topicIndex) 
                    ? colors.success 
                    : currentTopicIndex === topicIndex 
                      ? colors.primary 
                      : colors.border
                }
              ]}>
                {completedTopics.has(topicIndex) ? (
                  <Ionicons name="checkmark" size={16} color={colors.white} />
                ) : (
                  <Text style={[
                    styles.topicNumber,
                    { 
                      color: currentTopicIndex === topicIndex ? colors.white : colors.textSecondary 
                    }
                  ]}>
                    {topicIndex + 1}
                  </Text>
                )}
              </View>
              <Text style={[
                styles.topicItemTitle,
                { 
                  color: currentTopicIndex === topicIndex ? colors.primary : colors.text,
                  fontWeight: currentTopicIndex === topicIndex ? typography.fontWeight.bold : typography.fontWeight.normal,
                }
              ]}>
                {topic.title}
              </Text>
            </View>
          </View>

          {topic.subtopics && topic.subtopics.length > 0 && (
            <View style={styles.subtopicsList}>
              {topic.subtopics.map((subtopic, subtopicIndex) => {
                const subtopicKey = `${topicIndex}-${subtopicIndex}`;
                const isSubtopicCompleted = completedSubtopics.has(subtopicKey);
                const isCurrentSubtopic = currentTopicIndex === topicIndex && currentSubtopicIndex === subtopicIndex;

                return (
                  <TouchableOpacity
                    key={subtopicIndex}
                    style={[
                      styles.subtopicItem,
                      {
                        backgroundColor: isCurrentSubtopic ? colors.primary + '10' : 'transparent',
                      }
                    ]}
                    onPress={() => navigateToSubtopic(topicIndex, subtopicIndex)}
                  >
                    <View style={[
                      styles.subtopicIndicator,
                      {
                        backgroundColor: isSubtopicCompleted 
                          ? colors.success 
                          : isCurrentSubtopic 
                            ? colors.primary 
                            : colors.border
                      }
                    ]}>
                      {isSubtopicCompleted && (
                        <Ionicons name="checkmark" size={12} color={colors.white} />
                      )}
                    </View>
                    <Text style={[
                      styles.subtopicText,
                      {
                        color: isCurrentSubtopic ? colors.primary : colors.text,
                        fontWeight: isCurrentSubtopic ? typography.fontWeight.medium : typography.fontWeight.normal,
                      }
                    ]}>
                      {typeof subtopic === 'string' ? subtopic : subtopic.title || `Subtopic ${subtopicIndex + 1}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      ))}
    </Card>
  );

  const renderNavigationButtons = () => (
    <View style={styles.navigationContainer}>
      <TouchableOpacity
        style={[
          styles.navButton,
          {
            backgroundColor: (currentTopicIndex > 0 || currentSubtopicIndex > 0) 
              ? colors.surface 
              : colors.disabled,
            borderColor: colors.border,
          },
        ]}
        onPress={handlePreviousSubtopic}
        disabled={currentTopicIndex === 0 && currentSubtopicIndex === 0}
      >
        <Ionicons 
          name="chevron-back" 
          size={20} 
          color={(currentTopicIndex > 0 || currentSubtopicIndex > 0) ? colors.text : colors.textTertiary} 
        />
        <Text style={[
          styles.navButtonText,
          { 
            color: (currentTopicIndex > 0 || currentSubtopicIndex > 0) ? colors.text : colors.textTertiary 
          }
        ]}>
          Previous
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navButton, { backgroundColor: colors.primary }]}
        onPress={handleNextSubtopic}
      >
        <Text style={[styles.navButtonText, { color: colors.white }]}>
          {currentTopicIndex === topics.length - 1 && 
           currentSubtopicIndex === (currentTopic?.subtopics?.length || 1) - 1
            ? 'Complete Course'
            : 'Next Lesson'
          }
        </Text>
        <Ionicons name="chevron-forward" size={20} color={colors.white} />
      </TouchableOpacity>
    </View>
  );

  if (topics.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyContainer}>
          <Ionicons name="school-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No Course Structure
          </Text>
          <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
            This course doesn't have a structured curriculum yet.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Enhanced reading mode for focused learning
  if (readingMode) {
    const subtopicContent = getCurrentSubtopicContent();
    if (!subtopicContent) return null;

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.readingHeader}>
          <TouchableOpacity onPress={toggleReadingMode} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.readingProgress}>
            <Text style={[styles.readingProgressText, { color: colors.textSecondary }]}>
              Topic {currentTopicIndex + 1} • Lesson {currentSubtopicIndex + 1}
            </Text>
            <Text style={[styles.readingTitle, { color: colors.text }]}>
              {subtopicContent.title}
            </Text>
          </View>
          <TouchableOpacity onPress={toggleOutline} style={styles.outlineButton}>
            <Ionicons name="list-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.readingContent} contentContainerStyle={styles.readingContentContainer}>
          {/* Learning Objectives */}
          {subtopicContent.learning_objectives && subtopicContent.learning_objectives.length > 0 && (
            <View style={[styles.objectivesCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.objectivesTitle, { color: colors.primary }]}>
                📚 Learning Objectives
              </Text>
              {subtopicContent.learning_objectives.map((objective, index) => (
                <Text key={index} style={[styles.objectiveItem, { color: colors.text }]}>
                  • {objective}
                </Text>
              ))}
            </View>
          )}

          {/* Subtopic Image */}
          {subtopicContent.image_url && (
            <View style={[styles.mediaCard, { backgroundColor: colors.surface }]}>
              <Image
                source={{
                  uri: subtopicContent.image_url.startsWith('/uploads/')
                    ? `http://localhost:8080${subtopicContent.image_url}`
                    : subtopicContent.image_url
                }}
                style={styles.subtopicImage}
                resizeMode="cover"
                onError={(error) => console.log('Image load error:', error)}
                onLoad={() => console.log('Image loaded successfully')}
              />
            </View>
          )}

          {/* Subtopic Video */}
          {subtopicContent.video_url && (
            <View style={[styles.mediaCard, { backgroundColor: colors.surface }]}>
              <TouchableOpacity
                style={[styles.videoThumbnail, { backgroundColor: colors.primary + '20' }]}
                onPress={() => {
                  // Navigate to video player with subtopic video
                  navigation.navigate('VideoPlayer', {
                    course: {
                      ...course,
                      video_url: subtopicContent.video_url,
                      title: `${currentTopic?.title} - ${subtopicContent.title}`
                    }
                  });
                }}
              >
                <Ionicons name="play-circle" size={48} color={colors.primary} />
                <Text style={[styles.videoText, { color: colors.primary }]}>
                  Play Video
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Main Content */}
          <View style={[styles.contentCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.contentText, { color: colors.text }]}>
              {subtopicContent.content}
            </Text>
          </View>

          {/* Documents */}
          {subtopicContent.documents && subtopicContent.documents.length > 0 && (
            <View style={[styles.mediaCard, { backgroundColor: colors.surface }]}>
              {subtopicContent.documents.map((doc, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.documentItem, { backgroundColor: colors.background }]}
                  onPress={() => {
                    // Open document (you might want to use a document viewer)
                    Alert.alert('Document', `Opening: ${doc.name}`);
                  }}
                >
                  <Ionicons name="document-text" size={20} color={colors.text} />
                  <View style={styles.documentInfo}>
                    <Text style={[styles.documentName, { color: colors.text }]} numberOfLines={1}>
                      {doc.name}
                    </Text>
                    <Text style={[styles.documentSize, { color: colors.textSecondary }]}>
                      {doc.type} • {Math.round(doc.size / 1024)} KB
                    </Text>
                  </View>
                  <Ionicons name="download" size={16} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Examples */}
          {subtopicContent.examples && subtopicContent.examples.length > 0 && (
            <View style={[styles.examplesCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.examplesTitle, { color: colors.info }]}>
                💡 Examples
              </Text>
              {subtopicContent.examples.map((example, index) => (
                <Text key={index} style={[styles.exampleItem, { color: colors.text }]}>
                  {index + 1}. {example}
                </Text>
              ))}
            </View>
          )}

          {/* Resources */}
          {subtopicContent.resources && subtopicContent.resources.length > 0 && (
            <View style={[styles.resourcesCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.resourcesTitle, { color: colors.success }]}>
                📖 Additional Resources
              </Text>
              {subtopicContent.resources.map((resource, index) => (
                <Text key={index} style={[styles.resourceItem, { color: colors.text }]}>
                  • {resource}
                </Text>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Reading Mode Navigation */}
        <View style={[styles.readingNavigation, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            onPress={goToPreviousSubtopic}
            style={[styles.navButton, { opacity: currentTopicIndex === 0 && currentSubtopicIndex === 0 ? 0.5 : 1 }]}
            disabled={currentTopicIndex === 0 && currentSubtopicIndex === 0}
          >
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={[styles.navButtonText, { color: colors.primary }]}>Previous</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              const subtopicKey = `${currentTopicIndex}-${currentSubtopicIndex}`;
              markSubtopicComplete(currentTopicIndex, currentSubtopicIndex);
            }}
            style={[styles.completeButton, { backgroundColor: colors.success }]}
          >
            <Ionicons name="checkmark" size={20} color={colors.white} />
            <Text style={[styles.completeButtonText, { color: colors.white }]}>
              Mark Complete
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={goToNextSubtopic}
            style={styles.navButton}
          >
            <Text style={[styles.navButtonText, { color: colors.primary }]}>Next</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderCourseOverview()}
        {renderCurrentLesson()}
        {renderTopicsList()}
        {renderNavigationButtons()}
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
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  overviewCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  courseTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  courseOutline: {
    fontSize: typography.fontSize.base,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  progressContainer: {
    marginTop: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  progressPercentage: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressStats: {
    fontSize: typography.fontSize.xs,
  },
  currentLessonCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  lessonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  lessonInfo: {
    flex: 1,
  },
  topicTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  subtopicTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  completedText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  topicDescription: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  lessonActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  studyButton: {
    // Specific styles for study button
  },
  completeButton: {
    // Specific styles for complete button
  },
  actionButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  topicsCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.lg,
  },
  topicItem: {
    marginBottom: spacing.lg,
  },
  topicHeader: {
    marginBottom: spacing.md,
  },
  topicTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  topicIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicNumber: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  topicItemTitle: {
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  subtopicsList: {
    marginLeft: spacing.xl,
    gap: spacing.sm,
  },
  subtopicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    gap: spacing.md,
  },
  subtopicIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtopicText: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  navigationContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  navButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  emptyDescription: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Enhanced reading mode styles
  readingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: spacing.sm,
  },
  readingProgress: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  readingProgressText: {
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.xs,
  },
  readingTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  outlineButton: {
    padding: spacing.sm,
  },
  readingContent: {
    flex: 1,
  },
  readingContentContainer: {
    padding: spacing.lg,
  },
  objectivesCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  objectivesTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  objectiveItem: {
    fontSize: typography.fontSize.sm,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  contentCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  contentText: {
    fontSize: typography.fontSize.base,
    lineHeight: 24,
  },
  examplesCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  examplesTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  exampleItem: {
    fontSize: typography.fontSize.sm,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  resourcesCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  resourcesTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  resourceItem: {
    fontSize: typography.fontSize.sm,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  readingNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  completeButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  // Media styles
  mediaCard: {
    padding: 0,
    borderRadius: 0,
    marginBottom: spacing.lg,
    borderWidth: 0,
    overflow: 'hidden',
  },

  subtopicImage: {
    width: '100%',
    height: 300,
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  videoThumbnail: {
    height: 180,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  videoText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginLeft: spacing.md,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  documentInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  documentName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  documentSize: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
});

export default CourseNavigationScreen;
