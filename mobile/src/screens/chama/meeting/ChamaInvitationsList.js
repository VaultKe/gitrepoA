import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { getThemeColors, spacing } from '../../../utils/theme';
import ChamaInvitationCard from './ChamaInvitationCard';
import ChamaMembersEmptyState from './ChamaMembersEmptyState';
import { getFilteredInvitations } from './chamaMembersUtils';

const ChamaInvitationsList = ({
  invitations,
  loading,
  searchQuery,
  onResendInvitation,
  onCancelInvitation,
  theme,
}) => {
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);
  const filteredInvitations = getFilteredInvitations(invitations, searchQuery);

  return (
    <FlatList
      data={filteredInvitations}
      renderItem={({ item }) => (
        <ChamaInvitationCard
          item={item}
          onResend={onResendInvitation}
          onCancel={onCancelInvitation}
        />
      )}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.membersList}
      scrollEnabled={false}
      ListEmptyComponent={!loading && (
        <ChamaMembersEmptyState type="invitations" searchQuery={searchQuery} theme={theme} />
      )}
      showsVerticalScrollIndicator={false}
    />
  );
};

const createStyles = (colors) => StyleSheet.create({
  membersList: {
    padding: spacing.md,
  },
});

export default ChamaInvitationsList;
