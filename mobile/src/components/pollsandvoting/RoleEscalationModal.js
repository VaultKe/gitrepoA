import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/common/Button';
import { spacing, typography } from '../../utils/theme';

const RoleEscalationModal = ({
  colors,
  visible,
  onClose,
  roleForm,
  setRoleForm,
  chamaMembers,
  filteredMembers,
  memberSearchQuery,
  userRole,
  onMemberSearch,
  onSelectCandidate,
  onSubmit,
  getMemberName,
  getMemberEmail,
}) => {
  if (!visible) return null;

  return (
    <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
      <View style={[styles.modalHeader, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.modalCloseButton}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.modalTitle, { color: colors.text }]}>
          Election/Voting
        </Text>
        <View style={styles.modalCloseButton} />
      </View>

      <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: colors.text }]}>
            Select Candidate Member *
          </Text>
          <TextInput
            style={[styles.formInput, formInputStyle, { color: colors.text }]}
            value={memberSearchQuery}
            onChangeText={onMemberSearch}
            placeholder="Search members by name, email, or role"
            placeholderTextColor={colors.textSecondary}
          />

          {/* Member Search Results */}
          {filteredMembers.length > 0 && memberSearchQuery && (
            <View style={[styles.searchResults, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {filteredMembers.slice(0, 5).map((member) => (
                <TouchableOpacity
                  key={member.user_id || member.userId || member.id}
                  style={[styles.searchResultItem, { borderBottomColor: colors.border }]}
                  onPress={() => onSelectCandidate(member)}
                >
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: colors.text }]}>
                      {getMemberName(member)}
                    </Text>
                    <Text style={[styles.memberDetails, { color: colors.textSecondary }]}>
                      {member.role} • {getMemberEmail(member)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Selected Candidate Display */}
          {roleForm.selectedCandidates?.length > 0 && (
            <View style={[styles.selectedCandidate, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
              <Text style={[styles.selectedCandidateText, { color: colors.text }]}>
                Selected: {getMemberName(roleForm.selectedCandidates[0])} ({roleForm.selectedCandidates[0].role})
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setRoleForm(prev => ({ ...prev, candidateId: '', selectedCandidates: [] }));
                  setMemberSearchQuery('');
                }}
              >
                <Ionicons name="close-circle" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: colors.text }]}>
            Requested Role *
          </Text>
          <View style={styles.radioGroup}>
            {[
              { value: 'chairperson', label: 'Chairperson' },
              { value: 'secretary', label: 'Secretary' },
              { value: 'treasurer', label: 'Treasurer' },
              { value: 'member', label: 'Member (Demotion)' },
            ].map((role) => (
              <TouchableOpacity
                key={role.value}
                style={styles.radioOption}
                onPress={() => setRoleForm(prev => ({ ...prev, requestedRole: role.value }))}
              >
                <View style={[
                  styles.radioCircle,
                  { borderColor: colors.primary },
                  roleForm.requestedRole === role.value && { backgroundColor: colors.primary }
                ]}>
                  {roleForm.requestedRole === role.value && (
                    <View style={[styles.radioInner, { backgroundColor: colors.surface }]} />
                  )}
                </View>
                <Text style={[styles.radioLabel, { color: colors.text }]}>
                  {role.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: colors.text }]}>
            Justification
          </Text>
          <TextInput
            style={[styles.formInput, styles.textArea, formInputStyle, { color: colors.text }]}
            value={roleForm.justification}
            onChangeText={(text) => setRoleForm(prev => ({ ...prev, justification: text }))}
            placeholder="Explain why this role change is needed"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
          />
        </View>

        <Button
          title="Create Role Escalation Poll"
          onPress={onSubmit}
          style={[styles.submitButton, { backgroundColor: colors.warning }]}
        />
      </ScrollView>
    </View>
  );
};

const formInputStyle = {
  backgroundColor: '#f5f5f5',
  borderColor: '#e0e0e0',
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 2,
  elevation: 1,
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalCloseButton: {
    padding: 8,
    width: 40,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 44,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  radioGroup: {
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  radioLabel: {
    fontSize: 16,
  },
  searchResults: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 200,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberDetails: {
    fontSize: 14,
  },
  selectedCandidate: {
    marginTop: 4,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedCandidateText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  submitButton: {
    marginTop: 24,
  },
});

export default RoleEscalationModal;
