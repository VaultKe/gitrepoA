import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../components/common/Button';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';

const ChamaMemberRoleModal = ({
  visible,
  selectedMember,
  roles,
  canManageRoles,
  onClose,
  onChangeRole,
  onRemoveMember,
}) => {
  const colors = getThemeColors();
  const styles = createStyles(colors);

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
              Manage Member
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {selectedMember && (
            <View style={styles.modalBody}>
              <Text style={[styles.memberNameModal, styles.memberNameModalText]}>
                {selectedMember.user?.first_name} {selectedMember.user?.last_name}
              </Text>

              {canManageRoles() && (
                <View style={styles.roleSection}>
                  <Text style={[styles.sectionTitle, styles.sectionTitleText]}>
                    Change Role
                  </Text>
                  {roles.map((role) => (
                    <TouchableOpacity
                      key={role.id}
                      style={[
                        styles.roleOption,
                        selectedMember.role === role.id ? styles.roleOptionSelected : styles.roleOptionDefault,
                      ]}
                      onPress={() => onChangeRole(selectedMember.id, role.id)}
                    >
                      <Ionicons
                        name={role.icon}
                        size={20}
                        color={selectedMember.role === role.id ? colors.primary : colors.textSecondary}
                      />
                      <View style={styles.roleInfo}>
                        <Text style={[
                          styles.roleName,
                          selectedMember.role === role.id ? styles.roleNameSelected : styles.roleNameDefault,
                        ]}>
                          {role.name}
                        </Text>
                        <Text style={[styles.roleDescription, styles.roleDescriptionText]}>
                          {role.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.actionSection}>
                <Button
                  title="Remove from Chama"
                  variant="outline"
                  onPress={() => {
                    onClose();
                    onRemoveMember(selectedMember);
                  }}
                  style={[styles.removeButton, styles.removeButtonError]}
                  textStyle={styles.errorButtonText}
                />
              </View>
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
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
  },
  modalContentSurface: {
    backgroundColor: colors.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  modalTitleText: {
    color: colors.text,
  },
  modalBody: {
    gap: spacing.lg,
  },
  memberNameModal: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  memberNameModalText: {
    color: colors.text,
  },
  roleSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  sectionTitleText: {
    color: colors.text,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  roleOptionSelected: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  roleOptionDefault: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  roleInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  roleName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  roleNameSelected: {
    color: colors.primary,
  },
  roleNameDefault: {
    color: colors.text,
  },
  roleDescription: {
    fontSize: typography.fontSize.sm,
  },
  roleDescriptionText: {
    color: colors.textSecondary,
  },
  actionSection: {
    gap: spacing.md,
  },
  removeButton: {
    marginTop: spacing.md,
  },
  removeButtonError: {
    borderColor: colors.error,
  },
  errorButtonText: {
    color: colors.error,
  },
});

export default ChamaMemberRoleModal;
