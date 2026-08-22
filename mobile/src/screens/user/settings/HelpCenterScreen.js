import React from 'react';
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
import useHelpCenterScreen from '../../../hooks/useHelpCenterScreen';

const HelpCenterScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const {
    theme: _theme,
    searchQuery,
    expandedFAQ,
    selectedCategory,
    categories,
    faqData,
    quickActions,
    filteredFAQs,
    setSearchQuery,
    setExpandedFAQ,
    setSelectedCategory,
    toggleFAQ,
  } = useHelpCenterScreen({ navigation });

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
