import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors } from '../../../utils/theme';
import ApiService from '../../../services/api';


export default function ChamaManagementScreen() {
  const { theme, setError } = useApp();
  const colors = getThemeColors(theme);
  const [chamas, setChamas] = useState([]);
  const [filteredChamas, setFilteredChamas] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedChama, setSelectedChama] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);



  useEffect(() => {
    loadChamas();
  }, []);

  useEffect(() => {
    filterChamas();
  }, [chamas, searchQuery, selectedFilter]);

  const loadChamas = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getAllChamasForAdmin(100, 0); // Get all chamas for admin view
      if (response.success) {
        // Handle case where data is null or empty array
        const chamasData = response.data || [];

        if (chamasData.length === 0) {
          setChamas([]);
        } else {
          const chamasWithStats = chamasData.map(chama => ({
            ...chama,
            memberCount: chama.current_members || chama.memberCount || 0,
            totalBalance: chama.total_funds || chama.totalBalance || 0,
            status: chama.status || 'active',
            chairperson: chama.chairperson_name || chama.chairperson || 'N/A',
            contributionAmount: chama.contribution_amount || chama.contributionAmount || 0,
            lastActivity: chama.updated_at || chama.lastActivity || chama.created_at,
            createdAt: chama.created_at,
            description: chama.description || 'No description available',
            meetingFrequency: chama.meeting_frequency || chama.meetingFrequency || 'monthly',
          }));

          setChamas(chamasWithStats);
        }
      } else {
        const errorMessage = response.error || response.message || 'Unknown error';
        console.error('❌ Failed to load chamas:', errorMessage);
        setError('Failed to load chamas: ' + errorMessage);
        setChamas([]);
      }
    } catch (error) {
      console.error('❌ Error loading chamas:', error);
      Alert.alert('Error', 'Error loading chamas: ' + error.message);
      setChamas([]);
    } finally {
      setLoading(false);
    }
  };

  const filterChamas = () => {
    let filtered = chamas;

    // Filter by status
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(chama => chama.status === selectedFilter);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(chama =>
        chama.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chama.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chama.chairperson.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredChamas(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChamas();
    setRefreshing(false);
  };

  const handleChamaAction = async (chama, action) => {
    if (action === 'view details') {
      setSelectedChama(chama);
      setModalVisible(true);
      return;
    }

    Alert.alert(
      'Confirm Action',
      `Are you sure you want to ${action} "${chama.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => performChamaAction(chama, action),
        },
      ]
    );
  };

  const performChamaAction = async (chama, action) => {
    try {
      setActionLoading(true);

      let response;
      switch (action) {
        case 'suspend':
          response = await ApiService.updateChama(chama.id, { status: 'suspended' });
          break;
        case 'activate':
          response = await ApiService.updateChama(chama.id, { status: 'active' });
          break;
        case 'audit':
          // For now, just show audit info
          Alert.alert(
            'Chama Audit',
            `Audit for "${chama.name}"\n\nMembers: ${chama.memberCount}\nBalance: ${formatCurrency(chama.totalBalance)}\nStatus: ${chama.status}\nCreated: ${new Date(chama.createdAt).toLocaleDateString()}\nLast Activity: ${new Date(chama.lastActivity).toLocaleDateString()}`,
            [{ text: 'OK' }]
          );
          return;
        default:
          throw new Error('Unknown action: ' + action);
      }

      if (response && response.success) {
        Alert.alert('Success', `Chama ${action} successfully`);
        await loadChamas(); // Reload the list
      } else {
        throw new Error(response?.error || 'Action failed');
      }
    } catch (error) {
      console.error(`❌ Error performing ${action}:`, error);
      Alert.alert('Error', `Failed to ${action} chama: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `KSh ${amount.toLocaleString()}`;
  };

  const renderChamaCard = (chama) => (
    <View
      key={chama.id}
      style={[styles.chamaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.chamaHeader}>
        <View style={styles.chamaInfo}>
          <Text style={[styles.chamaName, { color: colors.text }]}>
            {chama.name}
          </Text>
          <Text style={[styles.chamaDescription, { color: colors.textSecondary }]}>
            {chama.description}
          </Text>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: chama.status === 'active' ? colors.success : colors.error }
        ]}>
          <Text style={[styles.statusText, { color: colors.background }]}>
            {chama.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.chamaStats}>
        <View style={styles.statItem}>
          <Ionicons name="people" size={16} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {chama.memberCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Members
          </Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="wallet" size={16} color={colors.success} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatCurrency(chama.totalBalance)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Balance
          </Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="calendar" size={16} color={colors.info} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatCurrency(chama.contributionAmount)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Contribution
          </Text>
        </View>
      </View>

      <View style={styles.chamaMeta}>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
            Chairperson:
          </Text>
          <Text style={[styles.metaValue, { color: colors.text }]}>
            {chama.chairperson}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
            Meeting:
          </Text>
          <Text style={[styles.metaValue, { color: colors.text }]}>
            {chama.meetingFrequency}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
            Last Activity:
          </Text>
          <Text style={[styles.metaValue, { color: colors.text }]}>
            {chama.lastActivity}
          </Text>
        </View>
      </View>

      <View style={styles.chamaActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.info + '20' }]}
          onPress={() => handleChamaAction(chama, 'view details')}
        >
          <Ionicons name="eye" size={16} color={colors.info} />
          <Text style={[styles.actionText, { color: colors.info }]}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.warning + '20' }]}
          onPress={() => handleChamaAction(chama, chama.status === 'active' ? 'suspend' : 'activate')}
        >
          <Ionicons
            name={chama.status === 'active' ? 'pause' : 'play'}
            size={16}
            color={colors.warning}
          />
          <Text style={[styles.actionText, { color: colors.warning }]}>
            {chama.status === 'active' ? 'Suspend' : 'Activate'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
          onPress={() => handleChamaAction(chama, 'audit')}
        >
          <Ionicons name="document-text" size={16} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.primary }]}>Audit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderChamaDetailsModal = () => {
    if (!selectedChama) return null;

    return (
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {selectedChama.name}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.detailSection}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Description</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {selectedChama.description}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Status</Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: selectedChama.status === 'active' ? colors.success : colors.error }
                ]}>
                  <Text style={[styles.statusText, { color: colors.white }]}>
                    {selectedChama.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Statistics</Text>
                <View style={styles.statsContainer}>
                  <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Members:</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {selectedChama.memberCount}
                    </Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Balance:</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {formatCurrency(selectedChama.totalBalance)}
                    </Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Contribution:</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {formatCurrency(selectedChama.contributionAmount)}
                    </Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Meeting Frequency:</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {selectedChama.meetingFrequency}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Chairperson</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {selectedChama.chairperson}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Created</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {new Date(selectedChama.createdAt).toLocaleDateString()}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Last Activity</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {new Date(selectedChama.lastActivity).toLocaleDateString()}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Wallet Types</Text>
                <View style={styles.walletTypesContainer}>
                  {(selectedChama.permissions?.activeWalletTypes && selectedChama.permissions.activeWalletTypes.length > 0
                    ? selectedChama.permissions.activeWalletTypes
                    : ['main']
                  ).map((walletType, index) => (
                    <View key={index} style={[styles.walletTypeBadge, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                      <Ionicons name="wallet" size={14} color={colors.primary} />
                      <Text style={[styles.walletTypeText, { color: colors.primary }]}>
                        {walletType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionButton, { backgroundColor: colors.warning + '20' }]}
                onPress={() => {
                  setModalVisible(false);
                  handleChamaAction(selectedChama, selectedChama.status === 'active' ? 'suspend' : 'activate');
                }}
              >
                <Text style={[styles.modalActionText, { color: colors.warning }]}>
                  {selectedChama.status === 'active' ? 'Suspend' : 'Activate'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, { backgroundColor: colors.primary + '20' }]}
                onPress={() => {
                  setModalVisible(false);
                  handleChamaAction(selectedChama, 'audit');
                }}
              >
                <Text style={[styles.modalActionText, { color: colors.primary }]}>
                  View Audit
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const filterOptions = [
    { key: 'all', label: 'All Chamas' },
    { key: 'active', label: 'Active' },
    { key: 'suspended', label: 'Suspended' },
    { key: 'pending', label: 'Pending' },
  ];

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading chamas...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Ultra Compact Controls */}
        <View style={styles.ultraCompactSection}>
          <View style={[styles.ultraSearchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={14} color={colors.textSecondary} />
            <TextInput
              style={[styles.ultraSearchInput, { color: colors.text }]}
              placeholder="Search..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Text style={[styles.ultraCount, { color: colors.textSecondary }]}>
              {filteredChamas.length}
            </Text>
          </View>

          <View style={styles.ultraFilterRow}>
            {filterOptions.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.ultraFilterButton,
                  {
                    backgroundColor: selectedFilter === option.key ? colors.primary : colors.surface,
                    borderColor: colors.border,
                  }
                ]}
                onPress={() => setSelectedFilter(option.key)}
              >
                <Text style={[
                  styles.ultraFilterText,
                  { color: selectedFilter === option.key ? colors.background : colors.text }
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Chamas List */}
        <ScrollView
          style={styles.chamasList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {filteredChamas.length === 0 ? (
            <View style={[styles.emptyState, styles.centered]}>
              <Ionicons name="business-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No Chamas Found
              </Text>
              <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
                {searchQuery || selectedFilter !== 'all'
                  ? 'No chamas match your current filters. Try adjusting your search or filter criteria.'
                  : 'There are no chamas in the system yet. Chamas will appear here once users create them.'
                }
              </Text>
              {(searchQuery || selectedFilter !== 'all') && (
                <TouchableOpacity
                  style={[styles.clearFiltersButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedFilter('all');
                  }}
                >
                  <Text style={[styles.clearFiltersText, { color: colors.background }]}>
                    Clear Filters
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredChamas.map(renderChamaCard)
          )}
        </ScrollView>

        {/* Chama Details Modal */}
        {renderChamaDetailsModal()}

        {/* Action Loading Overlay */}
        {actionLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.white }]}>
              Processing...
            </Text>
          </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  ultraCompactSection: {
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  ultraSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginBottom: 4,
    height: 32,
  },
  ultraSearchInput: {
    flex: 1,
    marginLeft: 4,
    fontSize: 12,
    paddingVertical: 0,
  },
  ultraCount: {
    fontSize: 10,
    fontWeight: '600',
    minWidth: 16,
    textAlign: 'right',
  },
  ultraFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  ultraFilterButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 4,
    marginBottom: 2,
    minHeight: 20,
    justifyContent: 'center',
  },
  ultraFilterText: {
    fontSize: 10,
    fontWeight: '500',
  },
  chamasList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  chamaCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  chamaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chamaInfo: {
    flex: 1,
    marginRight: 12,
  },
  chamaName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  chamaDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  chamaStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  chamaMeta: {
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 12,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  chamaActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  detailValue: {
    fontSize: 16,
  },
  statsContainer: {
    marginTop: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  modalActionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  walletTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  walletTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  walletTypeText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  emptyState: {
    flex: 1,
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  clearFiltersButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
  },
  clearFiltersText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
