import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const PrivacyPolicyScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const sections = [
    {
      title: "1. INTRODUCTION",
      content: `VaultKe is a digital financial platform that facilitates chama (investment group) management, savings, loans, and financial services in Kenya. This Privacy Policy explains how we collect, use, protect, and share your personal information in compliance with the Data Protection Act, 2019 of Kenya and other applicable laws.

By using VaultKe, you consent to the collection and use of your information as described in this policy.`
    },
    {
      title: "2. INFORMATION WE COLLECT",
      content: `Personal Information:
• Full name, email address, phone number
• Date of birth and gender
• Physical address and location data
• Employment information and income details
• Mpesa TILL and PAYBILL details and mobile money information

Financial Information:
• Transaction history and payment records
• Credit history and loan repayment data
• Savings and investment records
• Chama membership and contribution history

Technical Information:
• Device information and unique identifiers
• IP address and location data
• App usage patterns and preferences
• Communication records within the platform`
    },
    {
      title: "3. HOW WE USE YOUR INFORMATION",
      content: `We use your information to:
• Provide chama management and financial services
• Process transactions and maintain accurate records
• Verify your identity (KYC compliance)
• Assess creditworthiness for loans
• Send notifications about your account and transactions
• Comply with Central Bank of Kenya (CBK) regulations
• Prevent fraud and ensure platform security
• Improve our services and user experience
• Communicate important updates and offers`
    },
    {
      title: "4. LEGAL BASIS FOR PROCESSING",
      content: `Under the Data Protection Act, 2019, we process your data based on:
• Consent: When you agree to use our services
• Contract: To fulfill our obligations under user agreements
• Legal Obligation: To comply with CBK, KRA, and other regulatory requirements
• Legitimate Interest: To prevent fraud and improve services
• Vital Interest: To protect your financial security`
    },
    {
      title: "5. DATA SHARING AND DISCLOSURE",
      content: `We may share your information with:
• Chama members (limited to relevant financial data)
• Payment processors and banks for transactions
• Credit reference bureaus (with your consent)
• Regulatory authorities (CBK, FRC, DCI) when required by law
• Service providers under strict confidentiality agreements
• Law enforcement agencies when legally required

We DO NOT sell your personal data to third parties.`
    },
    {
      title: "6. DATA SECURITY",
      content: `We implement robust security measures:
• End-to-end encryption for sensitive data
• Secure servers hosted in certified data centers
• Multi-factor authentication
• Regular security audits and penetration testing
• Staff training on data protection
• Incident response procedures

Despite our efforts, no system is 100% secure. We will notify you of any significant data breaches within 72 hours as required by law.`
    }
  ];

  const renderSection = (section, index) => (
    <View key={index} style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>
        {section.title}
      </Text>
      <Text style={[styles.sectionContent, { color: colors.text }]}>
        {section.content}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Privacy Policy
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introSection}>
          <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
            Last Updated: January 2025
          </Text>
          <Text style={[styles.introText, { color: colors.text }]}>
            Your privacy is important to us. This policy explains how VaultKe handles your personal information in accordance with Kenyan law.
          </Text>
        </View>

        {sections.map(renderSection)}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            7. YOUR RIGHTS
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text }]}>
            Under the Data Protection Act, 2019, you have the right to:
            {'\n'}• Access your personal data
            {'\n'}• Correct inaccurate information
            {'\n'}• Delete your data (subject to legal requirements)
            {'\n'}• Restrict processing of your data
            {'\n'}• Data portability
            {'\n'}• Object to processing
            {'\n'}• Withdraw consent at any time
            {'\n'}• Lodge a complaint with the Data Protection Commissioner
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            8. DATA RETENTION
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text }]}>
            We retain your data for as long as necessary to provide services and comply with legal obligations:
            {'\n'}• Account information: Duration of account plus 7 years
            {'\n'}• Transaction records: 7 years (CBK requirement)
            {'\n'}• Communication records: 3 years
            {'\n'}• Marketing data: Until you opt out
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            9. INTERNATIONAL TRANSFERS
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text }]}>
            Your data is primarily stored in Kenya. If we transfer data internationally, we ensure adequate protection through:
            {'\n'}• Adequacy decisions by the Data Protection Commissioner
            {'\n'}• Standard contractual clauses
            {'\n'}• Binding corporate rules
            {'\n'}• Your explicit consent
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            10. CONTACT INFORMATION
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text }]}>
            For privacy-related inquiries, contact our Data Protection Officer:
            {'\n'}Email: privacy@vaultke.com
            {'\n'}Phone: +254 700 000 000
            {'\n'}Address: VaultKe Limited, Nairobi, Kenya
            {'\n'}
            {'\n'}Data Protection Commissioner: www.odpc.go.ke
          </Text>
        </View>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            This Privacy Policy is governed by the laws of Kenya. Any disputes will be resolved in Kenyan courts.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  introSection: {
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    marginBottom: spacing.lg,
  },
  lastUpdated: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  introText: {
    fontSize: typography.fontSize.base,
    lineHeight: 24,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  sectionContent: {
    fontSize: typography.fontSize.base,
    lineHeight: 24,
    textAlign: 'justify',
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: spacing.lg,
    marginTop: spacing.xl,
  },
  footerText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default PrivacyPolicyScreen;
