import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import Card from '../../components/common/Card';
import BorderedButton from '../../components/BorderedButton';
import ApiService from '../../services/api';
import { spacing, typography } from '../../utils/theme';
import { isMemberLeft } from '../../utils/merryGoRoundHelpers';

const MerryGoRoundActions = ({
  colors,
  theme,
  selectedRound,
  user,
  isMemberLeft,
  navigation,
  onRouteChange,
  onContributePress,
}) => {
  if (!selectedRound) return null;
  const userMembership = selectedRound.members?.find(m => m.user_id === user?.id);
  const userLeft = userMembership ? isMemberLeft(userMembership) : false;
  const canContribute = !userLeft && userMembership && !userMembership.has_contributed_this_cycle;
  const isCurrentRecipient = !userLeft && selectedRound.current_position === selectedRound.members?.findIndex(m => m.user_id === user?.id);

  const handleCalendar = async () => {
    try {
      const response = await ApiService.getMerryGoRoundCalendarEventURL(selectedRound.id);
      if (response.success && response.data?.url) {
        const { Linking } = require('react-native');
        await Linking.openURL(response.data.url);
        Toast.show({ type: 'success', text1: 'Opening Calendar', position: 'top', visibilityTime: 3000 });
      } else {
        Toast.show({ type: 'error', text1: 'Calendar Error', text2: response.error || 'Failed to generate link', position: 'top' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Calendar Error', text2: 'Failed to open calendar', position: 'top' });
    }
  };

  return (
    <Card style={styles.statsCard} variant="outlined">
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Actions</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.actionsRow}>
          {canContribute && (
            <BorderedButton
              title="Contribute"
              onPress={onContributePress}
              variant="primary"
              size="medium"
              icon="wallet"
              theme={theme}
            />
          )}
          {isCurrentRecipient && (
            <BorderedButton
              title="Claim Payout"
              onPress={() => {
                Toast.show({ type: 'info', text1: 'Claim Payout', text2: 'Payout claiming feature coming soon!', position: 'top' });
              }}
              variant="success"
              size="medium"
              icon="cash"
              theme={theme}
            />
          )}
          <BorderedButton
            title="Calendar"
            onPress={handleCalendar}
            variant="primary"
            size="medium"
            icon="calendar"
            theme={theme}
          />
          <BorderedButton
            title="Rules"
            onPress={() => navigation.navigate('MerryGoRoundRulesScreen')}
            variant="primary"
            size="medium"
            icon="document-text"
            theme={theme}
          />
        </View>
      </ScrollView>
    </Card>
  );
};

const styles = StyleSheet.create({
  statsCard: { marginHorizontal: spacing.md, marginVertical: spacing.xs },
  sectionTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: spacing.sm },
});

export default MerryGoRoundActions;
