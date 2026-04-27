import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Input from '../../../components/common/Input';

import ApiService from '../../../services/api';
import useSmartNavigation from '../../../hooks/useSmartNavigation';

const CreateLearningCourseScreen = ({ navigation, route }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const { goBack } = useSmartNavigation();
  
  const isEditing = route.params?.courseId;
  const courseId = route.params?.courseId;

  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    level: 'beginner',
    type: 'article',
    content: '',
    thumbnail_url: '',
    duration_minutes: 0,
    estimated_read_time: '',
    tags: [],
    prerequisites: [],
    learning_objectives: [],
    status: 'draft',
    is_featured: false,
    // Enhanced content structure
    video_url: '',
    quiz_questions: [],
    article_content: {
      headline_image: '',
      author: '',
      publication_date: new Date().toISOString().split('T')[0],
      reading_time: 0,
      excerpt: '',
      tags: [],
      hashtags: [],
      seo_keywords: [],
      references: [],
      table_of_contents: true,
      sections: [],
      conclusion: '',
      call_to_action: '',
      related_articles: [],
      social_sharing: true,
      comments_enabled: true
    },
    course_structure: {
      topics: [],
      outline: '',
      total_duration: 0, // Total course duration in minutes
      difficulty_progression: 'linear', // 'linear', 'adaptive'
      prerequisites: [], // Course-level prerequisites
      completion_criteria: {
        min_topics_completed: 0,
        min_score_required: 70,
        require_all_exercises: false
      }
    }
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Input states for tags and objectives
  const [showTagInput, setShowTagInput] = useState(false);
  const [showObjectiveInput, setShowObjectiveInput] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [objectiveInput, setObjectiveInput] = useState('');

  const steps = [
    { title: 'Basic Info', icon: 'information-circle' },
    { title: 'Content', icon: 'document-text' },
    { title: 'Settings', icon: 'settings' },
  ];

  const levelOptions = [
    { value: 'beginner', label: 'Beginner', color: '#10b981' },
    { value: 'intermediate', label: 'Intermediate', color: '#f59e0b' },
    { value: 'advanced', label: 'Advanced', color: '#ef4444' },
  ];

  const typeOptions = [
    { value: 'article', label: 'Article', icon: 'document-text' },
    { value: 'video', label: 'Video', icon: 'play-circle' },
    { value: 'course', label: 'Course', icon: 'school' },
    { value: 'quiz', label: 'Quiz', icon: 'help-circle' },
  ];

  const statusOptions = [
    { value: 'draft', label: 'Draft', color: '#6b7280' },
    { value: 'published', label: 'Published', color: '#10b981' },
    { value: 'archived', label: 'Archived', color: '#ef4444' },
  ];

  useEffect(() => {
    loadCategories();
    if (isEditing) {
      loadCourse();
    }
  }, [isEditing, courseId]);

  const loadCategories = async () => {
    try {
      const response = await ApiService.getLearningCategories();
      if (response.success) {
        setCategories(response.categories || []);
        if (!isEditing && response.categories.length > 0) {
          setFormData(prev => ({ ...prev, category_id: response.categories[0].id }));
        }
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadCourse = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getLearningCourse(courseId);
      if (response.success) {
        const course = response.course;
        setFormData({
          title: course.title,
          description: course.description,
          category_id: course.category_id,
          level: course.level,
          type: course.type,
          content: course.content || '',
          thumbnail_url: course.thumbnail_url || '',
          duration_minutes: course.duration_minutes || 0,
          estimated_read_time: course.estimated_read_time || '',
          tags: course.tags || [],
          prerequisites: course.prerequisites || [],
          learning_objectives: course.learning_objectives || [],
          status: course.status,
          is_featured: course.is_featured,
          // Enhanced content structure
          video_url: course.video_url || '',
          quiz_questions: course.quiz_questions || [],
          article_content: course.article_content || {
            headline_image: '',
            author: '',
            publication_date: new Date().toISOString().split('T')[0],
            reading_time: 0,
            excerpt: '',
            tags: [],
            hashtags: [],
            seo_keywords: [],
            references: [],
            table_of_contents: true,
            sections: [],
            conclusion: '',
            call_to_action: '',
            related_articles: [],
            social_sharing: true,
            comments_enabled: true
          },
          course_structure: course.course_structure || {
            topics: [],
            outline: '',
            total_duration: 0,
            difficulty_progression: 'linear',
            prerequisites: [],
            completion_criteria: {
              min_topics_completed: 0,
              min_score_required: 70,
              require_all_exercises: false
            }
          }
        });
      }
    } catch (error) {
      console.error('Failed to load course:', error);
      Alert.alert('Error', 'Failed to load course data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Validation Error', 'Course title is required.');
      return;
    }
    if (!formData.description.trim()) {
      Alert.alert('Validation Error', 'Course description is required.');
      return;
    }
    if (!formData.category_id) {
      Alert.alert('Validation Error', 'Please select a category.');
      return;
    }

    // Validate content based on type
    if (formData.type === 'video' && !formData.video_url.trim()) {
      Alert.alert('Validation Error', 'Video URL is required for video courses.');
      return;
    }
    if (formData.type === 'quiz' && formData.quiz_questions.length === 0) {
      Alert.alert('Validation Error', 'At least one quiz question is required for quiz courses.');
      return;
    }

    // Validate quiz questions have correct answers set
    if (formData.type === 'quiz') {
      const invalidQuestions = formData.quiz_questions.filter((question, index) => {
        const hasValidCorrectAnswer = question.correctAnswer >= 0 &&
                                    question.correctAnswer < question.options.length &&
                                    question.options[question.correctAnswer].trim() !== '';
        if (!hasValidCorrectAnswer) {
        }
        return !hasValidCorrectAnswer;
      });

      if (invalidQuestions.length > 0) {
        Alert.alert(
          'Quiz Validation Error',
          `Please ensure all questions have a valid correct answer selected. Check questions: ${invalidQuestions.map((_, i) => i + 1).join(', ')}`
        );
        return;
      }
    }
    if (formData.type === 'article') {
      if (formData.article_content.sections.length === 0) {
        Alert.alert('Validation Error', 'At least one article section is required for article courses.');
        return;
      }

      // Enhanced article validation
      const articleIssues = [];

      if (!formData.article_content.author?.trim()) {
        articleIssues.push('Author name is required');
      }

      if (!formData.article_content.excerpt?.trim()) {
        articleIssues.push('Article excerpt/summary is required');
      }

      if (!formData.article_content.headline_image?.trim()) {
        articleIssues.push('Header image is required');
      }

      if (!formData.article_content.tags || formData.article_content.tags.length === 0) {
        articleIssues.push('At least one tag is required');
      }

      // Validate sections
      formData.article_content.sections.forEach((section, index) => {
        if (!section.heading?.trim()) {
          articleIssues.push(`Section ${index + 1}: Heading is required`);
        }
        if (!section.content?.trim()) {
          articleIssues.push(`Section ${index + 1}: Content is required`);
        }
      });

      if (articleIssues.length > 0) {
        Alert.alert(
          'Article Validation Issues',
          `Please fix the following issues:\n\n${articleIssues.join('\n')}`,
          [{ text: 'OK' }]
        );
        return;
      }
    }
    if (formData.type === 'course' && formData.course_structure.topics.length === 0) {
      Alert.alert('Validation Error', 'At least one topic is required for structured courses.');
      return;
    }

    // Validate course subtopic media content
    if (formData.type === 'course') {
      const invalidSubtopics = [];

      formData.course_structure.topics.forEach((topic, topicIndex) => {
        topic.subtopics.forEach((subtopic, subtopicIndex) => {
          const subtopicLabel = `Topic ${topicIndex + 1}, Subtopic ${subtopicIndex + 1}`;

          // Validate video content
          if (subtopic.content_type === 'video' && !subtopic.video_url?.trim()) {
            invalidSubtopics.push(`${subtopicLabel}: Video URL or upload required`);
          }

          // Validate image content
          if (subtopic.content_type === 'image' && !subtopic.image_url?.trim()) {
            invalidSubtopics.push(`${subtopicLabel}: Image URL or upload required`);
          }

          // Validate mixed content
          if (subtopic.content_type === 'mixed') {
            const hasVideo = subtopic.video_url?.trim();
            const hasImage = subtopic.image_url?.trim();
            const hasDocuments = subtopic.documents && subtopic.documents.length > 0;

            if (!hasVideo && !hasImage && !hasDocuments) {
              invalidSubtopics.push(`${subtopicLabel}: Mixed content requires at least one media file`);
            }
          }
        });
      });

      if (invalidSubtopics.length > 0) {
        Alert.alert(
          'Media Content Required',
          `Please add media content for:\n\n${invalidSubtopics.join('\n')}`,
          [{ text: 'OK' }]
        );
        return;
      }
    }

    try {
      setSaving(true);

      // Transform quiz questions to match backend expected format
      const transformQuizQuestions = (questions) => {
        return questions.map(question => ({
          ...question,
          correct_answer: question.correctAnswer, // Transform camelCase to snake_case
          // Remove the camelCase version to avoid confusion
          correctAnswer: undefined
        }));
      };

      // Prepare the data to send based on course type
      const dataToSend = {
        ...formData,
        // Ensure main content field is populated based on type
        content: generateMainContent(formData),
        // Only include relevant enhanced content fields based on type
        video_url: formData.type === 'video' ? formData.video_url : '',
        quiz_questions: formData.type === 'quiz' ? transformQuizQuestions(formData.quiz_questions) : [],
        article_content: formData.type === 'article' ? formData.article_content : null,
        course_structure: formData.type === 'course' ? formData.course_structure : null,
      };
      // Debug quiz questions transformation
      if (formData.type === 'quiz' && formData.quiz_questions.length > 0) {
      }

      if (dataToSend.type === 'course' && dataToSend.course_structure) {
        dataToSend.course_structure.topics?.forEach((topic, index) => {
          console.log(`📚 Topic ${index + 1}: ${topic.title} (${topic.subtopics?.length || 0} subtopics)`);
        });
      }

      let response;

      if (isEditing) {
        response = await ApiService.updateLearningCourse(courseId, dataToSend);
      } else {
        response = await ApiService.createLearningCourse(dataToSend);
      }

      if (response.success) {
        Alert.alert(
          'Success',
          `Course ${isEditing ? 'updated' : 'created'} successfully!`,
          [
            {
              text: 'OK',
              onPress: () => goBack(),
            },
          ]
        );
      } else {
        throw new Error(response.error || `Failed to ${isEditing ? 'update' : 'create'} course`);
      }
    } catch (error) {
      console.error('Failed to save course:', error);
      Alert.alert('Error', error.message || `Failed to ${isEditing ? 'update' : 'create'} course.`);
    } finally {
      setSaving(false);
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };



  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      updateFormData('tags', [...formData.tags, tagInput.trim()]);
      setTagInput('');
      setShowTagInput(false);
    }
  };

  const removeTag = (index) => {
    updateFormData('tags', formData.tags.filter((_, i) => i !== index));
  };

  const addObjective = () => {
    if (objectiveInput.trim() && !formData.learning_objectives.includes(objectiveInput.trim())) {
      updateFormData('learning_objectives', [...formData.learning_objectives, objectiveInput.trim()]);
      setObjectiveInput('');
      setShowObjectiveInput(false);
    }
  };

  const removeObjective = (index) => {
    updateFormData('learning_objectives', formData.learning_objectives.filter((_, i) => i !== index));
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {steps.map((step, index) => (
        <TouchableOpacity
          key={index}
          style={styles.stepItem}
          onPress={() => setCurrentStep(index)}
        >
          <View style={[
            styles.stepCircle,
            {
              backgroundColor: index <= currentStep ? colors.primary : colors.surface,
              borderColor: index <= currentStep ? colors.primary : colors.border,
            }
          ]}>
            <Ionicons
              name={step.icon}
              size={16}
              color={index <= currentStep ? colors.white : colors.textSecondary}
            />
          </View>
          <Text style={[
            styles.stepText,
            { color: index <= currentStep ? colors.primary : colors.textSecondary }
          ]}>
            {step.title}
          </Text>
          {index < steps.length - 1 && (
            <View style={[styles.stepLine, { backgroundColor: colors.border }]} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderBasicInfo = () => (
    <View>
      <Input
        label="Course Title"
        value={formData.title}
        onChangeText={(value) => updateFormData('title', value)}
        placeholder="Enter course title"
        required
      />

      <Input
        label="Description"
        value={formData.description}
        onChangeText={(value) => updateFormData('description', value)}
        placeholder="Enter course description"
        multiline
        numberOfLines={4}
        required
      />

      <Input
        label="Content Overview"
        value={formData.content}
        onChangeText={(value) => updateFormData('content', value)}
        placeholder="Enter general content overview or description (this will be used as fallback content)"
        multiline
        numberOfLines={3}
      />

      <Text style={[styles.fieldLabel, { color: colors.text }]}>Category *</Text>
      <View style={styles.optionGrid}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.optionButton,
              {
                backgroundColor: formData.category_id === category.id ? colors.primary + '20' : colors.surface,
                borderColor: formData.category_id === category.id ? colors.primary : colors.border,
              },
            ]}
            onPress={() => updateFormData('category_id', category.id)}
          >
            <Ionicons
              name={category.icon || 'folder'}
              size={20}
              color={formData.category_id === category.id ? colors.primary : colors.text}
            />
            <Text style={[
              styles.optionText,
              { color: formData.category_id === category.id ? colors.primary : colors.text }
            ]}>
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.fieldLabel, { color: colors.text }]}>Level</Text>
      <View style={styles.optionRow}>
        {levelOptions.map((level) => (
          <TouchableOpacity
            key={level.value}
            style={[
              styles.levelButton,
              {
                backgroundColor: formData.level === level.value ? level.color + '20' : colors.surface,
                borderColor: formData.level === level.value ? level.color : colors.border,
              },
            ]}
            onPress={() => updateFormData('level', level.value)}
          >
            <Text style={[
              styles.levelText,
              { color: formData.level === level.value ? level.color : colors.text }
            ]}>
              {level.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.fieldLabel, { color: colors.text }]}>Type</Text>
      <View style={styles.optionRow}>
        {typeOptions.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={[
              styles.typeButton,
              {
                backgroundColor: formData.type === type.value ? colors.primary + '20' : colors.surface,
                borderColor: formData.type === type.value ? colors.primary : colors.border,
              },
            ]}
            onPress={() => updateFormData('type', type.value)}
          >
            <Ionicons
              name={type.icon}
              size={20}
              color={formData.type === type.value ? colors.primary : colors.text}
            />
            <Text style={[
              styles.typeText,
              { color: formData.type === type.value ? colors.primary : colors.text }
            ]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Quiz Content Renderer
  const renderQuizContent = () => (
    <View style={styles.contentTypeSection}>
      <Text style={[styles.contentTypeTitle, { color: colors.text }]}>
        Quiz Questions
      </Text>
      <Text style={[styles.contentTypeDescription, { color: colors.textSecondary }]}>
        Create interactive quiz questions with multiple choice answers
      </Text>

      {formData.quiz_questions.map((question, index) => (
        <View key={index} style={[styles.questionCard, { backgroundColor: colors.surface }]}>
          <View style={styles.questionHeader}>
            <Text style={[styles.questionNumber, { color: colors.primary }]}>
              Question {index + 1}
            </Text>
            <TouchableOpacity
              onPress={() => removeQuizQuestion(index)}
              style={styles.removeButton}
            >
              <Ionicons name="close" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>

          <Input
            label="Question"
            value={question.question}
            onChangeText={(value) => updateQuizQuestion(index, 'question', value)}
            placeholder="Enter your question here..."
            multiline
          />

          {question.options.map((option, optionIndex) => (
            <View key={optionIndex} style={styles.optionRow}>
              <Input
                label={`Option ${optionIndex + 1}`}
                value={option}
                onChangeText={(value) => updateQuizOption(index, optionIndex, value)}
                placeholder={`Option ${optionIndex + 1}`}
                style={{ flex: 1 }}
              />
              <TouchableOpacity
                style={[
                  styles.correctAnswerButton,
                  { backgroundColor: question.correctAnswer === optionIndex ? colors.success : colors.surface }
                ]}
                onPress={() => updateQuizQuestion(index, 'correctAnswer', optionIndex)}
              >
                <Ionicons
                  name={question.correctAnswer === optionIndex ? "checkmark" : "ellipse-outline"}
                  size={16}
                  color={question.correctAnswer === optionIndex ? colors.white : colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          ))}

          <Input
            label="Explanation (Optional)"
            value={question.explanation}
            onChangeText={(value) => updateQuizQuestion(index, 'explanation', value)}
            placeholder="Explain why this is the correct answer..."
            multiline
          />
        </View>
      ))}

      <TouchableOpacity
        style={[styles.addQuestionButton, { backgroundColor: colors.primary + '20' }]}
        onPress={addQuizQuestion}
      >
        <Ionicons name="add" size={20} color={colors.primary} />
        <Text style={[styles.addQuestionText, { color: colors.primary }]}>
          Add Question
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Video Content Renderer
  const renderVideoContent = () => (
    <View style={styles.contentTypeSection}>
      <Text style={[styles.contentTypeTitle, { color: colors.text }]}>
        Video Course
      </Text>
      <Text style={[styles.contentTypeDescription, { color: colors.textSecondary }]}>
        Provide a video URL that will be embedded and playable within the app
      </Text>

      <Input
        label="Video URL"
        value={formData.video_url}
        onChangeText={(value) => updateFormData('video_url', value)}
        placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
      />

      <Input
        label="Video Description"
        value={formData.content}
        onChangeText={(value) => updateFormData('content', value)}
        placeholder="Describe what students will learn from this video..."
        multiline
        numberOfLines={4}
      />
    </View>
  );

  // Enhanced Professional Article Content Renderer
  const renderArticleContent = () => (
    <View style={styles.contentTypeSection}>
      <Text style={[styles.contentTypeTitle, { color: colors.text }]}>
        📰 Professional Article Editor
      </Text>
      <Text style={[styles.contentTypeDescription, { color: colors.textSecondary }]}>
        Create engaging, SEO-optimized articles with rich formatting and media
      </Text>

      {/* Article Metadata Section */}
      <View style={[styles.metadataSection, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>
          📋 Article Metadata
        </Text>

        <Input
          label="Author Name"
          value={formData.article_content.author}
          onChangeText={(value) => updateArticleContent('author', value)}
          placeholder="Article author name"
        />

        <Input
          label="Article Excerpt/Summary"
          value={formData.article_content.excerpt}
          onChangeText={(value) => updateArticleContent('excerpt', value)}
          placeholder="Brief summary of the article (for previews and SEO)"
          multiline
          numberOfLines={3}
        />

        <Input
          label="Publication Date"
          value={formData.article_content.publication_date}
          onChangeText={(value) => updateArticleContent('publication_date', value)}
          placeholder="YYYY-MM-DD"
        />

        <Input
          label="Estimated Reading Time (minutes)"
          value={formData.article_content.reading_time?.toString() || ''}
          onChangeText={(value) => updateArticleContent('reading_time', parseInt(value) || 0)}
          placeholder="5"
          keyboardType="numeric"
        />
      </View>

      {/* Header Image Section */}
      <View style={[styles.headerImageSection, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>
          🖼️ Header Image
        </Text>

        <Input
          label="Header Image URL"
          value={formData.article_content.headline_image}
          onChangeText={(value) => updateArticleContent('headline_image', value)}
          placeholder="https://example.com/header-image.jpg"
        />

        <TouchableOpacity
          style={[styles.uploadButton, { backgroundColor: colors.info + '20', borderColor: colors.info }]}
          onPress={() => handleArticleImageUpload('headline_image')}
        >
          <Ionicons name="cloud-upload" size={20} color={colors.info} />
          <Text style={[styles.uploadButtonText, { color: colors.info }]}>
            Upload Header Image
          </Text>
        </TouchableOpacity>

        {formData.article_content.headline_image && (
          <View style={styles.imagePreview}>
            <Image
              source={{ uri: formData.article_content.headline_image }}
              style={styles.headerImagePreview}
              resizeMode="cover"
            />
          </View>
        )}
      </View>

      {/* Tags and SEO Section */}
      <View style={[styles.tagsSection, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>
          🏷️ Tags & SEO
        </Text>

        <Input
          label="Article Tags"
          value={formData.article_content.tags?.join(', ') || ''}
          onChangeText={(value) => updateArticleContent('tags', value.split(',').map(tag => tag.trim()).filter(tag => tag))}
          placeholder="technology, education, tutorial (comma-separated)"
          multiline
        />

        <Input
          label="Hashtags"
          value={formData.article_content.hashtags?.join(', ') || ''}
          onChangeText={(value) => updateArticleContent('hashtags', value.split(',').map(tag => tag.trim().replace(/^#/, '')).filter(tag => tag))}
          placeholder="tech, learning, howto (without # symbol)"
          multiline
        />

        <Input
          label="SEO Keywords"
          value={formData.article_content.seo_keywords?.join(', ') || ''}
          onChangeText={(value) => updateArticleContent('seo_keywords', value.split(',').map(kw => kw.trim()).filter(kw => kw))}
          placeholder="primary keywords for search optimization"
          multiline
        />
      </View>

      {/* Article Sections */}
      <View style={styles.sectionsContainer}>
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>
          📝 Article Content Sections
        </Text>

        {formData.article_content.sections.map((section, index) => (
          <View key={index} style={[styles.enhancedSectionCard, { backgroundColor: colors.background }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionNumber, { color: colors.primary }]}>
                Section {index + 1}
              </Text>
              <TouchableOpacity
                onPress={() => removeArticleSection(index)}
                style={styles.removeButton}
              >
                <Ionicons name="close" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>

            <View style={styles.headingTypeSelector}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Heading Level</Text>
              <View style={styles.headingTypeButtons}>
                {[
                  { type: 'h1', label: 'H1', desc: 'Main Title' },
                  { type: 'h2', label: 'H2', desc: 'Section' },
                  { type: 'h3', label: 'H3', desc: 'Subsection' },
                  { type: 'h4', label: 'H4', desc: 'Minor' }
                ].map((heading) => (
                  <TouchableOpacity
                    key={heading.type}
                    style={[
                      styles.enhancedHeadingButton,
                      {
                        backgroundColor: section.headingType === heading.type ? colors.primary : colors.surface,
                        borderColor: colors.border
                      }
                    ]}
                    onPress={() => updateArticleSection(index, 'headingType', heading.type)}
                  >
                    <Text style={[
                      styles.headingTypeButtonText,
                      { color: section.headingType === heading.type ? colors.white : colors.text }
                    ]}>
                      {heading.label}
                    </Text>
                    <Text style={[
                      styles.headingTypeDesc,
                      { color: section.headingType === heading.type ? colors.white : colors.textSecondary }
                    ]}>
                      {heading.desc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Input
              label="Section Heading"
              value={section.heading}
              onChangeText={(value) => updateArticleSection(index, 'heading', value)}
              placeholder="Enter compelling section heading..."
            />

            <Input
              label="Section Content"
              value={section.content}
              onChangeText={(value) => updateArticleSection(index, 'content', value)}
              placeholder="Write engaging content for this section. Use clear, concise language and break up long paragraphs..."
              multiline
              numberOfLines={8}
            />

            {/* Section Image */}
            <View style={styles.sectionImageContainer}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Section Image</Text>

              <Input
                label="Image URL"
                value={section.image_url}
                onChangeText={(value) => updateArticleSection(index, 'image_url', value)}
                placeholder="https://example.com/section-image.jpg"
              />

              <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: colors.success + '20', borderColor: colors.success }]}
                onPress={() => handleSectionImageUpload(index)}
              >
                <Ionicons name="image" size={20} color={colors.success} />
                <Text style={[styles.uploadButtonText, { color: colors.success }]}>
                  Upload Section Image
                </Text>
              </TouchableOpacity>

              {section.image_url && (
                <View style={styles.imagePreview}>
                  <Image
                    source={{ uri: section.image_url }}
                    style={styles.sectionImagePreview}
                    resizeMode="cover"
                  />
                </View>
              )}
            </View>

            {/* Section Image Caption */}
            <Input
              label="Image Caption (Optional)"
              value={section.image_caption}
              onChangeText={(value) => updateArticleSection(index, 'image_caption', value)}
              placeholder="Descriptive caption for the image..."
            />

            {/* Section Quote/Callout */}
            <Input
              label="Quote or Callout (Optional)"
              value={section.quote}
              onChangeText={(value) => updateArticleSection(index, 'quote', value)}
              placeholder="Important quote or highlighted text for this section..."
              multiline
              numberOfLines={2}
            />
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.addSectionButton, { backgroundColor: colors.primary + '20' }]}
        onPress={addArticleSection}
      >
        <Ionicons name="add" size={20} color={colors.primary} />
        <Text style={[styles.addSectionText, { color: colors.primary }]}>
          Add New Section
        </Text>
      </TouchableOpacity>

      {/* Article Conclusion */}
      <View style={[styles.conclusionSection, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>
          🎯 Article Conclusion
        </Text>

        <Input
          label="Conclusion"
          value={formData.article_content.conclusion}
          onChangeText={(value) => updateArticleContent('conclusion', value)}
          placeholder="Summarize key points and provide final thoughts..."
          multiline
          numberOfLines={4}
        />

        <Input
          label="Call to Action"
          value={formData.article_content.call_to_action}
          onChangeText={(value) => updateArticleContent('call_to_action', value)}
          placeholder="What should readers do next? (e.g., 'Try this technique in your next project')"
          multiline
          numberOfLines={2}
        />
      </View>

      {/* References and Resources */}
      <View style={[styles.referencesSection, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>
          📚 References & Resources
        </Text>

        <Input
          label="References"
          value={formData.article_content.references?.join('\n') || ''}
          onChangeText={(value) => updateArticleContent('references', value.split('\n').map(ref => ref.trim()).filter(ref => ref))}
          placeholder="List your sources and references (one per line)&#10;Example:&#10;Smith, J. (2023). Article Title. Journal Name.&#10;https://example.com/resource"
          multiline
          numberOfLines={6}
        />

        <Input
          label="Related Articles"
          value={formData.article_content.related_articles?.join(', ') || ''}
          onChangeText={(value) => updateArticleContent('related_articles', value.split(',').map(article => article.trim()).filter(article => article))}
          placeholder="Links to related articles (comma-separated)"
          multiline
        />
      </View>

      {/* Article Settings */}
      <View style={[styles.articleSettings, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>
          ⚙️ Article Settings
        </Text>

        <View style={styles.settingsRow}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>
            Generate Table of Contents
          </Text>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              { backgroundColor: formData.article_content.table_of_contents ? colors.success : colors.surface }
            ]}
            onPress={() => updateArticleContent('table_of_contents', !formData.article_content.table_of_contents)}
          >
            <Ionicons
              name={formData.article_content.table_of_contents ? "checkmark" : "close"}
              size={16}
              color={formData.article_content.table_of_contents ? colors.white : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.settingsRow}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>
            Enable Social Sharing
          </Text>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              { backgroundColor: formData.article_content.social_sharing ? colors.success : colors.surface }
            ]}
            onPress={() => updateArticleContent('social_sharing', !formData.article_content.social_sharing)}
          >
            <Ionicons
              name={formData.article_content.social_sharing ? "checkmark" : "close"}
              size={16}
              color={formData.article_content.social_sharing ? colors.white : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.settingsRow}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>
            Enable Comments
          </Text>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              { backgroundColor: formData.article_content.comments_enabled ? colors.success : colors.surface }
            ]}
            onPress={() => updateArticleContent('comments_enabled', !formData.article_content.comments_enabled)}
          >
            <Ionicons
              name={formData.article_content.comments_enabled ? "checkmark" : "close"}
              size={16}
              color={formData.article_content.comments_enabled ? colors.white : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Course Content Renderer
  const renderCourseContent = () => (
    <View style={styles.contentTypeSection}>
      <Text style={[styles.contentTypeTitle, { color: colors.text }]}>
        Course Structure
      </Text>
      <Text style={[styles.contentTypeDescription, { color: colors.textSecondary }]}>
        Create a comprehensive course with topics, subtopics, and detailed content
      </Text>

      <Input
        label="Course Outline"
        value={formData.course_structure.outline}
        onChangeText={(value) => updateCourseStructure('outline', value)}
        placeholder="Provide an overview of what this course covers..."
        multiline
        numberOfLines={4}
      />

      {formData.course_structure.topics.map((topic, index) => (
        <View key={index} style={[styles.topicCard, { backgroundColor: colors.surface }]}>
          <View style={styles.topicHeader}>
            <Text style={[styles.topicNumber, { color: colors.primary }]}>
              Topic {index + 1}
            </Text>
            <TouchableOpacity
              onPress={() => removeCourseTopic(index)}
              style={styles.removeButton}
            >
              <Ionicons name="close" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>

          <Input
            label="Topic Title"
            value={topic.title}
            onChangeText={(value) => updateCourseTopic(index, 'title', value)}
            placeholder="Topic title..."
          />

          <Input
            label="Topic Description"
            value={topic.description}
            onChangeText={(value) => updateCourseTopic(index, 'description', value)}
            placeholder="What will students learn in this topic..."
            multiline
            numberOfLines={3}
          />

          <Input
            label="Topic Learning Objectives"
            value={topic.learning_objectives?.join(', ') || ''}
            onChangeText={(value) => updateCourseTopic(index, 'learning_objectives', value.split(',').map(obj => obj.trim()).filter(obj => obj))}
            placeholder="What will students achieve? (comma-separated)"
            multiline
          />

          <Input
            label="Estimated Duration (minutes)"
            value={topic.estimated_duration?.toString() || '0'}
            onChangeText={(value) => updateCourseTopic(index, 'estimated_duration', parseInt(value) || 0)}
            placeholder="How long will this topic take?"
            keyboardType="numeric"
          />

          <Text style={[styles.fieldLabel, { color: colors.text }]}>Subtopics & Content</Text>
          {topic.subtopics.map((subtopic, subtopicIndex) => (
            <View key={subtopicIndex} style={[styles.subtopicCard, { backgroundColor: colors.background }]}>
              <View style={styles.subtopicHeader}>
                <Text style={[styles.subtopicNumber, { color: colors.info }]}>
                  Subtopic {subtopicIndex + 1}
                </Text>
                <TouchableOpacity
                  onPress={() => removeCourseSubtopic(index, subtopicIndex)}
                  style={styles.removeSubtopicButton}
                >
                  <Ionicons name="close" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>

              <Input
                label="Subtopic Title"
                value={subtopic.title || ''}
                onChangeText={(value) => updateCourseSubtopic(index, subtopicIndex, 'title', value)}
                placeholder="Subtopic title..."
              />

              <Input
                label="Content"
                value={subtopic.content || ''}
                onChangeText={(value) => updateCourseSubtopic(index, subtopicIndex, 'content', value)}
                placeholder="Detailed content for this subtopic..."
                multiline
                numberOfLines={6}
              />

              <View style={styles.contentTypeSelector}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Content Type</Text>
                <View style={styles.contentTypeButtons}>
                  {['text', 'video', 'image', 'mixed'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.contentTypeButton,
                        {
                          backgroundColor: subtopic.content_type === type ? colors.primary : colors.surface,
                          borderColor: colors.border
                        }
                      ]}
                      onPress={() => updateCourseSubtopic(index, subtopicIndex, 'content_type', type)}
                    >
                      <Text style={[
                        styles.contentTypeButtonText,
                        { color: subtopic.content_type === type ? colors.white : colors.text }
                      ]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Input
                label="Duration (minutes)"
                value={subtopic.estimated_duration?.toString() || '0'}
                onChangeText={(value) => updateCourseSubtopic(index, subtopicIndex, 'estimated_duration', parseInt(value) || 0)}
                placeholder="Time to complete this subtopic"
                keyboardType="numeric"
              />

              <Input
                label="Learning Objectives"
                value={subtopic.learning_objectives?.join(', ') || ''}
                onChangeText={(value) => updateCourseSubtopic(index, subtopicIndex, 'learning_objectives', value.split(',').map(obj => obj.trim()).filter(obj => obj))}
                placeholder="What will students learn? (comma-separated)"
                multiline
              />

              {/* Content Type Specific Fields */}
              {(subtopic.content_type === 'video' || subtopic.content_type === 'mixed') && (
                <View style={styles.mediaSection}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Video Content</Text>

                  <Input
                    label="Video URL"
                    value={subtopic.video_url || ''}
                    onChangeText={(value) => updateCourseSubtopic(index, subtopicIndex, 'video_url', value)}
                    placeholder="https://youtube.com/watch?v=... or upload video"
                  />

                  <TouchableOpacity
                    style={[styles.uploadButton, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                    onPress={() => handleVideoUpload(index, subtopicIndex)}
                  >
                    <Ionicons name="cloud-upload" size={20} color={colors.primary} />
                    <Text style={[styles.uploadButtonText, { color: colors.primary }]}>
                      Upload Video File
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {(subtopic.content_type === 'image' || subtopic.content_type === 'mixed') && (
                <View style={styles.mediaSection}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Image Content</Text>

                  <Input
                    label="Image URL"
                    value={subtopic.image_url || ''}
                    onChangeText={(value) => updateCourseSubtopic(index, subtopicIndex, 'image_url', value)}
                    placeholder="https://example.com/image.jpg or upload image"
                  />

                  <TouchableOpacity
                    style={[styles.uploadButton, { backgroundColor: colors.info + '20', borderColor: colors.info }]}
                    onPress={() => handleImageUpload(index, subtopicIndex)}
                  >
                    <Ionicons name="image" size={20} color={colors.info} />
                    <Text style={[styles.uploadButtonText, { color: colors.info }]}>
                      Upload Image File
                    </Text>
                  </TouchableOpacity>

                  {subtopic.image_url && (
                    <View style={styles.imagePreview}>
                      <Image
                        source={{ uri: subtopic.image_url }}
                        style={styles.previewImage}
                        resizeMode="cover"
                      />
                    </View>
                  )}
                </View>
              )}

              {subtopic.content_type === 'mixed' && (
                <View style={styles.mediaSection}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Additional Files</Text>

                  <TouchableOpacity
                    style={[styles.uploadButton, { backgroundColor: colors.success + '20', borderColor: colors.success }]}
                    onPress={() => handleDocumentUpload(index, subtopicIndex)}
                  >
                    <Ionicons name="document" size={20} color={colors.success} />
                    <Text style={[styles.uploadButtonText, { color: colors.success }]}>
                      Upload Documents/PDFs
                    </Text>
                  </TouchableOpacity>

                  {subtopic.documents && subtopic.documents.length > 0 && (
                    <View style={styles.documentsPreview}>
                      {subtopic.documents.map((doc, docIndex) => (
                        <View key={docIndex} style={[styles.documentItem, { backgroundColor: colors.surface }]}>
                          <Ionicons name="document-text" size={16} color={colors.text} />
                          <Text style={[styles.documentName, { color: colors.text }]} numberOfLines={1}>
                            {doc.name}
                          </Text>
                          <TouchableOpacity
                            onPress={() => removeDocument(index, subtopicIndex, docIndex)}
                            style={styles.removeDocButton}
                          >
                            <Ionicons name="close" size={14} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <Input
                label="Resources & References"
                value={subtopic.resources?.join(', ') || ''}
                onChangeText={(value) => updateCourseSubtopic(index, subtopicIndex, 'resources', value.split(',').map(res => res.trim()).filter(res => res))}
                placeholder="Additional reading, links, references (comma-separated)"
                multiline
              />

              <Input
                label="Examples"
                value={subtopic.examples?.join(', ') || ''}
                onChangeText={(value) => updateCourseSubtopic(index, subtopicIndex, 'examples', value.split(',').map(ex => ex.trim()).filter(ex => ex))}
                placeholder="Code examples, case studies, demonstrations (comma-separated)"
                multiline
              />

              {/* Media Content Status Indicators */}
              <View style={styles.mediaStatusContainer}>
                <Text style={[styles.mediaStatusTitle, { color: colors.textSecondary }]}>
                  Media Content Status:
                </Text>
                <View style={styles.mediaStatusIndicators}>
                  {subtopic.content_type === 'video' && (
                    <View style={[styles.mediaIndicator, {
                      backgroundColor: subtopic.video_url ? colors.success + '20' : colors.error + '20'
                    }]}>
                      <Ionicons
                        name={subtopic.video_url ? "checkmark-circle" : "alert-circle"}
                        size={16}
                        color={subtopic.video_url ? colors.success : colors.error}
                      />
                      <Text style={[styles.mediaIndicatorText, {
                        color: subtopic.video_url ? colors.success : colors.error
                      }]}>
                        Video {subtopic.video_url ? 'Added' : 'Required'}
                      </Text>
                    </View>
                  )}

                  {subtopic.content_type === 'image' && (
                    <View style={[styles.mediaIndicator, {
                      backgroundColor: subtopic.image_url ? colors.success + '20' : colors.error + '20'
                    }]}>
                      <Ionicons
                        name={subtopic.image_url ? "checkmark-circle" : "alert-circle"}
                        size={16}
                        color={subtopic.image_url ? colors.success : colors.error}
                      />
                      <Text style={[styles.mediaIndicatorText, {
                        color: subtopic.image_url ? colors.success : colors.error
                      }]}>
                        Image {subtopic.image_url ? 'Added' : 'Required'}
                      </Text>
                    </View>
                  )}

                  {subtopic.content_type === 'mixed' && (
                    <>
                      <View style={[styles.mediaIndicator, {
                        backgroundColor: subtopic.video_url ? colors.success + '20' : colors.warning + '20'
                      }]}>
                        <Ionicons
                          name={subtopic.video_url ? "checkmark-circle" : "ellipse-outline"}
                          size={16}
                          color={subtopic.video_url ? colors.success : colors.warning}
                        />
                        <Text style={[styles.mediaIndicatorText, {
                          color: subtopic.video_url ? colors.success : colors.warning
                        }]}>
                          Video {subtopic.video_url ? 'Added' : 'Optional'}
                        </Text>
                      </View>

                      <View style={[styles.mediaIndicator, {
                        backgroundColor: subtopic.image_url ? colors.success + '20' : colors.warning + '20'
                      }]}>
                        <Ionicons
                          name={subtopic.image_url ? "checkmark-circle" : "ellipse-outline"}
                          size={16}
                          color={subtopic.image_url ? colors.success : colors.warning}
                        />
                        <Text style={[styles.mediaIndicatorText, {
                          color: subtopic.image_url ? colors.success : colors.warning
                        }]}>
                          Image {subtopic.image_url ? 'Added' : 'Optional'}
                        </Text>
                      </View>

                      <View style={[styles.mediaIndicator, {
                        backgroundColor: (subtopic.documents && subtopic.documents.length > 0) ? colors.success + '20' : colors.warning + '20'
                      }]}>
                        <Ionicons
                          name={(subtopic.documents && subtopic.documents.length > 0) ? "checkmark-circle" : "ellipse-outline"}
                          size={16}
                          color={(subtopic.documents && subtopic.documents.length > 0) ? colors.success : colors.warning}
                        />
                        <Text style={[styles.mediaIndicatorText, {
                          color: (subtopic.documents && subtopic.documents.length > 0) ? colors.success : colors.warning
                        }]}>
                          Documents {(subtopic.documents && subtopic.documents.length > 0) ? `(${subtopic.documents.length})` : 'Optional'}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.addSubtopicButton, { backgroundColor: colors.info + '20' }]}
            onPress={() => addCourseSubtopic(index)}
          >
            <Ionicons name="add" size={16} color={colors.info} />
            <Text style={[styles.addSubtopicText, { color: colors.info }]}>
              Add Subtopic
            </Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.addTopicButton, { backgroundColor: colors.primary + '20' }]}
        onPress={addCourseTopic}
      >
        <Ionicons name="add" size={20} color={colors.primary} />
        <Text style={[styles.addTopicText, { color: colors.primary }]}>
          Add Topic
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Helper functions for Quiz management
  const addQuizQuestion = () => {
    const newQuestion = {
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      explanation: ''
    };
    updateFormData('quiz_questions', [...formData.quiz_questions, newQuestion]);
  };

  const removeQuizQuestion = (index) => {
    const updatedQuestions = formData.quiz_questions.filter((_, i) => i !== index);
    updateFormData('quiz_questions', updatedQuestions);
  };

  const updateQuizQuestion = (index, field, value) => {
    const updatedQuestions = [...formData.quiz_questions];
    updatedQuestions[index][field] = value;
    updateFormData('quiz_questions', updatedQuestions);

    // Debug logging for correct answer selection
    if (field === 'correctAnswer') {
      console.log(`🎯 Updated question ${index + 1} correct answer to option ${value + 1}:`, updatedQuestions[index].options[value]);
      console.log('📝 Full question data:', JSON.stringify(updatedQuestions[index], null, 2));
    }
  };

  const updateQuizOption = (questionIndex, optionIndex, value) => {
    const updatedQuestions = [...formData.quiz_questions];
    updatedQuestions[questionIndex].options[optionIndex] = value;
    updateFormData('quiz_questions', updatedQuestions);
  };

  // Helper functions for Article management
  const updateArticleContent = (field, value) => {
    const updatedContent = { ...formData.article_content };
    updatedContent[field] = value;
    updateFormData('article_content', updatedContent);
  };

  const addArticleSection = () => {
    const newSection = {
      headingType: 'h2',
      heading: '',
      content: '',
      image_url: '',
      image_caption: '',
      quote: '',
      order: formData.article_content.sections.length + 1
    };
    const updatedSections = [...formData.article_content.sections, newSection];
    updateArticleContent('sections', updatedSections);
  };

  const removeArticleSection = (index) => {
    const updatedSections = formData.article_content.sections.filter((_, i) => i !== index);
    updateArticleContent('sections', updatedSections);
  };

  const updateArticleSection = (index, field, value) => {
    const updatedSections = [...formData.article_content.sections];
    updatedSections[index][field] = value;
    updateArticleContent('sections', updatedSections);
  };

  // Helper functions for Course management
  const updateCourseStructure = (field, value) => {
    const updatedStructure = { ...formData.course_structure };
    updatedStructure[field] = value;
    updateFormData('course_structure', updatedStructure);
  };

  const addCourseTopic = () => {
    const newTopic = {
      title: '',
      description: '',
      learning_objectives: [],
      estimated_duration: 0, // in minutes
      subtopics: [{
        title: '',
        content: '',
        content_type: 'text', // 'text', 'video', 'image', 'mixed'
        estimated_duration: 0,
        learning_objectives: [],
        resources: [], // Additional reading materials, links, etc.
        examples: [], // Code examples, case studies, etc.
        exercises: [], // Practice questions, assignments
        // Media fields
        video_url: '',
        image_url: '',
        documents: []
      }]
    };
    const updatedTopics = [...formData.course_structure.topics, newTopic];
    updateCourseStructure('topics', updatedTopics);
  };

  const removeCourseTopic = (index) => {
    const updatedTopics = formData.course_structure.topics.filter((_, i) => i !== index);
    updateCourseStructure('topics', updatedTopics);
  };

  const updateCourseTopic = (index, field, value) => {
    const updatedTopics = [...formData.course_structure.topics];
    updatedTopics[index][field] = value;
    updateCourseStructure('topics', updatedTopics);
  };

  const addCourseSubtopic = (topicIndex) => {
    const newSubtopic = {
      title: '',
      content: '',
      content_type: 'text',
      estimated_duration: 0,
      learning_objectives: [],
      resources: [],
      examples: [],
      exercises: [],
      // Media fields
      video_url: '',
      image_url: '',
      documents: []
    };
    const updatedTopics = [...formData.course_structure.topics];
    updatedTopics[topicIndex].subtopics.push(newSubtopic);
    updateCourseStructure('topics', updatedTopics);
  };

  const removeCourseSubtopic = (topicIndex, subtopicIndex) => {
    const updatedTopics = [...formData.course_structure.topics];
    updatedTopics[topicIndex].subtopics = updatedTopics[topicIndex].subtopics.filter((_, i) => i !== subtopicIndex);
    updateCourseStructure('topics', updatedTopics);
  };

  const updateCourseSubtopic = (topicIndex, subtopicIndex, field, value) => {
    const updatedTopics = [...formData.course_structure.topics];
    updatedTopics[topicIndex].subtopics[subtopicIndex][field] = value;
    updateCourseStructure('topics', updatedTopics);
  };

  const addSubtopicObjective = (topicIndex, subtopicIndex) => {
    const updatedTopics = [...formData.course_structure.topics];
    updatedTopics[topicIndex].subtopics[subtopicIndex].learning_objectives.push('');
    updateCourseStructure('topics', updatedTopics);
  };

  const updateSubtopicObjective = (topicIndex, subtopicIndex, objectiveIndex, value) => {
    const updatedTopics = [...formData.course_structure.topics];
    updatedTopics[topicIndex].subtopics[subtopicIndex].learning_objectives[objectiveIndex] = value;
    updateCourseStructure('topics', updatedTopics);
  };

  const removeSubtopicObjective = (topicIndex, subtopicIndex, objectiveIndex) => {
    const updatedTopics = [...formData.course_structure.topics];
    updatedTopics[topicIndex].subtopics[subtopicIndex].learning_objectives =
      updatedTopics[topicIndex].subtopics[subtopicIndex].learning_objectives.filter((_, i) => i !== objectiveIndex);
    updateCourseStructure('topics', updatedTopics);
  };

  // Media upload handlers
  const handleVideoUpload = async (topicIndex, subtopicIndex) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['video/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        // Show loading indicator
        Alert.alert('Uploading', 'Please wait while your video is being uploaded...');

        // Upload to server
        const uploadResponse = await ApiService.uploadLearningVideo({
          uri: asset.uri,
          mimeType: asset.mimeType,
        });

        if (uploadResponse.success) {
          // Use the server URL
          const videoUrl = uploadResponse.video_url;
          updateCourseSubtopic(topicIndex, subtopicIndex, 'video_url', videoUrl);
          Alert.alert('Success', 'Video uploaded successfully!');
        } else {
          throw new Error(uploadResponse.error || 'Upload failed');
        }
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      Alert.alert('Error', 'Failed to upload video. Please try again.');
    }
  };

  const handleImageUpload = async (topicIndex, subtopicIndex) => {
    try {
      // For web platform, use file input
      if (Platform.OS === 'web') {
        console.log('🌐 Using web file input for image upload');
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        input.onchange = async (event) => {
          const file = event.target.files[0];
          if (file) {
            try {
              console.log('📁 Web file selected:', {
                name: file.name,
                size: file.size,
                type: file.type
              });

              // Show loading indicator
              Alert.alert('Uploading', 'Please wait while your image is being uploaded...');

              // Upload to server with actual File object
              const uploadResponse = await ApiService.uploadLearningImage({
                file: file,
              });

              if (uploadResponse.success) {
                // Use the server URL
                const imageUrl = uploadResponse.image_url;
                updateCourseSubtopic(topicIndex, subtopicIndex, 'image_url', imageUrl);
                Alert.alert('Success', 'Image uploaded successfully!');
              } else {
                throw new Error(uploadResponse.error || 'Upload failed');
              }
            } catch (error) {
              console.error('Error uploading web image:', error);
              Alert.alert('Error', 'Failed to upload image. Please try again.');
            }
          }
        };

        input.click();
        return;
      }

      // For mobile platforms, use ImagePicker
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        // Show loading indicator
        Alert.alert('Uploading', 'Please wait while your image is being uploaded...');

        // Upload to server
        const uploadResponse = await ApiService.uploadLearningImage({
          uri: asset.uri,
        });

        if (uploadResponse.success) {
          // Use the server URL
          const imageUrl = uploadResponse.image_url;
          updateCourseSubtopic(topicIndex, subtopicIndex, 'image_url', imageUrl);
          Alert.alert('Success', 'Image uploaded successfully!');
        } else {
          throw new Error(uploadResponse.error || 'Upload failed');
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    }
  };

  const handleDocumentUpload = async (topicIndex, subtopicIndex) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const updatedTopics = [...formData.course_structure.topics];
        const currentDocuments = updatedTopics[topicIndex].subtopics[subtopicIndex].documents || [];

        // Show loading indicator
        Alert.alert('Uploading', `Please wait while ${result.assets.length} document(s) are being uploaded...`);

        try {
          const newDocuments = [];

          // Upload each document to server
          for (const asset of result.assets) {
            const uploadResponse = await ApiService.uploadLearningDocument({
              uri: asset.uri,
              mimeType: asset.mimeType,
            });

            if (uploadResponse.success) {
              newDocuments.push({
                name: uploadResponse.original_name || asset.name,
                uri: uploadResponse.document_url,
                type: asset.mimeType,
                size: asset.size
              });
            } else {
              console.error('Failed to upload document:', asset.name);
            }
          }

          if (newDocuments.length > 0) {
            updatedTopics[topicIndex].subtopics[subtopicIndex].documents = [...currentDocuments, ...newDocuments];
            updateCourseStructure('topics', updatedTopics);
            Alert.alert('Success', `${newDocuments.length} document(s) uploaded successfully!`);
          } else {
            Alert.alert('Error', 'Failed to upload documents. Please try again.');
          }
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          Alert.alert('Error', 'Failed to upload documents. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error uploading documents:', error);
      Alert.alert('Error', 'Failed to upload documents. Please try again.');
    }
  };

  const removeDocument = (topicIndex, subtopicIndex, documentIndex) => {
    const updatedTopics = [...formData.course_structure.topics];
    updatedTopics[topicIndex].subtopics[subtopicIndex].documents =
      updatedTopics[topicIndex].subtopics[subtopicIndex].documents.filter((_, i) => i !== documentIndex);
    updateCourseStructure('topics', updatedTopics);
  };

  // Helper function to generate main content field based on course type
  const generateMainContent = (data) => {
    switch (data.type) {
      case 'video':
        return data.video_url || data.content || '';
      case 'quiz':
        if (data.quiz_questions && data.quiz_questions.length > 0) {
          return JSON.stringify({
            type: 'quiz',
            description: data.description,
            questions: data.quiz_questions
          });
        }
        return data.content || '';
      case 'article':
        if (data.article_content && data.article_content.sections && data.article_content.sections.length > 0) {
          return JSON.stringify({
            type: 'article',
            ...data.article_content
          });
        }
        return data.content || '';
      case 'course':
        if (data.course_structure && data.course_structure.topics && data.course_structure.topics.length > 0) {
          return JSON.stringify({
            type: 'course',
            description: data.description,
            ...data.course_structure
          });
        }
        return data.content || '';
      default:
        return data.content || '';
    }
  };

  // Article image upload handlers
  const handleArticleImageUpload = async (field) => {
    try {
      // For web platform, use file input
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        input.onchange = async (event) => {
          const file = event.target.files[0];
          if (file) {
            try {
              console.log('📁 Web article image selected:', file);

              // Show loading indicator
              Alert.alert('Uploading', 'Please wait while your image is being uploaded...');

              // Upload to server with actual File object
              const uploadResponse = await ApiService.uploadLearningImage({
                file: file,
              });

              if (uploadResponse.success) {
                // Use the server URL
                const imageUrl = uploadResponse.image_url;
                updateArticleContent(field, imageUrl);
                Alert.alert('Success', 'Image uploaded successfully!');
              } else {
                throw new Error(uploadResponse.error || 'Upload failed');
              }
            } catch (error) {
              console.error('Error uploading web article image:', error);
              Alert.alert('Error', 'Failed to upload image. Please try again.');
            }
          }
        };

        input.click();
        return;
      }

      // For mobile platforms, use ImagePicker
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        // Show loading indicator
        Alert.alert('Uploading', 'Please wait while your image is being uploaded...');

        try {
          // Upload to server
          const uploadResponse = await ApiService.uploadLearningImage({
            uri: asset.uri,
          });

          if (uploadResponse.success) {
            // Use the server URL
            const imageUrl = uploadResponse.image_url;
            updateArticleContent(field, imageUrl);
            Alert.alert('Success', 'Image uploaded successfully!');
          } else {
            throw new Error(uploadResponse.error || 'Upload failed');
          }
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          Alert.alert('Error', 'Failed to upload image. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error uploading article image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    }
  };

  const handleSectionImageUpload = async (sectionIndex) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        // Show loading indicator
        Alert.alert('Uploading', 'Please wait while your image is being uploaded...');

        try {
          // Upload to server
          const uploadResponse = await ApiService.uploadLearningImage({
            uri: asset.uri,
          });

          if (uploadResponse.success) {
            // Use the server URL
            const imageUrl = uploadResponse.image_url;
            updateArticleSection(sectionIndex, 'image_url', imageUrl);
            Alert.alert('Success', 'Section image uploaded successfully!');
          } else {
            throw new Error(uploadResponse.error || 'Upload failed');
          }
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          Alert.alert('Error', 'Failed to upload image. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error uploading section image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    }
  };

  const renderContentSection = () => {
    return (
      <View>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>
          Content Creation
        </Text>
        <Text style={[styles.fieldDescription, { color: colors.textSecondary }]}>
          Create content based on the selected type: {formData.type}
        </Text>

        {formData.type === 'quiz' && renderQuizContent()}
        {formData.type === 'video' && renderVideoContent()}
        {formData.type === 'article' && renderArticleContent()}
        {formData.type === 'course' && renderCourseContent()}

        <Input
          label="Thumbnail URL"
          value={formData.thumbnail_url}
          onChangeText={(value) => updateFormData('thumbnail_url', value)}
          placeholder="https://example.com/image.jpg"
        />

        {(formData.type === 'video' || formData.type === 'course') && (
          <View style={styles.durationRow}>
            <View style={styles.durationField}>
              <Input
                label="Duration (minutes)"
                value={formData.duration_minutes.toString()}
                onChangeText={(value) => updateFormData('duration_minutes', parseInt(value) || 0)}
                placeholder="30"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.durationField}>
              <Input
                label="Estimated Read Time"
                value={formData.estimated_read_time}
                onChangeText={(value) => updateFormData('estimated_read_time', value)}
                placeholder="5 min read"
              />
            </View>
          </View>
        )}

      <Text style={[styles.fieldLabel, { color: colors.text }]}>Tags</Text>
      <View style={styles.tagsContainer}>
        {formData.tags.map((tag, index) => (
          <View key={index} style={[styles.tag, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
            <TouchableOpacity onPress={() => removeTag(index)}>
              <Ionicons name="close" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ))}
        {showTagInput ? (
          <View style={styles.inlineInputContainer}>
            <Input
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="Enter tag..."
              style={styles.inlineInput}
              autoFocus
            />
            <View style={styles.inlineInputButtons}>
              <TouchableOpacity
                style={[styles.inlineButton, styles.cancelButton, { backgroundColor: colors.surface }]}
                onPress={() => {
                  setShowTagInput(false);
                  setTagInput('');
                }}
              >
                <Text style={[styles.inlineButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inlineButton, styles.addButton, { backgroundColor: colors.primary }]}
                onPress={addTag}
              >
                <Text style={[styles.inlineButtonText, { color: colors.white }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.addTagButton, { borderColor: colors.border }]}
            onPress={() => setShowTagInput(true)}
          >
            <Ionicons name="add" size={20} color={colors.textSecondary} />
            <Text style={[styles.addTagText, { color: colors.textSecondary }]}>Add Tag</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.fieldLabel, { color: colors.text }]}>Learning Objectives</Text>
      <View style={styles.objectivesContainer}>
        {formData.learning_objectives.map((objective, index) => (
          <View key={index} style={[styles.objectiveItem, { backgroundColor: colors.surface }]}>
            <Text style={[styles.objectiveText, { color: colors.text }]}>{objective}</Text>
            <TouchableOpacity onPress={() => removeObjective(index)}>
              <Ionicons name="close" size={16} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))}
        {showObjectiveInput ? (
          <View style={styles.inlineInputContainer}>
            <Input
              value={objectiveInput}
              onChangeText={setObjectiveInput}
              placeholder="Enter learning objective..."
              style={styles.inlineInput}
              autoFocus
              multiline
            />
            <View style={styles.inlineInputButtons}>
              <TouchableOpacity
                style={[styles.inlineButton, styles.cancelButton, { backgroundColor: colors.surface }]}
                onPress={() => {
                  setShowObjectiveInput(false);
                  setObjectiveInput('');
                }}
              >
                <Text style={[styles.inlineButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inlineButton, styles.addButton, { backgroundColor: colors.primary }]}
                onPress={addObjective}
              >
                <Text style={[styles.inlineButtonText, { color: colors.white }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.addObjectiveButton, { borderColor: colors.border }]}
            onPress={() => setShowObjectiveInput(true)}
          >
            <Ionicons name="add" size={20} color={colors.textSecondary} />
            <Text style={[styles.addObjectiveText, { color: colors.textSecondary }]}>Add Objective</Text>
          </TouchableOpacity>
        )}
      </View>
      </View>
    );
  };

  const renderSettings = () => (
    <View>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>Publication Status</Text>
      <View style={styles.statusRow}>
        {statusOptions.map((status) => (
          <TouchableOpacity
            key={status.value}
            style={[
              styles.statusButton,
              {
                backgroundColor: formData.status === status.value ? status.color + '20' : colors.surface,
                borderColor: formData.status === status.value ? status.color : colors.border,
              },
            ]}
            onPress={() => updateFormData('status', status.value)}
          >
            <Text style={[
              styles.statusText,
              { color: formData.status === status.value ? status.color : colors.text }
            ]}>
              {status.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleLeft}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>
            Featured Course
          </Text>
          <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
            Show this course prominently on the learning page
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.toggle,
            { backgroundColor: formData.is_featured ? colors.primary : colors.border }
          ]}
          onPress={() => updateFormData('is_featured', !formData.is_featured)}
        >
          <View style={[
            styles.toggleThumb,
            {
              backgroundColor: colors.white,
              transform: [{ translateX: formData.is_featured ? 20 : 2 }],
            },
          ]} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.fieldLabel, { color: colors.text }]}>Prerequisites</Text>
      <Text style={[styles.fieldDescription, { color: colors.textSecondary }]}>
        Select courses that users should complete before taking this course
      </Text>
      <View style={styles.prerequisitesContainer}>
        {formData.prerequisites.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            No prerequisites set
          </Text>
        ) : (
          formData.prerequisites.map((prereq, index) => (
            <View key={index} style={[styles.prerequisiteItem, { backgroundColor: colors.surface }]}>
              <Text style={[styles.prerequisiteText, { color: colors.text }]}>{prereq}</Text>
              <TouchableOpacity onPress={() => {
                updateFormData('prerequisites', formData.prerequisites.filter((_, i) => i !== index));
              }}>
                <Ionicons name="close" size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.previewSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Course Preview</Text>
        <View style={[styles.previewCard, { backgroundColor: colors.surface }]}>
          <View style={styles.previewHeader}>
            <View style={[styles.previewIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons
                name={getContentIcon(formData.type)}
                size={24}
                color={colors.primary}
              />
            </View>
            <View style={styles.previewMeta}>
              <View style={[styles.previewLevel, { backgroundColor: getLevelColor(formData.level) + '20' }]}>
                <Text style={[styles.previewLevelText, { color: getLevelColor(formData.level) }]}>
                  {formData.level.charAt(0).toUpperCase() + formData.level.slice(1)}
                </Text>
              </View>
              {formData.is_featured && (
                <View style={[styles.featuredBadge, { backgroundColor: colors.warning + '20' }]}>
                  <Ionicons name="star" size={12} color={colors.warning} />
                  <Text style={[styles.featuredText, { color: colors.warning }]}>Featured</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={[styles.previewTitle, { color: colors.text }]}>
            {formData.title || 'Course Title'}
          </Text>
          <Text style={[styles.previewDescription, { color: colors.textSecondary }]}>
            {formData.description || 'Course description will appear here'}
          </Text>
          <View style={styles.previewFooter}>
            <Text style={[styles.previewType, { color: colors.textTertiary }]}>
              {formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}
            </Text>
            <Text style={[styles.previewStatus, {
              color: statusOptions.find(s => s.value === formData.status)?.color || colors.textTertiary
            }]}>
              {formData.status.charAt(0).toUpperCase() + formData.status.slice(1)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

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
    const option = levelOptions.find(l => l.value === level);
    return option ? option.color : colors.textSecondary;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading course...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.content}>

      {renderStepIndicator()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.formCard}>
          {currentStep === 0 && renderBasicInfo()}
          {currentStep === 1 && renderContentSection()}
          {currentStep === 2 && renderSettings()}
        </Card>

        {/* Navigation Buttons */}
        <View style={styles.navigationButtons}>
          {currentStep > 0 && (
            <TouchableOpacity
              style={[styles.navButton, styles.prevButton, { backgroundColor: colors.surface }]}
              onPress={() => setCurrentStep(currentStep - 1)}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
              <Text style={[styles.navButtonText, { color: colors.text }]}>Previous</Text>
            </TouchableOpacity>
          )}

          {currentStep < steps.length - 1 && (
            <TouchableOpacity
              style={[styles.navButton, styles.nextButton, { backgroundColor: colors.primary }]}
              onPress={() => setCurrentStep(currentStep + 1)}
            >
              <Text style={[styles.navButtonText, { color: colors.white }]}>Next</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Save Button - positioned as floating action button */}
      <TouchableOpacity
        style={[styles.floatingSaveButton, { backgroundColor: colors.primary }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Ionicons name="checkmark" size={24} color={colors.white} />
        )}
      </TouchableOpacity>
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingSaveButton: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    zIndex: 1000,
  },
  content: {
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
  saveButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: spacing.xs,
  },
  stepText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  stepLine: {
    position: 'absolute',
    top: 16,
    left: '50%',
    right: '-50%',
    height: 2,
    zIndex: -1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  formCard: {
    padding: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  optionButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    marginBottom: spacing.sm,
  },
  optionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  levelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  levelText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    marginHorizontal: spacing.xs,
  },
  typeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  durationField: {
    width: '48%',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  tagText: {
    fontSize: typography.fontSize.sm,
    marginRight: spacing.xs,
  },
  addTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  addTagText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.xs,
  },
  objectivesContainer: {
    marginBottom: spacing.md,
  },
  objectiveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  objectiveText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
  },
  addObjectiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addObjectiveText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  statusButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  toggleLeft: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  toggleDescription: {
    fontSize: typography.fontSize.sm,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  fieldDescription: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
  },
  prerequisitesContainer: {
    marginBottom: spacing.md,
  },
  prerequisiteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  prerequisiteText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: spacing.lg,
  },
  previewSection: {
    marginTop: spacing.lg,
  },
  previewCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  previewIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewLevel: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  previewLevelText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  featuredText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  previewTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  previewDescription: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.md,
  },
  previewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewType: {
    fontSize: typography.fontSize.sm,
  },
  previewStatus: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minWidth: 100,
  },
  prevButton: {
    justifyContent: 'flex-start',
  },
  nextButton: {
    justifyContent: 'flex-end',
    marginLeft: 'auto',
  },
  navButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginHorizontal: spacing.sm,
  },
  // Content Type Specific Styles
  contentTypeSection: {
    marginBottom: spacing.xl,
  },
  contentTypeTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
  },
  contentTypeDescription: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  // Quiz Styles
  questionCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  questionNumber: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  removeButton: {
    padding: spacing.xs,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  correctAnswerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  addQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'transparent',
  },
  addQuestionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
  },
  // Article Styles
  sectionCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionNumber: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  headingTypeButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  headingTypeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  headingTypeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  addSectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'transparent',
  },
  addSectionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
  },
  // Course Styles
  topicCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  topicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  topicNumber: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  subtopicRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  removeSubtopicButton: {
    padding: spacing.xs,
    marginBottom: spacing.sm,
  },
  addSubtopicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'transparent',
    marginTop: spacing.sm,
  },
  addSubtopicText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  addTopicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'transparent',
  },
  addTopicText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
  },
  // Inline Input Styles
  inlineInputContainer: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inlineInput: {
    marginBottom: spacing.md,
  },
  inlineInputButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inlineButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addButton: {
    // Primary button styling handled by backgroundColor
  },
  inlineButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  // Enhanced course structure styles
  subtopicCard: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  subtopicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  subtopicNumber: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  removeSubtopicButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
  },
  contentTypeSelector: {
    marginBottom: spacing.md,
  },
  contentTypeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  contentTypeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  contentTypeButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  // Media upload styles
  mediaSection: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  uploadButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  imagePreview: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
  },
  documentsPreview: {
    marginTop: spacing.md,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  documentName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
  },
  removeDocButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
  },
  // Media status indicator styles
  mediaStatusContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  mediaStatusTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  mediaStatusIndicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  mediaIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  mediaIndicatorText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  // Enhanced article editor styles
  metadataSection: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  headerImageSection: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  tagsSection: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  sectionsContainer: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  enhancedSectionCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  enhancedHeadingButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 60,
  },
  headingTypeDesc: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  sectionImageContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  headerImagePreview: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
  },
  sectionImagePreview: {
    width: '100%',
    height: 150,
    borderRadius: borderRadius.md,
  },
  conclusionSection: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  referencesSection: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  articleSettings: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  settingLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  toggleButton: {
    width: 40,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
});

export default CreateLearningCourseScreen;
