import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import Card from '../common/Card';
import Button from '../common/Button';
import { formatDate, formatCurrency } from '../../utils/viewMemberHelpers';

const ViewMemberApprovalSection = ({ approvalHistory, userRole, approvalHistoryLoading, isDesktop, isCombined, onInitiateApprove, styles, colors }) => {
  if (approvalHistoryLoading) {
    return (
      <View style={[styles.approvalLoadingContainer, { paddingVertical: 32, alignItems: 'center' }]}>
        <Text style={{ color: colors.textSecondary }}>Loading approvals...</Text>
      </View>
    );
  }

  if (approvalHistory.length === 0) {
    return (
      <View style={styles.approvalEmptyContainer}>
        <Text style={[styles.approvalEmptyText, { color: colors.textSecondary }]}>No pending approvals or verifications</Text>
      </View>
    );
  }

  const renderRows = () => (
    <>
      <View style={styles.approvalTableHeader}>
        <Text style={[styles.approvalTableHeaderText, { color: colors.primary, flex: 1.2 }]}>Type</Text>
        <Text style={[styles.approvalTableHeaderText, { color: colors.primary, flex: 1.5 }]}>Recipient</Text>
        <Text style={[styles.approvalTableHeaderText, { color: colors.primary, flex: 1 }]}>Amount</Text>
        <Text style={[styles.approvalTableHeaderText, { color: colors.primary, flex: 1.2 }]}>Date</Text>
        <Text style={[styles.approvalTableHeaderText, { color: colors.primary, flex: 1 }]}>Status</Text>
        <Text style={[styles.approvalTableHeaderText, { color: colors.primary, flex: 1, minWidth: 80, textAlign: 'center' }]}>Action</Text>
      </View>
      {approvalHistory.map((item, index) => {
        const isEven = index % 2 === 0;
        const canApprove = userRole === 'chairperson' || userRole === 'secretary' || userRole === 'treasurer' || item.randomVerifierId === user?.id || item.verifierId === user?.id;
        const isPending = item.status === 'pending' || item.approvalStatus === 'pending';
        return (
          <View key={item?.id || `approval-${index}`} style={[styles.approvalTableRow, { backgroundColor: isEven ? colors.background : colors.surface }]}>
            <Text style={[styles.approvalTableCell, { color: colors.text, flex: 1.2 }]}>{item.type || 'Welfare'}</Text>
            <Text style={[styles.approvalTableCell, { color: colors.text, flex: 1.5 }]}>{item.recipientName || item.member_name || 'N/A'}</Text>
            <Text style={[styles.approvalTableCell, { color: colors.text, flex: 1 }]}>{formatCurrency(item.amount)}</Text>
            <Text style={[styles.approvalTableCell, { color: colors.text, flex: 1.2 }]}>{formatDate(item.createdAt || item.date)}</Text>
            <View style={styles.approvalStatusCell}>
              <Text style={[styles.approvalStatusText, { color: item.status === 'approved' || item.approvalStatus === 'approved' ? colors.success : item.status === 'disbursed' || item.approvalStatus === 'disbursed' ? colors.primary : colors.warning }]}>
                {item.status || item.approvalStatus || 'Pending'}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 80, alignItems: 'center' }}>
              {isPending && canApprove ? (
                <Button title="Approve" onPress={() => onInitiateApprove(item)} size="small" style={{ paddingHorizontal: 8, paddingVertical: 4, minHeight: 28 }} />
              ) : (
                <Text style={[styles.approvalViewText, { color: colors.textSecondary }]}>View</Text>
              )}
            </View>
          </View>
        );
      })}
    </>
  );

  if (isDesktop) {
    return (
      <ScrollView style={styles.approvalTableScroll} nestedScrollEnabled>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.approvalTableHorizontalContent}>
          <View style={[styles.approvalTable, isCombined && styles.approvalTableCombinedDesktop]}>
            {renderRows()}
          </View>
        </ScrollView>
      </ScrollView>
    );
  }

  return (
    <View style={styles.tableScrollArea}>
      <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled contentContainerStyle={styles.tableScrollAreaContent}>
        <View style={styles.approvalTable}>{renderRows()}</View>
      </ScrollView>
    </View>
  );
};

export default ViewMemberApprovalSection;
