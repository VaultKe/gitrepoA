import React, { useState, useMemo } from 'react';
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
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import ApiService from '../../../services/api';
import Toast from 'react-native-toast-message';

const FAQ_DATA = [
  {
    id: 1,
    category: 'account',
    question: 'How do I create a VaultKe account?',
    answer: 'To create an account:\n1. Download the VaultKe app\n2. Tap "Sign Up"\n3. Enter your phone number and email\n4. Verify your phone number with the SMS code\n5. Complete your profile information\n6. Set up your security PIN',
  },
  {
    id: 2,
    category: 'account',
    question: 'How do I reset my password?',
    answer: 'To reset your password:\n1. Go to the login screen\n2. Tap "Forgot Password"\n3. Enter your registered email address\n4. Check your email for reset instructions\n5. Follow the link to create a new password',
  },
  {
    id: 3,
    category: 'chama',
    question: 'What is a Chama?',
    answer: 'A Chama is a traditional savings group where members contribute money regularly. VaultKe digitizes this process, making it easier to:\n• Track contributions\n• Manage loans\n• Monitor group finances\n• Communicate with members\n• Access group funds securely',
  },
  {
    id: 4,
    category: 'chama',
    question: 'How do I join a Chama?',
    answer: 'To join a Chama:\n1. Browse available Chamas in the "Browse Chamas" section\n2. Or get invited by an existing member\n3. Review the Chama rules and contribution requirements\n4. Tap "Request to Join"\n5. Wait for approval from Chama administrators\n6. Once approved, you can start contributing',
  },
  {
    id: 5,
    category: 'chama',
    question: 'How do I create my own Chama?',
    answer: 'To create a Chama:\n1. Go to "My Chamas" and tap "Create New Chama"\n2. Fill in Chama details (name, description, rules)\n3. Set contribution amounts and frequency\n4. Define member roles and permissions\n5. Invite initial members\n6. Launch your Chama once you have enough members',
  },
  {
    id: 6,
    category: 'payments',
    question: 'How do I make contributions?',
    answer: 'To make contributions:\n1. Go to your Chama dashboard\n2. Tap "Contribute"\n3. Select contribution type (regular, special, etc.)\n4. Enter the amount\n5. Choose payment method (wallet, M-Pesa, bank)\n6. Confirm the transaction\n7. You\'ll receive a confirmation receipt',
  },
  {
    id: 7,
    category: 'payments',
    question: 'What payment methods are supported?',
    answer: 'VaultKe supports:\n• VaultKe Wallet (instant transfers)\n• M-Pesa (mobile money)\n• Bank transfers\n• Debit/Credit cards\n• Direct bank deposits\n\nAll transactions are secured with bank-level encryption.',
  },
  {
    id: 8,
    category: 'payments',
    question: 'How do I withdraw money?',
    answer: 'To withdraw money:\n1. Go to your Wallet\n2. Tap "Withdraw"\n3. Enter the amount\n4. Select withdrawal method (M-Pesa, bank account)\n5. Confirm your PIN\n6. Processing time: M-Pesa (instant), Bank (1-3 business days)',
  },
  {
    id: 9,
    category: 'security',
    question: 'Is my money safe with VaultKe?',
    answer: 'Yes, your money is protected by:\n• Bank-level encryption (256-bit SSL)\n• Secure payment processing\n• Licensed financial institution partnerships\n• Regular security audits\n• Two-factor authentication\n• Transaction monitoring\n• Insurance coverage for deposits',
  },
  {
    id: 10,
    category: 'security',
    question: 'How do I enable two-factor authentication?',
    answer: 'To enable 2FA:\n1. Go to Settings > Security Settings\n2. Toggle "Two-Factor Authentication"\n3. Choose your preferred method (SMS, email, or authenticator app)\n4. Follow the setup instructions\n5. Verify with a test code\n6. 2FA will be required for sensitive actions',
  },
];

const FAQ_CATEGORIES = [
  { id: 'all', label: 'All Topics', icon: 'apps' },
  { id: 'account', label: 'Account', icon: 'person-circle' },
  { id: 'chama', label: 'Chama', icon: 'people' },
  { id: 'payments', label: 'Payments', icon: 'card' },
  { id: 'security', label: 'Security', icon: 'shield-checkmark' },
];

const ContactSupportScreen = ({ navigation }) => {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [faqSearch, setFaqSearch] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState(null);

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

  const filteredFAQs = useMemo(() => {
    return FAQ_DATA.filter((faq) => {
      const matchesCategory = selectedCategory === '' || selectedCategory === 'all' || faq.category === selectedCategory;
      const matchesSearch = faqSearch === '' || faq.question.toLowerCase().includes(faqSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, faqSearch]);

  const toggleFAQ = (id) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

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

        setSelectedCategory('');
        setSubject('');
        setDescription('');
        setPriority('medium');

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

  const renderFAQItem = (item) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.faqItem, { borderColor: colors.border }]}
      onPress={() => toggleFAQ(item.id)}
    >
      <View style={styles.faqHeader}>
        <Text style={[styles.faqQuestion, { color: colors.text }]}>
          {item.question}
        </Text>
        <Ionicons
          name={expandedFAQ === item.id ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textSecondary}
        />
      </View>
      {expandedFAQ === item.id && (
        <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
          {item.answer}
        </Text>
      )}
    </TouchableOpacity>
  );

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

          {/* FAQ Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Frequently Asked Questions
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                  marginBottom: spacing.sm,
                },
              ]}
              placeholder="Search questions..."
              placeholderTextColor={colors.textSecondary}
              value={faqSearch}
              onChangeText={setFaqSearch}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
              {FAQ_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: (selectedCategory === '' && category.id === 'all') || selectedCategory === category.id ? colors.primary : colors.surface,
                      borderColor: (selectedCategory === '' && category.id === 'all') || selectedCategory === category.id ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedCategory(category.id === 'all' ? '' : category.id)}
                >
                  <Ionicons
                    name={category.icon}
                    size={16}
                    color={(selectedCategory === '' && category.id === 'all') || selectedCategory === category.id ? colors.white : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.categoryText,
                      {
                        color: (selectedCategory === '' && category.id === 'all') || selectedCategory === category.id ? colors.white : colors.text,
                      },
                    ]}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {filteredFAQs.length > 0 ? (
              filteredFAQs.map(renderFAQItem)
            ) : (
              <View style={styles.noResults}>
                <Text style={[styles.noResultsText, { color: colors.textSecondary }]}>
                  No questions found
                </Text>
              </View>
            )}
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
  categoriesContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  categoryChip: {
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
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  faqItem: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  faqQuestion: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    marginRight: spacing.sm,
  },
  faqAnswer: {
    padding: spacing.md,
    paddingTop: 0,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  noResultsText: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    marginTop: spacing.md,
    textAlign: 'center',
  },
});

export default ContactSupportScreen;
