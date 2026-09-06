import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography } from '../../utils/theme';

const ChamaUploadRules = ({ userMembership, colors, handleUploadRulesFile, handleRemoveRulesFile, uploadingRules, rulesFilePath }) => {
  const isChairperson = userMembership?.role?.toLowerCase() === 'chairperson';
  const hasRulesFile = Boolean(rulesFilePath);

  if (!isChairperson) {
    return (
      <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs }} variant="outlined">
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Rules Document
        </Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {hasRulesFile ? 'Rules PDF uploaded' : 'No rules document uploaded'}
        </Text>
      </Card>
    );
  }

  return (
    <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs }} variant="outlined">
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Rules Document
      </Text>
      <View style={styles.rulesContent}>
        <Text style={[styles.emptyText, { color: colors.textSecondary, marginBottom: spacing.md }]}>
          {hasRulesFile ? 'Rules PDF uploaded' : 'No rules document uploaded'}
        </Text>
        <View style={styles.buttonRow}>
          {hasRulesFile ? (
            <>
              <TouchableOpacity
                style={[styles.uploadButton, { borderColor: colors.primary }]}
                onPress={handleUploadRulesFile}
                disabled={uploadingRules}
                activeOpacity={0.7}
              >
                <Text style={[styles.uploadButtonText, { color: colors.primary }]}>
                  Replace Rules PDF
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.uploadButton, { borderColor: colors.error }]}
                onPress={handleRemoveRulesFile}
                activeOpacity={0.7}
              >
                <Text style={[styles.removeButtonText, { color: colors.error }]}>
                  Remove
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.uploadButton, { borderColor: colors.primary }]}
              onPress={handleUploadRulesFile}
              disabled={uploadingRules}
              activeOpacity={0.7}
            >
              <Text style={[styles.uploadButtonText, { color: colors.primary }]}>
                Upload Rules PDF
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
  },
  rulesContent: {
    gap: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  uploadButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  uploadButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  removeButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
});

export default ChamaUploadRules;
