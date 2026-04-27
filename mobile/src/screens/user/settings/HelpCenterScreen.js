import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';

const HelpCenterScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'All Topics', icon: 'apps' },
    { id: 'account', label: 'Account', icon: 'person-circle' },
    { id: 'chama', label: 'Chama', icon: 'people' },
    { id: 'payments', label: 'Payments', icon: 'card' },
    { id: 'security', label: 'Security', icon: 'shield-checkmark' },
    { id: 'marketplace', label: 'Marketplace', icon: 'storefront' },
  ];

  const faqData = [
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

  const quickActions = [
    {
      id: 1,
      title: 'Contact Support',
      description: 'Get personalized help',
      icon: 'chatbubble',
      color: colors.primary,
      onPress: () => navigation.navigate('ContactSupport'),
    },
    {
      id: 2,
      title: 'Video Tutorials',
      description: 'Watch how-to guides',
      icon: 'play-circle',
      color: colors.info,
      onPress: () => {
        // TODO: Navigate to video tutorials or open external link
        Alert.alert('Coming Soon', 'Video tutorials will be available soon!');
      },
    },
    {
      id: 3,
      title: 'Community Forum',
      description: 'Connect with other users',
      icon: 'people',
      color: colors.success,
      onPress: () => {
        // TODO: Navigate to community forum
        Alert.alert('Coming Soon', 'Community forum will be available soon!');
      },
    },
  ];

  const filteredFAQs = faqData.filter(faq => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleFAQ = (id) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const renderCategory = (category) => (
    <TouchableOpacity
      key={category.id}
      style={[ 
        styles.categoryChip,
        {
          backgroundColor: selectedCategory === category.id ? colors.primary : colors.surface,
          borderColor: selectedCategory === category.id ? colors.primary : colors.border,
        },
      ]}
      onPress={() => setSelectedCategory(category.id)}
    >
      <Ionicons
        name={category.icon}
        size={16}
        color={selectedCategory === category.id ? colors.white : colors.textSecondary}
      />
      <Text
        style={[ 
          styles.categoryText,
          {
            color: selectedCategory === category.id ? colors.white : colors.text,
          },
        ]}
      >
        {category.label}
      </Text>
    </TouchableOpacity>
  );

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

  const renderQuickAction = (action) => (
    <TouchableOpacity
      key={action.id}
      style={[styles.quickAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={action.onPress}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: action.color + '20' }]}>
        <Ionicons name={action.icon} size={24} color={action.color} />
      </View>
      <View style={styles.quickActionContent}>
        <Text style={[styles.quickActionTitle, { color: colors.text }]}>
          {action.title}
        </Text>
        <Text style={[styles.quickActionDescription, { color: colors.textSecondary }]}>
          {action.description}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="help-circle" size={32} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Help Center
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Find answers to frequently asked questions
          </Text>
        </View>

       {/* Quick Actions */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Quick Actions
          </Text>
          {quickActions.map(renderQuickAction)}
        </Card>

        {/* Categories */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Browse by Category
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
            {categories.map(renderCategory)}
          </ScrollView>
        </Card>

        {/* FAQ Section */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {selectedCategory === 'all' ? 'All Questions' : `${categories.find(c => c.id === selectedCategory)?.label} Questions`}
            {searchQuery && ` (${filteredFAQs.length} results)`}
          </Text>
          {filteredFAQs.length > 0 ? (
            filteredFAQs.map(renderFAQItem)
          ) : (
            <View style={styles.noResults}>
              <Ionicons name="search" size={48} color={colors.textSecondary} />
              <Text style={[styles.noResultsText, { color: colors.textSecondary }]}>
                No results found for "{searchQuery}"
              </Text>
              <Text style={[styles.noResultsSubtext, { color: colors.textSecondary }]}>
                Try different keywords or contact support for help
              </Text>
            </View>
          )}
        </Card>
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
    padding: spacing.md,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  searchSection: {
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    marginLeft: spacing.sm,
  },
  section: {
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  quickActionDescription: {
    fontSize: typography.fontSize.sm,
  },
  categoriesContainer: {
    flexDirection: 'row',
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
    fontWeight: typography.fontWeight.medium,
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
    fontWeight: typography.fontWeight.medium,
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
    paddingVertical: spacing.xl,
  },
  noResultsText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

export default HelpCenterScreen;