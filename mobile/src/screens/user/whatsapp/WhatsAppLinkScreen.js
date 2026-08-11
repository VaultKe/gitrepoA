import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import apiService from '../../../services/api';

const WhatsAppLinkScreen = () => {
  const navigation = useNavigation();
  const colors = getThemeColors('light');

  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [qrBase64, setQrBase64] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | scanning | ready | logged_out | failed
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef(null);

  const startLink = async () => {
    try {
      setLoading(true);
      setStatus('idle');
      setQrBase64(null);
      const response = await apiService.request('/wa/link/session', {
        method: 'POST',
      });
      if (response.success && response.data) {
        setSessionId(response.data.sessionId);
        setStatus(response.data.status || 'scanning');
        startPolling(response.data.sessionId);
      } else {
        setStatus('failed');
        Alert.alert('Error', response.error || 'Failed to start WhatsApp linking');
      }
    } catch (error) {
      setStatus('failed');
      Alert.alert('Error', error.message || 'Failed to start WhatsApp linking');
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (sid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiService.request(`/wa/link/session/${sid}/qr`);
        if (res.success && res.data) {
          if (res.data.qr) setQrBase64(res.data.qr);
          if (res.data.status) setStatus(res.data.status);
          if (res.data.status === 'ready') {
            clearInterval(pollRef.current);
            setPolling(false);
            Alert.alert('Success', 'WhatsApp linked successfully');
          }
        }
      } catch (e) {
        // ignore transient poll errors
      }
    }, 3000);
  };

  const checkStatus = async () => {
    if (!sessionId) return;
    try {
      const res = await apiService.request(`/wa/link/session/${sessionId}/status`);
      if (res.success && res.data) {
        if (res.data.status) setStatus(res.data.status);
        if (res.data.status === 'ready') {
          Alert.alert('Success', 'WhatsApp linked successfully');
        }
      }
    } catch (error) {
      console.error('Status check failed:', error);
    }
  };

  const handleLogout = async () => {
    if (!sessionId) return;
    try {
      const res = await apiService.request(`/wa/link/session/${sessionId}/logout`, {
        method: 'POST',
      });
      if (res.success) {
        setStatus('logged_out');
        setQrBase64(null);
        Alert.alert('Logged out', 'WhatsApp session has been logged out');
      } else {
        Alert.alert('Error', res.error || 'Failed to logout WhatsApp session');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to logout WhatsApp session');
    }
  };

  const handlePhoneLink = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }
    try {
      setLoading(true);
      const response = await apiService.request('/wa/link/session', {
        method: 'POST',
        body: { phone: phoneNumber.trim() },
      });
      if (response.success && response.data) {
        setSessionId(response.data.sessionId);
        setStatus(response.data.status || 'scanning');
        startPolling(response.data.sessionId);
      } else {
        setStatus('failed');
        Alert.alert('Error', response.error || 'Failed to link WhatsApp by phone');
      }
    } catch (error) {
      setStatus('failed');
      Alert.alert('Error', error.message || 'Failed to link WhatsApp by phone');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const renderQR = () => {
    if (status === 'ready') {
      return (
        <View style={styles.qrContainer}>
          <Ionicons name="checkmark-circle" size={80} color={colors.success} />
          <Text style={[styles.qrText, { color: colors.text }]}>WhatsApp Connected</Text>
          <Text style={[styles.qrSubtext, { color: colors.textSecondary }]}>
            Your WhatsApp account is now linked
          </Text>
        </View>
      );
    }

    if (status === 'logged_out') {
      return (
        <View style={styles.qrContainer}>
          <Ionicons name="log-out-outline" size={80} color={colors.textSecondary} />
          <Text style={[styles.qrText, { color: colors.text }]}>WhatsApp Disconnected</Text>
          <Text style={[styles.qrSubtext, { color: colors.textSecondary }]}>
            Your WhatsApp session has been logged out
          </Text>
        </View>
      );
    }

    if (status === 'failed') {
      return (
        <View style={styles.qrContainer}>
          <Ionicons name="alert-circle-outline" size={80} color={colors.error} />
          <Text style={[styles.qrText, { color: colors.text }]}>Connection Failed</Text>
          <Text style={[styles.qrSubtext, { color: colors.textSecondary }]}>
            Could not connect to WhatsApp. Please try again.
          </Text>
        </View>
      );
    }

    // scanning or idle
    if (qrBase64) {
      return (
        <View style={styles.qrContainer}>
          <Image source={{ uri: `data:image/png;base64,${qrBase64}` }} style={styles.qrImage} />
          <Text style={[styles.qrText, { color: colors.text }]}>Scan this QR code</Text>
          <Text style={[styles.qrSubtext, { color: colors.textSecondary }]}>
            Open WhatsApp → Linked Devices → Link a Device
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.qrContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.qrText, { color: colors.text }]}>Preparing QR code...</Text>
        <Text style={[styles.qrSubtext, { color: colors.textSecondary }]}>
          Please wait while we generate your QR code
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Ionicons name="logo-whatsapp" size={48} color={colors.success || '#25D366'} />
          <Text style={[styles.title, { color: colors.text }]}>Link WhatsApp</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Connect your WhatsApp account to send and receive messages
          </Text>
        </View>

        <Card variant="outlined" style={styles.qrCard}>
          {renderQR()}
        </Card>

        {status === 'scanning' && (
          <View style={styles.actions}>
            <Button
              title="Refresh QR"
              onPress={() => sessionId && startPolling(sessionId)}
              variant="outline"
              style={styles.actionButton}
            />
            <Button
              title="Cancel"
              onPress={() => {
                if (pollRef.current) clearInterval(pollRef.current);
                setPolling(false);
                setStatus('idle');
                setSessionId(null);
                setQrBase64(null);
              }}
              variant="outline"
              style={styles.actionButton}
            />
          </View>
        )}

        {status === 'ready' && (
          <View style={styles.actions}>
            <Button
              title="Logout WhatsApp"
              onPress={handleLogout}
              variant="outline"
              style={[styles.actionButton, { borderColor: colors.error }]}
              textStyle={{ color: colors.error }}
            />
          </View>
        )}

        {!sessionId && status !== 'ready' && status !== 'logged_out' && (
          <View style={styles.actions}>
            <Button
              title={loading ? 'Starting...' : 'Start QR Link'}
              onPress={startLink}
              loading={loading}
              style={styles.actionButton}
            />
            <Button
              title="Link by Phone Number"
              onPress={() => setShowPhoneInput(true)}
              variant="outline"
              style={styles.actionButton}
            />
          </View>
        )}

        <View style={styles.infoSection}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>How it works</Text>
          <View style={styles.infoItem}>
            <Ionicons name="qr-code-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Scan the QR code with WhatsApp on your phone
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Or enter your phone number to receive a link by code
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Once linked, you can chat directly from the app
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showPhoneInput} transparent animationType="fade" onRequestClose={() => setShowPhoneInput(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPhoneInput(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Link by Phone Number</Text>
            <TextInput
              style={[styles.phoneInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Enter phone number (e.g. 254712345678)"
              placeholderTextColor={colors.textSecondary}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button title="Cancel" onPress={() => setShowPhoneInput(false)} variant="outline" style={styles.modalButton} />
              <Button title="Link" onPress={handlePhoneLink} loading={loading} style={styles.modalButton} />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingVertical: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  qrCard: {
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  qrText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  qrSubtext: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actionButton: {
    flex: 1,
    maxWidth: 180,
  },
  infoSection: {
    marginTop: spacing.md,
  },
  infoTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  phoneInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
  },
});

export default WhatsAppLinkScreen;
