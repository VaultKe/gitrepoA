import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../../components/common/Card';
import { getThemeColors, spacing, typography } from '../../../utils/theme';
import ChamaMemberRow from './ChamaMemberRow';
import ChamaMembersEmptyState from './ChamaMembersEmptyState';

const ChamaMembersTable = ({
  filteredMembers,
  currentPage,
  totalPages,
  itemsPerPage,
  setCurrentPage,
  loading,
  navigation,
  chamaId,
  currentUser,
  userRole,
  searchQuery,
  onOpenRoleModal,
}) => {
  const colors = getThemeColors();
  const styles = createStyles(colors);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageMembers = filteredMembers.slice(startIndex, endIndex);

  return (
    <View style={styles.membersTableContainer}>
      <Card variant="outlined" padding="none" margin="none" style={styles.membersTableCard}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.membersTableScrollContent}
        >
          <View style={styles.membersTableContent}>
            <View style={styles.membersTableHeader}>
              <Text style={styles.tableHeaderName}>Name</Text>
              <Text style={styles.tableHeaderCenter}>Role</Text>
              <Text style={styles.tableHeaderCenter}>Attendance</Text>
              <Text style={styles.tableHeaderCenter}>Reputation</Text>
              <Text style={styles.tableHeaderCenter}>Actions</Text>
            </View>

            <FlatList
              style={styles.membersTableList}
              data={pageMembers}
              renderItem={({ item, index }) => (
                <ChamaMemberRow
                  item={item}
                  index={index}
                  navigation={navigation}
                  chamaId={chamaId}
                  currentUser={currentUser}
                  userRole={userRole}
                  onOpenRoleModal={onOpenRoleModal}
                />
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.membersList}
              scrollEnabled={false}
              ListEmptyComponent={!loading && filteredMembers.length === 0 && (
                <ChamaMembersEmptyState type="members" searchQuery={searchQuery} />
              )}
              showsVerticalScrollIndicator={false}
            />

            {filteredMembers.length > itemsPerPage && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    currentPage === 1 ? styles.paginationButtonDisabled : styles.paginationButtonActive,
                  ]}
                  onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={currentPage === 1 ? colors.textSecondary : colors.white}
                  />
                </TouchableOpacity>

                <Text style={styles.paginationText}>
                  Page {currentPage} of {totalPages}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    currentPage === totalPages ? styles.paginationButtonDisabled : styles.paginationButtonActive,
                  ]}
                  onPress={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={currentPage === totalPages ? colors.textSecondary : colors.white}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </Card>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  membersTableContainer: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    alignSelf: 'stretch',
  },
  membersTableScrollContent: {
    flexGrow: 1,
    width: '100%',
  },
  membersTableCard: {
    minHeight: 360,
    borderRadius: 8,
    width: '100%',
    alignSelf: 'stretch',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  membersTableContent: {
    minWidth: 520,
    width: '100%',
  },
  membersTableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tableHeaderName: {
    flex: 3,
    fontSize: 9,
    fontWeight: 'semibold',
    color: colors.text,
  },
  tableHeaderCenter: {
    flex: 1.5,
    fontSize: 9,
    fontWeight: 'semibold',
    color: colors.text,
    textAlign: 'center',
  },
  membersTableList: {
    flex: 1,
  },
  membersList: {
    padding: spacing.md,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paginationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
  },
  paginationButtonDisabled: {
    backgroundColor: colors.border,
  },
  paginationButtonActive: {
    backgroundColor: colors.primary,
  },
  paginationText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    minWidth: 80,
    textAlign: 'center',
    color: colors.text,
  },
});

export default ChamaMembersTable;
