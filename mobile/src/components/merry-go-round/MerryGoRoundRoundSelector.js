import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { spacing, typography } from '../../utils/theme';

const MerryGoRoundRoundSelector = ({ colors, merryGoRounds, selectedRound, onSelectRound, formatCurrency }) => (
  <Card style={styles.statsCard} variant="outlined">
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Merry-Go-Rounds</Text>
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing.xs }}>
      {merryGoRounds.map((round) => (
        <TouchableOpacity
          key={round.id}
          style={[
            styles.roundChip,
            {
              backgroundColor: selectedRound?.id === round.id ? colors.primary + '18' : colors.backgroundSecondary,
              borderColor: selectedRound?.id === round.id ? colors.primary : colors.border,
            },
          ]}
          onPress={() => { onSelectRound(round); }}
        >
          <Text style={[styles.roundName, { color: selectedRound?.id === round.id ? colors.primary : colors.text }]}>
            {round.name}
          </Text>
          <Text style={[styles.roundMeta, { color: colors.textSecondary }]}>
            {formatCurrency(round.amount_per_round || round.amountPerRound || round.contribution_amount || 0)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </Card>
);

const styles = StyleSheet.create({
  statsCard: { marginHorizontal: spacing.md, marginVertical: spacing.xs },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm },
  roundChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, borderWidth: 1, marginRight: spacing.sm, alignItems: 'center', minWidth: 110 },
  roundName: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.xs, textAlign: 'center' },
  roundMeta: { fontSize: typography.fontSize.xs },
});

export default MerryGoRoundRoundSelector;
