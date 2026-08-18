import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography } from '../../../utils/theme';
import useInvitationsScreen from '../../../hooks/useInvitationsScreen';
import InvitationCard from '../../../components/chama-meeting/InvitationCard';

const InvitationsScreen = ({ navigation }) => {
  const { theme } = useApp();
  const screen = useInvitationsScreen({ navigation });

  const {
    invitations,
    loading,
    refreshing,
    respondingTo,
    onRefresh,
    handleRespondToInvitation,
    formatDate,
    formatCurrency,
    isExpired,
    colors,
  } = screen;

  const renderInvitationCard = (invitation) => (
    <InvitationCard
      invitation={invitation}
      respondingTo={respondingTo}
      onRespond={handleRespondToInvitation}
      formatDate={formatDate}
      formatCurrency={formatCurrency}
      isExpired={isExpired}
      colors={colors}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="mail-outline" size={64} color={colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Invitations
      </Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        You don't have any pending chama invitations at the moment.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Invitations
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading invitations...
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1, position: 'relative' }}>
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
          >
            {invitations.length > 0 ? (
              <>
                <View style={styles.statsContainer}>
                  <Text style={[styles.statsText, { color: colors.textSecondary }]}>
                    {invitations.length} invitation{invitations.length !== 1 ? 's' : ''}
                  </Text>
                </View>

                {invitations.map(renderInvitationCard)}
              </>
            ) : (
              renderEmptyState()
            )}
          </ScrollView>
          <PageRefreshButton onRefresh={onRefresh} refreshing={refreshing} color={colors.primary} bottom={64} />
        </View>
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
  statsContainer: {
    marginBottom: 16,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 40,
  },
});

export default InvitationsScreen;
