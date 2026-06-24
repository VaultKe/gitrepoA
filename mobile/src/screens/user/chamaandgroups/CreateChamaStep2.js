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

  return (
    <Card style={styles.section}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        {chamaData.group_type === 'contribution' ? 'Target & Location Details' : 'Financial & Location Details'}
      </Text>

      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.halfInput, styles.countySelector, { borderColor: showErrors && formErrors.county ? colors.error : colors.border }]}
          onPress={() => setShowCountyPicker(true)}
        >
          <Text style={[styles.countyText, { color: chamaData.county ? colors.text : colors.textSecondary }]}>
            {chamaData.county || 'Select county'}
          </Text>
          <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <Input
          label="Town *"
          value={chamaData.town}
          onChangeText={(text) => handleInputChange('town', text)}
          placeholder="Select town"
          style={styles.halfInput}
          error={showErrors && formErrors.town}
        />
      </View>

      <Modal
        visible={showCountyPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCountyPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCountyPicker(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select County</Text>
            <TextInput
              style={[styles.countySearch, { color: colors.text, borderColor: colors.border }]}
              placeholder="Search counties..."
              placeholderTextColor={colors.textSecondary}
              value={countySearch}
              onChangeText={setCountySearch}
            />
            <ScrollView style={styles.countyList} nestedScrollEnabled>
              {filteredCounties.map((county) => (
                <TouchableOpacity
                  key={county}
                  style={[
                    styles.countyOption,
                    { borderBottomColor: colors.border },
                    chamaData.county === county && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={() => selectCounty(county)}
                >
                  <Text style={[
                    styles.countyOptionText,
                    { color: chamaData.county === county ? colors.primary : colors.text }
                  ]}>
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
        </TouchableOpacity>
      </Modal>

      {chamaData.group_type === 'chama' && (
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
            <View style={styles.frequencyContainer}>
              {frequencies.map((freq) => (
                <TouchableOpacity
                  key={freq.id}
                  style={[
                    styles.frequencyChip,
                    {
                      backgroundColor: chamaData.contribution_frequency === freq.id ? colors.primary : colors.backgroundSecondary,
                      borderColor: colors.border,
                    }
                  ]}
                  onPress={() => handleInputChange('contribution_frequency', freq.id)}
                >
                  <Text style={[
                    styles.frequencyText,
                    { color: chamaData.contribution_frequency === freq.id ? colors.white : colors.text }
                  ]}>
                    {freq.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {chamaData.group_type === 'contribution' && (
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
            placeholder="e.g., Minimum KES 100 per person, Deadline: End of month, No refunds after target reached"
            multiline
            numberOfLines={3}
            error={showErrors && formErrors.contribution_rules}
          />
        </>
      )}

      <View style={styles.paymentMethodSection}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Payment Method (Optional)
        </Text>
        <View style={styles.descriptionContainer}>
          <Text
            style={[styles.sectionDescription, { color: colors.textSecondary }]}
            adjustsFontSizeToFit={false}
            allowFontScaling={true}
          >
            Configure how members will send payments to this {chamaData.group_type === 'contribution' ? 'contribution group' : 'chama'}
          </Text>
        </View>
      </View>

      <View style={styles.paymentMethodRow}>
        <TouchableOpacity
          style={[
            styles.paymentMethodCard,
            styles.paymentMethodCardLeft,
            {
              backgroundColor: chamaData.payment_method === 'till' ? colors.primary + '20' : colors.backgroundSecondary,
              borderColor: chamaData.payment_method === 'till' ? colors.primary : colors.border,
            }
          ]}
          onPress={() => handleInputChange('payment_method', chamaData.payment_method === 'till' ? '' : 'till')}
        >
          {chamaData.payment_method === 'till' && (
            <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="checkmark" size={10} color={colors.white} />
            </View>
          )}
          <Ionicons
            name="card"
            size={24}
            color={chamaData.payment_method === 'till' ? colors.primary : colors.textSecondary}
          />
          <Text style={[
            styles.paymentMethodText,
            { color: chamaData.payment_method === 'till' ? colors.primary : colors.text }
          ]}>
            TILL
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.paymentMethodCard,
            styles.paymentMethodCardRight,
            {
              backgroundColor: chamaData.payment_method === 'paybill' ? colors.primary + '20' : colors.backgroundSecondary,
              borderColor: chamaData.payment_method === 'paybill' ? colors.primary : colors.border,
            }
          ]}
          onPress={() => handleInputChange('payment_method', chamaData.payment_method === 'paybill' ? '' : 'paybill')}
        >
          {chamaData.payment_method === 'paybill' && (
            <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="checkmark" size={10} color={colors.white} />
            </View>
          )}
          <Ionicons
            name="business"
            size={24}
            color={chamaData.payment_method === 'paybill' ? colors.primary : colors.textSecondary}
          />
          <Text style={[
            styles.paymentMethodText,
            { color: chamaData.payment_method === 'paybill' ? colors.primary : colors.text }
          ]}>
            PAYBILL
          </Text>
        </TouchableOpacity>
      </View>

      {chamaData.payment_method === 'till' && (
        <View>
          <Input
            label="TILL Number *"
            value={chamaData.till_number}
            onChangeText={(text) => handleInputChange('till_number', text)}
            placeholder="e.g., 123456"
            keyboardType="numeric"
            maxLength={10}
            error={showErrors && formErrors.till_number}
          />
          <Input
            label="Recipient Name *"
            value={chamaData.payment_recipient_name}
            onChangeText={(text) => handleInputChange('payment_recipient_name', text)}
            placeholder="Name members will see when paying"
            error={showErrors && formErrors.payment_recipient_name}
          />
        </View>
      )}

      {chamaData.payment_method === 'paybill' && (
        <View>
          <Input
            label="Business Number *"
            value={chamaData.paybill_business_number}
            onChangeText={(text) => handleInputChange('paybill_business_number', text)}
            placeholder="e.g., 123456"
            keyboardType="numeric"
            maxLength={10}
            error={showErrors && formErrors.paybill_business_number}
          />
          <Input
            label="Account Number *"
            value={chamaData.paybill_account_number}
            onChangeText={(text) => handleInputChange('paybill_account_number', text)}
            placeholder="Account number for payments"
            error={showErrors && formErrors.paybill_account_number}
          />
          <Input
            label="Recipient Name *"
            value={chamaData.payment_recipient_name}
            onChangeText={(text) => handleInputChange('payment_recipient_name', text)}
            placeholder="Name members will see when paying"
            error={showErrors && formErrors.payment_recipient_name}
          />
        </View>
      )}

      <Input
        label="Maximum Members *"
        value={chamaData.max_members}
        onChangeText={(text) => handleInputChange('max_members', text)}
        placeholder="e.g., 20"
        keyboardType="numeric"
        error={showErrors && formErrors.max_members}
        style={{ marginTop: spacing.lg }}
      />
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
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  frequencyContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  frequencyChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  frequencyText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  paymentMethodSection: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    width: '100%',
    flexDirection: 'column',
  },
  sectionLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  sectionDescription: {
    fontSize: typography.fontSize.base,
    textAlign: 'left',
    lineHeight: 22,
    letterSpacing: 0.2,
    width: '100%',
    minHeight: 44,
    flexShrink: 1,
    flexGrow: 1,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.sm,
  },
  paymentMethodCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  paymentMethodText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: typography.lineHeight.normal,
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentMethodCardLeft: {
    flex: 1,
    marginRight: spacing.xs,
  },
  paymentMethodCardRight: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  countySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 48,
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
    ...shadows.lg,
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

export default CreateChamaStep2;
