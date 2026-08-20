import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography } from '../../utils/theme';

const ChamaUploadRules = ({ userMembership, colors, handleUploadRulesFile, handleRemoveRulesFile, uploadingRules, rulesFilePath }) => {
  return (
    <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs }} variant="outlined">
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Rules Document
      </Text>
      {userMembership?.role?.toLowerCase() === 'chairperson' ? (
        <View style={styles.rulesFileActions}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: '60%' }}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {rulesFilePath ? 'Rules PDF uploaded' : 'No rules document uploaded'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <TouchableOpacity
                style={[styles.uploadButton, { borderColor: colors.primary }]}
                onPress={handleUploadRulesFile}
                disabled={uploadingRules}
                activeOpacity={0.7}
              >
                <Text style={[styles.uploadButtonText, { color: colors.primary }]}>
                  {rulesFilePath ? 'Replace Rules PDF' : 'Upload Rules PDF'}
                </Text>
              </TouchableOpacity>
              {rulesFilePath && !uploadingRules && (
                <TouchableOpacity
                  style={[styles.uploadButton, { borderColor: colors.error }]}
                  onPress={handleRemoveRulesFile}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.removeButtonText, { color: colors.error }]}>
                    Remove
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      ) : (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No rules document uploaded
        </Text>
      )}
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
  rulesFileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  uploadButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
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
