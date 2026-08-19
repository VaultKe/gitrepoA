import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ActionModal = ({ visible, onClose, colors, styles, selectedTableItem, activeTab, handleVote, navigation, chamaId, votingInProgress, setViewModalItem, setShowViewModal }) => {
  return (
    <Modal
      visible={visible && selectedTableItem !== null}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.actionModalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.actionModalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.actionModalHeader}>
            <Text style={[styles.actionModalTitle, { color: colors.text }]}>
              Actions for {selectedTableItem?.title || 'Request'}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.actionModalCloseButton}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.actionModalBody}>
            {activeTab === 'contributions' ? (
              <>
                <TouchableOpacity
                  style={[styles.actionModalButton, { backgroundColor: colors.info + '10' }]}
                  onPress={() => {
                    onClose();
                    navigation.navigate('WelfareContributions', {
                      welfareRequestId: selectedTableItem.welfareRequestId || selectedTableItem.id,
                      chamaId,
                    });
                  }}
                >
                  <Ionicons name="list" size={18} color={colors.info} />
                  <View style={styles.actionModalButtonText}>
                    <Text style={[styles.actionModalButtonTitle, { color: colors.info }]}>
                      View Contributions
                    </Text>
                    <Text style={[styles.actionModalButtonSubtitle, { color: colors.textSecondary }]}>
                      See all contributions to this request
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionModalButton, { backgroundColor: colors.success + '10' }]}
                  onPress={() => {
                    onClose();
                    navigation.navigate('ContributeScreen', {
                      chamaId: chamaId,
                      contributionType: 'welfare',
                      proposalId: selectedTableItem.welfareRequestId || selectedTableItem.id,
                      proposalTitle: selectedTableItem.welfareRequestTitle || selectedTableItem.title,
                      requestedAmount: selectedTableItem.welfareRequestAmount || selectedTableItem.amount
                    });
                  }}
                >
                  <Ionicons name="wallet" size={18} color={colors.success} />
                  <View style={styles.actionModalButtonText}>
                    <Text style={[styles.actionModalButtonTitle, { color: colors.success }]}>
                      Go to Contribute
                    </Text>
                    <Text style={[styles.actionModalButtonSubtitle, { color: colors.textSecondary }]}>
                      Make a contribution to this request
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {selectedTableItem && !selectedTableItem.userVote && (
                  <TouchableOpacity
                    style={[styles.actionModalButton, { backgroundColor: colors.success + '10' }]}
                    onPress={() => {
                      onClose();
                      handleVote(selectedTableItem.id, 'for');
                    }}
                  >
                    <Ionicons name="thumbs-up" size={18} color={colors.success} />
                    <View style={styles.actionModalButtonText}>
                      <Text style={[styles.actionModalButtonTitle, { color: colors.success }]}>
                        Support
                      </Text>
                      <Text style={[styles.actionModalButtonSubtitle, { color: colors.textSecondary }]}>
                        Vote in favor of this request
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                {selectedTableItem && !selectedTableItem.userVote && (
                  <TouchableOpacity
                    style={[styles.actionModalButton, { backgroundColor: colors.error + '10' }]}
                    onPress={() => {
                      onClose();
                      handleVote(selectedTableItem.id, 'against');
                    }}
                  >
                    <Ionicons name="thumbs-down" size={18} color={colors.error} />
                    <View style={styles.actionModalButtonText}>
                      <Text style={[styles.actionModalButtonTitle, { color: colors.error }]}>
                        Oppose
                      </Text>
                      <Text style={[styles.actionModalButtonSubtitle, { color: colors.textSecondary }]}>
                        Vote against this request
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                {selectedTableItem && (
                  <TouchableOpacity
                    style={[styles.actionModalButton, { backgroundColor: colors.info + '10' }]}
                    onPress={() => {
                      onClose();
                      setViewModalItem(selectedTableItem);
                      setShowViewModal(true);
                    }}
                  >
                    <Ionicons name="information-circle" size={18} color={colors.info} />
                    <View style={styles.actionModalButtonText}>
                      <Text style={[styles.actionModalButtonTitle, { color: colors.info }]}>
                        View Details
                      </Text>
                      <Text style={[styles.actionModalButtonSubtitle, { color: colors.textSecondary }]}>
                        See full request information
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default ActionModal;
