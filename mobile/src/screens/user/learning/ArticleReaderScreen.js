import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import ApiService from '../../../services/api';

const ArticleReaderScreen = ({ navigation, route }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const { course } = route.params;

  const [readingProgress, setReadingProgress] = useState(0);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [estimatedReadTime, setEstimatedReadTime] = useState(0);
  const [readingStartTime] = useState(Date.now());

  // Parse article content from multiple sources
  const parseArticleContent = () => {
    // First try to get from article_content field
    if (course.article_content && course.article_content.sections) {
      return course.article_content;
    }

    // Then try to parse from main content field
    if (course.content) {
      try {
        const parsedContent = JSON.parse(course.content);
        if (parsedContent.type === 'article') {
          return {
            headline_image: parsedContent.headline_image,
            sections: parsedContent.sections || []
          };
        }
      } catch (error) {
        // If parsing fails, create a basic article structure
        return {
          headline_image: '',
          sections: [
            {
              heading: course.title,
              headingType: 'h1',
              content: course.content,
              image_url: course.thumbnail_url
            }
          ]
        };
      }
    }

    // Fallback to basic structure
    return {
      headline_image: course.thumbnail_url || '',
      sections: [
        {
          heading: course.title,
          headingType: 'h1',
          content: course.description || 'No content available.',
        }
      ]
    };
  };

  const articleContent = parseArticleContent();
  const sections = articleContent.sections || [];

  useEffect(() => {
    // Calculate estimated reading time (average 200 words per minute)
    const totalWords = sections.reduce((total, section) => {
      return total + (section.content?.split(' ').length || 0);
    }, 0);
    setEstimatedReadTime(Math.ceil(totalWords / 200));
  }, [sections]);

  useEffect(() => {
    // Update reading progress
    if (contentHeight > 0 && scrollViewHeight > 0) {
      const maxScroll = contentHeight - scrollViewHeight;
      const progress = maxScroll > 0 ? (scrollPosition / maxScroll) * 100 : 100;
      setReadingProgress(Math.min(100, Math.max(0, progress)));
      
      // Auto-save progress
      if (progress > 0 && progress % 10 === 0) {
        saveReadingProgress(progress);
      }
    }
  }, [scrollPosition, contentHeight, scrollViewHeight]);

  const saveReadingProgress = async (progress) => {
    try {
      // TODO: Implement progress saving to backend
      // await ApiService.updateArticleProgress(course.id, progress, scrollPosition);
      console.log('Saving reading progress:', progress);
    } catch (error) {
      console.error('Failed to save reading progress:', error);
    }
  };

  const handleScrollEnd = () => {
    if (readingProgress >= 95) {
      handleArticleComplete();
    }
  };

  const handleArticleComplete = async () => {
    try {
      const readingTime = Math.floor((Date.now() - readingStartTime) / 1000 / 60); // minutes
      await saveReadingProgress(100);
      
      Alert.alert(
        'Article Completed!',
        `Great job! You've finished reading this article in ${readingTime} minutes.`,
        [
          {
            text: 'Continue Learning',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error handling article completion:', error);
    }
  };

  const handleScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setScrollPosition(contentOffset.y);
    setContentHeight(contentSize.height);
    setScrollViewHeight(layoutMeasurement.height);
  };

  const renderProgressHeader = () => (
    <View style={[styles.progressHeader, { backgroundColor: colors.surface }]}>
      <View style={styles.progressInfo}>
        <Text style={[styles.progressText, { color: colors.text }]}>
          Reading Progress
        </Text>
        <Text style={[styles.progressPercentage, { color: colors.primary }]}>
          {Math.round(readingProgress)}%
        </Text>
      </View>
      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: colors.primary,
              width: `${readingProgress}%`,
            },
          ]}
        />
      </View>
      <View style={styles.articleMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {estimatedReadTime} min read
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {sections.length} sections
          </Text>
        </View>
      </View>
    </View>
  );

  const renderHeadlineImage = () => {
    if (!articleContent.headline_image) return null;

    return (
      <View style={styles.headlineImageContainer}>
        <Image
          source={{
            uri: articleContent.headline_image.startsWith('/uploads/')
              ? `http://localhost:8080${articleContent.headline_image}`
              : articleContent.headline_image
          }}
          style={styles.headlineImage}
          resizeMode="cover"
          onError={(error) => console.log('Headline image load error:', error)}
          onLoad={() => console.log('Headline image loaded successfully')}
        />
      </View>
    );
  };

  const renderArticleHeader = () => (
    <View style={styles.articleHeader}>
      <Text style={[styles.articleTitle, { color: colors.text }]}>
        {course.title}
      </Text>
      {course.description && (
        <Text style={[styles.articleSubtitle, { color: colors.textSecondary }]}>
          {course.description}
        </Text>
      )}
    </View>
  );

  const getHeadingStyle = (headingType) => {
    switch (headingType) {
      case 'h1':
        return [styles.heading1, { color: colors.text }];
      case 'h2':
        return [styles.heading2, { color: colors.text }];
      case 'h3':
        return [styles.heading3, { color: colors.text }];
      default:
        return [styles.heading2, { color: colors.text }];
    }
  };

  const renderSection = (section, index) => (
    <View key={index} style={styles.sectionContainer}>
      {section.heading && (
        <Text style={getHeadingStyle(section.headingType)}>
          {section.heading}
        </Text>
      )}
      
      {section.content && (
        <Text style={[styles.sectionContent, { color: colors.text }]}>
          {section.content}
        </Text>
      )}
      
      {section.image_url && (
        <View style={styles.sectionImageContainer}>
          <Image
            source={{
              uri: section.image_url.startsWith('/uploads/')
                ? `http://localhost:8080${section.image_url}`
                : section.image_url
            }}
            style={styles.sectionImage}
            resizeMode="cover"
            onError={(error) => console.log('Section image load error:', error)}
            onLoad={() => console.log('Section image loaded successfully')}
          />
        </View>
      )}
    </View>
  );

  const renderTableOfContents = () => {
    const headings = sections.filter(section => section.heading);
    
    if (headings.length === 0) return null;

    return (
      <Card style={styles.tocCard}>
        <Text style={[styles.tocTitle, { color: colors.text }]}>
          Table of Contents
        </Text>
        {headings.map((section, index) => (
          <TouchableOpacity
            key={index}
            style={styles.tocItem}
            onPress={() => {
              // TODO: Implement scroll to section
              console.log('Scroll to section:', section.heading);
            }}
          >
            <View style={[
              styles.tocIndicator,
              { backgroundColor: section.headingType === 'h1' ? colors.primary : colors.textTertiary }
            ]} />
            <Text style={[
              styles.tocText,
              {
                color: colors.text,
                fontSize: section.headingType === 'h1' ? typography.fontSize.base : typography.fontSize.sm,
                fontWeight: section.headingType === 'h1' ? typography.fontWeight.bold : typography.fontWeight.normal,
              }
            ]}>
              {section.heading}
            </Text>
          </TouchableOpacity>
        ))}
      </Card>
    );
  };

  if (sections.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No Article Content
          </Text>
          <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
            This course doesn't have article content yet.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {renderProgressHeader()}
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {renderHeadlineImage()}
        
        <View style={styles.contentContainer}>
          {renderArticleHeader()}
          {renderTableOfContents()}
          
          <View style={styles.articleContent}>
            {sections.map(renderSection)}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressHeader: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  progressPercentage: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  articleMeta: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    fontSize: typography.fontSize.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  headlineImageContainer: {
    marginBottom: spacing.lg,
  },
  headlineImage: {
    width: '100%',
    height: 300,
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
  },
  articleHeader: {
    marginBottom: spacing.xl,
  },
  articleTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 32,
    marginBottom: spacing.md,
  },
  articleSubtitle: {
    fontSize: typography.fontSize.lg,
    lineHeight: 24,
  },
  tocCard: {
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  tocTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  tocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  tocIndicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  tocText: {
    flex: 1,
  },
  articleContent: {
    gap: spacing.xl,
  },
  sectionContainer: {
    marginBottom: spacing.xl,
  },
  heading1: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 28,
    marginBottom: spacing.lg,
  },
  heading2: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  heading3: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  sectionContent: {
    fontSize: typography.fontSize.base,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  sectionImageContainer: {
    marginVertical: spacing.lg,
    borderRadius: 0,
    overflow: 'hidden',
  },
  sectionImage: {
    width: '100%',
    height: 280,
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
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
});

export default ArticleReaderScreen;
