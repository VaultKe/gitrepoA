import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import ApiService from '../../../services/api';

const CreateMerryGoRound = ({ route, navigation }) => {
  const { chamaId } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  
  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [chamaMembers, setChamaMembers] = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [participantOrder, setParticipantOrder] = useState('automatic'); // 'automatic', 'alphabetical', 'manual'
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amountPerRound: '',
    totalParticipants: '',
    frequency: 'monthly',
    startDate: new Date().toISOString().split('T')[0], // Default to today
  });

  const frequencies = [
    { id: 'weekly', name: 'Weekly', description: 'Every week' },
    { id: 'monthly', name: 'Monthly', description: 'Every month' },
  ];

  const orderOptions = [
    { id: 'automatic', name: 'Automatic', description: 'Random order generated automatically' },
    { id: 'alphabetical', name: 'Alphabetical', description: 'Order by member names A-Z' },
    { id: 'manual', name: 'Manual', description: 'Choose the order manually' },
  ];

  useEffect(() => {
    loadChamaMembers();
  }, [chamaId]);

  const loadChamaMembers = async () => {
    try {
      setLoadingMembers(true);
      const response = await ApiService.getChamaMembers(chamaId);
      if (response.success) {
        setChamaMembers(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load chama members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleParticipant = (member) => {
    setSelectedParticipants(prev => {
      const memberId = member.user_id || member.id;
      const isSelected = prev.find(p => (p.user_id || p.id) === memberId);
      if (isSelected) {
        return prev.filter(p => (p.user_id || p.id) !== memberId);
      } else {
        return [...prev, member];
      }
    });
  };

  const moveParticipant = (fromIndex, toIndex) => {
    setSelectedParticipants(prev => {
      const newOrder = [...prev];
      const [movedItem] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, movedItem);
      return newOrder;
    });
  };

  const getOrderedParticipants = () => {
    if (participantOrder === 'alphabetical') {
      return [...selectedParticipants].sort((a, b) => {
        const nameA = `${a.user?.first_name || a.first_name || ''} ${a.user?.last_name || a.last_name || ''}`.trim();
        const nameB = `${b.user?.first_name || b.first_name || ''} ${b.user?.last_name || b.last_name || ''}`.trim();
        return nameA.localeCompare(nameB);
      });
    } else if (participantOrder === 'automatic') {
      return [...selectedParticipants].sort(() => Math.random() - 0.5);
    }
    return selectedParticipants; // manual order
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Please enter a name for the merry-go-round');
      return false;
    }
    if (!formData.amountPerRound || parseFloat(formData.amountPerRound) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount per round');
      return false;
    }
    if (selectedParticipants.length < 2) {
      Alert.alert('Validation Error', 'Please select at least 2 participants');
      return false;
    }
    if (!formData.startDate.trim()) {
      Alert.alert('Validation Error', 'Please enter a start date');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      
      // Format the start date to YYYY-MM-DD format
      let formattedStartDate = formData.startDate.trim();

      // If the date includes time (space), extract only the date part
      if (formattedStartDate.includes(' ')) {
        formattedStartDate = formattedStartDate.split(' ')[0];
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(formattedStartDate)) {
        Alert.alert('Invalid Date Format', 'Please enter date in YYYY-MM-DD format (e.g., 2025-06-09)');
        return;
      }

      // Get ordered participants
      const orderedParticipants = getOrderedParticipants();

      const merryGoRoundData = {
        chamaId,
        name: formData.name.trim(),
        description: formData.description.trim(),
        amountPerRound: parseFloat(formData.amountPerRound),
        totalParticipants: selectedParticipants.length,
        frequency: formData.frequency,
        startDate: formattedStartDate,
        participants: orderedParticipants.map((participant, index) => ({
          userId: participant.user_id || participant.id,
          position: index + 1,
          name: `${participant.user?.first_name || participant.first_name || ''} ${participant.user?.last_name || participant.last_name || ''}`.trim(),
          email: participant.user?.email || participant.email || '',
        })),
        participantOrder: participantOrder,
      };

      const response = await ApiService.createMerryGoRound(merryGoRoundData);
      
      if (response.success) {
        navigation.navigate('MerryGoRoundScreen', {
          chamaId,
          newMerryGoRound: response.data,
          refresh: true
        });
      } else {
        Alert.alert('Error', response.error || 'Failed to create merry-go-round');
      }
    } catch (error) {
      console.error('Error creating merry-go-round:', error);
      Alert.alert('Error', 'Failed to create merry-go-round. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderFrequencyOption = (frequency) => (
    <TouchableOpacity
      key={frequency.id}
      style={[
        styles.frequencyOption,
        {
          backgroundColor: formData.frequency === frequency.id ? colors.primary + '20' : colors.background,
          borderColor: formData.frequency === frequency.id ? colors.primary : colors.border,
        }
      ]}
      onPress={() => handleInputChange('frequency', frequency.id)}
    >
      <View style={styles.frequencyContent}>
        <Text style={[
          styles.frequencyName,
          { color: formData.frequency === frequency.id ? colors.primary : colors.text }
        ]}>
          {frequency.name}
        </Text>
        <Text style={[
          styles.frequencyDescription,
          { color: formData.frequency === frequency.id ? colors.primary : colors.textSecondary }
        ]}>
          {frequency.description}
        </Text>
      </View>
      {formData.frequency === frequency.id && (
        <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Card variant="outlined" style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Basic Information
            </Text>
            
            <Input
              label="Name *"
              value={formData.name}
              onChangeText={(text) => handleInputChange('name', text)}
              placeholder="Enter merry-go-round name"
              icon={<Ionicons name="refresh-circle" size={20} color={colors.textSecondary} />}
            />

            <Input
              label="Description"
              value={formData.description}
              onChangeText={(text) => handleInputChange('description', text)}
              placeholder="Describe the purpose and rules..."
              multiline
              numberOfLines={3}
              icon={<Ionicons name="document-text" size={20} color={colors.textSecondary} />}
            />

            <Input
              label="Amount per Round (KES) *"
              value={formData.amountPerRound}
              onChangeText={(text) => handleInputChange('amountPerRound', text)}
              placeholder="Enter amount each member contributes"
              keyboardType="numeric"
              icon={<Ionicons name="cash" size={20} color={colors.textSecondary} />}
            />

            <Input
              label="Start Date *"
              value={formData.startDate}
              onChangeText={(text) => handleInputChange('startDate', text)}
              placeholder="YYYY-MM-DD"
              icon={<Ionicons name="calendar" size={20} color={colors.textSecondary} />}
            />
          </Card>

          <Card variant="outlined" style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Frequency
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              How often will the rounds occur?
            </Text>

            <View style={styles.frequencyGrid}>
              {frequencies.map(renderFrequencyOption)}
            </View>
          </Card>

          <Card variant="outlined" style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Select Participants ({selectedParticipants.length} selected)
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Choose chama members to participate in this merry-go-round
            </Text>

            {loadingMembers ? (
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading members...
              </Text>
            ) : (
              <ScrollView style={styles.membersScrollContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.membersGrid}>
                  {chamaMembers.map((member) => {
                    const memberId = member.user_id || member.id;
                    const isSelected = selectedParticipants.find(p => (p.user_id || p.id) === memberId);
                    return (
                      <TouchableOpacity
                        key={member.id}
                        style={[
                          styles.memberOption,
                          {
                            backgroundColor: isSelected ? colors.primary + '20' : colors.background,
                            borderColor: isSelected ? colors.primary : colors.border,
                          }
                        ]}
                        onPress={() => toggleParticipant(member)}
                      >
                        <View style={styles.memberInfo}>
                          <Text style={[
                            styles.memberName,
                            { color: isSelected ? colors.primary : colors.text }
                          ]}>
                            {member.user?.first_name || member.first_name} {member.user?.last_name || member.last_name}
                          </Text>
                          <Text style={[
                            styles.memberUsername,
                            { color: isSelected ? colors.primary : colors.textSecondary }
                          ]}>
                            @{member.user?.username || member.username || member.user?.email?.split('@')[0] || member.email?.split('@')[0] || 'user'}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </Card>

          {selectedParticipants.length > 0 && (
          <Card variant="outlined" style={styles.formCard}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Payout Order
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                How should the payout order be determined?
              </Text>

              <View style={styles.orderGrid}>
                {orderOptions.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.orderOption,
                      {
                        backgroundColor: participantOrder === option.id ? colors.primary + '20' : colors.background,
                        borderColor: participantOrder === option.id ? colors.primary : colors.border,
                      }
                    ]}
                    onPress={() => setParticipantOrder(option.id)}
                  >
                    <View style={styles.orderContent}>
                      <Text style={[
                        styles.orderName,
                        { color: participantOrder === option.id ? colors.primary : colors.text }
                      ]}>
                        {option.name}
                      </Text>
                      <Text style={[
                        styles.orderDescription,
                        { color: participantOrder === option.id ? colors.primary : colors.textSecondary }
                      ]}>
                        {option.description}
                      </Text>
                    </View>
                    {participantOrder === option.id && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {participantOrder === 'manual' && (
                <View style={styles.manualOrderSection}>
                  <Text style={[styles.manualOrderTitle, { color: colors.text }]}>
                    Drag to reorder participants:
                  </Text>
                  {selectedParticipants.map((participant, index) => (
                    <View key={participant.id} style={[styles.participantOrderItem, { backgroundColor: colors.backgroundSecondary }]}>
                      <Text style={[styles.orderNumber, { color: colors.primary }]}>
                        {index + 1}
                      </Text>
                      <Text style={[styles.participantName, { color: colors.text }]}>
                        {participant.user?.first_name || participant.first_name} {participant.user?.last_name || participant.last_name}
                      </Text>
                      <View style={styles.orderControls}>
                        {index > 0 && (
                          <TouchableOpacity
                            onPress={() => moveParticipant(index, index - 1)}
                            style={styles.orderButton}
                          >
                            <Ionicons name="chevron-up" size={20} color={colors.primary} />
                          </TouchableOpacity>
                        )}
                        {index < selectedParticipants.length - 1 && (
                          <TouchableOpacity
                            onPress={() => moveParticipant(index, index + 1)}
                            style={styles.orderButton}
                          >
                            <Ionicons name="chevron-down" size={20} color={colors.primary} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          )}

          <Card variant="outlined" style={styles.summaryCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Summary
            </Text>
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                Total Pool Amount:
              </Text>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>
                {formData.amountPerRound && selectedParticipants.length
                  ? `KES ${(parseFloat(formData.amountPerRound || 0) * selectedParticipants.length).toLocaleString()}`
                  : 'KES 0'
                }
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                Participants:
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {selectedParticipants.length} members
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                Duration:
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {selectedParticipants.length
                  ? `${selectedParticipants.length} ${formData.frequency} rounds`
                  : '0 rounds'
                }
              </Text>
            </View>
          </Card>

          <Button
            title="Create Merry-Go-Round"
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitButton}
            icon={<Ionicons name="add-circle" size={20} color={colors.white} />}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  formCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
  },
  frequencyGrid: {
    gap: spacing.sm,
  },
  frequencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  frequencyContent: {
    flex: 1,
  },
  frequencyName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  frequencyDescription: {
    fontSize: typography.fontSize.sm,
  },
  summaryCard: {
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontSize: typography.fontSize.base,
  },
  summaryValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  submitButton: {
    marginBottom: spacing.xl,
  },
  loadingText: {
    textAlign: 'center',
    padding: spacing.lg,
    fontSize: typography.fontSize.base,
    fontStyle: 'italic',
  },
  membersGrid: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  memberOption: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  memberUsername: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },
  orderGrid: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  orderOption: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  orderContent: {
    flex: 1,
  },
  orderName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  orderDescription: {
    fontSize: typography.fontSize.sm,
  },
  manualOrderSection: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  manualOrderTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  participantOrderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  orderNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginRight: spacing.md,
    minWidth: 30,
    textAlign: 'center',
  },
  participantName: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  orderControls: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  orderButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  membersScrollContainer: {
    maxHeight: 300,
    marginTop: spacing.md,
  },
});

export default CreateMerryGoRound;
