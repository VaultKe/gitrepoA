import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography } from '../../../utils/theme';
import ApiService from '../../../services/api';
import Toast from 'react-native-toast-message';

const ContactSupportScreen = ({ navigation }) => {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [loading, setLoading] = useState(false);

  const supportCategories = [
    { id: 'account', label: 'Account Issues', icon: 'person-outline' },
    { id: 'payment', label: 'Payment Problems', icon: 'card-outline' },
    { id: 'chama', label: 'Chama Management', icon: 'people-outline' },
    { id: 'technical', label: 'Technical Issues', icon: 'bug-outline' },
    { id: 'other', label: 'Other', icon: 'help-outline' },
  ];

  const priorityLevels = [
    { id: 'low', label: 'Low', color: colors.success },
    { id: 'medium', label: 'Medium', color: colors.warning },
    { id: 'high', label: 'High', color: colors.error },
    { id: 'urgent', label: 'Urgent', color: colors.error },
  ];

  const handleSubmit = async () => {
    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a support category');
      return;
    }

    if (!subject.trim()) {
      Alert.alert('Error', 'Please enter a subject');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please describe your issue');
      return;
    }

    try {
      setLoading(true);

      const supportRequest = {
        category: selectedCategory,
        subject: subject.trim(),
        description: description.trim(),
        priority,
        userInfo: {
          userId: user?.id,
          email: user?.email,
          firstName: user?.firstName,
          lastName: user?.lastName,
        },
      };

      const response = await ApiService.createSupportRequest(supportRequest);

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Support Request Submitted',
          text2: 'We will get back to you within 24 hours',
        });

        // Reset form
        setSelectedCategory('');
        setSubject('');
        setDescription('');
        setPriority('medium');

        // Navigate back after a short delay
        setTimeout(() => {
          navigation.goBack();
        }, 2000);
      } else {
        throw new Error(response.error || 'Failed to submit support request');
      }
    } catch (error) {
      console.error('Support request error:', error);
      Alert.alert('Error', error.message || 'Failed to submit support request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              Contact Support
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              We're here to help! Describe your issue and we'll get back to you.
            </Text>
          </View>

          {/* Support Categories */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              What can we help you with?
            </Text>
            <View style={styles.categoriesGrid}>
              {supportCategories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: selectedCategory === category.id ? colors.primary : colors.border,
                      borderWidth: selectedCategory === category.id ? 2 : 1,
                    },
                  ]}
                  onPress={() => setSelectedCategory(category.id)}
                >
                  <Ionicons
                    name={category.icon}
                    size={24}
                    color={selectedCategory === category.id ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.categoryLabel,
                      {
                        color: selectedCategory === category.id ? colors.primary : colors.text,
                        fontWeight: selectedCategory === category.id ? 'bold' : 'normal',
                      },
                    ]}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Priority Level */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Priority Level
            </Text>
            <View style={styles.priorityRow}>
              {priorityLevels.map((level) => (
                <TouchableOpacity
                  key={level.id}
                  style={[
                    styles.priorityButton,
                    {
                      backgroundColor: priority === level.id ? level.color + '20' : colors.surface,
                      borderColor: priority === level.id ? level.color : colors.border,
                    },
                  ]}
                  onPress={() => setPriority(level.id)}
                >
                  <Text
                    style={[
                      styles.priorityText,
                      {
                        color: priority === level.id ? level.color : colors.text,
                        fontWeight: priority === level.id ? 'bold' : 'normal',
                      },
                    ]}
                  >
                    {level.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Subject */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Subject
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="Brief summary of your issue"
              placeholderTextColor={colors.textSecondary}
              value={subject}
              onChangeText={setSubject}
              maxLength={100}
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Description
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="Please provide detailed information about your issue..."
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              maxLength={1000}
            />
            <Text style={[styles.charCount, { color: colors.textSecondary }]}>
              {description.length}/1000 characters
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              {
                backgroundColor: colors.primary,
                opacity: loading ? 0.7 : 1,
              },
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={[styles.submitButtonText, { color: colors.white }]}>
              {loading ? 'Submitting...' : 'Submit Support Request'}
            </Text>
          </TouchableOpacity>

          {/* Contact Info */}
          <View style={[styles.contactInfo, { backgroundColor: colors.surface }]}>
            <Text style={[styles.contactTitle, { color: colors.text }]}>
              Need immediate help?
            </Text>
            <Text style={[styles.contactText, { color: colors.textSecondary }]}>
              For urgent issues, you can also reach us at:
            </Text>
            <Text style={[styles.contactDetail, { color: colors.primary }]}>
              📧 support@vaultke.com
            </Text>
            <Text style={[styles.contactDetail, { color: colors.primary }]}>
              📞 +254 700 000 000
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: 'bold',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    lineHeight: 22,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  categoryCard: {
    width: '47%',
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  categoryLabel: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priorityButton: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  priorityText: {
    fontSize: typography.fontSize.sm,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    minHeight: 120,
  },
  charCount: {
    textAlign: 'right',
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  submitButton: {
    padding: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  submitButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: 'bold',
  },
  contactInfo: {
    padding: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.xl,
  },
  contactTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: 'bold',
    marginBottom: spacing.sm,
  },
  contactText: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.md,
  },
  contactDetail: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.xs,
  },
});

export default ContactSupportScreen;
