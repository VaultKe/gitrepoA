import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import KENYA_COUNTIES from '../../utils/kenyaCounties';

const PersonalInfoForm = memo(({
  colors,
  editing,
  profileData,
  showCountyPicker,
  countySearch,
  filteredCounties,
  onInputChange,
  onShowCountyPicker,
  onSelectCounty,
  onCountySearchChange,
  onCloseCountyPicker,
  onSave,
  onCancel,
  loading,
}) => {
  return (
    <Card variant="outlined" style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Personal Information
      </Text>

      <View style={styles.row}>
        <Input
          label="First Name"
          value={profileData.firstName}
          onChangeText={(text) => onInputChange('firstName', text)}
          editable={editing}
          style={styles.halfInput}
        />

        <Input
          label="Last Name"
          value={profileData.lastName}
          onChangeText={(text) => onInputChange('lastName', text)}
          editable={editing}
          style={styles.halfInput}
        />
      </View>

      <Input
        label="Email"
        value={profileData.email}
        onChangeText={(text) => onInputChange('email', text)}
        editable={editing}
        keyboardType="email-address"
      />

      <View style={styles.row}>
        <Input
          label="ID Number"
          value={profileData.idNumber}
          onChangeText={(text) => onInputChange('idNumber', text)}
          editable={editing}
          keyboardType="numeric"
          style={styles.halfInput}
        />

        <Input
          label="Phone Number"
          value={profileData.phone}
          onChangeText={(text) => onInputChange('phone', text)}
          editable={editing}
          keyboardType="phone-pad"
          style={styles.halfInput}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
            County {editing && '*'}
          </Text>
          <TouchableOpacity
            style={[styles.countySelector, { borderColor: colors.border }]}
            onPress={() => editing && onShowCountyPicker(true)}
            disabled={!editing}
          >
            <Text style={[styles.countyText, { color: profileData.county ? colors.text : colors.textSecondary }]}>
              {profileData.county || 'Select county'}
            </Text>
            {editing && <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />}
          </TouchableOpacity>
        </View>

        <Input
          label="Town"
          value={profileData.town}
          onChangeText={(text) => onInputChange('town', text)}
          editable={editing}
          style={styles.halfInput}
        />
      </View>

      <Modal
        visible={showCountyPicker}
        transparent
        animationType="fade"
        onRequestClose={onCloseCountyPicker}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={onCloseCountyPicker}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select County</Text>
            <TextInput
              style={[styles.countySearch, { color: colors.text, borderColor: colors.border }]}
              placeholder="Search counties..."
              placeholderTextColor={colors.textSecondary}
              value={countySearch}
              onChangeText={onCountySearchChange}
            />
            <ScrollView style={styles.countyList} nestedScrollEnabled>
              {filteredCounties.map((county) => (
                <TouchableOpacity
                  key={county}
                  style={[
                    styles.countyOption,
                    { borderBottomColor: colors.border },
                    profileData.county === county && { backgroundColor: colors.primary + '20' },
                  ]}
                  onPress={() => onSelectCounty(county)}
                >
                  <Text
                    style={[
                      styles.countyOptionText,
                      { color: profileData.county === county ? colors.primary : colors.text },
                    ]}
                  >
                    {county}
                  </Text>
                  {profileData.county === county && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
              {filteredCounties.length === 0 && (
                <Text style={[styles.noResults, { color: colors.textSecondary }]}>
                  No counties found
                </Text>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Input
        label="Occupation"
        value={profileData.occupation}
        onChangeText={(text) => onInputChange('occupation', text)}
        editable={editing}
        placeholder="Your job title or profession"
      />

      <Input
        label="Date of Birth"
        value={profileData.dateOfBirth}
        onChangeText={(text) => onInputChange('dateOfBirth', text)}
        editable={editing}
        placeholder="YYYY-MM-DD (e.g., 1990-01-15)"
        keyboardType="numeric"
      />

      <View style={styles.fieldContainer}>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>
          Gender (Optional)
        </Text>
        {editing ? (
          <View style={[styles.genderContainer, { borderColor: colors.border }]}>
            {[
              { value: 'male', label: 'Male', icon: 'male' },
              { value: 'female', label: 'Female', icon: 'female' },
              { value: 'other', label: 'Other', icon: 'transgender' },
              { value: 'prefer_not_to_say', label: 'Prefer not to say', icon: 'help-circle-outline' },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.genderOption,
                  { backgroundColor: colors.surface },
                  profileData.gender === option.value && {
                    backgroundColor: colors.primary + '20',
                    borderColor: colors.primary,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => onInputChange('gender', option.value)}
              >
                <Ionicons
                  name={option.icon}
                  size={20}
                  color={profileData.gender === option.value ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.genderOptionText,
                    { color: profileData.gender === option.value ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={[styles.readOnlyField, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.readOnlyText, { color: colors.text }]}>
              {profileData.gender
                ? ['male', 'female', 'other', 'prefer_not_to_say'].find((g) => g === profileData.gender)
                  ? profileData.gender.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                  : profileData.gender
                : 'Not specified'}
            </Text>
          </View>
        )}
      </View>

      <Input
        label="Bio"
        value={profileData.bio}
        onChangeText={(text) => onInputChange('bio', text)}
        editable={editing}
        multiline
        numberOfLines={3}
        placeholder="Tell us about yourself..."
      />

      {editing && (
        <View style={styles.editActions}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={onCancel}
            style={styles.editButton}
          />

          <Button
            title="Save Changes"
            onPress={onSave}
            loading={loading}
            style={styles.editButton}
          />
        </View>
      )}
    </Card>
  );
});

const styles = StyleSheet.create({
  section: {
    margin: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  editButton: {
    flex: 1,
  },
  fieldContainer: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  genderContainer: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  genderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  genderOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  readOnlyField: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  readOnlyText: {
    fontSize: typography.fontSize.base,
  },
  countySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 36,
  },
  countyText: {
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    maxWidth: 320,
    maxHeight: '70%',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
  },
  modalTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginBottom: spacing.xs,
  },
  countySearch: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    fontSize: typography.fontSize.base,
  },
  countyList: {
    maxHeight: 300,
  },
  countyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  countyOptionText: {
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  noResults: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});

export default PersonalInfoForm;
