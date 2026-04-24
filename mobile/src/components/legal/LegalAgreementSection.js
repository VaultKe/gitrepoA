import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const LegalAgreementSection = ({ 
  acceptedTerms, 
  onAcceptTerms, 
  onNavigateToTerms, 
  onNavigateToPrivacy,
  error 
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const [showLegalModal, setShowLegalModal] = useState(false);

  const keyPoints = [
    {
      icon: 'shield-checkmark',
      title: 'Data Protection',
      description: 'Your personal data is protected under Kenya\'s Data Protection Act, 2019'
    },
    {
      icon: 'business',
      title: 'Financial Regulation',
      description: 'VaultKe operates under Central Bank of Kenya (CBK) guidelines and regulations'
    },
    {
      icon: 'people',
      title: 'Chama Services',
      description: 'Digital platform for group savings, loans, and investment management'
    },
    {
      icon: 'lock-closed',
      title: 'Security',
      description: 'Bank-level encryption and security measures protect your financial data'
    },
    {
      icon: 'document-text',
      title: 'Transparency',
      description: 'Clear terms, fair fees, and full disclosure of all charges and processes'
    },
    {
      icon: 'call',
      title: 'Support',
      description: '24/7 customer support and complaint resolution mechanisms'
    }
  ];

  const renderKeyPoint = (point, index) => (
    <View key={index} style={styles.keyPointItem}>
      <View style={[styles.keyPointIcon, { backgroundColor: colors.primary + '20' }]}>
        <Ionicons name={point.icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.keyPointContent}>
        <Text style={[styles.keyPointTitle, { color: colors.text }]}>
          {point.title}
        </Text>
        <Text style={[styles.keyPointDescription, { color: colors.textSecondary }]}>
          {point.description}
        </Text>
      </View>
    </View>
  );

  const LegalModal = () => (
    <Modal
      visible={showLegalModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowLegalModal(false)}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            About VaultKe Legal Terms
          </Text>
          <TouchableOpacity
            onPress={() => setShowLegalModal(false)}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.introSection}>
            <Text style={[styles.introTitle, { color: colors.primary }]}>
              Welcome to VaultKe
            </Text>
            <Text style={[styles.introText, { color: colors.text }]}>
              VaultKe is Kenya's leading digital chama platform, designed to empower communities through technology-driven financial services. Before you join our platform, please understand these key aspects:
            </Text>
          </View>

          <View style={styles.keyPointsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Key Features & Protections
            </Text>
            {keyPoints.map(renderKeyPoint)}
          </View>

          <View style={styles.legalSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Legal Framework
            </Text>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              VaultKe operates under Kenyan law and is committed to:
              {'\n'}• Compliance with Central Bank of Kenya regulations
              {'\n'}• Adherence to the Data Protection Act, 2019
              {'\n'}• Following Anti-Money Laundering (AML) guidelines
              {'\n'}• Maintaining transparent and fair business practices
              {'\n'}• Protecting consumer rights and interests
            </Text>
          </View>

          <View style={styles.actionSection}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setShowLegalModal(false);
                onNavigateToTerms();
              }}
            >
              <Ionicons name="document-text" size={20} color={colors.white} />
              <Text style={[styles.actionButtonText, { color: colors.white }]}>
                Read Full Terms of Service
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.secondary }]}
              onPress={() => {
                setShowLegalModal(false);
                onNavigateToPrivacy();
              }}
            >
              <Ionicons name="shield-checkmark" size={20} color={colors.white} />
              <Text style={[styles.actionButtonText, { color: colors.white }]}>
                Read Privacy Policy
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Legal Agreement Section */}
      <View style={[styles.agreementContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.agreementHeader}>
          <Ionicons name="document-text" size={24} color={colors.primary} />
          <Text style={[styles.agreementTitle, { color: colors.text }]}>
            Legal Agreement
          </Text>
          <TouchableOpacity
            onPress={() => setShowLegalModal(true)}
            style={styles.infoButton}
          >
            <Ionicons name="information-circle" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.agreementDescription, { color: colors.textSecondary }]}>
          By creating an account, you agree to our legal terms and understand your rights and responsibilities as a VaultKe user.
        </Text>

        {/* Checkbox and Terms */}
        <View style={styles.checkboxSection}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={onAcceptTerms}
          >
            <View style={[
              styles.checkbox,
              { borderColor: error ? colors.error : colors.border },
              acceptedTerms && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}>
              {acceptedTerms && (
                <Ionicons name="checkmark" size={16} color={colors.white} />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.termsTextContainer}>
            <Text style={[styles.termsText, { color: colors.textSecondary }]}>
              I have read, understood, and agree to VaultKe's{' '}
              <TouchableOpacity onPress={onNavigateToTerms} style={styles.inlineLink}>
                <Text style={[styles.linkText, { color: colors.primary }]}>
                  Terms of Service
                </Text>
              </TouchableOpacity>
              {' '}and{' '}
              <TouchableOpacity onPress={onNavigateToPrivacy} style={styles.inlineLink}>
                <Text style={[styles.linkText, { color: colors.primary }]}>
                  Privacy Policy
                </Text>
              </TouchableOpacity>
              . I consent to the collection and processing of my personal data as described in these documents.
            </Text>
          </View>
        </View>

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>
              {error}
            </Text>
          </View>
        )}
      </View>

      <LegalModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  agreementContainer: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  agreementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  agreementTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
    flex: 1,
  },
  infoButton: {
    padding: spacing.xs,
  },
  agreementDescription: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  checkboxSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxContainer: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsTextContainer: {
    flex: 1,
  },
  termsText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 22,
    textAlign: 'justify',
  },
  inlineLink: {
    // Container for touchable inline links
  },
  linkText: {
    textDecorationLine: 'underline',
    fontWeight: typography.fontWeight.medium,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.xs,
    flex: 1,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  closeButton: {
    padding: spacing.sm,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  introSection: {
    paddingVertical: spacing.lg,
  },
  introTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  introText: {
    fontSize: typography.fontSize.base,
    lineHeight: 24,
    textAlign: 'justify',
  },
  keyPointsSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  keyPointItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  keyPointIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  keyPointContent: {
    flex: 1,
  },
  keyPointTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  keyPointDescription: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  legalSection: {
    marginBottom: spacing.xl,
  },
  legalText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 22,
    textAlign: 'justify',
  },
  actionSection: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  actionButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default LegalAgreementSection;
