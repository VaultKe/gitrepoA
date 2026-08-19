import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Animated } from 'react-native';
import { spacing, typography } from '../../utils/theme';
import { getMemberName, getMemberEmail } from '../../utils/pollsVotingHelpers';

const CreatePollFormFields = ({
  colors,
  isDesktop,
  pollForm,
  setPollForm,
  roleForm,
  chamaMembers,
  filteredMembers,
  memberSearchQuery,
  userRole,
  onMemberSearch,
  onSelectCandidate,
  onAddOption,
  onRemoveOption,
  onUpdateOption,
}) => {
  const formInputStyle = {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  };

  return (
    <ScrollView
      style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}
      contentContainerStyle={[
        styles.modalContentContainer,
        isDesktop && styles.modalContentContainerDesktop
      ]}
    >
      {/* Title field - only for non-role-escalation votes */}
      {pollForm.type !== 'Election / Voting' && (
        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: colors.text }]}>
            Title *
          </Text>
          <TextInput
            style={[
              styles.formInput,
              formInputStyle,
              { color: colors.text },
              isDesktop && styles.formInputDesktop
            ]}
            value={pollForm.title}
            onChangeText={(text) => setPollForm(prev => ({ ...prev, title: text }))}
            placeholder="Enter poll title"
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="Poll title input"
            accessibilityHint="Enter the title for your poll"
          />
        </View>
      )}

      {/* Description field - optional for all vote types */}
      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.text }]}>
          Description {pollForm.type === 'Election / Voting' ? '(Auto-generated)' : '(Optional)'}
        </Text>
        <TextInput
          style={[
            styles.formInput,
            styles.textArea,
            formInputStyle,
            { color: colors.text },
            isDesktop && styles.formInputDesktop
          ]}
          value={pollForm.description}
          onChangeText={(text) => setPollForm(prev => ({ ...prev, description: text }))}
          placeholder={pollForm.type === 'Election / Voting' ? 'Justification will be used as description' : 'Enter poll description (optional)'}
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={isDesktop ? 4 : 3}
          editable={pollForm.type !== 'Election / Voting'}
          accessibilityLabel="Poll description input"
          accessibilityHint="Enter an optional description for your poll"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.text }]}>
          Poll Type *
        </Text>
        <View style={[styles.radioGroup, isDesktop && styles.radioGroupDesktop]}>
          {[
            { value: 'general', label: 'General Poll', description: 'For general opinions and decisions' },
            { value: 'financial_decision', label: 'Financial Decision', description: 'For financial matters requiring approval' },
            { value: 'Election / Voting', label: 'Role Change', description: 'For changing member roles (Chair only)' },
          ].map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.radioOption,
                isDesktop && styles.radioOptionDesktop,
                type.value === 'Election / Voting' && userRole !== 'chairperson' && styles.disabledOption
              ]}
              onPress={() => {
                if (type.value === 'Election / Voting' && userRole !== 'chairperson') {
                  Alert.alert('Access Denied', 'Only the chairperson can create role escalation polls');
                  return;
                }
                setPollForm(prev => ({ ...prev, type: type.value }));
              }}
              disabled={type.value === 'Election / Voting' && userRole !== 'chairperson'}
              accessibilityLabel={`${type.label} poll type`}
              accessibilityHint={type.description}
              accessibilityRole="radio"
              accessibilityState={{ checked: pollForm.type === type.value }}
            >
              <View style={[
                styles.radioCircle,
                isDesktop && styles.radioCircleDesktop,
                { borderColor: colors.primary },
                pollForm.type === type.value && { backgroundColor: colors.primary },
                type.value === 'Election / Voting' && userRole !== 'chairperson' && { borderColor: colors.textTertiary }
              ]}>
                {pollForm.type === type.value && (
                  <View style={[styles.radioInner, { backgroundColor: colors.surface }]} />
                )}
              </View>
              <View style={[styles.radioContent, isDesktop && styles.radioContentDesktop]}>
                <Text style={[
                  styles.radioLabel,
                  isDesktop && styles.radioLabelDesktop,
                  { color: colors.text },
                  type.value === 'Election / Voting' && userRole !== 'chairperson' && { color: colors.textTertiary }
                ]}>
                  {type.label}
                </Text>
                <Text style={[
                  styles.radioDescription,
                  isDesktop && styles.radioDescriptionDesktop,
                  { color: colors.textSecondary },
                  type.value === 'Election / Voting' && userRole !== 'chairperson' && { color: colors.textTertiary }
                ]}>
                  {type.description}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Role Escalation Fields */}
      {pollForm.type === 'Election / Voting' && (
        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: colors.text }]}>
            Select Candidate Member *
          </Text>
          <TextInput
            style={[
              styles.formInput,
              formInputStyle,
              { color: colors.text },
              isDesktop && styles.formInputDesktop
            ]}
            value={memberSearchQuery}
            onChangeText={onMemberSearch}
            placeholder="Search members by name, email, or role"
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="Member search input"
            accessibilityHint="Type to search for chama members"
          />

          {/* Member Search Results */}
          {filteredMembers.length > 0 && memberSearchQuery && (
            <View style={[
              styles.searchResults,
              { backgroundColor: colors.surface, borderColor: colors.border },
              isDesktop && styles.searchResultsDesktop
            ]}>
              {filteredMembers.slice(0, isDesktop ? 8 : 5).map((member) => {
                const memberId = member.user_id || member.userId;
                const isSelected = roleForm.candidateIds.includes(memberId);

                return (
                  <TouchableOpacity
                    key={memberId || member.id}
                    style={[
                      styles.searchResultItem,
                      { borderBottomColor: colors.border },
                      isDesktop && styles.searchResultItemDesktop
                    ]}
                    onPress={() => onSelectCandidate(member)}
                    disabled={isSelected}
                    accessibilityLabel={`Select ${getMemberName(member)}`}
                    accessibilityHint={isSelected ? 'Already selected' : 'Tap to select this member'}
                  >
                    <View style={styles.memberInfo}>
                      <Text style={[
                        styles.memberName,
                        isDesktop && styles.memberNameDesktop,
                        { color: isSelected ? colors.textSecondary : colors.text }
                      ]}>
                        {getMemberName(member)}
                        {isSelected && ' ✓'}
                      </Text>
                      <Text style={[
                        styles.memberDetails,
                        isDesktop && styles.memberDetailsDesktop,
                        { color: colors.textSecondary }
                      ]}>
                        {member.role} • {getMemberEmail(member)}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={[styles.selectedIndicator, { backgroundColor: colors.success }]}>
                        <Ionicons name="checkmark" size={16} color={colors.surface} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Selected Candidates Display */}
          {roleForm.selectedCandidates.length > 0 && (
            <View style={styles.selectedCandidatesContainer}>
              <Text style={[styles.selectedCandidatesTitle, { color: colors.text }]}>
                Selected Candidates ({roleForm.selectedCandidates.length}):
              </Text>
              {roleForm.selectedCandidates.map((candidate, index) => (
                <View key={candidate.user_id || candidate.userId || index} style={[styles.selectedCandidate, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                  <Text style={[styles.selectedCandidateText, { color: colors.text }]}>
                    {getMemberName(candidate)} ({candidate.role})
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      const memberId = candidate.user_id || candidate.userId;
                      setRoleForm(prev => ({
                        ...prev,
                        candidateIds: prev.candidateIds.filter(id => id !== memberId),
                        selectedCandidates: prev.selectedCandidates.filter(c =>
                          (c.user_id || c.userId) !== memberId
                        ),
                      }));
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Regular Poll Options */}
      {pollForm.type !== 'Election / Voting' && (
        <View style={styles.formGroup}>
          <Text style={[
            styles.formLabel,
            { color: colors.text },
            isDesktop && styles.formLabelDesktop
          ]}>
            Poll Options *
          </Text>
          <View style={[styles.optionsContainer, isDesktop && styles.optionsContainerDesktop]}>
            {pollForm.options.map((option, index) => (
              <View key={index} style={[
                styles.optionInputContainer,
                isDesktop && styles.optionInputContainerDesktop
              ]}>
                <TextInput
                  style={[
                    styles.formInput,
                    styles.optionInput,
                    formInputStyle,
                    { color: colors.text },
                    isDesktop && styles.formInputDesktop
                  ]}
                  value={option}
                  onChangeText={(text) => onUpdateOption(index, text)}
                  placeholder={`Option ${index + 1}`}
                  placeholderTextColor={colors.textSecondary}
                  accessibilityLabel={`Poll option ${index + 1}`}
                  accessibilityHint="Enter text for this poll option"
                />
                {pollForm.options.length > 2 && (
                  <TouchableOpacity
                    onPress={() => onRemoveOption(index)}
                    style={styles.removeOptionButton}
                    accessibilityLabel={`Remove option ${index + 1}`}
                    accessibilityHint="Tap to remove this poll option"
                  >
                    <Ionicons name="close-circle" size={24} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          {pollForm.options.length < 10 && (
            <TouchableOpacity
              onPress={onAddOption}
              style={[
                styles.addOptionButton,
                { borderColor: colors.primary },
                isDesktop && styles.addOptionButtonDesktop
              ]}
              accessibilityLabel="Add poll option"
              accessibilityHint="Tap to add another option to your poll"
            >
              <Ionicons name="add" size={20} color={colors.primary} />
              <Text style={[styles.addOptionText, { color: colors.primary }]}>
                Add Option
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    flex: 1,
  },
  modalContentDesktop: {
    maxHeight: '80vh',
  },
  modalContentContainer: {
    padding: 16,
  },
  modalContentContainerDesktop: {
    padding: 24,
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
  formInputDesktop: {
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  radioGroup: {
    gap: 12,
  },
  radioGroupDesktop: {
    gap: 16,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOptionDesktop: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
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
  radioCircleDesktop: {
    width: 24,
    height: 24,
    marginRight: 16,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  radioLabel: {
    fontSize: 16,
  },
  radioLabelDesktop: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  radioContent: {
    flex: 1,
    marginLeft: 8,
  },
  radioDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  radioDescriptionDesktop: {
    fontSize: 14,
  },
  searchResults: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 200,
  },
  searchResultsDesktop: {
    maxHeight: 300,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
  },
  searchResultItemDesktop: {
    padding: 16,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberNameDesktop: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  memberDetails: {
    fontSize: 14,
  },
  memberDetailsDesktop: {
    fontSize: 14,
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCandidatesContainer: {
    marginTop: 8,
  },
  selectedCandidatesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
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
  optionsContainer: {
    marginBottom: 16,
  },
  optionsContainerDesktop: {
    gap: 12,
  },
  optionInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionInputContainerDesktop: {
    marginBottom: 0,
  },
  optionInput: {
    flex: 1,
    marginRight: 8,
  },
  removeOptionButton: {
    padding: 4,
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    marginTop: 8,
  },
  addOptionButtonDesktop: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  addOptionText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  disabledOption: {
    opacity: 0.5,
  },
});

export default CreatePollFormFields;
