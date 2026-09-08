import React from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import useWelfareScreen from '../../../hooks/useWelfareScreen';
import WelfareRequestListCard from '../../../components/welfare/WelfareRequestListCard';
import ApprovedWelfareRequestRow from '../../../components/welfare/ApprovedWelfareRequestRow';
import WelfareContributionRow from '../../../components/welfare/WelfareContributionRow';
import CreateWelfareRequestModal from '../../../components/welfare/CreateWelfareRequestModal';
import BeneficiaryPickerModal from '../../../components/welfare/BeneficiaryPickerModal';
import ActionModal from '../../../components/welfare/ActionModal';
import styles from './WelfareScreenStyles';

const WelfareScreen = ({ route, navigation }) => {
  const { theme } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);

  const screen = useWelfareScreen({ route, navigation });

  const {
    welfareRequests,
    approvedWelfareRequests,
    loading,
    refreshing,
    showCreateModal,
    setShowCreateModal,
    votingInProgress,
    totalMembers,
    activeTab,
    setActiveTab,
    newRequest,
    setNewRequest,
    chamaMembers,
    loadingMembers,
    showBeneficiaryPicker,
    setShowBeneficiaryPicker,
    beneficiarySearch,
    filteredMembers,
    formErrors,
    setFormErrors,
    requestsCurrentPage,
    setRequestsCurrentPage,
    showActionModal,
    setShowActionModal,
    selectedTableItem,
    welfareCategories,
    urgencyLevels,
    itemsPerPage,
    hasValidChama,
    chamaId,
    tableStyles,
    loadWelfareRequests,
    loadChamaMembers,
    handleBeneficiarySearch,
    isMemberLeft,
    isUserIdLeft,
    toggleBeneficiary,
    getSelectedBeneficiaries,
    removeBeneficiary,
    clearAllBeneficiaries,
    validateForm,
    clearFieldError,
    onRefresh,
    handleCreateRequest,
    handleVote,
    formatCurrency,
    formatDate,
    getCategoryIcon,
    getCategoryColor,
    getUrgencyColor,
    getStatusColor,
    getBeneficiaryDisplayName,
    getRequesterDisplayName,
  } = screen;

  if (!hasValidChama) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContainer}>
          <Ionicons name="business" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No Chama Selected
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Please select a chama from the dashboard to view welfare
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backButtonText, { color: colors.white }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.tabContainer, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'requests' && { ...styles.activeTab, borderBottomColor: colors.primary }
          ]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'requests' ? colors.primary : colors.textSecondary }
          ]}>
            Welfare Requests
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'contributions' && { ...styles.activeTab, borderBottomColor: colors.primary }
          ]}
          onPress={() => setActiveTab('contributions')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'contributions' ? colors.primary : colors.textSecondary }
          ]}>
            Contributions
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {activeTab === 'requests' ? (
              <View>
                {welfareRequests.length === 0 && !loading ? (
                  <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
                    <View style={styles.emptyState}>
                      <Ionicons name="heart-outline" size={64} color={colors.textTertiary} />
                      <Text style={[styles.emptyTitle, { color: colors.text }]}>
                        No welfare requests
                      </Text>
                      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                        Be the first to create a welfare request for your community
                      </Text>
                    </View>
                  </Card>
                ) : (
                  welfareRequests
                    .slice((requestsCurrentPage - 1) * itemsPerPage, requestsCurrentPage * itemsPerPage)
                    .map((item) => (
                      <Card
                        key={item.id}
                        variant="outlined"
                        style={{
                          borderRadius: 14,
                          marginBottom: spacing.sm,
                          padding: spacing.md,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                        }}
                      >
                        <WelfareRequestListCard
                          item={item}
                          formatCurrency={formatCurrency}
                          formatDate={formatDate}
                          welfareCategories={welfareCategories}
                          urgencyLevels={urgencyLevels}
                          getCategoryIcon={getCategoryIcon}
                          getCategoryColor={getCategoryColor}
                          getUrgencyColor={getUrgencyColor}
                          getStatusColor={getStatusColor}
                          isUserIdLeft={isUserIdLeft}
                          getRequesterDisplayName={getRequesterDisplayName}
                          getBeneficiaryDisplayName={getBeneficiaryDisplayName}
                          onAction={(r) => {
                            screen.setSelectedTableItem(r);
                            screen.setShowActionModal(true);
                          }}
                        />
                      </Card>
                    ))
                )}
                {welfareRequests.length > itemsPerPage && (
                  <View style={[styles.pagination, { borderTopColor: colors.border, borderTopWidth: 0 }]}>
                    <TouchableOpacity
                      style={[
                        styles.pageButton,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                        requestsCurrentPage === 1 && styles.pageButtonDisabled,
                      ]}
                      onPress={() => requestsCurrentPage > 1 && setRequestsCurrentPage(requestsCurrentPage - 1)}
                      disabled={requestsCurrentPage === 1}
                    >
                      <Ionicons name="chevron-back" size={16} color={requestsCurrentPage === 1 ? colors.textSecondary : colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.pageText, { color: colors.text }]}>
                      {requestsCurrentPage} of {Math.ceil(welfareRequests.length / itemsPerPage)}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.pageButton,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                        requestsCurrentPage === Math.ceil(welfareRequests.length / itemsPerPage) && styles.pageButtonDisabled,
                      ]}
                      onPress={() => requestsCurrentPage < Math.ceil(welfareRequests.length / itemsPerPage) && setRequestsCurrentPage(requestsCurrentPage + 1)}
                      disabled={requestsCurrentPage === Math.ceil(welfareRequests.length / itemsPerPage)}
                    >
                      <Ionicons name="chevron-forward" size={16} color={requestsCurrentPage === Math.ceil(welfareRequests.length / itemsPerPage) ? colors.textSecondary : colors.text} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <View style={[tableStyles.tableHeader, { backgroundColor: colors.primary + '10', borderBottomColor: colors.primary }]}>
                      <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
                        <Text style={[tableStyles.tableHeaderText, { textAlign: 'left' }]}>Title</Text>
                      </View>
                      <View style={[tableStyles.tableCell, { flex: 2 }]}>
                        <Text style={tableStyles.tableHeaderText}>Beneficiary</Text>
                      </View>
                      <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
                        <Text style={tableStyles.tableHeaderText}>Needed</Text>
                      </View>
                      <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
                        <Text style={tableStyles.tableHeaderText}>Raised</Text>
                      </View>
                      <View style={[tableStyles.tableCell, tableStyles.typeCell]}>
                        <Text style={tableStyles.tableHeaderText}>Progress</Text>
                      </View>
                      <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
                        <Text style={tableStyles.tableHeaderText}>Actions</Text>
                      </View>
                    </View>
                    {approvedWelfareRequests.map((item, index) => (
                      <View key={item.id}>
                        <ApprovedWelfareRequestRow
                          item={item}
                          index={index}
                          colors={colors}
                          tableStyles={tableStyles}
                          formatCurrency={formatCurrency}
                          getCategoryIcon={getCategoryIcon}
                          getCategoryColor={getCategoryColor}
                          getUrgencyColor={getUrgencyColor}
                          isUserIdLeft={isUserIdLeft}
                          getBeneficiaryDisplayName={getBeneficiaryDisplayName}
                          setSelectedTableItem={screen.setSelectedTableItem}
                          setShowActionModal={screen.setShowActionModal}
                        />
                      </View>
                    ))}
                  </View>
                </ScrollView>
                {approvedWelfareRequests.length === 0 && !loading && (
                  <View style={styles.emptyState}>
                    <Ionicons name="wallet-outline" size={64} color={colors.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                      No approved welfare requests yet
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                      Approved welfare requests ready for contribution will appear here
                    </Text>
                  </View>
                )}
              </Card>
            )}
          </View>
        </ScrollView>
        <View style={{ position: 'absolute', right: spacing.sm, bottom: 64, flexDirection: 'column', alignItems: 'center', gap: spacing.md, zIndex: 999 }}>
          <PageRefreshButton onRefresh={onRefresh} refreshing={refreshing} color={colors.primary} absolute={false} />
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
      <CreateWelfareRequestModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        colors={colors}
        styles={styles}
        newRequest={newRequest}
        setNewRequest={setNewRequest}
        formErrors={formErrors}
        setFormErrors={setFormErrors}
        clearFieldError={clearFieldError}
        handleCreateRequest={handleCreateRequest}
        welfareCategories={welfareCategories}
        urgencyLevels={urgencyLevels}
        chamaMembers={chamaMembers}
        loadingMembers={loadingMembers}
        showBeneficiaryPicker={showBeneficiaryPicker}
        setShowBeneficiaryPicker={setShowBeneficiaryPicker}
        beneficiarySearch={beneficiarySearch}
        filteredMembers={filteredMembers}
        handleBeneficiarySearch={handleBeneficiarySearch}
        toggleBeneficiary={toggleBeneficiary}
        isMemberLeft={isMemberLeft}
        getSelectedBeneficiaries={getSelectedBeneficiaries}
        removeBeneficiary={removeBeneficiary}
        clearAllBeneficiaries={clearAllBeneficiaries}
      />
      <BeneficiaryPickerModal
        visible={showBeneficiaryPicker}
        onClose={() => setShowBeneficiaryPicker(false)}
        colors={colors}
        styles={styles}
        beneficiarySearch={beneficiarySearch}
        filteredMembers={filteredMembers}
        loadingMembers={loadingMembers}
        handleBeneficiarySearch={handleBeneficiarySearch}
        toggleBeneficiary={toggleBeneficiary}
        isMemberLeft={isMemberLeft}
        getSelectedBeneficiaries={getSelectedBeneficiaries}
        newRequest={newRequest}
      />
      <ActionModal
        visible={showActionModal}
        onClose={() => setShowActionModal(false)}
        colors={colors}
        styles={styles}
        selectedTableItem={selectedTableItem}
        activeTab={activeTab}
        handleVote={handleVote}
        navigation={navigation}
        chamaId={chamaId}
        votingInProgress={votingInProgress}
      />
    </SafeAreaView>
  );
};

export default WelfareScreen;
