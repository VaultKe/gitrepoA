import React from 'react';
import { View, SafeAreaView, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing } from '../../../utils/theme';
import useChamaTransactionsScreen from '../../../hooks/useChamaTransactionsScreen';
import ChamaTransactionsHeader from '../../../components/transactions/ChamaTransactionsHeader';
import ChamaTransactionsFilterChips from '../../../components/transactions/ChamaTransactionsFilterChips';
import ChamaTransactionsTable from '../../../components/transactions/ChamaTransactionsTable';
import ChamaTransactionsExportModal from '../../../components/transactions/ChamaTransactionsExportModal';
import ChamaTransactionsMemberSelectorModal from '../../../components/transactions/ChamaTransactionsMemberSelectorModal';
import ChamaTransactionsFilterDropdown from '../../../components/transactions/ChamaTransactionsFilterDropdown';
import ChamaTransactionsNoChama from '../../../components/transactions/ChamaTransactionsNoChama';
import PageRefreshButton from '../../../components/common/PageRefreshButton';

const ChamaTransactionsScreen = ({ navigation, route }) => {
  const { theme } = useApp();
  const {
    colors,
    canViewGroup,
    chamaId,
    transactions,
    loading,
    refreshing,
    selectedFilter,
    setSelectedFilter,
    viewMode,
    setViewMode,
    showExportModal,
    setShowExportModal,
    exportLoading,
    chamaMembers,
    showMemberSelector,
    setShowMemberSelector,
    showFilterDropdown,
    setShowFilterDropdown,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    isLoadingAll,
    onRefresh,
    handleDownload,
    handleExport,
    handleSelectFilter,
    handleIndividualReceipt,
    handleBulkPrintReceipts,
    handleBulkShareReceipts,
    totalPages,
    formatCurrency,
    formatDate,
  } = useChamaTransactionsScreen({ navigation, route });

  if (!chamaId) {
    return <ChamaTransactionsNoChama navigation={navigation} theme={theme} />;
  }

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={[styles.container, styles.containerBackground]}>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          style={styles.pageScroll}
          nestedScrollEnabled
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
          <ChamaTransactionsHeader
            viewMode={viewMode}
            setViewMode={setViewMode}
            selectedFilter={selectedFilter}
            isDropdownOpen={showFilterDropdown}
            canViewGroupRecords={() => canViewGroup}
            onToggleFilter={() => setShowFilterDropdown(!showFilterDropdown)}
            theme={theme}
          />

          <ChamaTransactionsFilterChips
            selectedFilter={selectedFilter}
            onSelectFilter={handleSelectFilter}
            theme={theme}
          />

          <ChamaTransactionsTable
            transactions={transactions}
            loading={loading}
            currentPage={currentPage}
            totalPages={totalPages}
            setCurrentPage={setCurrentPage}
            chamaMembers={chamaMembers}
            onReceiptPress={handleIndividualReceipt}
            onBulkPrintReceipts={handleBulkPrintReceipts}
            onBulkShareReceipts={handleBulkShareReceipts}
            exportLoading={exportLoading}
            selectedFilter={selectedFilter}
            theme={theme}
          />

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {showFilterDropdown && (
          <ChamaTransactionsFilterDropdown
            selectedFilter={selectedFilter}
            onSelectFilter={handleSelectFilter}
            theme={theme}
          />
        )}

        <ChamaTransactionsExportModal
          visible={showExportModal}
          transactionsCount={transactions.length}
          exportLoading={exportLoading}
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
          theme={theme}
        />

        <ChamaTransactionsMemberSelectorModal
          visible={showMemberSelector}
          chamaMembers={chamaMembers}
          onClose={() => setShowMemberSelector(false)}
          onSelectMember={(memberId) => {
            handleDownload('pdf', 'member', memberId);
          }}
          theme={theme}
        />

        <PageRefreshButton onRefresh={onRefresh} refreshing={refreshing} color={colors.primary} bottom={64} />
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  containerBackground: {
    backgroundColor: colors.background,
  },
  pageScroll: {
    flex: 1,
  },
  bottomSpacer: {
    height: spacing.xxxl,
  },
});

export default ChamaTransactionsScreen;
