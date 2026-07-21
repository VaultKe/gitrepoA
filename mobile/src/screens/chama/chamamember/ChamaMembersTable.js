import React from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../../components/common/Card';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
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
  theme,
}) => {
  const colors = getThemeColors(theme);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageMembers = filteredMembers.slice(startIndex, endIndex);

  return (
    <View style={{ marginHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.sm, alignSelf: 'stretch' }}>
      <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, width: '100%' }}>
          <View style={{ minWidth: 320, width: '100%' }}>
            <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.primary + '10', borderBottomWidth: 2, borderBottomColor: colors.primary }}>
              <Text style={{ flex: 1.5, fontSize: 12, fontWeight: 'semibold', color: colors.primary }}>Name</Text>
              <Text style={{ flex: 1.5, fontSize: 12, fontWeight: 'semibold', color: colors.primary, textAlign: 'center' }}>Role</Text>
              <Text style={{ flex: 1.5, fontSize: 12, fontWeight: 'semibold', color: colors.primary, textAlign: 'center' }}>Actions</Text>
            </View>

            <FlatList
              data={pageMembers}
              renderItem={({ item, index }) => (
                <ChamaMemberRow
                  item={item}
                  index={index}
                  navigation={navigation}
                  chamaId={chamaId}
                  currentUser={currentUser}
                  userRole={userRole}
                  theme={theme}
                  onOpenRoleModal={onOpenRoleModal}
                />
              )}
              keyExtractor={(item, index) => item?.id || `member-${index}`}
              contentContainerStyle={{ padding: spacing.md }}
              scrollEnabled={false}
              ListEmptyComponent={!loading && filteredMembers.length === 0 && (
                <ChamaMembersEmptyState type="members" searchQuery={searchQuery} theme={theme} />
              )}
              showsVerticalScrollIndicator={false}
            />

            {filteredMembers.length > itemsPerPage && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
                <TouchableOpacity
                  style={[
                    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.sm },
                    currentPage === 1 ? { backgroundColor: colors.border } : { backgroundColor: colors.primary },
                  ]}
                  onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <Ionicons name="chevron-back" size={16} color={currentPage === 1 ? colors.textSecondary : colors.white} />
                </TouchableOpacity>

                <Text style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, minWidth: 80, textAlign: 'center', color: colors.text }}>
                  Page {currentPage} of {totalPages}
                </Text>

                <TouchableOpacity
                  style={[
                    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.sm },
                    currentPage === totalPages ? { backgroundColor: colors.border } : { backgroundColor: colors.primary },
                  ]}
                  onPress={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  <Ionicons name="chevron-forward" size={16} color={currentPage === totalPages ? colors.textSecondary : colors.white} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </Card>
    </View>
  );
};

export default ChamaMembersTable;
