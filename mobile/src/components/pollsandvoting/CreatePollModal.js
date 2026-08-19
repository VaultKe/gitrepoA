import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Animated } from 'react-native';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { spacing, typography } from '../../utils/theme';
import CreatePollFormFields from './CreatePollFormFields';

const CreatePollModal = ({
  colors,
  isDesktop,
  visible,
  onClose,
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
  onSubmit,
  getMemberName,
  getMemberEmail,
}) => {
  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        style={[
          styles.modalBackdrop,
          {
            opacity: new Animated.Value(0).interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.5],
            }),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.modalBackdropTouchable}
          onPress={onClose}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Modal Content */}
      <Animated.View
        style={[
          styles.modalContainer,
          { backgroundColor: colors.surface },
          {
            transform: [
              {
                scale: new Animated.Value(0).interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ],
            opacity: new Animated.Value(0),
          },
        ]}
      >
        <View style={[
          styles.modalHeader,
          { backgroundColor: colors.surface },
          isDesktop && styles.modalHeaderDesktop
        ]}>
          <View style={styles.modalCloseButton} />
          <Text style={[
            styles.modalTitle,
            { color: colors.text },
            isDesktop && styles.modalTitleDesktop
          ]}>
            Create New Poll
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.modalCloseButton, isDesktop && styles.modalCloseButtonDesktop]}
          >
            <Ionicons name={isDesktop ? "close-circle" : "close"} size={isDesktop ? 28 : 24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <CreatePollFormFields
          colors={colors}
          isDesktop={isDesktop}
          pollForm={pollForm}
          setPollForm={setPollForm}
          roleForm={roleForm}
          chamaMembers={chamaMembers}
          filteredMembers={filteredMembers}
          memberSearchQuery={memberSearchQuery}
          userRole={userRole}
          onMemberSearch={onMemberSearch}
          onSelectCandidate={onSelectCandidate}
          onAddOption={onAddOption}
          onRemoveOption={onRemoveOption}
          onUpdateOption={onUpdateOption}
          getMemberName={getMemberName}
          getMemberEmail={getMemberEmail}
        />

        <Button
          title="Create Poll"
          onPress={onSubmit}
          style={[
            styles.submitButton,
            { backgroundColor: colors.primary },
            isDesktop && styles.submitButtonDesktop
          ]}
          accessibilityLabel="Create poll button"
          accessibilityHint="Tap to create your poll with the entered information"
        />
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  modalBackdropTouchable: {
    flex: 1,
  },
  modalContainer: {
    position: 'absolute',
    top: '5%',
    bottom: '5%',
    left: 20,
    right: 20,
    zIndex: 1001,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
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
  modalHeaderDesktop: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  modalCloseButton: {
    padding: 8,
    width: 40,
  },
  modalCloseButtonDesktop: {
    padding: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalTitleDesktop: {
    fontSize: 18,
    fontWeight: '700',
  },
  submitButton: {
    marginTop: 24,
  },
  submitButtonDesktop: {
    marginTop: 32,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
});

export default CreatePollModal;
