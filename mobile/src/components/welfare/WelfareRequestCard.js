import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';
import Button from '../common/Button';

const WelfareRequestCard = ({ request, colors, formatCurrency, welfareCategories, urgencyLevels, getCategoryIcon, getCategoryColor, getUrgencyColor, getStatusColor, getBeneficiaryDisplayName, isUserIdLeft, handleVote, votingInProgress, navigation, chamaId, styles }) => {
  return (
    <Card key={request.id} style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestInfo}>
          <View style={styles.categoryBadge}>
            <Ionicons name={getCategoryIcon(request.category)} size={16} color={getCategoryColor(request.category)} />
            <Text style={[styles.categoryText, { color: getCategoryColor(request.category) }]}>
              {welfareCategories.find(c => c.id === request.category)?.name}
            </Text>
          </View>
          <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(request.urgency) + '20' }]}>
            <Text style={[styles.urgencyText, { color: getUrgencyColor(request.urgency) }]}>
              {urgencyLevels.find(l => l.id === request.urgency)?.name} Priority
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
          </Text>
        </View>
      </View>
      <Text style={[styles.requestTitle, { color: colors.text }]}>
        {request.title}
      </Text>
      <Text style={[styles.requestDescription, { color: colors.textSecondary }]}>
        {request.description}
      </Text>
      <View style={styles.requestDetails}>
        <View style={styles.amountContainer}>
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
            Amount Requested:
          </Text>
          <Text style={[styles.amountValue, { color: colors.primary }]}>
            {formatCurrency(request.amount)}
          </Text>
        </View>
        <View style={styles.requesterInfo}>
          <Text style={[styles.requesterLabel, { color: colors.textSecondary }]}>
            Requested by:
          </Text>
          <Text style={[
            styles.requesterName,
            { color: isUserIdLeft(request.requesterId) ? colors.error : colors.text },
            isUserIdLeft(request.requesterId) && { textDecorationLine: 'line-through' }
          ]}>
            {getRequesterDisplayName(request)}
          </Text>
        </View>
        <View style={styles.beneficiaryInfo}>
          <Text style={[styles.beneficiaryLabel, { color: colors.textSecondary }]}>
            Support for:
          </Text>
          <Text style={[
            styles.beneficiaryName,
            { color: isUserIdLeft(request.beneficiaryId) ? colors.error : colors.primary },
            isUserIdLeft(request.beneficiaryId) && { textDecorationLine: 'line-through' }
          ]}>
            {getBeneficiaryDisplayName(request)}
          </Text>
        </View>
      </View>
      {request.status === 'pending' && (
        <View style={styles.votingSection}>
          <Text style={[styles.votingTitle, { color: colors.text }]}>
            members' votes
          </Text>
          <View style={styles.votingStats}>
            <View style={styles.voteStatItem}>
              <Ionicons name="thumbs-up" size={16} color={colors.success} />
              <Text style={[styles.voteStatText, { color: colors.success }]}>
                {request.votes?.yes || request.votes_for || 0} Support
              </Text>
            </View>
            <View style={styles.voteStatItem}>
              <Ionicons name="thumbs-down" size={16} color={colors.error} />
              <Text style={[styles.voteStatText, { color: colors.error }]}>
                {request.votes?.no || request.votes_against || 0} Oppose
              </Text>
            </View>
            <View style={styles.voteStatItem}>
              <Ionicons name="people" size={16} color={colors.textSecondary} />
              <Text style={[styles.voteStatText, { color: colors.textSecondary }]}>
                {request.votes?.total || request.total_votes || 0} Total
              </Text>
            </View>
          </View>
          {!request.userVote && (
            <View style={styles.votingButtons}>
              <Button
                title="Support"
                variant="outline"
                size="small"
                onPress={() => handleVote(request.id, 'for')}
                style={[styles.voteButton, { borderColor: colors.success }]}
                textStyle={{ color: colors.success }}
                icon={votingInProgress[request.id] ?
                  <ActivityIndicator size={16} color={colors.success} /> :
                  <Ionicons name="thumbs-up" size={16} color={colors.success} />
                }
                disabled={votingInProgress[request.id]}
              />
              <Button
                title="Oppose"
                variant="outline"
                size="small"
                onPress={() => handleVote(request.id, 'against')}
                style={[styles.voteButton, { borderColor: colors.error }]}
                textStyle={{ color: colors.error }}
                icon={votingInProgress[request.id] ?
                  <ActivityIndicator size={16} color={colors.error} /> :
                  <Ionicons name="thumbs-down" size={16} color={colors.error} />
                }
                disabled={votingInProgress[request.id]}
              />
            </View>
          )}
          {request.userVote && (
            <View style={[
              styles.userVoteStatus,
              { backgroundColor: request.userVote === 'yes' ? colors.success + '20' : colors.error + '20' }
            ]} />
          )}
        </View>
      )}
      {request.status === 'approved' && (
        <View style={styles.contributionSection}>
          <Text style={[styles.contributionTitle, { color: colors.success }]}>
            Approved by Community
          </Text>
          <Text style={[styles.contributionSubtitle, { color: colors.textSecondary }]}>
            This welfare request has been approved. You can now contribute to support this cause.
          </Text>
          <Button
            title="Contribute Now"
            onPress={() => {
              if (navigation) {
                navigation.navigate('ContributeScreen', {
                  chamaId: chamaId,
                  contributionType: 'welfare',
                  proposalId: request.id,
                  proposalTitle: request.title,
                  requestedAmount: request.amount
                });
              }
            }}
            style={[styles.contributeButton, { backgroundColor: colors.primary }]}
            icon={<Ionicons name="wallet" size={18} color={colors.white} />}
          />
        </View>
      )}
    </Card>
  );
};

export default WelfareRequestCard;
