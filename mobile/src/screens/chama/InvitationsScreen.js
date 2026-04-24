import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';
import api from '../../services/api';

const InvitationsScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingTo, setRespondingTo] = useState(null);

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      const response = await api.getUserInvitations();
      
      if (response.success) {
        setInvitations(response.data || []);
      } else {
        throw new Error(response.error || 'Failed to load invitations');
      }
    } catch (error) {
      console.error('Error loading invitations:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load invitations',
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInvitations();
    setRefreshing(false);
  };

  const handleRespondToInvitation = async (invitationId, response) => {
    try {
      setRespondingTo(invitationId);

      // Get the chama ID from the invitation for the API call
      const invitation = invitations.find(inv => inv.id === invitationId);
      const chamaId = invitation?.chama?.id;

      const apiResponse = await api.respondToInvitation(invitationId, response, chamaId);

      if (apiResponse.success) {
        Toast.show({
          type: 'success',
          text1: response === 'accept' ? 'Invitation Accepted' : 'Invitation Declined',
          text2: apiResponse.message || `You have ${response}ed the invitation`,
        });

        // Remove the invitation from the list
        setInvitations(prev => prev.filter(inv => inv.id !== invitationId));

        // If accepted, navigate to the chama
        if (response === 'accept') {
          const invitation = invitations.find(inv => inv.id === invitationId);
          if (invitation?.chama) {
            setTimeout(() => {
              navigation.navigate('ChamaDashboard', {
                chamaId: invitation.chama.id,
                chamaName: invitation.chama.name,
              });
            }, 1500);
          }
        }
      } else {
        throw new Error(apiResponse.error || 'Failed to respond to invitation');
      }
    } catch (error) {
      console.error('Error responding to invitation:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to respond to invitation',
      });
    } finally {
      setRespondingTo(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'KES 0';
    return `KES ${Number(amount).toLocaleString()}`;
  };

  const isExpired = (expiresAt) => {
    return new Date(expiresAt) < new Date();
  };

  const renderInvitationCard = (invitation) => {
    const expired = isExpired(invitation.expires_at);
    const isResponding = respondingTo === invitation.id;

    return (
      <View
        key={invitation.id}
        style={[
          styles.invitationCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
          expired && { opacity: 0.6 }
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.chamaInfo}>
            <Text style={[styles.chamaName, { color: colors.text }]}>
              {invitation.chama?.name || 'Unknown Chama'}
            </Text>
            <Text style={[styles.inviterInfo, { color: colors.textSecondary }]}>
              Invited by {invitation.inviter?.first_name} {invitation.inviter?.last_name}
            </Text>
          </View>
          
          {expired && (
            <View style={[styles.expiredBadge, { backgroundColor: colors.error + '20' }]}>
              <Text style={[styles.expiredText, { color: colors.error }]}>
                Expired
              </Text>
            </View>
          )}
        </View>

        <View style={styles.chamaDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="wallet" size={16} color={colors.textSecondary} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Contribution:
            </Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {formatCurrency(invitation.chama?.contribution_amount)} {invitation.chama?.contribution_frequency}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={16} color={colors.textSecondary} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Invited:
            </Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {formatDate(invitation.created_at)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="time" size={16} color={colors.textSecondary} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Expires:
            </Text>
            <Text style={[styles.detailValue, { color: expired ? colors.error : colors.text }]}>
              {formatDate(invitation.expires_at)}
            </Text>
          </View>
        </View>

        {invitation.message && (
          <View style={styles.messageContainer}>
            <Text style={[styles.messageLabel, { color: colors.textSecondary }]}>
              Message:
            </Text>
            <Text style={[styles.messageText, { color: colors.text }]}>
              {invitation.message}
            </Text>
          </View>
        )}

        {invitation.chama?.description && (
          <View style={styles.descriptionContainer}>
            <Text style={[styles.descriptionLabel, { color: colors.textSecondary }]}>
              About this chama:
            </Text>
            <Text style={[styles.descriptionText, { color: colors.text }]}>
              {invitation.chama.description}
            </Text>
          </View>
        )}

        {!expired && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton, { borderColor: colors.error }]}
              onPress={() => handleRespondToInvitation(invitation.id, 'reject')}
              disabled={isResponding}
            >
              {isResponding ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Ionicons name="close" size={20} color={colors.error} />
              )}
              <Text style={[styles.actionButtonText, { color: colors.error }]}>
                Decline
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton, { backgroundColor: colors.primary }]}
              onPress={() => handleRespondToInvitation(invitation.id, 'accept')}
              disabled={isResponding}
            >
              {isResponding ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="checkmark" size={20} color="white" />
              )}
              <Text style={styles.acceptButtonText}>
                Accept
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Invitations
        </Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <Ionicons 
            name="refresh" 
            size={24} 
            color={colors.text} 
            style={refreshing && { opacity: 0.5 }}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading invitations...
          </Text>
        </View>
      ) : (
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
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  refreshButton: {
    padding: 8,
    marginLeft: 8,
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
  invitationCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chamaInfo: {
    flex: 1,
  },
  chamaName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  inviterInfo: {
    fontSize: 14,
  },
  expiredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expiredText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chamaDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    marginLeft: 8,
    marginRight: 8,
    minWidth: 70,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  messageContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  descriptionContainer: {
    marginBottom: 16,
  },
  descriptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  declineButton: {
    backgroundColor: 'transparent',
  },
  acceptButton: {
    borderWidth: 0,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
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
