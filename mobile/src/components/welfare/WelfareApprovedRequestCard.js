import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';
import Button from '../common/Button';

const WelfareApprovedRequestCard = ({ request, colors, formatCurrency, welfareCategories, getCategoryIcon, getCategoryColor, getBeneficiaryDisplayName, isUserIdLeft, navigation, chamaId, styles }) => {
  return (
    <Card key={request.id} style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestInfo}>
          <View style={styles.categoryBadge}>
            <Ionicons name={getCategoryIcon(request.category)} size={16} color={getCategoryColor(request.category)} />
            <Text style={[styles.categoryText, { color: colors.primary }]}>
              {welfareCategories.find(c => c.id === request.category)?.name || request.category}
            </Text>
          </View>
          <Text style={[styles.requestTitle, { color: colors.text }]}>
            {request.title}
          </Text>
          <Text style={[styles.requestAmount, { color: colors.success }]}>
            {formatCurrency(request.amount)} needed
          </Text>
          <View style={styles.beneficiaryInfo}>
            <Text style={[styles.beneficiaryLabel, { color: colors.textSecondary }]}>
              Support for:
            </Text>
            <Text style={[
              styles.beneficiaryName,
              { color: isUserIdLeft(request.beneficiaryId) ? colors.error : colors.text },
              isUserIdLeft(request.beneficiaryId) && { textDecorationLine: 'line-through' }
            ]}>
              {getBeneficiaryDisplayName(request)}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: colors.success + '20' }]}>
          <Text style={[styles.statusText, { color: colors.success }]}>
            APPROVED
          </Text>
        </View>
      </View>
      <Text style={[styles.requestDescription, { color: colors.textSecondary }]}>
        {request.description}
      </Text>
      <View style={styles.contributionProgress}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
            Contribution Progress
          </Text>
          <Text style={[styles.progressAmount, { color: colors.text }]}>
            {formatCurrency(request.totalContributions || 0)} / {formatCurrency(request.amount)}
          </Text>
        </View>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                width: `${Math.min(((request.totalContributions || 0) / request.amount) * 100, 100)}%`
              }
            ]}
          />
        </View>
        <View style={styles.progressDetails}>
          <View style={styles.progressDetailRow}>
            <View style={styles.progressDetailItem}>
              <Text style={[styles.progressDetailLabel, { color: colors.textSecondary }]}>
                Remaining
              </Text>
              {(request.totalContributions || 0) >= request.amount ? (
                <Text style={[styles.progressDetailValue, { color: colors.success }]}>
                  Fully Funded
                </Text>
              ) : (
                <Text style={[styles.progressDetailValue, { color: colors.error }]}>
                  {formatCurrency(Math.max(0, request.amount - (request.totalContributions || 0)))}
                </Text>
              )}
            </View>
            <View style={styles.progressDetailItem}>
              <Text style={[styles.progressDetailLabel, { color: colors.textSecondary }]}>
                Progress
              </Text>
              <Text style={[styles.progressDetailValue, { color: colors.primary }]}>
                {Math.min(Math.round(((request.totalContributions || 0) / request.amount) * 100), 100)}%
              </Text>
            </View>
            <View style={styles.progressDetailItem}>
              <Text style={[styles.progressDetailLabel, { color: colors.textSecondary }]}>
                Contributors
              </Text>
              <Text style={[styles.progressDetailValue, { color: colors.text }]}>
                {request.contributionCount || 0}
              </Text>
            </View>
          </View>
        </View>
        <Text style={[styles.progressPercentage, { color: colors.textSecondary }]}>
          {Math.round(((request.totalContributions || 0) / request.amount) * 100)}% funded
        </Text>
      </View>
      <View style={styles.requestActions}>
        <Button
          title="Contribute"
          onPress={() => navigation.navigate('ContributeScreen', {
            chamaId: chamaId,
            contributionType: 'welfare',
            proposalId: request.id,
            proposalTitle: request.title,
            requestedAmount: request.amount
          })}
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          textStyle={{ color: colors.white }}
          icon={<Ionicons name="wallet" size={16} color={colors.white} />}
        />
        <Button
          title="Contribute"
          onPress={() => navigation.navigate('ContributeScreen', {
            chamaId: chamaId,
            contributionType: 'welfare',
            proposalId: request.id,
            proposalTitle: request.title,
            requestedAmount: request.amount
          })}
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          textStyle={{ color: colors.white }}
          icon={<Ionicons name="wallet" size={16} color={colors.white} />}
        />
      </View>
    </Card>
  );
};

export default WelfareApprovedRequestCard;
