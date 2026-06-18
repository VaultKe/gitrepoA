import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import { getMemberEmail, getMemberName } from './chamaTransactionsUtils';

const ChamaTransactionsMemberSelectorModal = ({
  visible,
  chamaMembers,
  onClose,
  onSelectMember,
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
              Select Member
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.modalSubtitle, styles.modalSubtitleText]}>
            Choose a member to download their transaction records
          </Text>

          <FlatList
            data={chamaMembers}
            keyExtractor={(item) => item.id || item.user_id}
            renderItem={({ item }) => {
              const memberName = getMemberName(item);
              const memberEmail = getMemberEmail(item);

              return (
                <TouchableOpacity
                  style={[styles.memberOption, styles.memberOptionBorder]}
                  onPress={() => {
                    onSelectMember(item.user_id || item.id);
                    onClose();
                  }}
                >
                  <View style={styles.memberInfo}>
                    <View style={[styles.memberAvatar, styles.memberAvatarPrimary]}>
                      <Text style={[styles.memberAvatarText, styles.memberAvatarTextWhite]}>
                        {memberName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.memberDetails}>
                      <Text style={[styles.memberName, styles.memberNameText]}>
                        {memberName}
                      </Text>
                      {memberEmail && (
                        <Text style={[styles.memberEmail, styles.memberEmailText]}>
                          {memberEmail}
                        </Text>
                      )}
                      <Text style={[styles.memberRole, styles.memberRoleText]}>
                        {item.role || 'Member'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              );
            }}
            style={styles.memberList}
            showsVerticalScrollIndicator={false}
          />
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
  memberList: {
    maxHeight: 300,
  },
  memberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  memberOptionBorder: {
    borderColor: colors.border,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarPrimary: {
    backgroundColor: colors.primary,
  },
  memberAvatarText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  memberAvatarTextWhite: {
    color: colors.white,
  },
  memberDetails: {
    marginLeft: spacing.md,
    flex: 1,
  },
  memberName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  memberNameText: {
    color: colors.text,
  },
  memberEmail: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  memberEmailText: {
    color: colors.textSecondary,
  },
  memberRole: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },
  memberRoleText: {
    color: colors.textSecondary,
  },
});

export default ChamaTransactionsMemberSelectorModal;
