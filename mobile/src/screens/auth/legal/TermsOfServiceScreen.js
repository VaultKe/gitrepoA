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
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';

const TermsOfServiceScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const sections = [
    {
      title: "1. ABOUT VAULTKE",
      content: `VaultKe is a digital financial platform licensed to operate in Kenya, providing:
• Chama (investment group) management services
• Digital savings and investment solutions
• Peer-to-peer lending within groups
• Financial literacy and education
• Secure transaction processing
• Group financial planning tools

Our mission is to democratize access to financial services and empower Kenyan communities through technology-driven group savings and investment solutions.`
    },
    {
      title: "2. ACCEPTANCE OF TERMS",
      content: `By creating an account or using VaultKe services, you agree to:
• These Terms of Service
• Our Privacy Policy
• All applicable Kenyan laws and regulations
• Central Bank of Kenya (CBK) guidelines
• Anti-Money Laundering (AML) requirements

If you do not agree to these terms, you must not use our services. We may update these terms periodically, and continued use constitutes acceptance of changes.`
    },
    {
      title: "3. ELIGIBILITY AND REGISTRATION",
      content: `To use VaultKe, you must:
• Be at least 18 years old
• Be a Kenyan citizen or legal resident
• Provide accurate and complete information
• Have a valid Kenyan National ID
• Own a registered mobile phone number
• Have access to a bank account or mobile money service

You are responsible for maintaining the confidentiality of your account credentials and all activities under your account.`
    },
    {
      title: "4. SERVICES PROVIDED",
      content: `VaultKe facilitates:

Chama Management:
• Group creation and member management
• Contribution tracking and reminders
• Meeting scheduling and minutes
• Financial reporting and transparency

Financial Services:
• Secure money transfers between members
• Group savings and investment tracking
• Loan applications and approvals within groups
• Interest calculations and payment schedules

Additional Features:
• Financial education resources
• Communication tools for members
• Data analytics and insights`
    },
    {
      title: "5. USER RESPONSIBILITIES",
      content: `You agree to:
• Provide accurate and truthful information
• Comply with all applicable laws
• Use services only for lawful purposes
• Respect other users' rights and privacy
• Pay all fees and charges promptly
• Report suspicious activities immediately
• Maintain adequate funds for transactions
• Keep your contact information updated

You must NOT:
• Use the platform for illegal activities
• Impersonate others or create fake accounts
• Attempt to hack or disrupt our systems
• Share your login credentials
• Engage in fraudulent transactions`
    },
    {
      title: "6. FINANCIAL REGULATIONS COMPLIANCE",
      content: `VaultKe operates under Kenyan financial regulations:

Central Bank of Kenya (CBK):
• We comply with payment system regulations
• Transaction limits as per CBK guidelines
• Regular reporting to regulatory authorities
• Anti-money laundering (AML) compliance

Know Your Customer (KYC):
• Identity verification is mandatory
• We may request additional documentation
• Suspicious activities are reported to FRC
• Account monitoring for compliance

Consumer Protection:
• Fair treatment of all users
• Transparent fee structures
• Complaint resolution mechanisms
• Regular audits and assessments`
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
          Terms of Service
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
            Welcome to VaultKe! These Terms of Service govern your use of our digital financial platform. Please read them carefully.
          </Text>
        </View>

        {sections.map(renderSection)}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            7. FEES AND CHARGES
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text }]}>
            VaultKe charges fees for certain services:
            {
}
• Transaction fees (as disclosed before each transaction)
            {
}
• Monthly subscription fees for premium features
            {
}
• Loan processing fees (percentage of loan amount)
            {
}
• Late payment penalties as per agreed terms
            {
}
• Third-party charges (bank fees, mobile money charges)
            {
}
            
            All fees are clearly disclosed before you incur them. We reserve the right to change fees with 30 days' notice.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            8. LOANS AND CREDIT
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text }]}>
            Loan services are subject to:
            {
}
• Group approval and guarantee requirements
            {
}
• Interest rates as agreed by the chama
            {
}
• Repayment schedules and penalties
            {
}
• Credit assessment and approval process
            {
}
• Reporting to Credit Reference Bureaus (CRBs)
            {
}
            
            Defaulting on loans may result in:
            {
}
• Account suspension
            {
}
• Negative credit reporting
            {
}
• Legal action for recovery
            {
}
• Exclusion from future credit facilities
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            9. LIMITATION OF LIABILITY
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text }]}>
            VaultKe's liability is limited to the extent permitted by Kenyan law:
            {
}
• We are not liable for losses due to user error
            {
}
• System downtime or technical failures
            {
}
• Third-party service provider issues
            {
}
• Market fluctuations affecting investments
            {
}
• Actions of other chama members
            {
}
            
            Our maximum liability is limited to the fees paid by you in the 12 months preceding the claim.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            10. DISPUTE RESOLUTION
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text }]}>
            Disputes will be resolved through:
            {
}
1. Direct negotiation with our customer service
            {
}
2. Mediation through recognized institutions
            {
}
3. Arbitration under Kenyan Arbitration Act
            {
}
4. Kenyan courts as the final resort
            {
}
            
            You may also lodge complaints with:
            {
}
• Central Bank of Kenya (CBK)
            {
}
• Competition Authority of Kenya
            {
}
• Consumer Federation of Kenya (COFEK)
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            11. TERMINATION
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text }]}>
            Either party may terminate this agreement:
            {
}
• You may close your account at any time
            {
}
• We may suspend/terminate for breach of terms
            {
}
• Outstanding obligations survive termination
            {
}
• Data retention as per our Privacy Policy
            {
}
• Refunds processed as per our refund policy
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            12. CONTACT INFORMATION
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text }]}>
            For questions about these terms:
            {
}
Email: legal@vaultke.com
            {
}
Phone: +254 700 000 000
            {
}
Address: VaultKe Limited, Nairobi, Kenya
            {
}
Website: www.vaultke.com
            {
}
            
            Customer Support: support@vaultke.com
            {
}
Business Hours: Monday - Friday, 8:00 AM - 6:00 PM EAT
          </Text>
        </View>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            These Terms of Service are governed by the laws of Kenya. By using VaultKe, you acknowledge that you have read, understood, and agree to be bound by these terms.
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

export default TermsOfServiceScreen;
