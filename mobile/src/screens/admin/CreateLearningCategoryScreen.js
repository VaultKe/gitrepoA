import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import ApiService from '../../services/api';
import useSmartNavigation from '../../hooks/useSmartNavigation';

const CreateLearningCategoryScreen = ({ navigation, route }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const { goBack } = useSmartNavigation();
  
  const isEditing = route.params?.categoryId;
  const categoryId = route.params?.categoryId;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'book',
    color: '#6366f1',
    sort_order: 0,
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const iconOptions = [
    { name: 'book', label: 'Book', category: 'education' },
    { name: 'calculator', label: 'Calculator', category: 'finance' },
    { name: 'trending-up', label: 'Trending Up', category: 'business' },
    { name: 'people', label: 'People', category: 'social' },
    { name: 'wallet', label: 'Wallet', category: 'finance' },
    { name: 'home', label: 'Home', category: 'lifestyle' },
    { name: 'business', label: 'Business', category: 'business' },
    { name: 'school', label: 'School', category: 'education' },
    { name: 'library', label: 'Library', category: 'education' },
    { name: 'analytics', label: 'Analytics', category: 'business' },
    { name: 'heart', label: 'Health', category: 'lifestyle' },
    { name: 'leaf', label: 'Environment', category: 'lifestyle' },
    { name: 'bulb', label: 'Innovation', category: 'business' },
    { name: 'globe', label: 'Global', category: 'social' },
    { name: 'rocket', label: 'Growth', category: 'business' },
    { name: 'shield', label: 'Security', category: 'business' },
  ];

  const colorOptions = [
    { color: '#6366f1', name: 'Indigo', gradient: ['#6366f1', '#8b5cf6'] },
    { color: '#8b5cf6', name: 'Purple', gradient: ['#8b5cf6', '#a855f7'] },
    { color: '#06b6d4', name: 'Cyan', gradient: ['#06b6d4', '#0891b2'] },
    { color: '#10b981', name: 'Emerald', gradient: ['#10b981', '#059669'] },
    { color: '#f59e0b', name: 'Amber', gradient: ['#f59e0b', '#d97706'] },
    { color: '#ef4444', name: 'Red', gradient: ['#ef4444', '#dc2626'] },
    { color: '#ec4899', name: 'Pink', gradient: ['#ec4899', '#db2777'] },
    { color: '#84cc16', name: 'Lime', gradient: ['#84cc16', '#65a30d'] },
    { color: '#3b82f6', name: 'Blue', gradient: ['#3b82f6', '#2563eb'] },
    { color: '#f97316', name: 'Orange', gradient: ['#f97316', '#ea580c'] },
    { color: '#14b8a6', name: 'Teal', gradient: ['#14b8a6', '#0d9488'] },
    { color: '#a78bfa', name: 'Violet', gradient: ['#a78bfa', '#8b5cf6'] },
  ];

  useEffect(() => {
    if (isEditing) {
      loadCategory();
    }
  }, [isEditing, categoryId]);

  const loadCategory = async () => {
    try {
      setLoading(true);
      // In a real app, you'd have an API endpoint to get a single category
      const response = await ApiService.getLearningCategories();
      if (response.success) {
        const category = response.categories.find(c => c.id === categoryId);
        if (category) {
          setFormData({
            name: category.name,
            description: category.description || '',
            icon: category.icon || 'book',
            color: category.color || '#6366f1',
            sort_order: category.sort_order || 0,
            is_active: category.is_active,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load category:', error);
      Alert.alert('Error', 'Failed to load category data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Category name is required.');
      return;
    }

    try {
      setSaving(true);
      let response;
      
      if (isEditing) {
        response = await ApiService.updateLearningCategory(categoryId, formData);
      } else {
        response = await ApiService.createLearningCategory(formData);
      }

      if (response.success) {
        Alert.alert(
          'Success',
          `Category ${isEditing ? 'updated' : 'created'} successfully!`,
          [
            {
              text: 'OK',
              onPress: () => goBack(),
            },
          ]
        );
      } else {
        throw new Error(response.error || `Failed to ${isEditing ? 'update' : 'create'} category`);
      }
    } catch (error) {
      console.error('Failed to save category:', error);
      Alert.alert('Error', error.message || `Failed to ${isEditing ? 'update' : 'create'} category.`);
    } finally {
      setSaving(false);
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };



  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading category...
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.formCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Basic Information
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
            placeholder="Enter category description (optional)"
            multiline
            numberOfLines={3}
          />

          <Input
            label="Sort Order"
            value={formData.sort_order.toString()}
            onChangeText={(value) => updateFormData('sort_order', parseInt(value) || 0)}
            placeholder="0"
            keyboardType="numeric"
          />
        </Card>

        <Card style={styles.formCard}>
          <View style={styles.appearanceHeader}>
            <View style={[styles.appearanceIcon, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="color-palette" size={24} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Appearance
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                Choose an icon and color that represents your category
              </Text>
            </View>
          </View>

          <View style={styles.iconSection}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>
              Choose Icon
            </Text>
            <Text style={[styles.fieldDescription, { color: colors.textSecondary }]}>
              Select an icon that best represents your category
            </Text>
            <View style={styles.iconGrid}>
              {iconOptions.map((option, index) => {
                const isSelected = formData.icon === option.name;
                return (
                  <TouchableOpacity
                    key={option.name}
                    style={[
                      styles.iconOption,
                      {
                        backgroundColor: isSelected ? formData.color + '20' : colors.surface,
                        borderColor: isSelected ? formData.color : colors.border,
                        transform: [{ scale: isSelected ? 1.05 : 1 }],
                        shadowColor: isSelected ? formData.color : 'transparent',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: isSelected ? 0.3 : 0,
                        shadowRadius: 8,
                        elevation: isSelected ? 8 : 2,
                      },
                    ]}
                    onPress={() => updateFormData('icon', option.name)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={option.name}
                      size={28}
                      color={isSelected ? formData.color : colors.text}
                    />
                    <Text style={[
                      styles.iconLabel,
                      {
                        color: isSelected ? formData.color : colors.textTertiary,
                        fontWeight: isSelected ? '600' : '400'
                      }
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.colorSection}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>
              Choose Color
            </Text>
            <Text style={[styles.fieldDescription, { color: colors.textSecondary }]}>
              Pick a vibrant color that makes your category stand out
            </Text>
            <View style={styles.colorGrid}>
              {colorOptions.map((colorOption, index) => {
                const isSelected = formData.color === colorOption.color;
                return (
                  <TouchableOpacity
                    key={colorOption.color}
                    style={[
                      styles.colorOption,
                      {
                        backgroundColor: colorOption.color,
                        borderColor: isSelected ? colors.text : 'transparent',
                        borderWidth: isSelected ? 3 : 0,
                        transform: [{ scale: isSelected ? 1.1 : 1 }],
                        shadowColor: colorOption.color,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: isSelected ? 0.4 : 0.2,
                        shadowRadius: isSelected ? 12 : 6,
                        elevation: isSelected ? 12 : 4,
                      },
                    ]}
                    onPress={() => updateFormData('color', colorOption.color)}
                    activeOpacity={0.8}
                  >
                    {isSelected && (
                      <View style={styles.colorCheckmark}>
                        <Ionicons name="checkmark" size={20} color={colors.white} />
                      </View>
                    )}
                    <Text style={[styles.colorName, { color: colors.white }]}>
                      {colorOption.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Live Preview */}
          <View style={styles.livePreview}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>
              Live Preview
            </Text>
            <View style={[styles.previewContainer, { backgroundColor: colors.surface }]}>
              <View style={[styles.previewIcon, { backgroundColor: formData.color + '20' }]}>
                <Ionicons
                  name={formData.icon}
                  size={32}
                  color={formData.color}
                />
              </View>
              <View style={styles.previewText}>
                <Text style={[styles.previewTitle, { color: colors.text }]}>
                  {formData.name || 'Category Name'}
                </Text>
                <Text style={[styles.previewDescription, { color: colors.textSecondary }]}>
                  This is how your category will appear
                </Text>
              </View>
            </View>
          </View>
        </Card>

        <Card style={styles.formCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Status
          </Text>

          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => updateFormData('is_active', !formData.is_active)}
          >
            <View style={styles.toggleLeft}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>
                Active
              </Text>
              <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                Category will be visible to users
              </Text>
            </View>
            <View style={[
              styles.toggle,
              { backgroundColor: formData.is_active ? colors.primary : colors.border }
            ]}>
              <View style={[
                styles.toggleThumb,
                {
                  backgroundColor: colors.white,
                  transform: [{ translateX: formData.is_active ? 20 : 2 }],
                },
              ]} />
            </View>
          </TouchableOpacity>
        </Card>


      </ScrollView>
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
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
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


  formCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
  },
  appearanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  appearanceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconSection: {
    marginBottom: spacing.xl,
  },
  colorSection: {
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  fieldDescription: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  iconOption: {
    width: '22%',
    aspectRatio: 0.85,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconLabel: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  colorOption: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  colorCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorName: {
    position: 'absolute',
    bottom: 6,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
  },
  livePreview: {
    marginTop: spacing.md,
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginTop: spacing.sm,
  },
  previewIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  previewText: {
    flex: 1,
  },
  previewTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  previewDescription: {
    fontSize: typography.fontSize.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
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

});

export default CreateLearningCategoryScreen;
