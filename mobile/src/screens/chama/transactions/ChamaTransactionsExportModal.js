import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';

const ChamaTransactionsExportModal = ({
  visible,
  transactionsCount,
  exportLoading,
  onClose,
  onExport,
  theme,
}) => {
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);
  const exportOptions = [
    {
      id: 'pdf',
      icon: 'document-text',
      title: 'PDF Report',
      description: 'Professional formatted report',
      iconColor: colors.error,
    },
    {
      id: 'excel',
      icon: 'grid',
      title: 'Excel Spreadsheet',
      description: 'Data analysis and calculations',
      iconColor: colors.success,
    },
    {
      id: 'word',
      icon: 'document',
      title: 'Word Document',
      description: 'Editable document format',
      iconColor: colors.info,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.modalContentSurface]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, styles.modalTitleText]}>
              Export Records
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.modalSubtitle, styles.modalSubtitleText]}>
            Choose export format for {transactionsCount} records
          </Text>

          <View style={styles.exportOptions}>
            {exportOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[styles.exportOption, styles.exportOptionBackground]}
                onPress={() => onExport(option.id)}
                disabled={exportLoading}
              >
                <Ionicons name={option.icon} size={24} color={option.iconColor} />
                <View style={styles.exportOptionTextContainer}>
                  <Text style={[styles.exportOptionText, styles.exportOptionTextDefault]}>
                    {option.title}
                  </Text>
                  <Text style={[styles.exportOptionDesc, styles.exportOptionDescText]}>
                    {option.description}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {exportLoading && (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, styles.loadingTextSecondary]}>
                Generating export...
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    maxHeight: '80%',
  },
  modalContentSurface: {
    backgroundColor: colors.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  modalTitleText: {
    color: colors.text,
  },
  modalCloseButton: {
    padding: spacing.sm,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.xl,
  },
  modalSubtitleText: {
    color: colors.textSecondary,
  },
  exportOptions: {
    gap: spacing.md,
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
  },
  exportOptionBackground: {
    backgroundColor: colors.backgroundSecondary,
  },
  exportOptionTextContainer: {
    flex: 1,
  },
  exportOptionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  exportOptionTextDefault: {
    color: colors.text,
  },
  exportOptionDesc: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  exportOptionDescText: {
    color: colors.textSecondary,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    fontStyle: 'italic',
  },
  loadingTextSecondary: {
    color: colors.textSecondary,
  },
});

export default ChamaTransactionsExportModal;
