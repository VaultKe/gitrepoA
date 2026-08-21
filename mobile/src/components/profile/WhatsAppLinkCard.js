import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { getThemeColors, spacing, typography } from '../../utils/theme';

const WhatsAppLinkCard = memo(({ colors, onNavigateWhatsApp }) => {
  return (
    <Card variant="outlined" style={styles.section}>
      <View style={styles.whatsappHeader}>
        <Ionicons name="logo-whatsapp" size={28} color={colors.success || '#25D366'} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>WhatsApp</Text>
      </View>
      <Text style={[styles.whatsappDescription, { color: colors.textSecondary }]}>
        Link your WhatsApp account to send and receive messages directly in the app.
      </Text>
      <Button
        title="Link WhatsApp"
        onPress={onNavigateWhatsApp}
        style={styles.whatsappButton}
        leftIcon="qr-code-outline"
      />
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
  whatsappHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  whatsappDescription: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  whatsappButton: {
    alignSelf: 'flex-start',
  },
});

export default WhatsAppLinkCard;
