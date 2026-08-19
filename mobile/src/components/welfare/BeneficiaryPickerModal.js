import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BeneficiaryPickerModal = ({ visible, onClose, colors, styles, beneficiarySearch, filteredMembers, loadingMembers, handleBeneficiarySearch, toggleBeneficiary, isMemberLeft, getSelectedBeneficiaries, newRequest }) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Select Beneficiaries
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search members..."
              placeholderTextColor={colors.textSecondary}
              value={beneficiarySearch}
              onChangeText={handleBeneficiarySearch}
            />
          </View>
          <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
            {loadingMembers ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Loading members...
                </Text>
              </View>
            ) : filteredMembers.length === 0 ? (
              <View style={styles.emptyMembers}>
                <Ionicons name="people" size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyMembersText, { color: colors.textSecondary }]}>
                  {beneficiarySearch ? 'No members found' : 'No eligible members'}
                </Text>
                <Text style={[styles.emptyMembersSubtext, { color: colors.textSecondary }]}>
                  {beneficiarySearch ? 'Try a different search term' : 'All members are already selected'}
                </Text>
              </View>
            ) : (
              filteredMembers.map(member => {
                const isSelected = newRequest.beneficiaryIds.includes(member.id);
                const memberLeft = isMemberLeft(member);
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      styles.memberOption,
                      isSelected && { backgroundColor: colors.primary + '10' },
                      memberLeft && { backgroundColor: colors.error + '10' }
                    ]}
                    onPress={() => toggleBeneficiary(member)}
                    disabled={memberLeft}
                    activeOpacity={memberLeft ? 1 : 0.7}
                  >
                    <View style={styles.memberInfo}>
                      <View style={[styles.memberAvatar, { backgroundColor: isSelected ? colors.primary : memberLeft ? colors.error : colors.surface }]}>
                        <Text style={[styles.memberAvatarText, { color: isSelected ? colors.white : memberLeft ? colors.error : colors.text }]}>
                          {member.first_name?.charAt(0) || member.name?.charAt(0) || '?'}
                        </Text>
                      </View>
                      <View style={styles.memberDetails}>
                        <Text style={[
                          styles.memberName,
                          { color: memberLeft ? colors.error : colors.text },
                          memberLeft && { textDecorationLine: 'line-through' }
                        ]}>
                          {member.first_name} {member.last_name}
                        </Text>
                        {memberLeft && (
                          <Text style={[styles.memberRole, { color: colors.error, fontWeight: 'bold' }]}>
                            Left
                          </Text>
                        )}
                        {!memberLeft && (
                          <Text style={[styles.memberEmail, { color: colors.textSecondary }]}>
                            {member.email}
                          </Text>
                        )}
                        {!memberLeft && (
                          <Text style={[styles.memberRole, { color: colors.textSecondary }]}>
                            {member.role || 'Member'}
                          </Text>
                        )}
                      </View>
                    </View>
                    {isSelected && !memberLeft && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    )}
                    {memberLeft && (
                      <Ionicons name="close-circle" size={24} color={colors.error} />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default BeneficiaryPickerModal;
