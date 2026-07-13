import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import Button from '../common/Button';
import { useApp } from '../../context/AppContext';

// Two-step destructive confirmation.
// Step 1: user must manually type the required phrase (`LEAVE "Chama Name"` /
//         `DELETE "Chama Name"`) to prove they are not acting by accident.
// Step 2: explicit final confirmation. Confirming calls `onConfirm` instantly.
const DestructiveConfirmModal = ({
  visible,
  onClose,
  onConfirm,
  chamaName = '',
  action = 'leave', // 'leave' | 'delete'
  loading = false,
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const [step, setStep] = useState(1);
  const [typed, setTyped] = useState('');

  const isDelete = action === 'delete';
  const verb = isDelete ? 'DELETE' : 'LEAVE';
  const accent = isDelete ? colors.error : colors.warning;
  const requiredPhrase = `${verb} "${chamaName}"`;
  const matches = typed.trim() === requiredPhrase;

  useEffect(() => {
    if (visible) {
      setStep(1);
      setTyped('');
    }
  }, [visible]);

  const handlePhraseSubmit = () => {
    if (!matches) return;
    setStep(2);
  };

  const handleConfirm = () => {
    if (loading) return;
    onConfirm?.();
  };

  const consequences = isDelete
    ? [
        'All members and their data',
        'All contributions and transactions',
        'All meetings and documents',
        'All loans and welfare records',
      ]
    : [
        'You will lose access to all chama activities and data',
        'Your contribution and transaction history in this chama',
        'You can only rejoin if re-invited by a member',
      ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {step === 1 ? (
            <>
              <View style={styles.iconContainer}>
                <View style={[styles.iconCircle, { backgroundColor: accent + '20' }]}>
                  <Ionicons
                    name={isDelete ? 'trash' : 'exit'}
                    size={32}
                    color={accent}
                  />
                </View>
              </View>

              <Text style={[styles.title, { color: colors.text }]}>
                {isDelete ? 'Delete Chama' : 'Leave Chama'}
              </Text>

              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                This is permanent and cannot be undone. Type the phrase below exactly to continue.
              </Text>

              {chamaName ? (
                <View style={[styles.chamaBadge, { backgroundColor: accent + '15' }]}>
                  <Ionicons name="people" size={14} color={accent} />
                  <Text style={[styles.chamaBadgeText, { color: accent }]}>
                    {chamaName}
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.phraseLabel, { color: colors.textSecondary }]}>
                Type this exactly:
              </Text>
              <View style={[styles.phraseBox, { borderColor: accent }]}>
                <Text style={[styles.phraseText, { color: accent }]}>
                  {requiredPhrase}
                </Text>
              </View>

              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    color: colors.text,
                    borderColor: matches ? accent : colors.border,
                  },
                ]}
                placeholder={requiredPhrase}
                placeholderTextColor={colors.textSecondary}
                value={typed}
                onChangeText={setTyped}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />

              <View style={styles.buttonRow}>
                <Button
                  title="Cancel"
                  onPress={onClose}
                  style={{ backgroundColor: colors.textSecondary, flex: 1 }}
                  textStyle={{ color: colors.white }}
                  disabled={loading}
                />
                <View style={{ width: spacing.sm }} />
                <Button
                  title="Continue"
                  onPress={handlePhraseSubmit}
                  style={{ backgroundColor: accent, flex: 1 }}
                  textStyle={{ color: colors.white }}
                  disabled={!matches || loading}
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.iconContainer}>
                <View style={[styles.iconCircle, { backgroundColor: accent + '20' }]}>
                  <Ionicons
                    name={isDelete ? 'alert-circle' : 'alert-outline'}
                    size={32}
                    color={accent}
                  />
                </View>
              </View>

              <Text style={[styles.title, { color: colors.text }]}>
                {isDelete ? 'Permanently delete this chama?' : 'Leave this chama?'}
              </Text>

              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {isDelete
                  ? 'The following will be permanently removed:'
                  : 'Are you sure you want to proceed? This will:'}
              </Text>

              <View style={[styles.consequencesBox, { backgroundColor: colors.backgroundSecondary }]}>
                <ScrollView style={styles.consequencesScroll} keyboardShouldPersistTaps="handled">
                  {consequences.map((item, idx) => (
                    <View key={idx} style={styles.consequenceItem}>
                      <Ionicons name="close-circle" size={16} color={accent} />
                      <Text style={[styles.consequenceText, { color: colors.text }]}>
                        {item}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.buttonRow}>
                <Button
                  title="Back"
                  onPress={() => setStep(1)}
                  style={{ backgroundColor: colors.textSecondary, flex: 1 }}
                  textStyle={{ color: colors.white }}
                  disabled={loading}
                />
                <View style={{ width: spacing.sm }} />
                <Button
                  title={loading ? 'Working…' : isDelete ? 'Delete Forever' : 'Leave Chama'}
                  onPress={handleConfirm}
                  style={{ backgroundColor: accent, flex: 1 }}
                  textStyle={{ color: colors.white }}
                  loading={loading}
                  disabled={loading}
                />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
    ...shadows.lg,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  chamaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignSelf: 'center',
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  chamaBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  phraseLabel: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  phraseBox: {
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  phraseText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.lg,
  },
  consequencesBox: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    maxHeight: 180,
  },
  consequencesScroll: {
    flexGrow: 0,
  },
  consequenceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  consequenceText: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default DestructiveConfirmModal;
