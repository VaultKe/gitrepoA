import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import Card from '../common/Card';

const ChamaSelectorCard = ({ userChamas, selectedChama, getUserRole, switchToChama }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  // Don't show selector if we have no chamas and no selected chama (empty state will show)
  if (userChamas.length === 0 && !selectedChama) return null;

  // If we have a selected chama but userChamas is still loading, show a simple header
  if (userChamas.length === 0 && selectedChama) {
    return (
      <Card style={[styles.selectorCard, { marginVertical: spacing.xs }]} variant="outlined">
        <Text style={[styles.selectorTitle, { color: colors.text }]}>
          {selectedChama.name}
        </Text>
        <Text style={[styles.chamaChipText, { color: colors.textSecondary }]}>
          {getUserRole(selectedChama)}
        </Text>
      </Card>
    );
  }

  // Show full selector when we have multiple chamas
  return (
    <Card style={[styles.selectorCard, { marginVertical: spacing.xs }]} variant="outlined">
      <Text style={[styles.selectorTitle, { color: colors.text }]}>
        Select Chama
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {userChamas.map((chama) => (
          <TouchableOpacity
            key={chama.id}
            style={[
              styles.chamaChip,
              {
                backgroundColor: selectedChama?.id === chama.id ? colors.primary : colors.surface,
                borderColor: selectedChama?.id === chama.id ? colors.primary : colors.border,
              }
            ]}
            onPress={() => switchToChama(chama)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chamaChipText,
                {
                  color: selectedChama?.id === chama.id ? colors.white : colors.text,
                }
              ]}
            >
              {chama.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Card>
  );
};

const styles = StyleSheet.create({
  selectorCard: {
    paddingTop: 32,
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
  },
  selectorTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  chamaChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    marginRight: spacing.sm,
    borderWidth: 1,
  },
  chamaChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
});

export default ChamaSelectorCard;
