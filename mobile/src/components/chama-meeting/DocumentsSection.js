import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DocumentsSection = ({
  uploadedDocuments,
  onUploadDocument,
  onRemoveDocument,
  canUploadDocuments,
  formatFileSize,
  colors,
  isReadOnly = false,
}) => {
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Documents
      </Text>

      {!isReadOnly && (
        <TouchableOpacity
          style={[styles.uploadButton, { borderColor: colors.primary }]}
          onPress={onUploadDocument}
        >
          <Ionicons name="cloud-upload" size={24} color={colors.primary} />
          <Text style={[styles.uploadButtonText, { color: colors.primary }]}>
            Upload Document
          </Text>
        </TouchableOpacity>
      )}

      {uploadedDocuments.length > 0 && (
        <View style={styles.documentsList}>
          {uploadedDocuments.map((doc) => (
            <View key={doc.id} style={[styles.documentItem, { borderBottomColor: colors.border }]}>
              <View style={styles.documentInfo}>
                <Ionicons name="document" size={20} color={colors.primary} />
                <View style={styles.documentDetails}>
                  <Text style={[styles.documentName, { color: colors.text }]} numberOfLines={1}>
                    {doc.name}
                  </Text>
                  <Text style={[styles.documentSize, { color: colors.textSecondary }]}>
                    {formatFileSize(doc.size)}
                  </Text>
                </View>
              </View>
              {!isReadOnly && (
                <TouchableOpacity
                  style={styles.removeDocButton}
                  onPress={() => onRemoveDocument(doc.id)}
                >
                  <Ionicons name="trash" size={18} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = {
  section: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  documentsList: {
    marginTop: 16,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  documentDetails: {
    marginLeft: 12,
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '500',
  },
  documentSize: {
    fontSize: 12,
    marginTop: 2,
  },
  removeDocButton: {
    padding: 8,
  },
};

export default DocumentsSection;
