import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Input from '../../../components/common/Input';
import KENYA_COUNTIES from '../../../utils/kenyaCounties';

const CreateChamaStep2 = ({
  chamaData,
  handleInputChange,
  showErrors,
  formErrors,
  colors,
}) => {
  const [showCountyPicker, setShowCountyPicker] = useState(false);
  const [countySearch, setCountySearch] = useState('');

  const filteredCounties = KENYA_COUNTIES.filter(county =>
    county.toLowerCase().includes(countySearch.toLowerCase())
  );

  const selectCounty = (county) => {
    handleInputChange('county', county);
    setShowCountyPicker(false);
    setCountySearch('');
  };

  const frequencies = [
    { id: 'weekly', name: 'Weekly' },
    { id: 'monthly', name: 'Monthly' },
    { id: 'quarterly', name: 'Quarterly' },
  ];

  const isChama = chamaData.group_type === 'chama';

  return (
    <Card style={styles.section}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        {isChama ? 'Financial & Location Details' : 'Target & Location Details'}
      </Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        {isChama
          ? 'Set your contribution amount, frequency, and where your chama is based.'
          : 'Define your target amount and where the contribution group operates.'}
      </Text>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Location</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[
            styles.halfInput,
            styles.countySelector,
            { borderColor: showErrors && formErrors.county ? colors.error : colors.border }
          ]}
          onPress={() => {
            setCountySearch('');
            setShowCountyPicker(true);
          }}
        >
          <Text
            style={[
              styles.countyText,
              { color: chamaData.county ? colors.text : colors.textSecondary }
            ]}
            numberOfLines={1}
          >
            {chamaData.county || 'Select county'}
          </Text>
          <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <Input
          label="Town *"
          value={chamaData.town}
          onChangeText={(text) => handleInputChange('town', text)}
          placeholder="Enter town"
          style={styles.halfInput}
          error={showErrors && formErrors.town}
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: spacing.lg }]}>
        {isChama ? 'Contributions' : 'Target'}
      </Text>

      {isChama ? (
        <View style={styles.row}>
          <Input
            label="Contribution Amount (KES) *"
            value={chamaData.contribution_amount}
            onChangeText={(text) => handleInputChange('contribution_amount', text)}
            placeholder="0"
            keyboardType="numeric"
            style={styles.halfInput}
            error={showErrors && formErrors.contribution_amount}
          />
          <View style={styles.halfInput}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              Frequency *
            </Text>
            <View style={styles.frequencyRow}>
              {frequencies.map((freq) => (
                <TouchableOpacity
                  key={freq.id}
                  style={[
                    styles.frequencyChip,
                    {
                      backgroundColor: chamaData.contribution_frequency === freq.id ? colors.primary : colors.backgroundSecondary,
                      borderColor: chamaData.contribution_frequency === freq.id ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => handleInputChange('contribution_frequency', freq.id)}
                >
                  <Text
                    style={[
                      styles.frequencyText,
                      { color: chamaData.contribution_frequency === freq.id ? colors.white : colors.text }
                    ]}
                  >
                    {freq.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      ) : (
        <>
          <Input
            label="Target Amount (KES) *"
            value={chamaData.target_amount}
            onChangeText={(text) => handleInputChange('target_amount', text)}
            placeholder="e.g., 50000"
            keyboardType="numeric"
            error={showErrors && formErrors.target_amount}
          />
          <Input
            label="Contribution Rules"
            value={chamaData.contribution_rules}
            onChangeText={(text) => handleInputChange('contribution_rules', text)}
            placeholder="e.g., Minimum KES 100 per person, Deadline: End of month"
            multiline
            numberOfLines={3}
            error={showErrors && formErrors.contribution_rules}
          />
        </>
      )}

      <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: spacing.lg }]}>
        Group Settings
      </Text>
      <Input
        label="Maximum Members *"
        value={chamaData.max_members}
        onChangeText={(text) => handleInputChange('max_members', text)}
        placeholder="e.g., 20"
        keyboardType="numeric"
        error={showErrors && formErrors.max_members}
      />

      <Modal
        visible={showCountyPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCountyPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowCountyPicker(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select County</Text>
              <TouchableOpacity onPress={() => setShowCountyPicker(false)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.countySearch, { borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.countySearchInput, { color: colors.text }]}
                placeholder="Search counties..."
                placeholderTextColor={colors.textSecondary}
                value={countySearch}
                onChangeText={setCountySearch}
                autoFocus
              />
              {countySearch.length > 0 && (
                <TouchableOpacity onPress={() => setCountySearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.countyList} nestedScrollEnabled>
              <TouchableOpacity
                style={[
                  styles.countyOption,
                  { borderBottomColor: colors.border },
                  chamaData.county === 'National' && { backgroundColor: colors.primary + '15' }
                ]}
                onPress={() => selectCounty('National')}
              >
                <View style={styles.countyOptionLeft}>
                  <Ionicons name="earth" size={18} color={colors.primary} />
                  <Text
                    style={[
                      styles.countyOptionText,
                      { color: chamaData.county === 'National' ? colors.primary : colors.text }
                    ]}
                  >
                    Not specific/Multi-County
                  </Text>
                </View>
                {chamaData.county === 'National' && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>

              {filteredCounties.map((county) => (
                <TouchableOpacity
                  key={county}
                  style={[
                    styles.countyOption,
                    { borderBottomColor: colors.border },
                    chamaData.county === county && { backgroundColor: colors.primary + '15' }
                  ]}
                  onPress={() => selectCounty(county)}
                >
                  <Text
                    style={[
                      styles.countyOptionText,
                      { color: chamaData.county === county ? colors.primary : colors.text }
                    ]}
                  >
                    {county}
                  </Text>
                  {chamaData.county === county && (
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
        </View>
      </Modal>
    </Card>
  );
};

const styles = StyleSheet.create({
  section: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  stepTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  countySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 48,
    marginBottom: 0,
  },
  countyText: {
    fontSize: typography.fontSize.base,
    flex: 1,
    marginRight: spacing.sm,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  frequencyChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  frequencyText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: '85%',
    maxWidth: 320,
    borderRadius: borderRadius.lg,
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  countySearch: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  countySearchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    paddingVertical: 0,
    marginLeft: spacing.sm,
  },
  countyList: {
    maxHeight: 320,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  countyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  countyOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  countyOptionText: {
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  noResults: {
    fontSize: typography.fontSize.sm,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
});

export default CreateChamaStep2;
