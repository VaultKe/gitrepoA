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
import Card from '../../../components/common/Card';

const MerryGoRoundRulesScreen = ({ navigation, route }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const rules = [
    {
      title: "What is a Merry-Go-Round?",
      content: "A merry-go-round (also called a ROSCA - Rotating Savings and Credit Association) is a group savings scheme where members contribute a fixed amount regularly, and each member receives the total pot in rotation."
    },
    {
      title: "How It Works",
      content: "Each round, one member receives the total contributions from all other members. The rotation continues until every member has received the pot once. The cycle then repeats if desired."
    },
    {
      title: "Contribution Rules",
      content: "All members must contribute their share before the payout date. Late contributions may result in penalties or exclusion from future rounds."
    },
    {
      title: "Payout Schedule",
      content: "Payouts occur on the scheduled date for each round. The recipient receives the total amount contributed by all other members."
    },
    {
      title: "Member Responsibilities",
      content: "Members are responsible for making timely contributions and ensuring the group functions smoothly. Trust and commitment are essential."
    },
    {
      title: "Dispute Resolution",
      content: "Any disputes should be resolved through group discussion. The chama chairperson or treasurer can help mediate conflicts."
    },
    {
      title: "Default Consequences",
      content: "Members who consistently fail to contribute may be removed from the merry-go-round. This protects the interests of committed members."
    },
    {
      title: "Round Advancement",
      content: "Rounds advance automatically when all required contributions are received. The system ensures fair rotation among all members."
    }
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.introCard} variant="outlined">
          <View style={styles.introContent}>
            <Ionicons name="information-circle" size={32} color={colors.primary} />
            <Text style={[styles.introText, { color: colors.text }]}>
              Understanding the rules ensures a successful merry-go-round experience for all members.
            </Text>
          </View>
        </Card>

        {rules.map((rule, index) => (
          <Card key={index} style={styles.ruleCard} variant="outlined">
            <View style={styles.ruleHeader}>
              <View style={[styles.ruleNumber, { backgroundColor: colors.primary }]}>
                <Text style={[styles.ruleNumberText, { color: colors.white }]}>
                  {index + 1}
                </Text>
              </View>
              <Text style={[styles.ruleTitle, { color: colors.text }]}>
                {rule.title}
              </Text>
            </View>
            <Text style={[styles.ruleContent, { color: colors.textSecondary }]}>
              {rule.content}
            </Text>
          </Card>
        ))}

        <Card style={styles.disclaimerCard} variant="outlined">
          <View style={styles.disclaimerContent}>
            <Ionicons name="warning" size={24} color={colors.warning} />
            <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
              These are general guidelines. Your specific chama may have additional rules or variations.
              Always refer to your chama's constitution for complete terms.
            </Text>
          </View>
        </Card>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40, // Same width as back button for centering
  },
  scrollView: {
    flex: 1,
    padding: spacing.md,
  },
  introCard: {
    marginBottom: spacing.lg,
  },
  introContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  introText: {
    fontSize: typography.fontSize.base,
    lineHeight: 24,
    flex: 1,
  },
  ruleCard: {
    marginBottom: spacing.md,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  ruleNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  ruleNumberText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  ruleTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
  },
  ruleContent: {
    fontSize: typography.fontSize.base,
    lineHeight: 22,
    paddingLeft: 32 + spacing.md, // Account for rule number width + margin
  },
  disclaimerCard: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  disclaimerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  disclaimerText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    flex: 1,
    fontStyle: 'italic',
  },
});

export default MerryGoRoundRulesScreen;