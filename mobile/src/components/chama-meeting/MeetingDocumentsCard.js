import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';
import { spacing, typography } from '../../utils/theme';

const MeetingDocumentsCard = ({ meetingDocuments, onDocumentPress, downloadingDocId, colors }) => {
  return (
    <Card variant="outlined" style={styles.documentsCard}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Meeting Documents ({meetingDocuments.length})</Text>
      {meetingDocuments.length > 0 ? (
        <>
          {meetingDocuments.map((document, index) => (
            <TouchableOpacity key={index} style={styles.documentItem} onPress={() => onDocumentPress(document)} disabled={downloadingDocId === document.id}>
              <View style={[styles.documentIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="document" size={20} color={colors.primary} />
              </View>
              <View style={styles.documentInfo}>
                <Text style={[styles.documentName, { color: colors.text }]} numberOfLines={1}>{document.name}</Text>
                <Text style={[styles.documentType, { color: colors.textSecondary }]}>{document.documentType} • {Math.round(document.size / 1024)} KB</Text>
              </View>
              {downloadingDocId === document.id ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="download" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="folder-open-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No documents available</Text>
        </View>
      )}
    </Card>
  );
};

const styles = {
  documentsCard: {
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs / 2,
  },
  documentType: {
    fontSize: typography.fontSize.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyStateText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
};

export default MeetingDocumentsCard;
