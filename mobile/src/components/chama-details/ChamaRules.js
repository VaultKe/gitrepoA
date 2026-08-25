import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const ChamaRules = ({ chama, colors, handleOpenRulesFile }) => {
  let rules = [];
  if (chama?.rules) {
    try {
      if (typeof chama.rules === 'string') {
        try {
          const parsed = JSON.parse(chama.rules);
          if (Array.isArray(parsed)) {
            rules = parsed;
          } else if (typeof parsed === 'object') {
            rules = Object.entries(parsed).map(([key, value]) => ({
              title: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
              description: typeof value === 'string' ? value : JSON.stringify(value)
            }));
          } else {
            rules = [{ title: 'Chama Rule', description: String(parsed) }];
          }
        } catch (jsonError) {
          rules = [{ title: 'Chama Rule', description: chama.rules }];
        }
      } else if (Array.isArray(chama.rules)) {
        rules = chama.rules;
      } else if (typeof chama.rules === 'object') {
        rules = Object.entries(chama.rules).map(([key, value]) => ({
          title: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
          description: typeof value === 'string' ? value : JSON.stringify(value)
        }));
      }
    } catch (error) {
      if (typeof chama.rules === 'string') {
        rules = [{ title: 'Chama Rule', description: chama.rules }];
      }
    }
  }

  return (
    <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs }} variant="outlined">
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Chama Rules & Regulations
      </Text>

      {rules.length > 0 && (
        <>
          <Text style={[styles.rulesSubtitle, { color: colors.text }]}>
            Chama-Specific Rules:
          </Text>
          {rules.map((rule, index) => (
            <View key={`custom-${index}`}>
              <View style={[styles.ruleItem, { borderLeftColor: colors.primary }]}>
                <View style={styles.ruleHeader}>
                  <Text style={[styles.ruleNumber, { color: colors.primary }]}>
                    {index + 1}
                  </Text>
                  <Text style={[styles.ruleTitle, { color: colors.text }]}>
                    {rule.title || `Rule ${index + 1}`}
                  </Text>
                </View>
                <Text style={[styles.ruleDescription, { color: colors.textSecondary }]}>
                  {rule.description || rule}
                </Text>
                {rule.penalty && (
                  <Text style={[styles.rulePenalty, { color: colors.warning }]}>
                    Penalty: {rule.penalty}
                  </Text>
                )}
              </View>
              {index < rules.length - 1 && <View style={[styles.horizontalSeparator, { backgroundColor: colors.border }]} />}
            </View>
          ))}
        </>
      )}

      <Text style={[styles.rulesSubtitle, { color: colors.text, marginTop: rules.length > 0 ? spacing.lg : 0 }]}>
        Standard Chama Guidelines:
      </Text>

      <View style={styles.ruleItem}>
        <View style={styles.ruleHeader}>
          <Text style={[styles.ruleNumber, { color: colors.secondary }]}>
            {rules.length + 1}
          </Text>
          <Text style={[styles.ruleTitle, { color: colors.text }]}>
            Regular Contributions
          </Text>
        </View>
        <Text style={[styles.ruleDescription, { color: colors.textSecondary }]}>
          Members must make their contributions on time as per the agreed schedule
        </Text>
      </View>
      <View style={[styles.horizontalSeparator, { backgroundColor: colors.border }]} />

      <View style={styles.ruleItem}>
        <View style={styles.ruleHeader}>
          <Text style={[styles.ruleNumber, { color: colors.secondary }]}>
            {rules.length + 2}
          </Text>
          <Text style={[styles.ruleTitle, { color: colors.text }]}>
            Meeting Attendance
          </Text>
        </View>
        <Text style={[styles.ruleDescription, { color: colors.textSecondary }]}>
          Members are expected to attend scheduled meetings or provide advance notice
        </Text>
      </View>
      <View style={[styles.horizontalSeparator, { backgroundColor: colors.border }]} />

      <View style={styles.ruleItem}>
        <View style={styles.ruleHeader}>
          <Text style={[styles.ruleNumber, { color: colors.secondary }]}>
            {rules.length + 3}
          </Text>
          <Text style={[styles.ruleTitle, { color: colors.text }]}>
            Respectful Communication
          </Text>
        </View>
        <Text style={[styles.ruleDescription, { color: colors.textSecondary }]}>
          All members should maintain respectful and professional communication
        </Text>
      </View>
      <View style={[styles.horizontalSeparator, { backgroundColor: colors.border }]} />

      <View style={styles.ruleItem}>
        <View style={styles.ruleHeader}>
          <Text style={[styles.ruleNumber, { color: colors.secondary }]}>
            {rules.length + 4}
          </Text>
          <Text style={[styles.ruleTitle, { color: colors.text }]}>
            Financial Transparency
          </Text>
        </View>
        <Text style={[styles.ruleDescription, { color: colors.textSecondary }]}>
          All financial transactions and decisions must be transparent and documented
        </Text>
      </View>
      <View style={[styles.horizontalSeparator, { backgroundColor: colors.border }]} />

      <View style={styles.ruleItem}>
        <View style={styles.ruleHeader}>
          <Text style={[styles.ruleNumber, { color: colors.secondary }]}>
            {rules.length + 5}
          </Text>
          <Text style={[styles.ruleTitle, { color: colors.text }]}>
            Confidentiality
          </Text>
        </View>
        <Text style={[styles.ruleDescription, { color: colors.textSecondary }]}>
          Members must maintain confidentiality of chama matters and member information
        </Text>
      </View>

      {chama?.rules_file_path && handleOpenRulesFile && (
        <TouchableOpacity
          style={[styles.viewDocumentButton, { borderColor: colors.primary }]}
          onPress={handleOpenRulesFile}
        >
          <Ionicons name="document-text" size={18} color={colors.primary} />
          <Text style={[styles.viewDocumentText, { color: colors.primary }]}>
            View Rules Document
          </Text>
        </TouchableOpacity>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.lg,
  },
  rulesSubtitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  ruleItem: {
    paddingVertical: spacing.md,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  ruleNumber: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginRight: spacing.sm,
  },
  ruleTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
  },
  ruleDescription: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    marginLeft: spacing.lg,
  },
  rulePenalty: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    marginLeft: spacing.lg,
    fontStyle: 'italic',
  },
  horizontalSeparator: {
    height: 1,
    marginVertical: spacing.sm,
  },
  viewDocumentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  viewDocumentText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default ChamaRules;
