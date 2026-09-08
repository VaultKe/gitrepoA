import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import ReminderTableHeader from '../../../components/reminders/ReminderTableHeader';
import ReminderItem from '../../../components/reminders/ReminderItem';
import EmptyRemindersState from '../../../components/reminders/EmptyRemindersState';
// AddEditReminderModal removed: using navigated ReminderCreate screen instead
import useReminderScreen from '../../../hooks/useReminderScreen';
import styles from '../../../styles/ReminderScreenStyles';

const ReminderScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const { width } = useWindowDimensions();

  const screen = useReminderScreen();

  const isDesktop = width >= 768;

  const {
    loading,
    refreshing,
    filteredReminders,
    searchValue,
    filterValue,
    showAddModal,
    editingReminder,
    formData,
    setShowAddModal,
    setSearchValue,
    setFilterValue,
    setFormData,
    openAddModal,
    openEditModal,
    handleAddReminder,
    handleEditReminder,
    handleDeleteReminder,
    handleToggleReminder,
    onRefresh,
    resetForm,
  } = screen;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading reminders...</Text>
        </View>
      ) : (
        <View style={{ flex: 1, position: 'relative' }}>
          <ScrollView
            style={{ flex: 1 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 160 }}
          >
            <Card
              variant="outlined"
              style={{
                borderRadius: 8,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: 'transparent',
                shadowOpacity: 0,
                shadowRadius: 0,
                shadowOffset: { width: 0, height: 0 },
                elevation: 0,
                marginBottom: spacing.sm,
              }}
            >
              <ReminderTableHeader
                isDesktop={true} // force show filters on the reminders page (mobile + desktop)
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                filterValue={filterValue}
                onFilterChange={setFilterValue}
                onCreate={() => navigation.navigate('ReminderCreate')}
                showTableHeader={false}
              />
            </Card>

            {filteredReminders.length > 0 ? (
              filteredReminders.map((item) => (
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
                  <ReminderItem
                    reminder={item}
                    onToggle={handleToggleReminder}
                    onEdit={(r) => navigation.navigate('ReminderCreate', { reminder: r })}
                    onDelete={handleDeleteReminder}
                  />
                </Card>
              ))
            ) : (
              <Card variant="outlined" style={{ borderRadius: 8, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
                <EmptyRemindersState onAddReminder={() => navigation.navigate('ReminderCreate')} />
              </Card>
            )}
          </ScrollView>
          <PageRefreshButton onRefresh={onRefresh} refreshing={refreshing} color={colors.primary} bottom={64} />

          {/* Floating create button placed just above the refresh button, same size */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ReminderCreate')}
            style={{
              position: 'absolute',
              right: 16,
              bottom: 64 + 56 + 12, // above the refresh button
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              elevation: 6,
            }}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
  );
};

export default ReminderScreen;
