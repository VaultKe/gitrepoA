import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';

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
    marginBottom: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  documentType: {
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
};

export default MeetingDocumentsCard;
