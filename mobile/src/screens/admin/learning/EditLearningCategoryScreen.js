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
import Input from '../../../components/common/Input';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import ApiService from '../../../services/api';

const EditLearningCategoryScreen = ({ navigation, route }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const { categoryId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    color: '#3B82F6',
    sort_order: 0,
    is_active: true,
  });

  useEffect(() => {
    loadCategory();
  }, [categoryId]);

  const loadCategory = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getLearningCategory(categoryId);
      if (response.success) {
        setCategory(response.data);
        setFormData({
          name: response.data.name || '',
          description: response.data.description || '',
          icon: response.data.icon || '',
          color: response.data.color || '#3B82F6',
          sort_order: response.data.sort_order || 0,
          is_active: response.data.is_active !== false,
        });
      } else {
        throw new Error(response.error || 'Failed to load category');
      }
    } catch (error) {
      console.error('Failed to load category:', error);
      Alert.alert('Error', error.message || 'Failed to load category');
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
      if (!formData.name.trim()) {
        Alert.alert('Validation Error', 'Category name is required');
        return;
      }

      setSaving(true);
      const response = await ApiService.updateLearningCategory(categoryId, formData);
      
      if (response.success) {
        Alert.alert('Success', 'Category updated successfully!', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        throw new Error(response.error || 'Failed to update category');
      }
    } catch (error) {
      console.error('Failed to update category:', error);
      Alert.alert('Error', error.message || 'Failed to update category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Category',
      'Are you sure you want to delete this category? This action cannot be undone.',
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
      const response = await ApiService.deleteLearningCategory(categoryId);
      
      if (response.success) {
        Alert.alert('Success', 'Category deleted successfully!', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        throw new Error(response.error || 'Failed to delete category');
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
      Alert.alert('Error', error.message || 'Failed to delete category');
    } finally {
      setSaving(false);
    }
  };

  const colorOptions = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
    '#F97316', '#6366F1', '#14B8A6', '#F43F5E',
  ];

  const iconOptions = [
    'book-outline', 'laptop-outline', 'bulb-outline', 'school-outline',
    'library-outline', 'calculator-outline', 'flask-outline', 'brush-outline',
    'musical-notes-outline', 'fitness-outline', 'business-outline', 'globe-outline',
  ];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading category...
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
            Edit Category
          </Text>

          <Input
            label="Category Name"
            value={formData.name}
            onChangeText={(value) => updateFormData('name', value)}
            placeholder="Enter category name"
            required
          />

          <Input
            label="Description"
            value={formData.description}
            onChangeText={(value) => updateFormData('description', value)}
            placeholder="Enter category description"
            multiline
            numberOfLines={3}
          />

          <Text style={[styles.fieldLabel, { color: colors.text }]}>Icon</Text>
          <View style={styles.iconGrid}>
            {iconOptions.map((icon) => (
              <TouchableOpacity
                key={icon}
                style={[
                  styles.iconOption,
                  {
                    backgroundColor: formData.icon === icon ? colors.primary + '20' : colors.surface,
                    borderColor: formData.icon === icon ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => updateFormData('icon', icon)}
              >
                <Ionicons
                  name={icon}
                  size={24}
                  color={formData.icon === icon ? colors.primary : colors.text}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.text }]}>Color</Text>
          <View style={styles.colorGrid}>
            {colorOptions.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorOption,
                  {
                    backgroundColor: color,
                    borderColor: formData.color === color ? colors.text : 'transparent',
                    borderWidth: formData.color === color ? 3 : 0,
                  },
                ]}
                onPress={() => updateFormData('color', color)}
              >
                {formData.color === color && (
                  <Ionicons name="checkmark" size={16} color={colors.white} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Sort Order"
            value={formData.sort_order.toString()}
            onChangeText={(value) => updateFormData('sort_order', parseInt(value) || 0)}
            placeholder="0"
            keyboardType="numeric"
          />

          <View style={styles.switchContainer}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>
              Active
            </Text>
            <TouchableOpacity
              style={[
                styles.switch,
                {
                  backgroundColor: formData.is_active ? colors.success : colors.border,
                },
              ]}
              onPress={() => updateFormData('is_active', !formData.is_active)}
            >
              <View
                style={[
                  styles.switchThumb,
                  {
                    backgroundColor: colors.white,
                    transform: [{ translateX: formData.is_active ? 20 : 2 }],
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
            title="Delete Category"
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
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
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

export default EditLearningCategoryScreen;
