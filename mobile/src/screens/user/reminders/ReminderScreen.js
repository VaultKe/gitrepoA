import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import ReminderTableHeader from '../../../components/reminders/ReminderTableHeader';
import ReminderItem from '../../../components/reminders/ReminderItem';
import EmptyRemindersState from '../../../components/reminders/EmptyRemindersState';
import AddEditReminderModal from '../../../components/reminders/AddEditReminderModal';
import useReminderScreen from '../../../hooks/useReminderScreen';
import styles from '../../../styles/ReminderScreenStyles';

const ReminderScreen = () => {
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
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }}
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
                isDesktop={isDesktop}
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                filterValue={filterValue}
                onFilterChange={setFilterValue}
                onCreate={openAddModal}
                showTableHeader={false}
              />
            </Card>

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
                minHeight: 400,
              }}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, minWidth: Math.max(width - 32, 760) }}
              >
                <View style={{ width: '100%' }}>
                  <ReminderTableHeader
                    isDesktop={isDesktop}
                    searchValue={searchValue}
                    onSearchChange={setSearchValue}
                    filterValue={filterValue}
                    onFilterChange={setFilterValue}
                    onCreate={openAddModal}
                    showSearchFilter={false}
                  />

                  <View style={{ width: '100%', flex: 1, minHeight: 380 }}>
                    {filteredReminders.length > 0 ? (
                      filteredReminders.map((item, index) => (
                        <ReminderItem
                          key={item.id}
                          reminder={item}
                          onToggle={handleToggleReminder}
                          onEdit={openEditModal}
                          onDelete={handleDeleteReminder}
                          index={index}
                        />
                      ))
                    ) : (
                      <EmptyRemindersState onAddReminder={openAddModal} />
                    )}
                  </View>
                </View>
              </ScrollView>
            </Card>
          </ScrollView>
          <PageRefreshButton onRefresh={onRefresh} refreshing={refreshing} color={colors.primary} bottom={64} />
        </View>
      )}

      <AddEditReminderModal
        visible={showAddModal}
        editingReminder={editingReminder}
        formData={formData}
        onFormDataChange={setFormData}
        onCancel={() => {
          setShowAddModal(false);
          setEditingReminder(null);
          resetForm();
        }}
        onSave={() => {
          if (editingReminder) {
            handleEditReminder();
          } else {
            handleAddReminder();
          }
        }}
      />
    </SafeAreaView>
  );
};

export default ReminderScreen;
