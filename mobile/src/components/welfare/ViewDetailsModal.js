import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ViewDetailsModal = ({ visible, onClose, colors, styles, viewModalItem, activeTab, formatCurrency, formatDate, welfareCategories, urgencyLevels, getCategoryIcon, getCategoryColor, isUserIdLeft, getRequesterDisplayName, getBeneficiaryDisplayName }) => {
  return (
    <Modal
      visible={visible && viewModalItem !== null}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.viewModalOverlay}>
        <View style={[styles.viewModalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.viewModalHeader}>
            <Text style={[styles.viewModalTitle, { color: colors.text }]}>
              {activeTab === 'requests' ? 'Welfare Request Details' : 'Contribution Details'}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.viewModalCloseButton}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.viewModalBody} showsVerticalScrollIndicator={false}>
            {viewModalItem && (
              <View style={styles.viewModalItem}>
                <View style={styles.viewModalSection}>
                  <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                    Title
                  </Text>
                  <Text style={[styles.viewModalSectionContent, { color: colors.textSecondary }]}>
                    {viewModalItem.title}
                  </Text>
                </View>
                <View style={styles.viewModalSection}>
                  <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                    Description
                  </Text>
                  <Text style={[styles.viewModalSectionContent, { color: colors.textSecondary }]}>
                    {viewModalItem.description.length > 100
                      ? viewModalItem.description.substring(0, 100) + '...'
                      : viewModalItem.description
                    }
                  </Text>
                </View>
                {activeTab === 'requests' ? (
                  <>
                    <View style={styles.viewModalRow}>
                      <View style={styles.viewModalHalf}>
                        <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                          Category
                        </Text>
                        <Text style={[styles.viewModalSectionContent, { color: colors.textSecondary }]}>
                          {welfareCategories.find(c => c.id === viewModalItem.category)?.name || viewModalItem.category}
                        </Text>
                      </View>
                      <View style={styles.viewModalHalf}>
                        <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                          Priority
                        </Text>
                        <Text style={[styles.viewModalSectionContent, { color: colors.textSecondary }]}>
                          {urgencyLevels.find(l => l.id === viewModalItem.urgency)?.name || viewModalItem.urgency}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.viewModalRow}>
                      <View style={styles.viewModalHalf}>
                        <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                          Amount Needed
                        </Text>
                        <Text style={[styles.viewModalSectionContent, { color: colors.primary }]}>
                          {formatCurrency(viewModalItem.amount)}
                        </Text>
                      </View>
                      <View style={styles.viewModalHalf}>
                        <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                          Votes
                        </Text>
                        <Text style={[styles.viewModalSectionContent, { color: colors.textSecondary }]}>
                          {viewModalItem.votes?.yes || viewModalItem.votes_for || 0} / {viewModalItem.votes?.no || viewModalItem.votes_against || 0}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.viewModalSection}>
                      <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                        Requester
                      </Text>
                      <Text style={[
                        styles.viewModalSectionContent,
                        { color: isUserIdLeft(viewModalItem?.requesterId) ? colors.error : colors.textSecondary },
                        isUserIdLeft(viewModalItem?.requesterId) && { textDecorationLine: 'line-through' }
                      ]}>
                        {getRequesterDisplayName(viewModalItem)}
                      </Text>
                    </View>
                    <View style={styles.viewModalSection}>
                      <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                        Date Created
                      </Text>
                      <Text style={[styles.viewModalSectionContent, { color: colors.textSecondary }]}>
                        {formatDate(viewModalItem.createdAt || viewModalItem.created_at)}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.viewModalRow}>
                      <View style={styles.viewModalHalf}>
                        <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                          Amount Needed
                        </Text>
                        <Text style={[styles.viewModalSectionContent, { color: colors.primary }]}>
                          {formatCurrency(viewModalItem.amount)}
                        </Text>
                      </View>
                      <View style={styles.viewModalHalf}>
                        <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                          Amount Raised
                        </Text>
                        <Text style={[styles.viewModalSectionContent, { color: colors.success }]}>
                          {formatCurrency(viewModalItem.totalContributions || 0)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.viewModalSection}>
                      <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                        Beneficiary
                      </Text>
                      <Text style={[
                        styles.viewModalSectionContent,
                        { color: isUserIdLeft(viewModalItem?.beneficiaryId) ? colors.error : colors.textSecondary },
                        isUserIdLeft(viewModalItem?.beneficiaryId) && { textDecorationLine: 'line-through' }
                      ]}>
                        {getBeneficiaryDisplayName(viewModalItem)}
                      </Text>
                    </View>
                    <View style={styles.viewModalSection}>
                      <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                        Progress
                      </Text>
                      <Text style={[styles.viewModalSectionContent, { color: colors.textSecondary }]}>
                        {Math.min(Math.round(((viewModalItem.totalContributions || 0) / viewModalItem.amount) * 100), 100)}% funded
                      </Text>
                    </View>
                    <View style={styles.viewModalSection}>
                      <Text style={[styles.viewModalSectionTitle, { color: colors.text }]}>
                        Contributors
                      </Text>
                      <Text style={[styles.viewModalSectionContent, { color: colors.textSecondary }]}>
                        {viewModalItem.contributionCount || 0} people
                      </Text>
                    </View>
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default ViewDetailsModal;
