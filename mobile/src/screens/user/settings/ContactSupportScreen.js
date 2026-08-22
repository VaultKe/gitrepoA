import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import useContactSupportScreen from '../../../hooks/useContactSupportScreen';

const ContactSupportScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const {
    theme: _theme,
    user: _user,
    selectedIssue,
    description,
    priority,
    contactMethod,
    issueTypes,
    priorityLevels,
    contactMethods,
    setSelectedIssue,
    setDescription,
    setPriority,
    setContactMethod,
    handleSubmitTicket,
    handleDirectContact,
  } = useContactSupportScreen({ navigation });

  const renderIssueType = (issue) => (
    <TouchableOpacity
      key={issue.id}
      style={[
        styles.issueType,
        {
          backgroundColor: selectedIssue === issue.id ? colors.primary + '20' : colors.surface,
          borderColor: selectedIssue === issue.id ? colors.primary : colors.border,
        },
      ]}
      onPress={() => setSelectedIssue(issue.id)}
    >
      <Ionicons
        name={issue.icon}
        size={24}
        color={selectedIssue === issue.id ? colors.primary : colors.textSecondary}
      />
      <Text
        style={[
          styles.issueTypeText,
          {
            color: selectedIssue === issue.id ? colors.primary : colors.text,
          },
        ]}
      >
        {issue.label}
      </Text>
    </TouchableOpacity>
  );

  const renderPriorityLevel = (level) => (
    <TouchableOpacity
      key={level.id}
      style={[
        styles.priorityLevel,
        {
          backgroundColor: priority === level.id ? colors.primary + '20' : colors.surface,
          borderColor: priority === level.id ? colors.primary : colors.border,
        },
      ]}
      onPress={() => setPriority(level.id)}
    >
      <View style={styles.priorityContent}>
        <Text
          style={[
            styles.priorityLabel,
            { color: priority === level.id ? colors.primary : colors.text },
          ]}
        >
          {level.label}
        </Text>
        <Text
          style={[
            styles.priorityDescription,
            { color: priority === level.id ? colors.primary : colors.textSecondary },
          ]}
        >
          {level.description}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderContactMethod = (method) => (
    <TouchableOpacity
      key={method.id}
      style={[
        styles.contactMethod,
        {
          backgroundColor: contactMethod === method.id ? colors.primary + '20' : colors.surface,
          borderColor: contactMethod === method.id ? colors.primary : colors.border,
        },
      ]}
      onPress={() => setContactMethod(method.id)}
    >
      <Ionicons
        name={method.icon}
        size={20}
        color={contactMethod === method.id ? colors.primary : colors.textSecondary}
      />
      <View style={styles.contactMethodContent}>
        <Text
          style={[
            styles.contactMethodLabel,
            { color: contactMethod === method.id ? colors.primary : colors.text },
          ]}
        >
          {method.label}
        </Text>
        <Text
          style={[
            styles.contactMethodDescription,
            { color: contactMethod === method.id ? colors.primary : colors.textSecondary },
          ]}
        >
          {method.description}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with icon */}
      <View style={styles.headerContainer}>
        <Ionicons name="chatbubble-ellipses" size={32} color={colors.primary} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Contact Support
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Get personalized help from our support team
        </Text>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Issue Type Selection */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            What can we help you with?
          </Text>
          <View style={styles.issueTypesGrid}>
            {issueTypes.map(renderIssueType)}
          </View>
        </Card>

        {/* Description */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Describe your issue
          </Text>
          <TextInput
            style={[
              styles.descriptionInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder="Please provide as much detail as possible..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={5}
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
          />
        </Card>

        {/* Priority Level */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Priority Level
          </Text>
          <View style={styles.priorityGrid}>
            {priorityLevels.map(renderPriorityLevel)}
          </View>
        </Card>

        {/* Contact Method */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            How should we contact you?
          </Text>
          <View style={styles.contactMethodsGrid}>
            {contactMethods.map(renderContactMethod)}
          </View>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.primary }]}
            onPress={handleSubmitTicket}
          >
            <Text style={[styles.submitButtonText, { color: colors.white }]}>
              Create Support Ticket
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.directContactButton, { borderColor: colors.primary }]}
            onPress={() => handleDirectContact(contactMethod)}
          >
            <Text style={[styles.directContactButtonText, { color: colors.primary }]}>
              Contact Directly via {contactMethods.find(m => m.id === contactMethod)?.label}
            </Text>
          </TouchableOpacity>
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
    padding: spacing.md,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  headerContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
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
  issueTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  issueType: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minWidth: '48%',
    marginBottom: spacing.sm,
  },
  issueTypeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
  },
  descriptionInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    minHeight: 120,
  },
  priorityGrid: {
    gap: spacing.sm,
  },
  priorityLevel: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  priorityContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  priorityDescription: {
    fontSize: typography.fontSize.sm,
  },
  contactMethodsGrid: {
    gap: spacing.sm,
  },
  contactMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  contactMethodContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  contactMethodLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  contactMethodDescription: {
    fontSize: typography.fontSize.sm,
  },
  actionButtons: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  submitButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  directContactButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  directContactButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
});

export default ContactSupportScreen;
