import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  Share,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import ApiService from '../../services/api';

// Cross-platform QR Code component
const CrossPlatformQRCode = ({ value, size = 200, colors }) => {
  const [qrDataUrl, setQrDataUrl] = useState(null);

  useEffect(() => {
    // For now, we'll always use the placeholder approach
    // In a production app, you could integrate with a QR code service
    // or use platform-specific QR code generation
    setQrDataUrl(null);
  }, [value, size, colors]);

  if (Platform.OS === 'web' && qrDataUrl) {
    // Show actual QR code on web using a React Native compatible approach
    return (
      <View style={{
        width: size,
        height: size,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 8,
      }}>
        <Text style={{
          color: colors.text,
          fontSize: 12,
          textAlign: 'center',
          fontWeight: '600'
        }}>
          QR Code Generated Successfully
        </Text>
        <Text style={{
          color: colors.textSecondary,
          fontSize: 10,
          textAlign: 'center',
          marginTop: 4
        }}>
          Use the share link below
        </Text>
      </View>
    );
  }

  // Enhanced QR code display - bigger and more prominent
  return (
    <View style={{
      width: size,
      height: size,
      backgroundColor: colors.surface,
      borderWidth: 3,
      borderColor: colors.primary,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    }}>
      {/* Large QR Code Icon */}
      <View style={{
        backgroundColor: colors.primary + '15',
        borderRadius: 20,
        padding: 24,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: colors.primary + '30',
      }}>
        <Ionicons name="qr-code" size={size * 0.35} color={colors.primary} />
      </View>

      {/* VaultKe Branding */}
      <View style={{
        backgroundColor: colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 8,
      }}>
        <Text style={{
          color: colors.white,
          fontSize: 12,
          fontWeight: '800',
          letterSpacing: 1,
        }}>
          VAULTKE
        </Text>
      </View>

      <Text style={{
        color: colors.text,
        fontSize: 16,
        textAlign: 'center',
        fontWeight: '700',
        marginBottom: 4,
      }}>
        Payment Request
      </Text>
      <Text style={{
        color: colors.textSecondary,
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
      }}>
        Scan with VaultKe app or share link
      </Text>
    </View>
  );
};

// Cross-platform clipboard utility
const copyToClipboard = async (text) => {
  try {
    if (Platform.OS === 'web') {
      // For web, use the Clipboard API if available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      }
    } else {
      // For mobile platforms, try to use expo-clipboard
      try {
        const { setStringAsync } = await import('expo-clipboard');
        await setStringAsync(text);
        return true;
      } catch (clipboardError) {
        // Fallback: show an alert with the text to copy manually
        Alert.alert(
          'Copy Link',
          `Copy this link to share:\n\n${text}`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'OK',
              onPress: () => {
                Alert.alert('Info', 'Link is ready to be shared');
              }
            }
          ]
        );
        return true;
      }
    }
  } catch (error) {
    return false;
  }
};

const RequestMoneyScreen = ({ navigation }) => {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const screenWidth = Dimensions.get('window').width;
  const isTabletOrDesktop = screenWidth > 768;

  // State management
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [requestType, setRequestType] = useState('contact'); // 'contact' or 'phone'
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recentContacts, setRecentContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  // Load recent contacts on component mount
  useEffect(() => {
    loadRecentContacts();
  }, []);

  const quickAmounts = [500, 1000, 2000, 5000, 10000, 20000];

  // Clear errors when user starts typing
  const clearErrors = () => {
    setErrors({});
    setSuccessMessage('');
  };

  // Validate form inputs
  const validateForm = () => {
    const newErrors = {};

    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    } else if (parseFloat(amount) < 10) {
      newErrors.amount = 'Minimum amount is KES 10';
    } else if (parseFloat(amount) > 1000000) {
      newErrors.amount = 'Maximum amount is KES 1,000,000';
    }

    if (!selectedContact && !phoneNumber) {
      newErrors.contact = 'Please select a contact or enter a phone number';
    } else if (!selectedContact && phoneNumber) {
      // Validate phone number format
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length < 9 || cleanPhone.length > 12) {
        newErrors.contact = 'Please enter a valid phone number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Load recent contacts (users who have previously sent money to this user)
  const loadRecentContacts = async () => {
    try {
      setLoadingContacts(true);
      const response = await ApiService.getRecentContacts();

      if (response.success) {
        setRecentContacts(response.data || []);
      } else {
        setRecentContacts([]);
      }
    } catch (error) {
      setRecentContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Generate QR code for money request
  const generateQRCode = async () => {
    clearErrors();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      // Create money request
      const response = await ApiService.createMoneyRequest(
        parseFloat(amount),
        reason || 'Money request',
        'qr_code'
      );

      if (response.success) {
        const requestData = response.data;

        // Generate QR code data
        const qrData = {
          type: 'money_request',
          requestId: requestData.id,
          amount: parseFloat(amount),
          reason: reason || 'Money request',
          requesterId: user.id,
          requesterName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          requesterPhone: user.phone || '',
          appId: 'vaultke',
          timestamp: new Date().toISOString()
        };

        setQrCodeData(qrData);
        setShowQRModal(true);
        setSuccessMessage('Payment request created successfully!');
      } else {
        setErrors({ general: response.error || 'Failed to create money request' });
      }
    } catch (error) {
      setErrors({ general: 'Failed to generate QR code. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Send money request to specific contact
  const sendMoneyRequest = async () => {
    clearErrors();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const targetUser = selectedContact || { phone: phoneNumber };

      const response = await ApiService.sendMoneyRequest(
        parseFloat(amount),
        reason || 'Money request',
        targetUser.id,
        targetUser.phone,
        'direct'
      );

      if (response.success) {
        setSuccessMessage(`Money request for ${formatCurrency(parseFloat(amount))} sent successfully!`);
        // Clear form after successful request
        setTimeout(() => {
          setAmount('');
          setReason('');
          setSelectedContact(null);
          setPhoneNumber('');
          setSuccessMessage('');
        }, 2000);
      } else {
        // Handle specific error types
        const errorMessage = response.error || 'Failed to send money request';
        if (errorMessage.includes('User not found')) {
          setErrors({
            contact: 'No VaultKe user found with this phone number. Please check the number or ask them to register.'
          });
        } else {
          setErrors({ general: errorMessage });
        }
      }
    } catch (error) {
      setErrors({ general: 'Failed to send money request. Please check your connection and try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAmountSelect = (selectedAmount) => {
    setAmount(selectedAmount.toString());
  };

  // Share QR code link
  const shareQRCode = async () => {
    if (!qrCodeData) return;

    try {
      const shareLink = `vaultke://money-request/${qrCodeData.requestId}?amount=${qrCodeData.amount}&requester=${encodeURIComponent(qrCodeData.requesterName)}`;

      const shareMessage = `💰 Money Request from ${qrCodeData.requesterName}\n\nAmount: ${formatCurrency(qrCodeData.amount)}\nReason: ${qrCodeData.reason}\n\nClick to pay: ${shareLink}\n\nOr scan the QR code in VaultKe app`;

      await Share.share({
        message: shareMessage,
        title: 'VaultKe Money Request'
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share QR code');
    }
  };

  // Copy QR code link to clipboard
  const copyQRLink = async () => {
    if (!qrCodeData) return;

    try {
      const shareLink = `vaultke://money-request/${qrCodeData.requestId}?amount=${qrCodeData.amount}&requester=${encodeURIComponent(qrCodeData.requesterName)}`;
      const success = await copyToClipboard(shareLink);
      if (success && Platform.OS === 'web') {
        Alert.alert('Copied', 'Payment link copied to clipboard');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to copy link');
    }
  };

  const handleAmountChange = (text) => {
    const numericText = text.replace(/\D/g, '');
    setAmount(numericText);
    clearErrors(); // Clear errors when user types
  };

  const handleContactSelect = (contact) => {
    setSelectedContact(contact);
    setRequestType('contact');
    setPhoneNumber('');
  };

  const handlePhoneNumberChange = (text) => {
    // Allow + sign at the beginning and digits
    let cleanText = text.replace(/[^\d+]/g, '');

    // Handle different input formats
    if (cleanText.startsWith('+254')) {
      // Format: +254 XXX XXX XXX
      const digits = cleanText.substring(4); // Remove +254
      if (digits.length <= 9) {
        let formattedText = '+254';
        if (digits.length > 0) {
          formattedText += ` ${digits.substring(0, 3)}`;
        }
        if (digits.length > 3) {
          formattedText += ` ${digits.substring(3, 6)}`;
        }
        if (digits.length > 6) {
          formattedText += ` ${digits.substring(6, 9)}`;
        }
        setPhoneNumber(formattedText);
      }
    } else if (cleanText.startsWith('254')) {
      // Format: 254 XXX XXX XXX
      const digits = cleanText.substring(3); // Remove 254
      if (digits.length <= 9) {
        let formattedText = '254';
        if (digits.length > 0) {
          formattedText += ` ${digits.substring(0, 3)}`;
        }
        if (digits.length > 3) {
          formattedText += ` ${digits.substring(3, 6)}`;
        }
        if (digits.length > 6) {
          formattedText += ` ${digits.substring(6, 9)}`;
        }
        setPhoneNumber(formattedText);
      }
    } else if (cleanText.startsWith('0')) {
      // Format: 0XXX XXX XXX
      if (cleanText.length <= 10) {
        let formattedText = cleanText;
        if (cleanText.length > 4) {
          formattedText = `${cleanText.substring(0, 4)} ${cleanText.substring(4, 7)}`;
        }
        if (cleanText.length > 7) {
          formattedText += ` ${cleanText.substring(7, 10)}`;
        }
        setPhoneNumber(formattedText);
      }
    } else {
      // Handle other formats or partial input
      const digits = cleanText.replace(/\D/g, '');
      if (digits.length <= 10) {
        let formattedText = digits;
        if (digits.length > 3 && digits.length <= 6) {
          formattedText = `${digits.substring(0, 3)} ${digits.substring(3)}`;
        } else if (digits.length > 6) {
          formattedText = `${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6, 10)}`;
        }
        setPhoneNumber(formattedText);
      }
    }

    setRequestType('phone');
    setSelectedContact(null);
    clearErrors(); // Clear errors when user types
  };

  const handleSendRequest = () => {
    sendMoneyRequest();
  };

  const renderQuickAmounts = () => (
    <Card style={{ margin: spacing.md, borderWidth: 1, borderColor: colors.border }}>
      <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.md, color: colors.text }]}>
        Quick Amounts
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {quickAmounts.map((quickAmount) => (
          <TouchableOpacity
            key={quickAmount}
            style={[
              {
                flex: 1,
                minWidth: '30%',
                padding: spacing.md,
                borderRadius: borderRadius.md,
                borderWidth: 1,
                alignItems: 'center',
                backgroundColor: amount === quickAmount.toString() ? colors.primary : colors.surface,
                borderColor: amount === quickAmount.toString() ? colors.primary : colors.border,
              },
            ]}
            onPress={() => handleAmountSelect(quickAmount)}
          >
            <Text
              style={[
                {
                  fontSize: typography.fontSize.base,
                  fontWeight: typography.fontWeight.medium,
                  color: amount === quickAmount.toString() ? colors.white : colors.text,
                },
              ]}
            >
              {formatCurrency(quickAmount)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Card>
  );

  const renderRecentContacts = () => (
    <Card style={{ margin: spacing.md, borderWidth: 1, borderColor: colors.border }}>
      <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.md, color: colors.text }]}>
        Recent Contacts
      </Text>
      <Text style={[{ fontSize: typography.fontSize.sm, marginBottom: spacing.md, marginTop: -spacing.sm, color: colors.textSecondary }]}>
        Users who have sent you money before
      </Text>

      {loadingContacts ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[{ fontSize: typography.fontSize.sm, color: colors.textSecondary }]}>
            Loading contacts...
          </Text>
        </View>
      ) : recentContacts.length === 0 ? (
        <View style={{ alignItems: 'center', padding: spacing.xl }}>
          <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
          <Text style={[{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, marginTop: spacing.md, color: colors.textSecondary }]}>
            No recent contacts yet
          </Text>
          <Text style={[{ fontSize: typography.fontSize.sm, textAlign: 'center', marginTop: spacing.sm, color: colors.textSecondary }]}>
            Contacts will appear here after they send you money
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.sm }}>
            {recentContacts.map((contact) => (
              <TouchableOpacity
                key={contact.id}
                style={[
                  {
                    alignItems: 'center',
                    padding: spacing.md,
                    borderRadius: borderRadius.md,
                    borderWidth: 1,
                    width: 80,
                    backgroundColor: selectedContact?.id === contact.id ? colors.primary + '20' : colors.surface,
                    borderColor: selectedContact?.id === contact.id ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => handleContactSelect(contact)}
              >
                <View style={[{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, backgroundColor: colors.primary }]}>
                  <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.white }]}>
                    {(contact.first_name || contact.name || 'U')[0].toUpperCase()}
                    {(contact.last_name || '')[0]?.toUpperCase() || ''}
                  </Text>
                </View>
                <Text style={[{ fontSize: typography.fontSize.sm, textAlign: 'center', color: colors.text }]} numberOfLines={1}>
                  {contact.first_name && contact.last_name
                    ? `${contact.first_name} ${contact.last_name}`
                    : contact.name || 'Unknown User'}
                </Text>
                <Text style={[{ fontSize: typography.fontSize.sm, textAlign: 'center', color: colors.textSecondary }]} numberOfLines={1}>
                  {contact.phone || contact.email || 'No contact info'}
                </Text>
                <Text style={[{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium, marginTop: spacing.xs, color: colors.primary }]} numberOfLines={1}>
                  Last: {formatCurrency(contact.lastAmount || 0)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </Card>
  );

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 20 }} // Add bottom padding for stack screens
      showsVerticalScrollIndicator={false}
    >
      {/* Success Message */}
      {successMessage ? (
        <View style={[{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginHorizontal: spacing.md, marginBottom: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, gap: spacing.sm, backgroundColor: colors.success + '20', borderColor: colors.success }]}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, flex: 1, color: colors.success }]}>{successMessage}</Text>
        </View>
      ) : null}

      {/* Error Messages */}
      {errors.general ? (
        <View style={[{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginHorizontal: spacing.md, marginBottom: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, gap: spacing.sm, backgroundColor: colors.error + '20', borderColor: colors.error }]}>
          <Ionicons name="alert-circle" size={20} color={colors.error} />
          <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, flex: 1, color: colors.error }]}>{errors.general}</Text>
        </View>
      ) : null}
        <View style={[
          {
            marginHorizontal: spacing.md,
            flexDirection: isTabletOrDesktop ? 'row' : 'column',
            gap: isTabletOrDesktop ? spacing.md : 0,
          }
        ]}>
          <Card style={{ flex: 1, padding: spacing.lg, borderRadius: borderRadius.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border }}>
            <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.md, color: colors.text }]}>
              Amount to Request
            </Text>
            <TextInput
              style={[
                {
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  fontSize: typography.fontSize.lg,
                  textAlign: 'center',
                  borderWidth: 2,
                  backgroundColor: colors.backgroundSecondary,
                  color: colors.text,
                  borderColor: errors.amount ? colors.error : colors.border
                },
              ]}
              placeholder="Enter amount (KES)"
              placeholderTextColor={colors.textTertiary}
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="numeric"
            />
            {errors.amount ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, gap: spacing.xs }}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={[{ fontSize: typography.fontSize.xs, flex: 1, color: colors.error }]}>{errors.amount}</Text>
              </View>
            ) : null}
          </Card>

          <Card style={{ flex: 1, padding: spacing.lg, borderRadius: borderRadius.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border }}>
            <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.md, color: colors.text }]}>
              Phone Number
            </Text>
            <TextInput
              style={[
                {
                  borderWidth: 1,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  fontSize: typography.fontSize.base,
                  backgroundColor: colors.backgroundSecondary,
                  color: colors.text,
                  borderColor: errors.contact ? colors.error : colors.border
                },
                errors.contact && { borderWidth: 2 },
              ]}
              placeholder="+254 712 345 678 or 0712 345 678"
              placeholderTextColor={colors.textTertiary}
              value={phoneNumber}
              onChangeText={handlePhoneNumberChange}
              keyboardType="phone-pad"
              maxLength={17}
            />
            {errors.contact ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, gap: spacing.xs }}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={[{ fontSize: typography.fontSize.xs, flex: 1, color: colors.error }]}>{errors.contact}</Text>
              </View>
            ) : null}
          </Card>
        </View>

        {renderQuickAmounts()}
        {renderRecentContacts()}

        <Card style={{ margin: spacing.md, borderWidth: 1, borderColor: colors.border }}>
          <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.md, color: colors.text }]}>
            Reason (Optional)
          </Text>
          <TextInput
            style={[
              {
                borderWidth: 1,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                fontSize: typography.fontSize.base,
                textAlignVertical: 'top',
                minHeight: 80,
                backgroundColor: colors.backgroundSecondary,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="What is this request for?"
            placeholderTextColor={colors.textTertiary}
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            maxLength={200}
          />
        </Card>

        <View style={{ margin: spacing.md }}>
          <Card style={{ padding: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
            <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.md, color: colors.text }]}>
              Request Summary
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={[{ fontSize: typography.fontSize.base, color: colors.textSecondary }]}>
                Amount:
              </Text>
              <Text style={[{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, flex: 1, textAlign: 'right', color: colors.text }]}>
                {amount ? formatCurrency(parseInt(amount)) : 'Not entered'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={[{ fontSize: typography.fontSize.base, color: colors.textSecondary }]}>
                From:
              </Text>
              <Text style={[{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, flex: 1, textAlign: 'right', color: colors.text }]}>
                {selectedContact ? selectedContact.name : phoneNumber || 'Not selected'}
              </Text>
            </View>
            {reason && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Text style={[{ fontSize: typography.fontSize.base, color: colors.textSecondary }]}>
                  Reason:
                </Text>
                <Text style={[{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, flex: 1, textAlign: 'right', color: colors.text }]}>
                  {reason}
                </Text>
              </View>
            )}
          </Card>
        </View>

        {/* Action Buttons */}
        <View style={[
          {
            flexDirection: 'row',
            gap: spacing.md,
            margin: spacing.md,
            flexDirection: isTabletOrDesktop ? 'row' : 'column',
          }
        ]}>
          <Button
            title="Send to Contact"
            onPress={handleSendRequest}
            disabled={!amount || (!selectedContact && !phoneNumber) || loading}
            style={[
              { flex: 1, margin: spacing.md },
              isTabletOrDesktop && { flex: 1 },
            ]}
            loading={loading && !showQRModal}
          />

          <Button
            title="Generate QR Code"
            onPress={generateQRCode}
            disabled={!amount || loading}
            style={[
              { flex: 1, borderWidth: 1 },
              isTabletOrDesktop && { flex: 1 },
            ]}
            variant="outline"
            loading={loading && showQRModal}
          />
        </View>

        {/* QR Code Modal */}
        <Modal
          visible={showQRModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowQRModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: '90%', maxWidth: 400, borderRadius: borderRadius.lg, padding: spacing.xl, backgroundColor: colors.surface }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
                <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.text }]}>
                  Money Request QR Code
                </Text>
                <TouchableOpacity
                  onPress={() => setShowQRModal(false)}
                  style={{ padding: spacing.sm }}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {qrCodeData && (
                <View style={{ alignItems: 'center' }}>
                  <CrossPlatformQRCode
                    value={JSON.stringify(qrCodeData)}
                    size={280}
                    colors={colors}
                  />

                  <View style={{ alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.lg }}>
                    <Text style={[{ fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.primary }]}>
                      {formatCurrency(qrCodeData.amount)}
                    </Text>
                    <Text style={[{ fontSize: typography.fontSize.base, marginTop: spacing.sm, textAlign: 'center', color: colors.text }]}>
                      {qrCodeData.reason}
                    </Text>
                    <Text style={[{ fontSize: typography.fontSize.sm, marginTop: spacing.xs, color: colors.textSecondary }]}>
                      From: {qrCodeData.requesterName}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.md, gap: spacing.sm, flex: 1, justifyContent: 'center', backgroundColor: colors.primary + '20' }}
                      onPress={shareQRCode}
                    >
                      <Ionicons name="share-outline" size={20} color={colors.primary} />
                      <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.primary }]}>Share</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.md, gap: spacing.sm, flex: 1, justifyContent: 'center', backgroundColor: colors.success + '20' }}
                      onPress={copyQRLink}
                    >
                      <Ionicons name="copy-outline" size={20} color={colors.success} />
                      <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.success }]}>Copy Link</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[{ fontSize: typography.fontSize.sm, textAlign: 'center', lineHeight: 20, color: colors.textSecondary }]}>
                    Share this QR code or link with the person you want to request money from.
                    They can scan it with VaultKe app or click the link to pay you directly.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Modal>
    </ScrollView>
  );
};

export default RequestMoneyScreen;
