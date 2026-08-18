import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';
import Button from '../common/Button';
import { getFeeStatusColor, getFeeStatusIcon, formatDate, formatCurrency } from '../../utils/viewMemberHelpers';

const ViewMemberServiceFeeSection = ({
  serviceFeePayments,
  memberData,
  userRole,
  payingFee,
  cooldownActive,
  cooldownRemaining,
  hasPaidServiceFee,
  feePaymentsLoading,
  onPayServiceFee,
  onPayMemberServiceFee,
  onDownloadReceipt,
  styles,
  colors,
}) => {
  if (feePaymentsLoading) {
    return (
      <Card variant="outlined" padding="none" style={styles.feeCard}>
        <View style={styles.feeCardContent}>
          <Text style={styles.feeCardTitle}>Service Fee Payments</Text>
          <Text style={{ padding: 16, color: colors.textSecondary }}>Loading...</Text>
        </View>
      </Card>
    );
  }

  const renderPendingRow = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feeTableHorizontalContent}>
      <View style={[styles.feeTableRow, { backgroundColor: colors.surface }]}>
        <Text style={[styles.feeTableCell, { color: colors.text, flex: 1.5 }]}>{formatDate(memberData.joined_at)}</Text>
        <Text style={[styles.feeTableCell, { color: colors.text, flex: 1 }]}>KES 50</Text>
        <View style={styles.feeStatusCell}>
          <Text style={[styles.feeStatusText, { color: colors.warning }]}>Pending</Text>
        </View>
        {(userRole === 'chairperson' || userRole === 'treasurer') && (
          <TouchableOpacity style={[styles.feePayButton, { backgroundColor: colors.primary }]} onPress={onPayMemberServiceFee} disabled={payingFee === 'pending' || cooldownActive}>
            {payingFee === 'pending' ? <Button title="Processing..." size="small" /> : cooldownActive ? (
              <Text style={[styles.feePayButtonText, { color: colors.white }]}>Wait {cooldownRemaining}s</Text>
            ) : (
              <Text style={[styles.feePayButtonText, { color: colors.white }]}>Pay</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );

  const renderPaidRow = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feeTableHorizontalContent}>
      <View style={[styles.feeTableRow, { backgroundColor: colors.surface }]}>
        <Text style={[styles.feeTableCell, { color: colors.text, flex: 1.5 }]}>{formatDate(memberData.service_fee_paid_at || memberData.joined_at)}</Text>
        <Text style={[styles.feeTableCell, { color: colors.text, flex: 1 }]}>KES 50</Text>
        <View style={styles.feeStatusCell}>
          <Text style={[styles.feeStatusText, { color: colors.success }]}>Paid</Text>
        </View>
        <TouchableOpacity style={[styles.feeReceiptButton, { backgroundColor: colors.success + '20', borderColor: colors.success }]} onPress={() => onDownloadReceipt(memberData, { id: 'service-fee', transactionId: memberData.service_fee_transaction_id })}>
          <Text style={[styles.feeReceiptButtonText, { color: colors.success }]}>ETR Receipt</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderPaymentsList = () => (
    <ScrollView style={styles.feeTableScroll} nestedScrollEnabled>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feeTableHorizontalContent}>
        <View style={styles.feeTable}>
          <View style={styles.feeTableHeader}>
            <Text style={[styles.feeTableHeaderText, { color: colors.primary, flex: 1.5 }]}>Date</Text>
            <Text style={[styles.feeTableHeaderText, { color: colors.primary, flex: 1 }]}>Amount</Text>
            <Text style={[styles.feeTableHeaderText, { color: colors.primary, flex: 1.5 }]}>Status</Text>
            {(userRole === 'chairperson' || userRole === 'treasurer') && (
              <Text style={[styles.feeTableHeaderText, { color: colors.primary, flex: 1, minWidth: 60, textAlign: 'center' }]}>Action</Text>
            )}
          </View>
          {serviceFeePayments.map((payment, index) => {
            const isEven = index % 2 === 0;
            return (
              <View key={payment?.id || `payment-${index}`} style={[styles.feeTableRow, { backgroundColor: isEven ? colors.background : colors.surface }]}>
                <Text style={[styles.feeTableCell, { color: colors.text, flex: 1.5 }]}>{formatDate(payment.dueDate || payment.createdAt)}</Text>
                <Text style={[styles.feeTableCell, { color: colors.text, flex: 1 }]}>{formatCurrency(payment.amount)}</Text>
                <View style={styles.feeStatusCell}>
                  <Text style={[styles.feeStatusText, { color: getFeeStatusColor(payment.status, colors) }]}>
                    {payment.status?.charAt(0).toUpperCase() + payment.status?.slice(1)}
                  </Text>
                </View>
                {!payment.transactionId && !payment.transaction_id && (
                  <TouchableOpacity style={[styles.feePayButton, { backgroundColor: colors.primary }]} onPress={() => onPayServiceFee(payment)} disabled={payingFee === payment.id}>
                    {payingFee === payment.id ? <Button title="Processing..." size="small" /> : <Text style={[styles.feePayButtonText, { color: colors.white }]}>Pay</Text>}
                  </TouchableOpacity>
                )}
                {(payment.transactionId || payment.transaction_id) && (
                  <TouchableOpacity style={[styles.feeReceiptButton, { backgroundColor: colors.success + '20', borderColor: colors.success }]} onPress={() => onDownloadReceipt(memberData, payment)}>
                    <Text style={[styles.feeReceiptButtonText, { color: colors.success }]}>ETR Receipt</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </ScrollView>
  );

  return (
    <Card variant="outlined" padding="none" style={styles.feeCard}>
      <View style={styles.feeCardContent}>
        <Text style={styles.feeCardTitle}>Service Fee Payments</Text>
        {serviceFeePayments.length === 0 && !hasPaidServiceFee ? renderPendingRow() : serviceFeePayments.length === 0 && hasPaidServiceFee ? renderPaidRow() : renderPaymentsList()}
      </View>
    </Card>
  );
};

export default ViewMemberServiceFeeSection;
