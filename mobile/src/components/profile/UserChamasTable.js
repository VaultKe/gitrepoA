import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const UserChamasTable = memo(({
  colors,
  userChamas,
  chamasLoading,
  payingChamaFee,
  cooldownActive,
  cooldownRemaining,
  chamasPage,
  chamasPerPage,
  onPayChamaFee,
  onPrevPage,
  onNextPage,
}) => {
  const totalPages = useMemo(() => Math.ceil(userChamas.length / chamasPerPage), [userChamas.length, chamasPerPage]);
  const startIndex = (chamasPage - 1) * chamasPerPage;
  const paginatedChamas = userChamas.slice(startIndex, startIndex + chamasPerPage);

  if (chamasLoading) {
    return (
      <Card variant="outlined" style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          My Chamas & Groups
        </Text>
        <ActivityIndicator size="small" color={colors.primary} />
      </Card>
    );
  }

  if (userChamas.length === 0) {
    return (
      <Card variant="outlined" style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          My Chamas & Groups
        </Text>
        <Text style={[styles.activityDescText, { color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg }]}>
          You are not part of any chama or contribution group yet.
        </Text>
      </Card>
    );
  }

  return (
    <Card variant="outlined" style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        My Chamas & Groups
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chamasTable}>
          <View style={[styles.chamasTableHeader, { backgroundColor: colors.primary + '10', borderBottomColor: colors.primary }]}>
            <Text style={[styles.chamasTableHeaderText, { color: colors.primary, flex: 2 }]}>Name</Text>
            <Text style={[styles.chamasTableHeaderText, { color: colors.primary, flex: 1 }]}>Category</Text>
            <Text style={[styles.chamasTableHeaderText, { color: colors.primary, flex: 1 }]}>Role</Text>
            <Text style={[styles.chamasTableHeaderText, { color: colors.primary, flex: 1.2 }]}>Reg. Fee</Text>
            <Text style={[styles.chamasTableHeaderText, { color: colors.primary, flex: 1 }]}>Action</Text>
          </View>
          {paginatedChamas.map((chama, index) => {
            const isEven = index % 2 === 0;
            const hasUnpaidFee = !chama.service_fee_paid;
            const isPaying = payingChamaFee === chama.id;
            return (
              <View
                key={chama.id}
                style={[
                  styles.chamasTableRow,
                  { backgroundColor: isEven ? colors.background : colors.surface },
                  { borderBottomColor: colors.border },
                ]}
              >
                <Text style={[styles.chamasTableCell, { color: colors.text, flex: 2 }]} numberOfLines={1}>
                  {chama.name}
                </Text>
                <Text style={[styles.chamasTableCell, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                  {chama.category?.charAt(0).toUpperCase() + chama.category?.slice(1)}
                </Text>
                <Text style={[styles.chamasTableCell, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                  {chama.memberRole?.charAt(0).toUpperCase() + chama.memberRole?.slice(1)}
                </Text>
                <View style={[styles.chamasStatusCell, { flex: 1.2 }]}>
                  <Ionicons
                    name={chama.service_fee_paid ? 'checkmark-circle' : 'time'}
                    size={14}
                    color={chama.service_fee_paid ? colors.success : colors.warning}
                  />
                  <Text
                    style={[
                      styles.chamasStatusText,
                      { color: chama.service_fee_paid ? colors.success : colors.warning },
                    ]}
                  >
                    {chama.service_fee_paid ? 'Paid' : 'Pending'}
                  </Text>
                </View>
                <View style={[styles.chamasActionCell, { flex: 1 }]}>
                  {hasUnpaidFee ? (
                    <TouchableOpacity
                      style={[styles.chamasPayButton, { backgroundColor: colors.primary }]}
                      onPress={() => onPayChamaFee(chama)}
                      disabled={isPaying || cooldownActive}
                    >
                      {isPaying ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : cooldownActive ? (
                        <Text style={[styles.chamasPayButtonText, { color: colors.white }]}>
                          Wait {cooldownRemaining}s
                        </Text>
                      ) : (
                        <Text style={[styles.chamasPayButtonText, { color: colors.white }]}>
                          Pay
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.chamasPaidBadge, { backgroundColor: colors.success + '20' }]}>
                      <Ionicons name="checkmark" size={14} color={colors.success} />
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
      {totalPages > 1 && (
        <View style={styles.chamasPagination}>
          <TouchableOpacity
            style={[styles.chamasPageButton, { opacity: chamasPage === 1 ? 0.5 : 1 }]}
            onPress={onPrevPage}
            disabled={chamasPage === 1}
          >
            <Ionicons name="chevron-back" size={16} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.chamasPageText, { color: colors.text }]}>
            {chamasPage} / {totalPages}
          </Text>
          <TouchableOpacity
            style={[styles.chamasPageButton, { opacity: chamasPage === totalPages ? 0.5 : 1 }]}
            onPress={onNextPage}
            disabled={chamasPage === totalPages}
          >
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
});

const styles = StyleSheet.create({
  section: {
    margin: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  chamasTable: {
    minWidth: 600,
  },
  chamasTableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
  },
  chamasTableHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  chamasTableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
  },
  chamasTableCell: {
    flex: 1,
    fontSize: 12,
  },
  chamasStatusCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chamasStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  chamasActionCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chamasPayButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  chamasPayButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chamasPaidBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  chamasPagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  chamasPageButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  chamasPageText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activityDescText: {
    fontSize: 12,
    flexShrink: 1,
  },
});

export default UserChamasTable;
