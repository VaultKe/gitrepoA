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
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import ApiService from '../../services/api';

const EditLearningCourseScreen = ({ navigation, route }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const { courseId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [course, setCourse] = useState(null);
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
    // Enhanced content fields
    video_url: '',
    quiz_questions: [],
    article_content: {
      headline_image: '',
      sections: []
    },
    course_structure: {
      topics: [],
      outline: ''
    }
  });

  useEffect(() => {
    loadData();
  }, [courseId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load course and categories in parallel
      const [courseResponse, categoriesResponse] = await Promise.all([
        ApiService.getLearningCourse(courseId),
        ApiService.getLearningCategories()
      ]);

      if (courseResponse.success) {
        setCourse(courseResponse.data);
        setFormData({
          title: courseResponse.data.title || '',
          description: courseResponse.data.description || '',
          category_id: courseResponse.data.category_id || '',
          level: courseResponse.data.level || 'beginner',
          type: courseResponse.data.type || 'article',
          content: courseResponse.data.content || '',
          thumbnail_url: courseResponse.data.thumbnail_url || '',
          duration_minutes: courseResponse.data.duration_minutes || 0,
          estimated_read_time: courseResponse.data.estimated_read_time || '',
          tags: courseResponse.data.tags || [],
          prerequisites: courseResponse.data.prerequisites || [],
          learning_objectives: courseResponse.data.learning_objectives || [],
          status: courseResponse.data.status || 'draft',
          is_featured: courseResponse.data.is_featured || false,
          // Enhanced content fields
          video_url: courseResponse.data.video_url || '',
          quiz_questions: courseResponse.data.quiz_questions || [],
          article_content: courseResponse.data.article_content || {
            headline_image: '',
            sections: []
          },
          course_structure: courseResponse.data.course_structure || {
            topics: [],
            outline: ''
          }
        });
      } else {
        throw new Error(courseResponse.error || 'Failed to load course');
      }

      if (categoriesResponse.success) {
        setCategories(categoriesResponse.data || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert('Error', error.message || 'Failed to load course data');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      // Validate required fields
      if (!formData.title.trim()) {
        Alert.alert('Validation Error', 'Course title is required');
        return;
      }
      if (!formData.description.trim()) {
        Alert.alert('Validation Error', 'Course description is required');
        return;
      }
      if (!formData.category_id) {
        Alert.alert('Validation Error', 'Please select a category');
        return;
      }

      setSaving(true);
      const response = await ApiService.updateLearningCourse(courseId, formData);
      
      if (response.success) {
        Alert.alert('Success', 'Course updated successfully!', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        throw new Error(response.error || 'Failed to update course');
      }
    } catch (error) {
      console.error('Failed to update course:', error);
      Alert.alert('Error', error.message || 'Failed to update course');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Course',
      'Are you sure you want to delete this course? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ]
    );
  };

  const confirmDelete = async () => {
    try {
      setSaving(true);
      const response = await ApiService.deleteLearningCourse(courseId);
      
      if (response.success) {
        Alert.alert('Success', 'Course deleted successfully!', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        throw new Error(response.error || 'Failed to delete course');
      }
    } catch (error) {
      console.error('Failed to delete course:', error);
      Alert.alert('Error', error.message || 'Failed to delete course');
    } finally {
      setSaving(false);
    }
  };

  const renderCategoryPicker = () => (
    <View style={styles.pickerContainer}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>Category *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryOption,
              {
                backgroundColor: formData.category_id === category.id 
                  ? colors.primary + '20' 
                  : colors.surface,
                borderColor: formData.category_id === category.id 
                  ? colors.primary 
                  : colors.border,
              },
            ]}
            onPress={() => updateFormData('category_id', category.id)}
          >
            <Ionicons
              name={category.icon || 'folder-outline'}
              size={20}
              color={formData.category_id === category.id ? colors.primary : colors.text}
            />
            <Text
              style={[
                styles.categoryText,
                {
                  color: formData.category_id === category.id ? colors.primary : colors.text,
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

  const renderTypePicker = () => (
    <View style={styles.pickerContainer}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>Course Type *</Text>
      <View style={styles.typeGrid}>
        {[
          { value: 'article', label: 'Article', icon: 'document-text-outline' },
          { value: 'video', label: 'Video', icon: 'videocam-outline' },
          { value: 'course', label: 'Course', icon: 'school-outline' },
          { value: 'quiz', label: 'Quiz', icon: 'help-circle-outline' },
        ].map((type) => (
          <TouchableOpacity
            key={type.value}
            style={[
              styles.typeOption,
              {
                backgroundColor: formData.type === type.value 
                  ? colors.primary + '20' 
                  : colors.surface,
                borderColor: formData.type === type.value 
                  ? colors.primary 
                  : colors.border,
              },
            ]}
            onPress={() => updateFormData('type', type.value)}
          >
            <Ionicons
              name={type.icon}
              size={24}
              color={formData.type === type.value ? colors.primary : colors.text}
            />
            <Text
              style={[
                styles.typeText,
                {
                  color: formData.type === type.value ? colors.primary : colors.text,
                },
              ]}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderLevelPicker = () => (
    <View style={styles.pickerContainer}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>Difficulty Level *</Text>
      <View style={styles.levelGrid}>
        {[
          { value: 'beginner', label: 'Beginner', color: colors.success },
          { value: 'intermediate', label: 'Intermediate', color: colors.warning },
          { value: 'advanced', label: 'Advanced', color: colors.error },
        ].map((level) => (
          <TouchableOpacity
            key={level.value}
            style={[
              styles.levelOption,
              {
                backgroundColor: formData.level === level.value 
                  ? level.color + '20' 
                  : colors.surface,
                borderColor: formData.level === level.value 
                  ? level.color 
                  : colors.border,
              },
            ]}
            onPress={() => updateFormData('level', level.value)}
          >
            <Text
              style={[
                styles.levelText,
                {
                  color: formData.level === level.value ? level.color : colors.text,
                  fontWeight: formData.level === level.value ? 'bold' : 'normal',
                },
              ]}
            >
              {level.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.formCard}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Edit Course
          </Text>

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

          {renderCategoryPicker()}
          {renderTypePicker()}
          {renderLevelPicker()}

          <Input
            label="Thumbnail URL"
            value={formData.thumbnail_url}
            onChangeText={(value) => updateFormData('thumbnail_url', value)}
            placeholder="https://example.com/image.jpg"
          />

          <View style={styles.statusContainer}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Status</Text>
            <View style={styles.statusGrid}>
              {[
                { value: 'draft', label: 'Draft', color: colors.textSecondary },
                { value: 'published', label: 'Published', color: colors.success },
                { value: 'archived', label: 'Archived', color: colors.warning },
              ].map((status) => (
                <TouchableOpacity
                  key={status.value}
                  style={[
                    styles.statusOption,
                    {
                      backgroundColor: formData.status === status.value 
                        ? status.color + '20' 
                        : colors.surface,
                      borderColor: formData.status === status.value 
                        ? status.color 
                        : colors.border,
                    },
                  ]}
                  onPress={() => updateFormData('status', status.value)}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color: formData.status === status.value ? status.color : colors.text,
                        fontWeight: formData.status === status.value ? 'bold' : 'normal',
                      },
                    ]}
                  >
                    {status.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.switchContainer}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>
              Featured Course
            </Text>
            <TouchableOpacity
              style={[
                styles.switch,
                {
                  backgroundColor: formData.is_featured ? colors.success : colors.border,
                },
              ]}
              onPress={() => updateFormData('is_featured', !formData.is_featured)}
            >
              <View
                style={[
                  styles.switchThumb,
                  {
                    backgroundColor: colors.white,
                    transform: [{ translateX: formData.is_featured ? 20 : 2 }],
                  },
                ]}
              />
            </TouchableOpacity>
          </View>
        </Card>

        <View style={styles.buttonContainer}>
          <Button
            title="Save Changes"
            onPress={handleSave}
            loading={saving}
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
          />

          <Button
            title="Delete Course"
            onPress={handleDelete}
            loading={saving}
            style={[styles.deleteButton, { backgroundColor: colors.error }]}
          />
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
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
  },
  formCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  pickerContainer: {
    marginBottom: spacing.md,
  },
  categoryScroll: {
    marginBottom: spacing.sm,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    marginRight: spacing.sm,
    gap: spacing.sm,
  },
  categoryText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeOption: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    gap: spacing.sm,
  },
  typeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  levelGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  levelOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
  },
  levelText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  statusContainer: {
    marginTop: spacing.md,
  },
  statusGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  switchLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  switch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    position: 'relative',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: 'absolute',
  },
  buttonContainer: {
    gap: spacing.md,
  },
  saveButton: {
    marginBottom: spacing.sm,
  },
  deleteButton: {
    // Specific styles for delete button
  },
});

export default EditLearningCourseScreen;
