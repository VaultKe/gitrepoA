import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Switch,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import Card from '../../components/common/Card';

const PaymentMethodsScreen = ({ navigation }) => {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMethodType, setSelectedMethodType] = useState('mpesa');
  const [newMethodData, setNewMethodData] = useState({
    mpesa: { phoneNumber: '', name: '' },
    bank: { accountNumber: '', bankName: '', accountName: '' },
    card: { cardNumber: '', expiryDate: '', cardholderName: '' },
  });

  const methodTypes = [
    {
      id: 'mpesa',
      name: 'M-Pesa',
      icon: 'phone-portrait',
      color: '#00A651',
      description: 'Mobile money payments',
    },
    {
      id: 'bank',
      name: 'Bank Account',
      icon: 'business',
      color: '#1976D2',
      description: 'Direct bank transfers',
    },
    {
      id: 'card',
      name: 'Debit/Credit Card',
      icon: 'card',
      color: '#FF6B35',
      description: 'Visa, Mastercard, etc.',
    },
  ];

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      // TODO: Implement API call to load payment methods
      // Simulated data for now
      const mockMethods = [
        {
          id: '1',
          type: 'mpesa',
          name: 'M-Pesa',
          details: '+254712345678',
          isDefault: true,
          isActive: true,
          lastUsed: '2024-01-15',
        },
        {
          id: '2',
          type: 'bank',
          name: 'KCB Bank',
          details: '****1234',
          isDefault: false,
          isActive: true,
          lastUsed: '2024-01-10',
        },
      ];
      setPaymentMethods(mockMethods);
    } catch (error) {
      console.error('Failed to load payment methods:', error);
      Alert.alert('Error', 'Failed to load payment methods. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    const methodData = newMethodData[selectedMethodType];
    
    // Basic validation
    if (selectedMethodType === 'mpesa' && !methodData.phoneNumber) {
      Alert.alert('Error', 'Please enter your M-Pesa phone number.');
      return;
    }
    if (selectedMethodType === 'bank' && (!methodData.accountNumber || !methodData.bankName)) {
      Alert.alert('Error', 'Please fill in all bank account details.');
      return;
    }
    if (selectedMethodType === 'card' && (!methodData.cardNumber || !methodData.expiryDate)) {
      Alert.alert('Error', 'Please fill in all card details.');
      return;
    }

    try {
      setLoading(true);
      // TODO: Implement API call to add payment method
      
      const newMethod = {
        id: Date.now().toString(),
        type: selectedMethodType,
        name: methodTypes.find(t => t.id === selectedMethodType)?.name,
        details: getMethodDisplayDetails(selectedMethodType, methodData),
        isDefault: paymentMethods.length === 0,
        isActive: true,
        lastUsed: null,
      };

      setPaymentMethods(prev => [...prev, newMethod]);
      setShowAddModal(false);
      resetNewMethodData();
      
      Alert.alert('Success', 'Payment method added successfully!');
    } catch (error) {
      console.error('Failed to add payment method:', error);
      Alert.alert('Error', 'Failed to add payment method. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getMethodDisplayDetails = (type, data) => {
    switch (type) {
      case 'mpesa':
        return data.phoneNumber;
      case 'bank':
        return `${data.bankName} - ****${data.accountNumber.slice(-4)}`;
      case 'card':
        return `****${data.cardNumber.slice(-4)}`;
      default:
        return '';
    }
  };

  const resetNewMethodData = () => {
    setNewMethodData({
      mpesa: { phoneNumber: '', name: '' },
      bank: { accountNumber: '', bankName: '', accountName: '' },
      card: { cardNumber: '', expiryDate: '', cardholderName: '' },
    });
  };

  const handleSetDefault = async (methodId) => {
    try {
      // TODO: Implement API call to set default payment method
      setPaymentMethods(prev =>
        prev.map(method => ({
          ...method,
          isDefault: method.id === methodId,
        }))
      );
      Alert.alert('Success', 'Default payment method updated!');
    } catch (error) {
      console.error('Failed to set default payment method:', error);
      Alert.alert('Error', 'Failed to update default payment method.');
    }
  };

  const handleToggleActive = async (methodId, isActive) => {
    try {
      // TODO: Implement API call to toggle payment method status
      setPaymentMethods(prev =>
        prev.map(method =>
          method.id === methodId ? { ...method, isActive } : method
        )
      );
    } catch (error) {
      console.error('Failed to toggle payment method:', error);
      Alert.alert('Error', 'Failed to update payment method status.');
    }
  };

  const handleDeleteMethod = (methodId) => {
    const method = paymentMethods.find(m => m.id === methodId);
    
    Alert.alert(
      'Delete Payment Method',
      `Are you sure you want to delete ${method?.name} (${method?.details})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // TODO: Implement API call to delete payment method
              setPaymentMethods(prev => prev.filter(m => m.id !== methodId));
              Alert.alert('Success', 'Payment method deleted successfully!');
            } catch (error) {
              console.error('Failed to delete payment method:', error);
              Alert.alert('Error', 'Failed to delete payment method.');
            }
          },
        },
      ]
    );
  };

  const renderPaymentMethod = (method) => {
    const methodType = methodTypes.find(t => t.id === method.type);
    
    return (
      <Card key={method.id} style={styles.methodCard}>
        <View style={styles.methodHeader}>
          <View style={styles.methodInfo}>
            <View style={[styles.methodIcon, { backgroundColor: methodType?.color + '20' }]}>
              <Ionicons name={methodType?.icon} size={24} color={methodType?.color} />
            </View>
            <View style={styles.methodDetails}>
              <Text style={[styles.methodName, { color: colors.text }]}>
                {method.name}
              </Text>
              <Text style={[styles.methodDetailsText, { color: colors.textSecondary }]}>
                {method.details}
              </Text>
              {method.isDefault && (
                <Text style={[styles.defaultBadge, { color: colors.primary }]}>
                  Default
                </Text>
              )}
            </View>
          </View>
          <Switch
            value={method.isActive}
            onValueChange={(value) => handleToggleActive(method.id, value)}
            trackColor={{ false: colors.border, true: colors.primary + '40' }}
            thumbColor={method.isActive ? colors.primary : colors.textSecondary}
          />
        </View>
        
        <View style={styles.methodActions}>
          {!method.isDefault && (
            <TouchableOpacity
              style={[styles.actionButton, { borderColor: colors.primary }]}
              onPress={() => handleSetDefault(method.id)}
            >
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>
                Set as Default
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.error }]}
            onPress={() => handleDeleteMethod(method.id)}
          >
            <Text style={[styles.actionButtonText, { color: colors.error }]}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const renderAddMethodForm = () => {
    const data = newMethodData[selectedMethodType];
    
    switch (selectedMethodType) {
      case 'mpesa':
        return (
          <View>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Phone Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="+254712345678"
              placeholderTextColor={colors.textSecondary}
              value={data.phoneNumber}
              onChangeText={(text) => setNewMethodData(prev => ({
                ...prev,
                mpesa: { ...prev.mpesa, phoneNumber: text }
              }))}
              keyboardType="phone-pad"
            />
            <Text style={[styles.inputLabel, { color: colors.text }]}>Account Name (Optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="John Doe"
              placeholderTextColor={colors.textSecondary}
              value={data.name}
              onChangeText={(text) => setNewMethodData(prev => ({
                ...prev,
                mpesa: { ...prev.mpesa, name: text }
              }))}
            />
          </View>
        );
        
      case 'bank':
        return (
          <View>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Bank Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="KCB Bank"
              placeholderTextColor={colors.textSecondary}
              value={data.bankName}
              onChangeText={(text) => setNewMethodData(prev => ({
                ...prev,
                bank: { ...prev.bank, bankName: text }
              }))}
            />
            <Text style={[styles.inputLabel, { color: colors.text }]}>Account Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="1234567890"
              placeholderTextColor={colors.textSecondary}
              value={data.accountNumber}
              onChangeText={(text) => setNewMethodData(prev => ({
                ...prev,
                bank: { ...prev.bank, accountNumber: text }
              }))}
              keyboardType="numeric"
            />
            <Text style={[styles.inputLabel, { color: colors.text }]}>Account Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="John Doe"
              placeholderTextColor={colors.textSecondary}
              value={data.accountName}
              onChangeText={(text) => setNewMethodData(prev => ({
                ...prev,
                bank: { ...prev.bank, accountName: text }
              }))}
            />
          </View>
        );
        
      case 'card':
        return (
          <View>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Card Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="1234 5678 9012 3456"
              placeholderTextColor={colors.textSecondary}
              value={data.cardNumber}
              onChangeText={(text) => setNewMethodData(prev => ({
                ...prev,
                card: { ...prev.card, cardNumber: text }
              }))}
              keyboardType="numeric"
              maxLength={19}
            />
            <Text style={[styles.inputLabel, { color: colors.text }]}>Expiry Date</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="MM/YY"
              placeholderTextColor={colors.textSecondary}
              value={data.expiryDate}
              onChangeText={(text) => setNewMethodData(prev => ({
                ...prev,
                card: { ...prev.card, expiryDate: text }
              }))}
              maxLength={5}
            />
            <Text style={[styles.inputLabel, { color: colors.text }]}>Cardholder Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="John Doe"
              placeholderTextColor={colors.textSecondary}
              value={data.cardholderName}
              onChangeText={(text) => setNewMethodData(prev => ({
                ...prev,
                card: { ...prev.card, cardholderName: text }
              }))}
            />
          </View>
        );
        
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="card" size={32} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Payment Methods
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Manage your payment options for contributions and purchases
          </Text>
        </View>

        {/* Add Payment Method Button */}
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color={colors.white} />
          <Text style={[styles.addButtonText, { color: colors.white }]}>
            Add Payment Method
          </Text>
        </TouchableOpacity>

        {/* Payment Methods List */}
        <View style={styles.methodsList}>
          {paymentMethods.length > 0 ? (
            paymentMethods.map(renderPaymentMethod)
          ) : (
            <Card style={styles.emptyState}>
              <Ionicons name="card-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                No payment methods added yet
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                Add a payment method to start making contributions and purchases
              </Text>
            </Card>
          )}
        </View>
      </ScrollView>

      {/* Add Payment Method Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Text style={[styles.modalCancelText, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Payment Method</Text>
            <TouchableOpacity onPress={handleAddPaymentMethod} disabled={loading}>
              <Text style={[styles.modalSaveText, { color: colors.primary }]}>
                {loading ? 'Adding...' : 'Add'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {/* Method Type Selection */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Method Type</Text>
            <View style={styles.methodTypesGrid}>
              {methodTypes.map(type => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.methodTypeCard,
                    {
                      backgroundColor: selectedMethodType === type.id ? type.color + '20' : colors.surface,
                      borderColor: selectedMethodType === type.id ? type.color : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedMethodType(type.id)}
                >
                  <Ionicons
                    name={type.icon}
                    size={32}
                    color={selectedMethodType === type.id ? type.color : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.methodTypeName,
                      { color: selectedMethodType === type.id ? type.color : colors.text },
                    ]}
                  >
                    {type.name}
                  </Text>
                  <Text
                    style={[
                      styles.methodTypeDescription,
                      { color: selectedMethodType === type.id ? type.color : colors.textSecondary },
                    ]}
                  >
                    {type.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Form Fields */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Details</Text>
            {renderAddMethodForm()}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: spacing.md,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  addButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  methodsList: {
    gap: spacing.md,
  },
  methodCard: {
    padding: spacing.md,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  methodDetails: {
    flex: 1,
  },
  methodName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  methodDetailsText: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  defaultBadge: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
  },
  methodActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyStateText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalCancelText: {
    fontSize: typography.fontSize.base,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  modalSaveText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  modalContent: {
    flex: 1,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  methodTypesGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  methodTypeCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  methodTypeName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  methodTypeDescription: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
  },
});

export default PaymentMethodsScreen;
