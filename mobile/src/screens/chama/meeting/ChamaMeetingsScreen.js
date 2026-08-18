import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, RefreshControl, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Button from '../../../components/common/Button';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import ChamaMeetingsTable from '../../../components/chama-meeting/ChamaMeetingsTable';
import useChamaMeetingsScreen from '../../../hooks/useChamaMeetingsScreen';

const ChamaMeetingsScreen = ({ route, navigation }) => {
  const screen = useChamaMeetingsScreen({ route, navigation });
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const {
    meetings,
    loading,
    refreshing,
    selectedTab,
    searchQuery,
    filterStatus,
    currentPage,
    showFilterDropdown,
    filterOptions,
    isUserMeetingsView,
    userRole,
    chamaId,
    chamaName,
    onRefresh,
    setSearchQuery,
    setFilterStatus,
    setCurrentPage,
    setShowFilterDropdown,
    getFilteredMeetings,
    getDynamicStatus,
    formatMeetingDate,
    handleViewSummary,
    handleAttend,
    handleDelete,
    handleScheduleMeeting,
  } = screen;

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Meetings Found</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {isUserMeetingsView
          ? 'No meetings found from your chamas'
          : 'No meetings have been scheduled yet'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <View style={styles.tableControls}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Search meetings..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            style={[styles.filterButton, { borderColor: colors.border }]}
            onPress={() => setShowFilterDropdown(!showFilterDropdown)}
          >
            <Text style={[styles.filterButtonText, { color: colors.text }]}>
              {filterOptions.find(opt => opt.id === filterStatus)?.name || 'All'}
            </Text>
            <Ionicons name={showFilterDropdown ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {showFilterDropdown && (
        <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setShowFilterDropdown(false)} />
      )}

      {showFilterDropdown && (
        <View style={[styles.dropdownContainer, {
          position: 'absolute',
          top: 100,
          right: 20,
          zIndex: 10000,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.text,
        }]}>
          {filterOptions.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[styles.dropdownItem, filterStatus === filter.id && { backgroundColor: colors.primary }]}
              onPress={() => {
                setFilterStatus(filter.id);
                setShowFilterDropdown(false);
                setCurrentPage(1);
              }}
            >
              <Text style={[styles.dropdownItemText, { color: filterStatus === filter.id ? colors.white : colors.text }]}>
                {filter.name}
              </Text>
              {filterStatus === filter.id && (
                <Ionicons name="checkmark" size={14} color={colors.white} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ flex: 1, position: 'relative' }}>
        <ChamaMeetingsTable
          meetings={getFilteredMeetings().meetings}
          totalCount={getFilteredMeetings().totalCount}
          totalPages={getFilteredMeetings().totalPages}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          renderEmptyState={renderEmptyState}
          formatMeetingDate={formatMeetingDate}
          getDynamicStatus={getDynamicStatus}
          getStatusColor={(status) => {
            switch (status) {
              case 'SCHEDULED': return colors.primary;
              case 'ONGOING': return colors.warning;
              case 'ENDED': return colors.success;
              case 'cancelled': return colors.error;
              default: return colors.textSecondary;
            }
          }}
          onViewSummary={handleViewSummary}
          onAttend={handleAttend}
          onDelete={handleDelete}
        />
        <View style={{ position: 'absolute', right: spacing.md, bottom: 64, flexDirection: 'column', alignItems: 'center', gap: spacing.md, zIndex: 999 }}>
          <PageRefreshButton onRefresh={onRefresh} refreshing={refreshing} color={colors.primary} absolute={false} />
          {!isUserMeetingsView && (
            <TouchableOpacity
              style={[styles.fab, { backgroundColor: colors.primary }]}
              onPress={handleScheduleMeeting}
            >
              <Ionicons name="add" size={24} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...shadows.sm },
  tableControls: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.md },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, height: 40 },
  searchIcon: { marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: typography.fontSize.base, paddingVertical: spacing.xs },
  filterButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minWidth: 100, justifyContent: 'space-between' },
  filterButtonText: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl },
  emptyTitle: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, marginTop: spacing.lg, marginBottom: spacing.sm },
  emptySubtitle: { fontSize: typography.fontSize.base, textAlign: 'center', marginBottom: spacing.xl },
  fab: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', ...shadows.lg },
  dropdownOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 },
  dropdownContainer: { minWidth: 200, maxWidth: 250, borderRadius: borderRadius.md, borderWidth: 1, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 20 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, justifyContent: 'space-between' },
  dropdownItemText: { flex: 1, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium },
});

export default ChamaMeetingsScreen;
