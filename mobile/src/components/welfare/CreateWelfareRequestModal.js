import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Input from '../common/Input';
import Button from '../common/Button';

const CreateWelfareRequestModal = ({ visible, onClose, colors, styles, newRequest, setNewRequest, formErrors, setFormErrors, clearFieldError, handleCreateRequest, welfareCategories, urgencyLevels, chamaMembers, loadingMembers, showBeneficiaryPicker, setShowBeneficiaryPicker, beneficiarySearch, filteredMembers, handleBeneficiarySearch, toggleBeneficiary, isMemberLeft, getSelectedBeneficiaries, removeBeneficiary, clearAllBeneficiaries }) => {
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
              Create Welfare Request
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.inputContainer}>
              <Input
                label="Title *"
                value={newRequest.title}
                onChangeText={(text) => {
                  setNewRequest(prev => ({ ...prev, title: text }));
                  clearFieldError('title');
                }}
                placeholder="Brief description of your request"
                style={formErrors.title ? styles.inputError : null}
              />
              {formErrors.title && <Text style={[styles.errorText, { color: colors.error }]}>{formErrors.title}</Text>}
            </View>
            <View style={styles.inputContainer}>
              <Input
                label="Description *"
                value={newRequest.description}
                onChangeText={(text) => {
                  setNewRequest(prev => ({ ...prev, description: text }));
                  clearFieldError('description');
                }}
                placeholder="Detailed explanation of your situation..."
                multiline
                numberOfLines={4}
                style={formErrors.description ? styles.inputError : null}
              />
              {formErrors.description && <Text style={[styles.errorText, { color: colors.error }]}>{formErrors.description}</Text>}
            </View>
            <View style={styles.inputContainer}>
              <Input
                label="Amount Needed (KES) *"
                value={newRequest.amount}
                onChangeText={(text) => {
                  setNewRequest(prev => ({ ...prev, amount: text }));
                  clearFieldError('amount');
                }}
                placeholder="Enter amount (e.g., 5000)"
                keyboardType="numeric"
              />
              {formErrors.amount && <Text style={[styles.errorText, { color: colors.error }]}>{formErrors.amount}</Text>}
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Who is this support for?</Text>
            <View style={[
              styles.beneficiarySection,
              formErrors.beneficiaries ? styles.sectionError : null
            ]}>
              <TouchableOpacity
                style={[
                  styles.beneficiaryOption,
                  {
                    backgroundColor: newRequest.beneficiaryIds.length === 0 ? colors.primary + '20' : colors.background,
                    borderColor: newRequest.beneficiaryIds.length === 0 ? colors.primary : colors.border,
                  }
                ]}
                onPress={clearAllBeneficiaries}
              >
                <Ionicons
                  name="person"
                  size={20}
                  color={newRequest.beneficiaryIds.length === 0 ? colors.primary : colors.textSecondary}
                />
                <Text style={[
                  styles.beneficiaryOptionText,
                  { color: newRequest.beneficiaryIds.length === 0 ? colors.primary : colors.text }
                ]}>
                  For myself
                </Text>
              </TouchableOpacity>
              {getSelectedBeneficiaries().map(member => (
                <View key={member.id} style={styles.selectedBeneficiary}>
                  <View style={styles.beneficiaryInfo}>
                    <View style={[styles.beneficiaryAvatar, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.beneficiaryAvatarText, { color: colors.white }]}>
                        {member.first_name?.charAt(0) || member.name?.charAt(0) || '?'}
                      </Text>
                    </View>
                    <View style={styles.beneficiaryDetails}>
                      <Text style={[styles.beneficiaryName, { color: colors.text }]}>
                        {member.first_name} {member.last_name}
                      </Text>
                      <Text style={[styles.beneficiaryRole, { color: colors.textSecondary }]}>
                        {member.role || 'Member'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeBeneficiary(member.id)}
                    style={styles.removeBeneficiaryButton}
                  >
                    <Ionicons name="close" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.addBeneficiaryButton, { borderColor: colors.primary }]}
                onPress={() => setShowBeneficiaryPicker(true)}
              >
                <Ionicons name="add" size={20} color={colors.primary} />
                <Text style={[styles.addBeneficiaryText, { color: colors.primary }]}>
                  Add Beneficiary
                </Text>
              </TouchableOpacity>
            </View>
            {formErrors.beneficiaries && <Text style={[styles.errorText, { color: colors.error }]}>{formErrors.beneficiaries}</Text>}
            <View style={styles.categorySection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Category *</Text>
              <View style={styles.categoryGrid}>
                {welfareCategories.map((category) => {
                  const isSelected = newRequest.category === category.id;
                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryGridItem,
                        {
                          backgroundColor: isSelected ? category.color + '12' : colors.background,
                          borderColor: isSelected ? category.color : colors.border,
                          borderWidth: isSelected ? 1.5 : 1,
                        }
                      ]}
                      onPress={() => {
                        setNewRequest(prev => ({ ...prev, category: category.id }));
                        clearFieldError('category');
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.categoryIconCircle,
                        { backgroundColor: isSelected ? category.color + '25' : colors.surface }
                      ]}>
                        <Ionicons
                          name={category.icon}
                          size={22}
                          color={isSelected ? category.color : colors.textTertiary}
                        />
                      </View>
                      <Text style={[
                        styles.categoryGridText,
                        { color: isSelected ? category.color : colors.text }
                      ]}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {formErrors.category && <Text style={[styles.errorText, { color: colors.error }]}>{formErrors.category}</Text>}
            </View>
            <View style={styles.urgencySection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Priority Level *</Text>
              <View style={styles.urgencyGrid}>
                {urgencyLevels.map((level) => {
                  const isSelected = newRequest.urgency === level.id;
                  return (
                    <TouchableOpacity
                      key={level.id}
                      style={[
                        styles.urgencyGridItem,
                        {
                          backgroundColor: isSelected ? level.color + '12' : colors.background,
                          borderColor: isSelected ? level.color : colors.border,
                          borderWidth: isSelected ? 1.5 : 1,
                        }
                      ]}
                      onPress={() => {
                        setNewRequest(prev => ({ ...prev, urgency: level.id }));
                        clearFieldError('urgency');
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.urgencyDot,
                        { backgroundColor: isSelected ? level.color : colors.textTertiary + '60' }
                      ]} />
                      <Text style={[
                        styles.urgencyGridText,
                        { color: isSelected ? level.color : colors.text }
                      ]}>
                        {level.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {formErrors.urgency && <Text style={[styles.errorText, { color: colors.error }]}>{formErrors.urgency}</Text>}
            </View>
            {Object.keys(formErrors).length > 0 && (
              <View style={styles.errorSummary}>
                <View style={styles.errorSummaryHeader}>
                  <Ionicons name="warning" size={20} color={colors.error} />
                  <Text style={[styles.errorSummaryTitle, { color: colors.error }]}>
                    Please fix the following errors:
                  </Text>
                </View>
                {Object.entries(formErrors).map(([field, error]) => (
                  <Text key={field} style={[styles.errorSummaryItem, { color: colors.error }]}>
                    {error}
                  </Text>
                ))}
              </View>
            )}
            <Button
              title="Submit Request"
              onPress={handleCreateRequest}
              style={[
                styles.submitButton,
                Object.keys(formErrors).length > 0 ? styles.submitButtonDisabled : null
              ]}
              textStyle={Object.keys(formErrors).length > 0 ? styles.submitButtonTextDisabled : null}
              icon={<Ionicons name="send" size={20} color={colors.white} />}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default CreateWelfareRequestModal;
